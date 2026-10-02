# Design

## Context

- The rules `tracking`, `maintainer-acts` and `process` live in `.warrant/local/rules/*.json` (policy paths, the
  maintainer's act) and are rendered into `AGENTS.md` by `warrant sync`, which also rewrites
  `.warrant/warrant.lock.json`. A PR that changes them without a Change is refused by the job `warrant`:
  `SCOPE_VIOLATION` (PRs #90, #96).
- The maintainer's patches exist as commits: `44a3cb3` on `process/warrant-issues` (PR #90, `tracking.json` only) and
  `3c51478` on `process/merge-only` (PR #96, `maintainer-acts.json` and `process.json` only); the lock was regenerated in
  separate commits of those branches. On `origin/main` `59711ac` both apply cleanly (`git apply --check`).
- Accounts: every PR of this project is authored by `homasters` (`identities.agents` of `.warrant/warrant.json`, the
  machine user the maintainer runs sessions under) and merged by `Homasters-max` (`roles.maintainer`) — PRs #65, #70,
  #72, #87, #89, #95. A session runs `gh` as `homasters`, so its `gh pr review --approve` is an approve of its own PR,
  which GitHub refuses (PR #95). Spec-PR #72 was merged without any review and `warrant ci` accepted it as the ref of
  `APPROVED` of `infra-pr-watch`: the merge alone carries the approval. The phrase "the maintainer's account" in the
  text of `3c51478` means `homasters` in this sense.
- The `implement` Run of this project writes `src/**`, `test/**` and the Change's `tasks.md`, `design.md`, `specs/**`
  (seen on the Runs of `infra-pr-watch`). `.claude/**` is outside it and inside the profile `human-acceptance`, so the
  skill `slice` changes as a patch the maintainer applies, as in Change `infra-pr-watch` (its D-4).
- The rule-delivery block of `test/process/pin.test.ts` ("pin: project rules") checks that the text of every rule is in
  `AGENTS.md`. `npm test` runs `test/**/*.test.ts` only.
- `.claude/skills/slice/status.mjs` today:
  - health of `main` is the conclusion of the last completed `test.yml` run on `main`; the workflow `warrant` runs on
    pull requests and on `workflow_dispatch` only, so `main` has no `warrant` run to read;
  - `busy` maps an AREA to one Change: a later holder overwrites an earlier one, and nothing reports two;
  - holders are read from the issues of one milestone; AREAs are parsed from every issue's `Where:` line, with or
    without a Change; an issue without a Change and without a PR is `launch (docs PR)`;
  - an issue without a milestone exits 2 (`issue #N has no milestone`);
  - an open spec-PR asks the maintainer for `approve + merge` unless `reviewDecision` is `APPROVED`;
  - nothing knows the `fix-main-<issue>` Change of the rule `tracking` (exempt from the freeze, the WIP cap and the AREA
    hold of the Change that broke `main`).
- `warrant validate` (0.10.0) checks configuration, packs, schemas, ids and generated files of a checkout. Run on a
  detached checkout of `ed52281` (the `main` of #92) it exits 3 with nine `ID_DUPLICATE` errors; on `59711ac` it exits 0.
  Each run takes about 10 s. The lock of a checkout names its CLI version (`kernel`, `0.10.0`).

## Goals / Non-Goals

**Goals:** the three rule changes reach `AGENTS.md` through a Change; a `main` that fails `warrant validate` is red for
the rule and for `status.mjs`; `status.mjs` names a Change that holds an AREA held first by another as a decision for
the maintainer, never offers a bug or question issue as a docs PR, and keeps the exemptions of `fix-main-*`.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. The rules — the maintainer's text, plus one sentence for a red `main`

The new texts of `maintainer-acts.json` and `process.json` are exactly those of `3c51478`, and `tracking.json` is that
of `44a3cb3` with one more change (D-2): a red `main` includes a failed `warrant validate`. The Appendix quotes every
changed sentence. A rule text is the maintainer's: the merge of this spec-PR is the decision on the extra sentence, and
the maintainer applies it (D-7).

### D-2. A red `main` counts `warrant validate`

`main` has two checks, and its state is the worse of them (red over unknown over green):
- **test** — as today: the conclusion of the last completed `test.yml` run on `main`; no run or no workflow is unknown;
- **warrant** — `warrant validate` on a checkout of `origin/main`:
  - the checkout is a detached worktree in a fresh directory `fs.mkdtempSync(<os temp>/lattice-status-)` (unique per
    run, so concurrent runs of several sessions never share one), removed in a `finally`
    (`git worktree remove --force`); a removal that fails prints a warning with the command to run;
  - before it, registered worktrees named `lattice-status-*` in the OS temp directory older than one hour (left by a
    killed run) are removed, then `git worktree prune`;
  - a ref that does not resolve, or a `git worktree add` that fails, is unknown with the error;
  - `warrant --version` different from `kernel` of the checkout's lock is unknown (`warrant 0.11.0 on PATH, origin/main
    pins 0.10.0`): a validate by another CLI version proves nothing about `main`;
  - otherwise `ok: true` is green, `ok: false` is red with its error codes counted (`ID_DUPLICATE ×9`), output that is
    not JSON or no `warrant` on `PATH` is unknown.

The header prints both: `main: red (warrant validate ed52281: ID_DUPLICATE ×9 · test green <url>) — dispatch blocked`.
A red `main` blocks dispatch, except a `fix-main-*` Change (rule `tracking`). `--main-ref <ref>` validates another ref
in place of `origin/main` (a replay of a past `main`, task 2.2); the test check still reads `main`.

The rule `tracking` says the same (Appendix): the coordinator checks both before dispatching; a red `main` of either
kind is the `bug` `P1` issue `infra: main red — <failing test or error code>` and the `fix-main-<issue>` Change.

Rejected: `warrant verify <change>` — it needs a Change, records evidence and checks one transition; the last `warrant`
job of `main` — there is none, the job judges pull requests; a push trigger in `warrant.yml` — a policy path, and the
job judges the PR whose merge is `HEAD`, not a branch; `git archive | tar` instead of a worktree — one more tool on
Windows for the same result.

### D-3. AREA holders and collisions

- Holders are computed over every issue of the repository that names a Change (any milestone, any state), so a Change
  of another slice or one outside a slice counts. The hold rule is unchanged: a record exists, the state is before
  `ARCHIVED`, or `ARCHIVED` but not on `origin/main`.
- The holders of an AREA are ordered by the time of their `warrant init change` — the `at` of the first transition of
  the record, read from the furthest ref, or from the record file of the Change's worktree before its first commit.
  The first holder keeps the AREA and its row is unchanged. Each later holder is in a collision: its row is
  `AREA collision <A> with <first> — needs a decision`, who `👤 maintainer`, not startable, and this replaces its other
  next action (rule `process`: a second Change waits; a decision may still reorder them). When the order cannot be read
  (a time is missing or two are equal), every holder of that AREA is in the collision.
- The maintainer queue gets one row per collided AREA: `AREA collision <A>: <first>, <later…> — needs a decision`;
  rows in a collision add no queue row of their own. The header marks the AREA: `held AREAs: CL (s0-apply-checks;
  s0-store ⚠)`. `--json` prints `busy_areas` as `{AREA: [change, …]}` in init order and `area_collisions` as
  `[{area, changes}]`.
- A `fix-main-*` Change neither collides nor waits for an AREA (rule `tracking`: exempt from the AREA hold of the
  Change that broke `main`; the script cannot tell which Change that is, so the exemption is from every hold), is not
  blocked by a red `main`, and is not counted in the WIP cap.
- A Change that declares a held AREA and has no record waits, as today (`wait AREA <A> (<holder>)`).
  `status.mjs <change>`, run by the session right after `init` (rule `process`), prints the collision as its
  `not startable` reason — the session's signal to stop.

### D-4. Issues without a Change, and without a milestone

- AREAs are read from `Where:` only when it names a Change: an AREA is held by a Change (SL-T08), so an issue without
  one never holds or waits for an AREA.
- An open issue without a Change labelled `bug`: without an open PR its row is
  `bug: needs a fix Change or a PR that closes it`, who `—`; labelled `question`: `question: needs the maintainer's
  answer`, who `👤 maintainer` (rule `tracking`). Neither is startable. With an open PR the row is the same as a docs
  issue's (fix CI, finish, merge). A dependency on such an issue is done when it is closed.
- A header line lists the open `bug` / `question` `P1` issues without a Change, of the milestone and of no milestone:
  `Open P1 without a Change: #92, #93`.
- `status.mjs <change | #issue>` for an issue without a milestone (a Change outside a slice, rule `tracking`) prints
  that issue alone against the repository-wide holders, with no slice header, instead of exiting 2. `SKILL.md`: a Change
  without an umbrella asks in its own issue.

### D-5. The merge is the approval in the skill

- `status.mjs`: an open spec-PR in `SPECIFIED` asks `merge spec-PR #N`; `reviewDecision` is no longer read. A draft PR
  is `finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)`.
- `SKILL.md`: the model lists the `warrant validate` check of `main`, AREA collisions, `fix-main-*`, bug / question
  issues; the start-prompt template asks for "merge, UNKNOWN decision" (no approval); the run time is ~20 s.

### D-6. The rules of the script in a pure module

The decisions of D-2…D-4 — the state of `main` from its two checks, holders and collisions from records with init
times, the kind of an issue (Change, bug, question, docs), the `fix-main-*` exemptions — move into
`.claude/skills/slice/rules.mjs`: pure functions over plain data, no `gh`, `git` or `warrant`. `status.mjs` gathers
the data and calls them. `.claude/skills/slice/rules.test.mjs` (`node:test`, `node --test`) checks them on fixtures,
among them the case of #92 (two holders of `CL` a minute apart) and a `fix-main-*` Change on a red `main`. It is a test
of a session tool, outside `npm test` and the spec (`skip_specs`); the impl-PR pastes its run.

Rejected: proving a collision live with a throwaway local branch and record of a queued Change — every session of the
repository would see the fake collision while it exists; a fake issue on GitHub — outward-facing.

### D-7. Delivery

Four patches in `D:/tmp/infra-process-rules/`, applied in this order in the worktree of this Change on
`impl/infra-process-rules`:
1. `1-tracking.patch` — `git format-patch -1 44a3cb3 --stdout`;
2. `2-merge-only.patch` — `git format-patch -1 3c51478 --stdout`;
3. `3-tracking-red-main.patch` — the sentences of D-2 in `tracking.json` (Appendix), on top of 1;
4. `4-slice.patch` — `.claude/skills/slice/{status.mjs,rules.mjs,rules.test.mjs,SKILL.md}` (D-2…D-6).

Patches 3 and 4 are the agent's drafts, written outside the repository and run on a scratch checkout; the maintainer
reads them before applying. Right before asking, the agent checks `git apply --check` of the four in order on the
impl branch. The maintainer applies each with `git apply --index` and commits the result once; the agent never applies
or commits them. The agent then checks that the commit names exactly the seven paths, and runs `warrant sync`
(`AGENTS.md`, lock — generated) as a separate commit.

If `main` moves and a patch no longer applies, the agent re-cuts 3 and 4 on the new base; for 1 and 2 (the
maintainer's text) it reports the conflict and asks the maintainer for a new commit.

The `implement` Run is narrowed to `openspec/changes/infra-process-rules/**` (tasks and `I-N` rows only).

### D-8. Classification

`chore` + `factory-change` + `human-acceptance`; `blast_radius: SYSTEM` (floor for `.warrant/**`),
`compatibility: COMPATIBLE`, `reversibility: EASY`, `data_loss: NONE`, `security_impact: NONE`: `gh` calls of the
script are read-only and its temporary worktree is removed. Issues in the public `Homasters-max/SRA` carry facts about
WARRANT's behaviour only (rule `tracking`); no product security changes.

## Review history

Review 1 (`EVID-01M3XX1ZKSWPMXX73JW6CSDDH7`, `NOT_PROVEN`), before `SPECIFIED`, taken into this text: F-1 → D-7 (the
maintainer applies and commits); F-2 → Context, accounts (PRs authored by `homasters`, the merge accepted as the
approval on #72); F-3 → D-1, D-2 and the Appendix (`tracking`); F-4 → D-3 (`fix-main-*`); F-5 → D-3 (init order, only
later holders collide); F-6, F-10 → D-2 (errors, unique temp worktree, stale ones); F-7 → D-2 (CLI version); F-8 → D-6
(pure module and tests instead of a throwaway branch); F-9 → D-2 (example on `ed52281`); F-11 → D-4 (`question` to the
maintainer); F-12 → D-3, D-4 (repository-wide holders, P1 of no milestone); F-13 → D-4 (no milestone, no umbrella);
F-14 → D-7 (a patch that no longer applies); F-15 → D-8; F-16 → proposal (prevention by the rule, detection by the
check).

## Implementation Notes

From review 2 (`EVID-01M3XXNY3DRN79NGQMM81ZM9T1`, `PROVEN`: MAJOR F-1…F-3, MINOR F-4…F-13, INFO F-14, F-15), the
maintainer's items 4–7 of #97 ([decision](https://github.com/Homasters-max/LATTICE/issues/97#issuecomment-5948394808),
08:42, before `SPECIFIED` but not read by this session until after it) and the implementation. The rows were proposed in
the body of spec-PR [#103](https://github.com/Homasters-max/LATTICE/pull/103); its merge by the maintainer is the
decision on them. D-1…D-8 hold the approved text; these rows amend it.

| # | Decision |
|---|---|
| I-1 | F-1: `status.mjs <change>` prints an `AREA:` line under its `startable` / `not startable` line — `none`, `exempt (fix-main)`, `wait <A> (<holder>)`, `<A…> — held by this Change, no collision`, `<A…> — free`, or `collision <A> with <first> — stop and ask on the umbrella (no umbrella: in the issue)`. Only a later holder stops; the first holder sees no collision |
| I-2 | F-2: fact — every merge of this project is by `Homasters-max` (`roles.maintainer`), e.g. #103 (`f915a55`); `warrant ci` checks it at `APPROVED` (`human-approval` `PASS` on this Change) |
| I-3 | F-3: while `main` is red, maintainer-queue rows that merge a PR other than a `fix-main-*` one end in `— held: main is red` (rule `tracking`: only the fix is merged) |
| I-4 | F-4: the text of `3c51478` is kept — the maintainer merged #103 without a new wording ("the maintainer's account" is `homasters`, Context) |
| I-5 | F-5, F-6: `warrant --version` is compared with `kernel` of `.warrant/warrant.json` of the checked ref (`0.10` — any `0.10.x`), not with the lock's exact version; another version is unknown, not red |
| I-6 | F-7: a `fix-main-*` Change that ran `init` first holds its AREA against later Changes as usual; only as a later holder is it exempt |
| I-7 | F-8: `SKILL.md` — a Change without an umbrella asks in its own issue; the rule text stays the maintainer's |
| I-8 | F-9: patch 3 reads "checks the health of `main` before dispatching (the last `test` run of `main` and `warrant validate` on `origin/main`, skill `slice`), and never writes a Change's code" |
| I-9 | F-10: an issue without a milestone prints `## #N — no milestone`, the `main` check, WIP and held AREAs as usual |
| I-10 | F-11: task 2.2 shows the live run as found; the fixtures of task 2.1 are the proof of D-3 and D-4 |
| I-11 | F-12: fact — `homasters` has `push` and `triage` on `Homasters-max/SRA` (`gh api repos/Homasters-max/SRA`); labels are kept |
| I-12 | F-13: `proposal.md` (outside the agent's write scope) keeps its wording; the rows here are the record |
| I-13 | F-14: WARRANT's docs (INV-01) ask for an approving review while the CLI checks only the merge; an issue in `Homasters-max/SRA` (rule `tracking`, as patched here), named in the impl-PR body |
| I-14 | F-15: turning another owner's PR to draft on a slice decision is the one exception to PR ownership; the maintainer's text, kept |
| I-15 | #97 items 4–6: patch 3 (`3-rules.patch`) carries, besides I-8 and the red `main` of D-2, (5) `tracking`: "Work without a Change is a commit and a PR that touches no policy path (`.warrant/local/**`, `.warrant/warrant.lock.json`, `.github/workflows/**`); one that does is a Change."; (4, 6) `process`, after "A draft PR is never merged.": "Before a push that opens or updates a PR, the owner runs the CI judge locally on the merge with fresh `origin/main` — `git fetch origin`, then in a scratch worktree `git checkout --detach origin/main`, `git merge --no-ff <head>`, `warrant ci` — and pushes only on exit 0. A PR behind `main` is updated by its owner (`gh pr update-branch <N>`, a merge commit, after the local judge) and waits for green checks before the merge is asked." Branch protection of `main` is the maintainer's act, done on 2026-10-02 |
| I-16 | #97 item 7: `Depends on:` is read up to the end of its first sentence (`rules.mjs` `dependsOn`); "Depends on: none. Closes #94." has no dependency |
| I-17 | Implementation: several issues may name one Change in `Where:` — #100 (a bug, "Change `infra-process-rules` (#97)") and #97. The Change's issue is the one whose title names it, else the oldest; the others refer to it, hold no AREA and are read by their labels (`bug: fixed by Change <c>`) — `rules.mjs` `claimChanges` |
| I-18 | Implementation: a run takes about a minute, not ~20 s (D-5): the old script already took ~37 s (a `warrant status` per Change worktree), the `warrant validate` adds ~10 s. The header prints the checks in the order `test … · warrant validate …` |
| I-19 | Implementation: the patch files are `1-tracking.patch`, `2-merge-only.patch`, `3-rules.patch` (`tracking.json`, `process.json`: D-2, I-8, I-15) and `4-slice.patch` (`.claude/skills/slice/{status.mjs,rules.mjs,rules.test.mjs,SKILL.md}`); the commit still names the seven paths of task 1.2 |

## Appendix — the changed rule sentences

### `tracking` (`44a3cb3`), replaces "A WARRANT defect goes to `D:/tmp/warrant-inbox/`."

A WARRANT defect, gap or idea is an issue in `Homasters-max/SRA`, opened by the agent itself
(`gh issue create -R Homasters-max/SRA --body-file`): title `<area>: <what>` (area: `guard`, `cli`, `ci`, `records`,
`docs`), one label `bug` · `enhancement` · `question`, body "Found in:" a LATTICE link (PR, Run, commit) and the
WARRANT version, "What happened", "Expected". The repository is public: facts about WARRANT's behaviour only. The
report names it `Homasters-max/SRA#N`; a LATTICE issue that waits on it links it.

### `tracking` (this Change, D-2)

Replaces "checks the last `test` run of `main` before dispatching" with:

checks the health of `main` before dispatching — the last `test` run of `main` and `warrant validate` on `origin/main`
(skill `slice`, `status.mjs`) —

Replaces "A red `test` on `main` is a `bug` `P1` issue `infra: main red — <failing test>`" with:

A red `main` — a failed `test` run on `main`, or `warrant validate` failing on `origin/main` — is a `bug` `P1` issue
`infra: main red — <failing test or error code>`

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
