# Spec Delta

## REMOVED Requirements

### Requirement: Отказ — значение, функции ядра чистые
<!-- id: REQ-KR-001 -->

**Reason**: Replaced by REQ-KR-008 "The kernel interface: refusals are values, functions are pure", written against
`design-next` OM-L04 with the interface of this Change (launch grilling 2026-10-01, Q16).

**Migration**: The function list changes (`valueId`, `refsOf`, `revision` removed; `admit`, `typeOf`, `entity`,
`event`, `formatAt`, `metaType` added); the guarantees (no exception, no mutation, determinism) are unchanged and their
tests carry the tokens SCN-KR-026 and SCN-KR-027.

### Requirement: Входная проверка тела
<!-- id: REQ-KR-002 -->

**Reason**: Replaced by REQ-KR-009 "Parsing a JSON text: I-JSON and NFC" (OM-H02). The refusals `reserved-enc` and
`bad-ref` are not taken: `design-next` has no `$enc` key (NX-20) and no `$ref` marker (NX-15).

**Migration**: A `$enc` or `$ref` member is an ordinary member. Every other refusal, its place and its order are
unchanged; the tests carry the tokens SCN-KR-028…SCN-KR-036.

### Requirement: Каноническая форма — JCS
<!-- id: REQ-KR-003 -->

**Reason**: Replaced by REQ-KR-010 "Canonical form — JCS", the same rule in English (OM-H01, OM-H05).

**Migration**: Behaviour is unchanged; the tests carry the tokens SCN-KR-037…SCN-KR-040.

### Requirement: Хэш и идентификатор значения
<!-- id: REQ-KR-004 -->

**Reason**: The record hash of `design-next` is over the pinned `type@n` (OM-H01) and comes from admission
(REQ-KR-013); there is no value kind (OM-K02), so `valueId` is removed. The hash over a type id without `@n` stays only
as the transitional REQ-KR-018 for the callers of S0.

**Migration**: `valueId` has no caller. `hash(typeId, body)` keeps its behaviour under REQ-KR-018 until #83.

### Requirement: Идентификаторы и ссылки
<!-- id: REQ-KR-005 -->

**Reason**: Replaced by REQ-KR-012 "References" (OM-R01) without the value id `#hex32` and the reserved scheme
`#label:hex` (OM-K02, OM-I03); `newId` moves to the transitional REQ-KR-018.

**Migration**: A string starting with `#` is refused as `bad-ref` by `parseRef` and as `bad-id` by `formatRef`; no
caller passes one. `newId` keeps its behaviour under REQ-KR-018 until #83.

### Requirement: Ссылки в теле
<!-- id: REQ-KR-006 -->

**Reason**: `design-next` finds references through the fields of a type, never by a marker in a body (NX-15, OM-R02):
admission returns them (REQ-KR-013, REQ-KR-015).

**Migration**: `refsOf` has no caller; it is removed.

### Requirement: Ревизия
<!-- id: REQ-KR-007 -->

**Reason**: Replaced by the envelope of REQ-KR-017 (OM-E01…E04): `rev` instead of `version`, `hash` in the entity
header, the body admitted, the record frozen (SL-T02).

**Migration**: `revision` and the type `Revision` have no caller; they are removed.

## ADDED Requirements

### Requirement: The kernel interface: refusals are values, functions are pure
<!-- id: REQ-KR-008 -->

The module `src/kernel/index.ts` SHALL export the functions `checkInput`, `canonical`, `parseRef`, `formatRef`,
`admit`, `typeOf`, `entity`, `event`, `formatAt`, the constant `metaType`, the transitional functions `hash` and
`newId` (REQ-KR-018), and the types `Id`, `Ref`, `Hash`, `Refusal`, `Result`, `Type`, `Admitted`, `BodyRef`,
`EntityRecord` and `EventRecord`. Nothing else in `src/kernel/` is part of the interface.

Every function SHALL return either success `{ ok: true, value }` or refusal `{ ok: false, errors }`, where `errors` is
a non-empty list of `{ code, path }`: `code` is one of the codes the requirement of that function lists, and `path` is
a JSON Pointer (RFC 6901) to the place in the input the refusal is about. The input of a function with one parameter
is that argument (`""` is the whole argument); the input of a function with several parameters is an object with the
parameter names as keys (`admit`: `/text`, `/type`; `entity`, `event`: `/header`, `/admitted`; `formatRef`: `/id`,
`/version`; `hash`: `/typeId`, `/body`; `newId`: `/namespace`, `/ulid`). The order of refusals is the one the
requirement of each function states. A function SHALL NOT throw on any argument; an argument of a wrong JavaScript
type (`null`, `undefined`, a number where a string is expected, …) gives the refusal its requirement names for an
invalid value of that parameter, at the same path.

Every function SHALL be deterministic — equal inputs give equal results on every machine and every call — and SHALL
NOT change its arguments, call a getter or other code of an argument, perform I/O, or read the clock, the environment
or random numbers; time and ULIDs arrive as arguments. These guarantees do not extend to `Proxy` arguments. Every value
returned by `admit`, `typeOf`, `entity` and `event` SHALL be deeply frozen (`Object.isFrozen` holds for it and for
every object and array reachable from it), so a record read through the kernel cannot change (SL-T02).

Implements: OM-L04, ST-S03

#### Scenario: Invalid input is a refusal without an exception and without a change of the arguments
<!-- id: SCN-KR-026 -->
- **WHEN** every function is called with every input of the scenarios of its requirement (SCN-KR-027…SCN-KR-062),
  valid and invalid; before a call with an object argument a snapshot of it is taken by the descriptors of its own
  properties, without calling getters; every call is made twice
- **THEN** no call throws; every invalid input gives `ok: false` with a non-empty `errors`; the two results of one
  input are equal by content; object arguments equal their snapshots after the call; every successful result of
  `admit`, `typeOf`, `entity` and `event` is deeply frozen

#### Scenario: Arguments of a wrong type
<!-- id: SCN-KR-027 -->
- **WHEN** these calls are made: `checkInput(123)`, `parseRef(null)`, `formatRef(5)`, `formatRef("lattice/x", "1")`,
  `formatRef("Lattice/x", 0)`, `admit(5, metaType)`, `admit("{}", null)`, `admit("{}", {ref: "core/type@1"})`,
  `typeOf(null)`, `formatAt("0")`, `entity(null, null)`, `event(undefined, 1)`
- **THEN** the refusals are: `syntax` `""`; `bad-ref` `""`; `bad-id` `/id`; `bad-version` `/version`; in order
  `bad-id` `/id`, `bad-version` `/version`; `syntax` `/text`; `bad-type` `/type`; `bad-type` `/type`; `not-type`
  `""`; `bad-at` `""`; in order `bad-header` `/header`, `bad-admitted` `/admitted`; in order `bad-header` `/header`,
  `bad-admitted` `/admitted`

