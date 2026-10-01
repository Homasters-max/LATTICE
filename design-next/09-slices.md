# 09. Slices

## Purpose

SL-Z01. Order of implementation and the transition from the v0.6 architecture. Every slice ends with numbers or an end-to-end check in CI, not with code.

## Transition

| ID | Rule |
|---|---|
| SL-T01 | Once this document is written, the maintainer freezes `design-next` with a tag (`design-next-v0.1`). The root `README.md` points to it; `design/` becomes history. This is a separate PR; the maintainer merges it. A change to `design-next` after a freeze goes through a PR and is closed by a new tag; the next tag `design-next-v0.2` comes after the normalization pass (LG-B04). |
| SL-T02 | Existing kernel code (`src/kernel/`: JCS canonical form, hash, ids, references; 60 tests) is not thrown away. The first Change of the new kernel goes module by module: what matches the new IDs (OM-H01…H02, OM-R01, …) stays and is re-bound to the new requirements; the rest is removed. TypeScript lessons of v0.6: branded `Id`, `Ref`, `Hash`; revisions read from the ledger are frozen (`Object.freeze`); one `Revision` structure, no class per type; no frameworks; one package until a second consumer appears. |
| SL-T03 | New OpenSpec specs are written from `design-next` slice by slice, each through a Change. Old requirements (`architecture`, `kernel`) are replaced in the Changes that touch their area. There is no one-shot rewrite: only WARRANT writes `openspec/specs`. Specs never become blocks: a requirement references the design IDs it implements with a line `Implements: <ID>, …` under it — plain text, never inside an id comment. |
| SL-T04 | One slice is one WARRANT Change (three PRs). A large slice is split into several Changes inside the slice (SL-T08, SL-T09), never mixed with the neighbouring slice. A slice is done when its end-to-end check passes in CI. |
| SL-T05 | After the freeze (SL-T01) the agent opens one GitHub issue per slice S0–S4: area `s0`…`s4`, label `enhancement`, priority `P1` for S0 and `P2` for the rest; the body references IDs from `design-next`. |
| SL-T06 | Every ID of `design-next` is bound to a test scenario (`SCN-…`) or to the slice that will bind it; a test `test/process/design-coverage` checks the binding, report-only until the switch (SL-T07) and failing after it. Every slice leaves a CLI command for the owner's manual acceptance (PL-E02). The demo is three real WARRANT tasks: the package an agent would get from `solve`, next to what the agent actually read. |
| SL-T07 | The **switch (SW)** — LATTICE on LATTICE — is the milestone between S0 and S1 at which the design moves into the ledger (SL-SW). It happens only when all of these hold: (1) the round trip of the normalized `design-next` is green in CI (SL-S0); (2) the kernel is frozen as version `1` (LG-G06): the schema subset (OM-T06) is shown to cover every `std` type that 03–08 name (OM-L02) — their schemas drafted, no code needed; (3) `upgrade` `std@1 → @2` passes in a test (LG-G02); (4) CI runs LG-P05 on every PR, with acts admitted through the `github` adapter (LG-A04); (5) the authoring path exists: the store command `draft` (PL-E02); (6) a rehearsal: one real design edit went through a proposal on a separate branch. Self-hosting continues in stages: after S1, when `solve` is `live` (SL-S1), the agent takes the context for its own Changes from `solve` instead of reading `md`. |
| SL-T08 | An **AREA** is a WARRANT area: one OpenSpec spec under `openspec/specs/` (an OpenSpec capability, not a capability of PL-C01) and the prefix of its `REQ-…` and `SCN-…` ids. An AREA has at most one active Change; a second Change in the same AREA waits for the archive of the first, so ids never collide and archive never silently overwrites a requirement. Files shared by several modules — the module matrix of the structure test (ST-S01), the CLI entry, `package.json`, the port interfaces — are owned by the walking skeleton (SL-T09); a later change to one of them is a separate small Change. At most three Changes are in implementation at once: the maintainer's acts are the bottleneck. |
| SL-T09 | A slice starts with a **walking skeleton**: one thin Change through every seam — command → check (apply with at least one rejection carrying a rule ID and its fixture, LG-A02) → store → projection (latest revision, LG-J01) → read (export reads through the projection, never the raw ledger). It creates every module folder of the slice, the full ST-M01 matrix in the structure test (ST-S01), every port interface of the slice and the CLI command table (PL-E02). Afterwards the slice grows per AREA in parallel Changes (SL-T08), never per layer. For S0 the skeleton runs a synthetic fixture `md` — one table with IDs — not the corpus; the corpus comes in the closing Change of the slice. |
| SL-T10 | After the switch (SL-T07) a Change that edits the design carries a proposal; `lattice apply` on the current `main` tail is the step before `warrant verify` in its impl-PR (LG-P03); if `main` moved, the branch syncs and the commit is rebuilt from the proposal. |

