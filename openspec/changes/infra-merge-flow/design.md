# Design

## Context

- **Accounts on the maintainer's machine.** `gh` holds two logins: `homasters` through `GH_TOKEN` (scopes `repo`,
  `workflow`; `gh auth status` reports `read:org` missing) and `Homasters-max` in the keyring (`roles.maintainer`). An
  agent's shell carries `CLAUDECODE=1`, `GH_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*` = `homasters`
  (`identities.agents` of `.warrant/warrant.json`). The maintainer's commands ran in a terminal without them: the
  activations `3812fcf`, `a17d55c`, `09f2579` and the patches `aaad7fc`, `5b537ab`, `712f95e` are authored by
  `Kat <94626159+Homasters-max@users.noreply.github.com>`, and every merge of the project is by `Homasters-max`
  (`gh pr view 109 --json mergedBy`).
- **Merges.** `allow_auto_merge` is on (`gh api repos/Homasters-max/LATTICE`); `main` has strict branch protection
  (required checks, branch up to date), set by the maintainer on 2026-10-02 (Change `infra-process-rules`, I-15). The
  agent's token cannot read the protection (HTTP 404, not an admin). `gh pr view --json` gives `mergeStateStatus`
  (`BEHIND`, `DIRTY`, `BLOCKED`, `CLEAN`, `UNKNOWN`…), `autoMergeRequest`, `statusCheckRollup`, `isDraft`,
  `headRefOid`, `commits`. `gh pr merge --auto` on a PR that may merge now merges it at once.
- **The watcher.** `.claude/skills/slice/wait-pr.mjs` (Change `infra-pr-watch`) reads `state,mergeCommit,url` every
  60 s and exits on `MERGED` or `CLOSED` (0), three `gh` errors (2), `--max-hours` (3), usage (64). The rule `process`
  makes the owner start it in the background after the push that makes a PR wait; the app's PR monitor (auto-fix) wakes
  the owner on CI failures, conflicts and review comments, never on a merge.
- **Waivers.** `warrant waive --activate <WAV> --by <login>` turns a `PROPOSED` waiver `ACTIVE` in
  `.warrant/waivers/<WAV>.json`; the maintainer committed that one file on the impl branch of the Change (`09f2579`).
  Ids are per branch, so two Changes in implementation can propose the same id (SRA#139; `WAV-2026-004` of
  `s0-apply-checks` and of `s0-kernel`).
- **Records.** Every Change archived in S0 (`s0-skeleton`, `s0-kernel`, `s0-apply-checks`, `s0-store-2`,
  `infra-process-rules`) carries the profile `human-acceptance`, which puts `human-approval` on `VERIFYING->MERGED`, so
  `warrant transition <change> MERGED` without `--by` answered `USAGE` on each.
- **Write scope.** The `implement` Run writes `src/**`, `test/**` and the Change's `tasks.md`, `design.md`,
  `specs/**` (Runs of `infra-process-rules`, `s0-store-2`). `.claude/**` is in the profile `human-acceptance` and
  `.warrant/local/**` is a policy path, so both come as the maintainer's patch, as in `infra-pr-watch` (D-4) and
  `infra-process-rules` (D-7).
