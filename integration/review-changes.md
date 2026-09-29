# Итоги разбора для внедрения — design v0.5.1 → v0.6

Источник: [architecture-review-2026-09-29.md](architecture-review-2026-09-29.md) (11 кандидатов и два пункта «исправить до S1»). Этот файл — тот же отчёт, разложенный в формат, который читает `ledger.mjs init`: кандидат — сквозная тема `T-n`, его части по доменам — пункты `И`, развилка — `ADR-n`, противоречие — `П-n`. Решения здесь — рекомендации отчёта, не норма.

Нумерация (S0 Q6): темы — с `T-17`, противоречия — с `П-33` (до них — ID v0.4), пункты — `<файл>/И-101…` (номера v0.4 до И-34 остаются в «Почему» дизайна), ADR-кандидат — номер будущего файла, с `ADR-38`; кандидат 11 темы не имеет.

## Сквозные темы

| ID | Тема | Файлы | Опора | Сила | Рекомендация | Откат |
|---|---|---|---|---|---|---|
| T-17 | Коммит — один глубокий модуль | 10-kernel, 11-identity-grain, 12-ledger, 13-rules, 15-catalog, 02-glossary | отчёт §1 | Strong | `commit(batch)` с размеченным пакетом `author` / `copy` / `genesis`; реестр проверок; намерения `ensure` / `merge` / `split` внутри `author` | дорого после S1: форма входа коммита — у CLI, импорта, `init`, обновления `std` |
| T-18 | Вид проверки — шов с тремя адаптерами | 12-ledger, 13-rules, 04-architecture | отчёт §2 | Strong | `CheckView` у rules ровно с чтениями 04 §1; адаптеры: индекс на `seq`, `overlay`, `fromRows()` | дёшево до кода проверок S1 |
| T-19 | Полномочия участника на `seq` | 10-kernel, 13-rules, 14-trust, 15-catalog, 20-lens, 22-run, 23-bench, 30-adapters, 04-architecture | отчёт §3 | Strong | проекция `authority` в слое ядра; `classify(session@seq)` в интерфейсе trust — единственный читатель `purpose` вне ядра | проекция ядра — только версией ядра (ADR-34) |
| T-20 | Корень сборки с фазами и порт хода | 04-architecture, 22-run, 30-adapters | отчёт §4 | Strong | `assemble` с названными фазами отказов; фиктивная `setup` для `init`; порт `Progress`; `run()` → `pack` или `pending` | дёшево до S0 |
| T-21 | Кортеж исполнения — один модуль | 13-rules, 22-run, 23-bench, 30-adapters, 02-glossary | отчёт §5 | Strong | `countedRun` в замороженных проверках; `run/tuple`; `code` — из манифеста хэшей модулей | зерно `code` — до S0: от него `impl.pins` в `std`-JSON |
| T-22 | Замороженное ядро — одна точка входа | 04-architecture, 10-kernel, 11-identity-grain, 12-ledger | отчёт §6 | Worth exploring | `kernel-v1 = {kernel, genesis, checks, primitives, projections}`; тест структуры — на всё достижимое | дёшево: каталоги ADR-32 на месте |
| T-23 | Replay — записанные адаптеры портов | 20-lens, 22-run, 30-adapters | отчёт §7 | Worth exploring | replay = интерпретатор с `Deps` из записанных адаптеров; сквозное поведение порта — в одной обёртке | до S5 |
| T-24 | LENS целиком — один модуль, шов оценщика | 13-rules, 20-lens, 21-compose, 22-run | отчёт §8 | Worth exploring | `lens.retrieve` — одна стадия; шов `Scorer`; `CalibratedThreshold` | до S5; огрубляет LN-03 |
| T-25 | Потребность → решение: явный автомат и замкнутый мир | 21-compose, 22-run | отчёт §9 | Worth exploring | `solveNeed` держит переходы явно; `ClosedWorld` — одна проверка для вызова, вердикта и `materialize` | YAGNI до S6 |
| T-26 | Происхождение голоса и «в силе ли факт» | 10-kernel, 12-ledger, 14-trust, 20-lens, 22-run | отчёт §10 | Worth exploring | автор голоса = `via ?? by`; `inForce`, `standing` в интерфейсе trust; проверка политики — при `open()` | до S3 |

## Изменения по доменам

Колонки: ID · изменение · опора (раздел отчёта) · места в дизайне · вид · тема · зависит от.

