# Spec Delta

## ADDED Requirements

### Requirement: A namespace is an entity with an owner and a policy
<!-- id: REQ-CT-001 -->

A namespace entity (CT-N01) is an entity of type `std/namespace@1` (REQ-LG-007) whose `id` is `<name>/namespace`, where
`<name>` is the namespace — the `id` prefix — it owns; it is written into the namespace it creates. It is recognised by
its type, never by its `id` alone: the type entity `std/namespace` is of type `core/type@1` and is not a namespace
entity, and `core` and `std` have none (CT-N02).

Its body is the namespace policy (CT-N03): `{"owner": <login>, "writers": [<writer>, …], "owner_acts": [<intent kind>,
…]}` — a writer is `{"login": <login>}` (by name) or `{"kind": "human" | "agent" | "machine"}` (by kind). The module
`trust` SHALL give `policyOf(body)`: the policy when the body is an object with exactly these three keys, `owner` a
login `[A-Za-z0-9-]+`, `writers` a list of objects each with exactly one key — `login` holding a login or `kind` one of
the three kinds —, and `owner_acts` a list of distinct non-empty strings; otherwise a refusal naming the JSON pointer
of the first deviation in this order: a body that is not an object (an array included), at `""`; then `owner`, missing
or invalid, at `/owner`; then `writers` — missing or not a list at `/writers`, otherwise its first invalid element at
`/writers/<i>`; then `owner_acts` — missing or not a list at `/owner_acts`, otherwise its first element that is not a
non-empty string or repeats an earlier one at `/owner_acts/<i>`; then the first key outside the three, by UTF-16 code
units, at `/<key>`. `actLogins(policy)` SHALL give the logins of the writers listed
by name, each once, ordered by UTF-16 code units: only they can make an act; an entry by kind never gives one (CT-A05).

In S0 apply does not check writers or owner acts (CT-N03, TR-F06); the policy is written and read, not enforced.

Implements: CT-N01, CT-A05, CT-N03

#### Scenario: The policy of the project namespace
<!-- id: SCN-CT-001 -->
- **WHEN** `policyOf` gets the policy of SL-K04 — `{"owner":"Homasters-max","writers":[{"login":"Homasters-max"},{"kind":"agent"}],"owner_acts":[]}`
  — and then `{"owner":"Homasters-max","writers":[{"login":"a","kind":"agent"}],"owner_acts":[]}`,
  `{"owner":"x y","writers":[],"owner_acts":[]}`, `{"owner":"Homasters-max","writers":[],"owner_acts":[],"extra":1}`,
  `[]`, `{"writers":[{"x":1}],"zz":1}` and `{"owner":"Homasters-max","writers":[],"owner_acts":["a","a"]}`; and
  `actLogins` gets the first policy
- **THEN** the first is a policy; the others are refused at `/writers/0`, `/owner`, `/extra`, `""`, `/owner` and
  `/owner_acts/1`; `actLogins` gives `["Homasters-max"]`

### Requirement: Store init creates the project namespace
<!-- id: REQ-CT-002 -->

The project namespace SHALL be created by store init (CT-N05): after genesis (LG-G01) and `std` (LG-G02), commit 3
holds the namespace entity `<namespace>/namespace` at `rev` 1 of type `std/namespace@1` with the body
`{"owner": <owner>, "writers": [{"login": <owner>}], "owner_acts": []}` — `<namespace>` and `<owner>` from the init
configuration (REQ-CL-002) —, its `machine` / `init` session event, and the act record of the owner read through the
`init` adapter of the `acts` port (REQ-AC-002): an ordinary owner act, not an exception to CT-A03. So the namespace
entity has basis `derived` (REQ-TR-001). The owner adds writers by kind, as SL-K04 does for the agent account, by a
later change of the policy. Afterwards ownership moves only by an owner act (CT-A02), which S0 does not check.

Implements: CT-N05, CT-N01

#### Scenario: The namespace commit of a new store
<!-- id: SCN-CT-002 -->
- **WHEN** store init runs with the namespace `lattice` and the owner `Homasters-max` (SCN-LG-011)
- **THEN** commit 3 holds exactly the entity `lattice/namespace` at `rev` 1 of type `std/namespace@1` with the body
  `{"owner":"Homasters-max","owner_acts":[],"writers":[{"login":"Homasters-max"}]}` and its session event; its `acts`
  is `[{"login":"Homasters-max","names":[<its proposal>],"ref":"store/lattice.json"}]`; `policyOf` of the body is a
  policy; the basis of the entity is `derived`
