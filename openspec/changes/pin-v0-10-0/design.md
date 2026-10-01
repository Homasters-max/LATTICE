# Design

## Context

LATTICE закреплён на WARRANT `0.8.2`: `kernel: "0.8"`, `core-sdd` `^0.3.4`, lock kernel `0.8.2`; судья — копия job
`warrant` в `.github/workflows/warrant.yml` с установкой `npm pack github:Homasters-max/SRA#v0.8.2` (pin-v0-8-2, I-5),
waiver WAV-2026-002 `spec-approved` до 2026-10-13.

CLI на машине — `warrant@0.10.0`, установлен maintainer'ом из tarball тега `v0.10.0` (каталог в глобальном
`node_modules`, не ссылка; ADR-0053 п. 4). Сессия Claude Code началась с ним раньше закрепления — обратный порядок
(ADR-0053 п. 5): policy `main` не грузится (`PACK_VERSION_RANGE`: CLI несёт `core-sdd` `0.4.1`, диапазон `^0.3.4`), guard
пускает только правку `.warrant/warrant.json`, `warrant sync|validate|status|--version` и команды без записи (п. 2). По
этому выходу до `warrant init change` в рабочем дереве сделано: `kernel: "0.10"`, `core-sdd` `^0.4.1`, `warrant sync` —
изменены lock, `.warrant/schemas/config.1.schema.json` (поле `cli`) и `AGENTS.md`; `.claude/` не изменён. Эти правки
не закоммичены и едут в рабочем дереве ветки spec-PR до impl-PR (D-1): без них guard снова запирает сессию.

Проба `preflight` навыка `warrant-upgrade` с этим деревом: CLI = цель, `warrant validate` и `warrant sync --check`
зелёные, reusable workflow `v0.10.0` пакует тег перед установкой (WS-01 закрыт в `0.8.3`), защиты `main` нет,
`identities.agents` пуст.

`AGENTS.md` после `sync` отличается от `main` одной ссылкой: `design-next/…` → `design/…`. Коммит `22ea7b2` поправил её
в `AGENTS.md` руками, а текст правила `tracking` (`.warrant/local/rules/tracking.json`) — источник для `sync` — нет.

`.github/workflows/**` и `.warrant/local/**` — policy-пути: записи у агента нет (правило `maintainer-acts`).

## Goals / Non-Goals

**Goals:**
- Lock и сгенерированные файлы — kernel `0.10.0`, `core-sdd` `0.4.1`; `warrant validate` и `warrant sync --check`
  зелёные на коммите impl-PR.
- Судья CI — вызов reusable workflow WARRANT `v0.10.0`, копии job нет; один тег в двух местах (`uses`, `warrant`).
- Правка самого судьи сливается актом maintainer'а: профиль `human-acceptance`.
- Текст правил — источник `AGENTS.md` без ручных правок: `tracking` с `design-next/…`, `process` с причиной `--by`.
- Тест пина следит за формой вызова и за профилем.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. Порядок в impl-PR

Ветка `impl/pin-v0-10-0` от `main` со слитым spec-PR; незакоммиченное закрепление (Context) переходит в неё рабочим
деревом.

1. Первый коммит — `warrant transition pin-v0-10-0 APPROVED --ref <URL spec-PR> --by Homasters-max` и `IMPLEMENTING`.
   Только record: закрепление в него не входит.
