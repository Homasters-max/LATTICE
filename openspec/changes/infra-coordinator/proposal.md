# Proposal

## Why

On 2026-10-02 the coordinator of S0 handled the process failures by hand (#101): two worktrees per Change (#74), rules
changed without a Change (#100), duplicate ids on `main` (#92), a merge before a slice decision (#92), an AREA race
(#92, #94), a scope change missed by a session (#97 items 4–7, the session read the umbrella but not its own issue), and
colliding waiver ids (Homasters-max/SRA#139). The transcripts of the four S0 sessions
([incident](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5950268972) on umbrella #44) add boundary
crossings: a session ran `warrant verify` on another Change, a session wrote outside its write_scope, a session added an
AREA to its issue after `init`, and review subagents ran shell commands. Each failure was closed by a message to the
sessions. The coordinator's routine, the decision log and the path from a failure to a rule are written nowhere, so they
are lost when the coordinator session restarts.

The rules cannot take more text: `AGENTS.md` is 16 276 of the 16 384 bytes WARRANT 0.10.0 generates
(`GENERATED_TOO_LARGE`, #119). The maintainer's
[decision](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5953927808) puts #119 into this Change as
its first item: the rules keep what every session must obey, the procedure moves into the skill `slice`.

## What Changes

- **The rules shrink** (#119): `process` keeps the obligations of a Change session and points to a new file of the
  skill, `.claude/skills/slice/change.md`, for the steps of the three PRs, the UNKNOWN and waiver procedure and the
  watcher's outcomes. `AGENTS.md` ends at most 12 288 bytes with the additions below — 4 KiB free.
- **Skill `slice`, section "Coordinator"**: the routine the coordinator follows — after a launch, on a stall, on a scope
  change, after a fix of `main`, with two waivers in flight (until SRA#139), and the cleanup after an archive-PR.
- **Decision log on the umbrella**: comments tagged `[decision]`, `[scope]`, `[broadcast]` bind the sessions they
  touch and are acknowledged by a reply; `[incident]` records a failure. `status.mjs <change>` lists the entries and the
  comments of the Change's own issue newer than its last push, which a session reads before `SPECIFIED` and before
  asking for a merge. No log file: the state stays computed.
- **New commands of the skill `slice`**: `review <PR>` (the check before a PR enters the maintainer's queue: scope,
  dependencies, conflict, log, local judge), `broadcast <text>` (a `[broadcast]` entry and a message to every live
  session of the slice), `retro <slice>` (the `process` issues of a wave, summed up on the umbrella and grilled with the
  maintainer into a rule, a test or a setting).
- **Rule `tracking`**: closing criteria of issues (a Change issue by its archive-PR, a `bug` by its fix, a `process`
  issue by its prevention, a `question` by the answer, a duplicate by a link); a process failure is an issue labelled
  `process` with "Root cause" and "Prevention"; the retro at the end of every wave. `status.mjs` lists open issues
  whose closing condition is met.
- **Boundaries** in the rule `process`: `warrant` commands only on the session's own Change; after `init` an AREA is
  added to `Where:` only by a maintainer's `[decision]` / `[scope]` naming it, or `AR` by a `skip_specs` Change that
  needs an UNKNOWN (`status.mjs` flags any other, from the issue's edit history); review subagents read with the file
  tools and run no shell command but `warrant run submit` (until SRA#138 the guard does not enforce it).
- **Requests for the maintainer's acts** (decisions
  [5954365385](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5954365385),
  [5954398284](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5954398284),
  [5954536510](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5954536510)): every act of the
  maintainer is requested by a comment on its PR or issue with a marker `<!-- act: … -->` (groups: `act.mjs` acts,
  decisions, repository settings, files and git; a session start is the coordinator's chip), what and why, the executor
  and its command; the executor never writes a command for the maintainer into its own chat and reads the result
  itself (rule `maintainer-acts`, markers in `change.md`). The queue's tools — `act.mjs queue`, `queue --run`, `ui`, the
  review mark, the `act-done` mark — are Change `infra-act-queue` (#133), split out by the maintainer's
  [decision](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5954594643).
- **Related issues taken in**: #128 (`judgeVerdict` counts `FRONTEND_HOOKS_INACTIVE` as a violation), #112 (an issue
  with an AREA but no Change is read as a docs PR), #126 (a killed `judge.mjs` leaves its worktree). All three sit in
  the files this Change already edits.
- `warrant sync` regenerates `AGENTS.md` and the lock.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the product LATTICE does not change (`skip_specs: true`).

## Impact

- Paths, all as the maintainer's patches (profile `human-acceptance`, written by no Run):
  `.warrant/local/rules/{process,tracking,maintainer-acts}.json`; `.claude/skills/slice/{SKILL.md,change.md,status.mjs,
  rules.mjs,rules.test.mjs,act-rules.mjs,act-rules.test.mjs,judge.mjs,review.mjs,retro.mjs,temp.mjs}`.
  Generated by `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`. No `src/**`, `test/**` or
  `.github/workflows/**`.
- Every session of the project: where it reads the steps of its PRs, what it reads before `SPECIFIED` and before a merge
  request, how it acknowledges a log entry, how it requests a maintainer's act, which issues it closes and how it
  reports a process failure.
- The coordinator session: its routine, three commands and the block of pending requests.
- The maintainer: every act requested in one place (a marked comment), shown by the coordinator, not scattered over
  chats.
- The impl-PR closes #112, #126, #128 (their fixes); the archive-PR closes #101 and #119 (design D-10). The retro of S0
  runs once in the impl-PR.

## Non-goals

- The WARRANT defects behind the boundaries (SRA#138 guard in worktrees, SRA#139 waiver ids): fixed in WARRANT and
  pinned by a `pin-vX` Change; this Change states the workaround only until then.
- The global skill `pr` (`~/.claude/skills/pr`, outside the repository): no project norm moves into a file the
  repository does not version.
- Splitting `AGENTS.md` by narrower rule `paths`: `test/process/pin.test.ts` requires `paths: ["**"]` for every rule.
- `act.mjs` and `wait-pr.mjs` (Change `infra-merge-flow`): unchanged; `act-rules.mjs` gains the pure functions of this
  Change.
- The tools of the act queue: Change `infra-act-queue` (#133), after this one.
- Branch protection, labels and other repository settings: the maintainer's.
