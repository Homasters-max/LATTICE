---
id: IDEA-003
type: dev/idea@1
title: Правила текстом для промпта субагента
kind: idea
by: agent
from: RPT-005
outcome: {to: [dev-model]}
---

# IDEA-003 — Правила текстом для промпта субагента

dev-check.py --brief <операция>: применимые правила (env, process, ловушки STATE и стандарты операции) текстом для промпта субагента.

## Суть

Самая дорогая системная причина — правила не доходят до исполнителя (RPT-005 S1): RPT-003 F5 ≈23 вызова и ≈34 мин, warrant-reviewer в RPT-002 получил сырой JSON без правил, аналитики RPT-004 упирались в ISS-015 и ISS-028.

## Исход

Сделано в dev-model: `--brief` в `scripts/dev/dev-check.py`; вызов — в процедуре «Change» (`--brief review`) и в промптах session-audit (`--brief audit`); закрывает ISS-023 при подтверждении отчётами.
