---
name: slice
description: "Slice coordination for LATTICE: status of a slice (S0, SW, S1…S4), what can start next, launch a Change into its own worktree and session. Use on \"slice status\", \"where is S0\", \"what can start next\", \"launch <change>\", or /slice."
argument-hint: "status <slice> | next <slice> | launch <change | #issue>"
---

# Slice

The coordinator session holds a slice: it dispatches Changes, reviews them, and queues merges for the maintainer. Each Change is written by its own session in its own worktree.

## Model

- **Slice** = GitHub milestone (`S0`, `SW`, `S1`…`S4`) + its **umbrella** issue (task list of Change issues, plan, slice-level decisions as comments linking `I-N` rows and PRs).
- **Change issue** = one per Change, title `<slice>: <change> — …`, body lines ``Where: Change `<name>`, AREA `<AREA>` `` (several: `` `TR` + `AC` + `CT` ``) and `Depends on: #N, …`. An issue whose `Where:` names no Change is a docs PR.
- **One worktree per Change**, `D:/project/LATTICE-wt/<change>`; its session makes the three branches there in turn: `spec/<change>`, `impl/<change>`, `archive/<change>`, each from fresh `origin/main`.
- **State is computed, never stored**: Change state from warrant records (refs and worktrees), PRs and checks from GitHub, worktrees from `git worktree list`, health of `main` from its last completed `test.yml` run. `status.mjs` computes all of it.
- **Rules**, enforced by `next`:
  - one capability = one AREA = at most one active Change (SL-T08); an AREA is **held** from `warrant init change` (a record exists) until ARCHIVED or ABANDONED; MERGED still holds it;
  - at most 3 Changes **in implementation**: from the first commit of the impl-PR until it merges (impl-PR open, or record APPROVED…VERIFYING without a merged impl-PR); a Change waiting only for its archive-PR is out;
  - a **red** `main` (last `test` run on main failed) blocks dispatch; no `test.yml` yet = unknown, a warning only;
  - shared files belong to the skeleton Change; `implement` Runs are narrowed with `--scope <source and test paths named by its design>,openspec/changes/<change>/**`.

## Commands

`node .claude/skills/slice/status.mjs <slice | change | #issue> [--next] [--json]` — fetches `origin`, takes ~10 s. Paste its markdown output as is.

### status `<slice>`

Run `status.mjs <slice>`. Header: `main` health, WIP of 3, held AREAs, 👤 maintainer queue with PR URLs. Table: issue, Change, AREA, state, open PR and checks, depends on (✓ / ⏳), next action, who acts. End with one line: what the coordinator does now.

### next `<slice>`

Run `status.mjs <slice> --next`: the rows that may start now, by issue number — `launch` (dependencies done, AREAs free), `launch (docs PR)`, or `start impl-PR` (spec-PR merged, WIP < 3). A red `main` empties the list and says so.

### launch `<change | #issue>`

1. `status.mjs <change>` prints `startable`; otherwise report its reason (a red `main` included) and stop. Phase: `spec` for a not-started Change, `impl` for `start impl-PR`, `docs` for an issue without a Change.
2. Worktree `D:/project/LATTICE-wt/<name>` (`<name>` = change, or `issue-<N>` for docs):
   - no worktree: `git fetch origin`, then `git worktree add D:/project/LATTICE-wt/<name> -b <phase>/<name> origin/main` (branch exists: drop `-b`, pass the branch);
   - worktree exists: reuse it; the Change session makes the next branch there itself.
3. Compose the start prompt from the template below, with the issue body verbatim (`gh issue view <N> --json body`).
4. Offer it as a chip: `mcp__ccd_session__spawn_task` with `title` "Start <change>", `tldr` (one sentence: which Change, which phase, why it may start now), `prompt`, `cwd` = the worktree path. Without that tool: print the prompt in a fenced block for the maintainer to paste into a new session opened in the worktree.
5. Optional, when `mcp__ccd_sidebar__*` tools are present: a sidebar group named after the slice (create it if missing); move the Change session into it once the maintainer starts it.

Start prompt:

```text
You run <phase> of Change `<change>`, slice <slice> (issue #<N>, umbrella #<U>).
Working directory: D:/project/LATTICE-wt/<name> — the one worktree of this Change. Work, commit and push only there.
Branches, made here in turn, each from fresh origin/main: spec/<change>, then impl/<change>, then archive/<change>. Before impl/<change>: node .claude/skills/slice/status.mjs <change> must print "startable" (WIP < 3, main not red); otherwise report and wait.

<issue body>

Process: AGENTS.md of the working directory — the <phase>-PR of the Change, from its first step to the PR. implement Runs: --scope <source and test paths named by your design>,openspec/changes/<change>/** (the scope intersects write_scope); shared files belong to the skeleton Change.
Read: this issue, the design-next IDs it names, merged specs of its dependencies (openspec/specs/**).
Steps: skill progress, 🛠 development — the list at start and after every step.
A decision that touches the slice (another Change, an AREA, a shared file, the order): a comment on umbrella #<U> linking the I-N row or PR.
Acts of the maintainer (approval, merge, UNKNOWN decision): ask as AGENTS.md says and wait.
```

docs phase: replace the Process line with "a docs PR closing #<N>, no Change".
