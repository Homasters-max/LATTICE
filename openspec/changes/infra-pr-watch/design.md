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

## Goals / Non-Goals

**Goals:** the maintainer never announces an approval or a merge; every PR that waits for the maintainer is watched
for its whole wait (spec-PR: approval, then merge); every outcome of the watcher has a defined next step; an AREA and a
dependency are released only by the merge of the archive-PR.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. `wait-pr.mjs`

`node .claude/skills/slice/wait-pr.mjs <N> --until approved|merged [--max-hours <h>]`:
- reads `gh pr view <N> --json state,reviewDecision,mergeCommit,url` once a minute;
- on every check the terminal states win first: `MERGED` prints `PR #<N> MERGED <sha>`, `CLOSED` prints
  `PR #<N> CLOSED`, both exit 0; only then, for `--until approved`, `reviewDecision` `APPROVED` prints
  `PR #<N> APPROVED` and exits 0;
- after `--max-hours` (default 24) exits 3 printing `PR #<N> still <state> after <h> h`;
- a `gh` error is retried on the next minute; three in a row exit 2 with the error;
- Node, no dependencies, `gh` through `execFileSync` (with `shell` on Windows, as `status.mjs` calls `warrant`).

Rejected: a shell script — the session also runs on PowerShell; a shorter interval — an approval is not urgent to the
minute and every check is a GitHub API call; a webhook — no server.

### D-2. The rule — when, which mode, what next

`process` gains one paragraph after "Parallel work" (text in the Appendix):
- **when** — right after the push that makes a PR wait for the maintainer;
- **mode** — a spec-PR waits twice: `--until approved` until the approval, then, after the push of `SPECIFIED`,
  `--until merged`; an impl-PR, an archive-PR and a PR without a Change: `--until merged`;
- **one watcher per PR** — before starting one, the session checks its own background commands; a watcher of the same
  PR and mode that still runs is kept, a later push to the PR does not start a second one;
- **outcomes** — `APPROVED`: commit `SPECIFIED`, push, watch `--until merged`; `MERGED`: the next step of the process
  (impl-PR after a spec-PR, archive-PR after an impl-PR, the next Change after an archive-PR); `CLOSED`: report to the
  maintainer and stop that line of work; exit 3: report the PR still waiting and start the watcher again; exit 2:
  report the error;
- **resume** — a session that starts or resumes finds the PRs of its Change (or, for the coordinator, of its slice)
  that wait for the maintainer and starts their watchers;
- **binding** — after opening a PR the session binds it to itself in the desktop app and turns its auto-fix on (the
  maintainer's standing decision of 2026-10-01), so CI failures, conflicts and review comments reach the session; CI is
  never polled.

### D-3. AREA hold and dependencies in `status.mjs` (#67)

- A Change holds its AREAs while its state is active, or `ARCHIVED` on its branch but not on `origin/main` (the
  archive-PR is not merged).
- A dependency on a Change issue is done only when its Change is `ARCHIVED` on `origin/main`; closing that issue does
  not count. A dependency on an issue without a Change (a docs PR) is done when the issue is closed. A dependency whose
  Change is `ABANDONED` is never done: `status` shows it as `abandoned — needs a decision` and `next` does not start the
  dependent Change.
- `next()` reports a Change `ARCHIVED` only on its branch as "merge archive-PR" for the maintainer (👤), not done, so
  its archive-PR stays in the maintainer queue.
- `SKILL.md` says the same and documents `wait-pr.mjs`.

### D-4. Delivery

One maintainer's patch (`git apply --index`): `.warrant/local/rules/process.json`, `.claude/skills/slice/wait-pr.mjs`
(new), `.claude/skills/slice/SKILL.md`, `.claude/skills/slice/status.mjs`; then `warrant sync` (`AGENTS.md`, lock). No
new test: the rule text is checked by the rule-delivery block of `test/process/pin.test.ts`; the scripts are tools of the
session, checked by running them on the real repository (task 2.1).

### D-5. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY`, `data_loss: NONE`, `security_impact: NONE` (read-only `gh` calls).

## Appendix — new paragraph of the rule `process`

Waiting for the maintainer: the maintainer never announces an approval or a merge. Right after the push that makes a PR
wait for the maintainer, the session starts in the background (the background mode of its shell tool)
`node .claude/skills/slice/wait-pr.mjs <N> --until <mode>` — a spec-PR `approved`, and after the push of `SPECIFIED`
`merged`; an impl-PR, an archive-PR or a PR without a Change `merged` — unless a watcher of the same PR and mode still
runs. On its report: `APPROVED` — commit `SPECIFIED`, push, watch the merge; `MERGED` — the next step (impl-PR,
archive-PR, the next Change); `CLOSED` — report to the maintainer and stop; exit 3 — report and start it again;
exit 2 — report the error. A session that starts or resumes starts the watchers of the PRs it owns that wait for the
maintainer. After opening a PR the session binds it in the desktop app with auto-fix on, so CI failures, merge
conflicts and review comments reach it; CI is never polled.
