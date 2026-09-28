# Design

## Context

LATTICE закреплён на CLI `v0.8.0`: тег в `.github/workflows/warrant.yml`, lock записан kernel `0.8.0`; `kernel: "0.8"`
в `.warrant/warrant.json`. Фабрика выпустила `v0.8.1` (WARRANT-ADR-0042): kernel и pack `core-sdd` `0.3.4` те же,
меняются судья (junit, guard, `data.received`) и сгенерированный субагент `warrant-reviewer`. В отличие от
`pin-v0-8-0` warrant-slice (ADR-0041, агент сессии фабрики без guard), этот Change ведёт сессия LATTICE под guard
проекта (ADR-0042 п. 1): записи в policy-пути `.github/workflows/**` и `.warrant/local/**` у агента нет.

Проба на копии дерева (`git worktree`, CLI 0.8.1): `warrant sync` меняет только lock (`kernel`, хэш
`warrant-reviewer.md`) и `warrant-reviewer.md`; правило `warrant://rule/1` с `paths: ["**"]` в `.warrant/local/rules/`
попадает в `AGENTS.md` (порядок — по `id`), `sync` даёт `FRONTEND_RESTART_REQUIRED`, `warrant validate` — зелёный.

## Goals / Non-Goals

**Goals:**
- Судья CI и локальный CLI — `v0.8.1`; `warrant validate` и `warrant sync --check` зелёные.
- Правила R-L0-01, R-L0-02 — правила WARRANT проекта, доставляются агенту через `AGENTS.md`.
- `tests-passed` impl-PR — `PROVEN` на первом тесте проекта.

**Non-Goals:** — proposal, Non-goals.

## Decisions

### D-1. Порядок в impl-PR

1. Первый коммит — `transition APPROVED --ref <URL spec-PR> --by <maintainer>` и `IMPLEMENTING`, CLI 0.8.1.
   Kernel базы и CLI — одна минорная версия `0.8`, pack тот же: `transition` lock не проверяет, gates считает по тому же
   pack.
2. Акт maintainer'а (D-2): патч policy-путей и `CLAUDE.md`; агент коммитит результат.
3. `warrant sync` CLI 0.8.1 — lock, `warrant-reviewer.md`, `AGENTS.md`; коммит; перезапуск сессии Claude Code
   (`FRONTEND_RESTART_REQUIRED`) до следующего Run.
4. Run `implement` — тест пина (D-3) и отметки `tasks.md`; `warrant run finish`.
5. Последний коммит — `warrant verify` и `transition VERIFYING`.

Проверка до push — после коммита `VERIFYING`: `warrant ci` CLI 0.8.1 на локальном merge-коммите, собранном как в job
(`origin/main` + head ветки, `git merge --no-ff`, `GITHUB_REPOSITORY` задан). Ожидаемый исход — код 1 только с
`GATE_NOT_PASSED` gates L1, у которых в findings `ATTESTATION_REQUIRED`, и `human-approval` в `deferred[]`. Иной код
нарушения сначала сверяется с `hint`: ошибка Change исправляется в ветке; отказ CLI 0.8.1 на базе lock 0.8.0 —
остановка и строка `W-NNN` в `dev/issues/`, pin не обходится. Job impl-PR идёт уже на `v0.8.1`: событие
`pull_request` берёт workflow из результата merge.

### D-2. Правка policy-путей — акт maintainer'а

Агент пишет патч во временный каталог вне проекта (`git diff`-формат): тег `v0.8.1` в шаге «Install warrant (pinned)»,
`.warrant/local/rules/maintainer-acts.json`, `.warrant/local/rules/session-start.json`, `CLAUDE.md` → `@AGENTS.md`.
Maintainer применяет его одной командой `git apply <путь>` (правило `maintainer-acts`), агент проверяет `git diff` и
коммитит. Отвергнуто: запись агентом через shell — обход `deny` guard (правило `process`); сессия фабрики, как в
`pin-v0-8-0`, — ADR-0042 п. 1 отдаёт приёмку сессии LATTICE; ручная правка maintainer'ом по описанию — дольше и без
точного текста.

Правила — `warrant://rule/1` без `enforced_by`: решения, не формы. Поля `force`, `owner`, `source` формата `dev/` в
`rule/1` нет; источник — PR #3 (`issuecomment-5865372587`) — называет этот design. Текст — из `dev/STATE.md` без
изменения смысла; у `session-start` — строка `CLAUDE.md`, чтобы правило не дублировалось в двух файлах.

### D-3. Тест пина

`test/process/pin.test.ts`, `node:test`, всё внутри `describe()`; чтение файлов от корня (`import.meta.url`), без
зависимостей:
- тег `Homasters-max/SRA#v<X>` в `.github/workflows/warrant.yml` — один, и `X` равен `kernel` lock: инвариант, который
  следующий pin-Change не правит;
- `.warrant/local/rules/maintainer-acts.json` и `session-start.json` — `$schema` `warrant://rule/1`, `id` = имя файла,
  `paths` = `["**"]`, `text` непуст и входит в `AGENTS.md`.

Токенов `SCN-…` нет: `skip_specs`, сценариев нет. Проба на копии: без тестов отчёт junit — пустой `<testsuites>`,
parser 0.8.1 даёт `INCONCLUSIVE` («no <testcase> or <testsuite>»); Node 22.17 грузит `.ts` без `package.json` как ESM
(`--experimental-strip-types`).

### D-4. Без spec

`skip_specs: true`: продукт LATTICE не меняется; требования к процессу держат правила WARRANT и тест пина. Gate
`required-artifacts-present` засчитывает `skipped` для `specs`. Отвергнуто: capability процесса — новая AREA требует
правки `.warrant/local/areas.json`, недоступной spec-PR.

### D-5. Классификация

`chore` + `factory-change` (policy-пути в diff impl-PR). `blast_radius: SYSTEM` — floor pack для `.warrant/**`;
`compatibility: BREAKING` — CLI 0.8.0 на lock kernel 0.8.1 даёт красные `validate` и `sync --check`;
`reversibility: EASY` — откат таким же pin-Change на `v0.8.0`, данных не теряет; `data_loss: NONE`,
`security_impact: LOW`. `--propose`: diff spec-PR ещё без policy-путей. Risk `HIGH` → gate `human-approval` на
`VERIFYING->MERGED`, `MERGED` — с `--by <maintainer>` (правило `process`).

## Risks / Trade-offs

- [CLI 0.8.1 судит impl-PR на базе lock 0.8.0] → kernel один (`0.8`), pack тот же; отказ — остановка по D-1.
- [Перезапуск сессии посреди impl-PR] → шаг сессии записан в `dev/` до перезапуска, новая сессия стартует по
  `dev/STATE.md` (правило `session-start`).
- [Тест пина проверяет конфигурацию, а не продукт] → первый тест проекта держит `tests-passed` и ловит расхождение
  тега и lock; продуктовые тесты приходят с `kernel-format`.

## Migration Plan

1. spec-PR — артефакты, `classify --propose`, review spec, `SPECIFIED` по слову maintainer'а.
2. impl-PR — D-1; вердикт — job `warrant` на `v0.8.1`.
3. archive-PR — `ci fetch`, `MERGED --ref <URL impl-PR> --by <maintainer>` (D-5), `archive`; в `dev/` ловушки R-L0-01,
   R-L0-02, R-L0-08 — `retired`.
4. Откат — pin-Change обратно на `v0.8.0` (D-5).
