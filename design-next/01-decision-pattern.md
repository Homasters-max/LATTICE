# 01. Decision pattern

## Purpose

Every place where the system needs a semantic judgement (which tool, which model, which blocks, is this a duplicate, does this change break a contract) follows **one execution pattern**, not one engine:

```text
candidate source → candidate set → judge → policy → DecisionResult
```

Code controls, judge assesses, policy decides, LLM writes. The goal is to make semantic judgement usable in program logic while keeping behaviour deterministic, replayable and bounded.

## Roles

| Step | Owner | Answers |
|---|---|---|
| Candidate source | declared by the point (DP-M06) | what may be considered at all |
| Candidate set | the pool from an earlier stage, checked against the source; record | the exact, final list given to the judge |
| Judge | `judge` capability (Jev, LLM); where its answers come from is the adapter (PL-K02) | what can be said about each candidate |
| Policy | code, parameters from the block | what we do with that assessment |
| DecisionResult | record | what actually was decided |

## Out of the pattern

| ID | Not a decision | Where it lives |
|---|---|---|
| DP-X01 | Execution | pipeline, capability |
| DP-X02 | Outcome | verdict (DP-C04) |
| DP-X03 | Calibration | bench + verdicts (DP-C01…C05) |
| DP-X04 | Generation | LLM |
| DP-X05 | Search | LENS as a candidate source |
| DP-X06 | Extraction ("take the amount from this email") | LLM; the value is checked by code against a schema; a semantic check is a separate `binary` point "does the value match the text?" |

## Model

`decision-point` is an ordinary block type with a schema — not a new primitive, not a new storage mechanism. `decide()` is a stage capability.

```json
{ "type": "decision-point", "id": "pick-tool",
  "candidates": { "source": "tools.allowed@2", "required": [] },
  "question":   { "kind": "choice", "state": { "task": { "max": 4000 }, "context_summary": { "max": 2000 } },
                  "criteria": "Which tool best advances the task?" },
  "judge":      "judge.semantic@3",
  "policy":     { "op": "margin", "min": 0.2 },
  "bench":      "pick-tool-set@4" }
```

| ID | Rule |
|---|---|
| DP-M01 | `question.kind`: `choice` \| `score` \| `binary`. Ranking is `score` with `score_semantics: preference` plus `top-k` in policy. |
| DP-M02 | `judge` is a pinned capability reference (`ref@n`). The `judge@n` revision fixes the exact model and the prompt (PL-C09); `setup` only chooses where its answers come from (PL-A01). So calibration bound to `judge@n` (DP-C01) is bound to the model and the prompt. |
| DP-M03 | Fallback, retries, widening the search are not part of the point: the point decides, the pipeline dispatches on `status`. |
| DP-M04 | `state` contains only the fields declared in the point, validated by schema, each with a length limit. |
| DP-M05 | `required` candidates are always selected and never judged; this is the only rule about them. The budget is one run context field, taken from the need (LN-N01); the point has no budget of its own, and the budget applies only to the other candidates. If `required` alone exceed the budget, the result is `insufficient` with reason `budget` — required candidates are never silently dropped. |
| DP-M06 | `candidates.source` declares the allowed set: what may be considered at all. The pool itself is a run context field written by an earlier stage. `decide` rejects the run, naming DP-M06, if the pool holds a candidate outside the allowed set; it never drops such a candidate silently. |
| DP-M07 | A `binary` or verification question asks whether a candidate matches the criteria or the text, never whether a statement about the world is true. Truth comes from outcomes (verdicts, DP-X02). |

## DecisionResult

One contract for every point:

```json
{ "status": "selected | none | ambiguous | insufficient | unavailable",
  "reason": "budget | no-candidates | margin | timeout | …",
  "selected": ["<ref@n>"],
  "evaluations": [{ "candidate": "<ref@n>", "value": "…", "score": 0.71,
                    "score_semantics": "relevance | confidence | preference" }],
  "policy": "<ref@n>",
  "trace": { "point": "<ref@n>", "candidates": ["<ref@n>"],
             "input_fingerprint": "sha256:…" } }
```

DP-R06. A DecisionResult is the stage outcome of `decide` (PL-C07); its statuses are DP-R01…R05. It is stored only inside its run record (PL-R01). The judge implementation, model, prompt and memo hit are answers of the `judge` port and live in the run's tape (PL-K01).

| ID | Status | Meaning |
|---|---|---|
| DP-R01 | `selected` | policy selected at least one candidate |
| DP-R02 | `none` | no candidate passed the policy |
| DP-R03 | `ambiguous` | the top candidates are too close (`margin`) |
| DP-R04 | `insufficient` | not enough candidates or budget to decide |
| DP-R05 | `unavailable` | the judge gave no valid answer: timeout, network error, answer outside the schema, model retired or not the pinned one (PL-C09), an answer that does not cover exactly the candidate set (a missing or an extra key); a contract test of every judge adapter checks the last case |

Escalation and refusal are not statuses — they are branches of the pipeline dispatcher.

## Policy operators

Closed set: `threshold`, `top-k`, `margin` (gap between first and second → `ambiguous`), `budget` (reads the run budget, DP-M05), `any`, `all`.
A new operator is code in a capability, never an expression in a block.