### Requirement: Parsing a JSON text: I-JSON and NFC
<!-- id: REQ-KR-009 -->

`checkInput(text)` SHALL take a JSON text (RFC 8259) as a string and return, on success, the parsed value in which
every string — every string value and every object key — is in Unicode normalization form NFC. The Unicode version of
the kernel is 16.0: NFC is that of Unicode 16.0 over strings of code points assigned in it. NFC is computed by the
runtime, so the runtime SHALL have Unicode 16.0 or later — a precondition the kernel does not read and the environment
test checks. The key `"__proto__"`, a key starting with `$` and every other key SHALL be an ordinary own member of the
resulting object. A number SHALL be the nearest IEEE 754 double. `lone-surrogate` and `unassigned` SHALL be checked on
the string after escapes are decoded and before NFC, by UTF-16 code units and code points: surrogates that form a pair
by code units are not lone, however each of them was written. NFC SHALL be applied only to strings that passed these
checks; every other check and every key in a `path` refer to strings after NFC. A key refused by `lone-surrogate` or
`unassigned` does not enter a `path`: a refusal inside the value of such a member gets the path of the object.

The text SHALL be refused with these codes; every refusal has a `path` and a position in the text by which refusals
are ordered:
- `syntax` — the text is not a JSON text of RFC 8259, including a byte order mark at the start, characters after the
  value, a comma after the last element, and an argument that is not a string; `path` `""`, position the place of the
  error;
- `too-deep` — arrays and objects nested deeper than 64 levels: a top-level container is level 1, a top-level scalar
  level 0; `path` the container of level 65, position its opening bracket;
- `duplicate-key` — an object member whose key after NFC equals the key of a member met earlier in the same object:
  one refusal per such member (the third duplicate is the second refusal); `path` that member, position the start of
  its key;
- `negative-zero`, `non-finite`, `unsafe-integer` — by the nearest double, at most one refusal per number, the first
  that applies in this order: `negative-zero` when the nearest double is `-0` (`-0`, `-0.0`, `-0e3`, `-1e-400`);
  `non-finite` when it is infinite (`1e400`, `1.7976931348623159e308`); `unsafe-integer` when it is an integer
  (whatever the notation: `2`, `2.0`, `2e0`) outside −(2^53−1) … 2^53−1 inclusive; `path` the number, position the
  start of its notation;
- `lone-surrogate` — a string value with a lone surrogate: `path` the string, position its opening quote; a key with a
  lone surrogate: `path` the object, position the opening quote of the key, and the value of that member is checked
  only for `syntax` and `too-deep` and does not take part in the duplicate check;
- `unassigned` — a string value or a key with a code point not assigned in Unicode 16.0 (general category `Cn` of UCD
  16.0, including the noncharacters `U+FDD0`…`U+FDEF` and `U+xxFFFE`, `U+xxFFFF`; private use code points are
  assigned); `path` and position as for `lone-surrogate`, with the same rule for a key; at most one refusal of
  `lone-surrogate` and `unassigned` per string or key, the first in this order.

A `syntax` or `too-deep` refusal SHALL stop the parse and be the only element of `errors`: the one of them whose
position comes first is returned; refusals of other codes found before it are dropped and the text is not checked
further. `too-deep` SHALL be returned for an input of any depth without exhausting the stack. All other refusals SHALL
be collected, in the order of their positions in the text; the check SHALL continue inside the value of a duplicate
member.

Implements: OM-H02

#### Scenario: NFC, the key __proto__ and keys starting with $
<!-- id: SCN-KR-028 -->
- **WHEN** `checkInput` gets the text `{"e\u0301": "cafe\u0301", "__proto__": {"a": 1}}` (JSON escapes: `e` and the
  combining acute U+0301), then the text `{"$ref": 5, "$enc": {"x": 1}}`
- **THEN** the first succeeds; the result has a key of the one code point U+00E9 whose value is `caf` and U+00E9; the
  member `__proto__` is an own property with the value `{"a": 1}`, the prototype of the result is unchanged; the second
  succeeds with the two own members `$ref` (5) and `$enc` (`{"x": 1}`)

#### Scenario: Numbers at the limits
<!-- id: SCN-KR-029 -->
- **WHEN** `checkInput` gets, one by one, the texts `9007199254740991`, `-9007199254740991`, `1.0`, `0.5`, `1e-300`,
  `9007199254740992`, `9007199254740993`, `-9007199254740992`, `1e300`, `2e0`, `-0`, `-0.0`, `1e400`, `-1e400`,
  `-1e-400`, `1e-400`, `1.7976931348623159e308`, `1.7976931348623157e308`
- **THEN** the first five succeed with the values 9007199254740991, −9007199254740991, 1, 0.5, 1e−300;
  `9007199254740992`, `9007199254740993`, `-9007199254740992`, `1e300` and `1.7976931348623157e308` are refused
  `unsafe-integer`; `2e0` succeeds with the value 2; `-0`, `-0.0` and `-1e-400` are refused `negative-zero`; `1e-400`
  succeeds with the value 0; `1e400`, `-1e400` and `1.7976931348623159e308` are refused `non-finite`; every refusal is
  the only element of `errors`, with `path` `""`

#### Scenario: Structural refusals and their places
<!-- id: SCN-KR-030 -->
- **WHEN** `checkInput` gets, one by one: `{"a":1,"a":2}`; `{"\u00e9":1,"e\u0301":2}`; `{"s":"\ud800"}`; a text whose
  string `s` holds the raw lone surrogate U+DC00; `[1,]`; the text `{}` preceded by the byte order mark U+FEFF; `{} x`;
  `{"a":-0,"b":{"$enc":1},"a":2}`; `{"x":[{"$enc":"q"}],"r":{"$ref":"std/need@2","k":1}}`
- **THEN** the refusals and places are: `duplicate-key` `/a`; `duplicate-key` — the path `/` followed by U+00E9;
  `lone-surrogate` `/s`; `lone-surrogate` `/s`; `syntax` `""`; `syntax` `""`; `syntax` `""`; for the eighth text two
  refusals in order, `negative-zero` `/a` and `duplicate-key` `/a`; the last text succeeds

#### Scenario: Nesting limit
<!-- id: SCN-KR-031 -->
- **WHEN** `checkInput` gets an array of 64 nested arrays (`[[…[]…]]`, 64 opening brackets), then of 65, then a text of
  100 000 opening brackets `[`
- **THEN** 64 levels succeed; 65 levels are refused `too-deep` with a `path` of 64 segments `/0`; the 100 000 brackets
  are refused `too-deep` (not `syntax`) without an exception

#### Scenario: Refusals that stop the parse
<!-- id: SCN-KR-032 -->
- **WHEN** `checkInput` gets, one by one: `[-0,` followed by 64 nested arrays and a closing `]`; 65 nested arrays and an
  extra `]` after them; `[[[`; `[-0`
