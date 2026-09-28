---
id: process
type: dev/guide@1
title: Повторяющиеся процедуры
paths: ["**"]
rules:
  - {id: RUL-039, text: "Закрепление новой версии WARRANT — по процедуре «Pin WARRANT» ниже, не разведкой в чужих репозиториях", force: advisory, status: active, source: RPT-001, owner: "human:Homasters-max"}
  - {id: RUL-040, text: "Повторяющаяся работа, найденная в отчёте дважды, получает процедуру здесь; до повтора — строка журнала", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
---

# process — Повторяющиеся процедуры

Процедуры для работы, которая повторяется: сначала шаги, потом — если повторится снова — навык или команда.

## Область

Работа по дорожке `infra` и всё, что повторяется между Change. Порядок PR Change — `AGENTS.md`.

## Процедура «Pin WARRANT»

Образец — pin-v0-8-1 (`RPT-001` F5: без процедуры ~17 вызовов разведки).

1. `warrant init change pin-v<версия>`: profile `factory-change`, `skip_specs: true`; classify `--propose` (chore +
   factory-change; risk — по политике). Образец артефактов — `openspec/changes/archive/*pin-v0-8-1*`.
2. Run specify: proposal, design (D-1 тег, D-2 патч policy-путей делает maintainer, D-3 тест пина), tasks.
3. Review, `warrant verify && warrant transition … SPECIFIED` (RUL-012), spec-PR.
4. impl-PR: `APPROVED` + `IMPLEMENTING` (`verify &&` перед каждым); Run implement — тест пина; патч
   `.github/workflows/warrant.yml` и `.warrant/local/**` собрать в копии дерева, maintainer применяет `git apply`.
5. `warrant sync` новой версией → `FRONTEND_RESTART_REQUIRED`: коммит и новая сессия (шаг человека).
6. Новая сессия: `warrant check tests-passed`, `verify && VERIFYING`, PR; archive-PR по `AGENTS.md`.

## Проверка

По отчётам: сессия pin без разведки в SRA и warrant-slice.
