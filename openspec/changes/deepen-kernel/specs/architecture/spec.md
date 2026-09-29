# Spec Delta

## MODIFIED Requirements

### Requirement: Ядро изолировано
<!-- id: REQ-AR-001 -->

Тест структуры SHALL проверять дерево файлов — проект или каталог-фикстуру — по политике: данным, которые называют
перечень источников графа импортов, точку входа ядра и перечень периметра ядра. Точка входа — путь файла, перечни —
списки глобов; пути и глобы — относительно корня проверяемого дерева, с разделителем `/`; в глобе сегмент `**` — любое
число сегментов пути, в том числе ни одного, `*` — любая часть одного сегмента, прочие символы — буквально. Политика
проекта: источники `src/**`, точка входа `src/kernel/index.ts`, перечень периметра `src/kernel/**`; её правка — только
правкой этого требования. Файл периметра — файл дерева, путь которого подходит хотя бы под один глоб перечня периметра.
Каждый файл периметра SHALL отклоняться по правилам:
- `non-ts-file` — файл периметра, имя которого не оканчивается на `.ts`;
- `import-outside-kernel` — статический `import`, `import type`, `export … from`, `import x = require(…)` или
  `import("…")` в позиции типа модуля, который не является файлом `*.ts` периметра, кроме спецификатора ровно
  `node:crypto` (`crypto`, `node:crypto/…`, пакеты, прочие встроенные модули, файлы с другим расширением и файлы вне
  перечня периметра — нарушение); относительный спецификатор (`./`, `../`) решается по пути от файла, существование
  файла не требуется, путь вне корня дерева — вне периметра; директива `/// <reference …>` — нарушение;
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

Сама проверка SHALL отказывать кодом `no-kernel`, если корня дерева нет, если в периметре нет файлов `*.ts` (отказ
называет корень) или если нет файла точки входа (отказ называет точку входа); `no-kernel` — единственный отказ
проверки. На файле периметра или источника графа, разбор которого даёт синтаксическую ошибку TypeScript, проверка SHALL
отказывать кодом `parse-error` (отказ называет файл и строку первой диагностики; остальные файлы проверяются, их
нарушения выдаются вместе). Прочие отказы теста SHALL называть файл — путь относительно корня дерева, — строку и
идентификатор правила. Проверка SHALL работать по разбору исходного текста, без исполнения проверяемых файлов.

#### Scenario: Ядро проекта проходит тест структуры
<!-- id: SCN-AR-001 -->
- **WHEN** тест структуры запускается на проекте с политикой проекта (источники `src/**`, точка входа
  `src/kernel/index.ts`, перечень периметра `src/kernel/**`)
- **THEN** нарушений нет

#### Scenario: Нарушения ядра найдены
<!-- id: SCN-AR-002 -->
- **WHEN** тест структуры запускается на дереве-фикстуре ядра с политикой: источники и перечень периметра `**`, точка
  входа — файл без нарушений с импортом `{ createHash as h }` (ниже); в дереве файлы (ожидаемое правило — в скобках):
  импорт `node:fs` (`import-outside-kernel`); импорт `../ledger/commit.ts` (`import-outside-kernel`); импорт пакета
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
  `let f: Function`; затем тест структуры запускается с политикой того же вида на несуществующем корне и на дереве с
  файлом `broken.ts` с синтаксической ошибкой
- **THEN** каждый файл с нарушением назван с номером строки и ожидаемым правилом; файлы без нарушений не названы;
  несуществующий корень — отказ `no-kernel`, `broken.ts` — отказ `parse-error`

## ADDED Requirements

### Requirement: Периметр ядра — всё достижимое из точки входа
<!-- id: REQ-AR-003 -->

Тест структуры SHALL строить по разбору исходного текста, без исполнения, граф импортов дерева: ребро из файла ведёт в
путь, который даёт относительный спецификатор (`./`, `../`) статического `import`, `import type`, `export … from`,
`import x = require(…)` или `import("…")` в позиции типа; путь решается от файла, существование файла по нему не
требуется. `import type` и импорт в позиции типа — рёбра наравне с импортом значения. Не относительный спецификатор
(`node:*`, пакет), вызов `import(…)` или `require(…)` и директива `/// <reference …>` — не рёбра: их отклоняют правила
`REQ-AR-001`.

