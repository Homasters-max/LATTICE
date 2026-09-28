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
- `import-outside-kernel` — статический `import`, `import type`, `export … from`, `import x = require(…)` или
  `import("…")` в позиции типа модуля, который не является файлом `*.ts` внутри корня проверяемого каталога, кроме
  спецификатора ровно `node:crypto` (`crypto`, `node:crypto/…`, пакеты, прочие встроенные модули и файлы с другим
  расширением — нарушение); импорт внутри корня решается по пути, существование файла не требуется; директива
  `/// <reference …>` — нарушение;
- `crypto-import` — импорт из `node:crypto` чего-либо, кроме именованного импорта значения `createHash` (в том числе с
  переименованием `import { createHash as h }`): импорт по умолчанию, пространства имён, без привязок, `import type`,
  реэкспорт и прочие имена (`randomBytes`, `randomUUID`, `getRandomValues`) — нарушение;
- `dynamic-import` — вызов `import(…)` или `require(…)`;
- `forbidden-global` — свободный идентификатор вне закрытого списка разрешённых (`UNK-KR-007`): `Object`, `Array`,
  `String`, `Number`, `Boolean`, `Symbol`, `BigInt`, `Math`, `JSON`, `Reflect`, `Map`, `Set`, `WeakMap`, `Error`,
  `TypeError`, `RangeError`, `ArrayBuffer`, `DataView`, `Uint8Array`, `Date`, `undefined`, `NaN`, `Infinity`
  (`Math` и `Date` — с ограничениями `nondeterminism`); выражение `import.meta`; расширение списка — только правкой
  этого требования;
- `nondeterminism` — свободный идентификатор `Date` где-либо, кроме закрытого перечня форм: `new Date(x)` ровно с
  одним аргументом, не spread и не строковым литералом, и только как объект доступа через точку к `toISOString`,
  `getTime`, `valueOf` или `getUTC…` сразу за ним (`new Date(x).toISOString()`); прочее — вызов `Date(…)`, `Date.now`,
  `new Date()`, `new Date(y, m, …)`, `new Date("…")`, `new Date(x)` в переменной или аргументе, передача `Date`
  значением (`Reflect.construct(Date, [])`) — нарушение; свободный идентификатор `Math` где-либо, кроме доступа через
  точку к точной функции `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.abs`, `Math.min`, `Math.max`, `Math.sign`
  (`Math.random`, `Math.sin`, `Math["random"]`, `const { random } = Math`, передача `Math` значением — нарушение);
  доступ к методу, зависящему от локали или часового пояса, по имени независимо от объекта, через точку или
  вычисляемым доступом `x["<имя>"]`: имя с префиксом `toLocale`, `localeCompare`, `getTimezoneOffset`,
  `toDateString`, `toTimeString`, местные геттеры и сеттеры `Date` — `getFullYear`, `getMonth`, `getDate`, `getDay`,
  `getHours`, `getMinutes`, `getSeconds`, `getMilliseconds`, `setFullYear`, `setMonth`, `setDate`, `setHours`,
  `setMinutes`, `setSeconds`, `setMilliseconds`, `getYear`, `setYear`.

Свободный идентификатор — идентификатор в позиции значения, не связанный ни в одной объемлющей области видимости файла
(модуль, функция, блок, класс, `catch`, параметры, импорты). Сокращённое свойство `{ process }` — ссылка на значение.
Имя свойства после точки, ключ литерала объекта (кроме сокращённого), имя члена класса, имя члена интерфейса или
типа, любая позиция типа и метка — не свободные идентификаторы. Амбиентные объявления (`declare …`, `declare global`,
`declare module`) имя в позиции значения не связывают; `arguments` — свободный идентификатор. Тест ловит случайное
нарушение, а не намеренный обход (`Object.constructor(…)`): от намеренного защищает ревью.

Сама проверка SHALL отказывать, если проверяемого каталога нет или в нём нет файлов `*.ts` (`no-kernel`, отказ
называет каталог), и на файле, разбор которого даёт синтаксическую ошибку TypeScript (`parse-error`, отказ называет
файл и строку первой диагностики; остальные файлы проверяются, их нарушения выдаются вместе). Прочие отказы теста
SHALL называть файл, строку и идентификатор правила. Проверка SHALL работать по разбору исходного текста, без исполнения проверяемых файлов.

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
  (`forbidden-global` — только строка в `g`); `new WebSocket("…")` (`forbidden-global`); `import.meta.url`
  (`forbidden-global`); `structuredClone(x)` (`forbidden-global`); `s.localeCompare(t)` (`nondeterminism`);
  `new Date(0).getHours()` (`nondeterminism`); `n.toLocaleString()` (`nondeterminism`); `Date.now()` (`nondeterminism`);
  `new Date(2026, 0, 1)` (`nondeterminism`); `new Date(0).setHours(1)` (`nondeterminism`); `String(new Date(0))`
  (`nondeterminism`); `new Date(0)["getHours"]()` (`nondeterminism`); `const d = new Date(0)` (`nondeterminism`);
  `Math.sin(1)` (`nondeterminism`); `declare const process: any; process.env.HOME` (`forbidden-global`);
  `arguments.length` (`forbidden-global`); `import fs = require("node:fs")` (`import-outside-kernel`);
  `let t: import("../ledger/types.ts").T` (`import-outside-kernel`); `/// <reference path="../x.ts" />`
  (`import-outside-kernel`); `new Date()` (`nondeterminism`);
  `Date(0)` (`nondeterminism`); `Reflect.construct(Date, [])` (`nondeterminism`); `Math.random()` (`nondeterminism`);
  `Math["random"]()` (`nondeterminism`); `const { random } = Math` (`nondeterminism`); и файлами без нарушений:
  импорт `{ createHash as h }` из `node:crypto` и `./hash.ts` с вызовом `new Date(0).toISOString()`,
  `Math.floor(1.5)`, `JSON.stringify(s)`, `Reflect.ownKeys(o)`, `Number.isSafeInteger(n)` и `new Map()`; файл в
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
(`import * as nt` — `nt.test`, `nt.describe`). Функция набора — функциональное выражение или стрелочная функция прямо в аргументе вызова
набора; функция, переданная ссылкой (`describe("x", body)`), — не функция набора. Имя, затенённое локальной
привязкой, — не вызов теста. Подтест `t.test(…)` через контекст теста — не вызов теста этого правила. Отказ SHALL называть файл и строку вызова.

#### Scenario: Тест вне describe найден
<!-- id: SCN-AR-003 -->
- **WHEN** тест структуры запускается на фикстуре с файлом, где на верхнем уровне модуля стоят `test(…)`, `test.skip(…)`,
  `t2(…)` при `import { test as t2 } from "node:test"` и `nt.it(…)` при `import * as nt from "node:test"`, один
  `it(…)` — внутри обычной функции вне набора, а внутри наборов — `test(…)` в `describe(…)`, `it(…)` в `suite(…)`,
  `test(…)` в `describe.skip(…)` и подтест `t.test(…)` внутри `test(…)` в `describe(…)`; `test(…)` внутри функции
  `body` уровня модуля при `describe("x", body)`; вызов `test()` внутри `function f(test) { … }`; затем на каталоге
  `test/` проекта
- **THEN** на фикстуре найдены ровно шесть нарушений — `test`, `test.skip`, `t2`, `nt.it` верхнего уровня, `it` вне
  набора и `test` в `body` — с номерами строк; в каталоге `test/` проекта нарушений нет
