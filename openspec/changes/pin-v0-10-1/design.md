# Design

## Context

LATTICE pins WARRANT `0.10.0` (Change `pin-v0-10-0`): `.warrant/warrant.json` `kernel: "0.10"`, pack `core-sdd`
`^0.4.1`; lock kernel `0.10.0`; `.github/workflows/warrant.yml` calls
`Homasters-max/SRA/.github/workflows/warrant.yml@v0.10.0` with `warrant: v0.10.0`, `setup: npm ci`; profile
`human-acceptance` puts `human-approval` on `VERIFYING->MERGED` for policy paths, `.claude/**` and workflows. The CLI on
the machine is `0.10.0` from the tag tarball.

WARRANT `v0.10.1` (tag on `cffb0d5`, WARRANT-ADR-0056) keeps `kernel` 0.10 and the pack ranges; every change is backward
compatible on `0.10.0` inputs (CHANGELOG `## 0.10.1`). Preflight of the skill `warrant-upgrade` on `main`: `warrant
validate` and `warrant sync --check` green; the reusable workflow `v0.10.1` packs the tag before installing — the call
form stays; `test/process/pin.test.ts` asserts the call form.

What touches LATTICE:
- the guard of a worktree session (#93): under `0.10.0` the hooks run from the main checkout and see neither the
  worktree's Run nor its `write_scope`; S0 sessions check scope by hand;
- `.claude/skills/slice/act.mjs` takes `waiver <change> <WAV>` and checks the id with `/^WAV-[\w-]+$/`;
  `waiverRefusals` in `act-rules.mjs` does not depend on the form of the id; the tests know only `WAV-2026-007`;
- `.claude/skills/slice/judge.mjs` merges the ref with fresh `origin/main` in a scratch worktree outside the repository
  and runs `warrant validate`, `warrant sync --check`, `warrant ci` there, so no evidence lands in a Change's folder
  (#126, closed);
- `.claude/skills/slice/change.md` and rule `process` know no way back from `SPECIFIED`.

`.github/workflows/**`, `.warrant/local/**` and `.claude/**` are written by no Run: they come as the maintainer's patch
(`act.mjs patch`, rule `maintainer-acts`).

## Goals / Non-Goals

**Goals:**
- The CI judge and the machine's CLI are `0.10.1`; lock kernel `0.10.1`; `warrant validate`, `warrant sync --check`
  green on the impl-PR's commit.
- `act.mjs waiver` takes both id forms and nothing else; the tests show it.
- The local judge writes nothing into WARRANT state.
- The spec rework before `APPROVED` is a named step of the process.
- A worktree session is shown guarded — the condition that closes #93.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. Order

spec-PR: these artifacts only, written and judged with CLI `0.10.0` (the records' schema is unchanged in `0.10.1`).

Between the spec-PR merge and the impl-PR — acts of the maintainer outside the session: CLI `0.10.1`
(`npm pack github:Homasters-max/SRA#v0.10.1` outside any checkout, `npm i -g ./warrant-0.10.1.tgz`), then a restart of
this session so its hooks run the new guard. The pin of `warrant.json` does not move (`kernel: "0.10"` admits `0.10.1`),
so the guard never enters recovery mode; until the restart the workaround of #93 holds.

impl-PR (branch `impl/pin-v0-10-1` from `main`):
1. `warrant verify`, `transition APPROVED --ref <spec-PR> --by Homasters-max`, `IMPLEMENTING`; commit (record only).
2. The maintainer's patch (D-2) by `act.mjs patch`; the agent checks the commit names exactly the paths of D-2.
3. `warrant sync` with CLI `0.10.1` — lock kernel `0.10.1`, `.warrant/schemas/waiver.1.schema.json`, `AGENTS.md` with the
   new text of rule `process`; `warrant validate` and `warrant sync --check` green; commit. If `sync` changes `.claude/`,
   a restart of the session (maintainer) before the Run.
4. Run `implement --scope openspec/changes/pin-v0-10-1/**` (no source or test path of the repository is written by the
   agent: D-4): the guard probe (D-5), `I-N` rows, `tasks.md`; `warrant run finish`; `warrant check pin-v0-10-1
   tests-passed` `PROVEN`; `npm run typecheck`; `node --test .claude/skills/slice/*.test.mjs`; commit.
5. Implementation review (skill `code-review`), `status.mjs`, `warrant verify`, `transition VERIFYING`; the local judge
   (`judge.mjs`, now `--no-record`); push.

Rejected: installing CLI `0.10.1` before the spec-PR — the judge of the spec-PR is still `@v0.10.0`, and a waiver or
record written by one version and read by the other is what the CHANGELOG warns against; nothing in the spec-PR needs
`0.10.1`.

### D-2. The maintainer's patch

One patch, drafted in a scratch worktree outside the repository (`D:/tmp/pin-v0-10-1/1-pin.patch`), checked with
`git apply --check` and `act.mjs patch pin-v0-10-1 <file> --dry-run`:

- `.github/workflows/warrant.yml` — `@v0.10.0` → `@v0.10.1` in `uses`, `warrant: v0.10.0` → `warrant: v0.10.1`; two
  lines (`make-patch.mjs 0.10.1 call --setup "npm ci"` of the skill `warrant-upgrade`, compared with the current file).
- `.claude/skills/slice/act-rules.mjs` — `export const WAIVER_ID = /^WAV-(?:\d{4}-\d{3}|[0-9A-HJKMNP-TV-Z]{26})$/`
  (`WAV-YYYY-NNN`, or a ULID in Crockford base32 as `warrant id WAV` writes it); the comment of `waiverRefusals` notes
  that the duplicate check (SRA#139) concerns the old form. The comment of `INFORMATIONAL` drops "the guard blind in a
  worktree session" (fixed in `0.10.1`); the set stays.
- `.claude/skills/slice/act.mjs` — the argument check of `waiver` uses `WAIVER_ID`.
- `.claude/skills/slice/act-rules.test.mjs` — `WAIVER_ID` accepts `WAV-2026-007` and a 26-character ULID, refuses
  `WAV-x`, lowercase, a ULID with `I`/`L`/`O`/`U`, and an id with a shell character; `waiverRefusals` with a ULID id
  behaves as with the old one.
- `.claude/skills/slice/judge.mjs` — `warrant ci --no-record`; the header says why the scratch worktree stays (it builds
  the merge with `origin/main` that the job judges).
- `.claude/skills/slice/SKILL.md` — the paragraph of `judge.mjs`: `warrant ci --no-record`; the informational finding
  without "the guard is blind" (#93).
- `.claude/skills/slice/change.md` — under the spec-PR, after the paragraph of a spec-PR merged without `SPECIFIED`:
  "A rework of the spec before `APPROVED`, when the maintainer asks for it in the spec-PR instead of `I-N` rows:
  `warrant transition <change> PROPOSED`, then steps 2–7 again; an open spec-PR takes the new commits, a merged one is
  followed by a new spec-PR on the same branch name; `APPROVED --ref` names the spec-PR of the last `SPECIFIED`."
- `.warrant/local/rules/process.json` — paragraph "Questions", one sentence appended: "Before `APPROVED` the maintainer
  may ask instead for a rework of the spec: `warrant transition <change> PROPOSED` and the spec-PR again (`change.md`)."
  The diff of the rule is one `text` line (`node` + `JSON.parse`/`JSON.stringify`).

`AGENTS.md` is written by `warrant sync` after the patch (D-1 p. 3), never by hand.

### D-3. The call

The form of `.github/workflows/warrant.yml` is unchanged (`pin-v0-10-0` D-3): job `warrant`, permissions `read`,
`on.workflow_dispatch` with `merge_commit`, `setup: npm ci`; the check is `warrant / warrant`. The inputs of the
reusable workflow `v0.10.1` are those of `v0.10.0` (CHANGELOG: no new exit codes, new flags optional).

### D-4. The pin test

`test/process/pin.test.ts` is unchanged: it asserts that the single tag of `uses` and the single input `warrant` equal
`v` + the lock's `kernel`. After D-2 and `sync` both are `0.10.1`; a patch of one without the other is red. Its
`describe()` blocks and the absence of `SCN-…` tokens (`skip_specs`) stay. The tests of the slice scripts
(`.claude/skills/slice/*.test.mjs`) are outside `npm test`; they run locally in D-1 p. 4 and their result is stated in
the impl-PR.

### D-5. The guard probe (#93)

After the restart with CLI `0.10.1`, inside the `implement` Run (`write_scope` `openspec/changes/pin-v0-10-1/**`), the
session tries two writes with the Write tool: `design-next/guard-probe-pin-v0-10-1.md` in this worktree (outside the
scope) and `D:/project/LATTICE/guard-probe-pin-v0-10-1.md` (the main checkout). Expected: both `deny` by the PreToolUse
hook, no file created; the PostToolUse hint "start a Run first" is gone while the Run is `RUNNING`. The result — the deny
reasons, quoted — is an `I-N` row and a line of the impl-PR body; #93 closes by the archive-PR. If a write passes: the
file is removed, the Run's diff checked, a defect for `Homasters-max/SRA` opened, #93 stays open and its workaround
holds.

### D-6. Without spec

`skip_specs: true`: the product does not change; the process is held by the rules, the profile and the tests (as in
`pin-v0-8-1`, `pin-v0-8-2`, `pin-v0-10-0`).

### D-7. Classification

`chore` + `factory-change` (policy paths in the impl-PR's diff). `blast_radius: SYSTEM` — floor of the pack for
`.warrant/**` and `.github/workflows/**`; `compatibility: BREAKING` — CLI `0.10.0` cannot read a `WAV-<ULID>` waiver,
so every session of the machine moves to `0.10.1` together; `reversibility: EASY` — a pin-Change back to `v0.10.0`
loses no data while no `WAV-<ULID>` waiver exists; `data_loss: NONE`; `security_impact: LOW` — the same permissions,
the workflow pinned to a release tag of a public repository. `MERGED` with `--by Homasters-max` (gate `human-approval`
of the profile `human-acceptance`).

## Implementation Notes

Rows I-1…I-10 take the findings of the spec review (EVID-01M3Z17ZJ9MJ7SKCMT1WTNDMZ5, `PROVEN`: MAJOR F-1, F-2; MINOR
F-3…F-9; INFO F-10) as proposed in the spec-PR; the maintainer's decision is its merge
([PR #141](https://github.com/Homasters-max/LATTICE/pull/141)).

| # | Decision |
|---|---|
| I-1 | F-1: from the CLI install until this impl-PR merges, `main` judges with `@v0.10.0` while every session writes with `0.10.1`. A `[broadcast]` on #44 (https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5960036179): no `warrant waive` and no `transition … PROPOSED` in any Change until the merge |
| I-2 | F-2: `scopeFindings` exempted only `AGENTS.md` and the lock, only when a rule changed; `.warrant/schemas/**` written by `sync` was "outside the Runs' scope". The D-2 patch exempts what `warrant sync` writes — `AGENTS.md`, `.warrant/warrant.lock.json`, `.warrant/schemas/**` — when the diff changes a rule or the lock (the job's `validate` and `sync --check` prove it is `sync`'s output), with a test. `sync` output under `.claude/**`, if any, goes as a second maintainer patch |
| I-3 | F-3: the guard is one `warrant` process per hook event — after the install every session is guarded at once; a restart is needed only if `sync` changes `.claude/`. Shown by I-11 without a restart |
| I-4 | F-4: the stale text of `SKILL.md` (#93 in the start-prompt notes, coordinator item 10, the waiver bullet) is updated in the D-2 patch |
| I-5 | F-5: `Closes #93` in the archive-PR only because the probe of I-11 is denied |
| I-6 | F-6: `WAIVER_ID` is the id pattern of `waiver.1.schema.json` of `v0.10.1` (`^WAV-([0-9]{4}-[0-9]{3}\|[0-9A-HJKMNP-TV-Z]{26})$`); `act-rules.test.mjs` samples both forms and seven refused ids |
| I-7 | F-7: the probe adds an allowed write in scope — this table — and records that no "start a Run first" hint followed it (I-11) |
| I-8 | F-8: a probe file that passed would be removed here by this session, in the main checkout by the coordinator's session; none passed (I-11) |
| I-9 | F-9: `change.md` — the rework is asked in the spec-PR or, once merged, on the Change's issue; a merged spec-PR is followed by a new one and the impl-PR waits for it |
| I-10 | F-10: accepted; the transitions `APPROVED` and `IMPLEMENTING` were made with CLI `0.10.0` before the install, so no `0.10.1` command ran on the `0.10.0` lock before `sync` |
| I-11 | The guard probe (D-5), CLI `0.10.1`, no restart of the session, Run `RUN-01M3Z29ETAMR4D8A0RHZJPW3YJ` (`implement`, scope `openspec/changes/pin-v0-10-1/**`): Write `design-next/guard-probe-pin-v0-10-1.md` — denied, "outside the Run RUN-01M3Z29ETAMR4D8A0RHZJPW3YJ of pin-v0-10-1: write_scope: …"; Write `D:/project/LATTICE/guard-probe-pin-v0-10-1.md` (the main checkout) — denied, "the edit is in another checkout under WARRANT, where a Run is active or this session runs one". Neither file exists. The allowed write of this table followed by no "start a Run first" hint. Under `0.10.0` the first write passed (#93). #93 closes by the archive-PR |
| I-12 | Scope from the coordinator (message of 2026-10-02, the maintainer's retro decision on #93, Q3, posted as `[decision] retro S0 wave 1` on #44): the prevention of #93 is the guard by `cwd` plus the judge treating inactive hooks as a violation again — if `0.10.1` no longer reports `FRONTEND_HOOKS_INACTIVE` in a worktree. Checked: the Run of I-11 records `post edit allow openspec/changes/pin-v0-10-1/design.md`; `warrant ci --no-record` (`0.10.1`) on the merge of `origin/main` with this branch, the D-2 patch and `warrant sync` reports no `FRONTEND_HOOKS_INACTIVE`. So the D-2 patch also removes the exception of #128: `INFORMATIONAL` and `notes` of `judgeVerdict` (`act-rules.mjs`), the `note:` lines of `judge.mjs`, its test (now: the finding is a violation; without it the impl-PR waits on CI only), the `note:` clauses of `SKILL.md` and `change.md` |

## Risks / Trade-offs

- [Other S0 sessions keep running hooks of `0.10.0` until they restart] → the CLI is global: after the install every
  hook call runs `0.10.1` on its next event; a session's running guard is a process per event, so the switch is
  immediate; only the hook configuration in `.claude/` needs a restart, and D-1 p. 3 checks it.
- [A `WAV-<ULID>` waiver read by a `0.10.0` CLI] → no waiver in this Change; `act.mjs waiver` refuses on a CLI that does
  not match `kernel` only by range (`0.10`), so the install precedes any new waiver.
- [`warrant ci --no-record` changes the verdict] → CHANGELOG: the same verdict; the impl-PR's job `warrant / warrant`
  judges it independently.
- [The job of the impl-PR runs `@v0.10.1` for the first time] → red: `gh run view <id> --log-failed`, the `hint`; a
  WARRANT defect — an issue in `Homasters-max/SRA`, a workaround only by an `I-N` with the maintainer's decision.
- [`ci fetch` in the archive-PR reports `EVIDENCE_UNTRACKED`] → leftovers are not committed: removed and `ci fetch`
  repeated (CHANGELOG).

## Migration Plan

1. spec-PR — artifacts, `classify --propose`, review, `SPECIFIED`; merge — maintainer.
2. The maintainer: CLI `0.10.1` from the tag, restart of this session.
3. impl-PR — D-1; verdict — job `warrant / warrant` on `@v0.10.1`.
4. archive-PR — `ci fetch`, `MERGED --ref <impl-PR> --by Homasters-max`, `archive`; `Closes #140`, `Closes #93`.
5. Rollback — a pin-Change to `v0.10.0` (workflow `@v0.10.0`, lock `0.10.0`, CLI `0.10.0`), possible while no
   `WAV-<ULID>` waiver exists.
