---
id: docs
type: dev/guide@1
version: 2
title: Тексты и документы
paths: ["dev/**", "design/**", "openspec/changes/**"]
rules:
  - {id: RUL-058, text: "Документ dev/ или design/ перед коммитом правки — python scripts/dev/snapshot.py: прежняя версия в arhived/<имя>_vN.md, version +1; снимки не правятся и не удаляются", force: advisory, status: active, source: IDEA-007, owner: "human:Homasters-max"}
  - {id: RUL-035, text: "Язык — русский; термины, команды, коды ошибок и id — как есть", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-036, text: "Первый абзац под заголовком — одна фраза-суть (summary при загрузке source-files)", force: advisory, status: active, source: "design/domains/30-adapters.md#AD-12", owner: "human:Homasters-max"}
  - {id: RUL-037, text: "Факт, который можно вычислить (git log, warrant status, состав каталога), прозой не пишется — ссылкой", force: advisory, status: active, source: warrant/ADR-0032, owner: "human:Homasters-max"}
  - {id: RUL-038, text: "Ссылки — по грамматике dev/README.md «Ссылки»: самая точная цель — id элемента → раздел (заголовок дословно) → файл, заметка базы — kb/ID#Раздел; номер строки не пишется; временные каталоги, чат и проза ссылкой не бывают", force: advisory, status: active, source: [IDEA-002, gh/14], owner: "human:Homasters-max"}
  - {id: RUL-059, text: "Markdown: абзац и пункт списка — одна строка любой длины, по ширине не переносить; новая строка — новый абзац, пункт, заголовок, строка таблицы или код; строка, которая должна быть видна отдельно, — отдельный абзац или пункт", force: advisory, status: active, source: [gh/12, wrap-cleanup], owner: "human:Homasters-max"}
---

# docs — Тексты и документы

Как писать тексты, которые читает и человек, и загрузчик LATTICE: суть первым абзацем, ссылки вместо пересказа.

## Область

`dev/**`, `design/**` (заморожен: только по решению), артефакты Change.

## Проверка

Review; RUL-036, RUL-038 — `lint` LATTICE после T1. RUL-059 — `node C:/Users/Xiaomi/.claude/tools/md-wrap/md-wrap.mjs --check dev design` (A и L исправляет `--fix`), RUL-038 — тот же инструмент с `--links` (битые ссылки); описание — `README.md` инструмента.
