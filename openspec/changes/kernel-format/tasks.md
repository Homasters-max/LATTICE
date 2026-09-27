# Tasks

## 1. Заготовка

- [ ] 1.1 `package.json`, `package-lock.json`, `tsconfig.json` по design D-6; `src/kernel/types.ts` — `Result`, `Refusal`,
  branded `Id`, `Ref`, `Hash` (`REQ-KR-001`); проверка — `npm run typecheck` без ошибок

## 2. Тест структуры

- [ ] 2.1 Тест структуры: изоляция ядра по AST, фикстуры `test/fixtures/structure/` (`REQ-AR-001`); проверка — тесты
  с токенами `SCN-AR-001` и `SCN-AR-002` проходят
- [ ] 2.2 Правило «тест внутри `describe()`» (`REQ-AR-002`); проверка — тест с токеном `SCN-AR-003` проходит

## 3. Ядро: формат v1

- [ ] 3.1 `checkInput` — разбор RFC 8259, NFC, отказы входной проверки, предел глубины (`REQ-KR-002`, решения
  `UNK-KR-001`, `UNK-KR-002`, `UNK-KR-004`); проверка — тесты с токенами `SCN-KR-002`, `SCN-KR-003`, `SCN-KR-004`,
  `SCN-KR-005` проходят
- [ ] 3.2 `canonical` — JCS, фикстура векторов RFC 8785 `test/fixtures/jcs-vectors.json` (`REQ-KR-003`); проверка —
  тесты с токенами `SCN-KR-006`, `SCN-KR-007` проходят
- [ ] 3.3 `hash`, `valueId` (`REQ-KR-004`); проверка — тесты с токенами `SCN-KR-008`, `SCN-KR-009` проходят
- [ ] 3.4 `parseRef`, `formatRef`, `newId` (`REQ-KR-005`, решение `UNK-KR-003`); проверка — тесты с токенами
  `SCN-KR-010`, `SCN-KR-011`, `SCN-KR-012` проходят
- [ ] 3.5 `refsOf` (`REQ-KR-006`); проверка — тест с токеном `SCN-KR-013` проходит
- [ ] 3.6 `revision` (`REQ-KR-007`); проверка — тесты с токенами `SCN-KR-014`, `SCN-KR-015` проходят
- [ ] 3.7 Отказ — значение, чистота функций по всем недопустимым входам (`REQ-KR-001`); проверка — тест с токеном
  `SCN-KR-001` проходит

## 4. Проверка

- [ ] 4.1 `npm run typecheck`, `warrant check kernel-format tests-passed` и `warrant verify kernel-format`; проверка — все
  три завершаются успешно
