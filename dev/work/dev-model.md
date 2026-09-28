---
id: dev-model
type: dev/work@1
title: Модель dev/ на объектах LATTICE
track: infra
from: IDEA-002
change: null
branch: chore/dev-model
pr: 8
waits: []
rules: []
---

# dev-model — Модель dev/ на объектах LATTICE

Типы, id и связи dev/ по модели LATTICE, отметки только там, где нет OpenSpec, стандарты разработки, реестр сессий,
разборы и цикл разработки.

## Контекст

Работа без Change (вид PR `none`), вместе с `session-audit` — один PR `gh/8`. Переносит файлы dev/: сливается с `main`
после archive pin-v0-8-1 и kernel-format, их узлы перенесены из `main`.

## Шаги

- [x] 1 · agent · модель, миграция id с aliases, rules/, RPT-001, новые ISS — git/1763857
- [x] 2 · agent · Change без шагов, отметки — списком, реестр сессий, цикл, вывод; слияние main (pin-v0-8-1, kernel-format) — gh/8
- [x] 3 · agent · разборы RPT-002, RPT-003 субагентами; сводный RPT-005 — gh/8
- [ ] 4 · agent · dev-check.py без ошибок, PR ready
- [ ] 5 · human · комментарий-решение в PR: модель IDEA-002; какие правила rules/ сделать normative (по желанию)
- [ ] 6 · human · merge PR chore/dev-model

## Приёмка

- [ ] python scripts/dev/dev-check.py — 0 ошибок · cmd
- [ ] у Change в work/ нет шагов; задачи — только в tasks.md · cmd
- [ ] каждая рабочая сессия с 2026-09-27T21:45 — в sessions/ и разобрана · cmd
- [ ] PR слит · human

## Решения

| id | решение | ref |
|---|---|---|
| D-1 | папка = тип; признаки — поля; id по префиксу типа, старые — в `aliases` | IDEA-002 |
| D-2 | разбор сессий — отдельный субагент по транскрипту; хук не нужен: id сессии — имя транскрипта | IDEA-002 |
| D-3 | общие правила — `rules/<тема>.md`, `advisory`; переопределение ниже — `overrides` | IDEA-002 |
| D-4 | у Change шагов нет — этап `warrant status`, задачи `tasks.md`; отметки — только у работы без Change | IDEA-002 |
| D-5 | инструменты dev/ — Python (`scripts/dev/*.py`, PyYAML): YAML frontmatter без зависимостей Node не разобрать, корневой `package.json` — патч maintainer'а | dev-model |

## Журнал

- 2026-09-28 — миграция: W-001…013 → ISS-001…013, E-001…003 → ISS-014…016, A-001 → ISS-017; R-L0-01…09 → RUL-001…009,
  R-FD-01 → RUL-010, R-KF-01 → RUL-011; новые ISS-018…024 и RUL-012, RUL-013 — из RPT-001.
- 2026-09-28 — ISS-014 сработала второй раз (пример escape в самой ISS-014) — исправлено perl по RUL-003; повтор ловушки
  среды, не промах: обход известен и применён.
- 2026-09-28 — проверка ссылок и YAML (разовый скрипт вне репозитория): 63 объекта, 57 правил, битых ссылок нет;
  исправлены кавычки YAML в STATE (RUL-013) и ISS-014.
- 2026-09-28 — сигнал остановки сработал: шаги Change в dev/ повторяли lifecycle WARRANT и `tasks.md` — замечено
  maintainer'ом; у Change шаги убраны, отметки — только у работы без Change (D-4).
- 2026-09-28 — pin-v0-8-1 и kernel-format закрыты другой сессией (SES-6ea8baa8) пока шла эта работа: `main` слит, их
  журналы перенесены без правок; W-014 из `main` → ISS-025.
- 2026-09-28 — проверка ссылок повторилась и протокол старта сорвался (ISS-022) — по RUL-040 сделаны
  `scripts/dev/dev-check.py` (форма, ссылки, `--start`, `--sessions`) и `session-digest.py`.
- 2026-09-28 — 8 активных правил в STATE > 7 — RUL-012, RUL-013 перенесены в стандарт `process`.
