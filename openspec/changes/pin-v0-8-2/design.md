# Design

## Context

LATTICE закреплён на WARRANT `0.8.1`: тег в шаге `npm pack github:Homasters-max/SRA#v0.8.1` файла
`.github/workflows/warrant.yml` (копия job `warrant` SRA), lock записан kernel `0.8.1`; `kernel: "0.8"` в
`.warrant/warrant.json`. CLI на машине — `0.8.2`: глобальная ссылка `warrant@0.8.2 -> D:\project\SRA`, checkout на
коммите `7c603f0` — указывает тег `v0.8.2`. Поэтому шаг 1 запроса («CLI — `github:Homasters-max/SRA#v0.8.2`») выполнен:
переустановка заменила бы ссылку на dev-checkout копией того же коммита.

Проба на `main` (CLI 0.8.2): `warrant sync --check` меняет только `.warrant/schemas/gate.1.schema.json` (поле `check` в
`requires_evidence[]`) и lock; `AGENTS.md` и `warrant-reviewer.md` в списке `generated`, но `changed` их не называет.
Шаг «Install warrant (pinned)» копии job судит impl-PR по тегу, который задаёт этот файл: новый тег — та же правка, что
в `pin-v0-8-1`, но теперь вместо тега правится вызов.

`.github/workflows/**` и `.warrant/local/**` — policy-пути: записи в них у агента нет (ADR-0040), их правит maintainer.
`CLAUDE.md` вне policy-путей, но попадает в тот же патч: `warrant sync` 0.8.2 его не создаёт, файл — одна строка
`@AGENTS.md`.

## Goals / Non-Goals

**Goals:**
- Судья CI — вызов reusable workflow WARRANT `v0.8.2`, копии job нет; один тег в двух местах вызова (`uses` и `warrant`).
- Lock и сгенерированные файлы — kernel `0.8.2`; `warrant validate` и `warrant sync --check` зелёные.
- Правило `process` без устаревшей оговорки о junit; `CLAUDE.md` удалён.
- Инвариант пина в `test/process/pin.test.ts` следит за новой формой (тег вызова = kernel lock).

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. Порядок в impl-PR

1. Первый коммит — `transition APPROVED --ref <URL слитого spec-PR> --by <maintainer>` и `IMPLEMENTING`, CLI 0.8.2.
   `transition` lock не проверяет; kernel базы и CLI — одна минорная версия `0.8`, pack тот же.
