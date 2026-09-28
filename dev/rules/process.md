---
id: process
type: dev/guide@1
title: Повторяющиеся процедуры
paths: ["**"]
rules:
  - {id: RUL-039, text: "Закрепление новой версии WARRANT — по процедуре «Pin WARRANT» ниже, не разведкой в чужих репозиториях", force: advisory, status: active, source: RPT-001, owner: "human:Homasters-max"}
  - {id: RUL-040, text: "Повторяющаяся работа, найденная в отчёте дважды, получает процедуру здесь; до повтора — строка журнала", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-052, text: "Change ведётся по AGENTS.md с тонкостями процедуры «Change» ниже — они из разборов RPT-001…003", force: advisory, status: retired, source: [RPT-001, RPT-002, RPT-003], owner: "human:Homasters-max"}
  - {id: RUL-053, text: "Разработка — циклом: работа → разбор сессий → исправление LATTICE сразу, WARRANT — передачей → следующий шаг (README «Цикл разработки»)", force: advisory, status: retired, source: IDEA-002, owner: "human:Homasters-max"}
  - id: RUL-012
    text: >-
      warrant verify и transition — одной командой на одном HEAD (`warrant verify <c> && warrant transition <c> …`);
      любой коммит между ними делает spec-report STALE
    force: advisory
    status: active
    source: ISS-018
    owner: human:Homasters-max
    until: ISS-018 verified
    review_by: 2026-10-12
  - id: RUL-013
    text: "Субагенту (warrant-reviewer и др.) применимые правила — текстом в промпте Agent: python scripts/dev/dev-check.py --brief <операция>; dev/ он не читает"
    force: advisory
    status: active
    source: ISS-023
    owner: human:Homasters-max
    until: ISS-023 verified
    review_by: 2026-10-12
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

## Процедура «Change»

Дополняет `AGENTS.md` тем, что стоило сбоев (ссылки — проблема или отчёт):

- `warrant verify <c> && warrant transition <c> …` — одной командой на одном HEAD: любой коммит между ними делает
  spec-report STALE (ISS-018, RUL-012); dev/ коммитится до `verify` или после `transition`.
- Задачи Change — в `tasks.md`, включая акты человека (патч policy-путей, перезапуск сессии). Проверки (`verify`,
  локальный `warrant ci`) задачами не заводить — их держат gates, результат — в теле PR (ISS-026).
- Корневые `package.json`, `package-lock.json`, `tsconfig.json` вне `write_scope` — патч maintainer'а, как policy-пути
  (kernel-format I-12).
- Waiver `spec-approved` в impl-PR — после активации `warrant classify <c> --base origin/main`, затем `verify` последним
  коммитом (ISS-025).
- Merge impl-PR — только после зелёного job `warrant` (pin-v0-8-1, журнал); одобрение spec-PR — комментарием: свой PR
  GitHub одобрить не даёт (kernel-format, журнал).
- Субагенту `warrant-reviewer` — вывод `python scripts/dev/dev-check.py --brief review` в промпте (RUL-013); сдача —
  `--file` (ISS-006).
- Долгий субагент — в фоне; при 3 неудачах подряд — статус человеку (RUL-051).

## Проверка

По отчётам: сессия pin без разведки в SRA и warrant-slice; сбои из списка «Change» не повторяются.
