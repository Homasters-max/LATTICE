# Proposal

## Why

LATTICE is pinned to WARRANT `0.10.0`: `kernel: "0.10"`, lock kernel `0.10.0`, the CI judge calls the reusable
workflow `@v0.10.0` with `warrant: v0.10.0` (Change `pin-v0-10-0`). WARRANT `v0.10.1`
([release](https://github.com/Homasters-max/SRA/releases/tag/v0.10.1), WARRANT-ADR-0056) is wave 3 of the S0 plan
([#44](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5954605349)) and fixes five defects LATTICE
reported; `kernel` 0.10 and the pack ranges stay. What it changes for LATTICE (SRA CHANGELOG `## 0.10.1`, "Migration"):

- **guard** (Homasters-max/SRA#138): the project and the active Run of a hook event are taken from the event's `cwd`
  (the nearest checkout with `.warrant/warrant.json` and `.git`). Under `0.10.0` a worktree session was unguarded:
  `write_scope` was not enforced at write time (#93), and every S0 session carries a manual workaround.
- **waiver ids** (SRA#139): new waivers are `WAV-<ULID>`; `WAV-YYYY-NNN` stays valid. CLI `0.10.0` cannot read the new
  form — versions must not be mixed.
- **`warrant ci --no-record`** (SRA#143): the same verdict, nothing written into WARRANT state; `ci fetch` names
  leftovers of the evidence folder (`EVIDENCE_UNTRACKED`).
- **`SPECIFIED -> PROPOSED`** (SRA#142): a spec never approved can be reworked; `APPROVED --ref` then names the spec-PR of
  the last `SPECIFIED`.
- `analyze-clean` no longer reports `ORPHAN` for an SCN declared in another open Change's delta (SRA#141).

## What Changes

- `.github/workflows/warrant.yml` — the call `Homasters-max/SRA/.github/workflows/warrant.yml@v0.10.1` with
  `warrant: v0.10.1`; nothing else in the file.
- CLI `0.10.1` on the maintainer's machine from the tag tarball; `warrant sync` — lock kernel `0.10.1`, the copy of
  `.warrant/schemas/waiver.1.schema.json`; `.warrant/warrant.json` unchanged (`kernel: "0.10"`).
- `.claude/skills/slice/act-rules.mjs` — one exported pattern of a waiver id, both forms; `act.mjs` checks its argument
  with it; `act-rules.test.mjs` covers both forms and a ULID waiver in `waiverRefusals`.
- `.claude/skills/slice/judge.mjs` — `warrant ci --no-record` in its scratch worktree; `SKILL.md` says so.
- `.claude/skills/slice/change.md` and rule `process` (`.warrant/local/rules/process.json`, then `AGENTS.md` by
  `warrant sync`) — the spec rework before `APPROVED` by `warrant transition <change> PROPOSED`.
- A guarded worktree session shown: the guard denies a write outside the active Run's `write_scope` in this worktree
  and a write into the main checkout — the condition of #93.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the LATTICE product does not change; the CI judge, the toolchain and the project process do (`skip_specs: true`).

## Impact

- Maintainer's patch (profile `human-acceptance`): `.github/workflows/warrant.yml`, `.warrant/local/rules/process.json`,
  `.claude/skills/slice/{act-rules.mjs,act-rules.test.mjs,act.mjs,judge.mjs,SKILL.md,change.md}`.
- Written by `warrant sync`: `.warrant/warrant.lock.json`, `.warrant/schemas/waiver.1.schema.json`, `AGENTS.md`.
- `test/process/pin.test.ts` unchanged: its invariant (tag of the call and input `warrant` equal `v` + lock kernel)
  holds with both moved to `0.10.1`. No `src/`.
- The maintainer's machine: CLI `0.10.1` and a restart of this session (acts of the maintainer).
- Closes #140 and #93 (by the archive-PR).

## Non-goals

- The other S0 sessions' worktrees and their CLI: one machine, one global CLI — every session restarts on its own
  schedule (coordinator).
- Rewriting old waivers `WAV-YYYY-NNN`: they stay valid.
- Dropping `FRONTEND_HOOKS_INACTIVE` from the judge's informational set (#128): harmless if WARRANT no longer emits it.
- WARRANT `0.11` (`judge-law`, `code-floor`) — its own pin-Change.
