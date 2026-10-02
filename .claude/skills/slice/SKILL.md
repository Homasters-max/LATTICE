---
name: slice
description: "Slice coordination for LATTICE: status of a slice (S0, SW, S1…S4), what can start next, launch a Change into its own worktree and session. Use on \"slice status\", \"where is S0\", \"what can start next\", \"launch <change>\", or /slice."
argument-hint: "status <slice> | next <slice> | launch <change | #issue> | act … | wait <N>"
---

# Slice

The coordinator session holds a slice: it dispatches Changes, reviews them, and queues merges for the maintainer. Each Change is written by its own session in its own worktree.

## Model

- **Slice** = GitHub milestone (`S0`, `SW`, `S1`…`S4`) + its **umbrella** issue (task list of Change issues, plan, slice-level decisions as comments linking `I-N` rows and PRs).
- **Change issue** = one per Change, title `<slice>: <change> — …`, body lines ``Where: Change `<name>`, AREA `<AREA>` `` (several: `` `TR` + `AC` + `CT` ``) and `Depends on: #N, …` (read to the end of its first sentence: `Depends on: none. Closes #94.` has no dependency). AREAs are read only from a `Where:` that names a Change. When several issues name one Change (its own issue and, say, a bug it fixes), its issue is the one whose title names it, else the oldest; the others refer to it and are read by their labels. An issue whose `Where:` names no Change is a docs PR — unless it is labelled `bug` (a fix Change or a PR that closes it) or `question` (the maintainer's answer).
- **One worktree per Change**: the one the app makes for its session (`.claude/worktrees/<random>`, branch `claude/<random>`); the session makes the three branches there in turn: `spec/<change>`, `impl/<change>`, `archive/<change>`, each from fresh `origin/main`. `status.mjs` finds the worktree by those branches, not by its path.
- **State is computed, never stored**: Change state from warrant records (refs and worktrees), PRs and checks from GitHub, worktrees from `git worktree list`, health of `main` from its last completed `test.yml` run and from `warrant validate` on a temporary detached checkout of `origin/main` (removed after the run). `status.mjs` computes all of it; its rules are pure functions in `rules.mjs`, checked by `node --test .claude/skills/slice/rules.test.mjs`.
- **Rules**, enforced by `next`:
  - one capability = one AREA = at most one active Change (SL-T08); an AREA is **held** from `warrant init change` (a record exists) until the archive-PR is merged into `main` (the record is ARCHIVED on `origin/main`) or the Change is ABANDONED;
  - a Change dependency is done only when that archive-PR is merged, a docs issue when it is closed; an ABANDONED dependency, or a Change issue closed without a record, needs a decision;
  - holders come from every issue of the repository, ordered by the time of their `init`: the first keeps the AREA, a later one is an **AREA collision — needs a decision** (👤 maintainer; equal or missing times: all collide);
  - at most 3 Changes **in implementation**: from the first commit of the impl-PR until it merges (impl-PR open, or record APPROVED…VERIFYING without a merged impl-PR); a Change waiting only for its archive-PR is out;
  - a **red** `main` (last `test` run on main failed, or `warrant validate` fails on `origin/main`) blocks dispatch and marks merge rows `held: main is red`; no `test.yml` yet, or a `warrant` on `PATH` outside the `kernel` range of `main`'s `warrant.json` = unknown, a warning only;
  - a `fix-main-<issue>` Change (rule `tracking`) is not blocked by a red `main`, not counted in WIP, never waits for or collides on an AREA;
  - shared files belong to the skeleton Change; `implement` Runs are narrowed with `--scope <source and test paths named by its design>,openspec/changes/<change>/**`.

## Commands

`node .claude/skills/slice/status.mjs <slice | change | #issue> [--next] [--json] [--main-ref <ref>]` — fetches `origin`, takes about a minute (a `warrant status` per Change worktree, one `warrant validate`). Paste its markdown output as is. `--main-ref <ref>` validates another ref in place of `origin/main` (a replay of a past `main`); the `test` check still reads `main`. An issue without a milestone is shown alone, against the repository-wide holders.

### status `<slice>`

Run `status.mjs <slice>`. Header: `main` health (both checks), WIP of 3, held AREAs (a collision marked ⚠), `Open P1 without a Change` (bug / question issues of the slice and of no milestone), 👤 maintainer queue (one row per AREA collision; the PR URL where a PR is open; none for a decision on a dependency). Table: issue, Change, AREA, state, open PR and checks, depends on (✓ / ⏳), next action, who acts. End with one line: what the coordinator does now.

### next `<slice>`

Run `status.mjs <slice> --next`: the rows that may start now, by issue number — `launch` (dependencies done, AREAs free), `launch (docs PR)`, or `start impl-PR` (spec-PR merged, WIP < 3). A red `main` empties the list and says so.

### launch `<change | #issue>`

1. `status.mjs <change>` prints `startable`; otherwise report its reason (a red `main` included) and stop. Phase: `spec` for a not-started Change, `impl` for `start impl-PR`, `docs` for an issue without a Change.
2. Worktree (`<name>` = change, or `issue-<N>` for docs): the coordinator makes none; the app makes it when the session starts. `status.mjs <name> --json` names the worktree already on a branch `<kind>/<name>`:
   - none: go on to step 3;
   - its session is alive (`list_sessions`, same `cwd`): send it the next phase with `mcp__ccd_session_mgmt__send_message` and stop — no new session;
   - its session is gone: the worktree is clean and its branches are pushed; remove it (`git worktree remove`), then step 3.
3. Compose the start prompt from the template below, with the issue body verbatim (`gh issue view <N> --json body`).
4. Offer it as a chip: `mcp__ccd_session__spawn_task` with `title` "Start <change>", `tldr` (one sentence: which Change, which phase, why it may start now), `prompt`, and no `cwd` (the app takes `cwd` as a project root and makes its own worktree inside it). Without that tool: print the prompt in a fenced block for the maintainer to paste into a new session with a worktree.
5. Optional, when `mcp__ccd_sidebar__*` tools are present: a sidebar group named after the slice (create it if missing); move the Change session into it once the maintainer starts it.

Done: when the archive-PR (docs: the docs PR) is merged, archive the session (`mcp__ccd_session_mgmt__archive_session`, the app removes its worktree), then delete the local branches `<kind>/<name>` and `claude/<random>` that `origin/main` contains.

Start prompt:

```text
You run <phase> of Change `<change>`, slice <slice> (issue #<N>, umbrella #<U>).
Working directory: the worktree the app opened this session in — the one worktree of this Change. Work, commit and push only there. First act: git fetch origin, then git switch -c <phase>/<name> origin/main; the app's claude/* branch stays unused.
Branches, made here in turn, each from fresh origin/main: spec/<change>, then impl/<change>, then archive/<change>. Before impl/<change>: node .claude/skills/slice/status.mjs <change> must print "startable" (WIP < 3, main not red); otherwise report and wait.

<issue body>

Process: AGENTS.md of the working directory — the <phase>-PR of the Change, from its first step to the PR. implement Runs: --scope <source and test paths named by your design>,openspec/changes/<change>/** (the scope intersects write_scope); shared files belong to the skeleton Change.
Read: this issue, the design-next IDs it names, merged specs of its dependencies (openspec/specs/**).
Steps: skill progress, 🛠 development — the list at start and after every step.
A decision that touches the slice (another Change, an AREA, a shared file, the order): a comment on umbrella #<U> linking the I-N row or PR (a Change outside a slice: in its own issue).
Acts of the maintainer (merge — the merge is the approval —, UNKNOWN decision): ask as AGENTS.md says and wait.
```

docs phase: replace the Process line with "a docs PR closing #<N>, no Change".

### The coordinator's own PRs

Work without a Change (docs, process) is a commit and a PR that touches no policy path (`.warrant/local/**`, `.warrant/warrant.lock.json`, `.github/workflows/**`); one that does is a Change (rule `tracking`). Before a push that opens or updates a PR, run `warrant ci` on the merge with fresh `origin/main` in a scratch worktree outside the repository, removed afterwards, and push only when it reports no violation of the PR (rule `process`); before the merge is asked, a PR behind `main` is updated with `gh pr update-branch <N>`; the merge is asked once, as `act merge` below.

### act — the maintainer's acts

`node <worktree>/.claude/skills/slice/act.mjs merge <N> | waiver <change> <WAV> | patch <change> <file> | whoami [--dry-run]` — one command per maintainer act (rule `maintainer-acts`). The maintainer runs it in their own terminal; it refuses an agent's shell (`CLAUDECODE`), the agent's `gh` login and the agent's git identity, so the agent never runs it without `--dry-run`. Every check runs first; a refusal prints `refused: <reason> — <fix>` and changes nothing (exit 1); the act commits, pushes and verifies, and prints one line (exit 0); an error after a write rolls the worktree back (exit 2). Its rules are pure functions in `act-rules.mjs`, checked by `node --test .claude/skills/slice/act-rules.test.mjs`.

- **Asking:** run the same command with `--dry-run` in your own worktree; ask only when it prints `would …`, as «❗ Выполнить» with exactly that command without `--dry-run`, `<worktree>` the absolute path of your worktree (`D:/…`). Ask with no Run active and the worktree clean and pushed, and write nothing to it until you see the result (`git log`, `gh pr view`).
- **`merge <N>`** — `gh pr merge <N> --merge --auto`. Refuses: not open, a draft, a failed check (running ones are fine), a conflict, the Change record on the head not in the end state of the PR kind (`spec/` `SPECIFIED`, `impl/` `VERIFYING`, `archive/` `ARCHIVED`), a Change whose issue is not found, a pending entry (below), a red `main` (a failed `test.yml` run or an open issue `infra: main red — …`) unless the Change is `fix-main-*`.
- **`waiver <change> <WAV>`** — `warrant waive --activate <WAV> --by <login>` on `impl/<change>` in your worktree, commit, push. Refuses a waiver that is not `PROPOSED` or not of the Change, an id used by another Change on `origin/main` or another `origin/impl/*` (SRA#139: re-propose under a new id), a `warrant` outside `kernel`.
- **`patch <change> <file>`** — `git apply --index` on `<kind>/<change>`, commit as the maintainer's patch, push. `<file>` lies outside the repository (`D:/tmp/<change>/…`) and touches only paths no Run writes: the profile `human-acceptance` and `openspec/changes/<change>/proposal.md`, never `src/**`, `test/**`, the Change's `design.md` / `tasks.md` / `specs/**`, `AGENTS.md`, the lock, or what only `warrant` writes. After it, run `warrant sync` yourself when the patch changed a rule.
- **`whoami`** — the actor checks only: the maintainer's first act from a new terminal.
- **Copy:** a copy that differs from `origin/main` runs the version of `origin/main` instead (written to a temporary directory); before `act.mjs` is on `main` only `patch`, `whoami` and `--dry-run` run (bootstrap).

**Entries.** An entry is a comment of the umbrella or of the Change's issue whose first line starts with `[decision]`, `[scope]` or `[broadcast]`. It touches a PR when it is a `[broadcast]` or names its Change, its issue, the PR (`#N`, its URL) or an AREA the Change holds (`` `CL` ``, `AREA CL`). It is pending when it is newer than the last commit of the PR committed by an agent (not a merge) and no later comment acknowledges it: one in the PR, or on the umbrella or the issue naming the Change or the PR, that contains its URL and does not start with `⛔`. Your own `[scope]` entry posted after your push needs the acknowledgement too. A decision posted after auto-merge is on reaches the PR through its author: draft and `gh pr merge <N> --disable-auto` (rule `process`).

### wait `<N>`

`node .claude/skills/slice/wait-pr.mjs <N> [--max-hours <h>]` — run in the background right after the push that makes PR <N> wait for the maintainer's merge (rule `process`, "Waiting for the maintainer"); a spec-PR is offered only with `SPECIFIED` as its last commit, so every PR waits only for a merge. While auto-merge is on, it updates the PR when it falls behind `main` (`gh pr update-branch`, a merge commit of `main` into an already judged head, so CI judges it instead of the local judge; prints `PR #<N> behind main — updated` and goes on) — so `git pull --ff-only` before your next commit on that branch — and turns auto-merge off on a red `main` (not for `fix-main-*`). Outcomes:
- `PR #<N> MERGED <sha> <url>` or `PR #<N> CLOSED <url>`, exit 0;
- `PR #<N> CONFLICT <url>`, exit 4 — merge `origin/main` into the branch, resolve, run the local judge, push, start it again;
- `PR #<N> AUTO-MERGE OFF [(main red: …)] <url>`, exit 5 — report to the maintainer why (a draft, ⛔, a red `main`, GitHub) and ask the merge again once it is fixed;
- exit 2 after three `gh` errors in a row, exit 3 after `--max-hours` (default 24) — report and start it again; exit 64 on a usage error.

Only the session that opened the PR watches it. It reports only a change it sees: a session that resumes reads `gh pr view <N> --json autoMergeRequest` of the PRs whose merge it asked and reports one that is off.
