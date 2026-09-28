# Tasks

## 1. Тест правил

- [ ] 1.1 `test/process/pin.test.ts` (design D-1): «pin: project rules» — по каталогу `.warrant/local/rules/*.json`, один
  `it()` на файл и `it()` «правил не меньше одного», все внутри `describe()`; комментарий файла — без `dev/`; проверка —
  `npm test` зелёный, в выводе — по тесту на каждое из `env`, `maintainer-acts`, `process`, `tracking`

## 2. Проверка

- [ ] 2.1 `warrant check fix-pin-test tests-passed`; проверка — `PROVEN`, число тестов в evidence равно числу тестов
  прогона
- [ ] 2.2 `warrant verify fix-pin-test`; проверка — завершается успешно
