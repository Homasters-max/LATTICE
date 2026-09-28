---
id: IDEA-007
type: dev/idea@1
version: 2
title: Версии всех документов в arhived/ папки
kind: request
by: human:Homasters-max
from: null
outcome: {to: [dev-model]}
---

# IDEA-007 — Версии всех документов в arhived/ папки

Изменённый документ — прежняя версия в `arhived/<имя>_vN.md` его папки, чтобы отслеживать изменения и оценивать их.

## Суть

Запрос maintainer'а 2026-09-28 (чат; фиксируется в PR `gh/8`): ввести версионирование всех документов правилом. Охват — `dev/` и `design/`; `openspec/`, `.warrant/` версионирует WARRANT. Дублирует историю git сознательно: версии видны без git и ложатся на ревизии LATTICE (`id@n`); рост — через `dev-check.py --footprint`.

## Исход

Сделано в dev-model: `scripts/dev/snapshot.py` (снимки, `--check`, `--list`), поле `version`, RUL-058, README «Версии», проверка в `dev-check.py`.
