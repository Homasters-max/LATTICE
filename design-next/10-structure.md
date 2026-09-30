# 10. Code structure and tests

## Purpose

How the code is split into modules and which tests keep the split honest. The rules of 02–08 say what the system does; this document says where the code for it may live and what it may import.

## Modules

| ID | Rule |
|---|---|
| ST-M01 | Modules and what each may import. The matrix is the starting point for the first kernel Change (SL-T02); a change to it is a design change. |

| Module | Holds | May import |
|---|---|---|
| `kernel` | envelope, canonical form and hash, meta-type, schema subset, references (OM-L04) | — |
| `policy` | catalog and trust as pure functions over records: basis, in force, findings (04, 05) | `kernel` |
| `ledger` | commits, apply, projections, the `store` and `acts` port interfaces (03) | `kernel`, `policy` |
| `codec` | `md` import and export (LG-B05) | `kernel` |
| `runtime` | pipelines, runs, recording, port interfaces (06) | `kernel`, `ledger` (read view, PL-K05) |
| `capabilities` | built-in capabilities, `decide` (01, 07) | `kernel`, `runtime` port interfaces |
| `adapters` | one module per adapter; vendor SDKs | the port interface it implements |
| `assembly` | builds the runtime from configuration (PL-A03) | everything above |
| `cli` | commands (PL-E02) | `assembly` |

## Structure tests

| ID | Rule |
|---|---|
| ST-S01 | A structure test checks the imports of `src/` against ST-M01: direction, no cycles, adapters never import each other, a vendor SDK only inside its adapter. |
| ST-S02 | Only `assembly` imports adapters. |
| ST-S03 | Purity holds for all code outside `adapters` and `cli` — apply, projections, codec, capabilities, not only capabilities (PL-C04): no I/O, clock, randomness or environment. |
| ST-K01 | Kernel perimeter: everything reachable from the kernel entry point is on an explicit list of files, and all of it is pure. A file added to the reach of the kernel without the list turns the test red. |

## Contract tests and fixtures

| ID | Rule |
|---|---|
| ST-T01 | One set of contract tests per port runs against every adapter of that port: `service`, `recorded`, `fixture` (PL-K02), and `store` adapters (LG-S02). A judge adapter's set includes exact coverage of the candidate set (DP-R05). |
| ST-T02 | Fixtures are keyed by meaning — the need and the ids of the candidates — never by a prompt hash, so a prompt edit does not invalidate every fixture. Deterministic adapters for tests: `clock-fixed`, `ids-counter`. |

## History

- 2026-10-01 — created from the design v0.6 audit (T36), grilled.
