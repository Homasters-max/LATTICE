---
id: session-audit
type: dev/work@1
title: Разбор сессий субагентом
track: infra
from: IDEA-002
change: null
branch: chore/dev-model
pr: 8
waits: []
rules: []
---

# session-audit — Разбор сессий субагентом

Реестр сессий, сжатие транскрипта и навык аналитика: свежий субагент разбирает сессию и пишет `RPT` с классификацией,
рабочий агент контекст не тратит; сводный анализ ищет системные проблемы.

## Контекст

Транскрипты лежат по id сессии в `~/.claude/projects/D--project-LATTICE/<id>.jsonl` — хук не нужен; неразобранные
вычисляет `dev-check.py --sessions`. Навык — `.claude/skills/session-audit/` по стандарту WARRANT-ADR-0032 п. 6. Идёт в
PR `gh/8` вместе с dev-model.

## Шаги

- [x] 1 · agent · scripts/dev/session-digest.py — сжатие 1,4–5 МБ → 7–19 КБ, сбои RPT-001 найдены — gh/8
- [x] 2 · agent · scripts/dev/dev-check.py — форма, ссылки, --start, --sessions — gh/8
- [x] 3 · agent · навык session-audit: SKILL.md, analyst.md, synthesis.md — gh/8
- [x] 4 · agent · реестр sessions/: 4 сессии с 2026-09-27T21:45 — gh/8
- [ ] 5 · agent · проверка навыка на SES-4a6aa6ee (RPT-004) и сводный RPT-005

## Приёмка

- [ ] session-digest.py на всех транскриптах реестра ≤ 30 КБ · cmd
- [ ] RPT-004 написан по навыку (analyst.md), не вручную · human
- [ ] сводный RPT-005 по RPT-001…004 · cmd

## Решения

| id | решение | ref |
|---|---|---|
| D-1 | реестр — объект на сессию `SES-<8 знаков>`, записи заводит аналитик, не хук | IDEA-002 |
| D-2 | разбор — каждая рабочая сессия, sonnet, в фоне, до 5 одновременно; сводный — каждые 5 разборов или archive Change | IDEA-002 |

## Журнал

- 2026-09-28 — заготовка (IDEA-002); после dev-model.
- 2026-09-28 — сделано в том же PR `gh/8`: разборы RPT-002, RPT-003 показали, что без реестра и сжатия каждый аналитик
  заново пишет разбор JSONL (~170 тыс. токенов на сессию).
