# Design

## Context

- A session learns that the maintainer approved or merged a PR only from the chat. The app's PR monitor (auto-fix)
  wakes the session on CI failures, merge conflicts and review comments of a bound PR, never on an approval or a merge.
  The Claude Code session can run a command in the background and is woken when it exits.
- The rule `process` (`.warrant/local/rules/process.json`, rendered into `AGENTS.md`) is read by every session; the
  skill `slice` is read only when it is invoked. A behaviour every session must follow belongs in the rule.
- `.claude/skills/slice/status.mjs` holds an AREA while the Change state, the furthest of the records on `origin/main`
  and on its branches, is before `ARCHIVED`; a dependency is done at `ARCHIVED` (issue #67).
- `.warrant/local/**` is a policy path (the maintainer's act); `.claude/**` is in the profile `human-acceptance`.

## Goals / Non-Goals

**Goals:** the maintainer never announces an approval or a merge; the rule makes every session wait in the background;
an AREA and a dependency are released only by the merge of the archive-PR.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. `wait-pr.mjs`

`node .claude/skills/slice/wait-pr.mjs <N> --until approved|merged [--max-hours <h>]`:
- reads `gh pr view <N> --json state,reviewDecision,mergeCommit,url` once a minute;
- `--until merged` exits 0 printing `PR #<N> MERGED <sha>` or `PR #<N> CLOSED`;
- `--until approved` exits 0 printing `PR #<N> APPROVED` when `reviewDecision` is `APPROVED`, or the merged/closed line
  if that comes first;
- after `--max-hours` (default 24) exits 3 printing `PR #<N> still <state> after <h> h`; a `gh` error is retried on the
  next minute, three in a row exit 2 with the error.
- Node, no dependencies, `gh` through `execFileSync` (with `shell` on Windows, as `status.mjs` calls `warrant`).

Rejected: a shell script — the session also runs on PowerShell; a shorter interval — an approval is not urgent to the
minute and every check is a GitHub API call; a webhook — no server.

### D-2. The rule

`process` gains one paragraph after "Parallel work" (text in the Appendix). The session starts the watcher with the
background mode of its shell tool right after the push that makes a PR wait for the maintainer: spec-PR `--until
approved` (the session then commits `SPECIFIED`), impl-PR and archive-PR `--until merged` (the session then starts the
next PR or the next Change). One watcher per waiting PR.

### D-3. AREA hold in `status.mjs` (#67)

A Change holds its AREAs while its state is active, or `ARCHIVED` on its branch but not yet on `origin/main` (the
archive-PR is not merged). A dependency issue counts as done when it is closed or its Change is `ARCHIVED` on
`origin/main`. `SKILL.md` says the same.

### D-4. Delivery

One maintainer's patch (`git apply --index`): `.warrant/local/rules/process.json`, `.claude/skills/slice/wait-pr.mjs`
(new), `.claude/skills/slice/SKILL.md`, `.claude/skills/slice/status.mjs`; then `warrant sync` (`AGENTS.md`, lock). No
test: the rule text is checked by the rule-delivery block of `test/process/pin.test.ts`; the scripts are tools of the
session, checked by running them on the real repository (task 2.1).

### D-5. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY`, `data_loss: NONE`, `security_impact: NONE` (read-only `gh` calls).

## Appendix — new paragraph of the rule `process`

Waiting for the maintainer: right after a push that leaves a PR waiting for the maintainer's approval or merge, the
session starts in the background (the background mode of its shell tool) `node .claude/skills/slice/wait-pr.mjs <N>
--until approved` for a spec-PR or `--until merged` for an impl-PR, an archive-PR or a PR without a Change, and goes on
when it reports — the maintainer never has to announce an approval or a merge. CI failures, merge conflicts and review
comments of the PR come from the app's auto-fix of the bound PR; they are never polled.
