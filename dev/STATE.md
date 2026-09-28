---
schema: lattice-dev/node@1
focus: infra
switch:
  id: lattice2lattice
  note: переключатель фокуса, не состояние и не workflow; проверяется на старте сессии и при archive Change
  stages:
    - id: T1-freeze
      when: все Change дорожки S2 ARCHIVED (warrant status)
      then: focus → infra/lattice2lattice-t1 — схемы dev/ становятся проектными типами LATTICE, формат dev/ заморожен
    - id: T2-switch
      when: >-
        все Change дорожки S4 ARCHIVED; lattice load dev/ (source-files, второй корпус E7) и WARRANT
        (source-warrant) — lint без hard; lattice explain по цепочке focus отвечает «почему мы здесь»
      then: focus → infra/lattice2lattice-t2 — STATE берётся из lattice explain, dev/ остаётся только источником
      source: https://github.com/Homasters-max/LATTICE/pull/3#issuecomment-5865372587 (E7 на dev/ — приёмка S4 и T2)
    - id: T3
      when: не включён
      then: точка расширения — LATTICE предлагает retire/promote/revise правил, решает maintainer
env:
  warrant_cli: 0.8.1
  warrant_ci: v0.8.1
  node: 22.17.0
rules:
  - id: R-L0-01
    text: >-
      Акты maintainer'а (решение UNK комментарием, merge, активация waiver) агент не выполняет — присылает
      «❗ Выполнить — <что>:» и одну команду в блоке bash, без &&; результат проверяет сам (gh pr view)
    force: normative
    status: retired
    source: W-010; https://github.com/Homasters-max/LATTICE/pull/3#issuecomment-5865372587
    owner: human:Homasters-max
    until: pin-v0-8-1 ARCHIVED (правило переносится в .warrant/local/rules/)
    review_by: 2026-10-12
  - id: R-L0-02
    text: Старт основной сессии — протокол dev/README.md «Протокол основной сессии»
    force: normative
    status: retired
    source: https://github.com/Homasters-max/LATTICE/pull/3#issuecomment-5865372587
    owner: human:Homasters-max
    until: pin-v0-8-1 ARCHIVED (правило переносится в .warrant/local/rules/)
    review_by: 2026-10-12
  - id: R-L0-03
    text: Edit/Write превращают \uXXXX в символы — литеральный escape писать perl с \x5c
    force: advisory
    status: active
    source: E-001
    owner: human:Homasters-max
    until: E-001 closed
    review_by: 2026-10-12
  - id: R-L0-04
    text: Команду длиннее ~7 тыс. символов (сообщение коммита, тело PR, JSON) — файлом (-F/--body-file/--file), не heredoc
    force: advisory
    status: active
    source: E-002
    owner: human:Homasters-max
    until: E-002 closed
    review_by: 2026-10-12
  - id: R-L0-05
    text: В Run review — только warrant run submit (сначала --dry-run, envelope файлом вне репозитория); status и git смотреть до run start
    force: advisory
    status: active
    source: W-007
    owner: human:Homasters-max
    when: {operation: review}
    until: W-007 closed
    review_by: 2026-10-12
  - id: R-L0-06
    text: warrant id не резервирует — несколько ID за раз нумеровать подряд, проверит ids-valid
    force: advisory
    status: active
    source: W-008
    owner: human:Homasters-max
    when: {operation: specify}
    until: W-008 closed
    review_by: 2026-10-12
  - id: R-L0-07
    text: Раунды review — BLOCKER → правка spec и review заново; PROVEN с MAJOR → I-N в impl-PR, не новый раунд
    force: advisory
    status: active
    source: W-012
    owner: human:Homasters-max
    until: W-012 closed
    review_by: 2026-10-12
  - id: R-L0-08
    text: Каждый тест node:test — внутри describe() (CI на v0.8.0 не видит тестов вне describe)
    force: advisory
    status: active
    source: W-003
    owner: human:Homasters-max
    when: {operation: implement}
    until: W-003 verified
    review_by: 2026-10-12
  - id: R-L0-09
    text: Правка с кириллицей в шаблоне — Edit; perl — только ASCII-шаблоны или perl -Mutf8 -CSD
    force: advisory
    status: active
    source: A-001
    owner: human:Homasters-max
    until: A-001 closed
    review_by: 2026-10-12
---

# Состояние разработки LATTICE

Порядок: `infra/dev-state` (закрыт) → `infra/pin-v0-8-1` → `foundation/kernel-format`. Правила полей и протокол —
[README](README.md).

## Журнал

- 2026-09-28 — автопамять заменена dev/ (grilling Q1–Q29); фокус — infra/dev-state.
- 2026-09-28 — R-L0-08 `until` → W-003 verified: junit 0.8.1 проверяется в impl-PR kernel-format, не archive
  pin-v0-8-1 (review pin-v0-8-1 F-1, EVID-01M3KG6KKJPEA3FPFA8D600J8Q).
