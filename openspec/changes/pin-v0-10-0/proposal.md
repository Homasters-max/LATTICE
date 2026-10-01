# Proposal

## Why

LATTICE закреплён на WARRANT `0.8.2`: `kernel: "0.8"`, pack `core-sdd` `^0.3.4`, судья CI — копия job `warrant` с
`npm pack github:Homasters-max/SRA#v0.8.2` (pin-v0-8-2, design I-5) по waiver WAV-2026-002 до 2026-10-13. Копия была
обходом: reusable workflow `v0.8.2` ставил CLI голой `npm i -g github:…` без зависимостей (issue #31).

`v0.10.0` — версия WARRANT для LATTICE (WARRANT-ADR-0055 п. 1). Она закрывает обход и меняет то, на что опирается
процесс проекта:
- `0.8.3`: reusable workflow ставит CLI из tarball тега — вызов снова работает (WS-01), копия больше не нужна;
- `0.9.0`: pack `risk-high` 2.0.0 больше не добавляет `human-approval` на `VERIFYING->MERGED` — приёмку человеком задаёт
  профиль путей проекта; без него `warrant ci` даёт `NO_HUMAN_ACCEPTANCE`, а правка самого судьи (workflow, policy)
  сливается без акта maintainer'а. Reusable workflow выполняет `warrant validate` и `warrant sync --check` до
  `warrant ci` — дрейф сгенерированных файлов красит job;
- `0.10.0`: коды выхода 0…4 и `retryable`; guard не запирает сессию, когда policy не грузится (ADR-0053 п. 2); CLI
  потребителя на машине — из тега (п. 4). Pack `core-sdd` `0.4.1`: caret `^0.3.4` его не пускает.

CLI на машине уже `0.10.0` из тега, поэтому на `main` policy не грузится (`PACK_VERSION_RANGE`): guard в режиме
восстановления. Закрепление (`kernel`, диапазон pack) и `warrant sync` сделаны в рабочем дереве до этого Change —
выход, который называет guard; их фиксирует impl-PR. Ещё `warrant sync` вскрыл дрейф: коммит `22ea7b2` (freeze
design-next) поправил ссылку `design/…` → `design-next/…` в `AGENTS.md` руками, а правило `tracking` — источник текста —
осталось прежним; `sync` возвращает `design/…`, и с `0.9.0` `sync --check` в job красный.

## What Changes

- `.warrant/warrant.json` — `kernel: "0.10"`, pack `core-sdd` `^0.4.1`; `warrant sync` CLI 0.10.0: lock
  (`kernel: "0.10.0"`, `core-sdd` `0.4.1`), копия схемы `config/1` (поле `cli`), `AGENTS.md`.
- `.github/workflows/warrant.yml` — job `warrant` вызывает `Homasters-max/SRA/.github/workflows/warrant.yml@v0.10.0`
  с `warrant: v0.10.0`, `setup: npm ci`, `merge_commit: ${{ inputs.merge_commit || '' }}`; права `contents`, `actions`,
  `pull-requests`, `issues` — `read`; `on.workflow_dispatch` с входом `merge_commit`. Копии шагов нет. Имя проверки в
  GitHub — `warrant / warrant`.
- `.warrant/local/profiles/human-acceptance.json` (новый, `warrant://profile/1`): пути, правка которых меняет саму
  проверку — policy, lock, правила и профили, waivers, защита агента, workflows, зависимости; gate `human-approval` и
  approval роли `maintainer` на `VERIFYING->MERGED`.
- Правило `tracking`: ссылка-источник issue — `design-next/…` (как в `AGENTS.md` после `22ea7b2`). Правило `process`,
  п. 3: `--by` у `MERGED` нужен, когда gate `human-approval` ставит профиль `human-acceptance`, а не «risk `HIGH`».
- Тест `test/process/pin.test.ts`: инвариант пина — форма вызова (тег `uses` и вход `warrant` равны `v` + `kernel`
  lock, нет `steps:` и `npm pack`); профиль `human-acceptance` держит policy-пути. Форма копии удалена.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет: продукт LATTICE не меняется, меняются судья CI и процесс проекта (`skip_specs: true`).

## Impact

- Policy-пути: `.github/workflows/warrant.yml`, `.warrant/local/profiles/human-acceptance.json`,
  `.warrant/local/rules/tracking.json`, `.warrant/local/rules/process.json`, `.warrant/warrant.json`,
  `.warrant/warrant.lock.json`, `.warrant/schemas/config.1.schema.json`; сгенерированный `AGENTS.md`. Тест
  `test/process/pin.test.ts`. Кода `src/` нет.
- Имя проверки меняется с `warrant` на `warrant / warrant`. Защиты `main` нет (API 404) — обновлять нечего (issue #20).
- WAV-2026-002 (Change `pin-v0-8-2`, в архиве) истекает неиспользованным: копии, которую он покрывал, больше нет.
- Закрывает issue #31.

## Non-goals

- `.github/CODEOWNERS`, защита `main` с «Require review from Code Owners», машинный пользователь агента в
  `identities.agents`: акты maintainer'а и форжа; без бота агент не сливает PR, CODEOWNERS ничего не меняет (issue #20).
- Поле `cli` в `.warrant/warrant.json`: CLI машины уже из тега, локальная копия — по желанию (навык `warrant-upgrade`).
- `dev-check` (issue #27), job проекта для PR без Change (issue #28).
- Переход на `v0.11.0` (`judge-law`, `code-floor`) — отдельный pin-Change.
