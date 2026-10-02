# Design

## Context

- **Accounts on the maintainer's machine.** `gh` holds two logins: `homasters` through `GH_TOKEN` (scopes `repo`,
  `workflow`; `gh auth status` reports `read:org` missing) and `Homasters-max` in the keyring (`roles.maintainer`). An
  agent's shell carries `CLAUDECODE=1`, `GH_TOKEN` and `GIT_AUTHOR_*` / `GIT_COMMITTER_*` = `homasters`
  (`identities.agents` of `.warrant/warrant.json`). The maintainer's commands ran without them: the activations
  `3812fcf`, `a17d55c`, `09f2579` and the patches `aaad7fc`, `5b537ab`, `712f95e` are authored by
  `Kat <94626159+Homasters-max@users.noreply.github.com>`, and every merge of the project is by `Homasters-max`
  (`gh pr view 109 --json mergedBy`). Whether those commands ran through the run button of a «❗ Выполнить» block or
  another terminal is not recorded (D-2 checks it before the first act).
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
  `specs/**` (Runs of `infra-process-rules`, `s0-store-2`); `warrant sync` writes `AGENTS.md` and the lock. The paths
  of the profile `human-acceptance` (`.claude/**`, `.warrant/local/**`, `.warrant/warrant.json`, `package.json`,
  `.github/workflows/**`…) and a Change's `proposal.md` after `PROPOSED` are written by no Run: they came as the
  maintainer's patch (`infra-pr-watch` D-4, `infra-process-rules` D-7, `s0-skeleton` `f99b5ab`).
