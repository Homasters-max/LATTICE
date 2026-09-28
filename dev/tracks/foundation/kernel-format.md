---
schema: lattice-dev/node@1
kind: change
change: kernel-format
branch: spec/kernel-format
pr: 2
done_when: Change ARCHIVED; W-003 проверен в impl-PR (junit node:test → PROVEN)
focus: 5
waits: [UNK-KR-005]
steps:
  - {id: 1, actor: human, do: "решение UNK-KR-001…004", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5860422619"}
  - {id: 2, actor: agent, do: "review 1", done: "EVID-01M3JHV12SMRHDT34WPQXC7QE3"}
  - {id: 3, actor: agent, do: "подтянуть main в spec/kernel-format (после pin-v0-8-1)", done: "3aa7323"}
  - {id: 4, actor: agent, do: "Run specify: правка spec по F-1…F-24 (находки — в EVID-01M3JHV12SMRHDT34WPQXC7QE3)", done: "RUN-01M3KMC27PYZFPJ68PGA63BRBP; карта F-N → REQ/SCN — design.md «Решения по review 1»"}
  - {id: 5, actor: agent, do: "F-5 (версия Unicode для NFC) — blocking UNK-KR-005, вопрос в PR #2", done: null}
  - {id: 6, actor: human, do: "решение UNK-KR-005 комментарием в PR #2", done: null}
  - {id: 7, actor: agent, do: "unknown resolve UNK-KR-005; Run specify — решение в spec (REQ-KR-002, SCN), design Open Questions", done: null}
  - {id: 8, actor: agent, do: "review 2 субагентом warrant-reviewer, сдача --file (проверка W-006)", done: null}
  - {id: 9, actor: agent, do: "warrant verify, PR ready; далее transition SPECIFIED после одобрения", done: null}
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
- 2026-09-28 — review 1: где рекомендация оставляла выбор — F-1 `too-deep` единственный (как `syntax`), F-6 у
  `refsOf` свои отказы; review 2 — после решения UNK-KR-005, чтобы не делать третий раунд.
