# ShipKit

ShipKit is a small, predictable CLI for reviewable, repeatable GitHub releases. It turns conventional commits into grouped changelog notes, checks release readiness, writes a release plan, previews a release, and can publish a tag and GitHub Release when you explicitly ask it to.

## Why it exists

Release work is easy to postpone and easy to get subtly wrong. ShipKit keeps the workflow visible:

1. Bump `package.json` with a semantic version.
2. Generate a changelog from git history.
3. Run a release preflight check.
4. Write a reviewable release plan.
5. Preview the release notes.
6. Publish only with an explicit `--publish` flag.

The default behavior is read-only. This makes it suitable for local use and for a manually triggered GitHub Actions workflow.

## Install

```bash
npm install
npm run build
npm link
```

Or run it without linking:

```bash
node dist/cli.js --help
```

## Quick start

Run this in the repository you want to release:

```bash
shipkit init
shipkit version patch
shipkit changelog
shipkit check
shipkit plan
git add package.json CHANGELOG.md RELEASE_PLAN.md .shipkit.json .github/workflows/shipkit-release.yml
git commit -m "chore: prepare release"
shipkit release
shipkit release --publish
```

`shipkit release` previews notes. The `--publish` flag creates an annotated tag, pushes it to `origin`, and creates a GitHub Release with the GitHub CLI.

`shipkit check` catches a missing origin, a dirty working tree, or a missing GitHub CLI before publishing. `shipkit plan` creates a `RELEASE_PLAN.md` file for review in a pull request.

## Conventional commits

ShipKit groups common prefixes automatically:

```text
feat: add a release preview     -> Features
fix: handle an empty git log    -> Bug Fixes
perf: speed up config loading   -> Performance
docs: improve the README        -> Documentation
```

Commits without a recognized prefix are placed under `Other Changes`. Add `!:` to mark a breaking change.

## Configuration

`.shipkit.json` is optional:

```json
{
  "tagPrefix": "v",
  "commitLimit": 100,
  "changelogFile": "CHANGELOG.md",
  "releasePlanFile": "RELEASE_PLAN.md",
  "release": {
    "draft": false,
    "prerelease": false
  }
}
```

## GitHub Actions

`shipkit init` creates a manual workflow at `.github/workflows/shipkit-release.yml`. It uses the repository token and requires `contents: write` permission. Configure branch protection and release permissions before enabling it for a production repository.

## Product model

The repository is the free core. A practical commercial offer is:

| Edition | Includes | Suggested price |
| --- | --- | --- |
| Community | Versioning, changelog, checks, plans, preview, manual GitHub Release | Free |
| Pro | Monorepo plans, npm and Docker publishing, approval rules, Slack notifications | $49 one-time |
| Team | Shared config, release audit log, hosted dashboards, priority support | $19/month per team |

Keep Pro additions in a private package or a hosted service. Do not put license keys or private customer code in the public repository.

## Selling checklist

1. Publish this repository with a short demo GIF and one example release.
2. Add a checkout link to the repository description and README.
3. Deliver Pro as a private npm package, downloadable binary, or hosted GitHub App.
4. Use GitHub Issues and Discussions as the free support and discovery channel.

## Development

```bash
npm install
npm test
```

## License

MIT
