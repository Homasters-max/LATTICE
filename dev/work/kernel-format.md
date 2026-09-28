---
id: kernel-format
type: dev/work@1
version: 1
title: Формат v1 ядра
track: foundation
from: null
change: lattice/kernel-format
branch: null
pr: 10
waits: []
rules:
  - id: RUL-011
    aliases: [R-KF-01]
    text: F-5 сам не решать — только blocking UNK к maintainer'у
    force: advisory
    status: retired
    source: lattice/EVID-01M3JHV12SMRHDT34WPQXC7QE3
    owner: human:Homasters-max
    when: {operation: specify}
---

# kernel-format — Формат v1 ядра

Норма формата ядра — JCS, хэш, id и ссылки, ревизия, тест структуры; ARCHIVED (`gh/2`, `gh/9`, `gh/10`), нормы —
`openspec/specs/kernel`, `openspec/specs/architecture`.

## Контекст

Задачи и отметки — `openspec/changes/archive/*-kernel-format/tasks.md`; этап — `warrant status kernel-format`. Три
раунда review (EVID-01M3JHV12…, EVID-01M3KNFKZ2…, EVID-01M3KPSTHC…), UNK-KR-001…008, waiver `spec-approved`
WAV-2026-001 в impl-PR. Проверены ISS-003 (частично), ISS-006.

## Решения

| id | решение | ref |
|---|---|---|
| раунд 3 | MAJOR review 2 с противоречиями формата v1 — новый раунд review, не `I-N` (отступление от RUL-007) | решение maintainer'а в чате, журнал 2026-09-28 |
| D-1 review 3 | формы `Date` — закрытый перечень (вариант A), вход для `I-N` impl-PR | `gh/2#issuecomment-5867606665` |

Остальные — `lattice/UNK-KR-001`…`008`, `lattice/kernel-format#I-…` (design.md Change).

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
- 2026-09-28 — локальный `warrant ci` после `VERIFYING`: `RECORD_MISMATCH` классификации и `scope-valid` `FAIL` —
  waiver в `.warrant/waivers/` и `package.json` в diff (W-014); `classify --base origin/main` → `chore`,
  `factory-change`, `feature`, затем `verify` последним коммитом; проба на копии — исход D-1 (только
  `ATTESTATION_REQUIRED` L1, `human-approval` в `deferred[]`).
- 2026-09-28 — CI PR #9: `tests-passed` 391, `skipped` 1 — сверка таблицы Unicode 16.0 (design D-7) пропущена: в CI
  Node с Unicode новее 16.0; таблица сверена только локально (Node 22.17), тест среды SCN-KR-025 в CI прошёл.
- 2026-09-28 — перенос в модель объектов LATTICE (dev-model): 25 шагов убраны — повторяли lifecycle WARRANT, акты
  maintainer'а и `tasks.md` (сигнал остановки, README); ссылки шагов — в git-истории `dev/tracks/foundation/kernel-format.md`
  (git/98ae347). RUL-011 retired — Change закрыт.
