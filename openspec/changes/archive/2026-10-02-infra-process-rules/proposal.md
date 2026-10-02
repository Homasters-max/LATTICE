# Proposal

## Why

On 2026-10-02 the maintainer changed three project rules in PRs without a Change (#90, #96), and the job `warrant`
refused both: `SCOPE_VIOLATION` — a policy path (`factory-change`: `.warrant/local/rules/*.json`,
`.warrant/warrant.lock.json`) changes only in a pull request of a Change. The maintainer decided in the coordinator
session of S0 the same day that one infra Change carries both patches and the fix of the slice status script (#97).

- **WARRANT defects** went to the local folder `D:/tmp/warrant-inbox/`: nobody outside this machine sees them, they
  have no state, and a LATTICE issue cannot link one (#90).
- **Approval**: a session cannot approve a PR — it runs as `homasters`, the author of every PR, and GitHub refuses an
  approve of one's own PR (PR #95); WARRANT takes the merged spec-PR as the approval (spec-PR #72 was merged without a
  review and accepted as the ref of `APPROVED`). A slice decision that changed an open PR came two minutes after its
  merge (#92: spec-PR #89 merged at 08:17, the decision on #44 at 08:19), and `main` got two delta specs with the same
  ids — `ids-valid` red for every Change (#96).
- **Slice status** (#94): on that `main` `status.mjs S0` printed `main: green` and offered `start impl-PR` to three
  Changes; it showed AREA `CL` held by one Change while two had declared it within a minute; and it listed bug issues
  #91…#94 as docs PRs to launch, #91 with a fake `CL` from its `Where:` line.

## What Changes

- **Rule `tracking`** (`.warrant/local/rules/tracking.json`): the maintainer's patch `44a3cb3` — a WARRANT defect, gap
  or idea is an issue in `Homasters-max/SRA`, opened by the agent, facts about WARRANT's behaviour only; and a red
  `main` is a failed `test` run **or** a failed `warrant validate` on `origin/main`, with the same P1 issue, freeze and
  `fix-main-<issue>` Change (design D-2, Appendix).
- **Rules `maintainer-acts` and `process`** (`.warrant/local/rules/{maintainer-acts,process}.json`, the maintainer's
  patch `3c51478`): the merge is the approval, GitHub's approve is not asked; a slice decision that changes an open PR
  turns it back to draft with `⛔ Do not merge — <decision URL>`; before asking for a merge the owner reads the
  umbrella comments newer than its last push; after `warrant init change` the session stops on an AREA held by another
  Change. This prevents the race of #92; the `warrant validate` check of `main` catches one that still happens.
- **Skill `slice`** (`.claude/skills/slice/`, #94): `main` is red when `warrant validate` fails on `origin/main`, not
  only when `test.yml` fails; a Change that holds an AREA another Change held first is an "AREA collision — needs a
  decision" in the maintainer queue; an issue labelled `bug` or `question` without a Change is neither a docs PR nor an
  AREA holder; a `fix-main-*` Change keeps its exemptions; the spec-PR row asks for a merge, not an approval. The rules
  of the script move into a pure module with its own `node:test` file.
- `warrant sync` regenerates `AGENTS.md` and the lock.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the product LATTICE does not change (`skip_specs: true`).

## Impact

- Paths: `.warrant/local/rules/{tracking,maintainer-acts,process}.json` (policy paths),
  `.claude/skills/slice/{status.mjs,rules.mjs,rules.test.mjs,SKILL.md}` (outside the `implement` write scope); all
  come as patches the maintainer applies and commits. Generated: `AGENTS.md`, `.warrant/warrant.lock.json`.
- Closes #94. Supersedes the closed PRs #90 and #96.

## Non-goals

- Old mentions of the inbox in archived Changes: history, they stay.
- An `enhancement` issue without a Change (#85, #86): still read as a docs issue.
- `status.mjs` reading umbrella comments for the owner, or turning a PR to draft: acts of the sessions (rule `process`).
- Any change of `.github/workflows/**`, of `src/` or `test/`.