- **THEN** the first is the only refusal `too-deep` with the `path` `/1` and 63 segments `/0` (the `negative-zero`
  refusal is dropped); the second is the only refusal `too-deep`; the third and the fourth are the only refusal
  `syntax` `""`

#### Scenario: Places of object-level refusals and escaping of the path
<!-- id: SCN-KR-033 -->
- **WHEN** `checkInput` gets, one by one: `{"a":1,"a":-0}`; `{"$enc":{"x":-0}}`; `{"a/b":1,"a/b":2}`; `{"m~n":-0}`;
  `{"a":1,"a":2,"a":3}`; `{"$ref":"a/b","$ref":5}`; the text `{"kX":-0}`, the text `{"kX":V}` and the text
  `{"$ref":"X"}`, where `X` is the escape of the lone surrogate D800 and `V` is 64 nested arrays
- **THEN** the refusals in order are: `duplicate-key` `/a`, `negative-zero` `/a`; `negative-zero` `/$enc/x`;
  `duplicate-key` `/a~1b`; `negative-zero` `/m~0n`; `duplicate-key` `/a`, `duplicate-key` `/a`; the only refusal
  `duplicate-key` `/$ref`; the only refusal `lone-surrogate` `""`; the only refusal `too-deep` `""`; the only refusal
  `lone-surrogate` `/$ref`

#### Scenario: Checks on the NFC form, surrogate pairs
<!-- id: SCN-KR-034 -->
- **WHEN** `checkInput` gets, one by one: `{"s":"warrant/Key"}`, where `K` is the Kelvin sign U+212A; `{"s":"X"}`,
  where `X` is the escape of the surrogate D83D directly followed by the code unit DE00 without an escape; `{"s":"X"}`,
  where `X` is the escapes of D83D and DE00; `{"s":"X"}`, where `X` is the escapes of DE00 and D83D in this order
- **THEN** the first succeeds and `s` is `warrant/Key` with the Latin `K` (U+004B); the second and the third succeed
  and `s` is the one code point U+1F600; the fourth is the only refusal `lone-surrogate` `/s`

#### Scenario: Code points outside Unicode 16.0
<!-- id: SCN-KR-035 -->
- **WHEN** `checkInput` gets, one by one, `{"s":"X"}`, where `X` is in turn U+0378, U+FFFF, U+FDD0, U+323B0, U+E0080,
  U+10FFFF (not assigned in Unicode 16.0), U+E000, U+F0000 (private use), U+1C89 (assigned in 16.0); then `{"kX":1}`,
  where `X` is U+0378, and `{"s":"Y"}`, where `Y` is U+0378 followed by the escape of the lone surrogate D800
- **THEN** the first six are the only refusal `unassigned` `/s`; the next three succeed; the key is the only refusal
  `unassigned` `""`; the last is the only refusal `lone-surrogate` `/s`

#### Scenario: The runtime has Unicode 16.0 or later
<!-- id: SCN-KR-036 -->
- **WHEN** the environment test reads the Unicode version of the runtime (`process.versions.unicode`)
- **THEN** the version is 16.0 or later; on a runtime below 16.0 the test fails with the version found in its message

### Requirement: Canonical form — JCS
<!-- id: REQ-KR-010 -->

`canonical(value)` SHALL return the canonical form of the value by JCS (RFC 8785) without changes: keys ordered by
UTF-16 code units, numbers by the ECMAScript serialization rule, strings with the minimal escaping of RFC 8785, no
whitespace. The bytes of the canonical form are its UTF-8 encoding. `canonical` SHALL NOT normalize strings: NFC is
the business of `checkInput` and `admit`. The number `-0` SHALL be written as `0` (RFC 8785). The JCS code is the
kernel's own, not a package.

`canonical` is defined on JSON values, not on admitted bodies: a finite number of any size, integers outside
±(2^53−1) included (the RFC 8785 vector `1E30` and the large integers of Appendix B), is written, though `checkInput`
would refuse its notation.

The walk SHALL go depth first: object members in the key order of the canonical form, array elements by index. An
object member is an own enumerable data property with a string key; an array element is an own data property with an
index. `canonical` SHALL NOT call getters or other code of the value. The depth of a value is not limited:
`canonical` SHALL return a result for a value of any depth without exhausting the stack.

On entering an object the checks SHALL go in this order: the prototype; symbol keys; then all own string keys —
members and non-members — in UTF-16 code unit order, for each first the kind of property, then its value. For an
array: symbol keys; elements by index (a hole, an accessor property); then the other own string keys except `length`,
in UTF-16 code unit order.

`canonical` SHALL refuse with the code `not-json` a value that is not a JSON value; the refusal is the only one, with
`path` at the first such place in walk order: `undefined`, a function, a symbol, a `bigint`, a non-finite number, a
string or key with a lone surrogate, an object whose prototype is neither `Object.prototype` nor `null` (except an
array — a value for which `Array.isArray` holds and whose prototype is `Array.prototype`; an array with another
prototype is `not-json` at the path of the value), an array with holes, a non-enumerable array index (`path` the
element), an accessor property (`path` the property), a non-enumerable own property with a string key (`path` the
property), an own property with a symbol key (`path` the object), an own property of an array other than its indices
and `length` (`path` the property), a cyclic reference — an object already on the current path of the walk from the
root (`path` the place where it appears again). An object met again off the current path (a shared sub-object) is not
a cycle.

Implements: OM-H01, OM-H05

#### Scenario: RFC 8785 test vectors
<!-- id: SCN-KR-037 -->
- **WHEN** `canonical` gets the inputs of the RFC 8785 vectors of the frozen vector file (REQ-KR-011): the example of
  section 3.2.2 (`numbers`, `string`, `literals`), the sorting example of section 3.2.3 and every number of the table
  of Appendix B given by its IEEE 754 bits — directly, not through `checkInput`
- **THEN** the output of every vector is byte for byte the expected output of the RFC; the numbers NaN and Infinity of
  the table are refused `not-json`

#### Scenario: Not a JSON value
<!-- id: SCN-KR-038 -->
- **WHEN** `canonical` gets `{"a": [1, undefined]}`, `{"b": 1n}`, `{"c": new Date(0)}`, `[1, , 3]`, an object that
  refers to itself by the key `s`, the string `"\ud800"` with a lone surrogate and the value `-0`
- **THEN** the refusals are `not-json` at `/a/1`, `/b`, `/c`, `/1`, `/s`, `""`; `-0` succeeds with `"0"`

