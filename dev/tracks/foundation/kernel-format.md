---
schema: lattice-dev/node@1
kind: change
change: kernel-format
branch: spec/kernel-format
pr: 2
done_when: Change ARCHIVED; W-003 проверен в impl-PR (junit node:test → PROVEN)
focus: 12
waits: []
steps:
  - {id: 1, actor: human, do: "решение UNK-KR-001…004", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5860422619"}
  - {id: 2, actor: agent, do: "review 1", done: "EVID-01M3JHV12SMRHDT34WPQXC7QE3"}
  - {id: 3, actor: agent, do: "подтянуть main в spec/kernel-format (после pin-v0-8-1)", done: "3aa7323"}
  - {id: 4, actor: agent, do: "Run specify: правка spec по F-1…F-24 (находки — в EVID-01M3JHV12SMRHDT34WPQXC7QE3)", done: "RUN-01M3KMC27PYZFPJ68PGA63BRBP; карта F-N → REQ/SCN — design.md «Решения по review 1»"}
  - {id: 5, actor: agent, do: "F-5 (версия Unicode для NFC) — blocking UNK-KR-005, вопрос в PR #2", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5866964576"}
  - {id: 6, actor: human, do: "решение UNK-KR-005 комментарием в PR #2", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5866978072"}
  - {id: 7, actor: agent, do: "unknown resolve UNK-KR-005; Run specify — решение в spec (REQ-KR-002, SCN), design Open Questions", done: "RUN-01M3KMTWX4HJWBQSPWM6W0MS4E (SCN-KR-023, design D-7)"}
  - {id: 8, actor: agent, do: "review 2 субагентом warrant-reviewer, сдача --file (проверка W-006)", done: "EVID-01M3KNFKZ2PE3AEHC569ZTF3B7 (PROVEN: MAJOR 13, MINOR 11, INFO 3)"}
  - {id: 9, actor: agent, do: "раунд 3: D-1, D-2 review 2 — blocking UNK-KR-006, UNK-KR-007 (+ UNK-KR-008, F-27), вопрос в PR #2", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5867300653, #issuecomment-5867318422"}
  - {id: 10, actor: human, do: "решение UNK-KR-006, UNK-KR-007, UNK-KR-008 комментарием в PR #2", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5867393215"}
  - {id: 11, actor: agent, do: "Run specify: F-1…F-27 review 2 (EVID-01M3KNFKZ2PE3AEHC569ZTF3B7), P-1 (tasks.md 3.2), решения UNK-KR-006…008", done: "RUN-01M3KNZAC5S8G0CNPJG4TV6AS4, RUN-01M3KP9D1RXYQY32HZAHP9PFC1; карта — design.md «Решения по review 2»"}
  - {id: 12, actor: agent, do: "review 3; MAJOR review 3 — I-N в impl-PR (R-L0-07), без раунда 4", done: null}
  - {id: 13, actor: agent, do: "warrant verify, PR ready; далее transition SPECIFIED после одобрения", done: null}
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
- 2026-09-28 — review 2 `PROVEN` с 13 MAJOR, часть — противоречия формата v1 (F-2, F-8): по решению maintainer'а в
  чате — раунд 3 вместо `I-N` (отступление от R-L0-07, advisory): правка spec после approval потребовала бы waiver
  `spec-approved`; MAJOR review 3 — уже `I-N`.
- 2026-09-28 — промах агента: Edit с пустой заменой при переносе задачи 3.1a съел перевод строки — 3.2 слиплась с 3.1
  (review 2 P-1); `openspec validate` не ловит. Удаление строки — со смежным переводом строки в `old_string`.
- 2026-09-28 — шаг 11 начат до решений: независимые от UNK находки review 2 — RUN-01M3KNZAC5S8G0CNPJG4TV6AS4
  (0873c05); после решений — F-1, F-12 (список `forbidden-global`), F-27.
