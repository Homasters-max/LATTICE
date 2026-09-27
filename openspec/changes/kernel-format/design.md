# Design

## Context

Кода нет; стек — TypeScript / Node.js 22 (ESM), тесты — `node:test`, без фреймворков (design/04-architecture.md
AR-03). Check `tests-passed` запускает `node --experimental-strip-types --test` над `test/**/*.test.ts` с отчётом
junit, без сборки. Поведение — `specs/kernel/spec.md` и `specs/architecture/spec.md`; мотивация — proposal.md, Why.
Раскладка — design/04-architecture.md §6: `src/kernel/` — `types.ts`, `canonical.ts`, `hash.ts`, `ref.ts`, `ids.ts`,
`revision.ts`, `genesis.ts` (последний — не в этом Change).

## Goals / Non-Goals

**Goals:**
- Ядро без зависимостей: только собственные модули и `node:crypto` (тест структуры запрещает остальное).
- Детерминизм: все функции чистые; время и ULID — аргументы.
- Код исполняется Node без сборки: только стираемый синтаксис TypeScript.

**Non-Goals:**
- Производительность сверх линейной по размеру входа; потоковый разбор.

## Decisions

### D-1. Собственный разбор JSON-текста вместо `JSON.parse`

`JSON.parse` молча берёт последний из дублей ключа, не сообщает места отказа (JSON Pointer), не видит одиночных
суррогатов и падает `RangeError` на глубокой вложенности. Поэтому `checkInput` — собственный рекурсивный спуск по грамматике
RFC 8259 с явным счётчиком глубины: спуск прекращается на уровне 65 (`too-deep`) раньше, чем кончится стек. Строки
декодируются по escape-последовательностям, затем `String.prototype.normalize("NFC")`; одиночный суррогат ищется по
кодовым единицам до нормализации. Число: лексема по грамматике RFC 8259 → `Number(lexeme)`; `Object.is(x, -0)` →
`negative-zero`; `!Number.isFinite(x)` → `non-finite`; `Number.isInteger(x) && !Number.isSafeInteger(x)` →
`unsafe-integer`. Объекты результата — обычные (`Object.prototype`); члены задаются `Object.defineProperty`
(enumerable, writable, configurable), а не присваиванием: так ключ `__proto__` — собственное свойство, прототип не
меняется.

Отвергнуто:
- `JSON.parse` с reviver: дубли и запись числа не видны.
- Пакет-парсер (например `json-bigint`, `@streamparser/json`): ядру пакеты запрещены (REQ-AR-001).

### D-2. JCS — собственная реализация, около 60 строк

RFC 8785 для JavaScript сводится к: числа — `String(x)` для конечных (правило ECMAScript, `-0` → `"0"`), строки —
`JSON.stringify(s)` (в Node 22 одиночные суррогаты экранируются, но их отклоняет `not-json` раньше), ключи —
`Object.keys(o).sort()` (сравнение по кодовым единицам UTF-16 — порядок по умолчанию `Array.prototype.sort`),
массивы — по индексу. Обход с множеством посещённых объектов для отказа по циклу и путём JSON Pointer для `path`.
Векторы — фикстура `test/fixtures/jcs-vectors.json` из RFC 8785 §3.2.2, §3.2.3 и приложения B (числа заданы 16
hex-цифрами битов IEEE 754, в тесте — через `DataView`).

Отвергнуто:
- Пакет `canonicalize` (эталонная реализация автора RFC): зависимость ядра запрещена; векторы дают ту же гарантию.

### D-3. Хэш — `node:crypto`

`createHash("sha256").update(canonical, "utf8").digest("hex")`. `node:crypto` — единственный разрешённый ядру
встроенный модуль: он не делает ввода-вывода и детерминирован.

### D-4. Тип результата

`type Result<T> = { ok: true; value: T } | { ok: false; errors: Refusal[] }`, `type Refusal = { code: string; path:
string }` — в `src/kernel/types.ts`; коды — строковые литералы-объединения по функциям. `Id`, `Ref`, `Hash` — branded
types (04 §7). Исключения внутри ядра не бросаются; ошибка программиста (нарушенный инвариант самого ядра) не
перехватывается.

### D-5. Тест структуры — по AST TypeScript

`test/architecture/structure.test.ts` разбирает файлы через `ts.createSourceFile` (`typescript` — devDependency, в
ядре не используется) и обходит узлы: `ImportDeclaration`, `ExportDeclaration` с `moduleSpecifier`,
`CallExpression` с `ImportKeyword` или идентификатором `require`, идентификаторы `process`, `fetch`, `Deno`, `Bun` вне
объявлений. Для REQ-AR-002 — вызовы `test`/`it` и цепочка предков до `describe(…)`. Регулярные выражения отвергнуты:
не отличают код от строк и комментариев.

Фикстуры теста структуры — `test/fixtures/structure/**/*.fixture.ts`: расширение не попадает под `*.test.ts` (их не
запустит `node --test` и не проверит REQ-AR-002 проекта), каталог исключён из `tsconfig.json` (фикстуры импортируют
несуществующие модули нарочно).

### D-6. Заготовка проекта

- `package.json`: `"type": "module"`, `"engines": { "node": ">=22.6" }` (минимальная версия с
  `--experimental-strip-types`), `devDependencies`: `typescript` точной версией, `@types/node`; скрипты `test` (та же
  команда, что check `tests-passed`, без junit) и `typecheck` (`tsc --noEmit`). `package-lock.json` — в репозитории
  (workflow ставит зависимости `npm ci`).
- `tsconfig.json`: `strict`, `noEmit`, `module`/`moduleResolution` `nodenext`, `allowImportingTsExtensions`,
  `erasableSyntaxOnly` (запрещает `enum`, `namespace`, parameter properties — то, что `strip-types` не исполняет),
  `verbatimModuleSyntax`; `include`: `src`, `test`; `exclude`: `test/fixtures`.
- Импорты между файлами — с расширением `.ts`.

## Risks / Trade-offs

- `--experimental-strip-types` в Node 22 — экспериментальный флаг: предупреждение в stderr, возможная смена поведения
  в минорных версиях 22.x. Смягчение: `erasableSyntaxOnly` держит код в подмножестве, которое флаг исполняет; переход
  на Node 23.6+ убирает флаг без правки кода.
- Проверка типов `tsc --noEmit` не входит в check `tests-passed`; отдельный check — правка политики (`.warrant/local/
  checks/`), следующий factory-change Change. До него — задача в tasks.md и скрипт `npm run typecheck`.
- Guard запрещает прямой запуск команд с префиксом `node` (префикс check `tests-passed`); тесты — только через
  `warrant check kernel-format tests-passed`. Сужение префикса (`execution.guard_prefixes`) — тот же factory-change.

## Open Questions

Решения maintainer'а по `UNK-KR-001`…`UNK-KR-004` (proposal.md) определяют требования `REQ-KR-002` и `REQ-KR-005`;
текст spec написан по рекомендациям и правится, если решение иное.
