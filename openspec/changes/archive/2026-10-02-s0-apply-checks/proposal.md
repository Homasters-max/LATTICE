# Proposal

## Why

The walking skeleton (`s0-skeleton`, #54) left apply with three rules: the proposal form (LG-P01), the expected
revision (LG-P02) and an `id` named twice (part of LG-C07). It writes a commit or rejects; it has no `no-op` (LG-C05),
does not recognise a proposal it already applied (LG-C08), refuses a moved tail as an environment error rather than a
rejection with a rule ID (LG-C03, LG-A02), and nothing proves that the result does not depend on the order of the
intents (LG-C07). Slice S0 proves apply (SL-S0: LG-A01…A05); issue #56 is the Change of the ledger AREA that grows
these checks (launch grilling 2026-10-01, Q4).

The checks that read data of a type or of a fact type — uniqueness (OM-D01, OM-D03), pinned targets (OM-R03), one
intent per fact key (LG-C07) and the fact no-op (TR-F07) — need types in the ledger, which come with `s0-kernel` (#55)
and `s0-bootstrap` (#59). By the maintainer's decision of 2026-10-02 they move to #82 (`s0-apply-typed-checks`).

The semantics of apply live today in REQ-CL-004 of the spec `cli`, next to the command that runs it. The ledger is its
own capability (AREA `LG`, SL-T08); every later Change that adds an apply check (#82) would otherwise have to hold
`CL`. This Change moves them into a new spec `ledger`.

## What Changes

- **New spec `ledger`**: the proposal form and its `LG-P01` rejections, the proposal hash and the canonical order
  (moved from REQ-CL-004); the rejection shape of LG-A02 and the closed rule list `LG-C03`, `LG-C07`, `LG-P01`,
  `LG-P02`; the outcomes of apply — `commit`, `no-op` (LG-C05, OM-H03), `existing` (LG-C08) — and the commit form
  (moved from REQ-CL-004), a commit holding only the intents that are not no-ops; the tail check (LG-C03);
  permutation invariance with its test (LG-C07).
- **One intent per entity `id` (LG-C07)**: a duplicate rejection also names the `id` it collided with (`with`) and
  the paths where the intents naming that `id` differ (`differs`, LG-A02).
- **No-op (LG-C05, OM-H03)**: an entity intent whose `base` is the latest revision of its `id` and whose type and
  record hash equal that revision writes no record; when every intent but the session event is a no-op, apply answers
  `no-op` and writes nothing. A commit holds only the intents that are not no-ops, and its `proposal` is their hash.
- **Re-apply (LG-C08)**: a proposal whose held intents hash to the `proposal` of a commit answers that commit and
  writes nothing.
- **Tail (LG-C03)**: a commit whose `base` and `prev` are not the tail of the ledger when it is appended is rejected
  with rule `LG-C03` instead of being refused with code 2 — unless the ledger already holds a commit of the same held
  intents, which is answered as `existing` (LG-C08).
- **`cli`**: REQ-CL-004, renamed "apply turns a proposal into a commit, a no-op or rejections", keeps the command —
  the proposal file, opening the ledger (LG-C04), what it writes, prints and removes on each outcome; REQ-CL-001 moves
  LG-C03 from the code-2 refusals to the rejections of code 1.
- **`architecture`**: REQ-AR-011 no longer enumerates the rule IDs — it refers to the list of REQ-LG-002 — and gains
  an optional `moved.jsonl` in a rule fixture for LG-C03.

## Capabilities

### New Capabilities

- `ledger`: proposals, the checks and rejections of apply, its outcomes, the commit form, the tail check and
  permutation invariance.

### Modified Capabilities

- `cli`: REQ-CL-001 (exit codes: LG-C03 is a rejection) and REQ-CL-004, renamed (the command `apply` and its output
  on every outcome; its semantics move to `ledger`).
- `architecture`: REQ-AR-011 (the rule list is the one of REQ-LG-002; `moved.jsonl` for LG-C03).

## Impact

- Code: `src/ledger/{apply,rules,commit,index}.ts`, a new `src/ledger/differs.ts`; the `apply` path of
  `src/assembly/index.ts`.
- Tests: new `test/ledger/{apply,permutation}.test.ts`; changed `test/architecture/rules.test.ts`,
  `test/cli/apply.test.ts`; fixtures `test/fixtures/rules/LG-C07/expected.json` (new fields) and a new
  `test/fixtures/rules/LG-C03/`.
- No shared file of the skeleton (module matrix, CLI entry and table, `package.json`, port interfaces) changes; the
  `store` port keeps its `moved` answer.
- Held AREAs: `LG`, `AR`, `CL` (comment on umbrella #44).

## Non-goals

- Uniqueness OM-D01 / OM-D03, pinned targets OM-R03, fact keys of LG-C07, the fact no-op TR-F07 (#82).
- Store hardening — lock, fencing, `fsync`, `recovered/` (LG-C06), the memory adapter (s0-store #57); opening the
  ledger (LG-C04) is unchanged.
- The record hash over `type@n` (OM-H01, s0-kernel #55): the no-op compares the type and the existing record hash.
- Writers, owner acts, basis, the gate of a `live` pipeline, secrets (LG-A03 rows of #59 and later slices).
- A retry inside `lattice apply` after LG-C03: the caller runs it again (LG-C03).
