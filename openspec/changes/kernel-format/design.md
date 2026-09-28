# Design

## Context

Кода нет; стек — TypeScript / Node.js 22 (ESM), тесты — `node:test`, без фреймворков (design/04-architecture.md
AR-03). Check `tests-passed` запускает `node --experimental-strip-types --test` над `test/**/*.test.ts` с отчётом
junit, без сборки. Поведение — `specs/kernel/spec.md` и `specs/architecture/spec.md`; мотивация — proposal.md, Why.
Раскладка — design/04-architecture.md §6: `src/kernel/` — `types.ts`, `canonical.ts`, `hash.ts`, `ref.ts`, `ids.ts`,
`revision.ts`, `genesis.ts` (последний — не в этом Change); точка входа `index.ts` реэкспортирует функции
(REQ-KR-001), `input.ts` — `checkInput`, `unicode16.ts` — таблица D-7.

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
RFC 8259 с явным счётчиком глубины: спуск прекращается на уровне 65 (`too-deep`) раньше, чем кончится стек. `syntax`
и `too-deep` — исключительная ситуация парсера: разбор обрывается, собранные отказы отбрасываются. Прочие отказы
копятся с позицией в тексте (смещение кодовой единицы) и в конце сортируются по ней; отказы уровня объекта
(`reserved-enc`, `bad-ref`) — с позицией первого ключа `$enc` / `$ref`, `bad-ref` решается по закрытии объекта.
Строки декодируются по escape-последовательностям; одиночный суррогат и неназначенная точка ищутся по кодовым
единицам и точкам декодированной строки, затем `String.prototype.normalize("NFC")`; проверки ссылок и дублей — по
форме после NFC. Отклонённый ключ в стек пути не кладётся. Число: лексема по
грамматике RFC 8259 → `Number(lexeme)`, затем первое совпадение: `Object.is(x, -0)` → `negative-zero`;
`!Number.isFinite(x)` → `non-finite`; `Number.isInteger(x) && !Number.isSafeInteger(x)` → `unsafe-integer`. Путь —
стек сегментов, ключ экранируется по RFC 6901 (`~` → `~0`, `/` → `~1`). Объекты результата — обычные
(`Object.prototype`); члены задаются `Object.defineProperty` (enumerable, writable, configurable), а не присваиванием:
так ключ `__proto__` — собственное свойство, прототип не меняется.

Отвергнуто:
- `JSON.parse` с reviver: дубли и запись числа не видны.
- Пакет-парсер (например `json-bigint`, `@streamparser/json`): ядру пакеты запрещены (REQ-AR-001).

### D-2. JCS — собственная реализация без рекурсии

Обход — явный стек кадров (объект, отсортированные ключи, индекс, сегмент пути), а не рекурсия: глубина значения из
кода не ограничена (REQ-KR-003, SCN-KR-024). При входе в объект — прототип, ключи-символы, затем все строковые ключи
по кодовым единицам с проверкой вида свойства. RFC 8785 для JavaScript сводится к: числа — `String(x)` для конечных (правило ECMAScript, `-0` → `"0"`), строки —
`JSON.stringify(s)` (в Node 22 одиночные суррогаты экранируются, но их отклоняет `not-json` раньше), ключи —
`Object.keys(o).sort()` (сравнение по кодовым единицам UTF-16 — порядок по умолчанию `Array.prototype.sort`),
массивы — по индексу. Свойства читаются только через `Reflect.ownKeys` и `Object.getOwnPropertyDescriptor`: геттер
не вызывается, аксессор, неперечислимое свойство, ключ-символ и лишнее свойство массива — `not-json`. Цикл — объект
из стека текущего пути (добавляется при входе, снимается при выходе): общий подобъект не цикл. Тот же обход — у
`refsOf`: `not-json` обрывает его, отказ `bad-ref` объекта — при входе в объект. Proxy ядро не распознаёт (для этого нужен `node:util`): ловушки Proxy — код вызывающего, вне гарантии
чистоты.

