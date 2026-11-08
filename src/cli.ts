#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  bumpVersion,
  formatVersion,
  parseVersion,
  renderChangelog,
  type Commit,
  type Version
} from "./core.js";

type Config = {
  tagPrefix: string;
  commitLimit: number;
  changelogFile: string;
  releasePlanFile: string;
  release: {
    draft: boolean;
    prerelease: boolean;
  };
};

const defaultConfig: Config = {
  tagPrefix: "v",
  commitLimit: 100,
  changelogFile: "CHANGELOG.md",
  releasePlanFile: "RELEASE_PLAN.md",
  release: { draft: false, prerelease: false }
};

function git(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed: git ${args.join(" ")}\n${detail}`);
  }
}

function run(command: string, args: string[], root: string): void {
  try {
    execFileSync(command, args, { cwd: root, stdio: "inherit" });
  } catch {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function findRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

function readConfig(root: string): Config {
  const path = join(root, ".shipkit.json");
  if (!existsSync(path)) return defaultConfig;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Config>;
  return {
    ...defaultConfig,
    ...parsed,
    release: { ...defaultConfig.release, ...parsed.release }
  };
}

function readPackage(root: string): { path: string; data: Record<string, unknown>; version: Version } {
  const path = join(root, "package.json");
  if (!existsSync(path)) throw new Error("ShipKit currently requires a package.json project.");
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (typeof data.version !== "string") throw new Error("package.json must contain a version.");
  return { path, data, version: parseVersion(data.version) };
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseCommits(log: string): Commit[] {
  return log
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [first, ...subjectParts] = line.split("\t");
      const hash = first ?? "";
      return { hash, subject: subjectParts.join("\t") };
    })
    .filter((commit) => commit.hash && commit.subject);
}

function getCommits(root: string, config: Config): Commit[] {
  let tag: string | undefined;
  try {
    tag = git(root, ["describe", "--tags", "--abbrev=0"]);
  } catch {
    tag = undefined;
  }

  const range = tag ? [`${tag}..HEAD`] : [];
  const log = git(root, ["log", ...range, "-n", String(config.commitLimit), "--format=%h%x09%s"]);
  return parseCommits(log);
}

function getDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPositional(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith("--"));
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function commandInit(root: string): void {
  const configPath = join(root, ".shipkit.json");
  if (!existsSync(configPath)) writeJson(configPath, defaultConfig);

  const workflowPath = join(root, ".github", "workflows", "shipkit-release.yml");
  if (!existsSync(workflowPath)) {
    mkdirSync(dirname(workflowPath), { recursive: true });
    writeFileSync(workflowPath, workflowTemplate, "utf8");
  }

  console.log("ShipKit initialized.");
  console.log(`- Config: ${configPath}`);
  console.log(`- Workflow: ${workflowPath}`);
}

function commandVersion(root: string, args: string[]): void {
  const pkg = readPackage(root);
  const requested = getPositional(args)[0];
  if (!requested) throw new Error("Usage: shipkit version <major|minor|patch|x.y.z>");
  const next = ["major", "minor", "patch"].includes(requested)
    ? bumpVersion(pkg.version, requested as "major" | "minor" | "patch")
    : parseVersion(requested);
  const formatted = formatVersion(next);

  if (hasFlag(args, "--dry-run")) {
    console.log(`${pkg.data.version} -> ${formatted} (dry run)`);
    return;
  }

  pkg.data.version = formatted;
  writeJson(pkg.path, pkg.data);
  console.log(`Version updated: ${pkg.data.version}`);
}

function commandChangelog(root: string, args: string[]): void {
  const config = readConfig(root);
  const pkg = readPackage(root);
  const requested = getPositional(args)[0];
  const version = requested ? parseVersion(requested) : pkg.version;
  const notes = renderChangelog(version, getCommits(root, config), getDate());
  const changelogPath = join(root, config.changelogFile);
  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";
  const heading = existing.startsWith("# ") ? existing.slice(existing.indexOf("\n") + 1).trimStart() : existing;
  const header = existing.startsWith("# ") ? existing.slice(0, existing.indexOf("\n") + 1) : "# Changelog\n\n";
  writeFileSync(changelogPath, `${header}${notes}${heading}`, "utf8");
  console.log(`Changelog updated: ${changelogPath}`);
}

function commandPlan(root: string, args: string[]): void {
  const config = readConfig(root);
  const pkg = readPackage(root);
  const requested = getPositional(args)[0];
  const version = requested ? parseVersion(requested) : pkg.version;
  const tag = `${config.tagPrefix}${formatVersion(version)}`;
  const commits = getCommits(root, config);
  const notes = renderChangelog(version, commits, getDate());
  let remote = "not configured";
  try {
    remote = git(root, ["remote", "get-url", "origin"]);
  } catch {
    // A local release plan is still useful before the repository is connected.
  }
  const planPath = join(root, config.releasePlanFile);
  const plan = [
    `# Release Plan: ${tag}`,
    "",
    `- Package: ${String(pkg.data.name ?? "unknown")}`,
    `- Version: ${formatVersion(version)}`,
    `- Tag: ${tag}`,
    `- Remote: ${remote}`,
    `- Commits since last tag: ${commits.length}`,
    `- Generated: ${getDate()}`,
    "",
    "## Release checklist",
    "",
    "- [ ] CI is green",
    "- [ ] Changelog reviewed",
    "- [ ] Breaking changes documented",
    "- [ ] Version committed",
    "- [ ] Release preview approved",
    "- [ ] Publish with `shipkit release --publish`",
    "",
    "## Notes",
    "",
    notes.trim(),
    ""
  ].join("\n");
  writeFileSync(planPath, plan, "utf8");
  console.log(`Release plan written: ${planPath}`);
}