## Boundaries

| ID | Boundary |
|---|---|
| DP-B01 | Judge never grants. It can narrow and flag — never permit. Escalation is a branch of the pipeline dispatcher (PL-P04), not a judge action. This is also the defence against prompt injection through `state`: a typed answer that cannot grant has little to hijack. |
| DP-B02 | Judge never writes knowledge. Its output (including `reason`) is evidence; turning it into a block is a separate promotion by an owner. |
| DP-B03 | Policy does not reason. Only operators from the closed set. |
| DP-B04 | Candidate source does not choose. It declares the allowed set (DP-M06). |
| DP-B05 | Decision is not outcome. Calibration learns from verdicts on outcomes, never from its own decisions. |
| DP-B06 | Calibration is not a runtime step. It is an external evaluation of the point. |
| DP-B07 | Replay does not depend on the current catalog: it uses the recorded candidate set and recorded judge answers. |
| DP-B08 | LLM and judge are not part of the kernel. The kernel never calls `decide()`. |
| DP-B09 | `decision-point` is not a universal engine. No new DSL, no graph of stages, no rule language. |
| DP-B10 | LATTICE blocks are the source of truth; from slice S0 on, `design-next/*.md` is their export (LG-B01, LG-B02). |
| DP-B11 | Hard invariants (schema, imports, hashes, layer boundaries) are checked only by code, all of them, always. The judge may find, explain and propose them, never decide pass/fail or skip one. Every boundary named in criteria or in a prompt is either checked by code or declared uncheckable and measured by a metric. |
| DP-B12 | An irreversible action always requires a human, regardless of configuration. |
| DP-B13 | Single channel: every semantic judgement goes through `decide()`. Only the `decide` capability imports the `judge` port; a structure test forbids any other import. |

## Disciplines

| ID | Discipline |
|---|---|
| DP-D01 | Candidates are always the answer options. A question about the state becomes a choice over levels (e.g. complexity levels → model via a table in policy). A question about a whole set becomes one composite candidate. |
| DP-D02 | The policy operator set is closed (see above). |
| DP-D03 | A multi-step decision is several points in a linear pipeline, never steps inside one point. Agent loops live in the caller, not in LATTICE. |

## Scores

| ID | Rule |
|---|---|
| DP-S01 | A score has declared semantics (`score_semantics`); a score is not a probability unless calibrated. |
| DP-S02 | On an uncalibrated score policy may use only order operators (`top-k`, `margin`). Absolute thresholds require calibration. |
| DP-S03 | An uncalibrated `binary` point can only report: it runs in `shadow`, never drives execution, and its reports reach `knowledge` only as hints (TR-N03). |

## Determinism

| ID | Rule |
|---|---|
| DP-T01 | **Replay** reads recorded judge answers (the `recorded` adapter, PL-K02) and must reproduce the same result: same candidate set + same question + same judge answers + same policy = same decision. |
| DP-T02 | **Re-run** asks the judge again (e.g. after a model change) and is compared with the record. Replay and re-run are different operations. |
| DP-T03 | **Memoization**: when the key `(question, judge@n, candidate set, state)` matches a recorded call, the recorded answer is reused, so the same input gives the same decision outside replay too. `judge@n` fixes the exact model and prompt (PL-C09), so a model change never hits an old memo. Memoization is a lookup in earlier tapes, done by recording for the ports that declare it (PL-K03). |
| DP-T04 | Timeouts, retries with backoff and batching belong to the judge capability; the record holds the final result. The point itself never retries. |
| DP-T05 | **Batching**: several points over the same `state` may share one judge call as an optimisation inside the judge capability. Each point still gets its own `DecisionResult`, record and memo key; points are unaware of batching. |

## Authority

A point has no stored lifecycle. Two separate axes: where the judge's answers come from is the adapter (PL-K02, PL-K04); whether a result drives execution is the `live` fact.

| ID | Rule |
|---|---|
| DP-L01 | Whether a point's result drives execution is one status fact: `live` (TR-F05) names the revision that does. Any other revision runs only in `shadow` or on the bench (PL-P06). |
| DP-L02 | In `shadow` the judge runs next to a **reference** and the reference decides; disagreements are reported (TR-N02). A reference is one of: an existing rule, a human decision on the same input, a bench set. A point without a reference cannot run in `shadow`: pipeline validation rejects it. |
| DP-L03 | A result of a revision that is not `live` never drives execution. |
| DP-L04 | Changing the judge is a new revision of the point (`judge@n+1`) made by its owner. It drives execution only after a calibration of the new judge (DP-C01) and a new `live` fact. There is no automatic switch. |
| DP-L05 | If the pinned model is retired by the vendor, the point answers `unavailable` and the pipeline falls back until the owner migrates it (DP-L04). |
| DP-L06 | Apply rejects a `live` fact for a decision point unless a `calibration` fact is in force for that revision (DP-C01) and its report meets the targets (BN-G02); for a pipeline (PL-P06), unless a bench report for that revision meets its targets. Only a report whose targets were in the ledger before its runs counts (BN-G04). If the policy of the point differs from the one the report was made with, apply recomputes the report from its cited segments under the new policy, without judge calls (BN-R03), and checks that. |