Векторы — фикстура `test/fixtures/jcs-vectors.json` из RFC 8785 §3.2.2, §3.2.3 и приложения B с указанием раздела
(числа заданы 16 hex-цифрами битов IEEE 754, в тесте — через `DataView`), подаются в `canonical` напрямую.

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
ядре не используется) и обходит узлы: `ImportDeclaration`, `ExportDeclaration` с `moduleSpecifier` (относительный
путь разрешается от файла и сравнивается с корнем проверяемого каталога, расширение — `.ts`), `ImportClause` из
`node:crypto`, `CallExpression` с `ImportKeyword` или идентификатором `require`, свободные `Identifier` против
закрытого списка разрешённых имён (`UNK-KR-007`), `MetaProperty` `import.meta`, вызовы методов по имени (`toLocale*`,
`localeCompare`, локальные геттеры `Date`),
употребления `Date` и `Math` (родитель узла решает: `new Date(x)`, `Math.<имя>` через точку). Свободный
идентификатор — по областям видимости: обход держит стек областей (модуль, функция, блок, класс, `catch`) с
объявленными в них именами (с подъёмом `var` и объявлений функций к функции); идентификатор в позиции значения, не
найденный в стеке, — свободный. Позиции не-значений (имя свойства после точки, ключ литерала кроме сокращённого, член
класса, член интерфейса и типа, узлы типов, метки) обход пропускает. `parseDiagnostics` исходного файла непусты —
`parse-error`. Правила называются идентификаторами spec (`non-ts-file`, `import-outside-kernel`, `crypto-import`,
`dynamic-import`, `forbidden-global`, `nondeterminism`, `no-kernel`, `parse-error`, `test-outside-describe`). Для REQ-AR-002 — привязки импорта из `node:test` (именованные с
переименованием, по умолчанию, пространство имён), вызовы теста с формами `.skip`/`.only`/`.todo` и цепочка
предков до функции-аргумента вызова набора. Регулярные выражения отвергнуты: не отличают код от строк и комментариев.

Фикстуры теста структуры — `test/fixtures/structure/**/*.fixture.ts` (и `helper.js` для `non-ts-file`): расширение
не попадает под `*.test.ts` (их не запустит `node --test` и не проверит REQ-AR-002 проекта), каталог исключён из
`tsconfig.json` (фикстуры импортируют несуществующие модули нарочно). Правило REQ-AR-002 тест применяет к списку
файлов — `test/**/*.test.ts` проекта или файлам фикстуры.

### D-6. Заготовка проекта

- `package.json`: `"type": "module"`, `"engines": { "node": ">=22.17" }` (`--experimental-strip-types` — с 22.6;
  Unicode 16.0 в ICU проверен на 22.17, D-7), `devDependencies`: `typescript` точной версией, `@types/node`; скрипты `test` (та же
  команда, что check `tests-passed`, без junit) и `typecheck` (`tsc --noEmit`). `package-lock.json` — в репозитории
  (workflow ставит зависимости `npm ci`).
- `tsconfig.json`: `strict`, `noEmit`, `module`/`moduleResolution` `nodenext`, `allowImportingTsExtensions`,
  `erasableSyntaxOnly` (запрещает `enum`, `namespace`, parameter properties — то, что `strip-types` не исполняет),
  `verbatimModuleSyntax`; `include`: `src`, `test`; `exclude`: `test/fixtures`.
- Импорты между файлами — с расширением `.ts`.

### D-7. Unicode 16.0 — таблица в ядре (`UNK-KR-005`)

`\p{Cn}` в регулярном выражении и `normalize` берут версию Unicode движка — поэтому ядро не проверяет назначенность
через движок. `src/kernel/unicode16.ts` — отсортированный массив диапазонов `[начало, конец]` назначенных кодовых точек
Unicode 16.0 (дополнение `Cn`, суррогаты — отдельный код), поиск — двоичный. Таблица генерируется один раз из
`\p{Cn}` на Node с `process.versions.unicode` `16.0` и коммитится как исходный код; тест таблицы на такой же среде
сверяет её с `\p{Cn}` по всем кодовым точкам, на другой версии — пропуск с причиной (`skip`).

NFC назначенных точек Unicode 16.0 не меняется в следующих версиях (политика стабильности нормализации), поэтому
Node с Unicode 16.0 и новее даёт те же байты; нижняя граница — предусловие формата (`UNK-KR-006`): `engines` (D-6)
и тест среды `test/kernel/environment.test.ts` (SCN-KR-025) проверяет `process.versions.unicode` ≥ 16.0 — тест, не
ядро (ядру `process` запрещён). Отвергнуто: собственные таблицы NFC в ядре — десятки КБ данных и алгоритм ради среды,
которую проект и так закрепляет; проба нормализации в `checkInput` — эвристика.

