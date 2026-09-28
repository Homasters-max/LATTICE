# Proposal

## Why

Судья CI LATTICE — CLI WARRANT по тегу `v0.8.0` в `.github/workflows/warrant.yml`, lock записан kernel `0.8.0`; CLI на
машине разработки — `0.8.1`. На `main` `warrant validate` даёт `GENERATED_DRIFT` (`.claude/agents/warrant-reviewer.md`),
`warrant sync --check` — ещё и `LOCK_MISMATCH`. В `v0.8.1` (Change `lattice-fixes` фабрики, WARRANT-ADR-0042) закрыты
четыре отказа LATTICE: junit считается по `<testcase>` (W-003), префикс guard с флагами режима интерпретатора (W-002),
субагент `warrant-reviewer` сдаёт envelope файлом во временном каталоге (W-006), `sync` подсказывает перезапуск сессии
(W-005). ADR-0042 п. 1 называет приёмкой исправлений Change LATTICE, который поднимает тег CLI. Review 2 spec
`kernel-format` ждёт сдачи файлом (W-006).

Два правила основной сессии LATTICE — акты maintainer'а и старт по `dev/` — живут ловушками `dev/STATE.md` (R-L0-01,
R-L0-02, решение maintainer'а в PR #3) с условием снятия «pin-v0-8-1 ARCHIVED»: постоянное общее правило — правило
WARRANT в `.warrant/local/rules/`, этот Change трогает policy-пути и переносит их.

## What Changes

- Судья CI — тег `v0.8.1` в шаге установки CLI `.github/workflows/warrant.yml`; права job не меняются (`issues: read` уже
  есть).
- `warrant sync` CLI 0.8.1: lock (`kernel: "0.8.1"`), `.claude/agents/warrant-reviewer.md` (инструмент `Write`, сдача
  envelope файлом), `AGENTS.md`. `.warrant/warrant.json` не меняется: `kernel: "0.8"` покрывает `0.8.1`, pack `core-sdd`
  — тот же `0.3.4`.
- Правила WARRANT проекта (`warrant://rule/1`, `paths: ["**"]`, попадают в `AGENTS.md`):
  - `maintainer-acts` — акты maintainer'а (решение UNKNOWN комментарием, merge, активация waiver) агент не выполняет:
    присылает «❗ Выполнить — <что>:» и одну команду в блоке bash, без `&&`; результат проверяет сам (`gh pr view`);
  - `session-start` — основная сессия (не субагент) стартует с `dev/STATE.md` по протоколу `dev/README.md` «Протокол
    основной сессии»; состояние, ловушки и проблемы — только в `dev/`, автопамять выключена.
- `CLAUDE.md` — только `@AGENTS.md`: строка о старте сессии переходит в правило `session-start`.
- Тест `test/process/pin.test.ts` (`node:test`): инвариант пина — тег судьи CI равен `v` + `kernel` lock; правила
  `maintainer-acts` и `session-start` есть и их текст — в `AGENTS.md`. Первый тест проекта: без него отчёт junit пуст и
  `tests-passed` — `INCONCLUSIVE`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет: продукт LATTICE не меняется, меняются судья CI и процесс проекта (`skip_specs: true`).

## Impact

- Policy-пути: `.github/workflows/warrant.yml`, `.warrant/warrant.lock.json`, `.warrant/local/rules/maintainer-acts.json`,
  `.warrant/local/rules/session-start.json`; сгенерированные `AGENTS.md`, `.claude/agents/warrant-reviewer.md`.
- `CLAUDE.md`; `test/process/pin.test.ts`. Кода `src/` нет и не появляется.
- **BREAKING** для локальной работы: CLI 0.8.0 на lock kernel 0.8.1 — `warrant sync --check` и `validate` красные
  (сгенерированный `warrant-reviewer.md` другой); CLI на машине уже 0.8.1.
- После `warrant sync` — перезапуск сессии Claude Code (`FRONTEND_RESTART_REQUIRED`): агент и hooks читаются при старте.

## Non-goals

- Текст правила `process` не меняется: оговорка «тест вне `describe()` отчёт junit не считает» пересматривается после
  проверки W-003 в impl-PR `kernel-format`.
- Guard агента проекта: операции записи для `.warrant/local/**` и `.github/workflows/**` нет (ADR-0040) — их правит
  maintainer.
- Остальные ловушки `dev/STATE.md` (advisory) — не переносятся: у каждой своё условие снятия.
- Change `kernel-format` — отдельно, после этого.
