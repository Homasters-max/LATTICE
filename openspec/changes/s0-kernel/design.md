# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/kernel/spec.md` of this Change. Today `src/kernel/` holds the format
of design v0.6 (11 files, ~950 lines, REQ-KR-001…007): `checkInput` (own RFC 8259 parser: I-JSON, NFC, depth 64,
`$enc` and `$ref` refusals), `canonical` (JCS over an explicit stack), `hash` / `valueId` (`sha256(JCS({body, type}))`
with an unpinned type id), `parseRef` / `formatRef` (identifiers, value id `#hex32`, reserved `#label:hex`), `newId`,
`refsOf` (`$ref` markers), `revision` (`{id, type, version, at, by, body}`), the Unicode 16.0 table. The structure test
(REQ-AR-005, REQ-AR-007) keeps it pure: relative imports, `createHash` from `node:crypto`, a closed list of globals
(`WeakMap` yes, `WeakSet`, `TextEncoder`, `Buffer` no), `new Date(x).toISOString()` as the only `Date` form.

### Kernel review, refreshed 2026-10-02

The issue asks to refresh `design-next/reviews/2026-09-30-kernel-architecture.md` first. That file is outside the
`write_scope` of every Run of this Change (the guard refuses it), so the refresh is recorded here; it is the input of
the decisions below.

What changed since 2026-09-30:

| Then | Now | Source |
|---|---|---|
| A `$ref` marker in a body is how references are found | Not taken: references are the fields a type declares | NX-15, OM-R02 |
| `$enc` is a reserved key | Not taken | NX-20 |
| `hash` over the type id without `@n` matches OM-H01 | OM-H01 hashes the pinned `type@n` | OM-H01, OM-E02 |
| The kernel has no callers | `ledger`, `codec`, `assembly` call `checkInput`, `canonical`, `hash`, `parseRef`, `newId`; the skeleton left I-1 (record hash over `type@n`), I-2 (`at` by the kernel), I-23 (two record shapes) for the kernel | `s0-skeleton` design |
| The kernel is "frozen v1" | Kernel version `0` until the switch: stores are disposable, a kernel change is free | LG-G05, LG-G06 |
| One kernel Change does everything | `s0-kernel` (KR) runs beside `s0-apply-checks` (LG) and `s0-store` (SR); two parallel Changes never share a source path | SL-T08 |

Candidates, re-rated, and what this Change does with each:

| # | Candidate | Strength | Here |
|---|---|---|---|
| 1 | Deepen admission: text and type → typed, hashed body | Strong (top) | `admit` (REQ-KR-013), D-3, D-4 |
| 2 | References: an output of admission, found by the schema (was: one semantics of `$ref`) | Strong | `refs` of `admit`, `ref` nodes (REQ-KR-015); `refsOf`, `refObject` deleted — the Kelvin-sign disagreement goes with them |
| 3 | Envelope module: revision and hash in one record (was: Worth exploring) | Strong | `entity`, `event`, `formatAt` (REQ-KR-017), D-7 |
| 4 | Shrink the interface — in two steps, because the callers are held by parallel Changes | Strong | step 1 here (value kind, reserved scheme, `$enc`, `$ref`, `refsOf`, `revision`); step 2 in #83, D-1 |
| 5 | Typed refusal catalogue (was: Speculative) | Worth exploring | the new functions close their codes as union types, D-9 |
| 6 | Meta-type and schema subset: types as data, one checker (new) | Strong | `metaType`, `schema.ts` (REQ-KR-015, REQ-KR-016), D-5, D-6 |

Facts kept from the review: JCS is own code (OM-H05); the RFC 8785 vectors live in `test/fixtures/jcs-vectors.json`;
`contract.test.ts` and `scenarios.test.ts` go through `index.ts`, `environment.test.ts` imports `unicode16.ts`; no test
composed `checkInput → hash → revision`. Callers of the kernel on `main` (2026-10-02): `ledger/commit.ts`
(`canonical`, `checkInput`, `hash`), `ledger/proposal.ts` (`canonical`, `checkInput`, `hash`, `parseRef`),
`ledger/apply.ts` (`canonical`), `ledger/records.ts` (types `Hash`, `Id`), `codec/import.ts` (`checkInput`, type
`Id`), `codec/export.ts` and `codec/table.ts` (`parseRef`), `assembly/index.ts` (`canonical`, `checkInput`, `newId`),
`test/cli/apply.test.ts` (`canonical`, `hash`, `newId`).

## Goals / Non-Goals

