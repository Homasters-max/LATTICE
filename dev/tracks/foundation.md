---
id: foundation
type: dev/track@1
title: Общие контракты срезов
focus: null
depends_on: []
rules:
  - id: RUL-010
    aliases: [R-FD-01]
    text: Тестовые векторы JCS формата v1 — эталон; их не правят под реализацию
    force: advisory
    status: active
    source: design/05-slices.md#s1
    owner: human:Homasters-max
---

# foundation — Общие контракты срезов

Change, чей контракт нужен нескольким срезам, а не одному: без него S1 и дальше не реализовать.

## Цель

Зафиксировать формат ядра (каноническая форма, хэш, id и ссылки, ревизия) нормой до S0.

## Журнал

- 2026-09-28 — kernel-format отнесён сюда (grilling: область действия контракта).
- 2026-09-28 — kernel-format ARCHIVED (gh/10): нормы `openspec/specs/kernel`, `openspec/specs/architecture`; дорожка без
  работы в фокусе, новые общие контракты — сюда.
