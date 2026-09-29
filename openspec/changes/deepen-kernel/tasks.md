# Tasks

## 1. Тест структуры

- [ ] 1.1 Граф импортов и политика: загрузка дерева по `sources` ∪ `perimeter`, один разбор файла, рёбра по D-2, глобы,
  `checkStructure(root, policy)`, правила REQ-AR-001 перенесены из `checkKernelFile`, `no-kernel` для точки входа,
  политика проекта `test/architecture/policy.ts`, `structure.test.ts` на новом интерфейсе, `checkKernel` удалён
  (`REQ-AR-001`, design D-1, D-2, D-8), `broken/` дополнен импортами по SCN-AR-002; проверка — тесты с токенами
  `SCN-AR-001`, `SCN-AR-002` проходят, метки фикстур `test/fixtures/structure/kernel/**` не правлены
- [ ] 1.2 Периметр от точки входа: правило `outside-perimeter`, фикстура `test/fixtures/structure/perimeter/`
  (`REQ-AR-003`, design D-3, D-8); проверка — тесты с токенами `SCN-AR-004`, `SCN-AR-005` проходят
- [ ] 1.3 Нет циклов: правило `import-cycle`, фикстура `test/fixtures/structure/cycles/` (`REQ-AR-004`, design D-1);
  проверка — тесты с токенами `SCN-AR-006`, `SCN-AR-007` проходят
- [ ] 1.4 `checkTests` на общем `parse` (`REQ-AR-002`, поведение прежнее); проверка — тест с токеном `SCN-AR-003`
  проходит

## 2. Ядро без смены поведения

- [ ] 2.1 `ref.ts` — `checkAt`, `refObject`; `idKind`, `isNamespace`, `isVersion` — внутренние; вызывающие
  `revision.ts`, `formatRef`, `hash.ts`, `ids.ts`, `input.ts`, `refs.ts` переведены (`REQ-KR-005`, design D-4);
  проверка — тесты с токенами `SCN-KR-004`, `SCN-KR-009`, `SCN-KR-010`, `SCN-KR-011`, `SCN-KR-012`, `SCN-KR-013`,
  `SCN-KR-014`, `SCN-KR-015`, `SCN-KR-017`, `SCN-KR-020`, `SCN-KR-021`, `SCN-KR-022` проходят
- [ ] 2.2 `canonical.ts` — `canonical` и `eachObject` над одним обходом без флага `emit`; `hash` канонизирует конверт;
  `refsOf` на `eachObject` (`REQ-KR-003`, `REQ-KR-004`, `REQ-KR-006`, design D-5); проверка — тесты с токенами
  `SCN-KR-006`, `SCN-KR-007`, `SCN-KR-008`, `SCN-KR-009`, `SCN-KR-013`, `SCN-KR-019`, `SCN-KR-021`, `SCN-KR-022`,
  `SCN-KR-024` проходят
- [ ] 2.3 `unicode16.ts` — `admit`, `hasLoneSurrogate`; `input.ts` — одна ветка для ключа и значения (`REQ-KR-002`,
  design D-6); проверка — тесты с токенами `SCN-KR-002`, `SCN-KR-004`, `SCN-KR-007`, `SCN-KR-016`, `SCN-KR-017`,
  `SCN-KR-018`, `SCN-KR-023` проходят
- [ ] 2.4 Не новая версия ядра (design D-7); проверка — `git diff main -- src/kernel/index.ts test/kernel
  test/fixtures/jcs-vectors.json` пуст, тесты с токенами `SCN-KR-001`, `SCN-AR-001` проходят

## 3. Проверка

- [ ] 3.1 `npm run typecheck`, `npm test` и `warrant verify deepen-kernel`; проверка — все три завершаются успешно