### 02-glossary

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 02-glossary/И-101 | термины пакета коммита: пакет (batch), виды `author` / `copy` / `genesis`, намерение (`ensure` / `merge` / `split`), реестр проверок; занятость имён — `grep` глоссария | отчёт §1 | `design/02-glossary.md` | новый термин | T-17 | ADR-38 |
| 02-glossary/И-102 | «засчитанный прогон кортежа» (T139) — одно определение, ссылка на `countedRun`; «манифест кода» — термин | отчёт §5 | `design/02-glossary.md` | термин | T-21 | ADR-42 |

### 04-architecture

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 04-architecture/И-101 | исключение AR-06 (`rules/types → ledger/types`) уточняется: контракт `CheckView` у потребителя (rules), ledger даёт адаптер `overlay` | отчёт §2 ADR | `design/04-architecture.md` | правка решения | T-18 | ADR-39 |
| 04-architecture/И-102 | перечень чтений ядра (§1, ADR-35) + проекция `authority`; читатель `purpose` — не только гейт (см. П-35) | отчёт §3 ADR | `design/04-architecture.md` | правка перечня | T-19 | ADR-40 |
| 04-architecture/И-103 | корень сборки (§4): `assemble(config, env, store) → {deps, refusals}`, фазы схема · открытие · `setup` · привязки; §6 выравнивается под ADR-28 (см. П-36) | отчёт §4 | `design/04-architecture.md` | новый интерфейс | T-20 | ADR-41 |
| 04-architecture/И-104 | `kernel-v1` — одна версионированная точка входа замороженного ядра; тест структуры (§3) распространяет чистоту на достижимое из неё; маркер коммита берёт `kernel` отсюда; AR-12 | отчёт §6 | `design/04-architecture.md` | новый интерфейс | T-22 | ADR-43 |

### 10-kernel

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 10-kernel/И-101 | «Когда запись — no-op» (§1), KR-03 и генезис KR-16 — через `commit` с пакетом `genesis {delta}`; инвариант 12 — по виду пакета (источнику строки), не по `key` | отчёт §1 | `design/domains/10-kernel.md` | правка модели | T-17 | ADR-38 |
| 10-kernel/И-102 | проекция `authority` в слое ядра: `principal(session, seq)`, `mayWrite(row, view)` — одна модель прав (§7 `writers`, `target`, KR-13), включая CT-14 | отчёт §3 | `design/domains/10-kernel.md` | новый интерфейс | T-19 | ADR-40 |
| 10-kernel/И-103 | периметр ядра (§8, KR-11) ссылается на точку входа `kernel-v1` | отчёт §6 | `design/domains/10-kernel.md` | ссылка | T-22 | ADR-43 |
| 10-kernel/И-104 | `inForce {basis}` (KR-13) — вычислитель в trust; порядок `basis` — в одном месте (сейчас 10 §7 и 14 §3) | отчёт §10 | `design/domains/10-kernel.md` | владелец | T-26 | ADR-47 |

### 11-identity-grain

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 11-identity-grain/И-101 | `ensure` / `merge` / `split` — намерения внутри пакета `author`, не отдельно вызываемые операции; identity — чистые функции `grainKey`, замыкание алиасов, отчёт `regrain` (GR-11, GR-16) | отчёт §1 | `design/domains/11-identity-grain.md` | правка операций | T-17 | ADR-38 |
| 11-identity-grain/И-102 | проекции `grain` и `aliases` кодируют семантику identity (GR-02, GR-05), а лежат в ledger — достижимы из `kernel-v1`, владелец смысла — 11 | отчёт §6 | `design/domains/11-identity-grain.md` | владелец | T-22 | ADR-43 |

