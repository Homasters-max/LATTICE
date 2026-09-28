---
id: foundation
type: dev/track@1
title: Общие контракты срезов
focus: kernel-format
depends_on: []
done_when:
  - {check: "каноническая форма и коммит (ADR-1) — норма в openspec/specs/: lattice/kernel-format ARCHIVED", via: warrant}
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
