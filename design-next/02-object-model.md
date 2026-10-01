# 02. Object model

## Purpose

What a block, a revision, a reference and a type are. Everything else — decisions (01), ledger, catalog, trust — is built on this model.

## Kinds

| ID | Rule |
|---|---|
| OM-K01 | Every record has one envelope and one of two kinds: **entity** (stable `id`, revisions `@n`: blocks, types, decision points) or **event** (immutable, append-only: facts, verdicts, sessions, run records). |
| OM-K02 | There is no stored "value" kind. Content-addressed things (cards) are computed projections. |
| OM-K03 | Nothing is deleted. An entity leaves use by a `retired` status fact (TR-F05); an event is cancelled by a later event with the same key (TR-F02). History is never rewritten. |

## Identity

| ID | Rule |
|---|---|
| OM-I01 | An entity `id` is assigned and readable: `namespace/slug`. It is the stable anchor for references, documents and judge criteria. |
| OM-I02 | An event `id` is a ULID, carried by the intent that writes it (LG-P01); apply never generates one. |
| OM-I03 | A hash is used only for equality of revisions, never for identity. |
| OM-I04 | The type of an entity is fixed for the lifetime of its `id`. Changing the type means a new `id` with `supersedes` pointing to the old one, and a `retired` fact for the old one. |
| OM-I05 | Grammar: namespace `[a-z][a-z0-9-]*`; slug `[a-z0-9][a-z0-9.-]*`, where a dot is part of the name, not a hierarchy; a reference is `id` or `id@n` (OM-R01). |
| OM-I06 | The type of an entity is never inferred from its `id`, and an `id` never moves to another namespace: a move is a new `id` (OM-I04). |
| OM-I07 | `supersedes` is an optional reference field declared once, in every base entity type (OM-T04): a list of pinned references `id@n` to the last revisions of the entities a new `id` replaces (OM-I04, OM-I06, a split or a join), with edge label `supersedes` (LN-X02). It records lineage, not status: whether the old entity is in use is said only by its `retired` fact (TR-F04). Its reverse — the successors of an entity — is read from referrers (OM-R05), one step, and never stored. A `supersedes` reference to a retired entity raises no finding OM-R04: pointing to what left use is its purpose. |

## Envelope

```json
// entity revision
{ "id": "lattice/decision-pattern", "rev": 3, "type": "std/composition@2",
  "hash": "sha256:…", "by": "<session>", "at": "2026-09-30T12:00:00.000Z", "body": { … } }

// event
{ "id": "01J…", "type": "std/verdict@1", "by": "<session>", "at": "…",
  "body": { "of": { "run": "01H…" }, … } }
```

| ID | Rule |
|---|---|
| OM-E01 | The header is minimal and fixed: entity `{id, rev, type, hash, by, at, body}`, event `{id, type, by, at, body}`. A new header field requires a new kernel version. |
| OM-E02 | `type` is always a pinned reference `type@n`. |
| OM-E03 | Order is defined by the ledger, not by `at`. `at` is for humans only; only the kernel formats it, from the integer UTC milliseconds of the `clock` port (PL-K01). |
| OM-E04 | Every event body has `of: {role: ref@n}` — what the event is about. |

## Hash and canonical form

| ID | Rule |
|---|---|
| OM-H01 | `hash = sha256(JCS({type, body}))`, where `type` is the pinned reference `type@n` (OM-E02) — canonical JSON per RFC 8785. The same body under another type revision is another hash, so moving a block to `type@n+1` (OM-T05) is never a no-op. |
| OM-H02 | Strings are normalised to NFC on write. Input is validated as I-JSON and rejected, never repaired: duplicate keys, non-finite numbers, `-0`, integers outside ±2^53 (larger values are strings). Repairing during canonicalisation would make body and hash diverge. |
| OM-H03 | Writing a body whose hash equals the hash of the current revision (TR-I01) is a no-op: no new revision. The event counterpart is TR-F07. |
| OM-H04 | The kernel has a global size limit for a body; types add `maxLength` per field. |
| OM-H05 | Hash test vectors never change between kernel versions. They are RFC 8785 Appendix B plus NFC vectors, in one frozen file. JCS is own code, not an npm package. |