### 12-ledger

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 12-ledger/И-101 | `commit(batch) → {ok, ids, commit} / {violations} / {differs} / locked`; `batch = author {drafts, by, intents} / copy {rows, signer} / genesis {delta}`; меняет форму LG-05 и `Draft` (§5) | отчёт §1 | `design/domains/12-ledger.md` | новый интерфейс | T-17 | ADR-38 |
| 12-ledger/И-102 | шаги 0–6 (§2) и строка «относительные проверки» — выводятся из реестра проверок или удаляются; no-op по `(type@n, hash)`, заголовки и ключ идемпотентности, CAS хвоста (ADR-31), маркер `core/commit` — внутри `commit` (LG-03, LG-17, LG-20) | отчёт §1 | `design/domains/12-ledger.md` | правка модели | T-17 | ADR-38 |
| 12-ledger/И-103 | адаптер `overlay(ix, rows).at(i)` / `.total()` — умозрительный вид «индекс + незакоммиченные строки» на префиксе или итоге; `LedgerView` остаётся портом стадий; copy-on-write проекций — у overlay | отчёт §2 | `design/domains/12-ledger.md` | новый интерфейс | T-18 | ADR-39 |
| 12-ledger/И-104 | проекции (§3: `revisions`, `latest`, `grain`, `aliases`, `facts`, `executions`) достижимы из `kernel-v1` и охраняются тестом структуры | отчёт §6 | `design/domains/12-ledger.md` | ссылка | T-22 | ADR-43 |
| 12-ledger/И-105 | проекция `facts` (§3) не отвечает «в силе ли факт»; результат trust не зависит от порядка разделов индекса | отчёт §10 | `design/domains/12-ledger.md` | правка модели | T-26 | ADR-47 |

### 13-rules

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 13-rules/И-101 | реестр проверок `{name, scope: row/commit, phase: write/publish-type/publish-rule, appliesTo}`; таблица §2 и «Префикс или итог» (RL-16, RL-17) — из реестра; `validate(rows, state)` — не отдельный интерфейс; исключения RL-16 — по виду пакета | отчёт §1 | `design/domains/13-rules.md` | новый интерфейс | T-17 | ADR-38 |
| 13-rules/И-102 | `CheckView` — контракт у rules (ADR-24) ровно с чтениями 04 §1 (ADR-35); `fromRows()` для `examples` (RL-10) и тестов | отчёт §2 | `design/domains/13-rules.md` | новый интерфейс | T-18 | ADR-39 |
| 13-rules/И-103 | проверка `owner` — через `authority`; CT-14 (`edit` не действует на `refs: follow`) — в строке `owner` §2; `declare` у не-человека отсекается при записи | отчёт §3 | `design/domains/13-rules.md` | правка проверки | T-19 | ADR-40 |
| 13-rules/И-104 | `countedRun(view, tuple)` — одна чистая функция T139 в `rules/kernel-checks`; `learning-gate` (RL-18) читает её | отчёт §5 | `design/domains/13-rules.md` | новый интерфейс | T-21 | ADR-42 |
| 13-rules/И-105 | способность (§3) объявляет калиброванные параметры (`CalibratedThreshold`) | отчёт §8 | `design/domains/13-rules.md` | правка модели | T-24 | ADR-45 |

### 14-trust

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 14-trust/И-101 | `classify(session@seq) → {group, feedsTrust, teaches, countsInWindow}` в интерфейсе trust; группа независимости (TR-16, ADR-26) — в интерфейсе (TR-11, TR-12, TR-13) | отчёт §3 | `design/domains/14-trust.md` | новый интерфейс | T-19 | ADR-40 |
| 14-trust/И-102 | автор голоса = `via ?? by`; решающий голос — явный `core/assert` без `via`; trust не знает `std/learned-assert` (§3, TR-07, TR-17, инварианты 3–4) | отчёт §10 | `design/domains/14-trust.md` | правка модели | T-26 | ADR-47 |
| 14-trust/И-103 | интерфейс trust += `inForce(fact)`, `standing(target)` | отчёт §10 | `design/domains/14-trust.md` | новый интерфейс | T-26 | ADR-47 |
| 14-trust/И-104 | проверка политики — при `open()` (место отказа ADR-35 п. 2); голос хранит признаки на своём `seq` — смена политики перевзвешивает, не прогоняет журнал | отчёт §10 | `design/domains/14-trust.md` | правка модели | T-26 | ADR-47 |

### 15-catalog

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 15-catalog/И-101 | копия `std` (CT-10) — пакет `copy {rows, signer}` сохраняет заголовок поставщика | отчёт §1 | `design/domains/15-catalog.md` | правка операции | T-17 | ADR-38 |
| 15-catalog/И-102 | владелец модели прав: понятие — catalog (04 §8), исполнитель — `authority` в ядре; CT-03, CT-13, CT-14, CT-15 ссылаются на `authority` | отчёт §3 | `design/domains/15-catalog.md` | владелец | T-19 | ADR-40 |
| 15-catalog/И-103 | catalog мелкий: `publish`, `grant`, `deprecate`, `retire` — сборка строк; глубина — `update(package)`, `migrate`, `transfer`; `queue(namespace)` (CT-17) — в `cli/` из чистых `pending(ns, seq)` доменов | отчёт §11 | `design/domains/15-catalog.md` | упрощение | — | — |

