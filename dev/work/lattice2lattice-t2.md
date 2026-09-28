---
id: lattice2lattice-t2
type: dev/work@1
title: Состояние разработки из LATTICE
track: infra
from: null
change: null
branch: null
pr: null
focus: null
waits: [lattice2lattice-t1]
done_when:
  - {check: "lattice load dev/ (source-files) и WARRANT (source-warrant) — lint без hard", via: cmd}
  - {check: "сессия стартует по lattice explain", via: human}
steps: []
rules: []
---

# lattice2lattice-t2 — Состояние разработки из LATTICE

Заготовка: фокус сюда переводит `switch` T2-switch (s4 ARCHIVED); dev/ остаётся источником, проекцию даёт LATTICE.

## Контекст

Отдельный Change по AGENTS.md. Ссылки dev/ уже в грамматике `пространство/local` — загрузчик разрешает их без
переписывания.

## Решения

## Журнал

- 2026-09-28 — заготовка; поля переведены в модель объектов LATTICE (dev-model).
