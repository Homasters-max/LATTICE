---
name: slice
description: "Slice coordination for LATTICE: status of a slice (S0, SW, S1…S4), what can start next, launch a Change into its own worktree and session, the coordinator's routine, review of a PR, broadcast, retro; and, for every Change session, the steps of its three PRs (change.md). Use on \"slice status\", \"where is S0\", \"what can start next\", \"launch <change>\", \"review #N\", \"broadcast\", \"retro\", or /slice."
argument-hint: "status <slice> | next <slice> | launch <change | #issue> | review <N> | broadcast <text> | retro <slice> | act … | wait <N>"
---

# Slice

The coordinator session holds a slice: it dispatches Changes, reviews them, keeps the decision log and shows the maintainer's queue. Each Change is written by its own session in its own worktree, which follows **`change.md`** (the steps of the spec-, impl- and archive-PR, the log, requests for the maintainer's acts, waiting) — the rules `process`, `tracking` and `maintainer-acts` keep only the obligations.

## Model

- **Slice** = GitHub milestone (`S0`, `SW`, `S1`…`S4`) + its **umbrella** issue (task list of Change issues, plan, the decision log).
- **Change issue** = one per Change, title `<slice>: <change> — …`, body lines ``Where: Change `<name>`, AREA `<AREA>` `` (several: `` `TR` + `AC` + `CT` ``) and `Depends on: #N, …` (read to the end of its first sentence: `Depends on: none. Closes #94.` has no dependency). AREAs are held only from a `Where:` that names a Change; an issue whose `Where:` declares an AREA but names no Change is `unnamed` — it needs a Change name before anything starts (#112). When several issues name one Change (its own issue and, say, a bug it fixes), its issue is the one whose title names it, else the oldest; the others refer to it and are read by their labels. Kinds, first that applies: a Change, `bug` (a fix Change or a PR that closes it), `question` (the maintainer's answer), `unnamed`, else a docs PR.
- **Issue titles and labels** (rule `tracking`): prefixes `s0`…`s4` (slice), `sw` (the switch between S0 and S1, SL-T07), `design`, `infra` (process, WARRANT, CI); types `bug` defect · `enhancement` idea · `question` needs the maintainer's answer; a process failure also `process`, with "Root cause" and "Prevention".
- **One worktree per Change**: the one the app makes for its session (`.claude/worktrees/<random>`, branch `claude/<random>`); the session makes the three branches there in turn: `spec/<change>`, `impl/<change>`, `archive/<change>`, each from fresh `origin/main`. `status.mjs` finds the worktree by those branches, not by its path.
- **Shared files** belong to the skeleton Change of the slice: the module matrix of the structure test, the CLI entry and command table, `package.json`, the port interfaces; a later change of one is a separate small Change.
- **State is computed, never stored**: Change state from warrant records (refs and worktrees; an open Change's record runs ahead on its branches, so it is read from the furthest — archive, impl, spec, then `main`), PRs and checks from GitHub, worktrees from `git worktree list`, health of `main` from its last completed `test.yml` run and from `warrant validate` on a temporary detached checkout of `origin/main` (removed after the run), the decision log from the comments of the umbrella, the issues and the PRs. `status.mjs` computes all of it; its rules are pure functions in `rules.mjs` and `act-rules.mjs`, checked by `node --test .claude/skills/slice/rules.test.mjs` and `act-rules.test.mjs`.
- **Rules**, enforced by `next`:
  - one capability = one AREA = at most one active Change (SL-T08); an AREA is **held** from `warrant init change` (a record exists) — an AREA added after `init` by a `[decision]` from that decision (I-1) — until the archive-PR is merged into `main` (the record is ARCHIVED on `origin/main`) or the Change is ABANDONED;
  - a Change dependency is done only when that archive-PR is merged, a docs issue when it is closed; an ABANDONED dependency, or a Change issue closed without a record, needs a decision;
  - holders come from every issue of the repository, ordered by the time they hold from: the first keeps the AREA, a later one is an **AREA collision — needs a decision** (👤 maintainer; equal or missing times: all collide);
  - at most 3 Changes **in implementation**: from the first commit of the impl-PR until it merges (impl-PR open, or record APPROVED…VERIFYING without a merged impl-PR); a Change waiting only for its archive-PR is out;
  - a **red** `main` (last `test` run on main failed, or `warrant validate` fails on `origin/main`) blocks dispatch and marks merge rows `held: main is red`; no `test.yml` yet, or a `warrant` on `PATH` outside the `kernel` range of `main`'s `warrant.json` = unknown, a warning only;
  - a `fix-main-<issue>` Change (rule `tracking`) is not blocked by a red `main`, not counted in WIP, never waits for or collides on an AREA;
  - `implement` Runs are narrowed with `--scope <source and test paths named by its design>,openspec/changes/<change>/**`.

## The decision log

Entries are umbrella comments whose first line starts with a tag: `[decision]` (the maintainer's decision; only the coordinator posts it, carrying the maintainer's answer and its date — or the session in whose chat the maintainer answered, quoting it, and the coordinator confirms by message, I-2), `[scope]` (a scope change of a Change), `[broadcast]` (to every live session), `[incident]` (a failure; input of the retro). The first three bind the sessions they touch; `[incident]` binds no one. An entry names in its `Touches:` line only the Changes that must act on it; an informational entry (a plan update, a status) names none and says "for information" — a name anywhere in the text touches (`act.mjs merge` refuses until it is acknowledged). The matching reads the whole text: a `[broadcast]`, or a name of the Change (`s0-store` is not `s0-store-2`), its issue or PR (`#N`, its URL; `SRA#N` is not `#N`), or an AREA it holds (`` `CL` ``, `AREA CL`).

A touched session acts on the entry, then acknowledges it by a reply on the umbrella (a Change outside a slice: on its issue) that links the entry and names its Change; a comment in its PR that links it counts too (`act.mjs merge` reads it). A comment whose first line starts with a tag is never an acknowledgement, nor one starting with `⛔`. A `[decision]` that adds an AREA to a Change after `init` carries the line `Adds: AREA <X> to <change>` (I-7).

`status.mjs <change>` prints **Read first**: `pending` — every entry touching the Change that no comment acknowledges, with no time cut; `unread` — the comments of its issue, tagged or not, newer than its last push (the newest commit committed by an agent, not a merge, with the subject prefix `<change>: `, over all its branches on `origin`, merged or not; before the first push, all of them). A session runs it before `SPECIFIED` and before requesting a merge (rule `process`).

## Commands

`node .claude/skills/slice/status.mjs <slice | change | #issue> [--next] [--json] [--main-ref <ref>]` — fetches `origin`, takes about a minute (a `warrant status` per Change worktree, one `warrant validate`, the comments of the umbrella and of each held Change's issue and PRs, one GraphQL query for issue histories). Paste its markdown output as is. `--main-ref <ref>` validates another ref in place of `origin/main` (a replay of a past `main`); the `test` check still reads `main`. An issue without a milestone is shown alone, against the repository-wide holders. Each run sweeps the temporary worktrees of killed runs (`lattice-status-*`, `lattice-judge-*`, older than an hour; `temp.mjs`).

### status `<slice>`

Run `status.mjs <slice>`. Header: `main` health (both checks), WIP of 3, held AREAs (a collision marked ⚠), `Open P1 without a Change` (bug / question issues of the slice and of no milestone), `Closable` (open issues whose closing condition looks met: a Change ARCHIVED on `main`, a `process` issue whose Prevention references only merged PRs and archived or closed issues, a bug fixed by an archived Change — the coordinator judges and closes, rule `tracking`), the size of `AGENTS.md` on `origin/main` (⚠ above 14 336 of WARRANT's 16 384 bytes: move procedure from the rules into this skill), 👤 **Waiting for the maintainer** (one row per AREA collision and per AREA added after `init` without a `[decision]`; the PR URL where a PR is open; none for a decision on a dependency). Table: issue, Change, AREA, state, open PR and checks, depends on (✓ / ⏳), Log (pending entries, `+n` unread comments), next action, who acts. End with one line: what the coordinator does now.

### next `<slice>`

Run `status.mjs <slice> --next`: the rows that may start now, by issue number — `launch` (dependencies done, AREAs free), `launch (docs PR)`, or `start impl-PR` (spec-PR merged, WIP < 3). A red `main` empties the list and says so.

### launch `<change | #issue>`

1. `status.mjs <change>` prints `startable`; otherwise report its reason (a red `main` included) and stop. Phase: `spec` for a not-started Change, `impl` for `start impl-PR`, `docs` for an issue without a Change.
2. Worktree (`<name>` = change, or `issue-<N>` for docs): the coordinator makes none; the app makes it when the session starts. `status.mjs <name> --json` names the worktree already on a branch `<kind>/<name>`:
   - none: go on to step 3;
   - its session is alive (`list_sessions`, same `cwd`): send it the next phase with `mcp__ccd_session_mgmt__send_message` and stop — no new session;
   - its session is gone: the worktree is clean and its branches are pushed; remove it (`git worktree remove`), then step 3.
3. Compose the start prompt from the template below, with the issue body verbatim (`gh issue view <N> --json body`) and the coordinator's notes (current workarounds such as the guard of #93, the judge, the request protocol, acknowledgement, "tell the coordinator by message when a PR of yours enters the maintainer's queue").
4. Offer it as a chip: `mcp__ccd_session__spawn_task` with `title` "Start <change>", `tldr` (one sentence: which Change, which phase, why it may start now), `prompt`, and no `cwd` (the app takes `cwd` as a project root and makes its own worktree inside it). The chip is the request for the maintainer's act of starting the session. Without that tool: print the prompt in a fenced block for the maintainer to paste into a new session with a worktree.
5. When `mcp__ccd_sidebar__*` tools are present: a sidebar group named after the slice (create it if missing); move the Change session into it once it runs. Then check the launch (Coordinator, item 1).

Start prompt:

```text
You run <phase> of Change `<change>`, slice <slice> (issue #<N>, umbrella #<U>).
Working directory: the worktree the app opened this session in — the one worktree of this Change. Work, commit and push only there. First act: git fetch origin, then git switch -c <phase>/<name> origin/main; the app's claude/* branch stays unused.
Branches, made here in turn, each from fresh origin/main: spec/<change>, then impl/<change>, then archive/<change>. Before impl/<change>: node .claude/skills/slice/status.mjs <change> must print "startable" (WIP < 3, main not red); otherwise report and wait.

<issue body>

Process: AGENTS.md and .claude/skills/slice/change.md of the working directory — the <phase>-PR of the Change, from its first step to the PR. implement Runs: --scope <source and test paths named by your design>,openspec/changes/<change>/** (the scope intersects write_scope); shared files belong to the skeleton Change.
Read: this issue and its comments, the design-next IDs it names, merged specs of its dependencies (openspec/specs/**).
Steps: skill progress, 🛠 development — the list at start and after every step.
A decision that touches the slice (another Change, an AREA, a shared file, the order): a comment on umbrella #<U> linking the I-N row or PR (a Change outside a slice: in its own issue).
Acts of the maintainer: requested as change.md "Requests" says (a marked comment in your PR, then a message to the coordinator); read the result yourself.

<coordinator's notes>
```

docs phase: replace the Process line with "a docs PR closing #<N>, no Change".

## Coordinator

The routine of the coordinator session; each item names its trigger and its check.

1. **Launch** — once the session runs, `list_sessions` gives its `cwd`, and `git worktree list --porcelain` must show that path on `<phase>/<name>` within its first turns; a session on `claude/*` or in a second worktree gets a message to switch (#74), and the coordinator checks again; the session goes into the slice's sidebar group.
2. **Before a launch** — an `unnamed` issue (its `Where:` declares an AREA but names no Change) gets its `Where:` and `Depends on:` fixed first (#112).
3. **Parallel spec phases** — before any of them is `SPECIFIED`, each live session is asked by message for its planned source and test paths; an overlap goes to the maintainer, whose answer the coordinator posts as a `[decision]`; when the sessions settle it between themselves in a `[scope]` first, the coordinator asks the maintainer to confirm it, and a new `[decision]` supersedes the earlier one.
4. **A session stalls or fails** (no push, no reply, an error the maintainer reports) — read its events (`list_events`) before acting; act on what they show (a guard deny, a red check, a question waiting), never on a guess.
5. **A scope change of a launched Change** — a `[scope]` entry on the umbrella (a new AREA: a `[decision]` with `Adds: AREA <X> to <change>`) **and** a message to its session with the URL; wait for the session's acknowledgement before that session's `SPECIFIED`; a change after `SPECIFIED` is an `I-N` row of the impl-PR.
6. **A request for a maintainer's act** (`change.md`, "Requests") — `review <PR>` before it is shown to the maintainer; a patch or file is checked (`git apply --check`, size, paths); the owner is told to `git pull --ff-only` after the act lands. At the end of every coordinator message, the block **👤 queue (N)**: the pending requests, read from every comment of the repository (`gh api --paginate repos/{owner}/{repo}/issues/comments`, no time cut: a request stays until its result is seen), grouped as `change.md` lists them, each with what and why, the executor and the PR, and its command as its own «❗ Выполнить» `bash` block (rule `env`). Until #133 lands, the coordinator's local `act-ui.mjs --list` is a convenience for reading them.
7. **A red check on a queued PR** — read the failing log, send the cause to the owner, keep the PR out of the queue; a process gap behind it is a `process` issue and a `[broadcast]` with the interim rule.
8. **An impl-PR merges** — a Change waiting at the impl gate gets a message that a slot is free.
9. **`main` was red and its fix merged** — a `[broadcast]` that `main` is green, so the waiting sessions go on.
10. **Two Changes in implementation with waivers** (until SRA#139) — when a second Change proposes a waiver while another `origin/impl/*` has one, warn the second session that it re-proposes under a new id after the first merges (`act.mjs waiver` refuses a colliding id).
11. **Closable issues** — the `Closable` line at every `status`: close each with a comment linking its reason, or say why not.
12. **Done (cleanup) after an archive-PR merges** (docs: the docs PR) — archive the session (`mcp__ccd_session_mgmt__archive_session`; refused while the session is mid-turn or open on the maintainer's screen: ask the session to finish and reply "idle", or the maintainer to close it, then retry); then, after `git -C <path> status --short --untracked-files=all` and `git -C <path> status --short --ignored` show nothing but its own raw evidence, `git worktree remove <path>` and `git worktree prune` by hand (the app left the worktree twice on 2026-10-02), and delete the local branches `<kind>/<name>` and `claude/<random>` for which `git merge-base --is-ancestor <branch> origin/main` holds.
13. **End of a wave** — the architecture audit (ST-A01…A04, rule `process`) and `retro` below.
14. **Before a dispatch** — `status.mjs <slice>`: the health of `main` and the open `P1` issues without a Change (`gh issue list --label P1` is the queue of P1 debt).
15. **Own PRs** — the coordinator owns, watches and requests the merge of only the PRs it opens; a Change's PR is its session's.
16. **Decisions** — a `[decision]` records the maintainer's decision and only the coordinator posts it (sessions post `[scope]`, acknowledgements and status comments; I-2 for an answer given in a session's chat). A slice decision that changes an open PR: the coordinator turns that PR to draft (`gh pr ready <N> --undo`), turns its auto-merge off (`gh pr merge <N> --disable-auto`) and comments in it `⛔ Do not merge — <decision URL>`.
17. **A usage-limit pause the maintainer announces** — message every live session to commit and push at its next safe point (no Run half-done outside its checks) and to note in its step list where it stopped; on resume, read `status.mjs <slice>` and each session's state (`list_events`) before acting.
18. **Handoff of a long session** — on the maintainer's word the session reaches a logical stopping point (no Run active, branches pushed), sends the coordinator one self-contained handoff message and stays idle; the coordinator offers a chip whose prompt carries the handoff verbatim and "check the live state first", and archives the old session once the new one runs.

### review `<N>`

`node .claude/skills/slice/review.mjs <N>` — the check before a PR enters the maintainer's queue; the owner runs it before requesting a merge, the coordinator before showing the request. One line per check, `ok` or `FAIL`; exit 0 all pass, 1 one fails, 2 an error, 64 usage. It posts nothing.
- **scope** — the paths of `git diff origin/main...origin/<head>` against what the PR's Change may write (`scopeFindings` of `act-rules.mjs`): its record, its evidence and Runs; a spec-PR its `openspec/changes/<change>/**`; an impl-PR its `tasks.md`, `design.md`, `specs/**`, the `write_scope` of its `implement` Runs narrowed to their `--scope`, its own waivers, `proposal.md` and policy paths only from commits authored by the maintainer, `AGENTS.md` and the lock when a rule changed; an archive-PR the move into `openspec/changes/archive/` and the specs of its delta. A PR without a Change: no Change files, no policy path;
- **dependencies**, **log** — from `status.mjs <change> --json` (`pending` fails, `unread` is a note);
- **conflict** — `mergeStateStatus` is not `DIRTY`;
- **judge** — `judge.mjs origin/<head>`.

### broadcast `<text>`

A procedure, not a script (a message to a session is a tool of the app):
1. Write the entry to a file: first line `[broadcast] <one sentence>`, a `Touches:` line, the text; post it with `gh issue comment <umbrella> --body-file <file>`, keep its URL.
2. Live sessions of the slice: `list_sessions` (not archived) whose `cwd` is the worktree of a row of `status.mjs <slice> --json` with a Change not `ARCHIVED` on `main` nor `ABANDONED` — on any branch, `claude/*` included —, the sessions of the slice's sidebar group, and the owners of open PRs of the slice.
3. To each, `mcp__ccd_session_mgmt__send_message`: one paragraph, the URL, "acknowledge by a reply on #<umbrella> naming your Change and by message to the coordinator".
4. Report who got it (`delivered` / `queued`) and who is not live; a session not live reads it when it resumes, before its next `SPECIFIED` or merge request.

### retro `<slice>`

`node .claude/skills/slice/retro.mjs <slice> [--since <ISO date>] [--issues <N,…>]` — the `process` issues of a wave (of the slice's milestone or of none, created or closed since the umbrella's last `[decision] retro`, else the milestone's creation) as a table: issue, state, failure, root cause, prevention, proposed (empty), closable; and the issues missing "Root cause" or "Prevention". A wave is a wave of the slice's plan `[decision]`. Then:
1. Post the table as `[incident] retro <slice> wave <n>` on the umbrella, linking the `[incident]` transcript summaries of the wave.
2. Grill it with the maintainer (skill `grilling`), one issue at a time. Prefer, as the global skill `retro` does, a deterministic check (a test, a script refusal) over a setting, a setting over skill text, and skill text over a rule in `AGENTS.md`.
3. Post the outcome as `[decision] retro <slice> wave <n>`: for each issue its prevention and the issue or Change that carries it; close a `process` issue whose prevention is in place (rule `tracking`).

### The coordinator's own PRs

Work without a Change (docs, process) is a commit and a PR that touches no policy path (`.warrant/local/**`, `.warrant/warrant.lock.json`, `.github/workflows/**`); one that does is a Change (rule `tracking`). Before a push that opens or updates a PR, run `judge` below and push only when it reports no violation of the PR (rule `process`); before the merge is requested, a PR behind `main` is updated with `gh pr update-branch <N>`; the merge is requested once (`change.md`, "Requests").

### judge — the local CI judge

`node .claude/skills/slice/judge.mjs [<ref>]` — from the worktree of the branch (default `HEAD`), before every push that opens or updates a PR (rule `process`; #124). It merges the ref with fresh `origin/main` in a temporary worktree outside the repository (`lattice-judge-*` in the OS temp directory, removed afterwards, stale ones swept first — #126 — so no evidence of the judge lands in a Change's folder) and runs the three steps of the job `warrant / warrant` in its order: `warrant validate`, `warrant sync --check`, `warrant ci`. Exit 0 when the first two pass and `warrant ci` reports no violation of the PR — an impl-PR may wait only on CI and the merge (`tests-passed`, `factory-golden-passed`, `evidence-complete` of a `test-report`, `human-approval`); a finding WARRANT marks informational (`FRONTEND_HOOKS_INACTIVE`, REQ-VER-009 — the guard is blind in a worktree session, #93) is printed as `note:` and is no violation (#128); exit 1 on a violation or a conflict with `main`; 2 an error; 64 usage. Only the committed ref is judged. Its verdict is `judgeVerdict` of `act-rules.mjs`.

### act — the maintainer's acts

`node <worktree>/.claude/skills/slice/act.mjs merge <N> | waiver <change> <WAV> | patch <change> <file> | whoami [--dry-run]` — one command per maintainer act (rule `maintainer-acts`). The maintainer runs it in their own terminal; it refuses an agent's shell (`CLAUDECODE`), the agent's `gh` login and the agent's git identity, so the agent never runs it without `--dry-run`. Every check runs first; a refusal prints `refused: <reason> — <fix>` and changes nothing (exit 1); the act commits, pushes and verifies, and prints one line (exit 0); an error after a write rolls the worktree back (exit 2). Its rules are pure functions in `act-rules.mjs`, checked by `node --test .claude/skills/slice/act-rules.test.mjs`.

- **Requesting:** run the same command with `--dry-run` in your own worktree; request it only when it prints `would …`, as `change.md` "Requests" says, with exactly that command without `--dry-run`, `<worktree>` the absolute path of your worktree (`D:/…`). Request it with no Run active and the worktree clean and pushed, and write nothing to it until you see the result (`git log`, `gh pr view`).
- **`merge <N>`** — `gh pr merge <N> --merge --auto`. Refuses: not open, a draft, a failed check (running ones are fine), a conflict, the Change record on the head not in the end state of the PR kind (`spec/` `SPECIFIED`, `impl/` `VERIFYING`, `archive/` `ARCHIVED`), a Change whose issue is not found, a pending entry (newer than the PR's last push and not acknowledged), a red `main` (a failed `test.yml` run or an open issue `infra: main red — …`) unless the Change is `fix-main-*`.
- **`waiver <change> <WAV>`** — `warrant waive --activate <WAV> --by <login>` on `impl/<change>` in your worktree, commit, push. Refuses a waiver that is not `PROPOSED` or not of the Change, an id used by another Change on `origin/main` or another `origin/impl/*` (SRA#139: re-propose under a new id), a `warrant` outside `kernel`.
- **`patch <change> <file>`** — `git apply --index` on `<kind>/<change>`, commit as the maintainer's patch, push. `<file>` lies outside the repository (`D:/tmp/<change>/…`) and touches only paths no Run writes: the profile `human-acceptance` and `openspec/changes/<change>/proposal.md`, never `src/**`, `test/**`, the Change's `design.md` / `tasks.md` / `specs/**`, `AGENTS.md`, the lock, or what only `warrant` writes. After it, run `warrant sync` yourself when the patch changed a rule.
- **`whoami`** — the actor checks only: the maintainer's first act from a new terminal.
- **Copy:** a copy that differs from `origin/main` runs the version of `origin/main` instead (written to a temporary directory); before `act.mjs` is on `main` only `patch`, `whoami` and `--dry-run` run (bootstrap).

A decision posted after auto-merge is on reaches the PR through the coordinator: draft and `gh pr merge <N> --disable-auto` (Coordinator, item 16).

### wait `<N>`

`node .claude/skills/slice/wait-pr.mjs <N> [--max-hours <h>]` — `change.md`, "Waiting for the maintainer", has when to start it and what to do on each outcome. While auto-merge is on, it updates the PR when it falls behind `main` (`gh pr update-branch`, a merge commit of `main` into an already judged head, so CI judges it instead of the local judge; prints `PR #<N> behind main — updated` and goes on) and turns auto-merge off on a red `main` (not for `fix-main-*`). Outcomes:
- `PR #<N> MERGED <sha> <url>` or `PR #<N> CLOSED <url>`, exit 0;
- `PR #<N> CONFLICT <url>`, exit 4;
- `PR #<N> AUTO-MERGE OFF [(main red: …)] <url>`, exit 5;
- exit 2 after three `gh` errors in a row, exit 3 after `--max-hours` (default 24); exit 64 on a usage error.