#### Scenario: Walk order, shared sub-object, kinds of properties
<!-- id: SCN-KR-039 -->
- **WHEN** `canonical` gets, one by one: `{b: undefined, a: undefined}`; `{a: x, b: x}`, where `x` is one and the same
  empty object; an object with a getter `g` that sets a flag when called; an object with a symbol key; an object
  `{v: 1}` with a non-enumerable own property `n`; an array `[1]` with an own property `p`; `{z: undefined}` with a
  non-enumerable own property `a`; `{a: undefined}` with a symbol key; `{v: m}`, where `m` is an array `[1]` with the
  prototype `null`; an array `[1, 2]` with a non-enumerable index `1`
- **THEN** the first is refused `not-json` `/a`; the second succeeds with `{"a":{},"b":{}}`; the third is refused
  `not-json` `/g` and the flag is not set; the fourth is refused `not-json` `""`; the fifth `not-json` `/n`; the sixth
  `not-json` `/p`; the seventh `not-json` `/a`; the eighth `not-json` `""`; the ninth `not-json` `/v`; the tenth
  `not-json` `/1`

#### Scenario: A deep value built in code
<!-- id: SCN-KR-040 -->
- **WHEN** `canonical` and `hash("std/x", …)` (REQ-KR-018) get an array of depth 100 000 built in code (every level an
  array of one element, the deepest one empty)
- **THEN** no call throws; `canonical` succeeds with a string of 100 000 `[` and 100 000 `]`; `hash` succeeds

### Requirement: Frozen hash vectors
<!-- id: REQ-KR-011 -->

The test vectors of the canonical form and the hash SHALL live in one file, `test/fixtures/jcs-vectors.json`: the
vectors of RFC 8785 (section 3.2.2, section 3.2.3, Appendix B), the NFC vectors and the hash vectors below. The file
SHALL never change between kernel versions: a kernel test holds the sha256 of the bytes of the file as a constant and
fails when they differ.

An NFC vector is a pair of strings given by their code points: an input and its NFC form. The file holds at least
these: U+0065 U+0301 → U+00E9; U+0041 U+030A → U+00C5; U+212B → U+00C5; U+212A → U+004B; U+1E9B U+0323 → U+1E9B
U+0323; U+1100 U+1161 → U+AC00; U+0958 → U+0915 U+093C; U+00E9 → U+00E9. A hash vector is, for each NFC vector, the
hash that `admit` gives to the body `{"s": <string>}` under the type `test/s@1`, whose schema is
`{"type": "object", "properties": {"s": {"type": "string"}}, "required": ["s"]}` (REQ-KR-014, REQ-KR-015).

Implements: OM-H05, OM-H02

#### Scenario: The vector file is frozen and reproduced
<!-- id: SCN-KR-041 -->
- **WHEN** the kernel test reads `test/fixtures/jcs-vectors.json`, and for every NFC vector admits the JSON texts of
  `{"s": <input>}` and `{"s": <NFC form>}` under the type `test/s@1`
- **THEN** the sha256 of the bytes of the file equals the constant of the test; the file holds the eight NFC vectors
  above; for every vector both admissions succeed, `body.s` of both is the NFC form, and both hashes equal the hash
  vector of the file

### Requirement: References
<!-- id: REQ-KR-012 -->

An identifier SHALL have the form `namespace "/" local`: `namespace` is `[a-z][a-z0-9-]*` followed by zero or more
parts `"." [a-z0-9-]+`, at most 64 characters in all; `local` is `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`, case-sensitive.
A reference SHALL have the form `id` (floating) or `id "@" version` (pinned), where `version` is a decimal integer
without leading zeros from 1 to 2^53−1.

`parseRef(s)` SHALL return `{ id }` or `{ id, version }` (a number), or the refusal `bad-ref` with `path` `""`.
`formatRef(id, version?)` SHALL return the reference string for which `parseRef` gives the same `id` and `version`;
an invalid `id` is refused `bad-id` at `/id`, an invalid version `bad-version` at `/version`, in this order; a
`version` equal to `undefined` gives a floating reference. For every valid reference string `s`, `formatRef` of the
result of `parseRef(s)` SHALL equal `s`.

Implements: OM-R01

#### Scenario: Valid references and the round trip
<!-- id: SCN-KR-042 -->
- **WHEN** `parseRef` gets `std/need@2`, `warrant/REQ-KRN-011`, `core/rule.type-shape@1`, `acme.tools/x_1`,
  `warrant/01J8ZQ4N7X5K2M9R3T6V8W0Y1A`, `warrant/x@9007199254740991`, the string of `warrant/` and 128 characters `a`,
  the string of 64 characters `a` and `/x`, and `formatRef` is called for every result
- **THEN** the results in order are `{ id: "std/need", version: 2 }`, `{ id: "warrant/REQ-KRN-011" }`,
  `{ id: "core/rule.type-shape", version: 1 }`, `{ id: "acme.tools/x_1" }`,
  `{ id: "warrant/01J8ZQ4N7X5K2M9R3T6V8W0Y1A" }`, `{ id: "warrant/x", version: 9007199254740991 }`, and `{ id }` with
  the whole string for the last two; `formatRef` of every result equals the original string

#### Scenario: Invalid references
<!-- id: SCN-KR-043 -->
- **WHEN** `parseRef` gets `#3fa29c0d71be44a2b6c1d0e9f8a7b6c5`, `#3fa29c0d71be44a2b6c1d0e9f8a7b6c5@1`, `#g1:abcd`,
  `warrant/`, `Warrant/x`, `warrant/a b`, `warrant/a/b`, `warrant/-x`, `warrant/x@0`, `warrant/x@01`,
  `warrant/x@9007199254740992`, `warrant/x@`, `std/need@2@3`, the empty string, the string of `warrant/` and 129
  characters `a`, `acme./x`, `acme..tools/x`, the string of 65 characters `a` and `/x`; `formatRef` gets
  `("warrant/x", 0)`, `("warrant/x", 1.5)`, `("Warrant/x")`, `("#3fa29c0d71be44a2b6c1d0e9f8a7b6c5")`
- **THEN** every string is refused `bad-ref` `""`; `formatRef` is refused `bad-version` `/version`, `bad-version`
  `/version`, `bad-id` `/id`, `bad-id` `/id`

### Requirement: Admission of a body
<!-- id: REQ-KR-013 -->

`admit(text, type)` SHALL turn the JSON text of a body and its type into an admitted body, running these stages in
order and returning the refusals of the first stage that has any:
1. `type` is a value returned by a successful `typeOf` or the constant `metaType` (REQ-KR-016); otherwise the only
   refusal `bad-type` `/type`;
2. the text is parsed as `checkInput` does (REQ-KR-009), with its codes; each `path` is prefixed with `/text`;
3. the UTF-8 encoding of the canonical form of the body (REQ-KR-010) is at most 1 048 576 bytes; otherwise the only
   refusal `too-large` `/text`;
4. the body is validated against the schemas of the type (REQ-KR-014, REQ-KR-015), with the codes of REQ-KR-015; each
   `path` is prefixed with `/text`.

