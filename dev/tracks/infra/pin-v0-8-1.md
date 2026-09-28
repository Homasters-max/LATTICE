---
schema: lattice-dev/node@1
kind: change
change: pin-v0-8-1
branch: impl/pin-v0-8-1
pr: null
done_when: Change ARCHIVED; job warrant на теге v0.8.1; `warrant sync --check` без GENERATED_DRIFT и LOCK_MISMATCH
focus: 9
waits: []
steps:
  - {id: 1, actor: agent, do: "spec-PR: init change (chore + factory-change, skip_specs), review 1, verify", done: "https://github.com/Homasters-max/LATTICE/pull/5"}
  - {id: 2, actor: human, do: "одобрение spec-PR и ответ на вопрос F-1 (приёмка: пин и W-005; W-003, W-006 — kernel-format)", done: "https://github.com/Homasters-max/LATTICE/pull/5#issuecomment-5865888855"}
  - {id: 3, actor: agent, do: "transition SPECIFIED последним коммитом spec-PR", done: "коммит «pin-v0-8-1: transition SPECIFIED» в PR #5"}
  - {id: 4, actor: human, do: "merge spec-PR", done: "07c90ef (merge PR #5)"}
  - {id: 5, actor: agent, do: "impl-PR: APPROVED + IMPLEMENTING; I-N по F-1…F-9 (EVID-01M3KG6KKJPEA3FPFA8D600J8Q); патч policy-путей во временный каталог", done: "b71a490 (RUN-01M3KGXFX4K77F1D663EVFCFTP); патч pin-v0-8-1-policy.patch в scratchpad сессии"}
  - {id: 6, actor: human, do: "git apply патча (тег v0.8.1, правила maintainer-acts, session-start, CLAUDE.md) — команду присылает агент", done: "4ba948f"}
  - {id: 7, actor: agent, do: "коммит патча; warrant sync CLI 0.8.1 (FRONTEND_RESTART_REQUIRED); коммит", done: "ae75067"}
  - {id: 8, actor: human, do: "перезапуск сессии Claude Code (design I-4): правила и субагент warrant-reviewer читаются при старте", done: "сессия 2026-09-28: warrant-reviewer со сдачей --file, правила в Context Pack RUN-01M3KJMVZF9J0NMESHM4HG4WJ4"}
  - {id: 9, actor: agent, do: "новая сессия: старт по dev/STATE.md; Run implement — warrant check tests-passed, отметки tasks.md; verify, VERIFYING, локальный warrant ci (задача 3.2); push, PR", done: null}
  - {id: 10, actor: human, do: "merge impl-PR", done: null}
  - {id: 11, actor: agent, do: "archive-PR: ci fetch, MERGED --by, archive; dev/: R-L0-01, R-L0-02 retired", done: null}
  - {id: 12, actor: human, do: "merge archive-PR", done: null}
rules: []
---

# pin-v0-8-1 — закрепить WARRANT v0.8.1

CLI на машине — 0.8.1, CI и lock — 0.8.0. В 0.8.1 закрыты W-002, W-003, W-005, W-006 (WARRANT-ADR-0042). Три PR.
Правка политики — factory-change; путь `.github/workflows/**` и `.warrant/local/**` агенту guard не даёт — патч
применяет maintainer (design D-2).

## Журнал

- 2026-09-28 — порядок: после dev-state, до kernel-format.
- 2026-09-28 — без тестов junit-отчёт пуст → `tests-passed` `INCONCLUSIVE` (parser 0.8.1): в impl-PR первый тест
  проекта — инвариант пина (design D-3).
- 2026-09-28 — review 1 `PROVEN` с MAJOR F-1, F-2 → `I-N` в impl-PR, не новый раунд (R-L0-07).
- 2026-09-28 — F-1 решён maintainer'ом: приёмка — пин v0.8.1 и W-005; W-003, W-006 — kernel-format
  (https://github.com/Homasters-max/LATTICE/pull/5#issuecomment-5865888855).
- 2026-09-28 — промах агента: коммит dev/ между `verify` и `transition SPECIFIED` — spec-report `STALE`, `verify`
  повторён (bb5eaad); `APPROVED` после merge — тоже `verify` заново (merge-коммит сдвигает HEAD). Порядок: dev/ →
  `verify` → `transition`.
- 2026-09-28 — проба патча на копии дерева: `sync` — `FRONTEND_RESTART_REQUIRED` (W-005 принят, I-1), `validate`
  зелёный, `tests-passed` `PROVEN` 3/3.
- 2026-09-28 — перезапуск сессии выделен шагом человека (I-4); проверки задач 1.1, 1.2 пройдены (`git diff` — только
  строка тега; `validate`, `sync --check` зелёные).