Достижимый файл — точка входа и каждый путь, в который ведёт ребро из достижимого файла периметра; рёбра из файлов вне
периметра не прослеживаются. Каждый достижимый файл SHALL лежать в перечне периметра, иначе — отказ
`outside-perimeter`:
- путь вне периметра, в который ведёт ребро из достижимого файла периметра, — отказ на каждое такое ребро с файлом и
  строкой импорта, который вывел за перечень;
- точка входа вне периметра — один отказ, называющий точку входа, со строкой 0.

Файл периметра, не достижимый из точки входа, этим правилом не отклоняется: его импорты проверяет `REQ-AR-001`.
Импорт из достижимого файла периметра в файл вне перечня SHALL давать оба отказа с одной строкой —
`import-outside-kernel` и `outside-perimeter`.

#### Scenario: Достижимое из точки входа вышло за перечень
<!-- id: SCN-AR-004 -->
- **WHEN** тест структуры запускается на дереве-фикстуре с политикой: источники `**`, точка входа `kernel/entry.ts`,
  перечень периметра `kernel/**`; `kernel/entry.ts` импортирует `./a.ts` и `import type` из `./types.ts`;
  `kernel/a.ts` импортирует `../outside/b.ts`; `kernel/types.ts` делает `import type` из `../outside/t.ts`;
  `kernel/orphan.ts`, который никто не импортирует, импортирует `../outside/c.ts`; `outside/b.ts` импортирует
  `./d.ts`
- **THEN** `kernel/a.ts` — отказы `import-outside-kernel` и `outside-perimeter` на строке импорта `../outside/b.ts`;
  `kernel/types.ts` — оба отказа на строке `import type`; `kernel/orphan.ts` — только `import-outside-kernel`;
  файлы `outside/*` не названы; других нарушений нет

#### Scenario: Точка входа отсутствует или вне перечня
<!-- id: SCN-AR-005 -->
- **WHEN** тест структуры запускается на дереве-фикстуре `SCN-AR-004` с точкой входа `kernel/missing.ts` (файла нет),
  затем — с точкой входа `outside/b.ts`
- **THEN** первый — единственный отказ проверки `no-kernel`, называющий `kernel/missing.ts`; второй — ровно один отказ
  `outside-perimeter` (файл `outside/b.ts`, строка 0) и те же отказы `import-outside-kernel`, что в `SCN-AR-004`;
  других нарушений нет

### Requirement: Нет циклов между файлами
<!-- id: REQ-AR-004 -->

Тест структуры SHALL по разбору исходного текста, без исполнения, отклонять циклы импортов между файлами: узлы графа —
существующие файлы `*.ts` дерева, пути которых подходят под перечень источников политики (у проекта — `src/**`), рёбра —
по `REQ-AR-003` (включая `import type` и импорт в позиции типа) между узлами. Цикл — путь по рёбрам из файла в него же,
в том числе импорт файлом самого себя.

Отказ `import-cycle` SHALL называть файл и строку импорта, который замыкает цикл, и определяться детерминированно:
обход в глубину начинается с файлов в порядке их путей относительно корня (по кодовым единицам UTF-16, разделитель
`/`), рёбра файла идут в порядке их позиций в тексте, повторно файл не обходится; импорт, ведущий в файл на текущем
пути обхода, замыкает цикл — один отказ на такой импорт. У каждого цикла хотя бы один импорт отклонён; граф без циклов
отказов `import-cycle` не даёт.

#### Scenario: Циклы из двух и трёх файлов найдены
<!-- id: SCN-AR-006 -->
- **WHEN** тест структуры запускается на дереве-фикстуре с политикой: источники `**`, точка входа и перечень периметра
  — `entry.ts` без импортов; `a.ts` импортирует `./b.ts`, `b.ts` — `./a.ts`; `c.ts` импортирует `./d.ts`, `d.ts` —
  `./e.ts`, `e.ts` — `./c.ts`; `t1.ts` делает `import type` из `./t2.ts`, `t2.ts` — из `./t1.ts`; `f.ts` импортирует
  `./g.ts` и `./h.ts`, `g.ts` — `./h.ts`
- **THEN** нарушения — ровно три отказа `import-cycle`: `b.ts` на строке импорта `./a.ts`, `e.ts` на строке импорта
  `./c.ts`, `t2.ts` на строке `import type` из `./t1.ts`; `f.ts`, `g.ts`, `h.ts` не названы

#### Scenario: В src/ проекта нет циклов
<!-- id: SCN-AR-007 -->
- **WHEN** тест структуры запускается на проекте с политикой проекта
- **THEN** отказов `import-cycle` нет
