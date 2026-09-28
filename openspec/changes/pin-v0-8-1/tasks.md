# Tasks

## 1. Судья CI, правила, sync

- [ ] 1.1 Патч maintainer'а (design D-2): `.github/workflows/warrant.yml` — тег `v0.8.1` в шаге установки CLI;
  `.warrant/local/rules/maintainer-acts.json`, `.warrant/local/rules/session-start.json`; `CLAUDE.md` — `@AGENTS.md`;
  проверка — `git diff` называет в `warrant.yml` только строку тега, прочие пути — только эти
- [ ] 1.2 `warrant sync` CLI 0.8.1 — lock, `.claude/agents/warrant-reviewer.md`, `AGENTS.md`; проверка — `warrant validate`
  и `warrant sync --check` зелёные; lock — `kernel: "0.8.1"`; `AGENTS.md` содержит тексты правил `maintainer-acts` и
  `session-start`; `warrant-reviewer.md` называет `Write` и `run submit --file`; после — перезапуск сессии

## 2. Тест пина

- [ ] 2.1 `test/process/pin.test.ts` (design D-3), все тесты внутри `describe()`; проверка — `warrant check pin-v0-8-1
  tests-passed` даёт `PROVEN`, число тестов в evidence равно числу `it()` файла

## 3. Проверка

- [ ] 3.1 `warrant verify pin-v0-8-1` CLI 0.8.1; проверка — завершается успешно
- [ ] 3.2 После коммита `VERIFYING`, до push — `warrant ci` CLI 0.8.1 на локальном merge-коммите (design D-1); проверка —
  код 1 только с `GATE_NOT_PASSED` gates L1 (`ATTESTATION_REQUIRED`) и `human-approval` в `deferred[]`; иначе остановка
