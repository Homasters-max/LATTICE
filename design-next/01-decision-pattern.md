# 01. Decision pattern

## Purpose

DP-Z01. Every place where the system needs a semantic judgement (which tool, which model, which blocks, is this a duplicate, does this change break a contract) follows **one execution pattern**, not one engine:

```text DP-Z02
candidate source → candidate set → judge → policy → DecisionResult
```

DP-Z03. Code controls, judge assesses, policy decides, LLM writes. The goal is to make semantic judgement usable in program logic while keeping behaviour deterministic, replayable and bounded.

## Roles

DP-Z04. The roles in the pattern:

| Step | Owner | Answers |
|---|---|---|
| Candidate source | declared by the point (DP-M06) | what may be considered at all |
| Candidate set | the pool from an earlier stage, checked against the source; record | the exact, final list given to the judge |
| Judge | the `judge` port (GL-02); `judge@n` configures its `service` adapter — a vendor LLM or Jev (PL-C09); which adapter serves it is `setup` (PL-A01) | what can be said about each candidate |
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

DP-Z05. `decision-point` is an ordinary block type with a schema — not a new primitive, not a new storage mechanism. `decide()` is a stage capability.

```json DP-Z06
{ "type": "std/decision-point@1", "id": "acme/pick-tool",
  "candidates": { "source": "acme/tools.allowed@2", "required": [] },
  "question":   { "kind": "choice", "state": { "task": { "max": 4000 }, "context_summary": { "max": 2000 } },
                  "criteria": "Which tool best advances the task?" },
  "judge":      "acme/judge.semantic@3",
  "policy":     { "op": "margin", "min": 0.2 },
  "bench":      "acme/pick-tool-set@4",
  "targets":    { "precision": 0.9 } }
```

| ID | Rule |
|---|---|
| DP-M01 | `question.kind`: `choice` \| `score` \| `binary`. Ranking is `score` with `score_semantics: preference` plus `top-k` in policy. |
| DP-M02 | `judge` is a pinned reference to a `judge` block (`judge@n`, PL-C09). It fixes the exact model and, through the hash of the adapter code, the prompt; `setup` only chooses which adapter serves the port (PL-A01). So calibration bound to `judge@n` (DP-C01) is bound to the model and the prompt. |
| DP-M03 | Fallback, retries, widening the search are not part of the point: the point decides, the pipeline dispatches on `status`. |
| DP-M04 | `state` contains only the fields declared in the point, validated by schema, each with a length limit. |
| DP-M05 | `required` candidates are always selected and never judged; this is the only rule about them. The budget is one run context field, taken from the need (LN-N01); the point has no budget of its own, and the budget applies only to the other candidates. If `required` alone exceed the budget, the result is `insufficient` with reason `budget` — required candidates are never silently dropped. The budget is spent once, on the final output: a stage that consumes it computes the remainder from the fields it reads, and no stage writes the budget (PL-P03). |
| DP-M06 | `candidates.source` declares the allowed set: what may be considered at all — a pinned reference to the set, or `scope`, the need's scope (LN-N03). The pool itself is a run context field written by an earlier stage. `decide` rejects the run, naming DP-M06, if the pool holds a candidate outside the allowed set; it never drops such a candidate silently. |
| DP-M07 | A `binary` or verification question asks whether a candidate matches the criteria or the text, never whether a statement about the world is true. Truth comes from outcomes (verdicts, DP-X02). |

## DecisionResult

DP-Z07. One contract for every point:

