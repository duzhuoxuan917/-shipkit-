export type Version = {
  major: number;
  minor: number;
  patch: number;
};

export type Commit = {
  hash: string;
  subject: string;
};

export type CommitGroup = {
  title: string;
  commits: Commit[];
};

const groupTitles: Record<string, string> = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance",
  docs: "Documentation",
  refactor: "Refactoring",
  test: "Tests",
  build: "Build System",
  ci: "Continuous Integration",
  chore: "Chores",
  style: "Styles",
  revert: "Reverts"
};

export function parseVersion(input: string): Version {
  const match = input.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version "${input}". Use a semantic version such as 1.2.3.`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function bumpVersion(current: Version, level: "major" | "minor" | "patch"): Version {
  if (level === "major") {
    return { major: current.major + 1, minor: 0, patch: 0 };
  }

  if (level === "minor") {
    return { major: current.major, minor: current.minor + 1, patch: 0 };
  }

  return { major: current.major, minor: current.minor, patch: current.patch + 1 };
}

export function classifyCommit(subject: string): string {
  if (/breaking change/i.test(subject) || /!:\s/.test(subject)) {
    return "Breaking Changes";
  }

  const match = subject.match(/^([a-z]+)(?:\([^)]*\))?!?:\s/i);
  return match ? (groupTitles[match[1].toLowerCase()] ?? "Other Changes") : "Other Changes";
}

export function groupCommits(commits: Commit[]): CommitGroup[] {
  const order = [
    "Breaking Changes",
    "Features",
    "Bug Fixes",
    "Performance",
    "Documentation",
    "Refactoring",
    "Build System",
    "Continuous Integration",
    "Tests",
    "Chores",
    "Styles",
    "Reverts",
    "Other Changes"
  ];
  const groups = new Map<string, Commit[]>();

  for (const commit of commits) {
    const title = classifyCommit(commit.subject);
    const group = groups.get(title) ?? [];
    group.push(commit);
    groups.set(title, group);
  }

  return order
    .filter((title) => groups.has(title))
    .map((title) => ({ title, commits: groups.get(title) ?? [] }));
}

export function renderChangelog(version: Version, commits: Commit[], date: string): string {
  const groups = groupCommits(commits);
  const lines = [`## [${formatVersion(version)}] - ${date}`, ""];

  if (groups.length === 0) {
    lines.push("- No user-facing changes recorded.", "");
    return lines.join("\n");
  }

  for (const group of groups) {
    lines.push(`### ${group.title}`, "");
    for (const commit of group.commits) {
      lines.push(`- ${commit.subject} (${commit.hash})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