On success the value is the admitted body `{ body, type, hash, refs }`: `body` the parsed value, deeply frozen; `type`
the pinned reference `type@n` of the type (`type.ref`); `hash` the string `sha256:` followed by the 64 lower-case hex
digits of `sha256` of the UTF-8 bytes of the canonical form of the object `{"type": type@n, "body": body}`; `refs` the
references the schema declares (REQ-KR-015). So the hash depends on nothing but `type@n` and the canonical form of the
body: two admissions under the same type give equal hashes exactly when their bodies have the same canonical form,
whatever the order of keys, the whitespace or the normalization form of the texts — which is what makes writing the
body of the current revision a no-op (OM-H03; the no-op itself is decided by apply). The same body under another
revision of the type gives another hash.

Implements: OM-H01, OM-H02, OM-H03, OM-H04, OM-T05

#### Scenario: The hash is sha256 of the canonical form over type@n
<!-- id: SCN-KR-044 -->
- **WHEN** `admit` gets the texts `{"name":"lifecycle","code":"LCY"}` and `{ "code" : "LCY", "name" : "lifecycle" }`
  under the type `std/domain@1` — `typeOf` of one record `{id: "std/domain", rev: 1, type: "core/type@1", body:
  {"schema": {"type": "object", "properties": {"code": {"type": "string"}, "name": {"type": "string"}}, "required":
  ["code", "name"]}}}`
- **THEN** both succeed with `type` `std/domain@1`, `refs` empty, `body` deeply frozen, and `hash`
  `sha256:1fc8a412e2a9703d6e71d57a5b1fe958dc2d8947f625b89e512a8dee1a5e2e14` — the `sha256` of the UTF-8 string
  `{"body":{"code":"LCY","name":"lifecycle"},"type":"std/domain@1"}`

#### Scenario: Another revision of the type is another hash
<!-- id: SCN-KR-045 -->
- **WHEN** `admit` gets the text `{"name":"lifecycle","code":"LCY"}` under the type `std/domain@2` — the record of
  SCN-KR-044 with `rev` 2
- **THEN** it succeeds with `type` `std/domain@2` and `hash`
  `sha256:57d33254aa5ae1a3c23d6f838dfd3b958f636af36f30ebba1556412e3cfd1e53`, not the hash of SCN-KR-044

#### Scenario: Equal admitted bodies have equal hashes
<!-- id: SCN-KR-046 -->
- **WHEN** `admit` gets, under the type `std/domain@1` of SCN-KR-044, the texts `{"name":"cafe\u0301","code":"LCY"}`
  (decomposed), `{"code":"LCY","name":"caf\u00e9"}` (composed) and `{"name":"cafe","code":"LCY"}`
- **THEN** all three succeed; the first two have the hash
  `sha256:aaad863bb5b5ae1342b98cd7557d9c08086132d317206de5d230c502b031864a` and equal bodies; the third has another
  hash

#### Scenario: Body size limit
<!-- id: SCN-KR-047 -->
- **WHEN** `admit` gets, under the type `test/s@1` (REQ-KR-011), the text `{"s":"…"}` whose string is 1 048 568
  characters `a` (a canonical form of exactly 1 048 576 bytes), then with 1 048 569 characters `a`, then a text
  `{"s":"…"}` of 349 522 characters U+20AC each given as an escape (a text of over 2 000 000 characters, a
  canonical form of 1 048 574 bytes), then of 349 524 characters U+20AC
  given as raw text (1 048 580 bytes)
- **THEN** the first succeeds; the second is the only refusal `too-large` `/text`; the third succeeds; the fourth is
  the only refusal `too-large` `/text`

#### Scenario: Stages stop at the first refusal
<!-- id: SCN-KR-048 -->
- **WHEN** `admit` gets, under the type `std/domain@1` of SCN-KR-044, the texts `{"name":-0}`, `[` and
  `{"name":5,"x":1}`; then the text `[` with the type `{ref: "std/domain@1"}` built in code
- **THEN** the first is the only refusal `negative-zero` `/text/name` (no refusal for the missing `code`); the second
  is the only refusal `syntax` `/text`; the third gives in order `missing` `/text/code`, `wrong-type` `/text/name`,
  `unknown-field` `/text/x`; the last is the only refusal `bad-type` `/type`

### Requirement: The type of an admission
<!-- id: REQ-KR-014 -->

`typeOf(chain)` SHALL turn a type and its `extends` chain into the type `admit` takes. `chain` is a list of type
records: the type first, then its parent, and so on to a type without `extends`. A type record is an object with own
data properties `id`, `rev`, `type` and `body` (other properties are ignored, so an entity record of REQ-KR-017 is one):
`id` an identifier (REQ-KR-012), `rev` an integer from 1 to 2^53−1, `type` exactly `core/type@1`, and `body` a value
that `admit` admits under `metaType` when given the canonical form of it.

The refusals, collected in this order:
- `not-type` `""` — `chain` is not an array or is empty; the only refusal;
- `chain-too-long` `""` — `chain` holds more than five records (the depth of `extends` is at most 4); the only refusal;
- `not-type` `/<i>` — the record at index `i` is not a type record; at most one refusal per record, and its `extends`
  is not checked;
- `bad-extends` `/<i>/body/extends` — the record at index `i` is not the last and its `extends` is not
  `formatRef(id, rev)` of the record at `i + 1`, or it is the last and has `extends`.

On success the value is a type: `ref` — `formatRef(id, rev)` of the first record, `body` — its body; the schemas of
every record of the chain go with it and are used by `admit`. Validation against a chain: the top-level object of a
body may hold a member exactly when one schema of the chain declares it in its root `properties` — closedness over the
union of the fields of the whole chain —; a member is validated against the node of every schema of the chain that
declares it; a name required by any schema of the chain is required. Below the top level every node is closed by its
own `properties`. Refusals equal by code and path are reported once.

Implements: OM-T05, OM-T07

#### Scenario: A chain admits the union of its fields and each schema's constraints
<!-- id: SCN-KR-049 -->
- **WHEN** `typeOf` gets the chain of the child `{id: "lattice/rule", rev: 1, type: "core/type@1", body: {"extends":
  "std/knowledge@2", "schema": {"type": "object", "properties": {"rule": {"type": "string", "enum": ["must",
  "should"]}, "title": {"type": "string", "maxLength": 5}}, "required": ["rule"]}}}` and the parent `{id:
  "std/knowledge", rev: 2, type: "core/type@1", body: {"schema": {"type": "object", "properties": {"summary": {"type":
  "string"}, "title": {"type": "string", "maxLength": 10}}, "required": ["title"]}}}`, and `admit` gets under it the
  texts `{"title":"abc","rule":"must","summary":"x"}`, `{"title":"abcdefg","rule":"may","extra":1}`,
  `{"rule":"must"}` and `{"title":"abc"}`
