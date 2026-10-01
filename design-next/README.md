# LATTICE — architecture from scratch (design-next)

Status: **frozen**, tag `design-next-v0.1` (SL-T01); edited after the tag through PRs (#52 and later), and the next tag `design-next-v0.2` follows the normalization pass (LG-B04). A clean-slate redesign of LATTICE and the source of requirements: OpenSpec specs are written from it slice by slice (SL-T03); the norm is `openspec/specs/`.

## Relation to `design/`

- `design/` (v0.6, tag `design-v0.6`) is history, not norm: this folder replaced it at the freeze (SL-T01).
- Nothing is inherited implicitly. An idea from `design/` enters here only when it is restated here; a reference like `design/…` is history, not norm.

## Language

- Documents, invariants, decisions, criteria — **English**. Rationale: these texts are meant to become LATTICE blocks, and `judge` reads block text; non-English accuracy of the judge is not measured.
- Discussion with the maintainer happens in Russian, outside these files.

## Conventions

- **One statement — one ID.** Every boundary, invariant, decision gets an ID (`DP-B01`, …). Other text references the ID and never restates it: a document is a composition of references, not a second copy of knowledge.
- **Docs are a future projection.** The target is: LATTICE blocks are the source of truth, these files are an export. Write each item so it can become a block unchanged: self-contained, one idea, explicit references.
- **One term — one definition.** A term is defined by exactly one ID ([00-glossary](00-glossary.md) lists where); a new term enters in the same change as its definition.
- **Deferred is explicit.** What is not designed yet lives in [11-later](11-later.md) with its trigger; what is never taken lives there too, with the reason.
- Every open question carries a recommendation.
- Machine formats — JSON.

## What v1 proves

v1 proves that semantic judgement can drive program logic while staying deterministic, replayable and measured: LATTICE describes itself as blocks (S0), moves its own design into the ledger (SW, SL-T07), finds the blocks a task needs (S1), decides with a judge in `shadow` (S2), lets one calibrated decision drive execution (S3), and takes in a foreign corpus (S4).

v1 does not do: blocks written by an LLM as knowledge (TR-I02), automatic migration (OM-T05), automatic merge (LG-C03, LG-P03), numeric trust (LT-18).

## Contents

| File | What |
|---|---|
| [00-glossary](00-glossary.md) | where each term is defined; terms without a rule |
| [01-decision-pattern](01-decision-pattern.md) | one execution pattern for every semantic decision: candidates → judge → policy → result |
| [02-object-model](02-object-model.md) | entity and event, identity, envelope, hash, references, types, compositions, cards |
| [03-ledger](03-ledger.md) | append-only ledger, commits, proposals in the git workflow, apply, projections, runtime store, bootstrap and codec |
| [04-catalog](04-catalog.md) | namespaces, owners, participants and sessions, owner acts, several projects |
| [05-trust](05-trust.md) | bases, facts, status facts, "in force", verdicts, sources, findings |
| [06-pipeline](06-pipeline.md) | capabilities pinned to code, stage outcomes, linear pipelines with `on` actions, runs, recording of ports, ports and assembly, entry point |
| [07-lens](07-lens.md) | need, candidates, expansion by edges, output with trust evidence, budget |
| [08-bench](08-bench.md) | bench sets, tune/holdout, metrics and baselines, targets and gates, where it runs |
| [09-slices](09-slices.md) | transition from v0.6, the switch SW, walking skeleton and parallel Changes, first corpus, slices S0–S4 |
| [10-structure](10-structure.md) | modules and what they may import, structure and contract tests, architecture audit |
| [11-later](11-later.md) | deferred items with their triggers; ideas never taken, with the reason |

Reviews — input for decisions, not norm:

| File | What |
|---|---|
| [reviews/2026-10-01-launch-readiness-grilled](reviews/2026-10-01-launch-readiness-grilled.md) | readiness to start S0, grilled on 2026-10-01 (Q1–Q34; Q25–Q28 on tracking the work are process, not design) and applied to 00, 03, 06, 09–11: the switch SW between S0 and S1 with its trigger (SL-T07), the store disposable before SW (LG-G05), authoring with `draft` (PL-E02), paths and versions (LG-S05, LG-G06), prose IDs with letter `Z` (LG-B06), the project namespace (SL-K04), one active Change per AREA and the walking skeleton (SL-T08, SL-T09), design edits inside a Change (SL-T10), development discipline (ST-M02, ST-M03), architecture audit and ratchet (ST-A01…A04); `import-md --diff` not taken (NX-26) |
| [reviews/2026-10-01-design-next-deepening](reviews/2026-10-01-design-next-deepening.md) | design-next after the freeze, by improve-codebase-architecture: six deepening candidates (A1–A6) and 21 text findings; grilled on 2026-10-01 ([decisions](reviews/2026-10-01-design-next-deepening-grilled.md)) and applied to 00–10 — bench as the store command `bench` with `cite`, basis by the pipeline revision, policy evaluation in `measure`, authoritative run, gate as a step of apply, adapter blocks; A2 (gate in `trust`) not taken |
| [reviews/2026-10-01-design-next-final-review](reviews/2026-10-01-design-next-final-review.md) | design-next before the freeze: 17 text fixes (R01–R17), four deepening candidates (D1–D4); grilled (24 questions) and applied on 2026-10-01 — all taken; D3 reopens U1 and DP-L01 (`live` only for pipelines and `setup`), D4 reopens G10 (basis only through an act); deferred parts into 11-later as LT-22…LT-25; follow-up: semantic judgement (GL-13), `llm` never branches (PL-C07), judge answers evaluations only (PL-C09), `binary` in DP-D01, admission of operators, acts by an agent as a v1 assumption (CT-A05), ideas not proposed as NX-21…NX-25 |
| [reviews/2026-10-01-design-v06-audit](reviews/2026-10-01-design-v06-audit.md) | old `design/` v0.6 against design-next: 24 gaps (G), 37 items to take (T), 24 later with a trigger (L), 20 groups not to take (X); grilled and applied on 2026-10-01 — G and T into 00–10, L into 11-later (L06, L15, L17, L21–L24 taken at once), X into 11-later as not taken |
| [reviews/2026-10-01-unified-architecture](reviews/2026-10-01-unified-architecture.md) | design-next against itself: one path per question, six candidates U1–U6; grilled and applied to 01–09 on 2026-10-01 |
| [reviews/2026-09-30-kernel-architecture](reviews/2026-09-30-kernel-architecture.md) | existing `src/kernel` against design-next: five deepening candidates; input for the first kernel Change (SL-T02) |
| [reviews/archive/](reviews/archive/) | superseded reviews |
