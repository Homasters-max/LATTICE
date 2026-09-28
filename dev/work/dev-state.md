---
id: dev-state
type: dev/work@1
version: 2
title: Состояние разработки в репозитории
track: infra
from: IDEA-001
change: null
branch: null
pr: 4
waits: []
rules: []
---

# dev-state — Состояние разработки в репозитории

Автопамять Claude Code заменена каталогом dev/: состояние, ловушки, проблемы и правила — в git; закрыт.

## Контекст

Работа без Change: PR только с dev/, `CLAUDE.md`, `.gitignore` (CI — вид `none`). Автопамять выключена `.claude/settings.local.json` (`autoMemoryEnabled: false`, файл локальный).

## Шаги

- [x] 1 · agent · PR chore/dev-state: dev/, CLAUDE.md, .gitignore, предложение для WARRANT — gh/3
- [x] 2 · human · комментарий-решение в PR: grilling Q1–Q29, R-L0-01, R-L0-02, E7 в приёмке S4 — gh/3#issuecomment-5865372587
- [x] 3 · agent · source R-L0-01, R-L0-02 → URL комментария, status active — git/8b38160
- [x] 4 · human · merge PR chore/dev-state — git/7a1570d
- [x] 5 · agent · показать перенос памяти → после подтверждения удалить файлы автопамяти — gh/4
- [x] 6 · agent · новая сессия: память не загружается, старт по dev/STATE.md — git/b8afc4f

## Приёмка

- [x] gh/3 и gh/4 слиты · human — git/85e2b53
- [x] каталог автопамяти LATTICE пуст, autoMemoryEnabled: false · cmd — gh/4
- [x] новая сессия стартовала по dev/STATE.md без MEMORY.md · human — RPT-001

## Решения

| id | решение | ref |
|---|---|---|
| Q1–Q29 | модель dev/, граница, правила, протокол | `gh/3#issuecomment-5865372587` |

## Журнал

- 2026-09-28 — перенос: состояние и порядок — узлы dev/; ловушки и W-1…W-12 (из передачи во временном каталоге прошлой сессии) — `issues/`; рамки проекта и Jev уже в `design/` (00-vision); записи kb-research, внедрения, аудита, прогонов — закрытая работа в `arhived/`, не переносятся.
- 2026-09-28 — E-001 сработала при записи самого E-001 (пример escape стал символом); исправлено perl по R-L0-03.
- 2026-09-28 — перенос подтверждён maintainer'ом в чате после merge PR #3; удалены 13 файлов автопамяти (12 записей и MEMORY.md). `.gitignore` по разделам; из истории выведены личное и машинное: `.obsidian/` (настройки редактора), `.kb-search/` (индекс, генерирует kb-search), `.claude/launch.json` (абсолютные пути машины); файлы на диске остались.
- 2026-09-28 — новая сессия: `memory/` проекта пуст, автопамять не загружена, старт по STATE.md — `done_when` выполнен; фокус дорожки — pin-v0-8-1.
- 2026-09-28 — перенос в модель объектов LATTICE (dev-model): шаги и приёмка — списком с отметками, ссылки — `git/`, `gh/`.
