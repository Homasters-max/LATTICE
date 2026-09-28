---
id: pin-v0-8-1
type: dev/work@1
version: 2
title: Закрепить WARRANT v0.8.1
track: infra
from: null
change: lattice/pin-v0-8-1
branch: null
pr: 7
waits: []
rules: []
---

# pin-v0-8-1 — Закрепить WARRANT v0.8.1

Тег v0.8.1 в workflow, `warrant sync` 0.8.1, правила основной сессии — в `.warrant/local/rules/`; ARCHIVED (`gh/5`, `gh/6`, `gh/7`).

## Контекст

Задачи и отметки — `openspec/changes/archive/2026-09-28-pin-v0-8-1/tasks.md`; этап — `warrant status pin-v0-8-1`. В 0.8.1 закрыты ISS-002, ISS-003, ISS-005, ISS-006 (`warrant/ADR-0042`). Правка политики — factory-change; патч policy-путей применяет maintainer (design D-2). Процедура на будущее — [rules/process.md](../rules/process.md) «Pin WARRANT».

## Решения

| id | решение | ref |
|---|---|---|
| F-1 | приёмка — пин v0.8.1 и ISS-005; ISS-003, ISS-006 проверяются в kernel-format | `gh/5#issuecomment-5865888855` |

Остальные — `lattice/pin-v0-8-1#I-1`…`#I-9` (design.md Change).

## Журнал

- 2026-09-28 — порядок: после dev-state, до kernel-format.
- 2026-09-28 — без тестов junit-отчёт пуст → `tests-passed` `INCONCLUSIVE` (parser 0.8.1): в impl-PR первый тест проекта — инвариант пина (design D-3).
- 2026-09-28 — review 1 `PROVEN` с MAJOR F-1, F-2 → `I-N` в impl-PR, не новый раунд (R-L0-07).
- 2026-09-28 — F-1 решён maintainer'ом: приёмка — пин v0.8.1 и W-005; W-003, W-006 — kernel-format (https://github.com/Homasters-max/LATTICE/pull/5#issuecomment-5865888855).
- 2026-09-28 — промах агента: коммит dev/ между `verify` и `transition SPECIFIED` — spec-report `STALE`, `verify` повторён (bb5eaad); `APPROVED` после merge — тоже `verify` заново (merge-коммит сдвигает HEAD). Порядок: dev/ → `verify` → `transition`.
- 2026-09-28 — проба патча на копии дерева: `sync` — `FRONTEND_RESTART_REQUIRED` (W-005 принят, I-1), `validate` зелёный, `tests-passed` `PROVEN` 3/3.
- 2026-09-28 — перезапуск сессии выделен шагом человека (I-4); проверки задач 1.1, 1.2 пройдены (`git diff` — только строка тега; `validate`, `sync --check` зелёные).
- 2026-09-28 — задачи 3.1, 3.2 не отмечены в `tasks.md`: проверки идут после `run finish` и коммита `VERIFYING`; результаты — в теле PR #6, `archive` отметок не требует. Локальный `warrant ci` — исход D-1 (код 1, `ATTESTATION_REQUIRED` на `tests-passed` и `factory-golden-passed`, `human-approval` в `deferred[]`).
- 2026-09-28 — merge PR #6 в 08:42:03 — до конца job `warrant` (08:42:18, `SUCCESS`); база та же (07c90ef), evidence CI не `STALE`, `MERGED` — все gates `PASS`. Порядок: merge — после зелёного job.
- 2026-09-28 — исправление к строке «промах агента»: причина STALE — не коммит dev/, а привязка spec-report к commit (`warrant/REQ-VER-003`): любой коммит между `verify` и `transition` делает его STALE; порядок — `verify && transition` на одном HEAD (ISS-018, RUL-012; разбор `RPT-001`).
- 2026-09-28 — перенос в модель объектов LATTICE (dev-model): шаги убраны — они повторяли lifecycle WARRANT и `tasks.md` (сигнал остановки, README); задачи 3.1, 3.2 без отметок — ISS-026.
