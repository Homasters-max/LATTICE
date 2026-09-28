---
schema: lattice-dev/node@1
kind: change
change: kernel-format
branch: spec/kernel-format
pr: 2
done_when: Change ARCHIVED; W-003 проверен в impl-PR (junit node:test → PROVEN)
focus: 4
waits: []
steps:
  - {id: 1, actor: human, do: "решение UNK-KR-001…004", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5860422619"}
  - {id: 2, actor: agent, do: "review 1", done: "EVID-01M3JHV12SMRHDT34WPQXC7QE3"}
  - {id: 3, actor: agent, do: "подтянуть main в spec/kernel-format (после pin-v0-8-1)", done: "3aa7323"}
  - {id: 4, actor: agent, do: "Run specify: правка spec по F-1…F-24 (находки — в EVID-01M3JHV12SMRHDT34WPQXC7QE3)", done: null}
  - {id: 5, actor: agent, do: "F-5 (версия Unicode для NFC) — blocking UNK, вопрос в PR #2", done: null}
  - {id: 6, actor: agent, do: "review 2 субагентом warrant-reviewer, сдача --file", done: null}
  - {id: 7, actor: agent, do: "warrant verify, PR ready; далее transition SPECIFIED после одобрения", done: null}
rules:
  - id: R-KF-01
    text: F-5 сам не решать — только blocking UNK к maintainer'у
    force: advisory
    status: active
    source: EVID-01M3JHV12SMRHDT34WPQXC7QE3 (F-5)
    owner: human:Homasters-max
    when: {operation: specify}
---

# kernel-format — формат ядра

spec-PR #2, risk HIGH. Review 1 — NOT_PROVEN: BLOCKER 1, MAJOR 10, MINOR 10, INFO 3 (F-1…F-24).

## Журнал

- 2026-09-28 — ждёт pin-v0-8-1: review 2 и impl должны идти на v0.8.1 (W-003, сдача review --file).
