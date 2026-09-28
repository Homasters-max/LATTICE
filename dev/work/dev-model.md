---
id: dev-model
type: dev/work@1
title: Модель dev/ на объектах LATTICE
track: infra
from: IDEA-002
change: null
branch: chore/dev-model
pr: null
focus: 1
waits: [pin-v0-8-1]
done_when:
  - {check: "PR chore/dev-model слит после archive pin-v0-8-1", via: human}
  - {check: "grep по dev/: каждый ref в from, found, source, waits, refs существует", via: cmd}
  - {check: "решение maintainer'а — комментарий в PR (IDEA-002, стандарты rules/)", via: human}
steps:
  - {n: 1, actor: agent, do: "ветка chore/dev-model (worktree): модель, миграция id с aliases, rules/, RPT-001, новые ISS", done: null}
  - {n: 2, actor: human, do: "комментарий-решение в PR: модель IDEA-002; какие правила rules/ — normative", done: null}
  - {n: 3, actor: agent, do: "после archive pin-v0-8-1: подтянуть main, перенести его последние строки dev/, PR ready", done: null}
  - {n: 4, actor: human, do: "merge PR chore/dev-model", done: null}
rules: []
---

# dev-model — Модель dev/ на объектах LATTICE

Типы, id и связи dev/ по модели LATTICE, стандартные разделы, общие правила разработки, первый отчёт отладки.

## Контекст

Работа без Change (вид PR `none`). Переносит файлы dev/ — поэтому мержится после archive pin-v0-8-1, который правит
свой узел в ветке impl.

## Решения

| id | решение | ref |
|---|---|---|
| D-1 | папка = тип; признаки — поля; id по префиксу типа, старые — в `aliases` | IDEA-002 |
| D-2 | разбор сессий — отдельный субагент по транскрипту; хук не нужен: id сессии — имя транскрипта | IDEA-002 |
| D-3 | общие правила — `rules/<тема>.md`, `advisory`; переопределение ниже — `overrides` | IDEA-002 |

## Журнал

- 2026-09-28 — миграция: W-001…013 → ISS-001…013, E-001…003 → ISS-014…016, A-001 → ISS-017; R-L0-01…09 → RUL-001…009,
  R-FD-01 → RUL-010, R-KF-01 → RUL-011; новые ISS-018…024 и RUL-012, RUL-013 — из RPT-001.
- 2026-09-28 — ISS-014 сработала второй раз (пример escape в самой ISS-014) — исправлено perl по RUL-003; повтор ловушки
  среды, не промах: обход известен и применён.
- 2026-09-28 — проверка ссылок и YAML (разовый скрипт вне репозитория): 63 объекта, 57 правил, битых ссылок нет;
  исправлены кавычки YAML в STATE (RUL-013) и ISS-014.