### 20-lens

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 20-lens/И-101 | подсказки читают `classify`, не свой список `purpose` | отчёт §3 | `design/domains/20-lens.md` | ссылка | T-19 | ADR-40 |
| 20-lens/И-102 | ключ кэша judge `(adapter, model, prompt_hash, state_hash, norm, card)` (LN-08) и проверка LN-18 — в обёртке `Recording`, не в каждом адаптере; один механизм записи judge | отчёт §7 | `design/domains/20-lens.md` | правка модели | T-23 | ADR-44 |
| 20-lens/И-103 | `lens.retrieve(need, scope, deps) → LensOutput` — одна стадия; параметры; внутренний шов `Scorer` (bm25, judge); `bm25.doc` — отдельная стадия базовой линии; огрубляет LN-03 | отчёт §8 | `design/domains/20-lens.md` | новый интерфейс | T-24 | ADR-45 |
| 20-lens/И-104 | `CalibratedThreshold {value, for, call, onMismatch}` — одно значение вместо трёх мест `calibrated_for` | отчёт §8 | `design/domains/20-lens.md` | правка модели | T-24 | ADR-45 |
| 20-lens/И-105 | LN-10 — lens читает `inForce`, не выводит «подсказка ≥ `observed`» сам | отчёт §10 | `design/domains/20-lens.md` | ссылка | T-26 | ADR-47 |

### 21-compose

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 21-compose/И-101 | калибровка `recall` (§3) — через `CalibratedThreshold` | отчёт §8 | `design/domains/21-compose.md` | ссылка | T-24 | ADR-45 |
| 21-compose/И-102 | `solveNeed(need, deps) → {rows, solution, outcome, notes}` — явный автомат fresh / stale / broken / empty; конвейер `frame → solveNeed → deliver` (§3, §4, CP-20) | отчёт §9 | `design/domains/21-compose.md` | новый интерфейс | T-25 | ADR-46 |
| 21-compose/И-103 | `ClosedWorld` (`fromCandidates`, `live(view, scope, seq)`, `verifyQuote`, `checkSelection`) — одна проверка для вызова, вердикта и `materialize` (§5, CP-06, CP-08, CP-24, ADR-36) | отчёт §9 | `design/domains/21-compose.md` | новый интерфейс | T-25 | ADR-46 |

### 22-run

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 22-run/И-101 | окно удаления (§6) читает `classify`, не свой список `purpose` | отчёт §3 | `design/domains/22-run.md` | ссылка | T-19 | ADR-40 |
| 22-run/И-102 | порт `Progress` (begin · step · park · abandoned · end) с адаптерами fs и memory вместо `.lattice/runs/<id>.log`; RN-11, RN-12, RN-37 — на фиксированных часах | отчёт §4 | `design/domains/22-run.md` | новый порт | T-20 | ADR-41 |
| 22-run/И-103 | `run() → {pack} / {pending, task}`; `Stage → Promise<Ctx>` против `Composer.run` с `{pending}` | отчёт §4 | `design/domains/22-run.md` | правка интерфейса | T-20 | ADR-41 |
| 22-run/И-104 | `env` передаёт корень сборки, не процесс (T155) | отчёт §4 | `design/domains/22-run.md` | правка модели | T-20 | ADR-41 |
| 22-run/И-105 | `answers/` ключуется по `(kind, хэш входа)`, не по кортежу — ревизия `setup` между `pending` и `answer` переиграет старый ответ; фикстуры `composer-fixture` — ключ по виду и смыслу | отчёт §4 ADR | `design/domains/22-run.md`, `design/domains/30-adapters.md` | дефект | T-20 | — |
| 22-run/И-106 | `run/tuple` — `capture` · `startRefusals` · `matches`; одна табличная проверка отказов старта (§1 T131, RN-20, RN-24; §3 RN-10, RN-32; §6 RN-34; §7 `code-changed`) | отчёт §5 | `design/domains/22-run.md` | новый интерфейс | T-21 | ADR-42 |
| 22-run/И-107 | зерно `code` — хэши модулей из манифеста сборки (см. П-37) | отчёт §5 | `design/domains/22-run.md` | решение | T-21 | ADR-42 |
| 22-run/И-108 | replay = интерпретатор с `Deps` из записанных адаптеров `recorded(execution)` (§7 replay; §3 `Meta`, `Ident`, `calls`) | отчёт §7 | `design/domains/22-run.md` | правка модели | T-23 | ADR-44 |
| 22-run/И-109 | интерпретатор не знает имён стадий (`threshold` → `score`, `recall` → `verify`); обобщённая сверка калибровки (RN-10, RN-35) | отчёт §8 | `design/domains/22-run.md` | правка модели | T-24 | ADR-45 |
| 22-run/И-110 | `add[]` вердикта (§5 `verdict()`) проверяется `ClosedWorld` без `Ctx`; стадиям не нужен протокол пропуска (§1) | отчёт §9 | `design/domains/22-run.md` | правка модели | T-25 | ADR-46 |
| 22-run/И-111 | контракт на стороне run: у каждого типа с `from` есть `via` (§6 RN-14, `std/learned-assert`) | отчёт §10 | `design/domains/22-run.md` | инвариант | T-26 | ADR-47 |
| 22-run/И-112 | `exec` — гипотетический шов (RN-10): тип не нужен, отказ `impl.adapter ≠ builtin` до срабатывания триггера | отчёт §11 | `design/domains/22-run.md` | упрощение | — | — |