Отвергнуто:
- Разбор UCD `DerivedGeneralCategory.txt` 16.0: загрузка файла — ввод-вывод вне ядра и сети CI; `\p{Cn}` Node 22.17 —
  тот же источник (ICU 77.1, Unicode 16.0), проверяемый тестом.

## Risks / Trade-offs

- `--experimental-strip-types` в Node 22 — экспериментальный флаг: предупреждение в stderr, возможная смена поведения
  в минорных версиях 22.x. Смягчение: `erasableSyntaxOnly` держит код в подмножестве, которое флаг исполняет; переход
  на Node 23.6+ убирает флаг без правки кода.
- Проверка типов `tsc --noEmit` не входит в check `tests-passed`; отдельный check — правка политики (`.warrant/local/
  checks/`), следующий factory-change Change. До него — задача в tasks.md и скрипт `npm run typecheck`.
- Guard запрещает прямой запуск команд с префиксом `node` (префикс check `tests-passed`); тесты — только через
  `warrant check kernel-format tests-passed`. Сужение префикса (`execution.guard_prefixes`) — тот же factory-change.

## Расхождения с design/domains/10-kernel.md

design/ заморожен; норма формата v1 — spec этого Change. Решения `UNK-KR-001`…`UNK-KR-004` уточняют 10-kernel
(review 1 F-22): п. 3 — целые вне ±(2^53−1) включительно, а не «вне ±2^53»; NFC и ключей объектов; предел
вложенности 64; п. 4 — хвост зарезервированной схемы `#label:` — `[0-9a-f]+`. Решение `UNK-KR-005` (review 2
F-26): версия Unicode 16.0 — часть формата v1, отказ `unassigned` дополняет входную проверку п. 3.

## Решения по review 1

Review 1 (EVID-01M3JHV12SMRHDT34WPQXC7QE3, `NOT_PROVEN`) — правкой spec, по рекомендациям находок:

| Находка | Решение | Где |
|---|---|---|
| F-1 | `too-deep`, как `syntax`, прекращает разбор и единственный; раньше по тексту — тот и возвращается | REQ-KR-002, SCN-KR-016 |
| F-2 | Код числа — по ближайшему double, один на число: `negative-zero` > `non-finite` > `unsafe-integer` | REQ-KR-002, SCN-KR-003 |
| F-3 | У каждого кода `path` и позиция; ключ с суррогатом — `path` объекта; проверка внутри отклонённых поддеревьев | REQ-KR-002, SCN-KR-017 |
| F-4, F-21 | Проверки и пути — после NFC; `lone-surrogate` — по кодовым единицам после декодирования | REQ-KR-002, SCN-KR-018 |
| F-5 | `UNK-KR-005` — решение maintainer'а: Unicode 16.0, отказ `unassigned` | REQ-KR-002, SCN-KR-023, D-7 |
| F-6 | У `refsOf` отказы `not-json`, `bad-ref` | REQ-KR-006, SCN-KR-022 |
| F-7, F-14, F-16 | Вход с несколькими параметрами — объект имён; неверный тип — код параметра; отказы всех параметров по порядку; `revision`: `bad-input`, `bad-body` | REQ-KR-001, REQ-KR-004, REQ-KR-007, SCN-KR-020, SCN-KR-021 |
| F-8, F-9, F-10 | Обход в порядке канонических ключей; цикл — только на текущем пути; только собственные перечислимые свойства-данные | REQ-KR-003, SCN-KR-019, D-2 |
| F-11, F-12 | Правила изоляции ядра с идентификаторами; `node:crypto` — только `createHash`; граница — корень, рекурсивно | REQ-AR-001, SCN-AR-002, D-5 |
| F-13 | Формы вызова теста и набора, синонимы, переименованный импорт | REQ-AR-002, SCN-AR-003 |
| F-15 | Хвост `#label:` — `[0-9a-f]+`; `reserved-scheme` в `formatRef` и `revision` | REQ-KR-005, REQ-KR-007, SCN-KR-011, SCN-KR-015 |
| F-17 | Граничные векторы: `local` из 128 символов, все ожидания `parseRef`, `~0`/`~1`, `acme.`, `acme..tools` | SCN-KR-010, SCN-KR-011, SCN-KR-017 |
| F-18 | Литеральный хэш и `valueId` | SCN-KR-008 |
| F-19 | `body` ревизии — та же ссылка, ревизия не заморожена | REQ-KR-007, SCN-KR-014 |
| F-20 | Чистота — все функции, все входы сценариев | SCN-KR-001 |
| F-22 | Расхождения с 10-kernel записаны | этот design |
| F-23 | Место фикстуры — в design | SCN-KR-006, D-2 |
| F-24 | `canonical` шире входной проверки | REQ-KR-003 |