## Corpus

| ID | Rule |
|---|---|
| SL-K01 | The first corpus is LATTICE's own design: English, under our control, and we ask the questions about it ourselves. |
| SL-K02 | The WARRANT corpus comes second, through a source adapter (CT-M02), when importing another project must be tested. |
| SL-K03 | The first bench set: the agent drafts questions about the LATTICE design from real tasks (BN-S06), with expected IDs from `design-next`, Russian variants and `trap` / `blank` items (BN-S01); the maintainer's act on the drafted intents gives the items basis `asserted` (TR-B02, BN-S04). S1 starts with about 60 questions: a baseline `hit@k` needs no minimum per answer value. Before S3 the set grows to the size BN-M05 requires after the `tune` / `holdout` split — about 150 or more for a point with two answer values. |
| SL-K04 | The project namespace (CT-N05) is `lattice`. Owner: `Homasters-max` (human). `writers`: `Homasters-max` by name, and the agent account `homasters` by kind `agent`. The agent authors intents; acts come from the owner as PR comments (CT-A03, CT-A05). |

## Slices

| ID | Slice | Proves | Done when |
|---|---|---|---|
| SL-S0 | **Self-description round-trip** | object model, ledger, apply, codec (02, 03: LG-A01…A05, LG-B04…B07); bootstrap: genesis and `std` (LG-G01…G04), the project namespace (CT-N05), the basis table (TR-B02), the `live` fact (TR-F05) and the `setup` type (PL-A01) | the normalized `design-next/*.md` (LG-B04) → blocks → `md` is byte-identical, checked in CI |
| SL-SW | **Switch: LATTICE on LATTICE** | the design lives in the ledger | SL-T07 holds and `import-md` with the maintainer's act (LG-B07) is merged; from then on `md` is export only (LG-B02) |
| SL-S1 | **Solve without judge** | LENS candidates, expansion by edges, output (07); first bench set; the seams of recording: `solve` already runs through `lattice run` with `clock`, `ids` and `source` recorded on `fixture` adapters; the gate (DP-L06) on the S1 metrics | `solve` with BM25 + expansion on own design; baseline numbers `hit@k`, pool recall (BN-M02, BN-M03). Starting values from Jev measurements in v0.6: pool K = 20, output 5–20 blocks, acceptance "the expected block is in the output" ≥ 0.95; `solve` becomes `live` through the gate with these targets, the baseline of S2 |
| SL-S2 | **Decide in shadow** | decision pattern (01), recording with `fixture` / `recorded` adapters (PL-K01…K04), `judge-jev` adapter | a revision of `solve` with the point `lens-rank` in `shadow` against the `live` S1 pipeline (DP-L02); RU↔EN consistency measured (BN-M04) |
| SL-S3 | **First live point** | calibration, gates, owner act through CI (04, 08) | a pipeline that pins one calibrated point becomes `live` through the gate on `holdout` (DP-L06); the path "owner act → CI" works end to end |
| SL-S4 | **Foreign corpus** | source adapter, re-import (05 TR-S01…S02) | WARRANT corpus imported; second point "scenario coverage" in `shadow` |

SL-Z02. Out of these slices: everything in [11-later](11-later.md) — each item returns only when its trigger fires.