function commandCheck(root: string): void {
  const config = readConfig(root);
  const pkg = readPackage(root);
  const checks: Array<[string, boolean, string]> = [];
  checks.push(["package.json version", true, formatVersion(pkg.version)]);

  let status = "";
  try {
    status = git(root, ["status", "--porcelain"]);
    checks.push(["git repository", true, "available"]);
    checks.push(["working tree", status.length === 0, status.length === 0 ? "clean" : "has uncommitted changes"]);
  } catch {
    checks.push(["git repository", false, "not available"]);
  }

  try {
    const remote = git(root, ["remote", "get-url", "origin"]);
    checks.push(["origin remote", true, remote]);
  } catch {
    checks.push(["origin remote", false, "missing"]);
  }

  try {
    const ghVersion = execFileSync("gh", ["--version"], { encoding: "utf8" }).split(/\r?\n/)[0];
    checks.push(["GitHub CLI", true, ghVersion]);
  } catch {
    checks.push(["GitHub CLI", false, "install gh before publishing"]);
  }

  console.log(`ShipKit preflight: ${config.tagPrefix}${formatVersion(pkg.version)}`);
  for (const [name, passed, detail] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  }
  if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
}

function commandRelease(root: string, args: string[]): void {
  const config = readConfig(root);
  const pkg = readPackage(root);
  const requested = getPositional(args)[0];
  const version = requested ? parseVersion(requested) : pkg.version;
  const tag = `${config.tagPrefix}${formatVersion(version)}`;
  const notes = renderChangelog(version, getCommits(root, config), getDate());
  const publish = hasFlag(args, "--publish");

  if (!publish) {
    console.log(`Release preview for ${tag}`);
    console.log("--------------------------------");
    console.log(notes);
    console.log("Run with --publish after committing the version and changelog to create the GitHub release.");
    return;
  }

  if (!hasFlag(args, "--allow-dirty") && git(root, ["status", "--porcelain"])) {
    throw new Error("Working tree is not clean. Commit your changes first or pass --allow-dirty.");
  }

  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`], root);
  run("git", ["push", "origin", tag], root);
  const releaseArgs = ["release", "create", tag, "--title", tag, "--notes", notes];
  if (config.release.draft) releaseArgs.push("--draft");
  if (config.release.prerelease) releaseArgs.push("--prerelease");
  run("gh", releaseArgs, root);
  console.log(`Published GitHub release ${tag}.`);
}

function showHelp(): void {
  console.log(`ShipKit 0.2.0 - reviewable GitHub releases\n
Usage:
  shipkit init
  shipkit check
  shipkit plan [x.y.z]
  shipkit version <major|minor|patch|x.y.z> [--dry-run]
  shipkit changelog [x.y.z]
  shipkit release [x.y.z] [--publish] [--allow-dirty]

Commands:
  init       Add .shipkit.json and a manual GitHub Actions release workflow.
  check      Verify the repository is ready for a release.
  plan       Write a reviewable RELEASE_PLAN.md for the next release.
  version    Update the package.json version.
  changelog  Generate grouped notes from git history.
  release    Preview notes, or publish a tagged GitHub release with --publish.

The default is preview-only. Publishing requires an explicit --publish flag.
`);
}

const workflowTemplate = `name: ShipKit Release

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - run: node dist/cli.js release --publish
        env:
          GH_TOKEN: \${{ github.token }}
`;

try {
  const [command, ...args] = process.argv.slice(2);
  const root = findRoot();
  switch (command) {
    case "init":
      commandInit(root);
      break;
    case "version":
      commandVersion(root, args);
      break;
    case "check":
      commandCheck(root);
      break;
    case "plan":
      commandPlan(root, args);
      break;
    case "changelog":
      commandChangelog(root, args);
      break;
    case "release":
      commandRelease(root, args);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;
    default:
      throw new Error(`Unknown command "${command}". Run shipkit --help.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
