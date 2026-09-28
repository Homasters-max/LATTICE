---
id: state
type: dev/state@1
title: Состояние разработки LATTICE
focus: infra
switch:
  id: lattice2lattice
  note: переключатель фокуса, не состояние и не workflow; проверяется на старте сессии и при archive Change
  stages:
    - id: T1-freeze
      when: [{check: "все work дорожки s2 — lattice/<Change> ARCHIVED", via: warrant}]
      then: focus → infra, work lattice2lattice-t1 — типы dev/ становятся проектными типами LATTICE, формат заморожен
    - id: T2-switch
      when:
        - {check: "все work дорожки s4 — lattice/<Change> ARCHIVED", via: warrant}
        - {check: "lattice load: dev/ (source-files, второй корпус E7) и WARRANT (source-warrant) — lint без hard", via: cmd}
        - {check: "lattice explain по цепочке focus отвечает «почему мы здесь»", via: cmd}
      then: focus → infra, work lattice2lattice-t2 — STATE из lattice explain, dev/ остаётся источником
      source: gh/3#issuecomment-5865372587
    - id: T3
      when: не включён
      then: точка расширения — LATTICE предлагает retire/promote/revise правил, решает maintainer
env:
  warrant_cli: 0.8.1
  warrant_ci: v0.8.1
  node: 22.17.0
  sessions_since: "2026-09-27T21:45"
rules:
  - id: RUL-001
    aliases: [R-L0-01]
    text: >-
      Акты maintainer'а (решение UNK комментарием, merge, активация waiver) агент не выполняет — присылает
      «❗ Выполнить — <что>:» и одну команду в блоке bash, без &&; результат проверяет сам (gh pr view)
    force: normative
    status: retired
    source: [ISS-010, gh/3#issuecomment-5865372587]
    owner: human:Homasters-max
    until: pin-v0-8-1 ARCHIVED (правило в .warrant/local/rules/)
    review_by: 2026-10-12
  - id: RUL-002
    aliases: [R-L0-02]
    text: Старт основной сессии — протокол dev/README.md «Протокол основной сессии», отчёт первым сообщением
    force: normative
    status: retired
    source: gh/3#issuecomment-5865372587
    owner: human:Homasters-max
    until: pin-v0-8-1 ARCHIVED (правило в .warrant/local/rules/)
    review_by: 2026-10-12
  - id: RUL-005
    aliases: [R-L0-05]
    text: В Run review — только warrant run submit; status и git смотреть до run start (сдача --file — в инструкции warrant-reviewer 0.8.1)
    force: advisory
    status: active
    source: ISS-007
    owner: human:Homasters-max
    when: {operation: review}
    until: ISS-007 verified
    review_by: 2026-10-12
  - id: RUL-006
    aliases: [R-L0-06]
    text: warrant id не резервирует — несколько ID за раз нумеровать подряд, проверит ids-valid
    force: advisory
    status: active
    source: ISS-008
    owner: human:Homasters-max
    when: {operation: specify}
    until: ISS-008 verified
    review_by: 2026-10-12
  - id: RUL-007
    aliases: [R-L0-07]
    text: Раунды review — BLOCKER → правка spec и review заново; PROVEN с MAJOR → I-N в impl-PR, не новый раунд
    force: advisory
    status: active
    source: ISS-012
    owner: human:Homasters-max
    until: ISS-012 verified
    review_by: 2026-10-12
  - id: RUL-008
    aliases: [R-L0-08]
    text: Каждый тест node:test — внутри describe() (CI на v0.8.0 не видит тестов вне describe)
    force: advisory
    status: retired
    source: ISS-003
    owner: human:Homasters-max
    when: {operation: implement}
    until: ISS-003 verified
    review_by: 2026-10-12
---

# state — Состояние разработки LATTICE

Корень цепочки `focus`: дорожка в работе, переключатель lattice2lattice, ловушки проекта; порядок — `infra`
(dev-model, session-audit) → срез `s0` (скелет, design/05-slices.md).

## Журнал

- 2026-09-28 — автопамять заменена dev/ (grilling Q1–Q29); фокус — infra/dev-state.
- 2026-09-28 — R-L0-08 `until` → W-003 verified: junit 0.8.1 проверяется в impl-PR kernel-format, не archive
  pin-v0-8-1 (review pin-v0-8-1 F-1, EVID-01M3KG6KKJPEA3FPFA8D600J8Q).
- 2026-09-28 — модель объектов LATTICE (IDEA-002): id по типу, старые — в `aliases` (W-/E-/A- → ISS, R-… → RUL);
  раскладка `tracks/`, `work/`, `ideas/`, `rules/`, `reports/`; `done_when` — проверки (`gh/…`, dev-model).
- 2026-09-28 — pin-v0-8-1 ARCHIVED (286829b, PR #7); switch при archive — T1, T2 не наступили; фокус → foundation.
- 2026-09-28 — kernel-format ARCHIVED (archive-PR #10); switch при archive — T1, T2 не наступили; R-L0-08 retired —
  «тест внутри describe» теперь норма REQ-AR-002, её держит тест структуры.
- 2026-09-28 — RUL-001, RUL-002 retired: правила в WARRANT `maintainer-acts`, `session-start` (git/1be0734); RUL-008
  retired (git/2f15f83). Фокус → infra (dev-model): foundation закрыт, следующий срез s0 — после dev-model и
  session-audit.
- 2026-09-28 — RUL-012, RUL-013 перенесены в стандарт `process` (8 активных правил > 7 на уровне): это правила
  процедуры Change, не ловушки проекта.
- 2026-09-28 — RUL-003, RUL-004, RUL-009 (ловушки среды и техники) перенесены в стандарт `env` — их получают и субагенты
  (RPT-004: аналитики упирались в ISS-015, ISS-028); в STATE остались ловушки WARRANT.
