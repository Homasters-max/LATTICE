# Proposal

## Why

`npm test` на `main` красный с коммита 6899efb: тест `test/process/pin.test.ts` («pin: project rules») читает
`.warrant/local/rules/session-start.json` по списку имён `maintainer-acts`, `session-start`, а правило `session-start`
удалено вместе со слоем `dev/` (PR #19). Push в `main` CI не запускает — поломка не замечена (issue #21). Список имён в
тесте ломается при каждом удалении правила и не видит новых (`env`, `tracking`). Комментарий теста ссылается на `dev/`,
которого нет.

## What Changes

- Тест «pin: project rules» проверяет каждый файл `.warrant/local/rules/*.json`, а не список имён: `$schema`
  `warrant://rule/1`, `id` равен имени файла, `paths` — `["**"]`, непустой `text`, текст — в `AGENTS.md`; правил не меньше
  одного.
- Комментарий файла — без `dev/` и без списка правил.
- Тест «pin: CI judge and lock» не меняется.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет: продукт LATTICE не меняется, меняется тест процесса проекта (`skip_specs: true`).

## Impact

- `test/process/pin.test.ts`. Кода `src/` и policy-путей нет.
- `npm test` на `main` снова зелёный; удаление или добавление правила в `.warrant/local/rules/` тест не ломает, если
  `warrant sync` выполнен.

## Non-goals

- Путевые правила (`paths` уже `**`): их нет; тест требует `**`, первое такое правило меняет тест в своём Change.
- Запуск CI на push в `main` — вопрос WARRANT (S-2 в `D:/tmp/warrant-inbox/`).
