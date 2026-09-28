---
id: IDEA-001
type: dev/idea@1
version: 1
title: Отказ от скрытой памяти агента
kind: request
by: human:Homasters-max
from: gh/3#issuecomment-5865372587
outcome: {to: [dev-state, PRP-001]}
---

# IDEA-001 — Отказ от скрытой памяти агента

Состояние, ловушки и правила работы — в репозитории и механизмах WARRANT, а не в автопамяти Claude Code.

## Суть

Автопамять лежала вне репозитория, её не видно в PR и никто не проверял; туда уходили нерешённые вопросы. Нужно
состояние по срезам и глобальный указатель, лог проблем WARRANT и LATTICE, триггер перехода на LATTICE.

## Исход

Grilling Q1–Q29 (2026-09-28), решение maintainer'а — `gh/3#issuecomment-5865372587`; работа `dev-state` (`gh/3`,
`gh/4`); предложение WARRANT — `PRP-001`.
