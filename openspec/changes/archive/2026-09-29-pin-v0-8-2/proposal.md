# Proposal

## Why

Судья CI LATTICE — копия job `warrant` в `.github/workflows/warrant.yml` с установкой CLI `v0.8.1`; lock записан kernel
`0.8.1`. CLI на машине разработки — `0.8.2` (глобальная ссылка на checkout SRA ровно на коммите тега `v0.8.2`), поэтому
на `main` `warrant validate` даёт `GENERATED_DRIFT` (`.warrant/schemas/gate.1.schema.json`), `warrant sync --check` — ещё
и `LOCK_MISMATCH`.

`v0.8.2` (Change `lattice-issues` фабрики, WARRANT-ADR-0044; Change `no-claude-md`) закрывает то, что LATTICE обходил или
ждал: job `warrant` поставляется как reusable workflow — проект вызывает его по тегу и копии не держит (06 §8); junit
читает id `SCN-…` в имени `<testcase>`, пропущенный тест сценария — `NOT_PROVEN` (06 §2); gate требует evidence
конкретного check (06 §3); `warrant sync` не создаёт `CLAUDE.md` (Claude Code читает `AGENTS.md` сам); под Run `review`
guard пропускает `warrant status` / `gate` / `--help`, `git status|log|diff|show`, `cd` внутри проекта и
`warrant run finish --state CANCELLED`; повтор `run submit` (`EVIDENCE_CONFLICT`), находка `UNCOMMITTED_IN_SCOPE`,
атомарная запись состояния. Копия job при следующем теге снова расходится с фабрикой — это и есть причина перейти на
вызов.

## What Changes

- `.github/workflows/warrant.yml` — job `warrant` вызывает
  `Homasters-max/SRA/.github/workflows/warrant.yml@v0.8.2` с `warrant: v0.8.2`, `setup: npm ci`,
  `merge_commit: ${{ inputs.merge_commit || '' }}`; права `contents`, `actions`, `pull-requests`, `issues` — `read`;
  `on.pull_request` и `on.workflow_dispatch` с входом `merge_commit` остаются. Копии шагов (checkout, merge, установка
  CLI, `warrant ci`, upload evidence) нет. Имя проверки в GitHub — `warrant / warrant`.
- `warrant sync` CLI 0.8.2: lock (`kernel: "0.8.2"`), копия схемы `gate/1` (`.warrant/schemas/gate.1.schema.json`),
  `AGENTS.md` и `.claude/agents/warrant-reviewer.md`, если генератор их изменит. `.warrant/warrant.json` не меняется:
  `kernel: "0.8"` покрывает `0.8.2`, pack `core-sdd` — тот же `0.3.4`.
- Правило `process` (`.warrant/local/rules/process.json`): снята оговорка «тест вне `describe()` отчёт junit не считает»
  (обход W-003, закрыт в 0.8.1: parser читает каждый `<testcase>`); добавлено, что пропуск (`skip` / `todo`) теста с
  токеном `SCN-…` даёт `NOT_PROVEN`. Требование «каждый тест — внутри `describe()`» остаётся: его держит `SCN-AR-003`.
- `CLAUDE.md` удалён: он содержал одну строку `@AGENTS.md`, `warrant sync` 0.8.2 его не создаёт (issue #22).
- Тест `test/process/pin.test.ts`: инвариант пина — под вызов reusable workflow: тег в `uses` и вход `warrant` равны
  `v` + `kernel` lock, шагов-копий в файле нет. Прежний инвариант («тег в шаге `npm pack github:…`») перестаёт находить
  тег.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет: продукт LATTICE не меняется, меняются судья CI и процесс проекта (`skip_specs: true`).

## Impact

- Policy-пути: `.github/workflows/warrant.yml`, `.warrant/local/rules/process.json`, `.warrant/warrant.lock.json`,
  `.warrant/schemas/gate.1.schema.json`; сгенерированные `AGENTS.md`, `.claude/agents/warrant-reviewer.md`. Удалён
  `CLAUDE.md`. Тест `test/process/pin.test.ts`. Кода `src/` нет.
- Имя обязательной проверки меняется с `warrant` на `warrant / warrant`. Защита `main` не включена (API: «Branch not
  protected»), обновлять нечего; имя записано здесь для того дня, когда защиту включат (issue #20).
- После `warrant sync` — перезапуск сессии Claude Code (`FRONTEND_RESTART_REQUIRED`), если генератор изменил
  `warrant-reviewer.md` или hooks.

## Non-goals

- `dev-check`: инструмент снесён вместе со слоем `dev/` (PR #19); проверка `check: "dev-check"` (06 §3) без инструмента
  нечего исполняет. Возвращать его или заменить проверкой типов — решение maintainer'а (issue #27).
- Job проекта для PR без Change (`npm test`, `npm run typecheck`, 06 §8): вне этого Change (issue #28).
- Бот-учётка агента и `identities.agents`: акт maintainer'а; до него `warrant ci` даёт информационную находку
  `SHARED_IDENTITY` (BL-83), код выхода она не меняет (issue #20).
- Тесты сценариев с `SCN-…` в имени: уже такие (`test/kernel`, `test/architecture`), правки нет.