- **THEN** `typeOf` succeeds with `ref` `lattice/rule@1`; the first text is admitted with `type` `lattice/rule@1`; the
  second gives in order `unknown-field` `/text/extra`, `not-in-enum` `/text/rule`, `too-long` `/text/title`; the third
  `missing` `/text/title`; the fourth `missing` `/text/rule`

#### Scenario: Malformed chains
<!-- id: SCN-KR-050 -->
- **WHEN** `typeOf` gets, with the child and the parent of SCN-KR-049: `[]`; `"x"`; `[parent, child]`; `[child]`;
  `[child, parent with rev 1]`; `[child with type "core/type@2"]`; `[a record whose body is {"schema": {"type":
  "object", "properties": {}, "pattern": "x"}}]`; a chain of five records each extending the next; a chain of six
- **THEN** the refusals are: `not-type` `""`; `not-type` `""`; in order `bad-extends` `/0/body/extends`, `bad-extends`
  `/1/body/extends`; `bad-extends` `/0/body/extends`; `bad-extends` `/0/body/extends`; `not-type` `/0`; `not-type`
  `/0`; the chain of five succeeds; the chain of six is the only refusal `chain-too-long` `""`

### Requirement: The schema subset
<!-- id: REQ-KR-015 -->

The `schema` of a type SHALL be a node of this closed subset of JSON Schema, and nothing else. A node is an object
with the keyword `type`, whose value is one of `object`, `array`, `string`, `integer`, `number`, `boolean`, `null`,
`schema`, and only these other keywords:
- `object`: `properties` (required) — an object mapping member names to nodes, possibly empty; `required` — a list of
  distinct names, each declared in `properties` of the same node;
- `array`: `items` (required) — a node;
- `string`: `maxLength` — an integer from 0 to 2^53−1; `enum` — a non-empty list of distinct strings; `ref` — an
  identifier without a version (REQ-KR-012), the type the referenced entity has (a reference to a type); `pinned` — a
  boolean, only together with `ref`; `ref` excludes `maxLength` and `enum`;
- `integer`, `number`: `enum` — a non-empty list of distinct numbers of that type;
- `boolean`, `null`, `schema`: none.

A value of a `schema` node is itself a schema: a node of this subset whose `type` is `object`. The field type `schema`
is what lets the meta-type (REQ-KR-016) declare the `schema` of a type body, so that the meta-type is typed by itself.
The subset grows only with a kernel version.

A schema is checked when a value of a `schema` node is validated — the `schema` of every type admitted under the
meta-type —, walking depth first with the keywords of each node in UTF-16 code unit order, at most one refusal per
keyword:
- `unknown-keyword` at a keyword that is not allowed for the type of its node (`pattern`, `additionalProperties`,
  `$ref`, `description`, `minLength`, …);
- `bad-keyword` at a keyword whose value is not of the form above, at a required keyword that is absent (`type` of
  every node, `properties`, `items`) — in the place of its name in that order —, at `maxLength` or `enum` next to
  `ref`, at `pinned` without `ref`, at the `type` of the root node of a `schema` value when it is not `object`, and
  at a node that is not an object (then the only refusal of that node).

A body is validated against a node, depth first, at most one refusal per place:
- `wrong-type` at a value whose JSON type differs from the `type` of its node (an `integer` is a number that is an
  integer); the value is not checked further;
- for an object: `unknown-field` at a member its node does not declare; `missing` at `<object>/<name>` for a required
  name that is absent; the refusals of an object are ordered by member name in UTF-16 code unit order, an absent
  required name taking the place of its name; each declared member is validated against its node;
- for an array: each element against `items`, by index;
- `too-long` at a string with more code points than `maxLength`;
- `not-in-enum` at a value not in `enum`;
- `bad-ref` at a string of a `ref` node that is not a reference (REQ-KR-012), or that has no version when `pinned` is
  `true`, or has one when `pinned` is `false`; without `pinned` both are allowed.

`refs` of an admitted body (REQ-KR-013) SHALL list, in walk order, every string of a `ref` node that is a valid
reference, as `{ path, ref, target }`: `path` the JSON Pointer of the string in the body, `ref` its parse
(REQ-KR-012), `target` the `ref` keyword of the node — one entry per path, from the first schema of the chain that
declares a `ref` node there. Whether a pinned target exists and has that type is decided by apply (OM-R03).

Implements: OM-T06, OM-R02

#### Scenario: A schema outside the subset is refused
<!-- id: SCN-KR-051 -->
- **WHEN** `admit` gets under `metaType` the text
  `{"schema":{"type":"object","additionalProperties":false,"required":["a","z"],"properties":{"a":{"type":"string","pattern":"x"},"b":{"type":"object"},"c":{"type":"array"},"d":{"type":"string","maxLength":-1},"e":{"type":"date"},"f":{"type":"string","ref":"std/x","maxLength":3},"g":{"type":"string","pinned":true},"h":{"type":"integer","enum":[1,1]},"i":"string"}}}`
- **THEN** the refusals in order are: `unknown-keyword` `/text/schema/additionalProperties`; `unknown-keyword`
  `/text/schema/properties/a/pattern`; `bad-keyword` `/text/schema/properties/b/properties`; `bad-keyword`
  `/text/schema/properties/c/items`; `bad-keyword` `/text/schema/properties/d/maxLength`; `bad-keyword`
  `/text/schema/properties/e/type`; `bad-keyword` `/text/schema/properties/f/maxLength`; `bad-keyword`
  `/text/schema/properties/g/pinned`; `bad-keyword` `/text/schema/properties/h/enum`; `bad-keyword`
  `/text/schema/properties/i`; `bad-keyword` `/text/schema/required`

#### Scenario: A body against the field types
<!-- id: SCN-KR-052 -->
- **WHEN** `admit` gets, under the type `test/all@1` whose schema is
  `{"type":"object","properties":{"b":{"type":"boolean"},"i":{"type":"integer","enum":[1,2]},"l":{"type":"array","items":{"type":"integer"}},"n":{"type":"null"},"num":{"type":"number"},"o":{"type":"object","properties":{"x":{"type":"string"}},"required":["x"]},"s":{"type":"string","maxLength":3}},"required":["b","s"]}`,
  the texts `{"b":true,"i":2,"l":[1,2],"n":null,"num":1.5,"o":{"x":"y"},"s":"abc"}`; `{"b":false,"s":"😀😀😀"}`;
  `{"b":1,"i":1.5,"l":[1,"2"],"n":0,"num":"1","o":{"y":1},"s":"abcd","t":1}`; `{"b":false,"i":3,"s":"a"}`; `[]`
- **THEN** the first two succeed (`maxLength` counts code points, not UTF-16 code units); the third gives in order
  `wrong-type` `/text/b`, `wrong-type` `/text/i`, `wrong-type` `/text/l/1`, `wrong-type` `/text/n`, `wrong-type`
  `/text/num`, `missing` `/text/o/x`, `unknown-field` `/text/o/y`, `too-long` `/text/s`, `unknown-field` `/text/t`;
  the fourth `not-in-enum` `/text/i`; the fifth `wrong-type` `/text`