- **Slice helpers.** `.claude/skills/slice/rules.mjs` exports pure functions this Change reuses without changing:
  `parseIssue` (Change, AREAs, umbrella), `claimChanges` (the issue of a Change), `testResult` (the last `test.yml` run
  of `main`), `isFixMain`. An umbrella is the issue of a milestone whose body is a task list. The coordinator already
  tags binding umbrella comments `[decision]`, `[incident]` (#44); #101 owns the tag set, its acknowledgement and its
  reading in `status.mjs`.

## Goals / Non-Goals

**Goals:** every maintainer act is one command that refuses instead of half-doing; a PR is asked for merge once and
reaches `main` without another request when other PRs merge first, and never while `main` is red; the four rule gaps
of the transcripts are closed.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. `act.mjs` — one command per maintainer act

`node <worktree>/.claude/skills/slice/act.mjs <merge <N> | waiver <change> <WAV> | patch <change> <file> | whoami>
[--dry-run]`

- Node, no dependencies; `gh` and `git` through `execFileSync` without a shell, `warrant` through the shell on Windows
  (a `.cmd` shim, as `status.mjs`). It runs from any directory: the repository is the one that holds the script
  (`git -C <dir of the script> rev-parse --git-common-dir`), and it acts on the worktree of the Change, found in
  `git worktree list --porcelain` by its branch `<kind>/<change>` (`kind` = `spec`, `impl`, `archive`).
- **Order:** `git fetch origin` (refs only), then every check, against the fetched refs; any failed check prints
  `refused: <reason> — <fix>` (all of them, one per line) and exits 1 having changed no worktree. Then the act; then
  the verification against GitHub; success prints one line and exits 0. A failure after the first write rolls the
  worktree back to the commit it started from (D-5) and exits 2 with the error; a failure after the push exits 2
  naming what was pushed. Exit 64 is a usage error.
- **`--dry-run`** fetches, runs every check except the actor's (D-2), prints `would <act>` or the refusals, and writes
  nothing else. The agent runs it before asking and asks only when it passes.
- **`whoami`** runs only the actor checks of D-2 and prints the login, the author identity and `ok`, or the refusals:
  the maintainer runs it once from the run button before the first act (task 1.3).
- Pure decisions (refusals, entries, watcher steps) live in `act-rules.mjs` (D-8); `act.mjs` gathers facts and acts.

Rejected: one script per act — three copies of the actor and worktree checks; a PowerShell or bash script — the
command runs in either shell (rule `env`).

### D-2. Who runs it, and which copy

- **Actor.** Without `--dry-run` it refuses when: `CLAUDECODE` is set (an agent's shell — "act.mjs is the maintainer's
  act; the agent asks for it"); the login of `gh api user` is not in `roles.maintainer` of `origin/main`'s
  `.warrant/warrant.json` ("this terminal acts as `<login>`: run it where `gh` uses your own login, without the agent's
  `GH_TOKEN`"); for `waiver` and `patch`, the author identity (`git var GIT_AUTHOR_IDENT` in the worktree) is an
  agent's of `identities.agents`. Logins compare exactly and case-insensitively (GitHub logins are): an identity is an
  agent's when its name equals the login or its email is exactly `<digits>+<login>@users.noreply.github.com` — `Kat
  <94626159+Homasters-max@…>` is not `homasters`'. The environment is never altered: stripping `GH_TOKEN` would hand an
  agent's shell the maintainer's keyring login. If the run button's terminal carries the agent's environment,
  `whoami` says so and the maintainer runs the same command in a terminal of their own (it works in bash and
  PowerShell).
- **Copy.** Each of `act.mjs`, `act-rules.mjs`, `rules.mjs` next to the script is compared with `origin/main` by blob
  id (`git hash-object` against `git rev-parse origin/main:<path>`, so line endings do not matter). A copy that differs
  (stale, or changed by a branch) refuses, and the refusal names the worktrees whose copy matches
  (`use: node <path>/.claude/skills/slice/act.mjs …`).
- **Bootstrap.** While `origin/main` has no `act.mjs` (before this Change merges) the copy check prints
  `bootstrap: origin/main has no act.mjs` and allows only `patch`, `whoami` and `--dry-run`; `merge` and `waiver`
  refuse — a merge must not be done by the code under that merge.
- **The command the agent gives** names the copy in its own worktree, on a branch from fresh `origin/main`.

These checks catch a wrong terminal and a stale copy; they do not stop an agent that edits the script, which the rule
`maintainer-acts` and the merge itself (the control WARRANT checks) still do.

### D-3. `act.mjs merge <N>`

Facts: `gh pr view <N> --json number,url,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,`
`statusCheckRollup,autoMergeRequest,comments,closingIssuesReferences`; the Change from `headRefName` when it is
`<kind>/<change>`; its record on the head (`git show <headRefOid>:.warrant/changes/<change>.json`); the newest
non-merge commit of the PR (`git log -1 --no-merges --format=%cI origin/main..<headRefOid>`); the issue of the Change
(`claimChanges` over `gh issue list --state all`), or for a PR without a Change the issues it closes; the umbrella of
that issue's milestone; the comments of the umbrella and of the issue; the last completed `test.yml` run of `main`.

Refusals (D-8 `mergeRefusals`), each with its fix:
- not `OPEN`, or base not `main`;
- a draft ("a draft PR is never merged" — rule `process`);
- a failed check: a `statusCheckRollup` entry with conclusion `FAILURE`, `TIMED_OUT`, `CANCELLED`, `ACTION_REQUIRED`,
  `STARTUP_FAILURE` or state `FAILURE`, `ERROR`, named; running checks do not refuse — auto-merge waits for them;
- `mergeStateStatus` `DIRTY`: a conflict, the owner resolves it;
- the record on the head is not in the state its PR kind ends in: `spec/` `SPECIFIED`, `impl/` `VERIFYING`,
  `archive/` `ARCHIVED` (a spec-PR is never merged without `SPECIFIED`, Change `infra-pr-watch` I-7);
- a pending entry (D-4), named by URL;
- `main` red by its last `test.yml` run (`testResult`), unless the Change is `fix-main-*` (rule `tracking`: only the
  fix is merged). An unknown result (no run) is a warning line, as in `status.mjs`; the `warrant validate` half of a red
  `main` stays with `status.mjs` (about 10 s and a temporary worktree).

Without a Change: a branch outside `<kind>/<change>` (a docs or process PR) has no record check. Without an issue or
without a milestone, entries are read from what exists — the issue's own comments, the PR's — and a note line says
`no umbrella read`; nothing refuses for it.

Act: `gh pr merge <N> --merge --auto`. Verification: `gh pr view <N>` shows `MERGED` (`merged <N> <sha>`) or an
`autoMergeRequest` (`auto-merge on for #<N>: merges when its checks pass and it is up to date; the owner's watcher keeps
it up to date`). Auto-merge is enabled by the maintainer's login, so GitHub records the maintainer as the one who merges
— the fact `human-approval` reads; the archive-PR checks `mergedBy` of the first PRs merged this way (D-9).

### D-4. Pending entries

- **Entry:** a comment whose first line starts with `[decision]`, `[scope]` or `[broadcast]`, on the umbrella of the
  PR's slice or on the issue of its Change. `[incident]` and untagged comments are not entries.
- **Touches** the PR when it is a `[broadcast]`, or its text names the Change, its issue, the PR or an AREA the Change
  holds (its `Where:`, `parseIssue`). A name matches as `rules.mjs` `namesIn` does (no `[\w.-]` before, no `[\w-]`
  after: `s0-store` is not in `s0-store-2`); `#<N>` not followed by a digit (`#11` is not in `#111`) or the URL of the
  issue or PR; an AREA as `` `<AREA>` `` or `AREA <AREA>`.
- **Pending** when it is newer than the last push of the PR and not acknowledged. The last push is the `committedDate`
  of the newest commit of the PR that is not a merge: a merge of `main` by the watcher or the owner moves nothing, and a
  commit is never newer than its push, so the error is a refusal, never a missed entry.
- **Acknowledged** by a later comment that contains the entry's URL and is either on the PR or, on the umbrella or the
  issue, names this Change or PR (the same matching). One comment for one PR does not acknowledge a `[broadcast]` for
  another. The author is not checked: every session runs as `homasters`.

`pendingEntries({ entries, acks, change, issue, pr, areas, since })` in `act-rules.mjs` is the one implementation;
#101 reads the same entries in `status.mjs` and may add tags or another form of acknowledgement there.

### D-5. `act.mjs waiver <change> <WAV>`

Checks, on the fetched refs: exactly one worktree on `impl/<change>`; it is clean (`git status --porcelain` empty);
its `HEAD` is `origin/impl/<change>` or an ancestor of it (local commits refuse: the owner pushes first);
`.warrant/waivers/<WAV>.json` on `origin/impl/<change>` names `<change>` and is `PROPOSED`; no `<WAV>` on
`origin/main` or on another `origin/impl/*` belongs to another Change (SRA#139: "re-propose under a new id").

Act: fast-forward to `origin/impl/<change>` if behind (`git merge --ff-only`, the first write — the watcher may have
updated the PR); `warrant waive --activate <WAV> --by <login>` in the worktree; the only changed path must be the
waiver file (else roll back); `git commit -m "<change>: activate <WAV> (act.mjs)"`;
`git push origin HEAD:impl/<change>`. Verification: `git show origin/impl/<change>:.warrant/waivers/<WAV>.json` is
`ACTIVE` → `<WAV> ACTIVE on impl/<change> <sha>`.

**Roll back** (D-5, D-6): `git reset --hard <start>` and removal of the untracked paths the act created. The worktree
was clean and at or behind its remote before, so nothing else is lost. The agent does not write to its worktree between
asking and seeing the result (it reads it with `git log`).

### D-6. `act.mjs patch <change> <file>`

Checks: `<file>` exists and lies outside every worktree of the repository; exactly one worktree on `<kind>/<change>`,
clean, at or behind its remote (as D-5); `git apply --check <file>` passes on `origin/<kind>/<change>`; every path of
the patch (`git apply --numstat`) is one no Run writes:
- **allowed:** the paths of the profile `human-acceptance` (read from `origin/main`) and
  `openspec/changes/<change>/proposal.md`;
- **refused**, with the writer as the fix: `src/**`, `test/**` and the Change's `design.md`, `tasks.md`, `specs/**`
  (the `implement` Run); `AGENTS.md` and `.warrant/warrant.lock.json` (`warrant sync`); `.warrant/changes/**`,
  `.warrant/evidence/**`, `.warrant/runs/**`, `.warrant/waivers/**`, `openspec/specs/**` (`warrant` only — rule
  `process`); any other path.

Act: fast-forward as D-5; `git apply --index <file>`; the staged paths must equal the patch's;
`git commit -m "<change>: maintainer's patch <basename> (act.mjs)"`, with ` — <Subject>` when the file is a
`git format-patch` mail; `git push origin HEAD:<kind>/<change>`. Verification: `origin/<kind>/<change>` is the new
commit → `patched <kind>/<change> <sha>: <paths>`. Roll back as D-5.

The patch is read where it lands: the agent lists its paths in the request, and the PR diff is what the merge approves.

### D-7. `wait-pr.mjs` keeps an auto-merging PR up to date

Each check (60 s) reads `state,mergeCommit,url,mergeStateStatus,autoMergeRequest,headRefOid,headRefName` and, while
auto-merge is on, the last completed `test.yml` run of `main`; the step is `watchStep(facts, memo)` of
`act-rules.mjs`:
- `MERGED`, `CLOSED` — as today, exit 0;
- `OPEN` and `DIRTY` — `PR #<N> CONFLICT <url>`, exit 4;
- auto-merge on, `main` red, the Change not `fix-main-*` — `gh pr merge <N> --disable-auto`, then
  `PR #<N> AUTO-MERGE OFF (main red: <run url>) <url>`, exit 5 (rule `tracking`: only the fix is merged);
- auto-merge on, `BEHIND`, and `headRefOid` not the head it last updated from — `gh pr update-branch <N>` (a merge
  commit), a progress line `PR #<N> behind main — updated`, and the watch goes on; a failed update GitHub calls a
  conflict is exit 4, any other counts as a `gh` error;
- auto-merge seen on and now off while `OPEN` — `PR #<N> AUTO-MERGE OFF <url>`, exit 5 (a draft, a `--disable-auto`
  after a slice decision, or GitHub);
- otherwise wait; exit 2, 3, 64 as today.

The watcher updates only while auto-merge is on: before the request the owner updates the PR itself after the local
judge (rule `process`); after it, the update is a merge of `main` into an already judged head, and CI judges it again
before auto-merge can act. It reports only a change it sees: a session that resumes reads `autoMergeRequest` of the PRs
whose merge it asked and reports one that is off (rule `process`). It never reads the PR's checks: a red check reaches
the owner through the app's PR monitor.

Rejected: a GitHub Action that updates PRs — a policy path, and a `GITHUB_TOKEN` push does not start the checks
auto-merge waits for; enabling the repository's "update branch" button — still a click per PR; a red `main` handled by
the session that opens its issue — it does not own the other PRs.

### D-8. Pure rules and their test

`.claude/skills/slice/act-rules.mjs`: `actorRefusals`, `copyRefusals`, `mergeRefusals`, `pendingEntries`,
`worktreeRefusals`, `waiverRefusals`, `patchRefusals`, `watchStep`, `changeOfBranch` — plain data in, refusals
(`{ reason, fix }`) or a step out; no `gh`, `git`, `warrant`. `act-rules.test.mjs` (`node:test`, `node --test`) checks
each refusal and its absence, including: `Kat <94626159+Homasters-max@…>` accepted and `homasters` refused as an
author; bootstrap allowing only `patch`; `pendingEntries` on comments taken from #44 (the plan comment touches no single
Change; an entry naming the Change; one naming `s0-store-2` for `s0-store`; `#111` for `#11`; an acknowledged one; a
`[broadcast]` acknowledged for another PR; an `[incident]`; an entry older than a watcher's merge of `main` but newer
than the last commit); a patch touching `src/**`; a waiver id on another `origin/impl/*`; every branch of `watchStep`,
the red `main` one included. A test of a session tool, outside `npm test` and the spec (`skip_specs`), as
`rules.test.mjs`; the impl-PR pastes its run. `rules.mjs` and `status.mjs` do not change (#101's paths).

### D-9. The rules, delivery and the proof

**Rules** (`.warrant/local/rules/{maintainer-acts,process,env}.json`, texts in the Appendix): each request for a
merge, an activation or a policy-path edit is one `act.mjs` command after a passing `--dry-run`; a PR is asked for
merge once; a slice decision and a red `main` turn auto-merge off; the watcher's new outcomes; `warrant verify` right
before `APPROVED`; `MERGED` with `--by <maintainer>`; the local judge in a scratch worktree outside the repository,
removed afterwards; `read:org` as the maintainer's act. The rule texts are the maintainer's: the merge of this spec-PR
is the decision on the Appendix.

**Delivery**, two patches in `D:/tmp/infra-merge-flow/`, drafted by the agent outside the repository and checked with
`git apply --check` on the impl branch right before asking:
1. `1-merge-flow-scripts.patch` — `.claude/skills/slice/{act.mjs,act-rules.mjs,act-rules.test.mjs,wait-pr.mjs,SKILL.md}`;
   the maintainer applies and commits it as before `act.mjs` exists (`git -C <worktree> apply --index`, then
   `git -C <worktree> commit`), the agent pushes;
2. `2-merge-flow-rules.patch` — `.warrant/local/rules/{maintainer-acts,process,env}.json`; after `act.mjs whoami`
   passes in the maintainer's terminal, the maintainer applies it with `act.mjs patch infra-merge-flow <file>` from the
   worktree's copy (bootstrap, D-2) — the first live act.
Then the agent runs `warrant sync` (`AGENTS.md`, lock) as its own commit. A patch of the implementation review goes the
same way as 2. If `main` moves and a patch no longer applies, the agent re-cuts it.

**Proof of #111's "Done when":**
- before `VERIFYING` (tasks 2.x): the test; `--dry-run` of each act on real PRs and records; the refusal in an agent's
  shell; `whoami` and patch 2 in the maintainer's terminal;
- after, in the archive-PR (no task of `tasks.md`: they close before `VERIFYING`): the impl-PR is asked with
  `gh pr merge <N> --merge --auto` (bootstrap refuses `merge`, D-2) and watched by the new `wait-pr.mjs` of the impl
  branch; the archive-PR is asked with `act.mjs merge` — this Change's PR merged by one `act.mjs merge`; an S0 PR merged
  by `act.mjs merge` and a waiver activation by `act.mjs waiver` come from the sessions of S0. This session posts on
  #111 the PRs, the `BEHIND` updates its watcher made and `mergedBy`; the archive-PR says `Closes #111` only when every
  item is seen by then, otherwise `Refs #111`, and the comment lists what remains for the coordinator to link and close.

### D-10. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY` (revert the scripts and the rule texts), `data_loss: NONE` (a roll
back resets only a clean worktree at or behind its remote), `security_impact: LOW` — `act.mjs` merges and pushes with
the maintainer's credentials; it refuses an agent's shell, an agent's login or identity, a stale copy and a patch of a
path a Run writes, and changes no control WARRANT checks.

## Review history

Review 1 (`EVID-01M3Y3NVZYQKM515MK2AJ4GWY1`, `PROVEN`: MAJOR F-1…F-8, MINOR F-9…F-16, INFO F-17), before `SPECIFIED`,
taken into this text: F-1 → D-7 and the Appendix (a red `main` turns auto-merge off by the watcher); F-2, F-3, F-4,
F-10 → D-4 (scoped acknowledgement, one "touches" with held AREAs, last push without merges, `namesIn` boundaries) and
the Appendix; F-5 → D-6 (paths no Run writes); F-6 → D-5 (other `origin/impl/*`); F-7 → D-1, D-2 (`whoami`, the
fallback terminal), task 1.3; F-8 → D-3 (no Change, no issue, no milestone); F-9 → D-1, D-5 (checks on fetched refs,
fast-forward as the first write); F-11 → D-2; F-12 → proposal; F-13 → D-2 (bootstrap refuses `merge`); F-14 → D-7
(a resumed session reads `autoMergeRequest`); F-15 → D-3; F-16 → task 2.2; F-17 → the Appendix (running checks).
U-1 (the run button's environment) is checked by `whoami` (task 1.3).

## Implementation Notes

From review 2 (`EVID-01M3Y47NT0H2WT98D2QZEBA9RD`, `PROVEN`: MAJOR F-1…F-6, MINOR F-7…F-15, INFO F-16) and the
implementation. The rows I-1…I-16 were proposed in the body of spec-PR
[#115](https://github.com/Homasters-max/LATTICE/pull/115); its merge by the maintainer is the decision on them. D-1…D-10
and the Appendix hold the approved text; these rows amend it.

| # | Decision |
|---|---|
| I-1 | F-1: `main` is red for `act.mjs merge` and the watcher also while an issue titled `infra: main red — …` is open (rule `tracking`: how a red `warrant validate` is announced) — `mainHealth` |
| I-2 | F-2: in `patchPathWriter` the refused list wins over the profile: `AGENTS.md`, the lock and `.warrant/waivers/**` are refused though the profile names them |
| I-3 | F-3: the last push is the newest commit of the PR that is not a merge and was committed by an agent (`lastPush`): a maintainer's `act.mjs` commit and a merge of `main` move nothing; with none, every touching entry is pending (a refusal in doubt). D-4's "never a missed entry" reads "a refusal in doubt" |
| I-4 | F-4: PRs open when the impl-PR merges keep the old `wait-pr.mjs` of their branch; after the merge this session posts a `[broadcast]` on #44 — owners of open PRs update their branch, pull, and restart their watchers |
| I-5 | F-5: a copy of `act.mjs`, `act-rules.mjs` or `rules.mjs` that differs from `origin/main` is not refused: `act.mjs` writes the three blobs of `origin/main` to a temporary directory and runs that copy (`LATTICE_ACT_REPO`, `LATTICE_ACT_REEXEC`), then removes it — `copyPlan` mode `reexec` |
| I-6 | F-6: the rule `process` says only that the owner acknowledges an entry with a comment in the PR that links it and that `act.mjs merge` refuses an unacknowledged entry touching the PR (skill `slice`); the tags and the matching live in `SKILL.md` and `act-rules.mjs`, which #101 extends |
| I-7 | F-7: the agent asks for an act with no Run active and a clean, pushed worktree (`SKILL.md`); `worktreeRefusals` names an untracked Run file like any change |
| I-8 | F-8: `#<N>` matches when not preceded by `[\w/-]`: `SRA#139` is not `#139` |
| I-9 | F-9: `git fetch --prune origin` before every check |
| I-10 | F-10: `waiver` refuses a `warrant` outside `kernel` of `warrant.json` (`versionMatches`) |
| I-11 | F-11: the passing `merge --dry-run` of task 2.2 runs on any open PR in its end state (a docs PR included); when none is open, the task says so |
| I-12 | F-12: the Appendix sentence of `process` reads "an entry that touches it, is newer than its last push and is not acknowledged" |
| I-13 | F-13: a comment starting with `⛔` never acknowledges an entry |
| I-14 | F-14: a Change PR whose issue is not found is refused ("no issue names Change `<c>`"); issues are read with `--limit 1000`, as `status.mjs` |
| I-15 | F-15: an entry posted after auto-merge is on reaches the PR through its author — draft and `--disable-auto` (rule `process`); `SKILL.md` says so |
| I-16 | F-16: if `mergedBy` of a PR merged by auto-merge is not the maintainer, `act.mjs merge` changes to merging only a `CLEAN` PR without `--auto`; the archive-PR checks `mergedBy` (D-9) |
| I-17 | Implementation: `act.mjs` without `--dry-run` refuses before its actor checks when bootstrap forbids the act (`merge`, `waiver`), so the agent's live run of task 2.2 shows the bootstrap refusal for `merge`; the actor refusals show on `whoami`. The `reexec` path of I-5 runs only once `origin/main` has `act.mjs`: it is checked by `act-rules.test.mjs` (`copyPlan`) and live on the first `act.mjs merge` from a copy that differs |
| I-18 | Implementation: `wait-pr.mjs` reads the health of `main` (one `gh run list`, one `gh issue list`) only while auto-merge is on; a failed `update-branch` that is not a conflict leaves the memo as it was, so the next check tries again |
| I-19 | Implementation: `warrant sync` refuses an `AGENTS.md` over 16 KiB (`GENERATED_TOO_LARGE`, WARRANT 0.10.0); with the Appendix texts (patch 2, `073ffda`) it would be ~18 KB. Patch 3 shortens the sentences this Change adds, keeping every decision: `maintainer-acts` — one `act.mjs` command per act (`merge` · `waiver` · `patch`, a patch outside the repository), asked after a passing `--dry-run`, acting or refusing without change, a refusal fixed and asked again; `process` — the local judge in a scratch worktree outside the repository, removed afterwards; the merge asked once when no check has failed (`act.mjs merge` turns on auto-merge), then the watcher keeps the PR up to date and turns auto-merge off while `main` is red; an entry acknowledged by a comment in the PR linking it (`act.mjs merge` refuses otherwise); `CONFLICT` and `AUTO-MERGE OFF`; `git pull --ff-only` after a watcher's update; a resumed session reports a lost auto-merge; `warrant verify` before `APPROVED`; `act.mjs waiver` in the PR; `MERGED … --by <maintainer>`; `gh pr merge` except `--disable-auto`; `env` — the token lacks `read:org` (granted by the maintainer, a REST fallback meanwhile), `act.mjs` refuses an agent's shell and login. The detail moves to `SKILL.md` (I-6). `AGENTS.md` is 16 328 of 16 384 bytes: #119 (P1) — the rules shrink before #101 adds any. The maintainer's applying patch 3 is the decision on this row |
| I-20 | Implementation review (rule `process`, skill `code-review`: Standards S-1…S-11, Spec P-1…P-8), closed in patch 3 (`3-rules-16k-review.patch`): a rename or a non-ASCII path no longer fails `patch` after its dry-run passed — staged paths read with `--no-renames -z` (S-1); the git committer is checked like the author, since `lastPush` reads it (S-2); a failed act resets the worktree but deletes no untracked file, naming any left (S-3); the parsing of `git apply --numstat -z`, `git worktree list` and a folded `Subject:` moves into `act-rules.mjs` with tests (S-4, and the folded subject seen on `073ffda`); `wait-pr.mjs` reads 1000 open issues, as `act.mjs` (S-6); times compare as instants (S-7); a missing `warrant.json` or profile on `origin/main` fails instead of refusing with an empty list, a failed `gh api user` is named (S-8); a patch with no worktree is not also called "does not apply" (S-9); after a push or a `gh pr merge --auto` a failed check names what was done (S-10, P-2); `<change>` is checked as a name (S-11); the plan comment of #44 does not touch a Change it does not name — tested (P-1); a URL counts only for this repository (P-3); an acknowledgement links the whole comment id (P-4); `CONFLICT` from `update-branch` carries the URL (P-5); patch 3 keeps the red-`main` half, the outcomes' reasons and the `act.mjs` actor sentence of `env` (P-6, P-7); this row and I-19 before the patch (P-8). Kept: S-5 — `namesChange` copies `rules.mjs` `namesIn`, and the `test.yml` query sits in three scripts, because `rules.mjs` and `status.mjs` are #101's paths (D-8); S-6 — "red `main`" of `act.mjs` / the watcher (test run, `infra: main red` issue) differs from `status.mjs` (plus `warrant validate`) by D-3 and I-1; P-2 — the copy and actor refusals come before the other checks by design (a differing copy runs another program; an agent's shell must not reach the acts). `act-rules.test.mjs`: 42 tests |

## Appendix — the changed rule texts

### `maintainer-acts`

Replaces "merging a PR (`gh pr merge <N> --merge`: the merge is the approval; …)" with "merging a PR (the merge is the
approval; …)", adds "granting a scope to the agents' GitHub token" to the list, and appends:

A merge, a waiver activation and a policy-path edit are each one command of the skill `slice`:
`node <worktree>/.claude/skills/slice/act.mjs merge <N>` (auto-merge, `gh pr merge <N> --merge --auto`) ·
`waiver <change> <WAV>` · `patch <change> <file>`, where `<worktree>` is the agent's own worktree on a branch from
fresh `origin/main` and `<file>` a patch outside the repository that touches only paths no Run writes. The agent runs
the same command with `--dry-run` first and asks only when it passes. `act.mjs` checks, acts, commits, pushes and
verifies, or refuses with the reason and changes nothing; the agent fixes a refusal and asks the same command again.

### `process`

- Slice decision: "turns that PR back to draft (`gh pr ready <N> --undo`)" becomes "turns that PR back to draft
  (`gh pr ready <N> --undo`), turns its auto-merge off (`gh pr merge <N> --disable-auto`)".
- Local judge: "then in a scratch worktree `git checkout --detach origin/main`" becomes "then in a scratch worktree
  outside the repository (under the session's scratchpad, removed afterwards, so no evidence of the judge lands in a
  Change's folder) `git checkout --detach origin/main`".
- "A PR behind `main` is updated by its owner (…) and waits for green checks before the merge is asked." becomes:
  Before the merge is asked, a PR behind `main` is updated by its owner (`gh pr update-branch <N>`, a merge commit,
  after the local judge). The merge is asked once, when no check of the PR has failed (auto-merge waits for running
  ones): the maintainer's `act.mjs merge` turns on auto-merge, and from then on the owner's watcher keeps the PR up to
  date and turns auto-merge off while `main` is red.
- "Before asking for a merge the owner reads the umbrella comments newer than its last push; one that touches its
  Change or an AREA it holds comes first." is followed by: An entry — a comment of the umbrella or of the Change's issue
  whose first line starts with `[decision]`, `[scope]` or `[broadcast]` — touches the PR when it is a `[broadcast]` or
  names its Change, its issue, the PR or an AREA it holds; the owner acknowledges it, after acting on it, with a comment
  in the PR that links it. `act.mjs merge` refuses a PR with an entry newer than its last commit that is not a merge and
  not acknowledged.
- Waiting, outcomes: after "`CLOSED` — report to the maintainer and stop;": `CONFLICT` (exit 4) — merge `origin/main`
  into the branch, resolve, run the local judge, push and start the watcher again; `AUTO-MERGE OFF` (exit 5) — report
  to the maintainer why (a draft, ⛔, a red `main`, GitHub) and ask the merge again once it is fixed; — and after the
  outcomes: While auto-merge is on, the watcher updates a PR that falls behind `main` (`gh pr update-branch`, a merge
  commit; CI judges it), so the owner runs `git pull --ff-only` before its next commit on that branch. "A session that
  starts or resumes starts the watchers of the PRs it owns that wait for the maintainer" is followed by "and reports a
  PR whose merge it asked and whose auto-merge is off".
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
and the agent's login: the maintainer runs it in a terminal of their own (`act.mjs whoami` tells).
