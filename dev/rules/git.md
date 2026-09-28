---
id: git
type: dev/guide@1
title: Git и PR
paths: ["**"]
rules:
  - {id: RUL-031, text: "Работа без Change — ветка chore/<work-id> от main, PR вида none (только dev/, CLAUDE.md, .gitignore, scripts/dev/)", force: advisory, status: active, source: gh/3, owner: "human:Homasters-max"}
  - {id: RUL-032, text: "Коммит: первая строка «<work или Change>: <что>»; в теле — зачем и id цепочки (IDEA-, ISS-, RUL-, RPT-)", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-033, text: "Параллельная работа — отдельный git worktree; не переключать ветку в worktree, где работает другая сессия", force: advisory, status: active, source: dev-model, owner: "human:Homasters-max"}
  - {id: RUL-034, text: "Слитые ветки удаляются локально и на origin сразу после проверки merge", force: advisory, status: active, source: gh/4, owner: "human:Homasters-max"}
---

# git — Git и PR

Ветки, коммиты и worktree так, чтобы цепочка от идеи до коммита читалась по `git log`.

## Область

Весь репозиторий. Ветки Change (`spec/`, `impl/`, `archive/`), merge-коммит и акты maintainer'а — в `AGENTS.md` и
RUL-001, здесь не повторяются.

## Проверка

Review; RUL-031 — CI (вид PR `none` проходит только без путей Change и политики).
