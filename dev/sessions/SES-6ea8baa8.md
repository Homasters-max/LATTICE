---
id: SES-6ea8baa8
type: dev/session@1
version: 1
title: Архив pin-v0-8-1 и полный цикл kernel-format
transcript: 6ea8baa8-af55-4d74-b31e-37711fd3b180
period: 2026-09-28T08:37Z/10:38Z
kind: work
links: [pin-v0-8-1, kernel-format, lattice/pin-v0-8-1, lattice/kernel-format, lattice/pin-v0-8-1#task-2.1, lattice/kernel-format#task-3.1, gh/6, gh/7, gh/2, gh/9, gh/10, git/286829b, git/3776ea7, git/244a91e, git/95c261b, git/3167dde, git/2f15f83]
audit: RPT-002
---

# SES-6ea8baa8 — Архив pin-v0-8-1 и полный цикл kernel-format

Сессия закрыла pin-v0-8-1 (impl, archive) и провела kernel-format от review 2 до ARCHIVED: оба Change закрыты.

## Что делала

- pin-v0-8-1: implement (тест пина), VERIFYING, MERGED, archive (`gh/6`, `gh/7`);
- kernel-format: review 2 и 3, UNK-KR-005…008, SPECIFIED, implement (391 тест), waiver WAV-2026-001, archive (`gh/9`,
  `gh/10`); нормы `openspec/specs/kernel`, `architecture`;
- проверены ISS-003, ISS-006; найдены W-014 (→ ISS-025) и неотмечаемые задачи проверки (ISS-026).

## Разбор

RPT-002: протокол старта 5/5; главные потери — classify/scope-valid после waiver (ISS-025), подсказка guard ×132
(ISS-019); новые — ISS-026, ISS-028.
