# Proposal

## Why

Slice S0 (`design-next` SL-S0) is split into parallel Changes per AREA (SL-T08). Each of them needs the same seams to
exist first: the module folders of ST-M01, the structure test that keeps their imports honest, the port interfaces,
the CLI command table, and one working path from a command to the ledger and back. SL-T09 makes that path a **walking
skeleton**: one thin Change through every seam — command → apply (with a rejection carrying a rule ID and its fixture,
LG-A02) → store → projection (latest revision, LG-J01) → export reading through the projection. Without it the Changes
of wave 2 (#55–#60) would each invent their own seams and collide on the shared files (`package.json`, the module
matrix, the CLI entry, the port interfaces), which SL-T08 assigns to the skeleton. The launch grilling of 2026-10-01
(Q4, Q7, Q15, Q16, Q21, Q23) made this the first Change of S0 after `infra-baseline` (#28).

The spec `architecture` is still the Russian spec of design v0.6 (REQ-AR-001…004). Q16 decides that the skeleton
replaces it with the rules of `design-next` 10-structure.

## What Changes

- **Module folders of S0** under `src/`: `kernel` (kept), `trust`, `ledger`, `codec`, `adapters`, `assembly`, `cli`,
  plus `runtime` holding only the `clock` and `ids` port interfaces (design D-2).
- **Structure test** checks the full ST-M01 matrix: direction of imports between modules, adapters importing only the
  port interface they implement and never each other, packages and `node:` built-ins only where allowed (ST-S01,
  ST-S02), and the purity rules of the kernel extended to every module outside `adapters`, `assembly` and `cli`
  (ST-S03). A file under `src/` outside every module of the matrix is a violation.
- **Port interfaces** `store`, `acts` (in `ledger`), `clock`, `ids` (in `runtime`), with the adapters the skeleton
  needs: a minimal JSONL store, a system and a fixed clock, a ULID and a counter id source (ST-M02, ST-T02).
- **CLI** `lattice` with a command table, one file per command: `init`, `import-md`, `apply`, `export` (PL-E02).
- **The thin path**: `import-md` turns a synthetic `md` fixture — one table with IDs — into a proposal; `apply` turns
  it into a commit of a hash-chained JSONL ledger, or into rejections naming a rule ID (LG-P01, LG-P02, LG-C07), each rule with
  its fixture; `export` renders the `md` again from the latest-revision projection; the round trip gives the same
  bytes, checked in CI.
- **Spec `architecture` replaced**: REQ-AR-001…004 are removed and written anew in English against 10-structure as
  REQ-AR-005…008 (the behaviour of the kernel perimeter, tests inside `describe`, reachability and cycles is
  unchanged; their tests carry the new scenario tokens); new requirements REQ-AR-009…011 for the module matrix, purity
  of pure modules and the fixture per rejection rule.
- **New spec `cli`**: the command table, the four commands and the round trip.
- The existing kernel hash and JCS (`src/kernel/`) are used as they are.

## Capabilities

### New Capabilities

- `cli`: the `lattice` command and its table; the store commands `init`, `import-md`, `apply`, `export` of the
  skeleton; the round trip of the fixture `md`.

### Modified Capabilities

- `architecture`: REQ-AR-001…004 (Russian, design v0.6) removed and replaced by REQ-AR-005…008 in English, the project
  policy extended to the module matrix; new requirements REQ-AR-009…011 for the ST-M01 matrix (ST-S01, ST-S02),
  purity outside `adapters`, `assembly`, `cli` (ST-S03) and one fixture per rejection rule of apply (LG-A02).

## Impact

- New code: `src/{trust,ledger,codec,runtime,adapters,assembly,cli}/**`; tests `test/{ledger,codec,cli,e2e}/**`;
  fixtures `test/fixtures/{md,rules,structure/matrix}/**`.
- Changed: `test/architecture/{structure.ts,policy.ts,structure.test.ts}`.
- `package.json` (profile `human-acceptance`, a maintainer's patch): `bin` `lattice` and a script `lattice`. No new
  dependency.
- `src/kernel/**` and `test/kernel/**` are unchanged.
- The files SL-T08 assigns to the skeleton — the module matrix, the CLI entry and command table, `package.json`, the
  port interfaces — are created here; a later change of one is a separate small Change.

## Non-goals

- The real corpus: `design-next/*.md` is not imported; every `md` form other than one table with IDs is refused by the
  codec (s0-codec-forms #58, s0-roundtrip #61).
- Apply checks beyond LG-P01, LG-P02 and the duplicate `id` of LG-C07: tail and `seq` as an apply check (LG-C03), fact
  keys and the permutation test (LG-C07), uniqueness, pinned targets, no-op and re-apply (s0-apply-checks #56).
- The finer limits of ST-M01 on what `codec`, `runtime` and `capabilities` read of `ledger` (design I-3, #76).
- Store hardening: lock, fencing, `fsync`, `recovered/`, the memory adapter and the store contract tests (s0-store
  #57).
- Kernel changes: the envelope OM-E01…E04, `hash` over `type@n` (OM-H01), the schema subset, the meta-type (s0-kernel
  #55).
- Genesis, `std`, the namespace commit, basis, `live`, `setup`, adapters of `acts` (s0-bootstrap #59): `init` writes
  only the init configuration and an empty ledger.
- Referrers and the three-way rebuild test (s0-projections #60).
- The other commands of PL-E02 (`verify`, `draft`, `upgrade`, `cite`, `bench`, `run`, `replay`) and the `judge` rule of
  ST-S01 (DP-B13): S0 has no `capabilities` module and no `judge` port (ST-M02).
