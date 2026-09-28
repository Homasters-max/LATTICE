---
id: docs
type: dev/guide@1
version: 1
title: Тексты и документы
paths: ["dev/**", "design/**", "openspec/changes/**"]
rules:
  - {id: RUL-058, text: "Документ dev/ или design/ перед коммитом правки — python scripts/dev/snapshot.py: прежняя версия в arhived/<имя>_vN.md, version +1; снимки не правятся и не удаляются", force: advisory, status: active, source: IDEA-007, owner: "human:Homasters-max"}
  - {id: RUL-035, text: "Язык — русский; термины, команды, коды ошибок и id — как есть", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-036, text: "Первый абзац под заголовком — одна фраза-суть (summary при загрузке source-files)", force: advisory, status: active, source: "design/domains/30-adapters.md#AD-12", owner: "human:Homasters-max"}
  - {id: RUL-037, text: "Факт, который можно вычислить (git log, warrant status, состав каталога), прозой не пишется — ссылкой", force: advisory, status: active, source: warrant/ADR-0032, owner: "human:Homasters-max"}
  - {id: RUL-038, text: "Ссылки — по грамматике dev/README.md «Ссылки»; временные каталоги, чат и проза ссылкой не бывают", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
---

# docs — Тексты и документы

Как писать тексты, которые читает и человек, и загрузчик LATTICE: суть первым абзацем, ссылки вместо пересказа.

## Область

`dev/**`, `design/**` (заморожен: только по решению), артефакты Change.

## Проверка

Review; RUL-036, RUL-038 — `lint` LATTICE после T1.