## Calibration

| ID | Rule |
|---|---|
| DP-C01 | Calibration binds to `question + judge@n` and to the bench set revision the point pins (`bench`). It is a `calibration` status fact keyed by the point `id` (TR-F05); its value holds the report, the hash of `question`, `judge@n` and `set@n`. It is in force for a revision of the point only while that revision has the same `question`, `judge@n` and `set@n`. So changing criteria, judge or bench set invalidates it; changing policy (thresholds, `top-k`) does not invalidate it but makes DP-L06 recompute the report. |
| DP-C02 | Measured on the bench set: precision in the "sure" band per answer value, share of the grey zone, size of the set. |
| DP-C03 | The precision target is data of the point, set by its owner (BN-G01). Calibration takes effect only by the owner's act (TR-F06), never automatically. |
| DP-C04 | Verdicts that count: acts of participants (human, consumer) and deterministic checks (tests pass, schema holds). A verdict from an LLM or the judge is `inferred` and never counts for calibration. |
| DP-C05 | A human decision (in `shadow` or after escalation) is recorded as a participant verdict. It enters a bench set only through a new revision of the set made by its owner, and only its `tune` part (BN-S05) — otherwise the set silently skews towards the cases that escalate most. |
| DP-C06 | Calibration goes stale when what the judge reads changes without a new point revision: the `card` of a type in the allowed set or the tokenizer capability of the candidate source gets a new revision after the calibration. This raises the finding "stale calibration" (TR-N02); the calibration stays in force until the owner acts. |

## Language

| ID | Rule |
|---|---|
| DP-G01 | Criteria are written in English. There is no translation step in the pattern by default. |
| DP-G02 | Non-English input is measured first: a metamorphic bench checks that RU/EN paraphrases give the same answer. If they do not, preparing `state` (translation) becomes a capability before `decide()`; its output is recorded and is part of the input fingerprint. |

## LENS

DP-N01. LENS is an instance of the pattern and has no other path to the judge: candidate source (BM25, plus blocks referenced by id as `required`) → `decide(score)` → `top-k` + `budget`.

## Stress test

Internal cases:

| Case | Candidates | Judge | Policy | Note |
|---|---|---|---|---|
| tool | allowed tools | choice | margin, permission | tool arguments are generation (DP-X04), checked by schema |
| model | complexity levels | choice | table level → model | candidates are levels, not models (DP-D01) |
| duplicates | card pairs | score | threshold → alias candidate | pairs pre-selected by code, not n² |
| risk | LOW / MEDIUM / HIGH | choice | margin | escalation is the dispatcher's branch |
| scenario coverage | pair test ↔ scenario | binary | report | "all scenarios covered" is a hard check in code; the judge answers "does the test match the scenario" (DP-M07) |
| PR boundary | invariants from `referrers` | binary each | `any` | reports in `shadow` until calibrated (DP-S03); asks "does the diff match the invariant's text", not "is the invariant broken in the world" (DP-M07) |
| solve route | domains | score (preference) | top-k | — |
| agent context | block pool | score, then binary "sufficient?" | budget, required | two points in sequence (DP-D03) |

External cases:

| Case | Shape | Note |
|---|---|---|
| ticket routing | point "queue" (`choice` over queues allowed by account tier) + point "urgency" (`binary`), batched (DP-T05) | priority from a table in policy |
| RAG guardrail | `binary` on a composite candidate "answer + sources" | "is the answer supported by the sources", not "is it true" (DP-M07); threshold only after calibration (DP-S03); regeneration is the pipeline's branch |
| value extraction | does not fit | out of the pattern (DP-X06) |

## Depends on (not yet designed)

| Topic | Document |
|---|---|
| where records are stored, retention | resolved: [03-ledger](03-ledger.md) LG-S03, LG-R01…R03 |
| who owns a point and its bench set | resolved: [04-catalog](04-catalog.md) CT-N04, CT-A02 |
| verdict and trust model | resolved: [05-trust](05-trust.md) TR-F04…F06, TR-V01…V10 |

## History

- 2026-09-30 — grilled (18 questions); DP-Q01 closed by the external stress test, DP-Q02 closed by DP-N01, DP-Q03 closed by DP-G01…G02.
- 2026-10-01 — unified-architecture review, grilled: allowed set and pool (DP-M06, DP-B04), one budget (DP-M05), operator `required ⊆ selected` removed, DecisionResult only in the run record (DP-R06), no stored lifecycle — authority is the `live` fact (DP-L01…L06), calibration as a status fact (DP-C01), judge does not escalate (DP-B01), memoization through recording (DP-T03).
- 2026-10-01 — design v0.6 audit, grilled: `judge@n` fixes model and prompt (DP-M02, DP-T03), match not truth (DP-M07), exact candidate coverage (DP-R05), boundaries checked or measured (DP-B11), `live` gate for pipelines, targets before runs, recompute under new policy (DP-L06), bench set in calibration (DP-C01), escalations only to `tune` (DP-C05), stale calibration (DP-C06).
