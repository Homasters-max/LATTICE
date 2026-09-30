# 00. Glossary

## Purpose

One term — one definition. A term already defined by a rule points to that rule and is not restated. A term without a rule is defined here. A new term enters the design in the same change as its definition (README conventions).

## Terms defined by rules

| Term | Defined by |
|---|---|
| entity, event | OM-K01 |
| revision (`@n`) | OM-K01, OM-R01 |
| type, meta-type, base type | OM-T01, OM-T04 |
| composition | OM-C01 |
| card | OM-A01…A03 |
| hint | OM-T04, TR-I02 |
| commit | LG-C01, LG-C02 |
| proposal, intent | LG-P01, LG-P02 |
| apply | LG-A01 |
| projection | LG-J01 |
| namespace | CT-N01 |
| owner act | CT-A01…A03 |
| participant, session | CT-P01, CT-P02 |
| basis | TR-B01, TR-B02 |
| fact, status fact | TR-F01, TR-F04 |
| in force | TR-I01 |
| verdict | TR-V02 |
| finding | TR-N01 |
| decision point, DecisionResult | 01 Model, DP-R06 |
| allowed set, pool | DP-M06 |
| `live` (status fact), `shadow` | DP-L01, DP-L02 |
| calibration | DP-C01 |
| capability | PL-C01 |
| pipeline | PL-P01 |
| run, replay, re-run | PL-R01, PL-R02, DP-T02 |
| tape | PL-K01 |
| `setup`, `bindings` | PL-A01, PL-A02 |
| `service` (an adapter, not the `live` status fact) | PL-K02 |
| need | LN-N01 |
| bench item, bench set, `trap`, `blank` | BN-S01, BN-S02 |

## Terms defined here

| ID | Term | Meaning |
|---|---|---|
| GL-01 | block | An entity of a knowledge-bearing type or a composition: the unit that LENS selects and `solve` gives out. Types, decision points, pipelines and capabilities are entities too, but they are behaviour, not content. |
| GL-02 | port | A named interface through which code reaches anything outside itself: `judge`, `llm`, `source`, `clock`, `ids` (PL-K01), `store` (LG-S02), `acts` (LG-A04). |
| GL-03 | adapter | One implementation of a port. Kinds: `service` (the real service), `recorded`, `fixture` (PL-K02); `store` and `acts` have their own (LG-S02, LG-A04). |
| GL-04 | host | The program that opens a session and declares its participant and kind (CT-P01, CT-P03): the LATTICE CLI, or an agent tool such as Claude Code. |
| GL-05 | stage | One element of a pipeline: a capability `ref@n` with static params, `reads`, `writes` and `on` (PL-P01…P04). |
| GL-06 | run context | The named fields that flow between stages of one run (PL-P03). |
| GL-07 | execution tuple | What was executed: the code hashes of capabilities, `judge@n` with its pinned model (PL-C09), adapters. Recorded in every run (PL-R01); the environment is recorded next to it, not in it. |
| GL-08 | scope | Where a need is searched: types and domains within project namespaces (LN-N01, LN-N03). Not an ownership boundary — that is a namespace (CT-N01). |
| GL-09 | domain | A composition that groups blocks for navigation and search (OM-C02); used in `scope`. It owns nothing. |
| GL-10 | consumer | An agent or a human who uses the output of `solve` or of a decision and reports back: a verdict on truth (TR-V02) or feedback on usefulness (TR-V10). |
| GL-11 | slice | An end-to-end scenario across several documents, done when its check passes in CI (09). |

## History

- 2026-10-01 — created from the design v0.6 audit, grilled.
