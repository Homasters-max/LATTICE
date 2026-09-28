# Design

## Context

`test/process/pin.test.ts` введён Change `pin-v0-8-1` (design D-3): первый тест проекта, без него отчёт junit пуст и
`tests-passed` — `INCONCLUSIVE`. Второй `describe` перечисляет правила по именам; правило `session-start` удалено
коммитом maintainer'а 6899efb (снос `dev/`, PR #19), `npm test` — 390/391. Сейчас в `.warrant/local/rules/` — `env`,
`maintainer-acts`, `process`, `tracking`; все с `paths: ["**"]` и в `AGENTS.md` после `warrant sync`.

## Goals / Non-Goals

**Goals:**
- `npm test` зелёный; тест не ломается от удаления или добавления правила.
- Инвариант доставки сохраняется: каждое правило проекта доходит до агента через `AGENTS.md`.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. Правила — из каталога, не из списка

Тест читает `.warrant/local/rules/*.json` (`readdirSync`, по имени) и для каждого файла — один `it()` с id в имени:
`$schema` `warrant://rule/1`, `id` равен имени файла без `.json`, `paths` — `["**"]`, `text` — непустая строка, `AGENTS.md`
содержит `text.trim()`. Отдельный `it()`: правил не меньше одного — пустой каталог не проходит молча.

Альтернатива — поправить список на `env`, `maintainer-acts`, `process`, `tracking`: отвергнута, ломается при следующей
правке правил (та же причина, что у #21).

### D-2. Порядок в impl-PR

1. Первый коммит — `transition APPROVED --ref <URL слитого spec-PR> --by Homasters-max` и `IMPLEMENTING`.
2. Run `implement` — правка теста (D-1) и отметки `tasks.md`; `warrant run finish`.
3. Последний коммит — `warrant verify fix-pin-test` и `transition VERIFYING`. Тело PR — `Closes #21`.

## Implementation Notes

- **I-1** (review F-2, EVID-01M3N1TBR3EB58WHN3JM473THS): удалённое правило без `warrant sync` оставляет свой текст в
  `AGENTS.md`, и тест правил это не видит — проверка односторонняя (правило → `AGENTS.md`). Вне объёма: рассинхрон
  `AGENTS.md` с правилами ловит `warrant sync --check` / `warrant validate` (`GENERATED_DRIFT`). Решение maintainer'а —
  одобрение spec-PR https://github.com/Homasters-max/LATTICE/pull/24, где план записан. F-1 закрыт в коде: каталог
  читается с проверкой наличия, пустой — красный `it()` «there is at least one project rule».

## Risks / Trade-offs

- Тест станет зелёным и при правиле, которое `warrant sync` ещё не доставил, — нет: проверка текста в `AGENTS.md` это ловит.
- Число `it()` зависит от числа правил — `tests-passed` сверяет число тестов с отчётом junit одного прогона, не с
  константой.
