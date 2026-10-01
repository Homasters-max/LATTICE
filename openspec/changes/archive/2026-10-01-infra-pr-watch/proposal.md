# Proposal

## Why

The maintainer had to announce every approval and merge in the chat ("approved", "merged") before the session went
on. The desktop app wakes a session on CI failures, merge conflicts and review comments of a bound PR (auto-fix), but
not on an approval or a merge. On 2026-10-01 the maintainer asked that the session see these acts itself, and that this
be a rule, not a habit of one session.

The skill `slice` (#64) also ends the hold of an AREA at `ARCHIVED` on the archive branch; Change `infra-baseline`
(design I-2) moved the end to the merge of the archive-PR into `main` — otherwise the next Change branches from a `main`
without the archived requirements (issue #67). Both live in `.claude/skills/slice/` and in the rule `process`, so they
go together.

## What Changes

- **New script `.claude/skills/slice/wait-pr.mjs`**: waits until a PR is merged or closed, or (`--until approved`)
  approved, checking GitHub once a minute; prints the outcome and exits. No dependencies.
- **Rule `process`** (`.warrant/local/rules/process.json`): every PR that waits for the maintainer is watched in the
  background for its whole wait (a spec-PR: approval, then merge), one watcher per PR, each outcome with its next step,
  watchers restarted on resume; the PR is bound in the desktop app with auto-fix on, so CI failures, conflicts and
  review comments arrive without polling. `warrant sync` regenerates `AGENTS.md`.
- **Skill `slice`**: `SKILL.md` documents `wait-pr.mjs`; `status.mjs` holds an AREA until the archive-PR is merged into
  `main` (a record `ARCHIVED` on `origin/main`), a Change dependency is done only then, and an archive-PR waiting for
  its merge stays in the maintainer queue (#67).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the product LATTICE does not change (`skip_specs: true`).

## Impact

- Paths: `.warrant/local/rules/process.json` (policy path), `.claude/skills/slice/{wait-pr.mjs,SKILL.md,status.mjs}`
  (profile `human-acceptance`); generated: `AGENTS.md`, `.warrant/warrant.lock.json`. One maintainer's patch.
- Closes #67.

## Non-goals

- Watching CI checks: the app's auto-fix does it; the rule forbids polling them.
- A notification to the maintainer's phone or mail.
- Any change of `.github/workflows/**`, of other rules, of `src/` or `test/` beyond what D-4 lists.
