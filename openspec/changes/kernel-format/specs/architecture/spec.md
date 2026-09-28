# Spec Delta

## Purpose

Правила структуры кода LATTICE, которые проверяет тест, а не ревью: направление импортов между частями системы,
границы ввода-вывода и форма тестов проекта (design/04-architecture.md §2, §3).

## ADDED Requirements

### Requirement: Ядро изолировано
<!-- id: REQ-AR-001 -->

Тест структуры SHALL разбирать исходные файлы TypeScript (`*.ts`) проверяемого каталога ядра рекурсивно, с
подкаталогами: `src/kernel/` проекта или каталога-фикстуры. Корень проверяемого каталога — граница ядра. Файл
SHALL отклоняться по правилам:
- `import-outside-kernel` — статический `import`, `import type` или `export … from` модуля, который не является файлом
  внутри корня проверяемого каталога, кроме спецификатора ровно `node:crypto` (`crypto`, `node:crypto/…`, пакеты и
  прочие встроенные модули — нарушение);
- `crypto-import` — импорт из `node:crypto` чего-либо, кроме именованного `createHash` (импорт по умолчанию, импорт
  пространства имён, `randomBytes`, `randomUUID`, `getRandomValues` и прочие имена — нарушение);
- `dynamic-import` — вызов `import(…)` или `require(…)`;
- `forbidden-global` — свободный идентификатор `process`, `fetch`, `Deno`, `Bun`, `globalThis`, `global`, `window`,
  `self`, `performance`, `console`, `crypto`, `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `eval`,
  `Function`;
- `nondeterminism` — `Math.random`, `Date.now`, `new Date()` и `Date()` без аргументов (`Math` и `Date` — свободные
  идентификаторы).

Свободный идентификатор — не имя свойства после точки, не ключ литерала объекта и не имя, связанное объявлением в
этом файле (переменная, параметр, функция, класс, импорт). Отказ теста SHALL называть файл, строку и идентификатор
правила. Проверка SHALL работать по разбору исходного текста, без исполнения проверяемых файлов.

#### Scenario: Ядро проекта проходит тест структуры
<!-- id: SCN-AR-001 -->
- **WHEN** тест структуры запускается на каталоге `src/kernel/` проекта
- **THEN** нарушений нет

#### Scenario: Нарушения ядра найдены
<!-- id: SCN-AR-002 -->
- **WHEN** тест структуры запускается на каталоге-фикстуре ядра с файлами (ожидаемое правило — в скобках): импорт
  `node:fs` (`import-outside-kernel`); импорт `../ledger/commit.ts` (`import-outside-kernel`); импорт пакета
  `canonicalize` (`import-outside-kernel`); импорт `crypto` (`import-outside-kernel`); `export { x } from "node:path"`
  (`import-outside-kernel`); `import type { T } from "../run/types.ts"` (`import-outside-kernel`); файл в подкаталоге
  `sub/`, импортирующий `../../outside.ts` (`import-outside-kernel`); `import { randomUUID } from "node:crypto"`
  (`crypto-import`); вызов `import("./x.ts")` (`dynamic-import`); чтение `process.env.HOME` (`forbidden-global`); вызов
  `fetch("…")` (`forbidden-global`); `globalThis.x` (`forbidden-global`); `console.log(1)` (`forbidden-global`);
  `new Function("return 1")` (`forbidden-global`); `setTimeout(f, 0)` (`forbidden-global`); `Date.now()`
  (`nondeterminism`); `new Date()` (`nondeterminism`); `Math.random()` (`nondeterminism`); и файлами без нарушений:
  импорт только `{ createHash }` из `node:crypto` и `./hash.ts` с вызовом `new Date(0)`; файл в подкаталоге `sub/`,
  импортирующий `../hash.ts`; файл с локальной `const process = 1`, её чтением и выражением `x.process`
- **THEN** каждый файл с нарушением назван с номером строки и ожидаемым правилом; файлы без нарушений не названы

### Requirement: Тесты проекта объявлены внутри describe
<!-- id: REQ-AR-002 -->

Тест структуры SHALL разбирать файлы `test/**/*.test.ts` и отклонять по правилу `test-outside-describe` вызов теста
`node:test`, который не находится лексически внутри функции, переданной вызову набора: отчёт junit `node:test`
помещает такой тест вне `<testsuite>`, и проверка `tests-passed` его не учитывает. Вызов теста — `test`, `it` и их
формы `.skip`, `.only`, `.todo`; вызов набора — `describe`, `suite` и их формы `.skip`, `.only`, `.todo`. Имена
распознаются по импорту из `node:test`: именованному, в том числе с переименованием (`import { test as t }`), по
умолчанию (`import t from "node:test"` — это `test`) и через пространство имён (`import * as nt` — `nt.test`,
`nt.describe`). Подтест `t.test(…)` через контекст теста — не вызов теста этого правила. Отказ SHALL называть файл и
строку вызова.

#### Scenario: Тест вне describe найден
<!-- id: SCN-AR-003 -->
- **WHEN** тест структуры запускается на фикстуре с файлом, где на верхнем уровне модуля стоят `test(…)`, `test.skip(…)`,
  `t2(…)` при `import { test as t2 } from "node:test"` и `nt.it(…)` при `import * as nt from "node:test"`, один
  `it(…)` — внутри обычной функции вне набора, а внутри наборов — `test(…)` в `describe(…)`, `it(…)` в `suite(…)`,
  `test(…)` в `describe.skip(…)` и подтест `t.test(…)` внутри `test(…)` в `describe(…)`; затем на каталоге `test/`
  проекта
- **THEN** на фикстуре найдены ровно пять нарушений — `test`, `test.skip`, `t2`, `nt.it` верхнего уровня и `it` вне
  набора — с номерами строк; в каталоге `test/` проекта нарушений нет