### 23-bench

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 23-bench/И-101 | стенд читает `classify`; `writers {purpose: bench}` у `std/bench-copy` (§1) — через `authority` | отчёт §3 | `design/domains/23-bench.md` | ссылка | T-19 | ADR-40 |
| 23-bench/И-102 | `invalid` (§1), BN-13, BN-16 — через `countedRun`; свойство: `bench ≠ null` в пакете ⇔ гейт принимает строку обучения этого вердикта | отчёт §5 | `design/domains/23-bench.md` | ссылка | T-21 | ADR-42 |

### 30-adapters

| ID | Изменение | Опора | Места | Вид | Тема | Зависит от |
|---|---|---|---|---|---|---|
| 30-adapters/И-101 | закрытый перечень `purpose` (AD-15) — у 30, читатель вне ядра один — `classify` | отчёт §3 | `design/domains/30-adapters.md` | ссылка | T-19 | ADR-40 |
| 30-adapters/И-102 | `wire.ts` → `assemble` с названными фазами отказов (§2, §4, §5 AD-09); фиктивная `setup` для `init` — семя тестов или `init --setup <файл>` | отчёт §4 | `design/domains/30-adapters.md` | новый интерфейс | T-20 | ADR-41 |
| 30-adapters/И-103 | манифест кода: сборка генерирует хэши модулей стадий и адаптеров, тесты фиксируют; `impl.pins` в `std`-JSON (§2) | отчёт §5 | `design/domains/30-adapters.md` | новый артефакт | T-21 | ADR-42 |
| 30-adapters/И-104 | адаптеры сжимаются до транспорта; обёртка `Recording`: кэш · LN-18 · `Meta.model` · запись | отчёт §7 | `design/domains/30-adapters.md` | новый интерфейс | T-23 | ADR-44 |
| 30-adapters/И-105 | `source` → два порта у своих потребителей (ADR-24): `Loader` (`load()`, хост) и `Source` (`text` / `locate` / `grep` / `find`, стадии); тест `text_hash` (ADR-36) пересекает оба | отчёт §11 | `design/domains/30-adapters.md` | правка порта | — | — |

## Развилки для maintainer

