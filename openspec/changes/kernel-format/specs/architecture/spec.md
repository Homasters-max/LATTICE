# Spec Delta

## Purpose

Правила структуры кода LATTICE, которые проверяет тест, а не ревью: направление импортов между частями системы,
границы ввода-вывода и форма тестов проекта (design/04-architecture.md §2, §3).

## ADDED Requirements

### Requirement: Ядро изолировано
<!-- id: REQ-AR-001 -->

Тест структуры SHALL разбирать файлы проверяемого каталога ядра рекурсивно, с подкаталогами: `src/kernel/` проекта
или каталога-фикстуры. Корень проверяемого каталога — граница ядра. Файл SHALL отклоняться по правилам:
- `non-ts-file` — файл каталога ядра, имя которого не оканчивается на `.ts`;
- `import-outside-kernel` — статический `import`, `import type` или `export … from` модуля, который не является файлом
  `*.ts` внутри корня проверяемого каталога, кроме спецификатора ровно `node:crypto` (`crypto`, `node:crypto/…`,
  пакеты, прочие встроенные модули и файлы с другим расширением — нарушение); импорт внутри корня решается по пути,
  существование файла не требуется;
- `crypto-import` — импорт из `node:crypto` чего-либо, кроме именованного импорта значения `createHash` (в том числе с
  переименованием `import { createHash as h }`): импорт по умолчанию, пространства имён, без привязок, `import type`,
  реэкспорт и прочие имена (`randomBytes`, `randomUUID`, `getRandomValues`) — нарушение;
- `dynamic-import` — вызов `import(…)` или `require(…)`;
- `forbidden-global` — свободный идентификатор `process`, `fetch`, `Deno`, `Bun`, `globalThis`, `global`, `window`,
  `self`, `performance`, `console`, `crypto`, `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `eval`,
  `Function`;
- `nondeterminism` — свободный идентификатор `Date` где-либо, кроме вызываемого выражения `new Date(x, …)` с первым
  аргументом не spread (вызов `Date(…)`, `Date.now`, `new Date()`, передача `Date` значением —
  `Reflect.construct(Date, [])` — нарушение); свободный идентификатор `Math` где-либо, кроме доступа к свойству через
  точку `Math.<имя>` с именем не `random` (`Math.random`, `Math["random"]`, `const { random } = Math`, передача `Math`
  значением — нарушение).

Свободный идентификатор — идентификатор в позиции значения, не связанный ни в одной объемлющей области видимости файла
(модуль, функция, блок, класс, `catch`, параметры, импорты). Сокращённое свойство `{ process }` — ссылка на значение.
Имя свойства после точки, ключ литерала объекта (кроме сокращённого), имя члена класса, имя члена интерфейса или
типа, любая позиция типа и метка — не свободные идентификаторы.

Сама проверка SHALL отказывать, если проверяемого каталога нет или в нём нет файлов `*.ts` (`no-kernel`), и на файле,
разбор которого даёт синтаксическую ошибку TypeScript (`parse-error`). Отказ теста SHALL называть файл, строку и
идентификатор правила. Проверка SHALL работать по разбору исходного текста, без исполнения проверяемых файлов.

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
  `sub/`, импортирующий `../../outside.ts` (`import-outside-kernel`); импорт `./helper.js` (`import-outside-kernel`);
  файл `helper.js` (`non-ts-file`); `import { randomUUID } from "node:crypto"` (`crypto-import`);
  `import "node:crypto"` (`crypto-import`); `export { createHash } from "node:crypto"` (`crypto-import`); вызов
  `import("./x.ts")` (`dynamic-import`); чтение `process.env.HOME` (`forbidden-global`); вызов `fetch("…")`
  (`forbidden-global`); `globalThis.x` (`forbidden-global`); `console.log(1)` (`forbidden-global`);
  `new Function("return 1")` (`forbidden-global`); `setTimeout(f, 0)` (`forbidden-global`); `({ process })`
  (`forbidden-global`); файл, где `function f(console) { return console }` и `function g() { return console }`
  (`forbidden-global` — только строка в `g`); `Date.now()` (`nondeterminism`); `new Date()` (`nondeterminism`);
  `Date(0)` (`nondeterminism`); `Reflect.construct(Date, [])` (`nondeterminism`); `Math.random()` (`nondeterminism`);
  `Math["random"]()` (`nondeterminism`); `const { random } = Math` (`nondeterminism`); и файлами без нарушений:
  импорт `{ createHash as h }` из `node:crypto` и `./hash.ts` с вызовом `new Date(0)` и `Math.floor(1.5)`; файл в
  подкаталоге `sub/`, импортирующий `../hash.ts`; файл с локальной `const process = 1`, её чтением и выражением
  `x.process`; файл с классом, у которого метод `process()`, с `interface X { console: number }` и
  `let f: Function`; затем тест структуры запускается на несуществующем каталоге и на каталоге с файлом
  `broken.ts` с синтаксической ошибкой
- **THEN** каждый файл с нарушением назван с номером строки и ожидаемым правилом; файлы без нарушений не названы;
  несуществующий каталог — отказ `no-kernel`, `broken.ts` — отказ `parse-error`

### Requirement: Тесты проекта объявлены внутри describe
<!-- id: REQ-AR-002 -->

Тест структуры SHALL разбирать файлы `test/**/*.test.ts` проекта или файлы фикстуры и отклонять по правилу
`test-outside-describe` вызов теста `node:test`, который не находится лексически внутри функции, переданной вызову
набора: отчёт junit `node:test` помещает такой тест вне `<testsuite>`, и проверка `tests-passed` его не учитывает.
Вызов теста — `test`, `it` и их формы `.skip`, `.only`, `.todo`; вызов набора — `describe`, `suite` и их формы
`.skip`, `.only`, `.todo`. Имена распознаются по импорту из `node:test`: именованному, в том числе с переименованием
(`import { test as t }`), по умолчанию (`import t from "node:test"` — это `test`) и через пространство имён
(`import * as nt` — `nt.test`, `nt.describe`). Подтест `t.test(…)` через контекст теста — не вызов теста этого
правила. Отказ SHALL называть файл и строку вызова.

#### Scenario: Тест вне describe найден
<!-- id: SCN-AR-003 -->
- **WHEN** тест структуры запускается на фикстуре с файлом, где на верхнем уровне модуля стоят `test(…)`, `test.skip(…)`,
  `t2(…)` при `import { test as t2 } from "node:test"` и `nt.it(…)` при `import * as nt from "node:test"`, один
  `it(…)` — внутри обычной функции вне набора, а внутри наборов — `test(…)` в `describe(…)`, `it(…)` в `suite(…)`,
  `test(…)` в `describe.skip(…)` и подтест `t.test(…)` внутри `test(…)` в `describe(…)`; затем на каталоге `test/`
  проекта
- **THEN** на фикстуре найдены ровно пять нарушений — `test`, `test.skip`, `t2`, `nt.it` верхнего уровня и `it` вне
  набора — с номерами строк; в каталоге `test/` проекта нарушений нет
