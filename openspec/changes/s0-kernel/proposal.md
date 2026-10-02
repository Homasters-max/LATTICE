# Proposal

## Why

The kernel (`src/kernel/`) is the format of design v0.6: it admits a JSON text (`checkInput`), hashes a body under a
type id without `@n` (`hash`), finds references by a `$ref` marker (`refsOf`), reserves `$enc`, has a value kind
(`valueId`, `#hex32`) and an old revision shape (`revision`, with `version`). `design-next` keeps the canonical form,
the hash and the reference grammar (SL-T02) but drops the marker (NX-15), `$enc` (NX-20) and the value kind (OM-K02),
hashes over the pinned `type@n` (OM-H01), and puts in the kernel what it does not have yet: the envelope of entity and
event records (OM-E01…E04), a body size limit (OM-H04), a closed JSON Schema subset (OM-T06) and the meta-type
(OM-T01). Slice S0 needs them: `s0-bootstrap` (#59) loads `std` against the meta-type, apply validates a body against
its type, and SL-T07 (2) freezes the kernel only when the subset covers every `std` type.

The kernel review of 2026-09-30, refreshed at the start of this Change (design.md, Context), names the hazard: a
correct record hash depends on every caller composing `checkInput → hash`, and the skeleton already composes it over
the type without `@n` (`s0-skeleton` I-1). Its top candidate is one admission interface from text and type to a typed,
hashed body. The launch grilling of 2026-10-01 (Q4, Q16, Q34) made this Change `s0-kernel` (#55): admission deepened,
schema subset, meta-type, envelope, hash, the old modules re-bound or removed, the spec `kernel` replaced.

## What Changes

- **Admission** `admit(text, type)`: parse (I-JSON, NFC, depth), size limit, validation against the schema chain of
  the type, hash `sha256(JCS({type: type@n, body}))` with the prefix `sha256:`; the result is the frozen body, its
  `type@n`, its hash and the references its schema declares. `typeOf(chain)` turns a type record and its `extends`
  chain into the type `admit` takes.
- **Schema subset** (OM-T06): object, array, string, integer, number, boolean, null; `properties` (closed),
  `required`, `enum`, `maxLength`, `items`, and a reference field `ref` with an optional `pinned` (OM-R02). Anything
  else is refused when a type is admitted.
- **Meta-type** `core/type@1`, typed by itself (OM-T01), built by kernel code: a type body holds `schema`, `extends`,
  `unique`, `card` (OM-T02).
- **Envelope**: `entity(header, admitted)` → `{id, rev, type, hash, by, at, body}`, `event(header, admitted)` →
  `{id, type, by, at, body}` with `of` checked (OM-E04), `formatAt(ms)` (OM-E03); records are frozen.
- **Kept and re-bound**: `checkInput` (OM-H02, without the `$ref` and `$enc` refusals), `canonical` (JCS, OM-H01,
  OM-H05), `parseRef` / `formatRef` (OM-R01, without the value id and the reserved scheme), the Unicode 16.0 table,
  the frozen vector file, now with NFC and hash vectors and a check that the file never changes (OM-H05).
- **Removed**: `valueId`, the value id `#hex32` and the reserved scheme `#label:hex`, `refsOf`, `revision` and the
  type `Revision`, the `$ref` and `$enc` handling of `checkInput`.
- **Transitional**, until #83 moves their callers: `hash(typeId, body)` (commit and proposal hashes of `ledger`) and
  `newId(namespace, ulid)` (session id of `assembly`), under one requirement that names their removal.
- **Spec `kernel` replaced**: REQ-KR-001…007 (Russian, design v0.6) are removed; REQ-KR-008…018 are written in English
  against `design-next`, each with an `Implements:` line (SL-T03).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `kernel`: REQ-KR-001…007 removed; REQ-KR-008…018 added — the kernel interface and its purity, parse, canonical
  form, frozen vectors, references, admission, type of an admission, schema subset, meta-type, envelope, and the
  transitional interface for the callers of S0.

## Impact

- Code: `src/kernel/**` only. Tests: `test/kernel/**`, `test/fixtures/jcs-vectors.json`.
- Callers (`src/ledger/**`, `src/codec/**`, `src/assembly/**`, `test/cli/**`) are not edited: every name they import
  stays with its behaviour, except that `checkInput` no longer refuses `$ref` and `$enc` objects and `parseRef` refuses
  the `#…` forms as `bad-ref`; no caller relies on either (design D-1).
- The structure test (`test/architecture/**`, owned by the skeleton) is not edited: the new files use only the
  allowed globals of REQ-AR-005.
- No new dependency; `package.json` unchanged.

## Non-goals

- Moving the callers to the new interface: the record hash over `type@n` in `ledger` (`s0-skeleton` I-1), `at` from
  `formatAt` in `assembly` (I-2), one record shape in `ledger` (I-23), the identifiers of OM-I01, OM-I02, OM-I05, the
  form of commit and proposal hashes, removing the transitional interface — #83.
- Apply checks over admitted bodies: the no-op on an equal hash (OM-H03 on the commit side, LG-C05), existence and
  type of pinned targets (OM-R03), uniqueness (OM-D01, OM-D03) — `s0-apply-checks` (#56).
- Genesis and `std`: the record of the meta-type, the session event type, the base types (LG-G01, LG-G02, OM-L01,
  OM-T04) — `s0-bootstrap` (#59).
- Narrowing of a child type against its parent (OM-T03), status fact types that cannot be extended (OM-T07, last
  sentence), the `in_force` field of a type (TR-I01), cards (OM-A01…A03): no S0 Change reads them yet.
- Resolution through `alias` (OM-R06) and referrers (OM-R05): `s0-projections` (#60) and later slices.
