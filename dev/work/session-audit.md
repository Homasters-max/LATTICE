---
id: session-audit
type: dev/work@1
title: Разбор сессий субагентом
track: infra
from: IDEA-002
change: null
branch: null
pr: null
focus: null
waits: [dev-model]
done_when:
  - {check: "scripts/dev/session-digest.mjs сжимает транскрипт сессии ≤ 30 КБ (хронология, вызовы, ошибки, deny, повторы)", via: cmd}
  - {check: "навык session-audit пишет RPT-NNN по rules/reports.md для сессии без отчёта", via: cmd}
  - {check: "второй отчёт (RPT) написан навыком, не вручную", via: human}
steps: []
rules: []
---

# session-audit — Разбор сессий субагентом

Навык и сжатие транскрипта: свежий субагент разбирает сессию и пишет `RPT-NNN` с классификацией, рабочий агент контекст
не тратит.

## Контекст

Транскрипты уже лежат по id сессии в `~/.claude/projects/D--project-LATTICE/<id>.jsonl`; неразобранные — вычисляются
(транскрипт без `RPT` с таким `session`). Разбор JSONL на ходу субагенты писали дважды (RPT-001, разбор сессии
переноса) — поэтому сжатие скриптом. Навык — по стандарту WARRANT-ADR-0032 п. 6 (Вход, Шаги, Стоп, Отчёт; ≤ 80 строк).

## Решения

## Журнал

- 2026-09-28 — заготовка (IDEA-002); после dev-model.
