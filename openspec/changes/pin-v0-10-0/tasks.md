# Tasks

## 1. Судья CI, правила, профиль

- [ ] 1.1 Патч maintainer'а (design D-2, D-3, D-5): `.github/workflows/warrant.yml` — вызов
  `Homasters-max/SRA/.github/workflows/warrant.yml@v0.10.0` с `warrant: v0.10.0`; `.warrant/local/profiles/human-acceptance.json`;
  `.warrant/local/rules/tracking.json` — `design-next/…`; `.warrant/local/rules/process.json` — причина `--by` у `MERGED`;
  проверка — `git diff` называет только эти четыре пути, в `warrant.yml` нет `steps:` и `npm pack`, diff каждого
  правила — одна строка
- [ ] 1.2 Закрепление и `warrant sync` CLI 0.10.0 (design D-1 п. 3): `.warrant/warrant.json` — `kernel: "0.10"`,
  `core-sdd` `^0.4.1`; lock, `.warrant/schemas/config.1.schema.json`, `AGENTS.md`; проверка — `warrant validate` и
  `warrant sync --check` зелёные, lock — `kernel: "0.10.0"`, `AGENTS.md` содержит `design-next/…` и новый текст `process`

## 2. Тест пина

- [ ] 2.1 `test/process/pin.test.ts` (design D-4): форма вызова, блок «pin: human acceptance», форма копии удалена, все
  тесты внутри `describe()`; проверка — `warrant check pin-v0-10-0 tests-passed` `PROVEN`, `npm run typecheck` зелёный

## 3. Проверка

- [ ] 3.1 `warrant verify pin-v0-10-0`; проверка — завершается успешно
- [ ] 3.2 После коммита `VERIFYING`, до push — `warrant ci` CLI 0.10.0 на локальном merge-коммите (design D-1); проверка —
  код 1 только с `GATE_NOT_PASSED` gates с `ATTESTATION_REQUIRED` и `human-approval` (если есть) в `deferred[]`; иначе
  остановка
