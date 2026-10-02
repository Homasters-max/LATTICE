# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/codec/spec.md` of this Change. Today:
- `src/codec/` holds the skeleton form only (skeleton design D-6): `import.ts` (`importMd`, the seven steps of
  REQ-CL-003), `export.ts` (`exportMd`, REQ-CL-005), `table.ts` (line split and render, `stemOf`, `isId`, `slug`,
  `columnsProblem`, `typeLocal`), `index.ts`. `assembly` calls `importMd`, `exportMd`, `stemOf`; nothing else imports
  `codec`.
- The rendered form of the skeleton writes the separator `| --- | --- |`; the corpus writes `|---|---|` (skeleton design
  I-21, umbrella #44 comment 5939801467). The skeleton's cell forbids `|`; the corpus has `\|` in one cell (DP-M01).
- AREA `CL` (the spec `cli`, which states the skeleton form) is held by `s0-bootstrap` (#59) and then by
  `s0-store-cli` (#98); `#83` also needs it. So this Change cannot touch REQ-CL-003 / REQ-CL-005 or `src/cli/**`, and
  keeps the whole document form in its own AREA `CD` (umbrella #44 comment 5947346075).
- The normalized corpus at `adaaa56` (`design-next/*.md`, 13 files): a title, `##` sections, paragraphs that start with
  an ID (prose `Z` IDs and two rule paragraphs, DP-R06 and DP-N01), tables with IDs under eight distinct headers, five
  field tables and three lists after a lead block ending with `:`, five fences `` ```json|text <Z-ID> ``, 405 IDs
  defined and every mentioned ID-like token but `I-JSON` defined. One paragraph, DP-Z10, has two lines.
- A throwaway prototype of the grammar of D-2 (outside the repository) read all 13 files and rendered them back
  byte-identically, after adding paragraph continuation lines (DP-Z10).
- The ledger offers what a round trip needs without change: `proposalText`, `parseProposal`, `apply(ledger, proposal)`,
  `openLedger({commits, torn})` with its `view` (the latest-revision projection), `ReadView`. `s0-bootstrap` (#59)
  confirmed (message to this session, 2026-10-02) that it keeps these signatures — `apply` only gains an optional third
  argument — and adds no type admission.

## Goals / Non-Goals

**Goals:**
- Every form of LG-B06 imported into blocks and exported back byte for byte, each on its own fixture in CI.
- The document form exactly as the normalized corpus writes it, so #61 can take the corpus through it unchanged.
- No shared file changed, no file of another Change's paths touched; the skeleton form and every existing test
  unchanged.

**Non-Goals:**
- Everything proposal.md, Non-goals, lists.
- Performance: a file is read once per import; export renders and re-imports each document once.

## Decisions

### D-1. A second form beside the skeleton form; the CLI unchanged

`codec` gets `importDocument` and `exportDocuments` next to `importMd` and `exportMd`, which stay byte for byte as they
are, so REQ-CL-003 … REQ-CL-006 and every test under `test/cli/**` and `test/e2e/**` keep passing. The document form is
the form the corpus round trip (#61) needs; moving `lattice import-md` and `lattice export` to it and removing the
skeleton form is a change of the spec `cli` and belongs to a Change of AREA `CL` — #61, by the order of the slice. Its
fixture `test/fixtures/md/fixture.md` then has to be rewritten in the document form (a title, `|---|`).

Rejected: a MODIFIED REQ-CL-003 / REQ-CL-005 now — `CL` is held (#59, then #98); changing `importMd` to the document
form — breaks SCN-CL-003, SCN-CL-004 (a paragraph after the table is refused there) and SCN-CL-010; accepting both
separators in one form — the separator would have to be stored as layout to come back byte for byte.

### D-2. The grammar: elements between single empty lines, the corpus layout exactly

The file is a sequence of elements separated by one empty line (REQ-CD-001); the kind of an element is read from its
first line; a table and a list run over the lines with their marker, a paragraph over every following line without a
marker, a fence to the next line of exactly three backticks. Every deviation is refused with its line and never
repaired, so that whatever import accepts, export can write back: the codec stores no layout at all — no blank-line
counts, no separator style, no trailing spaces — because the accepted layout is the only one.

The checks run in four steps (REQ-CD-001): file name, lines, code points over the whole file, then the elements from
the top. Steps 1–3 are those of the skeleton (REQ-CL-003 steps 1, 2, 7) applied to whole lines; step 4 is one pass in
which every rule that compares an element with an earlier one (unique IDs, distinct heading slugs) is checked when the
later one is read, so "the first deviation" is the first in reading order and is deterministic.

Rejected: a CommonMark parser — an npm dependency, and it normalises (a parse tree does not keep `|---|` against
`| --- |`, nor `\|`), so bytes would have to be reconstructed; storing layout in the blocks — text that is not knowledge,
and LG-B04 already normalised the layout once.

### D-3. Block types in the project namespace

| Element | Entity `id` | Type | Body |
|---|---|---|---|
| paragraph | `<ns>/<id>` | `<ns>/paragraph@1` | `{text, refs[, table \| list]}` |
| fence | `<ns>/<id>` | `<ns>/example@1` | `{language, text}` |
| row of a table with IDs | `<ns>/<id>` | `<ns>/table.<slugs>@2` | `{<column>…, refs[, table \| list]}` |
| section | `<ns>/<stem in lower case>.<slug>` | `<ns>/section@1` | `{heading, items}` |
| the file | `<ns>/<stem in lower case>` | `<ns>/document@2` | `{file, title, items}` |

`std` is not loaded before #59, and apply does not admit bodies against their type before #82; the skeleton already
names its types in the project namespace without writing them (`table.<slugs>@1`, `document@1`). The design names
`example` (and `composition`, `knowledge`) as `std` types (OM-L02, OM-T04, the envelope example OM-Z02), so these names
are transitional: when `std` carries the types and apply admits bodies, the codec types become project types extending
them (OM-L03) or the `std` types themselves — issue #113. Rule paragraphs and prose paragraphs share one type: after
normalization both are "an ID, `. `, text", and nothing in the form tells a role.

The document and the rows keep the skeleton's type names at the next revision, `document@2` and `table.<slugs>@2`:
their bodies differ from the skeleton's (`{file, title, items}` against `{file, columns, rows}`; rows gain `refs`), and
a changed schema is a new revision of the type (OM-T05). So no type id has two body shapes, and the skeleton's
`exportMd`, which reads only `document@1`, never meets a document of this form (review 1, F-2). When #61 removes the
skeleton form, `@2` stays the current revision.

Rejected: reusing `@1` with a spec note that the forms never share a store (review 1, D-1, first option) — one type id
with two schemas contradicts REQ-CL-003 / REQ-CL-005; distinct names (`md.document@1`) — two names for one thing once
the skeleton form is gone; `std/example@1` now — the schema of a `std` type is #59's, and a codec body must not fix it
from outside.

### D-4. Fields live in the owner's body

A table without IDs or a list right after a block whose text ends with `:` is that block's field (REQ-CD-004): `table`
— `{header, rows}` with every cell as written — or `list` — the items. The text of a row, for the `:` rule, is its last
cell (the corpus: LG-B06, whose mapping table follows the `ID | Rule` table). A row's body fields are named by its
columns, so `refs`, `table` and `list` are refused as column names (REQ-CD-003); `$` is already refused (REQ-CL-003
step 5). A field is not an item of the composition: it is written back right after its owner, and its owner is always
the element before it.

Rejected: a field as its own block — LG-B06 says "a field of that block"; a field as a composition item — the
composition would then hold text (OM-C01).

### D-5. References: a `refs` field of plain floating references

`refs` is a list of entity `id` strings, each a floating reference (OM-R01, OM-R02). References are found through
reference fields that a type declares (OM-R02); a `$ref` marker in a body is not taken (NX-15), and `s0-kernel` made
`$ref` an ordinary member. The skeleton's document body still uses `{"$ref": …}` rows; the document form does not.

Mentions (REQ-CD-006):
- the ID grammar needs two characters before the hyphen: in the corpus the only ID-like token that names no ID is
  `I-JSON` (OM-H02), and every defined ID has a prefix of two or more letters;
- a mention is bounded by characters outside `[A-Za-z0-9-]`, so `REQ-CL-003` or `sha-256x` mention nothing;
- a mention inside a code span is not a reference: the corpus uses code spans for IDs that are examples, not
  references (`` `DP-B01` → `lattice/dp-b01` `` and `` ```json DP-Z04 `` in LG-B06; `` (`DP-B01`, …) `` in RM-Z04);
- ranges `P-Ln…Lm` and `P-Ln…P-Lm` expand to every number between, zero-padded (the corpus has fourteen, all of the
  first form, the largest naming six IDs); a malformed range is refused rather than read as a plain mention, so a typo
  in a range never drops references silently; a range names at most 100 IDs with numbers of at most nine digits, so
  its expansion is bounded and its numbers are safe integers (review 1, F-3);
- `refs` keeps the order of first mention, each `id` once, without the block's own `id`; the texts of a row are its
  cells after the ID, then the cells or items of its field, each searched on its own (review 1, F-9).

Rejected: references only to IDs defined in the same import — `import-md` reads one file (LG-B07: one proposal), and
most references cross files; a stop list for `I-JSON` — a second grammar to maintain.

### D-6. Sections are compositions with derived `id`s

A section is an entity of type `section@1` with `id` `<ns>/<stem in lower case>.<slug of heading>` (REQ-CD-007), so
`README.md` gives `lattice/readme.<slug>`, as its document `lattice/readme` (OM-I05; review 1, F-1). A slug has no `.`
and a block ID has none either, so a section `id` never equals a block `id` or the document `id`; slugs are distinct in
a file (the corpus has no repeated heading; the longest section `id` is 40 characters). A section `id` changes with its
heading — accepted: before the switch every store is disposable (LG-G05), after it `md` is export only (LG-B02), and
no text references a section by `id` ("01 Model" is prose, LG-B06).

The items of a composition (REQ-CD-007): the `id` of a paragraph or fence block, the `id` of a section (document only),
or `{columns, rows}` for a table with IDs — the table is a structural label with references, not a block, as in the
skeleton's document body. The document holds the elements before its first heading, then its sections; there is one
level of sections because the corpus has only `##` (deeper headings are refused).

Rejected: positional section `id`s (`<stem>.s3`) — they shift when a section is inserted; sections inlined in the
document body — LG-B06 maps a section to a composition; a table as its own composition entity — an `id` with nothing to
derive it from.

### D-7. Export renders, then proves the rendering by importing it

`exportDocuments` renders each document as REQ-CD-008 says and then runs `importDocument` on the rendered text with a
fixed session and compares the entity intents with the view: the same set of `id`s as the entities the rendering read,
each with the same type and body. A mismatch or a refusal of import refuses the document. So export never needs its own
list of "a cell that breaks the form", and the round-trip property holds in both directions: what export writes,
import accepts and gives back. A block whose `refs` disagree with its text is refused: the text is the truth that
`md` can carry (LG-B06), and `md` cannot hold the difference.

Rendering reads every value through type guards and refuses on a wrong shape before re-import; the comparison uses the
kernel's canonical form of each body, so key order does not matter. Export resolves only items and table rows; `refs`
are compared, never resolved (review 1, F-6). The documents are taken in the order of their `file`, and the first
refused one is answered (F-7). Two documents naming one file need no rule of their own: the document `id` is derived
from the file name, so of two such documents at least one reads back into another `id` and is refused (F-11).

Rejected: the skeleton's style of a closed list of refusals — the list would mirror the grammar of D-2 and drift from
it; no check — a block edited after the switch into text the form cannot carry would be written out and refused only by
the next import.

### D-8. Module files and interface

| File | Holds |
|---|---|
| `src/codec/form.ts` | the elements of the document form: reading the lines of a file into elements (step 4 of REQ-CD-001), rendering elements back; the cell and table-line rules, the separator |
| `src/codec/references.ts` | mentions, code spans and ranges of REQ-CD-006: `mentions(text) → {ids} \| {offset, message}` |
| `src/codec/document-import.ts` | `importDocument`: steps 1–3 of REQ-CD-001 (file name, lines, code points), then elements → blocks, sections, document, the proposal |
| `src/codec/document-export.ts` | `exportDocuments`: the view → rendered files, with the re-import check of D-7 |
| `src/codec/index.ts` | adds `importDocument`, `exportDocuments` to the exports |

```ts
importDocument(text: string, fileName: string, namespace: string, session: Session): Imported;
exportDocuments(view: ReadView, namespace: string): Exported;
```

The result types are the skeleton's (`Imported`, `Exported`), so a later CLI switch changes one call each in
`assembly`. `form.ts` reuses `stemOf`, `slug` and `columnsProblem` of `table.ts` without changing them. `codec` imports
from `kernel` and from `ledger` only what it imports today (types, `SESSION_TYPE`) plus the kernel's `canonical`.

### D-9. Tests, fixtures and the paths of this Change

Fixtures `test/fixtures/md/forms/{paragraphs,prose,tables,fields,examples,references,sections,verbatim}.md`, one per form
of LG-B06, each small and synthetic (IDs `FX-…`, titles `# 99. …`). Refusal cases are copies of a fixture changed in
the test, so no broken file is kept in git.

Tests (each `it` inside `describe`, named with its `SCN-CD-…` token):
- `test/codec/roundtrip.ts` — the round trip helper of REQ-CD-008: `importDocument` → `proposalText` → `parseProposal`
  → `apply` on `openLedger({commits: [], torn: null})` → `openLedger` with the commit → `exportDocuments(view)`; it also
  applies a second proposal for SCN-CD-009;
- `test/codec/forms.test.ts` — SCN-CD-002 … SCN-CD-008 (blocks of each fixture, and its round trip);
- `test/codec/refusals.test.ts` — SCN-CD-001, SCN-CD-010 and the refusal parts of SCN-CD-002, -004 … -007;
- `test/codec/export.test.ts` — SCN-CD-009;
- `test/codec/references.test.ts` — unit cases of `references.ts` under SCN-CD-006.

Paths of the `implement` Run (`--scope`): `src/codec/**`, `test/codec/**`, `test/fixtures/md/forms/**`,
`openspec/changes/s0-codec-forms/**`. Parallel Changes and their paths (umbrella #44): #59 `src/ledger/**` (not
`projections/**`), `src/trust/**`, `src/adapters/acts-*/**`, `std/**`, `src/assembly/index.ts`,
`src/cli/commands/init.ts`, `test/{ledger,trust,acts,cli,e2e}/**`, `test/fixtures/rules/**` (message of the #59
session, 2026-10-02) — no overlap; #60 `s0-projections` (AREA `PJ`) works on the projections, which this Change only
reads. The codec and its tests read `src/ledger` through its index only and edit nothing outside the paths above.

## Risks / Trade-offs

- **Apply grows checks while this Change is open.** #59 adds `CT-N02` (reserved namespaces) and an optional `acts`
  argument; #82 will admit bodies against their type, which no codec type has as an entity. Mitigation: the round trip
  helper is one function; if a check of another Change rejects a codec proposal, that Change owns the fix of the
  helper or the types, recorded as an `I-N` row there; issue #113 names #82.
- **The corpus changes after `design-next-v0.2`.** A docs PR may write a form this grammar refuses. The fixtures here
  do not read the corpus; #61 makes the corpus round trip a CI gate. The manual check of task 4.2 records the state at
  the impl-PR.
- **Derived section `id`s** change with headings (D-6) — harmless before the switch, irrelevant after it.
- **Several documents in one store** (review 1, F-12) — open for #61, which imports the whole corpus: a section `id`
  of one file can equal the document `id` of another (`a.md` with `## B` against `a.b.md`); one ID defined in two files
  gives two intents for one `id` (rejected by apply, LG-C07); a block no document references is never exported; a
  block referenced by two documents is written twice. Each document is checked on its own here; none of these occurs
  in the corpus, and the corpus import of #61 decides them. Also for #61 (review 2, F-9): "one type per distinct header"
  is checked within one file; `Rule` in one file and `rule` in another give one row type with two field names.
- **A type id with two body shapes in tests** (review 2, F-1): the synthetic test type `lattice/table.rule@2` of
  SCN-LG-003 (ledger) holds the skeleton body `{Rule}`, the codec's `table.rule@2` holds `{Rule, refs}`. Nothing reads
  both today; when #82 admits bodies against their type, test types need entities anyway, and #113 decides the codec
  types. Noted on #113.
- **Entity ids equal to type ids** (review 2, F-8): a file `document.md`, or `table.md` with a heading `## Rule`, gives
  an entity `id` equal to a codec type `id` (types are entities, OM-T01). Harmless while no type entity is written;
  #113 decides it with the type entities.

## Decisions on implementation (I-N)

| ID | Decision | Source | Decided by |
|---|---|---|---|
| I-1 | A section `id` uses the stem in lower case (`<ns>/<stem in lower case>.<slug>`); SCN-CD-007 imports `Sections.md`. | Spec review 1 (`EVID-01M3Y450KAP0BYAGCY7T8S2C9Q`), F-1 BLOCKER. | spec review 1 |
| I-2 | The document and the rows of the document form are `document@2` and `table.<slugs>@2` (OM-T05), not the skeleton's `@1` (D-3). | Review 1, F-2 MAJOR, decision D-1 of the review: option "next revision". | spec review 1; the maintainer by the merge of the spec-PR |
| I-3 | A range names at most 100 IDs, with numbers of at most nine digits (REQ-CD-006, D-5). | Review 1, F-3 MAJOR. | spec review 1 |
| I-4 | SCN-CD-010 covers repeated IDs, an ID equal to the stem, the spaced separator, a compact line, a bare `\|`, a short row, a reserved column, a header whose slugs repeat with other cells, a table without a row and an unassigned code point; SCN-CD-004 covers an empty list item. | Review 1, F-4 MAJOR. | spec review 1 |
| I-5 | Refusal lines for an empty file (line 1) and a table without a row (the line after the separator); a file of only a title is accepted. | Review 1, F-5. | spec review 1 |
| I-6 | Export resolves only items and table rows, never `refs`; it takes documents in the order of `file` and answers the first refused one; the rule for one file named twice is replaced by the read-back (D-7). | Review 1, F-6, F-7, F-11. | spec review 1 |
| I-7 | Two headers of one file with the same slugs must have the same cells (REQ-CD-003). | Review 1, F-8. | spec review 1 |
| I-8 | Mentions are searched per cell and per list item; a line `<ID>. …` cannot continue a paragraph. | Review 1, F-9, F-10. | spec review 1 |
| I-9 | Cases of several documents in one store are left to #61 (Risks). `Implements:` no longer names OM-R05, OM-C02. | Review 1, F-12, F-13 (INFO). | spec review 1 |
| I-10 | The synthetic `lattice/table.rule@2` of SCN-LG-003 has another body than the codec's `table.<slugs>@2`; recorded in Risks and on #113, no change of either. | Spec review 2 (`EVID-01M3YB2J8M5387N6WGB8PRK5XP`), F-1 MAJOR; spec-PR #116 body. | the maintainer by the merge of #116 |
| I-11 | The skeleton form keeps writing `document@1` / `table.<slugs>@1` (REQ-CL-003) next to the `@2` of this form until #61 removes it — a transitional exception to "new writes use the latest revision" (OM-T05); no spec edit. | Review 2, F-2. | the maintainer by the merge of #116 |
| I-12 | A header `\| ID \|` without columns is refused at its line (step 5 of REQ-CL-003: at least two cells; `columnsProblem`); a case of SCN-CD-010. | Review 2, F-3. | the maintainer by the merge of #116 |
| I-13 | Export orders documents by `file`, then by `id` (UTF-16 code units). | Review 2, F-4. | the maintainer by the merge of #116 |
| I-14 | A byte order mark is refused at line 0 (step 2, as SCN-CD-001 states). | Review 2, F-5. | the maintainer by the merge of #116 |
| I-15 | A range end, after its hyphen, is letters then digits only (`FX-A1B01…` is refused), as "split into letters and a final run of digits" reads; unit cases in `test/codec/references.test.ts`. | Review 2, F-6. | the maintainer by the merge of #116 |
| I-16 | `sections.md` has `FX-Z01` and `FX-R02` mentioning `FX-R01`, for the refs case of SCN-CD-009. | Review 2, F-7. | the maintainer by the merge of #116 |
| I-17 | Entity ids equal to codec type ids and header slugs across files go to Risks, #113 and #61. | Review 2, F-8, F-9 (INFO). | the maintainer by the merge of #116 |
| I-18 | Task 4.1 no longer names the rule for one file named twice (replaced by the read-back, I-6). | Review 2, P-2. | the maintainer by the merge of #116 |
| I-19 | Regex literals, not `new RegExp`: `RegExp` is a forbidden global of a pure module (SCN-AR-008); the ID pattern is written in `form.ts` and `references.ts`. | Implementation, `warrant check` of SCN-AR-008. | implementation |
| I-20 | Task 4.2 result: all 13 files of `design-next/*.md` at `b597293` round-trip byte-identically through the codec, one file at a time (504 entities). | Implementation, one-off script outside the repository. | implementation |
| I-21 | The line and cell rules of `form.ts` and steps 1–2 of `document-import.ts` repeat parts of the skeleton's `table.ts` and `import.ts`, which this Change does not touch (D-1, D-8); one copy when the skeleton form is removed — issue #121. The test helper uses `SESSION_TYPE`. | Implementation review, Standards S-1, S-2. | implementation review |
| I-22 | D-8 names the files as built: steps 1–3 in `document-import.ts`, step 4 in `form.ts`, `mentions` in `references.ts`. | Implementation review, Standards S-3; Spec P-6. | implementation review |
| I-23 | `document-export.ts` renders through a small `Renderer` with a module-level `fail(): never`, so the shapes narrow without casts; the exceptions `Refused` / `CannotRender` stay inside their module and are turned into refusal values at the interface (commented). | Implementation review, Standards S-4, S-5, S-8. | implementation review |
| I-24 | `form.ts` exports only `Element`, `Deviation`, `parseElements`, `renderElements`, `isDocId`, `localOk`; `document-import.ts` uses the one `Deviation`; `references.ts` names the 128 limit. | Implementation review, Standards S-6, S-9, S-10. | implementation review |
| I-25 | A paragraph's first line may hold U+2028 / U+2029 (`[^]+`, not `.+`); a test under SCN-CD-002. | Implementation review, Spec P-1. | implementation review |
| I-26 | A table is an element from its header on, so the rules of its header (columns, the lead of a field) are checked before a later deviation of the same table — refused at the header line; tests under SCN-CD-010. | Implementation review, Spec P-2. | implementation review |
| I-27 | Tests: SCN-CD-009 changes the `refs` of the paragraph `FX-Z01` (and of a row) and replaces one item of the document; SCN-CD-002 asserts the type and `base` 0 of every paragraph; SCN-CD-006 asserts every text as written. | Implementation review, Spec P-3, P-4, P-5. | implementation review |
| I-28 | Not taken: one `qualify` / `unqualify` helper for `namespace/local` (Standards S-7) — three short uses inside the codec, and the skeleton keeps its own; revisit with #121. | Implementation review, Standards S-7. | implementation review |
| I-29 | The fixture `references.md` writes `REF-FX-001` where SCN-CD-006 names `REQ-FX-001`. A token of the form `REQ-AREA-NNN` in a file under `test/` must be a requirement declared in `openspec/` (`warrant validate`, ADR-0019 point 1d), so the job `warrant` of #122 was red with `ID_DANGLING REQ-FX-001`. `REF-FX-001` has the same shape (two hyphens, so it mentions nothing), and the literal example of REQ-CD-006, `REQ-CL-003` — a declared id —, is the unit case in `test/codec/references.test.ts`. The local check before a push also runs `warrant validate`. | CI run https://github.com/Homasters-max/LATTICE/actions/runs/37012880685 of #122; coordinator S0. | the maintainer by the merge of #122 |
