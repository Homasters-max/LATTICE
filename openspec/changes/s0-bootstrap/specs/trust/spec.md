# Spec Delta

## ADDED Requirements

### Requirement: The basis table
<!-- id: REQ-TR-001 -->

The module `trust` SHALL give `basis(session, acted)` — the basis of a record in `knowledge` (TR-B01) from the body of
its session event (CT-P01) and whether an act confirms it (CT-A05) — by this table only, read top to bottom, the first
matching row giving the basis:

| Row | Session | `acted` | Basis |
|---|---|---|---|
| 1 | any | `false` | `inferred` |
| 2 | `kind` `machine`, and the session names a `pipeline` | `true` | `inferred` |
| 3 | `kind` `human` or `agent` | `true` | `asserted` |
| 4 | `kind` `machine`, `purpose` `check` or `bench` | `true` | `observed` |
| 5 | `kind` `machine`, `purpose` `init`, `work` or `import` | `true` | `derived` |

`kind` and `purpose` are the members of that name of the session body; a session "names a `pipeline`" when the body has
the member `pipeline`. The table is read only for a **valid** session: a body that is an object whose `kind` is one of
`human`, `agent`, `machine` and whose `purpose` is one of `init`, `work`, `import`, `check`, `bench` — the lists of
the session type (REQ-LG-006). Any other session — a body that is not an object, or a `kind` or a `purpose` outside its
list, for every kind — gives `inferred` whatever `acted` is: only an act lifts a record above `inferred`, and the
declared kind and purpose only choose which basis an act gives (TR-B02, CT-P03). `basis` is pure, never throws and
reads nothing but its arguments.

Row 2 reads the pipeline revision a run session names (CT-P01). `std` holds no pipeline type in S0, so a named pipeline
cannot be shown to be free of a `decide` stage and of the `calls-llm` effect (PL-C05): every named pipeline takes row 2
until the slice that adds the pipeline type reads its stages.

Implements: TR-B02, TR-B01, CT-P02

#### Scenario: Every row of the basis table
<!-- id: SCN-TR-001 -->
- **WHEN** `basis` gets, with `acted` `true`, the session bodies `{"of":{},"participant":"Homasters-max","kind":"human","purpose":"work"}`,
  the same with `kind` `agent`, `{"of":{},"participant":"lattice","kind":"machine","purpose":"check"}`, the same with
  `purpose` `bench`, `init`, `work` and `import`, the body with `purpose` `check` and a member `pipeline`
  `"lattice/solve@1"`; then each of these bodies with `acted` `false`; then, with `acted` `true`, the bodies
  `{"of":{},"participant":"x","kind":"robot","purpose":"work"}`, `{"of":{},"participant":"lattice","kind":"machine","purpose":"play"}`,
  `null` and `[]`
- **THEN** the first group gives in order `asserted`, `asserted`, `observed`, `observed`, `derived`, `derived`,
  `derived`, `inferred`; every body of the second group gives `inferred`; every body of the last group gives `inferred`,
  and so does `{"of":{},"participant":"Homasters-max","kind":"human","purpose":"play"}` with `acted` `true`

### Requirement: The current value of a fact key and the live revision
<!-- id: REQ-TR-002 -->

A fact is an event whose body is `{"of", "key", "value"}`, or `{"of", "key", "revoked": true}` for a cancellation
(TR-F01, TR-F02): a **fact body** is an object with an object `key` and exactly one of the members `value` (any JSON
value) and `revoked` (the value `true`). A body with both, with neither, with `revoked` other than `true` or without an
object `key` is not a fact body. The module `trust` SHALL give `currentFacts(facts)`: for a list of bodies in ledger
order, skipping every one that is not a fact body, a frozen map from the canonical JSON (RFC 8785) of each key to the
`value` of the latest fact body of that key; a key whose latest fact body is a cancellation is not in the map.

The status fact `live` (TR-F05) is an event of type `std/live@1` (REQ-LG-007) whose `key` is `{"id": <entity id>}` and
whose `value` is the revision of that entity whose results drive execution. `liveRevision(events, id)` SHALL give, for
a list of event records `{type, body}` in ledger order, the current value of the key `{"id": id}` among the bodies of
the events of type `std/live@1` — so at most one revision per `id` — when that value is an integer from 1 to
2^53−1, and none otherwise (no current value, or a value that is not a revision).

In S0 every fact counts: in force (TR-I01), the owner-act floor of `live` (TR-F06) and the fact no-op (TR-F07) are not
checked yet (apply rejects nothing by them, TR-B03; the no-op is #82).

Implements: TR-F05, TR-F02, TR-F01

#### Scenario: The latest fact of a key wins and a cancellation removes it
<!-- id: SCN-TR-002 -->
- **WHEN** `liveRevision` gets, in this order, the events of type `std/live@1` with bodies
  `{"of":{"subject":"lattice/setup@1"},"key":{"id":"lattice/setup"},"value":1}`,
  `{"of":{"subject":"lattice/solve@3"},"key":{"id":"lattice/solve"},"value":3}`,
  `{"of":{"subject":"lattice/setup@2"},"key":{"id":"lattice/setup"},"value":2}` and an event of type `std/other@1`
  with the body `{"of":{},"key":{"id":"lattice/setup"},"value":9}`, and is asked for `lattice/setup`, `lattice/solve`
  and `lattice/none`; then the same list followed by `{"of":{"subject":"lattice/setup@2"},"key":{"id":"lattice/setup"},"revoked":true}`
  of type `std/live@1`, asked for `lattice/setup`; then the first list followed, each alone, by the `std/live@1` bodies
  `{"of":{"subject":"lattice/setup@3"},"key":{"id":"lattice/setup"},"value":3,"revoked":true}`,
  `{"of":{"subject":"lattice/setup@3"},"key":{"id":"lattice/setup"},"revoked":false}` and
  `{"of":{"subject":"lattice/setup@3"},"key":{"id":"lattice/setup"},"value":"3"}`, asked for `lattice/setup`; and
  `currentFacts` gets the bodies of the first list
- **THEN** the answers are `2`, `3` and none; then none; then `2`, `2` (both bodies are not fact bodies) and none;
  `currentFacts` gives a frozen map of two entries, `{"id":"lattice/setup"}` → `2` and `{"id":"lattice/solve"}` → `3`
