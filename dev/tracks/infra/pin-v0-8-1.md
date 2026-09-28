---
schema: lattice-dev/node@1
kind: change
change: pin-v0-8-1
branch: null
pr: null
done_when: Change ARCHIVED; job warrant на теге v0.8.1; `warrant sync --check` без GENERATED_DRIFT и LOCK_MISMATCH
focus: 1
waits: [dev-state]
steps:
  - {id: 1, actor: agent, do: "spec-PR: init change (profile factory-change, skip_specs), образец warrant-slice openspec/changes/archive/2026-09-27-pin-v0-8-0", done: null}
  - {id: 2, actor: human, do: "тег v0.8.1 в .github/workflows/warrant.yml (путь политики — команду присылает агент)", done: null}
  - {id: 3, actor: agent, do: "warrant sync CLI 0.8.1 (lock, warrant-reviewer.md); правила R-L0-01, R-L0-02 → .warrant/local/rules/", done: null}
  - {id: 4, actor: agent, do: "после sync — FRONTEND_RESTART_REQUIRED: коммит и новая сессия", done: null}
  - {id: 5, actor: agent, do: "impl-PR и archive-PR по AGENTS.md", done: null}
rules: []
---

# pin-v0-8-1 — закрепить WARRANT v0.8.1

CLI на машине — 0.8.1, CI и lock — 0.8.0. В 0.8.1 закрыты W-002, W-003, W-005, W-006 (WARRANT-ADR-0042). Три PR.
Правка политики — factory-change; путь `.github/workflows/**` агенту guard не даёт.

## Журнал

- 2026-09-28 — порядок: после dev-state, до kernel-format.
