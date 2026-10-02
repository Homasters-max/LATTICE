# Tasks

## 1. Fixtures and the round trip helper

- [ ] 1.1 `test/fixtures/md/forms/{paragraphs,prose,tables,fields,examples,references,sections,verbatim}.md` — one
  fixture per form of LG-B06, with the elements the scenarios name (`REQ-CD-008`, design D-9); verified by each file
  being read by the tests of 2–4 and by `git diff main --stat -- test/fixtures/md/fixture.md` being empty
- [ ] 1.2 `test/codec/roundtrip.ts` — import, proposal file, `parseProposal`, `apply` on an empty ledger, `openLedger`
  with the commit, export; and the second proposal of SCN-CD-009 (`REQ-CD-008`, design D-9); verified by
  `npm run typecheck` passing and by the tests of 4 using it

## 2. The document form

- [ ] 2.1 `src/codec/form.ts` — steps 1–4 of `REQ-CD-001`: lines, code points, elements and layout, the cell and table
  line, the separator `|---|`, paragraphs with continuation lines, tables, lists, fences, and their rendering
  (`REQ-CD-001`, `REQ-CD-002`, `REQ-CD-003`, `REQ-CD-005`, design D-2, D-8); verified by the tests with the tokens
  `SCN-CD-001`, `SCN-CD-010` and the refusal tests with the tokens `SCN-CD-002`, `SCN-CD-005` passing
- [ ] 2.2 `src/codec/references.ts` — mentions, code spans, ranges (`REQ-CD-006`, design D-5); verified by the tests
  with the token `SCN-CD-006` in `test/codec/references.test.ts` and `test/codec/refusals.test.ts` passing

## 3. Import

- [ ] 3.1 `src/codec/document-import.ts` — blocks of paragraphs, rows and fences, fields, sections, the document, IDs
  and their uniqueness, `refs`, the proposal (`REQ-CD-002` … `REQ-CD-007`, design D-3 … D-6); verified by the tests
  with the tokens `SCN-CD-002`, `SCN-CD-003`, `SCN-CD-004`, `SCN-CD-005`, `SCN-CD-006`, `SCN-CD-007` in
  `test/codec/forms.test.ts` and `test/codec/refusals.test.ts` passing

## 4. Export and the round trip

- [ ] 4.1 `src/codec/document-export.ts` and `src/codec/index.ts` — rendering of every item and field, the re-import
  check, the order of files and the refusal for one `file` named twice (`REQ-CD-008`, design D-7, D-8); verified by the
  tests with the tokens `SCN-CD-008` (all eight fixtures) and `SCN-CD-009` passing
- [ ] 4.2 Manual acceptance of the corpus (design Risks): a one-off script outside the repository takes every
  `design-next/*.md` of `origin/main` through the round trip helper; verified by the list of files and their outcome
  (byte-identical or the refusal with its line) recorded in the impl-PR body; a refused file becomes an issue for #61

## 5. Verification

- [ ] 5.1 The skeleton form and every other test unchanged (design D-1); verified by `npm test` passing and
  `git diff main -- src/codec/import.ts src/codec/export.ts src/codec/table.ts src/cli src/assembly src/ledger src/kernel test/cli test/e2e test/architecture package.json`
  being empty
- [ ] 5.2 `npm run typecheck`, `npm test` and `warrant verify s0-codec-forms`; verified by all three succeeding
