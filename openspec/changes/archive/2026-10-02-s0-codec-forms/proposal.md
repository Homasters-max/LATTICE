# Proposal

## Why

The walking skeleton (`s0-skeleton`, #54) gave the codec one form: a file that is a single table with IDs (REQ-CL-003,
REQ-CL-005). The normalized design (`design-next`, LG-B04) is written in every form of LG-B06: a title and sections,
paragraphs that start with an ID — rules and prose blocks with `Z` IDs —, tables with IDs under several headers, tables
and lists without IDs that belong to the block before them, fenced code, and IDs mentioned in the text. The S0 criterion
(SL-S0) is the byte-identical round trip of that corpus, md → blocks → md; it needs a codec that knows all of these
forms:

- LG-B05 — one codec module holds the whole `md` format, import and export; no other code knows it.
- LG-B06 — the mapping of every `md` form to blocks: a row with an ID; a paragraph with an ID; a prose paragraph with a
  `Z` ID (LG-B04); a table or a list without IDs as a field of the block before it whose text ends with `:`; a fenced
  code block as a block of type `example`, kept verbatim; IDs mentioned in the text, ranges included, as floating
  references with the text stored verbatim; references to sections and documents as part of the text; a section as a
  composition of references and headings (OM-C01); an ID as the entity `id` `lattice/<ID in lower case>`.
- LG-B03, OM-C01, OM-R01, OM-R02 — a document is a composition of references, never a second copy of the text;
  compositions and navigation hold floating references.

Issue #58 (slice S0, umbrella #44) makes this the Change `s0-codec-forms`; done when every LG-B06 form round-trips
md → blocks → md byte-identically on its own fixture in CI.

## What Changes

- **The document form**: a second form of the codec beside the skeleton form — a title, sections, and between empty
  lines paragraphs with IDs, tables with and without IDs, lists and fenced code, in the exact layout of the normalized
  corpus (one empty line between elements, the compact table separator `|---|`, `\|` inside a cell). It is checked
  strictly and refused with the line of the first deviation, never repaired.
- **Import of the document form** (`importDocument`): a file becomes a proposal — the session event, one entity per
  block (row, paragraph, example), one composition per section and one for the document — with the references each
  block's text mentions extracted into a `refs` field, and its text kept verbatim.
- **Export of the document form** (`exportDocuments`): every document of the latest-revision projection rendered back
  to its file, read only through the read view (LG-J01). Before it answers, export imports every rendered file again
  and refuses a document whose rendering would not read back into the same blocks, so whatever export writes, import
  accepts and gives back.
- **Round-trip fixtures**: one fixture `md` per form of LG-B06, each taken through import, the ledger's apply and the
  latest-revision projection, and export, and compared byte for byte in CI.

The skeleton form and the command `lattice import-md` / `lattice export` are unchanged: the CLI keeps the skeleton form
of REQ-CL-003 and REQ-CL-005 until a Change of AREA `CL` moves it to the document form (the corpus round trip, #61).

## Capabilities

### New Capabilities

- `codec`: the document form of `md` — its elements and layout, how each form of LG-B06 maps to blocks and back, the
  references extracted from text, and the round trip of every form on its fixture.

### Modified Capabilities

None. The `cli` spec (AREA `CL`, held by `s0-bootstrap` #59 and then `s0-store-cli` #98) is not changed.

## Impact

- New code: `src/codec/form.ts`, `src/codec/references.ts`, `src/codec/document-import.ts`,
  `src/codec/document-export.ts`; `src/codec/index.ts` exports the two new functions. The skeleton files
  `src/codec/import.ts`, `src/codec/export.ts`, `src/codec/table.ts` are unchanged.
- New tests: `test/codec/**`; fixtures `test/fixtures/md/forms/**`.
- Unchanged: `src/cli/**`, `src/assembly/**`, `src/ledger/**`, `src/kernel/**`, `test/cli/**`, `test/e2e/**`, and the
  shared files of the skeleton (SL-T08): the module matrix of the structure test, the CLI entry and command table,
  `package.json`, the port interfaces. No new dependency.
- AREA `CD` only.
- Types: the document and the rows of the document form are the next revisions of the skeleton's types,
  `<ns>/document@2` and `<ns>/table.<slugs>@2`, because their bodies differ (OM-T05); paragraphs, examples and
  sections are new project types at `@1`. No type entity is written (as in the skeleton).
- Follow-ups (issues): the CLI on the document form and the corpus round trip — #61; #113, the codec types onto `std` types
  (`example`, `composition`, `knowledge`, OM-L02) when `std` is loaded (#59) and apply admits bodies against their type
  (#82).

## Non-goals

- The corpus round trip as a CI gate, and `import-md` of the whole `design-next`: #61 (`s0-roundtrip`).
- Moving `lattice import-md` and `lattice export` to the document form, or removing the skeleton form: a Change of AREA
  `CL` (#61).
- Type entities for the codec types, and admission of bodies against their type (OM-T05): #59 (`std`), #82.
- The normalization pass itself (LG-B04): done in #53; the codec refuses what normalization should have rewritten
  (a paragraph without an ID, a table or list without IDs with no block before it to belong to) and never rewrites it.
- Re-import after the switch: from the switch on `md` is export only (LG-B02).
- Markdown beyond the forms of the corpus: headings below `##`, nested lists, numbered lists, block quotes, HTML,
  tilde fences, setext headings, and tables in any other layout are refused.
