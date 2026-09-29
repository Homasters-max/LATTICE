# Tasks

## 1. Судья CI, правила, sync

- [x] 1.1 Патч maintainer'а (design D-2, D-3): `.github/workflows/warrant.yml` — вызов reusable workflow
  `Homasters-max/SRA/.github/workflows/warrant.yml@v0.8.2`; `.warrant/local/rules/process.json` — оговорка о `describe()`
  заменена на `NOT_PROVEN` пропущенного теста сценария; `CLAUDE.md` удалён; проверка — `git diff` называет только эти
  три пути, в `warrant.yml` нет `steps:` и `npm pack`
- [x] 1.2 `warrant sync` CLI 0.8.2 — lock, `.warrant/schemas/gate.1.schema.json`, `AGENTS.md`,
  `.claude/agents/warrant-reviewer.md`; проверка — `warrant validate` и `warrant sync --check` зелёные; lock —
  `kernel: "0.8.2"`; `AGENTS.md` содержит новый текст правила `process`; при `FRONTEND_RESTART_REQUIRED` — перезапуск
  сессии до следующего Run
- [x] 1.3 Патч maintainer'а (design I-5): `.github/workflows/warrant.yml` — копия job с `npm pack github:Homasters-max/SRA#v0.8.2`
  и установкой tarball вместо вызова reusable workflow; проверка — `git diff` называет только этот путь, в файле нет
  `uses: Homasters-max/SRA/` и голого `npm i -g github:`
- [x] 1.4 Waiver `spec-approved` (design I-5; `warrant waive`, активирует maintainer): проверка — `warrant status` показывает
  waiver `ACTIVE`

## 2. Тест пина

- [x] 2.1 `test/process/pin.test.ts` (design D-4), все тесты внутри `describe()`; проверка — `warrant check pin-v0-8-2
  tests-passed` даёт `PROVEN`, число тестов в evidence равно числу тестов прогона

- [x] 2.2 `test/kernel/environment.test.ts` (design I-6): токен `SCN-KR-023` снят с имени теста, пропускаемого вне Unicode
  16.0; проверка — `warrant check pin-v0-8-2 tests-passed` `PROVEN`, в отчёте нет пропущенного теста с `SCN-…` в имени

## 3. Проверка

- [x] 3.1 `warrant verify pin-v0-8-2` CLI 0.8.2; проверка — завершается успешно
- [ ] 3.2 После коммита `VERIFYING`, до push — `warrant ci` CLI 0.8.2 на локальном merge-коммите (design D-1); проверка —
  код 1 только с `GATE_NOT_PASSED` gates L1 (`ATTESTATION_REQUIRED`) и `human-approval` в `deferred[]`; иначе остановка
