---
id: pin-v0-8-1
type: dev/work@1
title: Закрепить WARRANT v0.8.1
track: infra
from: null
change: lattice/pin-v0-8-1
branch: impl/pin-v0-8-1
pr: null
focus: 8
waits: []
done_when:
  - {check: "lattice/pin-v0-8-1 ARCHIVED", via: warrant}
  - {check: ".github/workflows/warrant.yml — тег v0.8.1; job warrant зелёный на archive-PR", via: cmd}
  - {check: "warrant sync --check → ok (без GENERATED_DRIFT, LOCK_MISMATCH)", via: cmd}
steps:
  - {n: 1, actor: agent, do: "spec-PR: init change (chore + factory-change, skip_specs), review 1, verify", done: gh/5}
  - {n: 2, actor: human, do: "одобрение spec-PR и ответ на F-1 (приёмка: пин и ISS-005; ISS-003, ISS-006 — kernel-format)", done: gh/5#issuecomment-5865888855}
  - {n: 3, actor: agent, do: "transition SPECIFIED последним коммитом spec-PR", done: git/bb5eaad}
  - {n: 4, actor: human, do: "merge spec-PR", done: git/07c90ef}
  - {n: 5, actor: agent, do: "impl-PR: APPROVED + IMPLEMENTING; I-N по F-1…F-9 (lattice/EVID-01M3KG6KKJPEA3FPFA8D600J8Q); патч policy-путей", done: git/b71a490}
  - {n: 6, actor: human, do: "git apply патча (тег v0.8.1, правила maintainer-acts, session-start, CLAUDE.md) — команду присылает агент", done: git/4ba948f}
  - {n: 7, actor: agent, do: "коммит патча; warrant sync CLI 0.8.1 (FRONTEND_RESTART_REQUIRED); коммит", done: git/ae75067}
  - {n: 8, actor: human, do: "перезапуск сессии Claude Code (design I-4): правила и warrant-reviewer читаются при старте", done: null}
  - {n: 9, actor: agent, do: "новая сессия: Run implement — warrant check tests-passed, отметки tasks.md; verify && VERIFYING, локальный warrant ci; push, PR", done: null}
  - {n: 10, actor: human, do: "merge impl-PR", done: null}
  - {n: 11, actor: agent, do: "archive-PR: ci fetch, MERGED --by, archive; RUL-001, RUL-002 → retired", done: null}
  - {n: 12, actor: human, do: "merge archive-PR", done: null}
rules: []
---

# pin-v0-8-1 — Закрепить WARRANT v0.8.1

Тег v0.8.1 в workflow, `warrant sync` 0.8.1, правила основной сессии — в `.warrant/local/rules/`.

## Контекст

CLI на машине — 0.8.1, CI и lock — 0.8.0. В 0.8.1 закрыты ISS-002, ISS-003, ISS-005, ISS-006 (`warrant/ADR-0042`).
Три PR. Правка политики — factory-change; `.github/workflows/**`, `.warrant/local/**` агенту guard не даёт — патч
применяет maintainer (design D-2). Процедура pin — [rules/process.md](../rules/process.md).

## Решения

| id | решение | ref |
|---|---|---|
| F-1 | приёмка — пин v0.8.1 и ISS-005; ISS-003, ISS-006 проверяются в kernel-format | `gh/5#issuecomment-5865888855` |

Остальные — `lattice/pin-v0-8-1#I-1`…`#I-9` (design.md Change).

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
- 2026-09-28 — исправление к строке «промах агента»: причина STALE — не коммит dev/, а привязка spec-report к commit
  (`warrant/REQ-VER-003`): любой коммит между `verify` и `transition` делает его STALE; порядок — `verify &&
  transition` на одном HEAD (ISS-018, RUL-012; разбор `RPT-001`).
- 2026-09-28 — перенос в модель объектов LATTICE (dev-model): id — ISS/RUL, ссылки `git/`, `gh/`, `lattice/`.