- **Slice helpers.** `.claude/skills/slice/rules.mjs` exports pure functions this Change reuses without changing:
  `parseIssue`, `claimChanges` (the issue of a Change), `testResult` (the last `test.yml` run of `main`), `isFixMain`.
  An umbrella is the issue of a milestone whose body is a task list. The coordinator already tags binding umbrella
  comments `[decision]`, `[incident]` (#44); #101 owns the tag set, its acknowledgement and its reading in
  `status.mjs`.

## Goals / Non-Goals

**Goals:** every maintainer act is one command that refuses instead of half-doing; a PR is asked for merge once and
reaches `main` without another request when other PRs merge first; the four rule gaps of the transcripts are closed.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. `act.mjs` — one command per maintainer act

`node <worktree>/.claude/skills/slice/act.mjs <merge <N> | waiver <change> <WAV> | patch <change> <file>> [--dry-run]`

- Node, no dependencies; `gh` and `git` through `execFileSync` without a shell, `warrant` through the shell on Windows
  (a `.cmd` shim, as `status.mjs`). It runs from any directory: the repository is the one that holds the script
  (`git -C <dir of the script> rev-parse --git-common-dir`), and it acts on the worktree of the Change, found in
  `git worktree list --porcelain` by its branch `<kind>/<change>` (`kind` = `spec`, `impl`, `archive`).
- **Order:** every check runs before the first write; any failed check prints `refused: <reason>` (all reasons, one
  per line, each with its fix) and exits 1 having changed nothing. Then the act; then the verification against
  GitHub; success prints one line and exits 0. A failure after the first write rolls the worktree back to the commit
  it started from (D-5, D-6) and exits 2 with the error; a failure after the push exits 2 naming what was pushed.
  Exit 64 is a usage error.
- **`--dry-run`** runs every check, prints `would <act>` or the refusals, and writes nothing. It is allowed in any
  shell and under any login (D-2): the agent runs it before asking, and asks only when it passes.
- Pure decisions (refusals, entries, watcher steps) live in `act-rules.mjs` (D-8); `act.mjs` gathers facts and acts.

Rejected: one script per act — three copies of the actor and worktree checks; a PowerShell or bash script — the
command runs in either shell (rule `env`).

### D-2. Who runs it, and which copy

- **Actor.** Without `--dry-run` it refuses when: `CLAUDECODE` is set (an agent's shell — "act.mjs is the maintainer's
  act; the agent asks for it"); the login of `gh api user` is not in `roles.maintainer` of `origin/main`'s
  `.warrant/warrant.json` ("this terminal acts as `<login>` — run it in your own terminal, without the agent's
  `GH_TOKEN`"); for `waiver` and `patch`, the author identity (`git var GIT_AUTHOR_IDENT` in the worktree) belongs to an
  agent of `identities.agents` (its login as the name or in `<id>+<login>@users.noreply.github.com`). The environment
  is never altered: stripping `GH_TOKEN` would hand an agent's shell the maintainer's keyring login.
- **Copy.** After `git fetch origin`, each of `act.mjs`, `act-rules.mjs`, `rules.mjs` next to the script is compared
  with `origin/main` by blob id (`git hash-object` against `git rev-parse origin/main:<path>`, so line endings do not
  matter). A copy that differs (stale, or changed by a branch) refuses, and the refusal names the worktrees whose copy
  matches (`use: node <path>/.claude/skills/slice/act.mjs …`). When `origin/main` has no `act.mjs` (before this
  Change merges) the check prints `bootstrap: origin/main has no act.mjs` and goes on — the case of D-9.
- **The command the agent gives** names the copy in its own worktree, on a branch from fresh `origin/main`.

These checks catch a wrong terminal and a stale copy; they do not stop an agent that edits the script, which the rule
`maintainer-acts` and the merge itself (the control WARRANT checks) still do.

### D-3. `act.mjs merge <N>`

Facts: `gh pr view <N> --json number,url,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,`
`statusCheckRollup,autoMergeRequest,commits,comments,closingIssuesReferences`; the record of the Change on the PR head
(`git show <headRefOid>:.warrant/changes/<change>.json` after `git fetch origin`); its issue (`claimChanges` over
`gh issue list --state all`), or for a PR without a Change the issues it closes; the umbrella of that issue's milestone;
the comments of the umbrella and of the issue; the last completed `test.yml` run of `main`.

Refusals (D-8 `mergeRefusals`), each with its fix:
- not `OPEN`, or base not `main`;
- a draft ("a draft PR is never merged" — rule `process`);
- a failed check: a `statusCheckRollup` entry with conclusion `FAILURE`, `TIMED_OUT`, `CANCELLED`, `ACTION_REQUIRED`,
  `STARTUP_FAILURE` or state `FAILURE`, `ERROR`, named; pending checks do not refuse — auto-merge waits for them;
- `mergeStateStatus` `DIRTY`: a conflict, the owner resolves it;
- the record on the head is not in the state its PR kind ends in: `spec/` `SPECIFIED`, `impl/` `VERIFYING`,
  `archive/` `ARCHIVED` (a spec-PR is never merged without `SPECIFIED`, Change `infra-pr-watch` I-7);
- a pending entry of the umbrella or the issue (D-4), named by URL;
- `main` red by its last `test.yml` run, unless the Change is `fix-main-*` (rule `tracking`: only the fix is merged);
  the `warrant validate` half of a red `main` stays with `status.mjs` (about 10 s and a temporary worktree).

Act: `gh pr merge <N> --merge --auto`. Verification: `gh pr view <N>` shows `MERGED` (`merged <N> <sha>`) or an
`autoMergeRequest` (`auto-merge on for #<N>: merges when its checks pass and it is up to date; the owner's watcher keeps
it up to date`). Auto-merge is enabled by the maintainer's login, so GitHub records the maintainer as the one who merges
— the fact `human-approval` reads; the archive-PR checks `mergedBy` of the first PRs merged this way (D-9).

### D-4. Pending entries of the umbrella

An **entry** is a comment whose first line starts with `[decision]`, `[scope]` or `[broadcast]`, on the umbrella of
the PR's slice or on the issue of its Change. It **touches** the PR when it is a `[broadcast]`, or its text names the
Change as a word, the issue (`#<issue>`) or the PR (`#<N>` or its URL). It is **pending** when it is newer than the last
push of the PR — the `committedDate` of the head commit, which may only be older than the push, so the error is a
refusal, never a missed entry — and no later comment on the umbrella, the issue or the PR contains its URL (its
acknowledgement, written by the owner after reading it). `[incident]` and untagged comments are not entries.

`pendingEntries({ comments, change, issue, pr, since })` in `act-rules.mjs` is the one implementation; #101 reads the
same entries in `status.mjs` and may add tags or another form of acknowledgement there.

### D-5. `act.mjs waiver <change> <WAV>`

Checks: exactly one worktree on `impl/<change>`; it is clean (`git status --porcelain` empty); its `HEAD` equals
`origin/impl/<change>`, or is behind it and is fast-forwarded (`git merge --ff-only`; the watcher may have updated the
PR), else refused (local commits: the owner pushes first); `.warrant/waivers/<WAV>.json` exists there, names `<change>`
and is `PROPOSED`; no `<WAV>` on `origin/main` belongs to another Change (SRA#139: "re-propose under a new id").

Act: `warrant waive --activate <WAV> --by <login>` in the worktree; the only changed path must be the waiver file
(else roll back); `git commit -m "<change>: activate <WAV> (act.mjs)"`; `git push origin HEAD:impl/<change>`.
Verification: `git show origin/impl/<change>:.warrant/waivers/<WAV>.json` is `ACTIVE` →
`<WAV> ACTIVE on impl/<change> <sha>`. Roll back: `git reset --hard <start>` and removal of the untracked paths the act
created (the worktree was clean and equal to its remote before, so nothing else is lost).

The agent does not write to its worktree between asking and seeing the result (it checks it with `git log`).

### D-6. `act.mjs patch <change> <file>`

Checks: `<file>` exists and lies outside every worktree of the repository; exactly one worktree on `<kind>/<change>`,
clean and equal to its remote (as D-5); `git apply --check <file>` passes there; the patch touches no path that only
`warrant` writes (`.warrant/changes/**`, `.warrant/evidence/**`, `.warrant/runs/**`, `.warrant/waivers/**`,
`openspec/specs/**` — rule `process`).

Act: `git apply --index <file>`; the staged paths must equal the paths of `git apply --numstat <file>`;
`git commit -m "<change>: maintainer's patch <basename> (act.mjs)"`, with ` — <Subject>` when the file is a
`git format-patch` mail; `git push origin HEAD:<kind>/<change>`. Verification: `origin/<kind>/<change>` equals the new
commit → `patched <kind>/<change> <sha>: <paths>`. Roll back as D-5.

The patch is read where it lands: the agent lists its paths in the request, and the PR diff is what the merge
approves.

### D-7. `wait-pr.mjs` keeps an auto-merging PR up to date

Each check (60 s) reads `state,mergeCommit,url,mergeStateStatus,autoMergeRequest,headRefOid`; the step is
`watchStep(view, memo)` of `act-rules.mjs`:
- `MERGED`, `CLOSED` — as today, exit 0;
- `OPEN` and `DIRTY` — `PR #<N> CONFLICT <url>`, exit 4;
- `OPEN`, auto-merge on, `BEHIND`, and `headRefOid` not the head it last updated from — `gh pr update-branch <N>` (a
  merge commit), a progress line `PR #<N> behind main — updated`, and the watch goes on; a failed update that GitHub
  calls a conflict is exit 4, any other counts as a `gh` error;
- auto-merge seen on and now off while `OPEN` — `PR #<N> AUTO-MERGE OFF <url>`, exit 5 (a draft, a `--disable-auto`
  after a slice decision, or GitHub turned it off);
- otherwise wait; exit 2, 3, 64 as today.

The watcher updates only while auto-merge is on: before the request the owner updates the PR itself after the local
judge (rule `process`); after it, the update is a merge of `main` into an already judged head, and CI judges it again
before auto-merge can act. The watcher never reads checks: a red check reaches the owner through the app's PR monitor.

Rejected: a GitHub Action that updates PRs — a policy path, and a `GITHUB_TOKEN` push does not start the checks
auto-merge waits for; enabling the repository's "update branch" button — still a click per PR.

### D-8. Pure rules and their test

`.claude/skills/slice/act-rules.mjs`: `actorRefusals`, `mergeRefusals`, `pendingEntries`, `worktreeRefusals`,
`waiverRefusals`, `patchRefusals`, `watchStep`, `changeOfBranch` — plain data in, refusals (`{ reason, fix }`) or a
step out; no `gh`, `git`, `warrant`. `act-rules.test.mjs` (`node:test`, `node --test`) checks each refusal and its
absence, `pendingEntries` on comments taken from #44 (the plan comment touches no single Change; an entry naming the
Change; an acknowledged one; an `[incident]`), and every branch of `watchStep`. A test of a session tool, outside
`npm test` and the spec (`skip_specs`), as `rules.test.mjs`; the impl-PR pastes its run. `rules.mjs` and `status.mjs`
do not change (#101's paths).

### D-9. The rules, delivery and the proof

**Rules** (`.warrant/local/rules/{maintainer-acts,process,env}.json`, texts in the Appendix): each request for a
merge, an activation or a policy-path edit is one `act.mjs` command after a passing `--dry-run`; a PR is asked for
merge once; a slice decision also turns auto-merge off; the watcher's new outcomes; `warrant verify` right before
`APPROVED`; `MERGED` with `--by <maintainer>`; the local judge in a scratch worktree outside the repository, removed
afterwards; `read:org` as the maintainer's act. The rule texts are the maintainer's: the merge of this spec-PR is the
decision on the Appendix.

**Delivery**, two patches in `D:/tmp/infra-merge-flow/`, drafted by the agent outside the repository and checked with
`git apply --check` on the impl branch right before asking:
1. `1-merge-flow-scripts.patch` — `.claude/skills/slice/{act.mjs,act-rules.mjs,act-rules.test.mjs,wait-pr.mjs,SKILL.md}`;
   the maintainer applies and commits it as before `act.mjs` exists (`git -C <worktree> apply --index`, then
   `git -C <worktree> commit`), the agent pushes;
2. `2-merge-flow-rules.patch` — `.warrant/local/rules/{maintainer-acts,process,env}.json`; the maintainer applies it
   with `act.mjs patch infra-merge-flow <file>` from the worktree's copy (bootstrap, D-2) — the first live act.
Then the agent runs `warrant sync` (`AGENTS.md`, lock) as its own commit. A patch of the implementation review goes the
same way as 2. If `main` moves and a patch no longer applies, the agent re-cuts it.

**Proof of #111's "Done when":**
- before `VERIFYING` (tasks 2.x): the test; `--dry-run` of each act on real PRs and records; the refusal in an agent's
  shell; patch 2 applied by `act.mjs patch`;
- after, in the archive-PR (no task of `tasks.md`: they close before `VERIFYING`): the impl-PR is asked with `gh pr merge <N> --merge --auto` (the copy on `main` does not exist yet) and watched
  by the new `wait-pr.mjs` of the impl branch; the archive-PR is asked with `act.mjs merge` — this Change's PR merged by
  one `act.mjs merge`; an S0 PR merged by `act.mjs merge` and a waiver activation by `act.mjs waiver` come from the
  sessions of S0. This session posts on #111 the PRs, the `BEHIND` updates its watcher made and `mergedBy`; the
  archive-PR says `Closes #111` only when every item is seen by then, otherwise `Refs #111`, and the comment lists what
  remains for the coordinator to link and close.

### D-10. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY` (revert the scripts and the rule texts), `data_loss: NONE` (a roll
back resets only a clean worktree equal to its remote), `security_impact: LOW` — `act.mjs` merges and pushes with the
maintainer's credentials; it refuses an agent's shell, an agent's login or identity and a stale copy, and changes no
control WARRANT checks.

## Appendix — the changed rule texts

### `maintainer-acts`

Replaces "merging a PR (`gh pr merge <N> --merge`: the merge is the approval; …)" with "merging a PR (the merge is the
approval; …)", adds "granting a scope to the agents' GitHub token" to the list, and appends:

A merge, a waiver activation and a policy-path edit are each one command of the skill `slice`:
`node <worktree>/.claude/skills/slice/act.mjs merge <N>` (auto-merge, `gh pr merge <N> --merge --auto`) ·
`waiver <change> <WAV>` · `patch <change> <file>`, where `<worktree>` is the agent's own worktree on a branch from
fresh `origin/main` and `<file>` a patch outside the repository. The agent runs the same command with `--dry-run` first
and asks only when it passes. `act.mjs` checks, acts, commits, pushes and verifies, or refuses with the reason and
changes nothing; the agent fixes a refusal and asks the same command again.

### `process`

- Slice decision: "turns that PR back to draft (`gh pr ready <N> --undo`)" becomes "turns that PR back to draft
  (`gh pr ready <N> --undo`), turns its auto-merge off (`gh pr merge <N> --disable-auto`)".
- Local judge: "then in a scratch worktree `git checkout --detach origin/main`" becomes "then in a scratch worktree
  outside the repository (under the session's scratchpad, removed afterwards, so no evidence of the judge lands in a
  Change's folder) `git checkout --detach origin/main`".
- "A PR behind `main` is updated by its owner (…) and waits for green checks before the merge is asked." becomes:
  Before the merge is asked, a PR behind `main` is updated by its owner (`gh pr update-branch <N>`, a merge commit,
  after the local judge) and waits for green checks. A PR is asked for merge once: the maintainer's `act.mjs merge`
  turns on auto-merge, and from then on the owner's watcher keeps the PR up to date.
- After "one that touches its Change or an AREA it holds comes first.": An entry (`[decision]`, `[scope]`,
  `[broadcast]`) that names its Change is acknowledged by a comment linking it; `act.mjs merge` refuses a PR with an
  entry newer than its last push and not acknowledged.
- Waiting, outcomes: after "`CLOSED` — report to the maintainer and stop;": `CONFLICT` (exit 4) — merge `origin/main`
  into the branch, resolve, run the local judge, push and start the watcher again; `AUTO-MERGE OFF` (exit 5) — report
  to the maintainer why (a draft, ⛔, GitHub) and ask the merge again once it is fixed; — and after the outcomes: While
  auto-merge is on, the watcher updates a PR that falls behind `main` (`gh pr update-branch`, a merge commit; CI judges
  it), so the owner runs `git pull --ff-only` before its next commit on that branch.
- Step 2, first commit: "`warrant transition <change> APPROVED --ref …`" becomes "`warrant verify <change>` right
  before `warrant transition <change> APPROVED --ref <URL of the merged spec-PR> --by <maintainer>` (so `spec-valid`
  is fresh after merge commits)".
- Step 2, waiver: "the maintainer runs `warrant waive --activate <WAV> --by <login>` and commits it into the impl-PR
  branch before the merge, the agent asks for it in the PR" becomes "the agent asks in the PR for
  `act.mjs waiver <change> <WAV>`, which activates it with the maintainer's login, commits and pushes it into the
  impl-PR branch before the merge".
- Step 3: "`warrant transition <change> MERGED --ref <URL of the impl-PR>` — without `--by`; only if `warrant` answers
  `USAGE` … — with `--by <maintainer>`" becomes "`warrant transition <change> MERGED --ref <URL of the impl-PR> --by
  <maintainer>` (every Change here carries the profile `human-acceptance`, whose gate `human-approval` is on
  `VERIFYING->MERGED`)".
- Last paragraph: "`main` and `gh pr merge` are the maintainer's only" becomes "`main`, and `gh pr merge` except
  `--disable-auto`, are the maintainer's only; a policy-path edit is a patch the maintainer applies with
  `act.mjs patch`".

### `env`

Appended after "A long call runs in the background, with an interim status to the human.":

The agent's `gh` runs as `homasters` (`GH_TOKEN`); `gh pr edit` also needs the scope `read:org` on that token, which
the maintainer grants (a maintainer's act); without it a PR body is edited with
`gh api -X PATCH repos/{owner}/{repo}/pulls/<N> -F body=@<file>`. `act.mjs` refuses an agent's shell (`CLAUDECODE`)
and the agent's login: the maintainer runs it in their own terminal.
