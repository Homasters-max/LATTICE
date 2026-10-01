# 05. Trust

## Purpose

What to believe and how much: bases of records, facts, status facts, "what is in force", verdicts, findings. Trust is computed, never assigned.

## Bases

| ID | Rule |
|---|---|
| TR-B01 | Four bases — categories, not a scale: `asserted` (a human's statement), `derived` (deterministic transformation of a source, `machine`), `observed` (result of a deterministic check or measurement: tests, schema, bench), `inferred` (output of an agent, LLM or judge). |
| TR-B02 | The basis of a record in `knowledge` is computed by apply (LG-A03) from its session and the act on its intent (CT-A05), by this table only; rows are read top to bottom and the first that matches applies. Only an act lifts a record above `inferred`: the declared participant kind (CT-P03) and the purpose choose which basis an act gives, never whether one is given. Session `purpose` is one of `init` (store init and `upgrade`, LG-G02), `work`, `import`, `check`, `bench`. Row 2 reads the pipeline revision in `knowledge` (CT-P01), never the tape, so apply decides it in CI; a run whose judge answers all came from memo is `inferred` too. The table: |

| Session (CT-P01) | Act on the intent (CT-A05) | Basis |
|---|---|---|
| any | none | `inferred` |
| `machine`: the session of a run whose `pipeline@n` (CT-P01) has a `decide` stage, or a stage or fallback with the `calls-llm` effect (PL-C05) | any | `inferred` |
| `human` or `agent` | yes | `asserted` |
| `machine`, purpose `check` or `bench` | yes | `observed` |
| `machine`, purpose `init`, `work` or `import` | yes | `derived` |

| ID | Rule |
|---|---|
| TR-B03 | Bases are not compared as greater or smaller. A type declares its `in_force` bases (TR-I01). A basis outside that list never rejects a write; it keeps the record out of force. |

## Facts

| ID | Rule |
|---|---|
| TR-F01 | A fact is an event `{of: {role: ref@n}, key, value}`. The fact type declares which fields make up `key`. |
| TR-F02 | The current value is the latest event by `seq` with that key among those in force. A cancellation is a new event with the same key and an explicit `revoked: true` instead of a value — never `value: false`, which is an ordinary value. There is no separate deletion (OM-K03). |
| TR-F03 | If the value for a key is overwritten by a different participant, a finding "overridden" is raised for the owner. Another participant's statement never disappears silently; the previous value stays in history. |
| TR-F07 | Writing a fact whose value equals the current value for its key (TR-F02) is a no-op, the counterpart of OM-H03 for events. |

## Status facts

| ID | Rule |
|---|---|
| TR-F04 | Every statement that something is in use, replaced, promoted, accepted, voted on or dismissed is a status fact (TR-F01, TR-F02). There is no other mechanism for it. The status fact types form a closed set in `std` (TR-F05); a new one comes only with a LATTICE version. Lineage of a replacement (`supersedes`, OM-I07) is a reference, not a status. |
| TR-F05 | Status fact types and their keys: |

| Type | Key | Value |
|---|---|---|
| `retired` | entity `id` | — (the entity is out of use; revoking it returns the entity to use) |
| `alias` | entity `id` of the alias | the canonical entity `id` (OM-D02, OM-R06): both in one namespace; the canonical entity is in use and is not an alias itself, so aliases form a star, never a chain |
| `live` | entity `id` (pipeline, `setup`; DP-L01) | the revision whose results drive execution; at most one per `id` |
| `calibration` | decision point `id`, hash of `question`, `judge@n`, bench set `set@n` (DP-C01) | a reference to the `holdout` report (BN-R02) |
| `verdict` | participant, subject `ref@n` | for / against (TR-V02) |
| `dismissed` | finding rule ID, subject `ref@n` | — (TR-N04) |

| ID | Rule |
|---|---|
| TR-F06 | Every status fact type except `verdict` is written and revoked only by an owner act: they are in the owner-act floor (CT-N03). A `verdict` is written and revoked only by its own participant, directly or cited from `runtime` with that participant as `origin` (TR-V09). A write to the same key by another participant raises "overridden" (TR-F03). |

## In force

| ID | Rule |
|---|---|
| TR-I01 | `inForce(record)` is a pure function over the ledger. A fact or an entity revision is in force iff: (1) its basis is in the type's `in_force` list; (2) an owner act exists if the namespace policy in effect at the record's `seq` requires one (CT-N03, CT-N06); (3) among the records that meet (1) and (2) it is the latest by `seq` for its key (a fact: the current value, TR-F02) or for its `id` (an entity: the **current revision**). Nothing else — no scores, no heuristics, no records from `runtime` (LG-R04). |
| TR-I02 | `inferred` facts can be in force only for types extending the base type `hint` (OM-T04); a candidate is a role that extends `hint`. Knowledge-bearing types list only `asserted`, `derived`, `observed` in `in_force`. This turns DP-B02 ("judge never writes knowledge") into a schema check. |
| TR-I03 | An LLM summary is a separate hint fact; it never enters a block body. |
| TR-I04 | Promotion follows from TR-B02: an act on an intent authored by an `agent` session is human authorship, and the record gets basis `asserted`; the act in the commit (LG-A05) and `by` show the draft and who approved it. Knowledge written from a hint carries a `draft` reference to that hint. The basis of a draft itself never changes. |

## Verdicts

| ID | Rule |
|---|---|
| TR-V01 | In v1 there is no numeric trust score. Trust is: basis, "in force", and verdict counts for / against shown as trust evidence. A numeric score is introduced only when the bench shows it helps (LT-18). |
| TR-V02 | A verdict is a `verdict` status fact (TR-F05), so one participant has one vote per subject and a later verdict replaces the earlier one (TR-F02). Verdicts by `agent`, LLM or judge carry zero votes (DP-C04). |
| TR-V03 | Verdicts from sessions with `purpose: bench` go to calibration, not to block trust: the bench measures the system and does not confirm blocks. |
| TR-V04 | Verdicts attach to `ref@n` and never move to a new revision: a new revision starts at zero. Counts of earlier revisions are shown as history ("previous revision: +5 / −1"). Otherwise an edit silently inherits someone else's approval. |
| TR-V05 | Counts are shown separately per basis and never summed ("checks +1, people −1"). No basis outranks another in general. |
| TR-V06 | Counts are used in two places only: as trust evidence in `explain` (humans, LLM), and as findings (TR-N01) for the owner when a threshold on any basis is crossed. The threshold is a constant of the LATTICE version (LG-J05) — 3 votes against in v1 — never data of a block or namespace policy. The owner decides — fix or `retired`. Counts never change anything automatically. |
| TR-V08 | Trust does not decay with time. Judge scores and the number of calls are never evidence of truth. |
| TR-V09 | A verdict that reaches `knowledge` from `runtime` by citation (LG-R04) keeps its original participant as `origin`; it is never rewritten to the author of the proposal. |
| TR-V10 | A consumer's feedback on whether `solve` output was useful is not a verdict on truth: a block needed in 40% of tasks is not disputed in the other 60%. Such feedback goes to the bench (BN-S04) and to output metrics (BN-M02), never to the verdict counts. |

## Sources

| ID | Rule |
|---|---|
| TR-S01 | Re-import from a source writes only what changed; a changed item is a new revision, and its verdict count starts at zero (TR-V04). |
| TR-S02 | An item no longer present in the source raises a finding `missing`; the import never retires a block. `retired` is the owner's act (TR-F06). |
| TR-S03 | The state of an external source cannot be recomputed from the ledger, so import writes the listing of the source it saw as a fact with basis `observed`. `missing` (TR-S02) is computed from the latest listing, which keeps findings a projection (TR-N01). |

## Findings

| ID | Rule |
|---|---|
| TR-N01 | A finding is a signal for an owner. Findings are a projection over the `knowledge` ledger (LG-J01), never stored; a rebuild yields the same findings. |
| TR-N02 | Every finding is raised by a registered check named by the ID of its rule: OM-R04 (reference to retired), TR-F03 (overridden), TR-S02 (missing), TR-V06 (vote threshold), BN-G03 (regression), DP-L02 (shadow disagreement), DP-S03 (report of an uncalibrated `binary` point), DP-C06 (stale calibration). A finding without a rule ID does not exist. |
| TR-N03 | Signals born in `runtime` (DP-L02, DP-S03) become findings only after they are cited in `knowledge` (LG-R04). A shadow disagreement has basis `observed`: the store command `cite` packages the `live` and `shadow` runs in a `machine` session with purpose `check` (PL-E02), and code compares the `shadow` revision with its baseline (DP-L02). A report of an uncalibrated point is a hint written by its own run, whose pipeline has a `decide` stage, so its basis is `inferred` (TR-B02, TR-I02). |
| TR-N04 | A finding closes when its cause disappears, or by a `dismissed` fact keyed by rule ID and subject `ref@n` (TR-F05). A new revision of the subject raises it again. |

## History

- 2026-09-30 — grilled (12 questions).
- 2026-10-01 — unified-architecture review (`reviews/2026-10-01-unified-architecture.md`), grilled (41 questions): status facts TR-F04…F06, explicit revocation in TR-F02, one basis table in TR-B02, promotion by owner act in TR-I04, one `hint` base type in TR-I02, findings TR-N01…N04; TR-V07 removed (now LG-R04).
- 2026-10-01 — design v0.6 audit, grilled: purpose `init` and confirmed `human` (TR-B02), fact no-op (TR-F07), directed `alias`, `live` for pipelines and `setup`, bench set in `calibration` (TR-F05), policy at `seq` (TR-I01), no decay (TR-V08), `via` (TR-V09), usefulness is not truth (TR-V10), source listing (TR-S03), stale calibration finding (TR-N02).
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): basis only through an act, a run with `judge` or `llm` is `inferred`, `upgrade` under `init` (TR-B02; D4 reopens G10); `in_force` never rejects (TR-B03, TR-I02); in force and current revision for entities (TR-I01); `live` only for pipelines and `setup` (TR-F05; D3); `calibration` keyed by what it applies to, value references the report (TR-F05); owner-act floor, verdict `origin` (TR-F06, TR-V09); promotion as a consequence, `draft` (TR-I04); trust evidence (TR-V01, TR-V06); baseline (TR-N03).
- 2026-10-01 — corrections F1–F6: lineage is a reference, not a status (TR-F04); the vote threshold is a constant of the LATTICE version (TR-V06).
- 2026-10-01 — deepening review (`reviews/2026-10-01-design-next-deepening.md`), grilled: row 2 of the basis table by the pipeline revision, not the tape (TR-B02; A3); shadow disagreements packaged by `cite`, hints by their run (TR-N03; A4); `calibration` references the `holdout` report (TR-F05).
