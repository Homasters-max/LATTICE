# 05. Trust

## Purpose

What to believe and how much: bases of records, facts, status facts, "what is in force", verdicts, findings. Trust is computed, never assigned.

## Bases

| ID | Rule |
|---|---|
| TR-B01 | Four bases — categories, not a scale: `asserted` (a human's statement), `derived` (deterministic transformation of a source, `machine`), `observed` (result of a deterministic check or measurement: tests, schema, bench), `inferred` (output of an agent, LLM or judge). |
| TR-B02 | The basis of a record is computed by apply (LG-A03) from its session, by this table only. Session `purpose` is one of `init`, `work`, `import`, `check`, `bench`. |

| Participant kind (CT-P02) | Purpose | Basis |
|---|---|---|
| `human`, confirmed by an act (CT-P03, CT-A05) | any | `asserted` |
| `machine` | `init`, `work`, `import` | `derived` |
| `machine` | `check`, `bench` | `observed` |
| `agent`, or `human` without confirmation | any | `inferred` |
| owner act on an intent authored by an `agent` session (TR-I04) | — | `asserted` |

| ID | Rule |
|---|---|
| TR-B03 | Bases are not compared as greater or smaller. A type declares which bases it accepts. |

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
| TR-F04 | Every statement that something is in use, replaced, promoted, accepted, voted on or dismissed is a status fact (TR-F01, TR-F02). There is no other mechanism for it. The status fact types form a closed set in `std` (TR-F05); a new one comes only with a LATTICE version. |
| TR-F05 | Status fact types and their keys: |

| Type | Key | Value |
|---|---|---|
| `retired` | entity `id` | — (the entity is out of use; revoking it returns the entity to use) |
| `alias` | entity `id` of the alias | the canonical entity `id` (OM-D02, OM-R06): both in one namespace; the canonical entity is in use and is not an alias itself, so aliases form a star, never a chain |
| `live` | entity `id` (decision point, pipeline, `setup`) | the revision whose results drive execution; at most one per `id` |
| `calibration` | decision point `id` | the report (BN-R02), the hash of `question`, `judge@n` and the bench set `set@n` (DP-C01) |
| `verdict` | participant, subject `ref@n` | for / against (TR-V02) |
| `dismissed` | finding rule ID, subject `ref@n` | — (TR-N04) |

| ID | Rule |
|---|---|
| TR-F06 | `retired`, `alias`, `live`, `calibration` and `dismissed` are written and revoked only by an owner act (CT-A02). A `verdict` is written and revoked only by its own participant. A write to the same key by another participant raises "overridden" (TR-F03). |

## In force

| ID | Rule |
|---|---|
| TR-I01 | `inForce(fact)` is a pure function over the ledger. A fact is in force iff: (1) its basis is in the type's `in_force` list; (2) an owner act exists if the namespace policy in effect at the fact's `seq` requires one (CT-N03, CT-N06); (3) it is the latest event by `seq` for its key. Nothing else — no scores, no heuristics, no records from `runtime` (LG-R04). |
| TR-I02 | `inferred` facts can be in force only for types extending the base type `hint` (OM-T04); a candidate is a role that extends `hint`. Knowledge-bearing types accept only `asserted`, `derived`, `observed`. This turns DP-B02 ("judge never writes knowledge") into a schema check. |
| TR-I03 | An LLM summary is a separate hint fact; it never enters a block body. |
| TR-I04 | Promotion: an owner act on an intent authored by an `agent` session is human authorship. The written record gets basis `asserted` (TR-B02) and a `source` reference to the draft (the hint or the agent's intent). The basis of the draft itself never changes. The trail shows that knowledge grew from an inference and who approved it. |

## Verdicts

| ID | Rule |
|---|---|
| TR-V01 | In v1 there is no numeric trust score. Trust is: basis, "in force", and verdict counts for / against shown as evidence. A numeric score is introduced only when the bench shows it helps (LT-18). |
| TR-V02 | A verdict is a `verdict` status fact (TR-F05), so one participant has one vote per subject and a later verdict replaces the earlier one (TR-F02). Verdicts by `agent`, LLM or judge carry zero votes (DP-C04). |
| TR-V03 | Verdicts from sessions with `purpose: bench` go to calibration, not to block trust: the bench measures the system and does not confirm blocks. |
| TR-V04 | Verdicts attach to `ref@n` and never move to a new revision: a new revision starts at zero. Counts of earlier revisions are shown as history ("previous revision: +5 / −1"). Otherwise an edit silently inherits someone else's approval. |
| TR-V05 | Counts are shown separately per basis and never summed ("checks +1, people −1"). No basis outranks another in general. |
| TR-V06 | Counts are used in two places only: as evidence in `explain` (humans, LLM), and as findings (TR-N01) for the owner when a threshold on any basis is crossed (e.g. 3 votes against). The owner decides — fix or `retired`. Counts never change anything automatically. |
| TR-V08 | Trust does not decay with time. Judge scores and the number of calls are never evidence of truth. |
| TR-V09 | A verdict that reaches `knowledge` from `runtime` by citation (LG-R04) keeps its original participant as `via`; it is never rewritten to the author of the proposal. |
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
| TR-N03 | Signals born in `runtime` (DP-L02, DP-S03) become findings only after they are cited in `knowledge` (LG-R04). A shadow disagreement has basis `observed`: code compares the judge with the reference. A report of an uncalibrated point is a hint (`inferred`, TR-I02). |
| TR-N04 | A finding closes when its cause disappears, or by a `dismissed` fact keyed by rule ID and subject `ref@n` (TR-F05). A new revision of the subject raises it again. |

## History

- 2026-09-30 — grilled (12 questions).
- 2026-10-01 — unified-architecture review (`reviews/2026-10-01-unified-architecture.md`), grilled (41 questions): status facts TR-F04…F06, explicit revocation in TR-F02, one basis table in TR-B02, promotion by owner act in TR-I04, one `hint` base type in TR-I02, findings TR-N01…N04; TR-V07 removed (now LG-R04).
- 2026-10-01 — design v0.6 audit, grilled: purpose `init` and confirmed `human` (TR-B02), fact no-op (TR-F07), directed `alias`, `live` for pipelines and `setup`, bench set in `calibration` (TR-F05), policy at `seq` (TR-I01), no decay (TR-V08), `via` (TR-V09), usefulness is not truth (TR-V10), source listing (TR-S03), stale calibration finding (TR-N02).
