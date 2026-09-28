---
id: lattice2lattice-t1
type: dev/work@1
title: Форма dev/ в типах LATTICE
track: infra
from: null
change: null
branch: null
pr: null
focus: null
waits: []
done_when:
  - {check: "типы dev/state, idea, track, work, issue, rule, report, proposal — проектные типы LATTICE", via: cmd}
  - {check: "lattice lint dev/ — без hard", via: cmd}
steps: []
rules: []
---

# lattice2lattice-t1 — Форма dev/ в типах LATTICE

Заготовка: фокус сюда переводит `switch` T1-freeze (s2 ARCHIVED); отдельный Change по AGENTS.md, шаги — при старте.

## Контекст

Вход — README dev/ (типы, поля, связи) и проблемы с `close_when` на T2. Решить здесь: правило — отдельный объект или
блок стандарта (`rules/*.md` — один `knowledge`).

## Решения

## Журнал

- 2026-09-28 — заготовка; поля переведены в модель объектов LATTICE (dev-model).
