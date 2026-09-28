---
id: IDEA-006
type: dev/idea@1
version: 1
title: Проверка стандартов кода при разборе сессии
kind: idea
by: agent
from: RPT-005
outcome: {to: [session-audit]}
---

# IDEA-006 — Проверка стандартов кода при разборе сессии

Аналитик проверяет правила code, quality, tests, если сессия правила src/** или test/**.

## Суть

17 правил стандартов ни разу не оценивались ни одним разбором (RPT-005): нельзя ни подтвердить их пользу, ни снять.

## Исход

Сделано в session-audit: пункт в `.claude/skills/session-audit/analyst.md`.