2. Акт maintainer'а (D-2): патч policy-путей и `CLAUDE.md`; агент проверяет `git diff` и коммитит результат.
3. `warrant sync` CLI 0.8.2 — lock, `gate.1.schema.json`, при изменении — `AGENTS.md` и `warrant-reviewer.md`; коммит.
   Если `sync` ответил `FRONTEND_RESTART_REQUIRED` — перезапуск сессии Claude Code (акт maintainer'а) до следующего Run.
   Порядок «патч, потом sync»: `AGENTS.md` содержит текст правил, а `sync` берёт его из `.warrant/local/rules/`.
4. Run `implement` — тест пина (D-4) и отметки `tasks.md`; `warrant run finish`.
5. Последний коммит — `warrant verify` и `transition VERIFYING`.

Проверка до push — после коммита `VERIFYING`: `warrant ci` CLI 0.8.2 на локальном merge-коммите, собранном как в job
(`origin/main` + head ветки, `git merge --no-ff`, `GITHUB_REPOSITORY` задан). Ожидаемый исход — код 1 только с
`GATE_NOT_PASSED` gates L1, у которых в findings `ATTESTATION_REQUIRED`, и `human-approval` в `deferred[]`; в
`data.findings[]` — информационная `SHARED_IDENTITY` (BL-83), она не меняет код. Иной код сначала сверяется с `hint`.
Job impl-PR идёт уже по новому вызову: событие `pull_request` берёт workflow из результата merge.

### D-2. Правка policy-путей — акт maintainer'а

Агент пишет патч во временный каталог вне проекта (`git diff`-формат):
- `.github/workflows/warrant.yml` — D-3;
- `.warrant/local/rules/process.json` — в пункте 2 правила: «(тест вне `describe()` отчёт junit не считает)» заменено
  на «(пропуск `skip` / `todo` теста с токеном `SCN-…` — `NOT_PROVEN`)»; остальной текст без изменений;
- `CLAUDE.md` — удаление.

Maintainer применяет его одной командой `git apply <путь>` (правило `maintainer-acts`), агент проверяет `git diff` и
коммитит. Отвергнуто: запись агентом через shell — обход `deny` guard (правило `process`). Правило `process` в отчёт
`AGENTS.md` попадает только через `warrant sync` (D-1 п. 3), а не правкой `AGENTS.md`.

Оговорка о `describe()` снимается по тому основанию, что parser `junit` 0.8.1 читает атрибут `name` каждого `<testcase>`
отчёта (WARRANT-ADR-0044 п. 2; 06 §2), а не вложенность. Требование «каждый тест — внутри `describe()`» остаётся — его
держит `SCN-AR-003` (`test/architecture/structure.test.ts`); правило `process` его не дублирует иначе как в скобке.

### D-3. Форма вызова

Файл `.github/workflows/warrant.yml`, `name: warrant`, комментарий в заголовке — что файл вызывает workflow WARRANT и где
источник. Тело:

```yaml
on:
  pull_request:
  workflow_dispatch:
    inputs:
      merge_commit:
        description: "Merge commit M of the impl-PR on the default branch"
        required: true
        type: string

permissions:
  contents: read
  actions: read
  pull-requests: read
  issues: read

concurrency:
  group: warrant-${{ github.ref }}-${{ github.event_name == 'workflow_dispatch' && inputs.merge_commit || 'run' }}
  cancel-in-progress: true

jobs:
  warrant:
    name: warrant
    if: github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'
    permissions:
      contents: read
      actions: read
      pull-requests: read
      issues: read
    uses: Homasters-max/SRA/.github/workflows/warrant.yml@v0.8.2
    with:
      warrant: v0.8.2
      setup: npm ci
      merge_commit: ${{ inputs.merge_commit || '' }}
```

- `setup: npm ci` — зависимости проекта: `typescript` нужен тесту структуры (`test/architecture`); `package-lock.json` есть.
- `concurrency` остаётся у вызывающего: reusable workflow своего блока не имеет; recovery-прогон не отменяет и не
  отменяется обычным.
- Имя файла `warrant.yml` сохраняется: подсказка `NO_CI_EVIDENCE` `warrant ci fetch` называет
  `gh workflow run warrant.yml -f merge_commit=<M>`.
- Тег `v0.8.2` — в `uses` и во входе `warrant`; подъём версии — правка обеих строк (D-4 их сверяет).
- Установка OpenSpec и Node — по умолчанию workflow (`node-version: 22`, `openspec-version: 1.13.1`), совпадают с
  прежней копией.

### D-4. Тест пина

`test/process/pin.test.ts`: тест «pin: CI judge and lock» переписан, «pin: project rules» не меняется. Все тесты внутри
`describe()`; чтение от корня (`import.meta.url`), без зависимостей. Строки-комментарии YAML (`#…`) перед проверкой
отбрасываются. Тесты:
- тег `v<X>` после `Homasters-max/SRA/.github/workflows/warrant.yml@` — ровно один, `X` равен `kernel` lock;
- значение входа `warrant:` в `with` — ровно одно, равно `v` + `kernel` lock (тег `uses` и вход не расходятся);
- копии job нет: в файле нет `steps:` и `npm pack` (форма вызова, а не копии).

Токенов `SCN-…` нет: `skip_specs`, сценариев нет. Границы: тест видит форму файла, не исполнение workflow; исполнение
показывает job `warrant` самого impl-PR.

### D-5. Без spec

`skip_specs: true`: продукт LATTICE не меняется, требования к процессу держат правила WARRANT и тест пина; новая AREA
требует правки `.warrant/local/areas.json` — вне spec-PR (тот же довод, что в `pin-v0-8-1`).

### D-6. Классификация

`chore` + `factory-change` (policy-пути в diff impl-PR). `blast_radius: SYSTEM` — floor pack для `.warrant/**` и
`.github/workflows/**`; `compatibility: BREAKING` — имя обязательной проверки меняется (`warrant` → `warrant / warrant`),
CI зависит от внешнего workflow; `reversibility: EASY` — откат pin-Change на `v0.8.1`, данных не теряет;
`data_loss: NONE`, `security_impact: LOW` — права job те же, workflow внешний, но закреплён тегом и вызван без
секретов. Risk `HIGH` → gate `human-approval` на `VERIFYING->MERGED`, `MERGED` — с `--by <maintainer>` (правило
`process`).

## Implementation Notes

По находкам review 1 (EVID-01M3P6JSX4MM8YHSQV1PJD1NS6, `PROVEN`: MAJOR F-1, MINOR F-2…F-4, INFO F-5) — строками, не
новым раундом; решение maintainer'а — одобрение spec-PR
([PR #29](https://github.com/Homasters-max/LATTICE/pull/29#issuecomment-5887132171)). Строки уточняют исполнение
D-1…D-6 и решений spec не меняют.

| # | Решение |
|---|---|
| I-1 | F-1: контракт вызываемого workflow сверен с `.github/workflows/warrant.yml` SRA на теге `v0.8.2`: входы `warrant` (обязателен), `setup`, `node-version` (22), `openspec-version` (1.13.1), `merge_commit`; блока `concurrency` нет (остаётся у вызывающего, D-3); job называется `warrant`, поэтому проверка — `warrant / warrant` (06 §8). Имя проверки и запуск подтверждает job самого impl-PR |
| I-2 | F-2: тест пина (D-4) разбирает файл по строкам без YAML-парсера: строки-комментарии отброшены; тег `uses` — строка `uses: Homasters-max/SRA/.github/workflows/warrant.yml@v<X>`; вход — строка `warrant: v<X>` с отступом ровно 6 (вход блока `with:`), а не id job `warrant:` (отступ 2); кавычек и комментариев в конце строки вызов не содержит |
| I-3 | F-3: `AGENTS.md` меняется безусловно — `warrant sync` переносит в него новый текст правила `process`; «если генератор изменит» из proposal и D-1 п. 3 относится к `warrant-reviewer.md`, который `sync` 0.8.2 не изменил |
| I-4 | F-4, U-1: gates `VERIFYING->MERGED` в effective policy — `analyze-clean`, `evidence-complete`, `factory-golden-passed`, `human-approval`, `ids-valid`, `scope-valid`, `spec-approved`, `tests-passed`; check `dev-check` (Non-goal, issue #27) ни в одном не участвует, ожидаемый исход `warrant ci` (задача 3.2) не меняется |

## Risks / Trade-offs

- [Вызов reusable workflow не стартует (`startup_failure`: доступ, синтаксис, права)] → job красный до merge, правка
  вызова в ветке; отказ фабрики — остановка, `W-NNN` в `D:/tmp/warrant-inbox/` и, если нужен новый тег, строка `I-N` с
  решением maintainer'а.
- [Workflow внешний: тег SRA — часть цепочки поставки CI] → репозиторий SRA публичный, тег — релиз фабрики (тот же довод, что у пина CLI по тегу, ADR-0039 п. 5);
  `uses` закреплён на теге, не на ветке (SHA-пин — строже, но рвёт правило «один тег в двух местах» 06 §8; вне объёма).
- [Проверка `warrant / warrant` в защите `main`] → защита не включена; при включении — имя уже новое (issue #20).
- [Удаление `CLAUDE.md` при Claude Code без чтения `AGENTS.md`] → issue #22: с ≥ 2.1.277 `AGENTS.md` читается сам; версия
  на машине — 2.1.283; регресс — возврат файла одним коммитом.
- [`SHARED_IDENTITY` в выводе `warrant ci`] → осознанный шум (06 §8): сигнал завести App агента (issue #20).
- [Тест пина проверяет текст файла, не исполнение] → исполнение показывает сам job impl-PR.

## Migration Plan

1. spec-PR — артефакты, `classify --propose`, review spec, `SPECIFIED` по слову maintainer'а.
2. impl-PR — D-1; вердикт — job `warrant / warrant` на `v0.8.2`. Тело PR: `Closes #22`, `Refs #20`.
3. archive-PR — `ci fetch`, `MERGED --ref <URL impl-PR> --by <maintainer>` (D-6), `archive`.
4. Откат — pin-Change обратно на `v0.8.1` (копия job и `CLAUDE.md` возвращаются патчем).