**Goals:**
- One deep admission interface that owns "admitted body": parse, size, schema, hash over `type@n`, references.
- The meta-type and the schema subset `s0-bootstrap` (#59) loads `std` against, and apply (#56) validates with.
- Every old kernel file is re-bound to a requirement of this Change or deleted (SL-T02); the spec `kernel` is English
  and bound to `design-next` IDs (SL-T03).
- No source path outside `src/kernel/**` and `test/kernel/**` (and the vector file), so wave 2 runs in parallel.

**Non-Goals:**
- Everything proposal.md, Non-goals, names — above all, moving the callers (#83).
- Performance beyond "linear in the size of the input": bodies are at most 1 MiB (D-4).

## Decisions

### D-1. The callers are not edited; a transitional interface carries them to #83

Every name `ledger`, `codec`, `assembly` and `test/cli` import from the kernel stays, with its behaviour:
`checkInput`, `canonical`, `parseRef` are re-bound to new requirements (REQ-KR-009, REQ-KR-010, REQ-KR-012); `hash`
and `newId` are kept under the transitional REQ-KR-018; the types `Hash` and `Id` stay. Two behaviours change and no
caller depends on them: `checkInput` no longer refuses objects with `$ref` or `$enc` (the codec refuses a header cell
starting with `$` itself, skeleton I-7), and `parseRef` refuses `#…` as `bad-ref` (`ledger/proposal.ts` refuses a
leading `#` itself). The record hash over `type@n` (I-1), `at` by `formatAt` (I-2), one record shape (I-23), the
identifiers of OM-I01, OM-I02, OM-I05 and the removal of REQ-KR-018 are issue #83, after #56, #57 and #58.

Rejected: editing the call sites here — `ledger/commit.ts`, `ledger/proposal.ts` and `assembly/index.ts` are in the
paths of `s0-apply-checks` (#56) and `s0-store` (#57), and SL-T08 forbids two parallel Changes on one source path.
Rejected: changing the reference grammar to OM-I05 here — `assembly` writes session ids `namespace/ULID` with upper
case letters, which the slug of OM-I05 refuses, so the grammar moves with its callers in #83.

### D-2. Source layout

| File | Holds | Was |
|---|---|---|
| `index.ts` | the interface of REQ-KR-008, re-exports only | same |
| `types.ts` | `Result`, `Refusal`, `ok`, `fail`, `refusal`, `segment`; brands `Id`, `Hash`; `Ref`, `Type`, `Admitted`, `BodyRef`, `EntityRecord`, `EventRecord`; the code unions (D-9) | same, extended |
| `strings.ts` | `hasLoneSurrogate`, the admission of one decoded string (lone surrogate, unassigned, NFC) | `admit.ts` |
| `unicode16.ts` | the table of assigned code points | unchanged |
| `input.ts` | `checkInput` (REQ-KR-009) without the `$ref` / `$enc` branches | same |
| `canonical.ts` | `canonical` (REQ-KR-010); `eachObject` removed | same |
| `ref.ts` | identifier and reference grammar, `parseRef`, `formatRef` (REQ-KR-012); value id, reserved scheme, `refObject` removed; `checkAt` keeps the positions the kernel still uses | same |
| `schema.ts` | the subset check of a schema and the validation of a body against a chain, collecting `refs` (REQ-KR-014 validation part, REQ-KR-015) | new |
| `meta.ts` | the body of the meta-type (REQ-KR-016) | new |
| `admission.ts` | `admit`, `typeOf`, `metaType`, the registry of kernel-made values (D-3), `deepFreeze` | new |
| `envelope.ts` | `entity`, `event`, `formatAt` (REQ-KR-017) | `revision.ts` |
| `transitional.ts` | `hash`, `newId` (REQ-KR-018) | `hash.ts`, `ids.ts` |

Deleted: `admit.ts`, `hash.ts`, `ids.ts`, `refs.ts`, `revision.ts`. Tests: `test/kernel/**` — `vectors.ts` (the
cases of the table-driven scenarios), `scenarios.test.ts`, `contract.test.ts` (purity SCN-KR-026, RFC vectors, the
vector file), `environment.test.ts` (SCN-KR-036), and `admission.test.ts`, `schema.test.ts`, `envelope.test.ts` for
REQ-KR-013…017. The vector file `test/fixtures/jcs-vectors.json` (D-8). The `implement` Run is narrowed to
`src/kernel/**,test/kernel/**,test/fixtures/jcs-vectors.json,openspec/changes/s0-kernel/**`.

### D-3. Kernel-made values are recognised by a registry, not by shape

`admit` takes only a `Type` made by `typeOf` or `metaType`, and `entity` / `event` only an `Admitted` made by `admit`
(REQ-KR-013, REQ-KR-017): a module-level `WeakMap` in `admission.ts` maps each such frozen object to its hidden data
(the schema chain of a type; nothing for an admitted body). So a body that never passed admission cannot reach a
record, and a schema chain that was never checked cannot validate a body — the hazard of the review, closed by the
interface instead of by caller discipline. `Type` exposes `ref` and `body`; the chain stays inside the kernel. Plain
data, no class (ST-M03).

Rejected: a brand only in TypeScript — JavaScript callers and `as` casts pass it; the review's hazard was exactly an
unchecked value reaching the hash.

### D-4. The hash and the size limit

- `admit` hashes `{"type": type@n, "body": body}` (OM-H01) and writes it `sha256:<64 hex>` as the envelope of OM-Z02
  shows. The transitional `hash` keeps 64 bare hex digits: the commit and proposal hashes of `ledger` and its fixtures
  do not change here; their form is decided once, with the callers, in #83 (skeleton I-19).
- The size limit (OM-H04) is 1 048 576 bytes of the UTF-8 encoding of the canonical form of the body: the canonical
  form, because it is what is hashed and stored, independent of whitespace and escapes; 1 MiB, because an event body
  can be a run record with its tape (PL-R01), and blocks are bounded much tighter by `maxLength` of their types. The
  byte count is computed from code points (1–4 bytes each), since `TextEncoder` is not an allowed global of the kernel
  (REQ-AR-005). The limit is a constant of the kernel version.

Rejected: a limit on the text — the same body would pass or fail depending on its escapes.

### D-5. The schema subset

- A reference field is a `string` node with `ref: <type id>` and an optional `pinned` (REQ-KR-015): the type declares,
  per field, what the field references and whether it must be pinned (OM-R02, OM-T02 "reference rules per field").
  Admission checks the grammar and the pin; existence and the type of the target are apply's (OM-R03), which gets
  them from `refs`.
- `schema` is a field type: its value is itself a schema of the subset. The meta-type needs it to declare the
  `schema` of a type body, and so to be typed by itself (OM-T01).
- Objects are closed: there is no `additionalProperties`; a member that no node declares is `unknown-field`.
- `maxLength` counts code points of the NFC string, as JSON Schema does.
- The root of every schema is an `object` node: every body is an object (an event body needs `of`, OM-E04).

Rejected: JSON Schema `$ref` for references — in JSON Schema it reuses a schema, not an entity, and NX-15 removed
markers. Rejected: `format`, `pattern`, `minLength`, `minimum` — not in OM-T06; the subset grows only with a kernel
version.

### D-6. Validation against an `extends` chain

`typeOf` takes the chain resolved by the caller (apply reads it from the projection) and checks its links (each
`extends` is the pinned reference of the next record, the last has none, at most five records). A body is valid when
it fits every schema of the chain, with the closedness of the root computed over the union of the root properties of
the chain (OM-T07). So a child adds fields and tightens constraints by declaring a property again; nothing is merged.
That every child narrows its parent (OM-T03) is not checked here: no S0 type needs it yet (proposal, Non-goals).
A type never extends a revision of its own `id`, so a chain is a list of distinct ids. The schemas used are the
admitted copies (NFC, frozen), never the caller's records.

One refusal per place: a member is checked against the nodes that declare it, child first, and only the first node
that refuses it reports; within a node the first check in the order `wrong-type`, `too-long`, `not-in-enum`, `bad-ref`
reports. So `errors` is one list for every implementation (spec review 1, F-1), and a child's tighter rule shadows the
parent's at the same place, which is what a narrowing child means.

Rejected: merging the chain into one schema — it needs the narrowing rules of OM-T03 to be well defined. Rejected:
reporting every distinct code at a place — more refusals for one cause, and an order across the chain to define.

### D-7. The envelope

`entity` and `event` take a header object and an admitted body and return a deeply frozen record whose keys are in the
order of OM-E01; `at` is formatted by `formatAt` from integer milliseconds with `new Date(ms).toISOString()`, the one
`Date` form the structure test allows. The kernel checks `of` on every event body (OM-E04) independently of the event's
type: an object whose values are references. Until #83 an entity id and an event id have the same grammar, so the
kernel cannot tell a pinned entity revision from an event by the reference alone; apply resolves it (OM-R03). An empty
`of` is allowed — UNKNOWN `UNK-KR-009` of this Change, closed as an assumption (D-11).

### D-8. The frozen vector file

`test/fixtures/jcs-vectors.json` gets two sections next to the RFC 8785 vectors: `nfc` (eight pairs of code point
lists, REQ-KR-011) and `hash` (the hash of `{"s": <string>}` under `test/s@1` for each pair). After the impl-PR merges,
the file never changes (OM-H05): `contract.test.ts` holds the sha256 of its bytes as a constant. The hash vectors are
computed once by the implementation and checked by hand against `sha256` of the canonical text before they are
frozen.

### D-9. Refusal codes are closed per function

`types.ts` declares a union of codes for each new function (`AdmitCode`, `TypeOfCode`, `EnvelopeCode`, `FormatAtCode`)
and for the re-bound ones (`InputCode`, `CanonicalCode`, `RefCode`); `Refusal` stays `{ code: string; path: string }`
for the callers, and every function returns a `Result` whose `errors` carry its own union. A code outside the
requirement does not type-check (review candidate 5).

### D-10. Tests

Every test is inside `describe` and carries the `SCN-KR-…` token of its scenario in its name (REQ-AR-006). The
table-driven cases keep the shape of `vectors.ts` (`{scn, fn, name, args, errors | value | check}`); the purity test
(SCN-KR-026) runs every case of SCN-KR-027…062 twice with argument snapshots and checks deep freezing. The cases of the
old SCN-KR-001…025 are carried over to their new scenarios (spec, REMOVED, Migration). `npm test` and
`npm run typecheck` stay green with the callers unchanged (D-1); `test/cli/**` and `test/e2e/**` are the check that
the transitional interface kept its behaviour.

### D-11. Slice-level decisions

Recorded on umbrella #44: the callers stay on the transitional interface until #83 (D-1); `refs` of `admit` is the
input of OM-R03 for #56; `metaType` and `typeOf` are what #59 loads `std` with; record hashes carry `sha256:`. An
empty `of` on an event (the session event of CT-P01 is about nothing) is the non-blocking UNKNOWN `UNK-KR-009`,
closed as an assumption; the maintainer's answer in the spec-PR replaces it.

### D-12. Spec review 1

Review `EVID-01M3XSKM4BZXCMETZT50PH8E0K` (`NOT_PROVEN`, 18 findings) and how each is closed in the spec of this Change:

| Finding | Closed by |
|---|---|
| F-1 (BLOCKER) several refusals at one place | one refusal per place: first node of the chain, first check of the node (REQ-KR-014, REQ-KR-015, D-6); SCN-KR-049, SCN-KR-052 extended |
| F-2 JSON type of a `schema` node | object; anything else `wrong-type` (REQ-KR-015); SCN-KR-055 extended |
| F-3 node without a valid `type` | only `bad-keyword` at `type` (REQ-KR-015); SCN-KR-051 extended |
| F-4 `metaType` mutable | deeply frozen (REQ-KR-008, REQ-KR-016); SCN-KR-054 |
| F-5 `Type.body` | the admitted copy, never the argument; schemas are the admitted copies (REQ-KR-014); SCN-KR-049 |
| F-6 identity of kernel-made values | defined, copies refused (REQ-KR-008, REQ-KR-013, REQ-KR-017); SCN-KR-048, SCN-KR-058 |
| F-7 `cli` cites removed requirements | REQ-KR-002 Migration, proposal Impact; #83 re-points them |
| F-8, F-9 order and shape in `typeOf` | record by record, links only between type records; array and record shapes (REQ-KR-014); SCN-KR-050 |
| F-10 what is frozen | the `value`, not the `Result` (REQ-KR-008) |
| F-11 SCN-KR-058 admissions | named |
| F-12 format v1 vector clause | dropped explicitly in the REMOVED REQ-KR-001 |
| F-13 Purpose of the spec `kernel` | proposal Impact; #83 |
| F-14 partial `Implements:` | a sentence under the line says the part covered (REQ-KR-013, REQ-KR-014, REQ-KR-016) |
| F-15 a type extending itself | `bad-extends` (REQ-KR-014); SCN-KR-050 |
| F-16 exported types, two `Hash` forms | shapes named, both forms stated until #83 (REQ-KR-008) |
| F-17 `of` values and OM-E04 | how `ref@n` is read, grammar until #83 (REQ-KR-017) |
| F-18 limits of `refs` | stated (REQ-KR-015) |

## Risks / Trade-offs

- [Two interfaces in one module until #83] → REQ-KR-018 names its removal and its issue; `index.ts` marks the two
  functions transitional; #83 is in milestone S0.
- [Two hash forms: `sha256:` for records from `admit`, bare hex for commits and proposals] → no value of one form is
  compared with the other in S0: `ledger` computes record hashes with the transitional `hash` until #83 switches it.
- [The meta-type body is data of kernel version `0` and may change before the switch] → no scenario pins its hash;
  the stores are disposable (LG-G05).
- [1 MiB may be wrong for some event] → a constant of the kernel version, changed freely before the switch.
- [Re-checking each type body in `typeOf` costs a meta admission per record] → chains are at most five records and
  type bodies are small.

## Implementation decisions

| ID | Decision | Reason | Decided by |
|---|---|---|---|
