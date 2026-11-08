import test from "node:test";
import assert from "node:assert/strict";
import {
  bumpVersion,
  classifyCommit,
  formatVersion,
  groupCommits,
  parseVersion,
  renderChangelog
} from "../dist/core.js";

test("parses and formats semantic versions", () => {
  const version = parseVersion("v1.2.3");
  assert.deepEqual(version, { major: 1, minor: 2, patch: 3 });
  assert.equal(formatVersion(version), "1.2.3");
});

test("bumps semantic versions", () => {
  const version = parseVersion("1.2.3");
  assert.equal(formatVersion(bumpVersion(version, "major")), "2.0.0");
  assert.equal(formatVersion(bumpVersion(version, "minor")), "1.3.0");
  assert.equal(formatVersion(bumpVersion(version, "patch")), "1.2.4");
});

test("classifies conventional commits", () => {
  assert.equal(classifyCommit("feat(cli): add release preview"), "Features");
  assert.equal(classifyCommit("fix: handle missing tags"), "Bug Fixes");
  assert.equal(classifyCommit("feat!: change config format"), "Breaking Changes");
  assert.equal(classifyCommit("update README"), "Other Changes");
});

test("renders grouped changelog notes", () => {
  const notes = renderChangelog(
    parseVersion("1.4.0"),
    [
      { hash: "abc123", subject: "feat: add preview" },
      { hash: "def456", subject: "fix: handle empty history" }
    ],
    "2026-11-08"
  );
  assert.match(notes, /## \[1\.4\.0\] - 2026-11-08/);
  assert.match(notes, /### Features/);
  assert.match(notes, /- feat: add preview \(abc123\)/);
  assert.equal(groupCommits([]).length, 0);
});
