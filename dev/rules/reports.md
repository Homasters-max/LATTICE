---
id: reports
type: dev/guide@1
version: 2
title: Отчёты отладки
paths: ["dev/reports/**"]
rules:
  - {id: RUL-041, text: "Отчёт RPT-NNN пишет отдельный субагент по транскрипту сессии; рабочий агент — только блокирующие ISS и строки журнала", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-042, text: "Каждая находка → ISS (существующая — в refs, это повтор; иначе новая); улучшение → IDEA; отчёт проблем не хранит", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-043, text: "У находки: класс причины из перечня, цена (вызовы, время, токены), покрытие (ISS/RUL) и соблюдено ли правило", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-044, text: "Не больше 120 строк; из транскрипта — только короткие цитаты ошибок; без секретов и личных данных", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-045, text: "«Итог» — числа: вызовы, сбои по классам, след dev/ (правки, поля-дубли WARRANT/OpenSpec) — сигнал остановки модели", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-054, text: "Реестр sessions/: объект SES-<8 знаков> на каждую рабочую сессию с env.sessions_since; заводит аналитик (session-audit), audit — RPT разбора", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-046, text: "Разбор сессий и сводный — только по запросу человека (/session-audit); агент на старте показывает число неразобранных и может предложить разбор, сам не запускает; отчёт — событие, не правится", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
---

# reports — Отчёты отладки

Как разбирать рабочие сессии: сбои, чего не хватило, что улучшить системно — отдельным субагентом, по транскрипту.

## Область

`dev/reports/`, `dev/sessions/`. Транскрипт сессии — `~/.claude/projects/D--project-LATTICE/<session>.jsonl`; процедура — навык [session-audit](../../.claude/skills/session-audit/SKILL.md); неразобранные — `python scripts/dev/dev-check.py --sessions`. Запуск — человеком: `/session-audit [id …] [--synthesis]`. Виды: `kind: session` (одна сессия, промпт `analyst.md`) и `kind: synthesis` (промпт `synthesis.md`) — системные проблемы, слияние повторов, правила без срабатываний.

**Классы причины:** `warrant-defect` · `warrant-gap` · `lattice-process` (dev/, процедуры) · `env` · `agent` · `human-wait`.

**Разделы:** Сессия (id, период, цепочка `focus`, коммиты) · Сбои (таблица: № · что · класс · цена · покрытие · действие) · Не хватает (инструменты, сведения) · Улучшения (кому · что · основание) · Итог (числа).

## Проверка

Review; после `session-audit` — форма отчёта проверяется навыком.
