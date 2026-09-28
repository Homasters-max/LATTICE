---
id: IDEA-004
type: dev/idea@1
title: Метрики в сжатии сессии
kind: idea
by: agent
from: RPT-005
outcome: {to: [session-audit]}
---

# IDEA-004 — Метрики в сжатии сессии

session-digest.py считает серии неудач, подсказки guard, ручной разбор JSON и коммиты dev/ — числа, сравнимые между отчётами.

## Суть

Отчёты оценивали «большинство из 159 вызовов» на глаз (RPT-002); без чисел сводный не видит тренда (RPT-005 S2, S3, S7).

## Исход

Сделано в session-audit: строка «метрики» в `scripts/dev/session-digest.py`.