## References

| ID | Rule |
|---|---|
| OM-R01 | A reference is floating (`id`, latest revision) or pinned (`id@n`). |
| OM-R02 | Pinned references are required wherever replay or calibration depends on them: decision points, pipelines, runs, calibration. Floating references are allowed only for navigation and compositions, so that a change to a block is visible to every referrer. Which is allowed where is declared per field in the type and checked by code. |
| OM-R03 | A pinned reference to a revision that does not exist rejects the write (hard check). |
| OM-R04 | A reference to a retired entity is a finding (TR-N02), not a rejection: old decisions legitimately point to things retired later. A `supersedes` reference is exempt (OM-I07). |
| OM-R05 | **Referrers** — the reverse index of all references, pinned and floating, from entities and events — is a projection, not data. Its meaning is defined here; its storage is defined by the ledger. |
| OM-R06 | Resolution through `alias` (TR-F05): a floating reference to an alias resolves to its canonical entity; a pinned reference `A@n` stays `A@n`. |

## Types

| ID | Rule |
|---|---|
| OM-T01 | A type is an entity. There is one meta-type, typed by itself — the only self-reference, created by kernel code. |
| OM-T02 | A type holds: `extends`, `schema`, `unique` (uniqueness fields, OM-D01), reference rules per field (OM-R02), `card`. Write permissions, owners and which writes need an owner act are not part of the type (CT-N03). |
| OM-T03 | `extends` has exactly one parent. A child may only narrow: add fields, tighten constraints, add fields to `card`, narrow the `in_force` bases (TR-I01). It can never loosen the parent. Every block of a child is a valid block of its parent. |
| OM-T04 | Roles (decision, rationale, invariant, term, rule, …) are types extending one of a few base entity types: `knowledge`, `composition`, `behaviour`, `capability`, `decision-point`, `hint` (the only base type that lists `inferred` in `in_force`, TR-I02). `behaviour` is the base of the blocks LATTICE reads to act (GL-01): pipeline, `setup`, `judge`, adapter block (PL-A05), namespace. A bench item extends `knowledge`. Event types — fact types (TR-F01), session, run record, question — extend none of these. The types LATTICE itself reads are `std` types (OM-L02). There are no semantic tags without a schema. |
| OM-T05 | A block is validated against the type revision it references (`type@n`). New writes must use the latest revision of the type. Moving old blocks to a new type revision is explicit — new block revisions, no silent migration. |
| OM-T06 | `schema` uses a closed subset of JSON Schema: field types, `required`, `enum`, `maxLength`, `items`, reference to a type. Anything else is rejected. The subset grows only with a kernel version. No own DSL (DP-B09). |
| OM-T07 | `extends` is a pinned reference `id@n`, without cycles (inside one commit too), depth at most 4. Closedness of a schema is computed over the union of fields of the whole chain. Status fact types (TR-F05) cannot be extended. |
| OM-T08 | Exit paths — revocation and `retired` — are never blocked by rules tightened for new content: a stricter type revision or policy never prevents taking something out of use. |

## Composition

| ID | Rule |
|---|---|
| OM-C01 | The body of a `composition` holds only references and structural labels (order, section, heading). Free text is forbidden by the schema of the composition type (OM-T06), so apply rejects it like any other schema violation. Text needs its own block and a reference to it. |
| OM-C02 | Hierarchies (ecosystem → application → domain → contract → ADR → decision) are projections for navigation. Physically everything is a graph of references, not a tree. |

## Cards

| ID | Rule |
|---|---|
| OM-A01 | A type declares `card: [fields]`; default `title` + `summary`. |
| OM-A02 | A card is computed from a revision and never stored (OM-K02). |
| OM-A03 | Card text is English. The card is the only text of a block the judge reads; its sufficiency is measured on the bench, per kind of block (BN-M02). The full text is read by an LLM, not the judge. A point's `state` (DP-M04) is run input, not block text. |

