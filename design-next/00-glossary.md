# 00. Glossary

## Purpose

One term — one definition. A term already defined by a rule points to that rule and is not restated. A term without a rule is defined here. A new term enters the design in the same change as its definition (README conventions).

## Terms defined by rules

| Term | Defined by |
|---|---|
| record, entity, event | OM-K01 |
| revision (`@n`) | OM-K01, OM-R01 |
| current revision | TR-I01 |
| referrers | OM-R05 |
| `supersedes`, successor | OM-I07 |
| type, meta-type, base type | OM-T01, OM-T04 |
| composition | OM-C01 |
| card | OM-A01…A03 |
| hint | OM-T04, TR-I02 |
| store | LG-S02, LG-S03 |
| commit | LG-C01, LG-C02 |
| proposal, intent | LG-P01, LG-P02 |
| apply | LG-A01 |
| projection | LG-J01 |
| evidence (a set of whole run records published as files) | LG-R02 |
| segment | LG-R05 |
| genesis | LG-G01 |
| `upgrade` | LG-G02 |
| md import | LG-B07 |
| namespace | CT-N01 |
| namespace policy, owner-act floor | CT-N03 |
| act | CT-A05 |
| owner act | CT-A01…A03 |
| participant, session | CT-P01, CT-P02 |
| basis | TR-B01, TR-B02 |
| fact, status fact | TR-F01, TR-F04 |
| in force | TR-I01 |
| verdict | TR-V02 |
| finding | TR-N01 |
| decision point, DecisionResult | 01 Model, DP-R06 |
| policy (of a point), policy operators, policy evaluation | DP-B03, 01 Policy operators |
| allowed set, pool | DP-M06 |
| `live` (status fact), authoritative (run), `shadow`, baseline | DP-L01, DP-L02 |
| gate | DP-L06 |
| calibration, applies to | DP-C01 |
| sure band, grey zone | DP-C02 |
| capability, effect | PL-C01, PL-C05 |
| stage outcome | PL-C07 |
| pipeline | PL-P01 |
| fallback, `escalate`, `refuse` | PL-P04 |
| `judge` (a port), `judge@n` | PL-C09 |
| run, run record, run outcome, input fingerprint, replay, re-run | PL-R01, PL-R02, DP-T02 |
| tape | PL-K01 |
| read view | PL-K05 |
| `setup`, `bindings` | PL-A01, PL-A02 |
| adapter block | PL-A05 |
| `service` (an adapter, not the `live` status fact) | PL-K02 |
| store commands, `cite`, `bench`, `draft` | PL-E02 |
| need | LN-N01 |
| trust evidence | TR-V01 |
| bench item, bench set, `trap`, `blank` | BN-S01, BN-S02 |
| `variants` | BN-S03 |
| `tune`, `holdout` | BN-S05 |
| report | BN-R02 |
| switch (SW) | SL-T07, SL-SW |
| AREA (a WARRANT area) | SL-T08 |
| walking skeleton | SL-T09 |

## Terms defined here

| ID | Term | Meaning |
|---|---|---|
| GL-01 | block, content block | A **block** is any entity. A **content block** is an entity of a knowledge-bearing type or a composition: the unit that LENS selects and `solve` gives out. Types, decision points, pipelines, capabilities, `judge` blocks and `setup` are blocks too, but they are behaviour, not content. |
| GL-02 | port | A named interface through which code reaches anything outside itself: the recorded ports `judge` (PL-C09), `llm`, `source`, `clock`, `ids` (PL-K01), and `store` (LG-S02), `acts` (LG-A04). |
| GL-03 | adapter | One implementation of a port. Kinds: `service` (the real service), `recorded`, `fixture` (PL-K02); `store` and `acts` have their own (LG-S02, LG-A04). |
| GL-04 | host | The program that opens a session and declares its participant and kind (CT-P01, CT-P03): the LATTICE CLI, or an agent tool such as Claude Code. |
| GL-05 | stage | One element of a pipeline: a capability `ref@n` with static params, `reads`, `writes` and `on` (PL-P01…P04). |
| GL-06 | run context | The named fields that flow between stages of one run (PL-P03). |
| GL-07 | execution tuple | What was executed: the code hashes of capabilities, `judge@n` with its pinned model and adapter code hash (PL-C09), the adapter blocks `setup` pins (PL-A05). Recorded in every run (PL-R01); the environment is recorded next to it, not in it. |
| GL-08 | scope | Where a need is searched: types and domains within project namespaces (LN-N01, LN-N03). Not an ownership boundary — that is a namespace (CT-N01). |
| GL-09 | domain | A composition that groups blocks for navigation and search (OM-C02); used in `scope`. It owns nothing. |
| GL-10 | consumer | An agent or a human who uses the output of `solve` or of a decision and reports back: a verdict on truth (TR-V02) or feedback on usefulness (TR-V10). |
| GL-11 | slice | An end-to-end scenario across several documents, done when its check passes in CI (09). |
| GL-12 | tail | The last commit of a ledger; `base` names the tail a commit was applied on (LG-C02, LG-C03). |
| GL-13 | semantic judgement | A choice, a score or a yes/no about candidates whose answer comes from a model (an LLM, Jev). Deterministic code — BM25, a regex, a schema check — is not a semantic judgement. Every semantic judgement goes through `decide()` (DP-B13). |
| GL-14 | kernel version, LATTICE version | A **kernel version** changes the header, the hash or the meta-type (OM-E01, OM-L04, LG-G03). A **LATTICE version** changes the rest of the code — `std` (LG-G02), the meaning of in force and of findings, the floors, the gate (LG-J05). A LATTICE version ships exactly one kernel version; a kernel version may stay the same across several LATTICE versions. |

## History

- 2026-10-01 — created from the design v0.6 audit, grilled.
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): block and content block (GL-01), `judge` as a recorded port (GL-02), execution tuple with adapter code hash (GL-07), tail (GL-12); pointers added for record, current revision, referrers, store, evidence, segment, genesis, `upgrade`, md import, namespace policy and the owner-act floor, act, policy of a point, baseline, gate, applies to, `judge@n`, run record, store commands, report; follow-up: semantic judgement (GL-13).
- 2026-10-01 — corrections F1–F6: pointer for `supersedes` and successor (OM-I07); evidence is whole run records (LG-R02).
- 2026-10-01 — deepening review (`reviews/2026-10-01-design-next-deepening.md`), grilled: pointers for policy evaluation, authoritative run, sure band and grey zone, effect, stage and run outcome, fallback, input fingerprint, read view, adapter block, `cite` and `bench`, trust evidence, `variants`, `tune` and `holdout`; adapter blocks in the execution tuple (GL-07); kernel and LATTICE versions (GL-14).
- 2026-10-01 — launch-readiness grilling (`reviews/2026-10-01-launch-readiness-grilled.md`): pointers for the switch (SL-T07), AREA (SL-T08), the walking skeleton (SL-T09) and the store command `draft` (PL-E02).