#### Scenario: Reference fields
<!-- id: SCN-KR-053 -->
- **WHEN** `admit` gets, under the type `test/refs@1` whose schema is
  `{"type":"object","properties":{"any":{"type":"string","ref":"std/need"},"fl":{"type":"string","ref":"std/need","pinned":false},"list":{"type":"array","items":{"type":"string","ref":"std/term","pinned":true}},"pin":{"type":"string","ref":"std/need","pinned":true}}}`,
  the texts `{"pin":"lattice/n1@2","fl":"lattice/n1","any":"lattice/n2@1","list":["lattice/t@1","lattice/t@1"]}` and
  `{"pin":"lattice/n1","fl":"lattice/n1@1","any":"not a ref","list":["#x"]}`
- **THEN** the first succeeds with `refs` in order `{path: "/any", ref: {id: "lattice/n2", version: 1}, target:
  "std/need"}`, `{path: "/fl", ref: {id: "lattice/n1"}, target: "std/need"}`, `{path: "/list/0", ref: {id:
  "lattice/t", version: 1}, target: "std/term"}`, `{path: "/list/1", ref: {id: "lattice/t", version: 1}, target:
  "std/term"}`, `{path: "/pin", ref: {id: "lattice/n1", version: 2}, target: "std/need"}`; the second gives in order
  `bad-ref` `/text/any`, `bad-ref` `/text/fl`, `bad-ref` `/text/list/0`, `bad-ref` `/text/pin`

### Requirement: The meta-type
<!-- id: REQ-KR-016 -->

The kernel SHALL hold the one meta-type as the constant `metaType`: a type (REQ-KR-014) with `ref` `core/type@1` whose
`body` is, in canonical form,
`{"schema":{"properties":{"card":{"items":{"type":"string"},"type":"array"},"extends":{"pinned":true,"ref":"core/type","type":"string"},"schema":{"type":"schema"},"unique":{"items":{"type":"string"},"type":"array"}},"required":["schema"],"type":"object"}}`.
It is typed by itself — the only self-reference, built by kernel code; every other type is data admitted under it.
A type body holds its `schema` (REQ-KR-015) and, optionally, `extends` — a pinned reference to its parent type —,
`unique` — its uniqueness fields — and `card` — the fields of its card; the meaning of `unique` and `card` is applied
outside the kernel. The write permissions of a type are not part of it (CT-N03).

Implements: OM-T01, OM-T02, OM-L01

#### Scenario: The meta-type is typed by itself
<!-- id: SCN-KR-054 -->
- **WHEN** `admit` gets the canonical form of `metaType.body` under `metaType`, and `typeOf` gets the one record
  `{id: "core/type", rev: 1, type: "core/type@1", body: metaType.body}`
- **THEN** `metaType.ref` is `core/type@1`; the canonical form of `metaType.body` is the text above; the admission
  succeeds with `type` `core/type@1`, a `body` equal to `metaType.body` and the hash `sha256:` + `sha256` of the
  canonical form of `{"type": "core/type@1", "body": metaType.body}`; `typeOf` succeeds with `ref` `core/type@1`

#### Scenario: Type bodies under the meta-type
<!-- id: SCN-KR-055 -->
- **WHEN** `admit` gets under `metaType` the texts `{"schema":{"type":"object","properties":{}}}`;
  `{"extends":"std/knowledge@2","schema":{"type":"object","properties":{}},"unique":["code"],"card":["title"]}`;
  `{"extends":"std/knowledge","schema":{"type":"object","properties":{}}}`; `{"schema":{"type":"string"}}`; `{}`;
  `{"schema":{"type":"object","properties":{}},"in_force":[]}`
- **THEN** the first two succeed, the second with `refs` `{path: "/extends", ref: {id: "std/knowledge", version: 2},
  target: "core/type"}`; the third is refused `bad-ref` `/text/extends`; the fourth `bad-keyword` `/text/schema/type`;
  the fifth `missing` `/text/schema`; the sixth `unknown-field` `/text/in_force`

### Requirement: The envelope
<!-- id: REQ-KR-017 -->

`entity(header, admitted)` SHALL build an entity record and `event(header, admitted)` an event record — the two kinds
of record, each with one fixed header:
- the header of `entity` is an object with exactly the own data properties `id`, `rev`, `by`, `at`; of `event`,
  exactly `id`, `by`, `at`. `id` and `by` are identifiers (REQ-KR-012), `rev` an integer from 1 to 2^53−1, `at` an
  integer number of UTC milliseconds since 1970-01-01T00:00:00.000Z from 0 to 253402300799999;
- `admitted` is a value returned by a successful `admit` (REQ-KR-013);
- the entity record is `{id, rev, type, hash, by, at, body}` with the keys in this order, the event record
  `{id, type, by, at, body}`: `type`, `hash` and `body` come from `admitted` (`type` is always `type@n`), `at` is
  `formatAt(header.at)`; the record is deeply frozen and its `body` is `admitted.body` itself;
- the body of an event SHALL have the member `of` — what the event is about —: an object, not an array, each of whose
  values is a reference (REQ-KR-012), possibly empty (UNK-KR-009); a pinned reference names an entity revision, a
  reference without a version an event; whether a target exists is decided by apply (OM-R03).

The refusals, collected in this order: `bad-header` `/header` when the header is not an object whose prototype is
`Object.prototype` or `null` (then no other refusal of the header); `bad-header` `/header/<key>` for every other own
string key, in UTF-16 code unit order, and `bad-header` `/header` once for any own symbol key; `bad-id` `/header/id`,
`bad-rev` `/header/rev` (`entity` only), `bad-by` `/header/by`, `bad-at` `/header/at` for an absent, accessor or
invalid property (an accessor is never called); `bad-admitted` `/admitted`; for `event` with a valid `admitted`,
`bad-of` `/admitted/body/of` when `of` is absent or is not such an object, otherwise `bad-of`
`/admitted/body/of/<role>` for every value that is not a reference, in UTF-16 code unit order of the roles.

