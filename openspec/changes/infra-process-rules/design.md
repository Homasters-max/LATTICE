# Design

## Context

- The rules `tracking`, `maintainer-acts` and `process` live in `.warrant/local/rules/*.json` (policy paths, the
  maintainer's act) and are rendered into `AGENTS.md` by `warrant sync`, which also rewrites
  `.warrant/warrant.lock.json`. A PR that changes them without a Change is refused by the job `warrant`:
  `SCOPE_VIOLATION` (PRs #90, #96).
- The maintainer's patches exist as commits: `44a3cb3` on `process/warrant-issues` (PR #90, `tracking.json` only) and
  `3c51478` on `process/merge-only` (PR #96, `maintainer-acts.json` and `process.json` only); the lock was regenerated in
  separate commits of those branches. On `origin/main` `59711ac` both apply cleanly (`git apply --check`).
- The `implement` Run of this project writes `src/**`, `test/**` and the Change's `tasks.md`, `design.md`, `specs/**`
  (seen on the Runs of `infra-pr-watch`). `.claude/**` is outside it and inside the profile `human-acceptance`, so the
  skill `slice` changes as a maintainer's patch too, as in Change `infra-pr-watch` (its D-4).
- The rule-delivery block of `test/process/pin.test.ts` ("pin: project rules") checks that the text of every rule is in
  `AGENTS.md`.
- `.claude/skills/slice/status.mjs` today:
  - health of `main` is the conclusion of the last completed `test.yml` run on `main`; the workflow `warrant` runs on
    pull requests and on `workflow_dispatch` only, so `main` has no `warrant` run to read;
  - `busy` maps an AREA to one Change: a second holder overwrites the first, and nothing reports two;
  - AREAs are parsed from every issue's `Where:` line, with or without a Change; an issue without a Change and without
    a PR is `launch (docs PR)`;
  - an open spec-PR asks the maintainer for `approve + merge` unless `reviewDecision` is `APPROVED`.
- `warrant validate` (0.10.0) checks configuration, packs, schemas, ids and generated files of a checkout. Run on a
  detached checkout of `ed52281` (the `main` of #92) it exits 3 with nine `ID_DUPLICATE` errors; on `59711ac` it exits 0.
  Each run takes about 10 s.

## Goals / Non-Goals

**Goals:** the three rule changes reach `AGENTS.md` through a Change; `status.mjs` blocks dispatch on a `main` that
fails `warrant validate`, names two Changes holding one AREA as a decision for the maintainer, and never offers a bug or
question issue as a docs PR.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. The rules — the maintainer's text, unchanged

The new texts of `tracking.json`, `maintainer-acts.json` and `process.json` are exactly those of `44a3cb3` and
`3c51478`; the Appendix quotes the changed sentences. This Change does not edit them: a rule text is the maintainer's
act, and a later wording change is a new patch.

### D-2. Health of `main` counts `warrant validate`

`main` has two checks, and its state is the worse of them (red over unknown over green):
- **test** — as today: the conclusion of the last completed `test.yml` run on `main`; no run or no workflow is unknown;
- **warrant** — `warrant validate` on a checkout of `origin/main`: a detached worktree in the OS temp directory
  (`git worktree add --detach`), removed in a `finally` (`git worktree remove --force`); `ok: true` is green,
  `ok: false` is red with its error codes counted (`ID_DUPLICATE ×9`); no `warrant` on `PATH` or output that is not
  JSON is unknown.

The header prints both: `main: red (warrant validate 59711ac: ID_DUPLICATE ×9 · test green <url>) — dispatch blocked`.
A red `main` blocks dispatch as today. `--main-ref <ref>` validates another ref in place of `origin/main` (a replay of a
past `main`, task 2.1); the test check still reads `main`.

Rejected: `warrant verify <change>` — it needs a Change, records evidence and checks one transition; the last `warrant`
job of `main` — there is none, the job judges pull requests; a push trigger in `warrant.yml` — a policy path, and the
job judges the PR whose merge is `HEAD`, not a branch; `git archive | tar` instead of a worktree — one more tool on
Windows for the same result.

### D-3. AREA collision

- `busy` maps an AREA to the list of Changes that hold it (the hold rule is unchanged: a record exists, the state is
  before `ARCHIVED`, or `ARCHIVED` but not on `origin/main`). `--json` prints `busy_areas` as `{AREA: [change, …]}` and
  a new `area_collisions` as `[{area, changes}]`.
- Two or more holders of one AREA are a collision. The row of each such Change gets `AREA collision <A> with <other>
  — needs a decision`, who `👤 maintainer`, not startable; this replaces its other next action (a PR of a Change in a
  collision waits for the decision, rule `process`). The maintainer queue gets one row per AREA:
  `AREA collision <A>: <c1>, <c2> — needs a decision`, and the rows in a collision add no queue row of their own.
- The header marks a collided AREA: `held AREAs: CL (s0-apply-checks + s0-store) ⚠`.
- A Change that declares a held AREA and has no record waits, as today (`wait AREA <A> (<holder>)`): a second Change
  waits, it collides only after its own `warrant init change`. `status.mjs <change>`, run by the session right after
  `init` (rule `process`), prints the collision as its `not startable` reason — the session's signal to stop.

### D-4. Issues without a Change

- AREAs are read from `Where:` only when it names a Change: an AREA is held by a Change (SL-T08), so an issue without
  one never holds or waits for an AREA.
- An open issue without a Change whose labels include `bug` or `question` is not a docs PR: without an open PR its row
  is `<label>: needs a fix Change or a PR that closes it`, who `—`, not startable; with an open PR the row is the same as
  a docs issue's (fix CI, finish, merge). A header line lists the open P1 ones: `Open P1 without a Change: #92, #93`.
- A dependency on such an issue is done when it is closed, as for any issue without a Change.

### D-5. The merge is the approval in the skill

- `status.mjs`: an open spec-PR in `SPECIFIED` asks `merge spec-PR #N`; `reviewDecision` is no longer read. A draft PR
  is `finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)`.
- `SKILL.md`: the model lists the `warrant validate` check of `main`, AREA collisions and bug / question issues; the
  start-prompt template asks for "merge, UNKNOWN decision" (no approval); the run time is ~20 s.

### D-6. Delivery

Three maintainer's patches, applied in the worktree of this Change on `impl/infra-process-rules` with
`git apply --index`:
1. `44a3cb3` — `git -C <worktree> format-patch -1 44a3cb3 --stdout`, saved as `D:/tmp/infra-process-rules/1-tracking.patch`;
2. `3c51478` — the same, `D:/tmp/infra-process-rules/2-merge-only.patch`;
3. the skill `slice` (D-2…D-5) — written by the agent outside the repository and checked on a scratch checkout,
   `D:/tmp/infra-process-rules/3-slice.patch`.

The agent commits the staged result as the maintainer's patch, checks that `git diff --cached --name-only` names
exactly the five paths, then runs `warrant sync` (`AGENTS.md`, lock) as a separate commit. The `implement` Run is
narrowed to `openspec/changes/infra-process-rules/**` (tasks and `I-N` rows only). No new test: the rule texts are
checked by the rule-delivery block of `pin.test.ts`; the script is a tool of the session, checked by running it on the
real repository (task 2.1).

### D-7. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY`, `data_loss: NONE`, `security_impact: NONE` (read-only `gh` calls,
a temporary worktree removed by the script).

## Implementation Notes

None yet: rows `I-N` come from the spec review and the implementation.

## Appendix — the changed rule sentences

### `tracking` (`44a3cb3`), replaces "A WARRANT defect goes to `D:/tmp/warrant-inbox/`."

A WARRANT defect, gap or idea is an issue in `Homasters-max/SRA`, opened by the agent itself
(`gh issue create -R Homasters-max/SRA --body-file`): title `<area>: <what>` (area: `guard`, `cli`, `ci`, `records`,
`docs`), one label `bug` · `enhancement` · `question`, body "Found in:" a LATTICE link (PR, Run, commit) and the
WARRANT version, "What happened", "Expected". The repository is public: facts about WARRANT's behaviour only. The
report names it `Homasters-max/SRA#N`; a LATTICE issue that waits on it links it.

### `maintainer-acts` (`3c51478`), replaces "approving and merging a PR"

merging a PR (`gh pr merge <N> --merge`: the merge is the approval; GitHub's approve is not asked — PRs are opened
under the maintainer's account, which cannot approve its own)

### `process` (`3c51478`)

New sentences before "Waiting for the maintainer":

A slice decision that changes an open PR (an AREA, an id, the order of Changes — a comment on the umbrella) stops its
merge: the author of the decision turns that PR back to draft (`gh pr ready <N> --undo`) and comments in it
`⛔ Do not merge — <decision URL>`; the owner brings the PR in line with the decision and marks it ready
(`gh pr ready <N>`) with a comment naming the commit. A draft PR is never merged. Before asking for a merge the owner
reads the umbrella comments newer than its last push; one that touches its Change or an AREA it holds comes first.
After `warrant init change` the session runs `node .claude/skills/slice/status.mjs <change>`; if another Change holds
one of its AREAs, it stops and asks on the umbrella.

Step 1, replaces "The maintainer approves and merges, in either order; … the approval of the spec-PR is the decision on
them.":

The maintainer merges it, and the merge is the approval; changes the review asks for become `I-N` rows of the impl-PR,
and the merge of the spec-PR is the decision on them.
