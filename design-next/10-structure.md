# 10. Code structure and tests

## Purpose

How the code is split into modules and which tests keep the split honest. The rules of 02–08 say what the system does; this document says where the code for it may live and what it may import.

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

## History

- 2026-10-01 — created from the design v0.6 audit (T36), grilled.
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): module `policy` renamed `trust`; module `measure` for operators, metrics and the gate (D1); `codec` and `runtime` imports of `ledger`; judge prompts in `adapters` (D2); DP-B13 in ST-S01; who imports `codec` (ST-S02); `assembly` outside purity (ST-S03); `acts` contract tests (ST-T01).
- 2026-10-01 — deepening review (`reviews/2026-10-01-design-next-deepening.md`), grilled: `measure` holds policy evaluation and the target check (A1), the gate is a step of apply in `ledger` (A2), `cite` in `ledger` (A4), `capabilities` reads `ledger` through the read view only.