`formatAt(ms)` SHALL return the string `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC) of an integer `ms` from 0 to
253402300799999, and otherwise refuse `bad-at` `""`. It is the only formatter of `at`: the clock answers integer
milliseconds (PL-K01) and the order of records is the ledger's, never `at`.

Implements: OM-E01, OM-E02, OM-E03, OM-E04, OM-K01

#### Scenario: An entity record
<!-- id: SCN-KR-056 -->
- **WHEN** `entity` gets the header `{id: "lattice/domain-lifecycle", rev: 3, by: "lattice/01J8ZQ4N7X5K2M9R3T6V8W0Y1A",
  at: 1790451612345}` and the admission of SCN-KR-044
- **THEN** it succeeds; the keys of the record are exactly `id`, `rev`, `type`, `hash`, `by`, `at`, `body` in this
  order; `type` is `std/domain@1`; `hash` is the hash of the admission; `at` is `"2026-09-26T19:40:12.345Z"`; `body`
  is the same object as the body of the admission; the record is deeply frozen

#### Scenario: An event record and its of
<!-- id: SCN-KR-057 -->
- **WHEN** `event` gets the header `{id: "lattice/01J8ZQ4N7X5K2M9R3T6V8W0Y1B", by: "lattice/01J8ZQ4N7X5K2M9R3T6V8W0Y1A",
  at: 0}` with, in turn, the admissions under a type `test/ev@1` whose schema is
  `{"type":"object","properties":{"of":{"type":"object","properties":{"a":{"type":"string"},"b":{"type":"string"}}},"v":{"type":"string"}}}`
  of the texts `{"of":{"a":"lattice/x@1","b":"lattice/01H8ZQ4N7X5K2M9R3T6V8W0Y1A"},"v":"pass"}`, `{"of":{}}`,
  `{"v":"pass"}` and `{"of":{"a":"x y","b":"lattice/x@1"}}`; and under a type `test/ev2@1` whose schema is
  `{"type":"object","properties":{"of":{"type":"string"}}}` of the text `{"of":"lattice/x@1"}`
- **THEN** the first two succeed with the keys exactly `id`, `type`, `by`, `at`, `body` in this order, `type`
  `test/ev@1` and `at` `"1970-01-01T00:00:00.000Z"`; the third is refused `bad-of` `/admitted/body/of`; the fourth
  `bad-of` `/admitted/body/of/a`; the last `bad-of` `/admitted/body/of`

#### Scenario: Refusals of the envelope
<!-- id: SCN-KR-058 -->
- **WHEN** `entity` gets the header `null` with the admission of SCN-KR-044; the header `{id: "Lattice/x", rev: 0,
  by: "lattice/s@1", at: -1, extra: 1}` with the admitted body `{}` built in code; the valid header of SCN-KR-056 with
  `at` 253402300800000, then with `at` 1.5, then without `by`, then with `id` a getter that sets a flag when called;
  and `event` gets the header of SCN-KR-057 with an extra key `rev`
- **THEN** the refusals are: `bad-header` `/header`; in order `bad-header` `/header/extra`, `bad-id` `/header/id`,
  `bad-rev` `/header/rev`, `bad-by` `/header/by`, `bad-at` `/header/at`, `bad-admitted` `/admitted`; `bad-at`
  `/header/at`; `bad-at` `/header/at`; `bad-by` `/header/by`; `bad-id` `/header/id` with the flag not set;
  `bad-header` `/header/rev`

#### Scenario: Formatting at
<!-- id: SCN-KR-059 -->
- **WHEN** `formatAt` gets `0`, `1790451612345`, `253402300799999`, `-1`, `1.5`, `253402300800000` and `NaN`
- **THEN** the first three give `"1970-01-01T00:00:00.000Z"`, `"2026-09-26T19:40:12.345Z"`,
  `"9999-12-31T23:59:59.999Z"`; the others are refused `bad-at` `""`

### Requirement: The transitional interface for the callers of S0
<!-- id: REQ-KR-018 -->

Until #83 moves their callers to the interface above, the kernel SHALL keep two functions of design v0.6 with their
behaviour, and #83 removes them with this requirement:
- `hash(typeId, body)` SHALL return the 64 lower-case hex digits of `sha256` of the UTF-8 bytes of the canonical form
  (REQ-KR-010) of `{"type": typeId, "body": body}`, where `typeId` is an identifier without a version (REQ-KR-012).
  An invalid `typeId` is refused `bad-type-id` `/typeId`; a body that `canonical` refuses is refused `not-json` at its
  place, prefixed with `/body`; both refusals are returned, in this order. `ledger` uses it for the hashes of commits
  and proposals (LG-C02) and, until #83, of entity records;
- `newId(namespace, ulid)` SHALL return `namespace "/" ulid` when `namespace` is a namespace of REQ-KR-012 and `ulid`
  is 26 characters of the upper-case Crockford Base32 alphabet (`0-9`, `A-H`, `J`, `K`, `M`, `N`, `P-T`, `V-Z`)
  starting with `0`…`7`; otherwise the refusals `bad-namespace` `/namespace` and `bad-ulid` `/ulid`, in this order.
  `assembly` uses it for the session id until #83 brings the event id of OM-I02.

Implements: LG-C02

#### Scenario: The transitional hash
<!-- id: SCN-KR-060 -->
- **WHEN** `hash("std/domain", {"name": "lifecycle", "code": "LCY"})` and `hash("std/domain", {"code": "LCY", "name":
  "lifecycle"})` are called
- **THEN** both are `a4ab98af0a7f2bf7899d59506cd69fb5aab77c4e292679dc1f1a28ddcf251fe4` — the `sha256` of the UTF-8
  string `{"body":{"code":"LCY","name":"lifecycle"},"type":"std/domain"}`

#### Scenario: Refusals of the transitional hash
<!-- id: SCN-KR-061 -->
- **WHEN** `hash` gets the `typeId` `"std/domain@1"`, `"#3fa29c0d71be44a2b6c1d0e9f8a7b6c5"`, `"domain"` and `5`, each
  with the body `{}`; then `("std/domain", {"x": NaN})` and `("domain", {"x": NaN})`
- **THEN** the first four are refused `bad-type-id` `/typeId`; the fifth `not-json` `/body/x`; the last in order
  `bad-type-id` `/typeId`, `not-json` `/body/x`

#### Scenario: The transitional new id
<!-- id: SCN-KR-062 -->
- **WHEN** `newId` gets `("warrant", "01J8ZQ4N7X5K2M9R3T6V8W0Y1A")`, `("Warrant", "01J8ZQ4N7X5K2M9R3T6V8W0Y1A")`,
  `("warrant", "01j8zq4n7x5k2m9r3t6v8w0y1a")`, `("warrant", "81J8ZQ4N7X5K2M9R3T6V8W0Y1A")`,
  `("warrant", "01J8ZQ4N7X5K2M9R3T6V8W0Y1")`, `("warrant", "01J8ZQ4N7X5K2M9R3T6V8W0YIL")`, `("Warrant", "x")`, then with
  the ULID of the first input a `namespace` of 64 characters `a` and of 65
- **THEN** the first succeeds with `warrant/01J8ZQ4N7X5K2M9R3T6V8W0Y1A`; the second is refused `bad-namespace`
  `/namespace`; the third to the sixth `bad-ulid` `/ulid`; the seventh in order `bad-namespace` `/namespace`,
  `bad-ulid` `/ulid`; the namespace of 64 characters succeeds, of 65 is refused `bad-namespace` `/namespace`
