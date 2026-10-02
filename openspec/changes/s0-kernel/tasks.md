# Tasks

## 1. Kept modules, re-bound

- [ ] 1.1 `strings.ts` from `admit.ts`; `input.ts` without the `$ref` / `$enc` branches and `refObject`
  (`REQ-KR-009`, design D-1, D-2); verified by tests with the tokens `SCN-KR-028`, `SCN-KR-029`, `SCN-KR-030`,
  `SCN-KR-031`, `SCN-KR-032`, `SCN-KR-033`, `SCN-KR-034`, `SCN-KR-035`, `SCN-KR-036` passing
- [ ] 1.2 `canonical.ts` without `eachObject` (`REQ-KR-010`, design D-2); verified by tests with the tokens
  `SCN-KR-037`, `SCN-KR-038`, `SCN-KR-039`, `SCN-KR-040` passing
- [ ] 1.3 `ref.ts` without the value id, the reserved scheme and `refObject` (`REQ-KR-012`, design D-2); verified by
  tests with the tokens `SCN-KR-042`, `SCN-KR-043` passing
- [ ] 1.4 `transitional.ts` with `hash` (without `valueId`) and `newId`; `admit.ts`, `hash.ts`, `ids.ts`, `refs.ts`,
  `revision.ts` deleted (`REQ-KR-018`, design D-1, D-2); verified by tests with the tokens `SCN-KR-060`, `SCN-KR-061`,
  `SCN-KR-062` passing and by `test/cli/**` and `test/e2e/**` passing unchanged

## 2. Schema subset and meta-type

- [ ] 2.1 `schema.ts` — the subset check of a schema value and the validation of a body against a schema chain,
  collecting `refs` (`REQ-KR-015`, design D-5, D-6); verified by tests with the tokens `SCN-KR-051`, `SCN-KR-052`,
  `SCN-KR-053` passing
- [ ] 2.2 `meta.ts` — the body of the meta-type `core/type@1` (`REQ-KR-016`, design D-5); verified by tests with the
  tokens `SCN-KR-054`, `SCN-KR-055` passing

## 3. Admission

- [ ] 3.1 `admission.ts` — `admit` with its four stages, the hash `sha256:` over `type@n`, the size limit, deep
  freezing, the registry of kernel-made values (`REQ-KR-013`, design D-3, D-4); verified by tests with the tokens
  `SCN-KR-044`, `SCN-KR-045`, `SCN-KR-046`, `SCN-KR-047`, `SCN-KR-048` passing
- [ ] 3.2 `typeOf` and `metaType` — the chain checks and the validation over the union of the chain (`REQ-KR-014`,
  design D-3, D-6); verified by tests with the tokens `SCN-KR-049`, `SCN-KR-050` passing

## 4. Envelope

- [ ] 4.1 `envelope.ts` — `entity`, `event` with the `of` check, `formatAt` (`REQ-KR-017`, design D-7); `revision.ts`
  and the type `Revision` gone; verified by tests with the tokens `SCN-KR-056`, `SCN-KR-057`, `SCN-KR-058`,
  `SCN-KR-059` passing

## 5. Interface and frozen vectors

- [ ] 5.1 `index.ts` exports exactly the interface of REQ-KR-008; `types.ts` with the code unions per function
  (`REQ-KR-008`, design D-2, D-9); verified by tests with the tokens `SCN-KR-026`, `SCN-KR-027` passing and
  `npm run typecheck` passing
- [ ] 5.2 `test/fixtures/jcs-vectors.json` with the sections `nfc` and `hash`, each hash checked by hand against
  `sha256` of its canonical text; the sha256 of the file as a constant in `contract.test.ts` (`REQ-KR-011`, design D-8);
  verified by tests with the token `SCN-KR-041` passing
- [ ] 5.3 No test carries a token `SCN-KR-001`…`SCN-KR-025` (design D-10); verified by a search of `test/` and by
  `npm test` passing as a whole

## 6. Review and verification

- [ ] 6.1 Implementation review (skill `code-review`: Standards and Spec, in the vocabulary of `codebase-design`):
  findings inside the Change fixed here, findings outside it opened as issues; the impl-PR body lists them; verified by
  the review record in the impl-PR body
- [ ] 6.2 `warrant verify s0-kernel` green, then `warrant transition s0-kernel VERIFYING`; verified by the `warrant`
  job of CI on the impl-PR