## Duplicates

| ID | Rule |
|---|---|
| OM-D01 | Exact duplicates: a type declares its uniqueness fields in `unique`; a write producing existing values is rejected by apply. (`key` is reserved for fact keys, TR-F01.) |
| OM-D02 | Semantic duplicates: found by the "duplicates" decision point (01), producing alias candidates. A merge is an `alias` status fact by the owner (TR-F05, TR-F06): the alias points to its canonical entity and can be revoked. |
| OM-D03 | Uniqueness (OM-D01) is scoped to the author's namespace. `unique` fields must be `required`. Only entities in use count — not retired and not an alias. Revoking `retired` or `alias` re-checks uniqueness. A new type revision that changes `unique` is checked against every block in use. |

## Layers and kernel

| ID | Rule |
|---|---|
| OM-L01 | `core` — the meta-type and the session event type, both created by kernel code at store genesis (LG-G01). |
| OM-L02 | `std` — base types (OM-T04), status fact types (TR-F05), the types that 03–08 name (pipeline, `setup`, `judge`, adapter block, namespace, session, run record, question, bench item, report, source listing, `example`) and the blocks of built-in capabilities and adapters (PL-C03); a data package shipped with a LATTICE version and loaded through apply by a named path (LG-G02). |
| OM-L03 | Project — own types via `extends` from `std`. |
| OM-L04 | Kernel code contains only: envelope and header, canonical form and hash, the meta-type, schema validation over the closed subset, reference grammar and resolution. Every type, base types included, is data. The kernel changes only by version. The kernel is an internal seam of apply (LG-A03); namespace policy and trust rules live above it (module `trust`, ST-M01). Its perimeter is checked by a structure test (ST-K01). |

## Depends on (not yet designed)

| Topic | Document |
|---|---|
| order, storage, referrers storage, no-op mechanics | resolved: [03-ledger](03-ledger.md) LG-S01, LG-J01…J04, LG-C05 |
| namespaces, owners, write permissions | resolved: [04-catalog](04-catalog.md) CT-N01…N06 |
| fact keys, "what is in force", verdicts | resolved: [05-trust](05-trust.md) TR-F01…F07, TR-I01…I04, TR-V01…V06 |

## History

- 2026-09-30 — grilled (22 questions).
- 2026-10-01 — unified-architecture review, grilled: `retired` and `alias` are status facts (OM-K03, OM-D02), `unique` replaces the type's `key` (OM-T02, OM-D01), base type `hint` (OM-T04), composition text checked by schema (OM-C01), `state` is not block text (OM-A03), kernel as a seam of apply (OM-L04).
- 2026-10-01 — design v0.6 audit (`reviews/2026-10-01-design-v06-audit.md`), grilled: hash covers `type@n` (OM-H01), I-JSON rejection (OM-H02), frozen vectors (OM-H05), id grammar (OM-I05, OM-I06), `at` from `clock` (OM-E03), alias resolution (OM-R06), `extends` limits (OM-T03, OM-T07), exit paths (OM-T08), uniqueness scope (OM-D03).
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): runs, not decisions, are events and pinned referrers (OM-K01, OM-R02, envelope example); event `id` carried by the intent (OM-I02); no-op against the current revision (OM-H03); `core` holds the session type, `std` holds the types 03–08 name and built-in blocks (OM-L01, OM-L02, OM-T04); module `trust` (OM-L04).
- 2026-10-01 — corrections F1–F6: `supersedes` as lineage in every base type (OM-I07), exempt from the retired-reference finding (OM-R04).
- 2026-10-01 — deepening review (`reviews/2026-10-01-design-next-deepening.md`), grilled: base type `behaviour` replaces the undefined `rule`, event types outside base entity types (OM-T04, OM-I07); full list of `std` types (OM-L02).