2. Акт maintainer'а (D-2): патч policy-путей; агент проверяет `git diff`, коммитит.
3. `warrant sync` CLI 0.10.0 после патча — `AGENTS.md` берёт новый текст правил; коммит закрепления: `.warrant/warrant.json`,
   lock, `config.1.schema.json`, `AGENTS.md`. Проверка — `warrant validate`, `warrant sync --check` зелёные; в
   `AGENTS.md` — `design-next/…`. Если `sync` изменит `.claude/` — перезапуск сессии (акт maintainer'а) до Run.
4. Run `implement` — тест пина (D-4), отметки `tasks.md`; `warrant run finish`; `warrant check pin-v0-10-0 tests-passed`
   `PROVEN`; `npm run typecheck`; коммит.
5. Последний коммит — `warrant verify` и `transition VERIFYING`.

Проверка до push (навык `warrant-upgrade`, шаг 6): `warrant ci` CLI 0.10.0 на локальном merge-коммите `origin/main` +
ветка (`git merge --no-ff`, `GITHUB_REPOSITORY=Homasters-max/LATTICE`). Ожидаемо: код 1 только с `GATE_NOT_PASSED`
gates, у которых `ATTESTATION_REQUIRED` (записи CI), `human-approval` в `deferred[]`; информационная `SHARED_IDENTITY`.
Иной код — сначала `hint`. Job impl-PR уже идёт по новому вызову: событие `pull_request` берёт workflow из результата
merge.

Отвергнуто: закрепление первым коммитом вместе с переходами — коммит переходов по правилу `process` несёт только record.

### D-2. Патч policy-путей — акт maintainer'а

Агент собирает патч в scratch worktree вне проекта (`git diff`, `git apply --check`): workflow — `make-patch.mjs 0.10.0
call --setup "npm ci"` навыка `warrant-upgrade`; правила и профиль — `node` + `JSON.parse` / `JSON.stringify`, diff
каждого правила — одна строка `text`. Пути:
- `.github/workflows/warrant.yml` — D-3;
- `.warrant/local/profiles/human-acceptance.json` — D-5;
- `.warrant/local/rules/tracking.json` — в `text` `(PR, коммит, I-N, \`design/…\`)` → `(PR, коммит, I-N,
  \`design-next/…\`)`;
- `.warrant/local/rules/process.json` — в п. 3 `потому что effective policy Change (risk \`HIGH\`) ставит gate` →
  `потому что профиль \`human-acceptance\` ставит gate`; остальной текст без изменений.

Maintainer применяет его одной командой `git apply <путь>`, агент проверяет `git diff` (ровно эти четыре пути) и
коммитит. `AGENTS.md` меняет только `warrant sync` (D-1 п. 3), руками — нет: ручная правка и дала дрейф (Context).

### D-3. Форма вызова

`.github/workflows/warrant.yml` — шаблон `workflow-call.yml.tmpl` навыка `warrant-upgrade` (та же форма, что D-3
pin-v0-8-2 и комментарий-образец в заголовке reusable workflow `v0.10.0`):

```yaml
jobs:
  warrant:
    name: warrant
    if: github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'
    permissions:
      contents: read
      actions: read
      pull-requests: read
      issues: read
    uses: Homasters-max/SRA/.github/workflows/warrant.yml@v0.10.0
    with:
      warrant: v0.10.0
      setup: npm ci
      merge_commit: ${{ inputs.merge_commit || '' }}
```

`on.pull_request`, `on.workflow_dispatch` с входом `merge_commit` (обязателен), права верхнего уровня и `concurrency` —
как сейчас: блока `concurrency` у reusable workflow нет. Имя файла `warrant.yml` сохраняется (подсказка
`NO_CI_EVIDENCE` называет `gh workflow run warrant.yml -f merge_commit=<M>`). Входы `node-version` (22) и
`openspec-version` (1.13.1) — по умолчанию workflow, совпадают с копией. `setup: npm ci` — `typescript` для теста
структуры; `package-lock.json` есть. Контракт сверен с `.github/workflows/warrant.yml` SRA на теге `v0.10.0`: входы
`warrant` (обязателен), `setup`, `node-version`, `openspec-version`, `merge_commit`; job `warrant` — проверка
`warrant / warrant`; до `warrant ci` — `warrant validate` и `warrant sync --check` (`0.9.0`, WS-13).

### D-4. Тест пина

`test/process/pin.test.ts`: блок «pin: CI judge and lock» — форма A шаблона `pin.test.ts.tmpl`: тег после
`uses: Homasters-max/SRA/.github/workflows/warrant.yml@` — ровно один, равен `kernel` lock; вход `warrant: v<X>` с
отступом 6 — ровно один, равен `kernel` lock; нет `steps:` и `npm pack`. Строки-комментарии YAML отброшены. Форма B
(копия) удалена. Новый блок «pin: human acceptance»: `.warrant/local/profiles/human-acceptance.json` — `$schema`
`warrant://profile/1`, `id` `human-acceptance`; `gates["VERIFYING->MERGED"]` содержит `human-approval`; approval роли
`maintainer` на `VERIFYING->MERGED`; `match.paths` содержит `.warrant/warrant.json`, `.warrant/local/**` и
`.github/workflows/**`. Блок «pin: project rules» не меняется. Все тесты внутри `describe()`, токенов `SCN-…` нет
(`skip_specs`). Границы: тест видит форму файлов, не исполнение; исполнение показывает job impl-PR.

### D-5. Профиль `human-acceptance`

`.warrant/local/profiles/human-acceptance.json` по образцу SRA, пути — LATTICE:

```json
{
  "$schema": "warrant://profile/1",
  "id": "human-acceptance",
  "version": "1.0.0",
  "description": "Paths whose change alters the check itself: policy, project rules, waivers, agent protection, the CI judge and the toolchain of the tests. A human merges such an impl-PR (WARRANT ADR-0050 p. 3, ADR-0051 p. 2).",
  "match": {
    "paths": [
      ".warrant/warrant.json",
      ".warrant/warrant.lock.json",
      ".warrant/local/**",
      ".warrant/waivers/**",
      ".claude/**",
      "**/AGENTS.md",
      ".github/workflows/**",
      "package.json",
      "package-lock.json",
      "**/tsconfig*.json"
    ]
  },
  "gates": { "VERIFYING->MERGED": ["human-approval"] },
  "approvals": [{ "role": "maintainer", "at": "VERIFYING->MERGED" }]
}
```

Без `.github/CODEOWNERS`: файла нет (Non-goals). `packs/**`, `packages/cli/**`, хуки `scripts/dev/` SRA в LATTICE нет.
Профиль подхватывается из `.warrant/local/profiles/` по `match.paths`, регистрации в `warrant.json` не нужно.

### D-6. Без spec

`skip_specs: true`: продукт LATTICE не меняется; требования к процессу держат правила WARRANT, профиль и тест пина (тот
же довод, что в `pin-v0-8-1` и `pin-v0-8-2`).

### D-7. Классификация

`chore` + `factory-change` (policy-пути в diff impl-PR). `blast_radius: SYSTEM` — floor pack для `.warrant/**` и
`.github/workflows/**`; `compatibility: BREAKING` — имя проверки меняется (`warrant` → `warrant / warrant`), merge
policy-путей требует акта maintainer'а, коды выхода CLI другие; `reversibility: EASY` — откат pin-Change на `v0.8.2`,
данных не теряет; `data_loss: NONE`; `security_impact: LOW` — права job те же, workflow внешний, закреплён тегом, без
секретов. `MERGED` — по правилу `process`: без `--by`; с `--by Homasters-max`, только если `warrant` ответит `USAGE`.

### D-8. WAV-2026-002

Waiver Change `pin-v0-8-2` (в архиве) истекает 2026-10-13 неиспользованным: после merge impl-PR копии job нет. Record и
waiver не правятся (их пишет только `warrant`).

## Risks / Trade-offs

- [Spec-PR судит копия `v0.8.2`, а record пишет CLI 0.10.0] → схема `change-record/1` в `sync` не изменилась (изменена
  только `config/1`); `warrant.json` ветки spec-PR — прежний (закрепление не закоммичено). Красный job — `hint`, затем
  `I-N`.
- [Закрепление живёт незакоммиченным в рабочем дереве между PR] → `git status` перед каждым коммитом spec-PR: в коммит
  идут только `openspec/changes/pin-v0-10-0/**` и `.warrant/changes/pin-v0-10-0.json`.
- [Профиль в diff самого impl-PR: effective policy базы (`main`) его ещё не знает] → `human-approval` к этому Change
  может не примениться; merge всё равно делает maintainer (правило `process`), `--by` — по ответу `warrant` (D-7).
- [Вызов reusable workflow не стартует (`startup_failure`) или `sync --check` в job красный] → правка в ветке; дефект
  WARRANT — `D:/tmp/warrant-inbox/`, обход — `I-N` с решением maintainer'а.
- [Workflow внешний: тег SRA — часть цепочки поставки CI] → `uses` на теге релиза, репозиторий публичный (ADR-0039 п. 5).
- [`SHARED_IDENTITY`, `APPROVER_IS_AUTHOR`] → информационные, до бота агента (issue #20).

## Migration Plan

1. spec-PR — артефакты, `classify --propose`, review spec, `SPECIFIED` по слову maintainer'а.
2. impl-PR — D-1; вердикт — job `warrant / warrant` на `v0.10.0`. Тело PR: `Closes #31`, `Refs #20`.
3. archive-PR — `ci fetch`, `MERGED --ref <URL impl-PR>` (D-7), `archive`.
4. Откат — pin-Change на `v0.8.2`: копия job, `kernel: "0.8"`, `^0.3.4`, CLI машины `0.8.2` из тега.