```json DP-Z08
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

DP-Z09. Escalation and refusal are not statuses — they are branches of the pipeline dispatcher.

## Policy operators

DP-Z10. Closed set: `threshold`, `top-k`, `margin` (gap between first and second → `ambiguous`), `budget` (reads the run budget, DP-M05), `any`, `all`, `table` (maps the selected value to an output value by a table in the point's policy).
The operators, together with DP-M05 and DP-R01…R04, form one pure function of module `measure` (ST-M01), **policy evaluation**: policy, evaluations, `required` and budget in; status, reason and `selected` out. `decide`, the gate (DP-L06) and the calibration metrics (DP-C02) call it; `decide` itself keeps only DP-M06, the `judge` port, DP-R05 and the `trace`. A new operator is code there, never an expression in a block, and enters only with a case of a slice or of the stress test that no combination of the existing operators expresses, named in the change.

## Boundaries

| ID | Boundary |
|---|---|
| DP-B01 | Judge never grants. It can narrow and flag — never permit. Escalation is a branch of the pipeline dispatcher (PL-P04), not a judge action. This is also the defence against prompt injection through `state`: a typed answer that cannot grant has little to hijack. |
| DP-B02 | Judge never writes knowledge. Its output (including `reason`) stays on the tape (PL-K01); turning it into a block is a separate promotion (TR-I04). |
| DP-B03 | Policy does not reason. Only operators from the closed set. |
| DP-B04 | Candidate source does not choose. It declares the allowed set (DP-M06). |
| DP-B05 | Decision is not outcome. Calibration learns from verdicts on outcomes, never from its own decisions. |
| DP-B06 | Calibration is not a runtime step. It is an external evaluation of the point. |
| DP-B07 | Replay does not depend on the current catalog: it uses the recorded candidate set and recorded judge answers. |
| DP-B08 | LLM and judge are not part of the kernel. The kernel never calls `decide()`. |
| DP-B09 | `decision-point` is not a universal engine. No new DSL, no graph of stages, no rule language. |
| DP-B10 | LATTICE blocks are the source of truth for this design (LG-B02). |
| DP-B11 | Hard invariants (schema, imports, hashes, layer boundaries) are checked only by code, all of them, always. The judge may find, explain and propose them, never decide pass/fail or skip one. Every boundary named in criteria or in a prompt is either checked by code or declared uncheckable and measured by a metric. |
| DP-B12 | An irreversible action always requires a human, regardless of configuration. |
| DP-B13 | Single channel: every semantic judgement (GL-13) goes through `decide()`. Only the `decide` capability imports the `judge` port; a structure test forbids any other import (ST-S01). The `llm` port only generates (DP-X04) or extracts (DP-X06): no branch of a pipeline depends on its output (PL-C07). |

## Disciplines

| ID | Discipline |
|---|---|
| DP-D01 | For `choice` and `score` the candidates are the answer options; `binary` asks one yes/no per candidate. A question about the state becomes a choice over levels (e.g. complexity levels → model via the `table` operator). A question about a whole set becomes one composite candidate. |
| DP-D02 | The policy operator set is closed (see above). |
| DP-D03 | A multi-step decision is several points in a linear pipeline, never steps inside one point. Agent loops live in the caller, not in LATTICE. |

## Scores

| ID | Rule |
|---|---|
| DP-S01 | A score has declared semantics (`score_semantics`); a score is not a probability unless calibrated. |
| DP-S02 | On an uncalibrated score policy may use only order operators (`top-k`, `margin`). Absolute thresholds require calibration. The gate checks it (DP-L06); in `shadow` and on the bench any operator may run, which is where calibration is gathered. |
| DP-S03 | An uncalibrated `binary` point can only report: a pipeline that pins it fails the gate (DP-L06), so it runs only in `shadow` or on the bench, and its reports reach `knowledge` only as hints (TR-N03). |

## Determinism

| ID | Rule |
|---|---|
| DP-T01 | **Replay** reads recorded judge answers (the `recorded` adapter, PL-K02) and must reproduce the same result: same candidate set + same question + same judge answers + same policy = same decision. |
| DP-T02 | **Re-run** asks the judge again (e.g. after a model change) and is compared with the record. Replay and re-run are different operations. |
| DP-T03 | **Memoization**: when the key `(question, judge@n, candidate set, state)` matches a recorded call, the recorded answer is reused, so the same input gives the same decision outside replay too. The request of the `judge` port is exactly this key (PL-C09). `judge@n` fixes the exact model and prompt (PL-C09), so a model change never hits an old memo. Memoization is a lookup in earlier tapes, done by recording for the ports that declare it (PL-K03). |
| DP-T04 | Timeouts, retries with backoff and batching belong to the `service` adapter of the `judge` port (PL-C09); the tape holds the final answer. The point itself never retries. |
| DP-T05 | **Batching**: several points over the same `state` may share one judge call as an optimisation inside the `service` adapter of the `judge` port. Each point still gets its own `DecisionResult`, record and memo key; points are unaware of batching. |

## Authority

DP-Z11. A point has no stored lifecycle and no `live` fact of its own. Where answers come from and whether a result drives execution are separate axes (PL-K04).

| ID | Rule |
|---|---|
| DP-L01 | A run is **authoritative** iff its `pipeline@n` and `setup@n` are the revisions named by `live` facts (TR-F05) in force at the knowledge commit it read (PL-K05) — a pure function of the run record, never stored. Only an authoritative run drives execution, so a revision of a point drives execution only through the `live` pipeline revision that pins it (PL-P06). The output and outcome of a run that is not authoritative are marked `non-authoritative`, as a fallback is (PL-R01), and a stage with the `irreversible` effect (PL-C05) refuses in it: the run ends `refused`. |
| DP-L02 | **`shadow`** is a pipeline revision that is not `live`, run next to the `live` revision on the same input. The `live` revision decides and is the **baseline**; disagreements are reported (TR-N02). A pipeline without a `live` revision has no `shadow`: its revisions run only on the bench, whose baselines are the expected answers of the set (BN-S01). |
| DP-L04 | Changing the judge — a new `judge@n` (PL-C09) — reaches execution only through a new revision of the point that pins it, a calibration that applies to that revision (DP-C01) and a new `live` pipeline revision that pins the point (DP-L06). There is no automatic switch. |
| DP-L05 | If the pinned model is retired by the vendor, the point answers `unavailable` and the pipeline falls back until the owner migrates it (DP-L04). |
| DP-L06 | **Gate.** Apply admits a `live` fact for a pipeline revision only if the gate passes. The gate is a step of apply (LG-A03) that composes `trust` (what is in force) and `measure` (whether numbers meet targets), and always does the same, with no judge calls: (1) the hashes of the cited evidence match (LG-R02); (2) the pipeline's `holdout` report (BN-R02) is admitted (BN-R04), and its metrics, recomputed by `measure` from that evidence under the pinned revisions, meet the pipeline's `targets` (PL-P01), counted only as BN-G04 allows; (3) every judge answer in the evidence came from the `service` adapter of the pinned `judge@n` (GL-07); (4) every pinned decision point revision whose policy uses an absolute threshold (DP-S02) or whose question is `binary` (DP-S03) has a `calibration` in force that applies to it (DP-C01, TR-I01), whose `holdout` report, recomputed the same way under that revision's policy, meets the point's `targets`; (5) no finding BN-G03 on the pipeline revision is open without a `dismissed` fact (TR-N04). The `live` fact still needs the owner's act (TR-F06). |

## Calibration

| ID | Rule |
|---|---|
| DP-C01 | Calibration binds to `question + judge@n` and to the bench set revision the point pins (`bench`). It is a `calibration` status fact keyed by the point `id`, the hash of `question`, `judge@n` and `set@n` (TR-F05); its value references the report (BN-R02). It **applies to** a revision of the point iff that revision has the same `question`, `judge@n` and `set@n` — its key matches. So calibrations of coexisting revisions never replace each other; changing criteria, judge or bench set needs a new calibration; changing policy (thresholds, `top-k`) needs none, because the gate recomputes the report under the policy of the revision (DP-L06). |
| DP-C02 | Measured on the `holdout` report of the bench set (BN-R02): precision in the **sure band** — items whose status is `selected` — per answer value; share of the **grey zone** — items whose status is `ambiguous` or `insufficient`; size of the set. Both come from policy evaluation (Policy operators) under the point revision. |
| DP-C03 | The precision target is data of the point, set by its owner (BN-G01). Calibration takes effect only by the owner's act (TR-F06), never automatically. |
| DP-C04 | Verdicts that count: acts of participants (human, consumer) and deterministic checks (tests pass, schema holds). A verdict from an LLM or the judge is `inferred` and never counts for calibration. |
| DP-C05 | A human decision (in `shadow` or after escalation) is recorded as a participant verdict. It enters a bench set only as BN-S04 allows. |
| DP-C06 | Calibration goes stale when what the judge reads changes without a new point revision: the `card` of a type in the allowed set gets a new revision after the calibration. The tokenizer is pinned by the pipeline (LN-C03), so its change passes the gate (PL-P06). This raises the finding "stale calibration" (TR-N02); the calibration stays in force until the owner acts. |

## Language

| ID | Rule |
|---|---|
| DP-G01 | Criteria are written in English. There is no translation step in the pattern by default. |
| DP-G02 | Non-English input is measured first: a metamorphic bench checks that RU/EN paraphrases give the same answer. If they do not, preparing `state` (translation) becomes a capability before `decide()`; its output is recorded and is part of the input fingerprint. |

## LENS

DP-N01. LENS is an instance of the pattern and has no other path to the judge: candidate source (BM25 plus blocks named by id in the need, LN-C02) → `decide(score)` → `top-k` + `budget`; `required` only as the point declares it (DP-M05).

## Stress test

DP-Z12. Internal cases:

| Case | Candidates | Judge | Policy | Note |
|---|---|---|---|---|
| tool | allowed tools | choice | margin | the allowed set limits the tools (DP-M06); the judge never grants (DP-B01); tool arguments are generation (DP-X04), checked by schema |
| model | complexity levels | choice | `table`: level → model | candidates are levels, not models (DP-D01) |
| duplicates | card pairs | score | threshold → alias candidate | pairs pre-selected by code, not n² |
| risk | LOW / MEDIUM / HIGH | choice | margin | escalation is the dispatcher's branch |
| scenario coverage | pair test ↔ scenario | binary | — (`shadow`, DP-S03) | "all scenarios covered" is a hard check in code; the judge answers "does the test match the scenario" (DP-M07) |
| PR boundary | invariants from `referrers` | binary each | `any` | reports in `shadow` until calibrated (DP-S03); asks "does the diff match the invariant's text", not "is the invariant broken in the world" (DP-M07) |
| solve route | domains | score (preference) | top-k | — |
| agent context | block pool | score, then binary "sufficient?" | budget, required | two points in sequence (DP-D03) |

DP-Z13. External cases:

| Case | Shape | Note |
|---|---|---|
| ticket routing | point "queue" (`choice` over queues allowed by account tier) + point "urgency" (`binary`), batched (DP-T05) | priority by `table` |
| RAG guardrail | `binary` on a composite candidate "answer + sources" | "is the answer supported by the sources", not "is it true" (DP-M07); threshold only after calibration (DP-S03); regeneration is the pipeline's branch |
| value extraction | does not fit | out of the pattern (DP-X06) |
