---
schema: lattice-dev/node@1
kind: change
change: kernel-format
branch: impl/kernel-format
pr: 9
done_when: Change ARCHIVED; W-003 проверен в impl-PR (junit node:test → PROVEN)
focus: 21
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
  - {id: 12, actor: agent, do: "review 3; MAJOR review 3 — I-N в impl-PR (R-L0-07), без раунда 4", done: "EVID-01M3KPSTHCHC1K4G92MZS2PBK0 (PROVEN: MAJOR 3, MINOR 5, INFO 3)"}
  - {id: 13, actor: agent, do: "warrant verify, PR #2 ready, итог и план I-N по review 3 в PR", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5867571771"}
  - {id: 14, actor: human, do: "одобрение spec-PR #2 и решение D-1 review 3 (формы Date: закрытый перечень или запреты) — для I-N impl-PR", done: "https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5867606665"}
  - {id: 15, actor: agent, do: "verify заново и transition SPECIFIED последним коммитом (без коммитов между ними)", done: "коммит «kernel-format: transition SPECIFIED» в PR #2"}
  - {id: 16, actor: human, do: "merge spec-PR #2", done: "3776ea7 (merge PR #2, после зелёного job)"}
  - {id: 17, actor: agent, do: "impl-PR: verify, APPROVED --ref PR #2 --by Homasters-max, IMPLEMENTING — первый коммит", done: "244a91e"}
  - {id: 18, actor: agent, do: "Run implement: I-N по review 3 (EVID-01M3KPSTHCHC1K4G92MZS2PBK0, D-1 — вариант A) и правка delta spec; waiver spec-approved (PROPOSED); код и тесты по tasks.md", done: "RUN-01M3KQ7AGCEBR2PRG98QRPHCA2; WAV-2026-001 (PROPOSED); коммит «kernel-format: implement — ядро формата v1…»"}
  - {id: 19, actor: human, do: "git apply патча корневых файлов (I-12: package.json, package-lock.json, tsconfig.json) — команду присылает агент", done: "8a007ef"}
  - {id: 20, actor: agent, do: "коммит патча; npm ci; Run implement: tests-passed со SCN-AR, typecheck, отметки tasks.md; push, impl-PR (draft)", done: "RUN-01M3KRGCX2CYWVMDZTWJREC2AW: tests-passed PROVEN 391 (EVID-01M3KRGH2BD307TCKY5YAYKZ56), typecheck чистый; impl-PR — draft"}
  - {id: 21, actor: human, do: "активация WAV-2026-001 после чтения diff delta spec в impl-PR и коммит в ветку — команду присылает агент", done: null}
  - {id: 22, actor: agent, do: "verify, VERIFYING последним коммитом; локальный warrant ci; PR ready", done: null}
  - {id: 23, actor: human, do: "merge impl-PR после зелёного job", done: null}
  - {id: 24, actor: agent, do: "archive-PR: ci fetch, MERGED, archive; W-003 verified", done: null}
  - {id: 25, actor: human, do: "merge archive-PR", done: null}
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
- 2026-09-28 — одобрение spec — комментарием, не `gh pr review --approve`: автор PR — аккаунт maintainer'а, свой PR
  GitHub одобрить не даёт. D-1 review 3 — вариант A (закрытый перечень форм `Date`) — вход для `I-N` impl-PR вместе с
  F-2, F-3 review 3 (EVID-01M3KPSTHCHC1K4G92MZS2PBK0).
- 2026-09-28 — корневые `package.json`, `package-lock.json`, `tsconfig.json` — вне `write_scope` Run implement (guard
  `deny`), `npm install` в корне — обход `deny`: патч maintainer'а (design I-12). `typescript` 5.9.3, не 7.x: 7.0 —
  нативный компилятор без прежнего JS API (`ts.createSourceFile`, design D-5).
