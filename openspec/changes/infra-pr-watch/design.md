# Design

## Context

- A session learns that the maintainer approved or merged a PR only from the chat. The app's PR monitor (auto-fix)
  wakes the session on CI failures, merge conflicts and review comments of a PR bound to the session, never on an
  approval or a merge. The Claude Code session can run a command in the background and is woken when it exits; a
  background command dies with the session.
- `reviewDecision` of a PR becomes `APPROVED` on this repository without branch protection: the agent account
  `homasters` authors the PRs, the maintainer `Homasters-max` approves (seen on PR #65).
- The rule `process` (`.warrant/local/rules/process.json`, rendered into `AGENTS.md`) is read by every session; the
  skill `slice` is read only when it is invoked. A behaviour every session must follow belongs in the rule.
- `.claude/skills/slice/status.mjs` holds an AREA while the Change state, the furthest of the records on `origin/main`
  and on its branches, is before `ARCHIVED`; a dependency is done when its issue is closed or its Change is `ARCHIVED`
  anywhere; `next()` calls a Change `ARCHIVED` on its branch done (issue #67).
- `.warrant/local/**` is a policy path (the maintainer's act); `.claude/**` is in the profile `human-acceptance`.
- On 2026-10-01 the maintainer turned the app's auto-fix on for the PRs of this project's sessions and asked that the
  session see approvals and merges itself.
- WARRANT: `PROPOSED->SPECIFIED` has no human gate (`ids-valid`, `required-artifacts-present`, `spec-valid`); the human
  approval is checked at `SPECIFIED->APPROVED` through the ref of the merged spec-PR, whose merge must bring `SPECIFIED`
  into the record (`warrant ci`, `REF_NOT_VERIFIED` otherwise); a `specify` Run starts only in `PROPOSED`; WARRANT's own
  flow is "specify → `SPECIFIED` → PR → human review → merge" (`docs/04-lifecycle.md`).

## Goals / Non-Goals

**Goals:** the maintainer never announces a merge; a spec-PR can never reach `main` without `SPECIFIED`; every PR that
waits for the maintainer is watched until its merge; every outcome of the watcher has a defined next step; an AREA and a
dependency are released only by the merge of the archive-PR.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. `wait-pr.mjs`

`node .claude/skills/slice/wait-pr.mjs <N> [--max-hours <h>]` (I-9: the mode `--until approved` of the approved design is
dropped — nothing waits for an approval any more):
- reads `gh pr view <N> --json state,mergeCommit,url` every 60 s;
- `MERGED` prints `PR #<N> MERGED <sha> <url>`, `CLOSED` prints `PR #<N> CLOSED <url>`, both exit 0;
- after `--max-hours` (default 24) exits 3 printing `PR #<N> still <state> after <h> h`;
- a failed check is retried after a minute and is never reported as a timeout; three in a row exit 2 with the error;
- exactly one positional PR number, any other argument is a usage error, exit 64;
- Node, no dependencies, `gh` through `execFileSync` without a shell (an `.exe`).

Rejected: a shell script — the session also runs on PowerShell; a shorter interval — a merge is not urgent to the
minute and every check is a GitHub API call; a webhook — no server.

### D-2. The rule — order of the spec-PR, watching, what next

The rule `process` changes in two places (texts in the Appendix):
- **step 1 (spec-PR)** — `warrant transition <change> SPECIFIED` is the last commit of the spec-PR, before the review is
  asked; the maintainer approves and merges in either order; changes the review asks for become `I-N` rows of the
  impl-PR, and the approval of the spec-PR is the decision on them (I-9);
- **a new paragraph "Waiting for the maintainer"** after "Parallel work":
  - **owner** — a PR is owned by the session that opened it; only the owner watches it and acts on its outcome; the
    coordinator owns only the PRs it opens (I-1);
  - **when** — right after the push that makes a PR wait for the maintainer's merge, the owner starts the watcher in the
    background, unless one for the same PR still runs;
  - **outcomes** — `MERGED`: the next step (impl-PR after a spec-PR only when `status.mjs <change>` prints
    `startable`, otherwise report and wait; archive-PR after an impl-PR; the next Change after an archive-PR);
    `CLOSED`: report and stop; exit 2 or 3: report and start it again (I-5);
  - **resume** — a session that starts or resumes starts the watchers of the PRs it owns that wait for the maintainer;
  - **binding** — after opening a PR the owner binds it in the desktop app with auto-fix on, or tells the maintainer
    that CI of that PR is not watched (I-6); CI is never polled;
  - **recovery** — a spec-PR merged without `SPECIFIED` is followed by a second spec-PR on the same branch name with
    only `warrant transition <change> SPECIFIED`, and the impl-PR refs that PR (I-7).

### D-3. AREA hold and dependencies in `status.mjs` (#67)

- A Change holds its AREAs while its state is active, or `ARCHIVED` on its branch but not on `origin/main` (the
  archive-PR is not merged).
- A dependency on a Change issue is done only when its Change is `ARCHIVED` on `origin/main`; closing that issue does
  not count. A dependency on an issue without a Change (a docs PR) is done when the issue is closed. A dependency whose
  Change is `ABANDONED`, or a Change issue closed without a record, is never done and asks the maintainer for a
  decision (I-4, I-8).
- `next()`: a Change `ARCHIVED` only on its branch goes through the checks of its open archive-PR ("fix CI" for a red
  one, "merge archive-PR" for the maintainer otherwise), or is "open archive-PR" when none is open (I-3, I-8).
- `SKILL.md` says the same and documents `wait-pr.mjs`.

### D-4. Delivery

One maintainer's patch (`git apply --index`): `.warrant/local/rules/process.json`, `.claude/skills/slice/wait-pr.mjs`
(new), `.claude/skills/slice/SKILL.md`, `.claude/skills/slice/status.mjs`; then `warrant sync` (`AGENTS.md`, lock). No
new test: the rule text is checked by the rule-delivery block of `test/process/pin.test.ts`; the scripts are tools of the
session, checked by running them on the real repository (task 2.1).

### D-5. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY`, `data_loss: NONE`, `security_impact: NONE` (read-only `gh` calls).

## Implementation Notes

From review 2 (`EVID-01M3WAV5EFRHPTDNBTHQD966AT`, `PROVEN`: MAJOR F-1, F-2; MINOR F-3…F-6), the implementation review
and the maintainer's decision Q35 — rows, not a new round; the maintainer's decision is the approval of the spec-PR
([PR #70](https://github.com/Homasters-max/LATTICE/pull/70#pullrequestreview-5383714608), whose body lists I-1…I-6) and,
for I-7 and I-9, Q35 in the chat of 2026-10-01 and the merge of PR #72. D-1…D-3 and the Appendix hold the final text
with these rows applied.

| # | Decision |
|---|---|
| I-1 | F-1: a PR is owned by the session that opened it; only the owner watches it and acts on its outcome. The coordinator owns only the PRs it opens (docs, process) and never acts on a Change's PR. On `MERGED` of a spec-PR the owner opens the impl-PR only when `status.mjs <change>` prints `startable` (WIP < 3, `main` not red); otherwise it reports and waits |
| I-2 | F-2: the `APPROVED` path ran live on spec-PR #70 and printed `MERGED` (I-7); after I-9 the mode is gone, nothing to check |
| I-3 | F-3: `status.mjs` — a Change `ARCHIVED` only on its branch goes through the checks of its open archive-PR, otherwise "open archive-PR" (agent); maintainer-queue rows without an open PR carry no URL |
| I-4 | F-4: a closed Change issue without a Change record asks for a decision and is not done |
| I-5 | F-5: exit 2 — report the error and start the watcher again, like exit 3 |
| I-6 | F-6: a session that cannot bind its PR in the desktop app tells the maintainer that CI of that PR is not watched |
| I-7 | Found live on #70: the maintainer approved and merged within a minute, before the agent's `SPECIFIED` commit; the merge did not bring `SPECIFIED` into the record. The first attempt — recording `SPECIFIED` in the first commit of the impl-PR (#71, `d1b203a`) — was refused by `warrant ci` on #71: `REF_NOT_VERIFIED`, the ref of `APPROVED` must be a merged PR that brings `SPECIFIED` (run 36908308347). Recovery: a second spec-PR on the same branch name with only `SPECIFIED` (#72), and the impl-PR rebuilt from `main` with `APPROVED --ref` #72. Prevention: I-9 |
| I-8 | Implementation review (rule `process`, skill `code-review`). Taken: `wait-pr.mjs` reads exactly one positional PR number and rejects other arguments (exit 64; `--max-hours 2 65` watched #2), a failed check is retried after a minute and never reported as a timeout, `gh` runs without a shell; `status.mjs` sends a red or draft archive-PR to the agent ("fix CI"), "open archive-PR" only when none is open, one record reader for `origin/main` and the branches, the maintainer queue drops duplicates by URL (by text when there is none), a dependency that needs a decision puts the dependent row in the maintainer queue; `SKILL.md` keeps the usage line under "Commands". Kept: outcome lines end with the PR URL; a usage error exits 64 (as `status.mjs`) |
| I-9 | Q35 (the maintainer, 2026-10-01): `SPECIFIED` is the last commit of the spec-PR before the review is asked, so a spec-PR can never be merged without it — WARRANT puts no human gate on `PROPOSED->SPECIFIED` and checks the approval at `APPROVED` through the merged spec-PR. Changes the review asks for become `I-N` rows of the impl-PR (a `specify` Run starts only in `PROPOSED`), as in Changes `pin-v0-10-0`, `infra-baseline` and this one. The watcher no longer waits for an approval: `--until approved` and the 20 s interval are dropped (ST-M02); `status.mjs` asks the agent for `SPECIFIED` on an open spec-PR still in `PROPOSED`. Rejected: the spec-PR as a draft until approved — two acts of the maintainer apart in time, unknown whether GitHub counts an approval of a draft, and the draft already means "blocking UNKNOWN" |

## Appendix — the rule `process`

### Step 1, replaced

1. spec-PR (branch `spec/<change>` from `main`): `warrant init change <change>`; the artifacts proposal, specs,
design, tasks are written inside the Run `warrant run start <change> --operation specify` (then `warrant run finish`);
editing files without an active Run is `deny`; `openspec validate <change> --strict`, `warrant classify <change>`
(your own risk — `--propose`), spec review: `warrant run start <change> --operation review`, the whole JSON as the
prompt of the subagent `warrant-reviewer`; then `warrant verify <change>` and `warrant transition <change> SPECIFIED`
as the last commit, and only then the PR — a spec-PR is never offered for review without `SPECIFIED`. The maintainer
approves and merges, in either order; changes the review asks for become `I-N` rows of the impl-PR, and the approval of
the spec-PR is the decision on them.

### New paragraph, after "Parallel work"

Waiting for the maintainer: the maintainer never announces a merge. A PR is owned by the session that opened it; only
the owner watches it and acts on its outcome (the coordinator owns only the PRs it opens). Right after the push that
makes a PR wait for the maintainer's merge, the owner starts in the background (the background mode of its shell tool)
`node .claude/skills/slice/wait-pr.mjs <N>`, unless one for the same PR still runs. On its report: `MERGED` — the next
step (after a spec-PR the impl-PR only when `node .claude/skills/slice/status.mjs <change>` prints `startable`,
otherwise report and wait; after an impl-PR the archive-PR; after an archive-PR the next Change); `CLOSED` — report to
the maintainer and stop; exit 2 or 3 — report and start it again. A session that starts or resumes starts the watchers
of the PRs it owns that wait for the maintainer. After opening a PR the owner binds it in the desktop app with auto-fix
on, so CI failures, merge conflicts and review comments reach it — or tells the maintainer that CI of that PR is not
watched; CI is never polled. A spec-PR merged without `SPECIFIED` is followed by a second spec-PR on the same branch
name carrying only `warrant transition <change> SPECIFIED`; the impl-PR refs that PR.