| ID | Вопрос | Варианты | Опора | Рекомендация | Блокирует |
|---|---|---|---|---|---|
| ADR-38 | вход коммита — размеченный пакет и реестр проверок | (а) `commit(batch)`; (б) `commit(Draft[], by, key?)` + отдельные входы копии и генезиса | отчёт §1; меняет форму LG-05; ADR-4, 31, 32, 34 | (а) | S1 |
| ADR-39 | вид проверки `CheckView` у rules, три адаптера | (а) `CheckView` у rules; (б) расширить `LedgerView` | отчёт §2; AR-06, ADR-24, ADR-35 | (а) | S1 |
| ADR-40 | проекция полномочий `authority` в ядре и `classify` в trust | (а) проекция ядра + `classify`; (б) каждый читатель — свой список `purpose` | отчёт §3; ADR-25, 26, 32, 35 | (а) | S1 → S3 |
| ADR-41 | корень сборки `assemble` с фазами, порт `Progress`, `run() → pack / pending` | (а) как в отчёте; (б) оставить `wire.ts` и файл хода | отчёт §4; ADR-19, 24, 28 | (а) | S0 |
| ADR-42 | зерно `code` и `countedRun` | зерно: (а) модуль из манифеста; (б) пакет | отчёт §5; ADR-29, 32, 35 | (а) | S0 |
| ADR-43 | точка входа `kernel-v1` | (а) одна точка входа + тест на достижимое; (б) как есть | отчёт §6; ADR-32, 35; REQ-AR-001 | (а) | S1 |
| ADR-44 | replay через записанные адаптеры, обёртка `Recording` | (а) принять; (б) отложить до S5 | отчёт §7; ADR-3, 19, 24 | решить в R4 | S5 |
| ADR-45 | LENS одной стадией, шов `Scorer`, `CalibratedThreshold` | (а) принять; (б) отложить до S5 | отчёт §8; ADR-13, 16; LN-03 | решить в R4 | S5 |
| ADR-46 | `solveNeed` и `ClosedWorld` | (а) принять; (б) отложить до S6 | отчёт §9; ADR-18, 36 | отложить до S6 (YAGNI) | S6 |
| ADR-47 | `via ?? by`, `inForce` / `standing` в trust, проверка политики при `open()` | (а) принять; (б) отложить до S3 | отчёт §10; ADR-5, 6, 35 | решить в R4 | S3 |

## Противоречия внутри дизайна

| ID | Где | Что | Суть | Разрешение |
|---|---|---|---|---|
| П-33 | `design/domains/12-ledger.md` §5, `src/kernel/revision.ts` | `Clock` | `Clock.now(): string` против `revision(input, at)`, где `at` — число | одна форма времени — решить с T-17 (волна 1) |
| П-34 | `design/domains/12-ledger.md` §2, `design/domains/13-rules.md` §2, `design/domains/10-kernel.md` | `ref-exists` | относительная проверка 12 §2 шаг 5 и параметризованный примитив 13 §2 (инвариант 5 в 10) | один владелец — реестр проверок T-17 |
| П-35 | `design/04-architecture.md` §1, `design/domains/23-bench.md` §1 | читатель `purpose` | проверка `owner` читает `purpose` (`writers: {purpose: bench}`), а 04 §1 называет читателем только гейт | по T-19: перечень ADR-35 |
| П-36 | `design/04-architecture.md` §6, `design/adr/0028-setup-object.md` | фиктивные адаптеры | 04 §6: подключаются проводкой; ADR-28 и AR-09: адаптеры — `setup.ports` в журнале | по T-20: 04 §6 выравнивается под ADR-28 |
| П-37 | `design/domains/22-run.md` §6 | зерно `code` | пример исполнения ключует `code` по пакету (`lattice-lens`), RN-34 — по хэшу модуля | одно зерно — ADR-42 |

## Порядок внедрения

| Волна | Что | Пункты | Срез |
|---|---|---|---|
| 1 | R1: T-17, T-18, ADR-38, ADR-39 | 12-ledger/И-101…И-103, 13-rules/И-101…И-102, 10-kernel/И-101, 11-identity-grain/И-101, 15-catalog/И-101, 02-glossary/И-101, 04-architecture/И-101 | S1 |
| 2 | R2: T-20, T-21, ADR-41, ADR-42 | 04-architecture/И-103, 22-run/И-102…И-107, 30-adapters/И-102…И-103, 13-rules/И-104, 23-bench/И-102, 02-glossary/И-102 | S0 |
| 3 | R3: T-19, T-22, ADR-40, ADR-43 | 04-architecture/И-102, 04-architecture/И-104, 10-kernel/И-102…И-103, 11-identity-grain/И-102, 12-ledger/И-104, 13-rules/И-103, 14-trust/И-101, 15-catalog/И-102, 20-lens/И-101, 22-run/И-101, 23-bench/И-101, 30-adapters/И-101 | S1 → S3 |
| 4 | R4: T-23, T-24, T-25, T-26, ADR-44, ADR-45, ADR-46, ADR-47 | 10-kernel/И-104, 12-ledger/И-105, 13-rules/И-105, 14-trust/И-102…И-104, 15-catalog/И-103, 20-lens/И-102…И-105, 21-compose/И-101…И-103, 22-run/И-108…И-112, 30-adapters/И-104…И-105 | S3 · S5 · S6 |
