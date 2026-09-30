# 09. Slices

## Purpose

Order of implementation and the transition from the v0.6 architecture. Every slice ends with numbers or an end-to-end check in CI, not with code.

## Transition

| ID | Rule |
|---|---|
| SL-T01 | Once this document is written, the maintainer freezes `design-next` with a tag (`design-next-v0.1`). The root `README.md` points to it; `design/` becomes history. This is a separate PR; the maintainer merges it. |
| SL-T02 | Existing kernel code (`src/kernel/`: JCS canonical form, hash, ids, references; 60 tests) is not thrown away. The first Change of the new kernel goes module by module: what matches the new IDs (OM-H01…H02, OM-R01, …) stays and is re-bound to the new requirements; the rest is removed. TypeScript lessons of v0.6: branded `Id`, `Ref`, `Hash`; revisions read from the ledger are frozen (`Object.freeze`); one `Revision` structure, no class per type; no frameworks; one package until a second consumer appears. |
| SL-T03 | New OpenSpec specs are written from `design-next` slice by slice, each through a Change. Old requirements (`architecture`, `kernel`) are replaced in the Changes that touch their area. There is no one-shot rewrite: only WARRANT writes `openspec/specs`. |
| SL-T04 | One slice is one WARRANT Change (three PRs). A large slice is split into several Changes inside the slice, never mixed with the neighbouring slice. A slice is done when its end-to-end check passes in CI. |
| SL-T05 | After the freeze (SL-T01) the agent opens one GitHub issue per slice S0–S4: area `s0`…`s4`, label `enhancement`, priority `P1` for S0 and `P2` for the rest; the body references IDs from `design-next`. |
| SL-T06 | Every ID of `design-next` is bound to a test scenario (`SCN-…`) or to the slice that will bind it. Every slice leaves a CLI command for the owner's manual acceptance (PL-E02). The demo is three real WARRANT tasks: the package an agent would get from `solve`, next to what the agent actually read. |

## Corpus

| ID | Rule |
|---|---|
| SL-K01 | The first corpus is LATTICE's own design: English, under our control, and we ask the questions about it ourselves. |
| SL-K02 | The WARRANT corpus comes second, through a source adapter (CT-M02), when importing another project must be tested. |
| SL-K03 | The first bench set: the agent drafts questions about the LATTICE design from real tasks (BN-S06), with expected IDs from `design-next`, Russian variants and `trap` / `blank` items (BN-S01); the maintainer's owner act on the drafted intents gives the items basis `asserted` (TR-I04, BN-S04). S1 starts with about 60 questions: a baseline `hit@k` needs no minimum per answer value. Before S3 the set grows to the size BN-M05 requires after the `tune` / `holdout` split — about 150 or more for a point with two answer values. |

## Slices

| ID | Slice | Proves | Done when |
|---|---|---|---|
| SL-S0 | **Self-description round-trip** | object model, ledger, apply, codec (02, 03: LG-A01…A05, LG-B04…B07) | the normalized `design-next/*.md` (LG-B04) → blocks → `md` is byte-identical, checked in CI; from then on `md` is export only (LG-B02) |
| SL-S1 | **Solve without judge** | LENS candidates, expansion by edges, output (07); first bench set; the seams of recording: `solve` already runs through `lattice run` with `clock`, `ids` and `source` recorded on `fixture` adapters | `solve` with BM25 + expansion on own design; baseline numbers `hit@k`, pool recall (BN-M02, BN-M03). Starting values from Jev measurements in v0.6: pool K = 20, output 5–20 blocks, acceptance "the expected block is in the output" ≥ 0.95 |
| SL-S2 | **Decide in shadow** | decision pattern (01), recording with `fixture` / `recorded` adapters (PL-K01…K04), `judge-jev` adapter | point `lens-rank` in `shadow` against the S1 baseline; RU↔EN consistency measured (BN-M04) |
| SL-S3 | **First live point** | calibration, gates, owner act through CI (04, 08) | one point in `live` after calibration on `holdout`; the path "owner act → CI" works end to end |
| SL-S4 | **Foreign corpus** | source adapter, re-import (05 TR-S01…S02) | WARRANT corpus imported; second point "scenario coverage" in `shadow` |

Out of these slices: everything in [11-later](11-later.md) — each item returns only when its trigger fires.

## History

- 2026-09-30 — grilled (9 questions).
- 2026-10-01 — unified-architecture review, grilled: S0 proves apply and the codec on normalized `md` (SL-S0), S2 proves recording (SL-S2), bench items by owner act (SL-K03).
- 2026-10-01 — design v0.6 audit, grilled: TypeScript lessons (SL-T02), IDs bound to tests and manual acceptance (SL-T06), bench set sized by BN-M05 and written from real tasks (SL-K03), recording seams and starting values in S1 (SL-S1), deferred items moved to 11-later.