## Решения по review 2

Review 2 (EVID-01M3KNFKZ2PE3AEHC569ZTF3B7, `PROVEN`: MAJOR 13, MINOR 11, INFO 3) — раунд 3 правкой spec по решению
maintainer'а; D-1, D-2 reviewer'а и F-27 — `UNK-KR-006`…`UNK-KR-008`.

| Находка | Решение | Где |
|---|---|---|
| F-1 | Unicode ≥ 16.0 — предусловие формата, тест среды (`UNK-KR-006`) | REQ-KR-002, SCN-KR-025, D-7 |
| F-2 | `unassigned` — до NFC, как `lone-surrogate` | REQ-KR-002 |
| F-3 | `canonical`, `refsOf` — любая глубина, обход без рекурсии | REQ-KR-003, SCN-KR-024, D-2 |
| F-4 | Proxy — вне гарантий чистоты | REQ-KR-001 |
| F-5, F-6 | `refsOf`: строка `$ref` без NFC; `not-json` единственный; отказ объекта до членов | REQ-KR-006, SCN-KR-022 |
| F-7 | Порядок проверок при входе в объект и массив | REQ-KR-003, SCN-KR-019 |
| F-8, F-21 | `reserved-scheme` — где допустим `value-id`, при любом `@…`; метка вне `[g-z]…` — `bad-ref` | REQ-KR-005, SCN-KR-009, SCN-KR-011, SCN-KR-015 |
| F-9, F-19, F-24 | `revision`: `bad-input` вместо полей, `at` — как обычно; поля — свойства-данные; порядок ключей | REQ-KR-007, SCN-KR-014, SCN-KR-015, SCN-KR-020 |
| F-10, F-11, F-14 | `Date`, `Math` — узкие формы; свободный идентификатор по областям видимости, только позиции значений | REQ-AR-001, SCN-AR-002, D-5 |
| F-12 | Закрытый список разрешённых имён, `import.meta`, методы локали (`UNK-KR-007`) | REQ-AR-001, SCN-AR-002 |
| F-13, F-15, F-16 | `non-ts-file`; `no-kernel`, `parse-error`; границы `crypto-import` | REQ-AR-001, SCN-AR-002 |
| F-17 | Правило describe — на тестах проекта или файлах фикстуры | REQ-AR-002, D-5 |
| F-18 | Входы своих сценариев; снимок по дескрипторам | SCN-KR-001 |
| F-20, F-22 | Дубль на каждый повтор; `bad-ref` по первому `$ref`; отклонённый ключ не входит в `path` | REQ-KR-002, SCN-KR-017 |
| F-23 | Точка входа `src/kernel/index.ts` | REQ-KR-001 |
| F-25 | Векторы сценариев — норма формата v1 | REQ-KR-001 |
| F-26 | UNK-KR-005 в расхождениях с 10-kernel | этот design |
| F-27 | `namespace` ≤ 64 символов (`UNK-KR-008`) | REQ-KR-005, SCN-KR-010, SCN-KR-011, SCN-KR-012 |
| P-1 | Задача 3.2 отделена от 3.1 | tasks.md |

## Open Questions

Нет. `UNK-KR-001`…`UNK-KR-004` решены maintainer'ом по рекомендациям (proposal.md); `UNK-KR-005` — вариант A по
рекомендации ([PR #2](https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5866978072)): формат v1 фиксирует
Unicode 16.0, неназначенные в нём кодовые точки — отказ `unassigned`; `UNK-KR-006`…`UNK-KR-008` — вариант A по
рекомендации ([PR #2](https://github.com/Homasters-max/LATTICE/pull/2#issuecomment-5867393215)). Spec им
соответствует.
