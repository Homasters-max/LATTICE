---
id: kernel-format
type: dev/work@1
title: Формат v1 ядра
track: foundation
from: null
change: lattice/kernel-format
branch: spec/kernel-format
pr: 2
focus: 3
waits: [pin-v0-8-1]
done_when:
  - {check: "lattice/kernel-format ARCHIVED", via: warrant}
  - {check: "impl-PR на v0.8.1: junit node:test с тестами вне describe → tests-passed PROVEN с верным числом (ISS-003)", via: warrant}
  - {check: "review 2 сдан warrant-reviewer с первой попытки (ISS-006)", via: warrant}
steps:
  - {n: 1, actor: human, do: "решение UNK-KR-001…004", done: gh/2#issuecomment-5860422619}
  - {n: 2, actor: agent, do: "review 1", done: lattice/EVID-01M3JHV12SMRHDT34WPQXC7QE3}
  - {n: 3, actor: agent, do: "подтянуть main в spec/kernel-format (после pin-v0-8-1)", done: null}
  - {n: 4, actor: agent, do: "Run specify: правка spec по F-1…F-24 (lattice/EVID-01M3JHV12SMRHDT34WPQXC7QE3)", done: null}
  - {n: 5, actor: agent, do: "F-5 (версия Unicode для NFC) — blocking UNK, вопрос в PR #2", done: null}
  - {n: 6, actor: agent, do: "review 2 субагентом warrant-reviewer, сдача --file", done: null}
  - {n: 7, actor: agent, do: "warrant verify && transition; PR ready; SPECIFIED после одобрения", done: null}
rules:
  - id: RUL-011
    aliases: [R-KF-01]
    text: F-5 сам не решать — только blocking UNK к maintainer'у
    force: advisory
    status: active
    source: lattice/EVID-01M3JHV12SMRHDT34WPQXC7QE3
    owner: human:Homasters-max
    when: {operation: specify}
---

# kernel-format — Формат v1 ядра

Норма формата ядра: JCS, хэш, id и ссылки, ревизия, тест структуры; spec-PR `gh/2`, risk HIGH.

## Контекст

Review 1 — NOT_PROVEN: BLOCKER 1, MAJOR 10, MINOR 10, INFO 3 (F-1…F-24 в EVID). Review 2 и impl — только на v0.8.1
(ISS-003, ISS-006), поэтому ждёт pin-v0-8-1.

## Решения

Все — в WARRANT: `lattice/UNK-KR-001`…`004` (`gh/2#issuecomment-5860422619`).

## Журнал

- 2026-09-28 — ждёт pin-v0-8-1: review 2 и impl должны идти на v0.8.1 (W-003, сдача review --file).
- 2026-09-28 — перенос в модель объектов LATTICE (dev-model); `done_when` — проверки.
