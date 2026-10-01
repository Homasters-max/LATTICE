# 10. Code structure and tests

## Purpose

ST-Z01. How the code is split into modules, which tests keep the split honest, and how audits keep the architecture from degrading. The rules of 02–08 say what the system does; this document says where the code for it may live and what it may import.

## Modules

| ID | Rule |
|---|---|
| ST-M01 | Modules and what each may import; the matrix is the starting point for the first kernel Change (SL-T02), and a change to it is a design change: |

| Module | Holds | May import |
|---|---|---|
| `kernel` | envelope, canonical form and hash, meta-type, schema subset, references (OM-L04) | — |
| `trust` | namespace policy and trust rules as pure functions over records: basis, writers and owner acts, in force, findings (04, 05) | `kernel` |
| `measure` | policy evaluation: the closed set of operators with DP-M05 and DP-R01…R04 (01 Policy operators); bench metrics (BN-M01…M06); whether metrics meet targets, with the floors of BN-G05 (DP-L06) | `kernel` |
| `ledger` | commits, apply with its gate step (DP-L06) and report admission (BN-R04), projections, packaging of runs as evidence (`cite`, LG-R02), the `store` and `acts` port interfaces (03) | `kernel`, `trust`, `measure` |
| `codec` | md import and export (LG-B05) | `kernel`, `ledger` (proposal format, read view) |
| `runtime` | pipelines, runs, recording, port interfaces (06) | `kernel`, `ledger` (read view, PL-K05; append of a `runtime` commit, LG-R05; tape lookup, PL-K03) |
| `capabilities` | built-in capabilities, `decide` (01, 07) | `kernel`, `runtime` port interfaces, `measure`, `ledger` (read view only, PL-K05) |
| `adapters` | one module per adapter; vendor SDKs; the prompts of `judge` adapters (PL-C09) | the port interface it implements |
| `assembly` | builds the runtime from configuration (PL-A03) | everything above |
| `cli` | commands (PL-E02) | `assembly` |

| ID | Rule |
|---|---|
| ST-M02 | No new module, layer or port without a second real adapter or a named invariant (a rule ID) that needs it; a hypothetical seam is a defect. This generalises NX-24. The ports of S0 satisfy it: `store` (JSONL, memory; LG-S02), `acts` (`init`, `fixture`, `recorded`, `github`; LG-A04), `clock` and `ids` (`service` and a fixed one, ST-T02). |
| ST-M03 | Records are frozen plain data plus pure functions; there is no class per record type (SL-T02). DDD vocabulary — aggregate, value object, domain event, application service, application layer — is not used in code or documents: `entity` and `event` mean only what OM-K01 says, and ST-M01 is the only module split (domain ≈ the pure modules of ST-S03, infrastructure ≈ `adapters`, orchestration ≈ `assembly` and `cli`). |

## Structure tests

| ID | Rule |
|---|---|
| ST-S01 | A structure test checks the imports of `src/` against ST-M01: direction, no cycles, adapters never import each other, a vendor SDK only inside its adapter, only `decide` imports the `judge` port (DP-B13). |
| ST-S02 | Only `assembly` imports adapters. Only `assembly` and `cli` import `codec`; CI reaches it through `cli` (LG-P05). |
| ST-S03 | Purity holds for all code outside `adapters`, `assembly` and `cli` — apply, projections, codec, `measure`, capabilities, not only capabilities (PL-C04): no I/O, clock, randomness or environment. `assembly` is the composition root: it reads configuration and `$env` (PL-A02, PL-A03). |
| ST-K01 | Kernel perimeter: everything reachable from the kernel entry point is on an explicit list of files, and all of it is pure. A file added to the reach of the kernel without the list turns the test red. |

## Contract tests and fixtures

| ID | Rule |
|---|---|
| ST-T01 | One set of contract tests per port runs against every adapter of that port: `service`, `recorded`, `fixture` (PL-K02), `store` adapters (LG-S02) and `acts` adapters (LG-A04). A judge adapter's set includes exact coverage of the candidate set (DP-R05). |
| ST-T02 | Fixtures are keyed by meaning — the need and the ids of the candidates — never by a prompt hash, so a prompt edit does not invalidate every fixture. Deterministic adapters for tests: `clock-fixed`, `ids-counter`. |

## Architecture audit

| ID | Rule |
|---|---|
| ST-A01 | Four levels keep the architecture from degrading: (1) fitness tests on every PR in CI — the structure test (ST-S01…S03, ST-K01), the type check, design coverage (SL-T06), a fixture per rule ID (LG-A02); (2) an implementation review on every impl-PR before `VERIFYING` — Standards and Spec against the design, in the deep-module vocabulary; a finding inside the Change is fixed there, one outside it becomes an issue; (3) an **architecture audit** of the whole `src/` against `design-next` at the end of every wave and on a trigger (ST-A02), written to `reviews/` and grilled; (4) refactor Changes after an audit (ST-A04). There is no audit after every Change: on a half-built slice it is noise, and its refactor would touch AREAs other Changes hold (SL-T08). |
| ST-A02 | Triggers of an audit outside the end of a wave: a change of a file owned by the skeleton (SL-T08, SL-T09), a new module or port (ST-M02), a Change touching three modules or more, and the switch (SL-T07) — the kernel freezes as version `1` after it (LG-G06), so an audit precedes it. |
| ST-A03 | **Ratchet**: every accepted audit finding that can be checked mechanically becomes a fitness test of level (1) of ST-A01, so it cannot regress; the others become a rule with an ID in `design-next`. Findings are triaged by strength: `Strong` → a refactor Change of the next wave, `Worth exploring` → an issue `P2`, `Speculative` → an issue `P3` or 11-later. |
| ST-A04 | A refactor Change changes no behaviour (`skip_specs`, or a MODIFIED requirement whose scenarios stay), keeps the tests green before and after, and holds its AREA like any Change (SL-T08); it is never mixed into a feature Change. |
