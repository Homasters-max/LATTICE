# 22. run — конвейер, исполнение, вердикт, обучение

**Назначение.** Исполнить конвейер (хранится в LATTICE), выдать результат потребителю, принять вердикт и превратить его в факты и утверждения — замкнуть цикл.

**Зависит от:** все домены выше; порты `judge` ([20](20-lens.md) §5), `composer`, `source` ([21](21-compose.md) §8), `ids` ([12](12-ledger.md) §5) — контракты у владельцев (ADR-24); порт хода `Progress`, обёртку `Recording` и формат `Meta` определяет этот домен (§3). **Используют:** bench, CLI и хост ([30](30-adapters.md)).

## Модель

### 1. Конвейер и настройка исполнения

**Конвейер** (`std/pipeline@1`, T95) — составная способность в LATTICE: тело `{title, input, output, stages[]}`, стадия — `{name, cap: ref@n, params?}`.

```json
{ "id": "std/pipeline.solve", "type": "std/pipeline@1", "version": 1,
  "body": {
    "title": "Решить задачу из блоков LATTICE",
    "input": {"$ref": "std/ctx@1"}, "output": {"$ref": "std/ctx@1"},
    "stages": [
      { "name": "frame",       "cap": {"$ref": "std/stage.frame@1"},       "params": {"max_needs": 5} },
      { "name": "normalize",   "cap": {"$ref": "std/stage.normalize@1"} },
      { "name": "route",       "cap": {"$ref": "std/stage.route@1"} },
      { "name": "lexicon",     "cap": {"$ref": "std/stage.lexicon@1"} },
      { "name": "recall",      "cap": {"$ref": "std/stage.recall@1"},
        "params": {"same_hi": {"value": 0.85, "calibrated_for": null, "call": "verify", "onMismatch": "refuse"},
                   "same_lo": {"value": 0.5,  "calibrated_for": null, "call": "verify", "onMismatch": "refuse"}, "top_n": 5} },
      { "name": "recheck",     "cap": {"$ref": "std/stage.recheck@1"} },
      { "name": "id-lookup",   "cap": {"$ref": "std/stage.id-lookup@1"} },
      { "name": "pool",        "cap": {"$ref": "std/stage.pool@1"},        "params": {"pool_max": 200, "cues_max": 10} },
      { "name": "bm25",        "cap": {"$ref": "std/stage.bm25@1"} },
      { "name": "judge",       "cap": {"$ref": "std/stage.judge@1"} },
      { "name": "fuse",        "cap": {"$ref": "std/stage.fuse@1"},        "params": {"mode": "linear", "bm25_weight": 0.3} },
      { "name": "trust",       "cap": {"$ref": "std/stage.trust@1"} },
      { "name": "threshold",   "cap": {"$ref": "std/stage.threshold@1"},
        "params": {"no_match": {"value": 0.6, "calibrated_for": null, "call": "score", "onMismatch": "refuse"}} },
      { "name": "cut",         "cap": {"$ref": "std/stage.cut@1"},         "params": {"k": 20} },
      { "name": "select",      "cap": {"$ref": "std/stage.select@1"} },
      { "name": "self-search", "cap": {"$ref": "std/stage.self-search@1"} },
      { "name": "check",       "cap": {"$ref": "std/stage.check@1"} },
      { "name": "materialize", "cap": {"$ref": "std/stage.materialize@1"} },
      { "name": "deliver",     "cap": {"$ref": "std/stage.deliver@1"},     "params": {"header": "…"} }
    ] } }
```

- Стадии, их `reads`/`writes` и параметры определяют владельцы: LENS — [20](20-lens.md) §4, compose и `materialize` — [21](21-compose.md) §4, `deliver` — §4 здесь. Промпты стадий Composer — в их `params` ([21](21-compose.md) §8); в примере опущены. `select` своего `max` не несёт — читает `solution-size` из `std/member`.
- Все ссылки закреплены (`refs: pin`, CT-06). При публикации конвейера `contract` проверяет, что каждое чтение записано раньше — входом конвейера (`request.*`) или `writes` предыдущей стадии ([13](13-rules.md) §3, T132).
- **Конвейер v1 — линейный список без условий и возвратов** (ADR-18, T-3): стадия, которой нечего делать с потребностью (`done`, нет кандидатов), её пропускает; `self-search`, если нужно предложить выбор заново, делает это внутри своей реализации, а не возвратом к `select`. Граф стадий — новой версией интерпретатора по триггеру «Вне объёма» (10-kernel/И-31).
- Замена стадии, параметра или текста `header` = **новая версия конвейера**; её проверяет регрессия стенда ([23](23-bench.md)). Стадии `intake` нет: запрос по схеме `std/ctx` проверяет рантайм до первой стадии (§3).

**Настройка исполнения** (`std/setup@1`, T126, ADR-28) — тип без зерна; действующая настройка пространства — объект с локальным именем `setup` (`warrant/setup`): его ревизию закрепляет вызов, ревизии пишет владелец пространства (правило `owner`). Прочие объекты `std/setup` пространства — базовые линии стенда ([23](23-bench.md) §1): вызов их не читает (RN-29).

```json
{ "id": "warrant/setup", "type": "std/setup@1",
  "body": { "pipeline": {"$ref": "std/pipeline.solve@1"},
            "ports": { "judge":    { "adapter": "judge-jev",       "model": "<точная версия>" },
                       "composer": { "adapter": "composer-claude", "model": "<точная версия с датой>" },
                       "source":   { "adapter": "source-warrant" } } } }
```

- **Пороги — параметры конвейера проекта** (RN-35): порог — калиброванный порог `CalibratedThreshold` (T198, [13](13-rules.md) §3, ADR-45), способность объявляет такие параметры полем `calibrated`; `std/pipeline.solve@1` несёт пороги по умолчанию (`calibrated_for: null`); калибровка пишет ревизию конвейера проекта `<пространство>/pipeline.solve` — копия `std` с порогами и `calibrated_for` (первая ревизия — новый объект) — и ревизию `setup`, которая на неё ссылается ([23](23-bench.md) §4 п. 8). `min_p` кандидатов — в политике пространства (`namespace.policy`, [14](14-trust.md) §4).
- Конвейер и модели меняются вместе одной ревизией; откат — ещё одна ревизия. `model` — точный идентификатор версии: алиас провайдера — отказ на старте (§3). Где лежат адаптеры и секреты — проводка `bindings` ([30](30-adapters.md), T128).
- Вызов закрепляет `setup@n`. **Кортеж исполнения** (T131) — определён здесь, остальные ссылаются:
  - `setup@n` — конвейер `pipeline@n` (с промптами стадий composer в `params`) и модели портов;
  - `code` — хэши модулей стадий конвейера и адаптеров портов `setup` из манифеста кода (T193, [30](30-adapters.md) §2): **зерно `code` — модуль** (ADR-42); версия пакета — справочно, с `impl.pins` сверяется хэш модуля (RN-34). Релиз, не тронувший модуль, кортеж не меняет;
  - `prompts` — `prompt_hash` шаблонов judge по виду вызова (`describe().prompts`, [20](20-lens.md) §5);
  - `policy` — `policy@n` пространства (`namespace.policy`, закреплена, [15](15-catalog.md) §1) на `seq` старта: по ней считают доверие LENS и `recall` и выводит строки `learn` (§6);
  - версия ядра — заголовок `kernel` коммита вызова (T113), в теле её нет.

  Пишется в вызов (§3) и целиком — в `std/bench-run` ([23](23-bench.md) §1). **Совпадение** `bench-run pass` с вызовом — по `setup@n`, `code`, `prompts` и `policy`; `kernel` записан, но не сравнивается: ядро заморожено, его смену покрывают векторы S1 ([05](../05-slices.md)). Смена политики без прогона стенда прежний `pass` не наследует (RN-24).
- **Модуль кортежа `run/tuple`** (ADR-42) — кортеж в коде определён одним модулем, остальные его зовут: `capture(setup, manifest, describe, policy) → tuple` — кортеж вызова; `startRefusals(tuple, setup, pipeline, session, request, view) → отказы` — все отказы старта одной таблицей (§3): `request` — для схемы запроса, `view` на `seq` старта — для отзыва версии и реестра; `matches(a, b)` — совпадение кортежей для стенда (`invalid`) и перезапуска после `answer` — вызов функции ядра `sameTuple` ([13](13-rules.md) §2), которой сравнивает и `countedRun`: правило одно. Replay кортежи не сравнивает — сверяет хэши модулей стадий с манифестом (§7). Засчитанный прогон кортежа — не здесь: функция замороженного ядра `countedRun(view, tuple)` ([13](13-rules.md) §2, T200) — её читают рантайм (пакет «проверен стендом»), `learn`, гейт и стенд.
- Способностей проектов вне пакета (`impl.adapter` ≠ `builtin`) в v1 нет: порта `exec` и его типа не заводится — гипотетический шов без адаптера и потребителя; такая способность — отказ на старте (RN-10). Порт — вместе со способностями проектов (разбор 2026-09-29, кандидат 11).

### 2. Контекст конвейера (`std/ctx`) и стадия

```ts
type Ctx = {
  request: { task: string; scope?: Ref; session: Ref; budget?: { usd?: number; ms?: number } }
  run: { execution: Id; setup: Ref; bench: Ref | null }                     // рантайм, только чтение
  needs: Array<{
    text: string; norm?: string; scope?: Ref; findings?: Finding[]            // frame, normalize, route
    terms?: Ref[]; boosts?: Ref[]                                             // lexicon
    key?: string; need?: Ref                                                  // recall
    recall?: { solution: Ref; snapshot: Id; status: 'fresh' | 'stale' | 'broken';
               by: 'exact' | 'judge' | 'composer'; p?: number }
    candidates?: Candidate[]; pool?: Id; measurement?: Ref                    // id-lookup … cut
    scores?: { bm25?: Record<Id, number>; judge?: Record<Id, number>; fused?: Record<Id, number> }  // пути scores.bm25 …
    outcome?: 'candidates' | 'no-match'                                       // threshold
    selection?: Selection; found?: Ref[]                                      // select, self-search
    solution?: { ref: Ref; snapshot: Id }                                     // materialize
    rows?: Draft[]; done?: boolean
  }>
  pack?: Pack                                                                 // deliver
  notes?: string[]
}
```

- `request.session` — сессия, которую открыл хост (ADR-25, [14](14-trust.md) §1): участник, его вид и `purpose` берутся из неё, отдельного `actor` в запросе нет.
- `run` — id вызова, `setup@n` и найденный `bench-run pass` (или `null`); заполняет рантайм до первой стадии, стадии его только читают — путь `run` в `writes` запрещён (проверка `contract`, [13](13-rules.md) §3).
- Типы полей — у владельцев: `Candidate` (T87: `ref`, `card`, `scores`, `trust`, `marks`, `why`) — [20](20-lens.md) §7; `Selection` с собственным `outcome` (`selected` · `none-fit` · `absent` · `coverage`) — [21](21-compose.md) §7; `Finding` (T44) — [13](13-rules.md); `Draft` — [12](12-ledger.md) §5; `Pack` — §4. `needs[].outcome` — вывод порога LENS; исход выбора — `selection.outcome`.
- `found` (T152) пишет код — по `source.grep`, по месту `source.find` живого блока (CP-26) и по членам дубля потребности; `found_by` членов ставит код ([21](21-compose.md) §5).
- **`rows`** (T156) — строки журнала, которые стадия готовит для коммита вызова (RN-03): значения `std/pool` и `std/card` (`pool`), `std/measurement` (`judge`), потребности, подсказки и кандидаты в алиасы (`recall`), `std/gap` (`self-search`), решение, `std/member`, `std/link`, snapshot (`materialize`). Стадия объявляет `rows` в `writes`, а типы строк — полем способности `emits` ([13](13-rules.md) §3): рантайм сверяет тип каждой строки `rows` с `emits`, как пути с `writes`, — иначе ошибка стадии (RN-36). Типов блоков (с шаблоном `card`, T66) в `emits` нет — это проверяет `contract` при публикации конвейера: вызов блоки не создаёт и не правит, чья бы сессия его ни открыла. Новый объект получает id у стадии — `newId(namespace, deps.ids.ulid())`: строки одного коммита ссылаются друг на друга (оценка → потребность, → вызов). Строка, которая меняет существующую сущность, несёт `expect` — версию, прочитанную из `view`.
- `notes` — заметки стадии для трассы (`threshold: uncalibrated`, `recall: uncalibrated`, `<параметр>: calibration-mismatch` при `onMismatch: mark`); в `writes` не объявляются, рантайм переносит их в `note` стадии и очищает.
- Пути `reads`/`writes` внутри потребности — `needs[].<поле>` (T132); `request.*` — вход конвейера.

**Стадия** (T96) — способность `std/stage.<имя>` ([13](13-rules.md) §3):

```ts
type Stage   = (ctx: Readonly<Ctx>, params: Json, deps: Deps) => Promise<Ctx | Pending>
type Pending = { pending: { kind: string; prompt_hash: string; input: Json; schema: Json } }
                                   // задание агенту (composer-caller, ADR-19): вызов останавливается; та же форма —
                                   // выход Composer.run ([21] §8) и stdout lattice solve ([30] §5)
type Deps    = { judge?: Judge; composer?: Composer; source?: Source; ids: Ids; view: View }   // порты — из setup.ports; clock стадиям не нужен: at ставит коммит
interface View extends LedgerView { trust(target: Ref): Json; standing(target: Ref): Json; inForce(fact: Ref): boolean }
                                   // LedgerView — [12] §5; trust(), standing(), inForce() — [14] «Операции»
```

- Вход заморожен, стадия возвращает новый объект или `Pending` — порт `composer` в режиме агента отдал задание (ADR-41): рантайм останавливает вызов (§3). Внешнее — только через порты `deps`; стадия с портами LLM объявляет это полем способности `determinism` ([13](13-rules.md) §3). Стадия не знает о соседях.
- Порты, которые стадия вызывает, она объявляет полем способности `uses` (как `reads`/`writes`, [13](13-rules.md) §3); рантайм кладёт в `deps` только порты из `setup.ports`, стадия конвейера с портом вне `setup.ports` — отказ на старте (RN-10, RN-27). Поэтому настройка без LLM — законна: базовые линии стенда (BM25 по документам, в домене) — конвейеры из детерминированных стадий без `judge` и `composer` ([23](23-bench.md) §1).
- `view` (T133) — тип `View` определён здесь: чтения индекса `LedgerView` ([12](12-ledger.md) §5: `seq`, `get`, `history`, `facts`, `find`, `referrers`) и операции trust `trust()`, `standing()` (правило выдачи), `inForce()` ([14](14-trust.md) «Операции», ADR-47) на `seq` старта вызова: все стадии видят одно состояние. Собирает его рантайм: при вызове — индекс процесса на старте (до коммита вызова он не меняется), при `replay` — пересборка `scan(0, execution.seq)` (§7). Ledger от trust не зависит (AR-08): `trust()` добавляет run. `store` стадии не получают — пишет только рантайм (RN-03).

### 3. Рантайм — интерпретатор

```text
run(request, session, rt, resume?) → {pack} | {pending, task}   // сессию открыл хост (ADR-25); rt: Runtime — выход
                                                        // корня сборки assemble ([30] §2, ADR-41): {ledger, namespace,
                                                        // deps, progress, clock, ids, manifest, env, pendingTtl};
                                                        // resume = {execution} — перезапуск после answer; другого не получает
  view  = rt.ledger.view() + trust()/standing()/inForce()   // View на хвосте старта (§2); deps = rt.deps + {view}
  setup = view.get(<rt.namespace>/setup)                  // ревизия setup@n
  x     = resume ? resume.execution : newId(rt.namespace, rt.ids.ulid())  // id вызова: ключ коммита, ход, lattice answer
  seq   = view.seq                                        // хвост на старте; при перезапуске — на перезапуске
  tuple = run/tuple.capture(setup, rt.manifest, describe() портов, policy@n)   // §1, ADR-42
  отказы = run/tuple.startRefusals(tuple, setup, pipeline, session, request, view)  // одна таблица (ниже); есть — вызов с ошибкой
  bench = countedRun(view, tuple) или null                // [13] §2, T200; null → пакет «не проверено стендом» (ADR-29)
  прежний = progress.resume(x)                            // перезапуск после answer: записанный кортеж и задание
  прежний и не sameTuple(прежний.tuple, tuple) → progress.reset(x)   // ответы агента сброшены, задание уйдёт заново
  progress.begin(x, tuple)                                // ход — порт Progress, не файл (T194)
  ctx = {request, run: {execution: x, setup, bench}, needs: []}
  for stage in setup.pipeline.stages:
      out = impl(freeze(ctx), stage.params, deps)         // deps — порты в обёртке Recording (ниже, ADR-44)
      out = Pending → progress.park(x, stage, task); return {pending, task}   // режим агента: в журнал — ничего
      изменённые пути ⊆ writes — иначе ошибка стадии       // RN-09
      trace += {name, cap@n, status, ms, usd?, error?, note?, calls?, ids?}; progress.step(x, stage, status)
      сумма Meta ≤ request.budget — иначе ошибка
      ctx = out
  vals = std/payload входа, выхода и calls[] вызова                        // пишет рантайм, не стадия
  rt.ledger.commit(author {drafts: [execution x] ∪ vals ∪ needs[].rows, by: session, key: x})   // один коммит (RN-03)
  progress.end(x); return {pack: ctx.pack}
```

`sameTuple` — функция ядра ([13](13-rules.md) §2): тем же правилом, что гейт, рантайм решает, остался ли кортеж прежним.

**Отказы на старте — одна таблица** (`run/tuple.startRefusals`, ADR-42; до первой стадии):

| Отказ | Что сверяется |
|---|---|
| запрос не по схеме | `request` против `std/ctx` |
| модель порта | `describe().model` ≠ модели порта в `setup` (алиас провайдера, подмена) — единственное место этого отказа: корень сборки модель не сверяет ([30](30-adapters.md) §2) |
| порт стадии | порт из `uses` стадии вне `setup.ports` (RN-27) |
| код стадии | хэш модуля из манифеста ≠ `impl.pins`, или версия способности отозвана (`core/retire` на `id@n`) |
| реализация | `impl.adapter` ≠ `builtin` — способностей проектов в v1 нет |
| калибровка | параметр из `calibrated` способности: `calibrated_for` ≠ `{adapter, model, prompts[call]}` порта из `setup` и `onMismatch: refuse`; при `mark` — не отказ, стадия идёт как без калибровки с заметкой (ADR-45) |
| модель участника | при `composer-caller` — `model` участника сессии (реестр на `seq` старта, `authority.principal`) ≠ `setup.ports.composer.model` (RN-32) |

- **Реестр реализаций:** `impl: {adapter: "builtin", name, pins}` → функция пакета; рантайм исполняет её, только если хэш модуля совпадает с `pins` (версия пакета — справочно: релиз, не тронувший модуль стадии, её не останавливает, RN-34) и версия способности не отозвана — нет `core/retire` на её `id@n` (ADR-15, T-2, [15](15-catalog.md) §5). Иной `adapter`, чем `builtin`, — отказ на старте (§1).
- Калибровку рантайм сверяет обобщённо — по полю `calibrated` способности и `call` значения, а не по именам стадий: интерпретатор не знает, что `threshold` — это `score`, а `recall` — `verify` (ADR-45). Агент другой модели не исполняет и не учит систему под чужим `pass` (RN-32).
- **Гейт стенда** (ADR-29): засчитанный прогон кортежа — `countedRun(view, tuple)` ([13](13-rules.md) §2, T200, ADR-42) — та же функция, что у гейта обучения: `bench ≠ null` в пакете ⇔ гейт примет строку обучения вердикта на этот вызов. Не нашёл — вызов разрешён, пакет помечен «не проверено стендом», `execution.bench: null`. Запрет обучения держит коммит (примитив `learning-gate`), а не рантайм.
- **Бюджет:** `request.budget` сверяется после каждой стадии по сумме `Meta` вызовов портов; у `std/setup` бюджета нет — он в плане стенда ([23](23-bench.md)).
- **Режим агента** (`composer-caller`, ADR-19): стадия вернула `Pending` — рантайм паркует вызов (`progress.park`, кортеж записан при `begin`) и отдаёт `{pending, task}`; `answer(x, json)` — хост дописывает ответ в `.lattice/answers/<x>.jsonl` с ключом `(kind, prompt_hash, хэш input)` из задания ([30](30-adapters.md) AD-09) и перезапускает вызов с тем же `x` (`run(…, resume: {execution: x})`) на новом `view` (хвост на перезапуске, `seq` вызова — его). **Ответ привязан к кортежу** (ADR-41): перезапуск с другим кортежем, чем записанный при `begin` (`progress.resume`; новая ревизия `setup`, промпт, код), — `progress.reset`: записанные ответы сброшены, задание уходит заново; `composer-caller` получает на вход промпт и отдаёт ответ по ключу `(kind, хэш промпта, хэш input)` ([21](21-compose.md) §8), изменился промпт или вход — снова `pending`. Истина — трасса вызова, не файл ответов (Ф-3).
- **Обёртка `Recording`** (T197, ADR-44) — сквозное поведение портов `Deps` в одном месте, над адаптером-транспортом. У портов LLM (`judge`, `composer`): кэш по ключу потребителя (judge — [20](20-lens.md) §6, composer — [21](21-compose.md) §8), проверка ключей ответа (LN-18), сверка `Meta.model` с моделью порта в `setup` — расхождение — ошибка стадии (RN-32). У всех портов — запись вызова в `calls` стадии (кроме `judge.score`: его баллы — строка `std/measurement`, которую готовит сама стадия `judge` в `rows`, [20](20-lens.md) §4; обёртка отдаёт баллы — живые или из кэша). Адаптер не повторяет её у себя; фиктивный адаптер получает кэш и проверки той же обёрткой. Над записанным адаптером (`recorded(execution)`, §7) обёртка кэша не ведёт и трассу не пишет: проверяет LN-18; `Meta.model` — модель порта из `setup@n` вызова (в записи вызова модели нет; replay модели не сверяет, RN-34).

**Сбой → что пишется** (RN-11):

| Сбой | Что пишется |
|---|---|
| отказ на старте, ошибка стадии (невалидный выход Composer, запись вне `writes`, строка типа вне `emits`), превышен бюджет | коммит только `std/execution {status: error}` с трассой до сбоя и значения `std/payload`, на которые она ссылается, `key` = id вызова; `rows` не пишутся, оплаченные оценки остаются в кэше обёртки `Recording` |
| отказ коммита вызова (`hard`, конфликт `expect`, зарегистрированное значение) | то же, в `error` — нарушения `{row, rule, message}`; повтор — новым вызовом, оценки — из кэша |
| отказ и этого коммита; замок хранилища занят дольше срока (`locked`, ADR-31) | только ход (`Progress`); повтор — новым вызовом |
| обрыв процесса | хвост без маркера `core/commit` → `.lattice/recovered/` при `open()` ([12](12-ledger.md) §2), без `lock()`; где остановился — в ходе |
| `pending` (режим агента) | в журнал — ничего; ход — `park` с заданием и кортежем; `answer` перезапускает вызов |
| брошенный `pending`: ход `pending` старше `pending_ttl` (параметр хоста, по умолчанию 24 ч, — `rt.pendingTtl`; время — порт `clock`) | следующая `solve` или `answer` в хранилище перед своим вызовом получает от `Progress` брошенные вызовы (`abandoned(rt.clock.now(), rt.pendingTtl)`) и коммитит каждому `std/execution {status: error, error: {kind: abandoned}}` своей сессией — стадии и время из хода, `key` = id вызова; ход и ответы удаляются; `answer` на этот вызов — отказ; читающие команды не пишут (RN-37) |

**Порт хода `Progress`** (T194, ADR-41) — ход вызова вне журнала: телеметрия, не истина и не вход replay. Контракт — здесь (потребитель — рантайм, ADR-24), адаптеры — `progress-fs` (файл хода `.lattice/runs/<id вызова>.log`, T155, построчно `{stage, need?, at, ms?, status}`) и `progress-memory` (тесты) — [30](30-adapters.md) §1. Рантайм не делает ввода-вывода сам: ход, брошенные вызовы и `pending` проверяются без файловой системы на фиксированных часах. Адаптер `Progress` получает `Clock` при создании ([30](30-adapters.md) §1): время строк хода (`at`) и возраст в `abandoned` — по нему; методы времени не принимают, кроме `abandoned(now, ttl)`.

```ts
interface Progress {
  begin(x: Id, tuple: Json): void                       // кортеж — для сверки при перезапуске (ответ агента, ADR-41)
  step(x: Id, stage: string, status: string, ms?: number): void
  park(x: Id, stage: string, task: Json): void          // pending
  resume(x: Id): { tuple: Json; task: Json } | null     // записанный кортеж и задание pending — при перезапуске
  reset(x: Id): void                                    // кортеж изменился: ответы агента вызова удаляются
  abandoned(now: number, ttl: number): Array<{ x: Id; stages: Json; tuple: Json }>   // брошенные pending (RN-37)
  end(x: Id): void                                      // после коммита вызова: ход и ответы агента удаляются
}
```

Ответы агента (`answers/<x>.jsonl`) пишет хост `answer`, читает `composer-caller`, удаляет порт хода (`reset`, `end`, брошенный вызов) — [30](30-adapters.md) §4.

Писатель `progress-fs` проходит проверку «нет зарегистрированных значений», как все писатели `.lattice/` (T-12, [12](12-ledger.md) LG-16). После успешного коммита ход удаляется — трасса уже в `std/execution`; при сбое и `pending` остаётся.

**Вызов** (`std/execution@1`, T98) — событие в сегменте исполнения, наследник маркера `std/segment-event` ([12](12-ledger.md) §1, ADR-3):

```json
{ "id": "warrant/01J8…X", "type": "std/execution@1",
  "body": { "setup": {"$ref": "warrant/setup@3"}, "pipeline": {"$ref": "std/pipeline.solve@1"},
            "code": { "lens/stages/bm25.ts": "sha256:…", "lens/stages/judge.ts": "sha256:…", "compose/stages/select.ts": "sha256:…",
                      "adapters/judge-jev/index.ts": "sha256:…", "adapters/composer-claude/index.ts": "sha256:…" },
            "prompts": { "score": "sha256:…", "verify": "sha256:…", "choose": "sha256:…" },
            "policy": {"$ref": "std/trust-policy@1"},
            "source": "<ревизия источника>", "env": { "node": "22.11.0", "icu": "76.1" },
            "seq": 18234, "bench": {"$ref": "warrant/01J8…B"},
            "status": "ok", "input": {"$ref": "#5d1a…"}, "output": {"$ref": "#c7e0…"},
            "stages": [
              { "name": "judge", "cap": {"$ref": "std/stage.judge@1"}, "status": "ok", "ms": 840, "usd": 0.012 },
              { "name": "select", "cap": {"$ref": "std/stage.select@1"}, "status": "ok", "ms": 2100, "usd": 0.03,
                "calls": [ { "port": "composer", "kind": "select", "prompt_hash": "sha256:…",
                             "input": {"$ref": "#81f4…"}, "output": {"$ref": "#0b9e…"} } ] } ] } }
```

- `setup`, `code`, `prompts`, `policy` — кортеж исполнения (§1); `pipeline@n` — для чтения, его закрепляет `setup@n`. `code` — модуль → хэш из манифеста кода (T193); в примере — часть модулей.
- `source` — ревизия содержимого источника, которую адаптер `source` отдал вместе с текстами пакета (PF-04).
- `env` (T182) — версии среды, от которых зависит результат кода (`node`, `icu`: `normalize`, сортировка); значение отдаёт рантайму корень сборки (`assemble`, [30](30-adapters.md) §2, ADR-41) — рантайм процесс не читает; пишет в вызов рантайм. В кортеж исполнения и совпадение гейта не входит; вызовы одной кампании с разной `env` или `source` — прогон `invalid` ([23](23-bench.md) §1, RN-31, ADR-36).
- `seq` — последний `seq` журнала на старте: на нём строится `view` (воспроизведение — §7).
- `bench` — найденный `bench-run pass` или `null`.
- `ids` стадии — id новых объектов, которые она выдала, по порядку: `replay` возвращает их тем же стадиям (§7).
- `input`, `output` — значения запроса и пакета: `std/payload@1` (T175) — `content`-тип с телом `{json}`, внутри `json` — любой JSON. Строки значений входа, выхода и `calls[]` пишет **рантайм**, а не стадия (не в `writes`, не в `needs[].rows`), в коммит вызова — и `ok`, и `error`: ссылки трассы разрешаются (`ref-exists`). Значения лежат в основном журнале и не истекают ([12](12-ledger.md) §1). `calls` стадии — каждый вызов её портов, кроме `judge.score`: composer, `judge.verify`, `judge.choose`, `source.*` — `{port, kind, prompt_hash?, input, output}`, вход и выход — значения по хэшу ([12](12-ledger.md) §1); пишет обёртка `Recording`, и при попадании в её кэш — тоже. Оценки `judge.score` — события `std/measurement` в `rows` вызова со ссылкой `execution`, и при попадании в кэш ([20](20-lens.md) §6). Так вызов несёт всё, что нужно replay (§7).
- `status: error` — поле `error: {stage?, kind, message, violations?}`; у стадии — своё `error`.

**Сводка ответа порта и идентичность** — общие для портов LLM (judge, composer):

```ts
type Meta  = { adapter: string; model: string; usd: number; ms: number;
               tokens?: { in: number; out: number }; detail?: Json }
type Ident = { adapter: string; model: string; prompts?: Record<string, string> }   // prompt_hash по виду вызова
```

- `Meta` (T135) рантайм читает для бюджета и пишет в трассу. `Meta.model` адаптер берёт из ответа поставщика, а не из `setup`; расхождение с моделью порта в `setup@n` ловит обёртка `Recording` — ошибка стадии (в кампании — прогон `invalid`, RN-32). Эндпоинт проводки обслуживает модель из `setup` — допущение ([04](../04-architecture.md) AR-09); поставщик, не возвращающий модель, оставляет его непроверенным — адаптер пишет модель запроса и объявляет это в описании адаптера ([30](30-adapters.md) §5). Хэшей в `Meta` нет: идентичность — `describe()` и кортеж, ключ кэша — у потребителя порта, ведёт его обёртка `Recording`; `detail` для рантайма непрозрачен — не идентичность и не ключ кэша.
- `describe(): Ident` (T154) — у judge ([20](20-lens.md) §5: `prompts` для `score`, `verify`, `choose`) и composer ([21](21-compose.md) §8: без `prompts` — промпт стадии в её `params`, хэш считает рантайм); вызывается на старте.
- Контракта для способностей проектов (порт `exec`) нет: шов без адаптера и потребителя — гипотетический; способность с `impl.adapter` ≠ `builtin` — отказ на старте (§1, RN-10). Контракт появится вместе с первой такой способностью.

### 4. Выдача (`deliver`) — пакет

Стадия `deliver` (код + порт `source`): `reads` — `request.task`, `run`, `needs[].text`, `needs[].recall`, `needs[].selection`, `needs[].solution`, `needs[].findings`; `writes` — `pack`; параметр `header`. Пометка «не проверено стендом» — из `run.bench`, `setup@n` — из `run.setup`, id вызова — из `run.execution`; решение и snapshot — из `recall` (повтор) или `solution` (новое, `materialize`). Для знаний пакет — то, что попадает в промпт агента:

```md
<header: пакет — закрытый мир; как читать доверие; как вернуть вердикт — lattice verdict, формат>
> Не проверено стендом: warrant/setup@3 без bench-run pass.          (только при bench: null)
## Нормы для задачи: <задача>
### Потребность: Что спасает waiver?  (решение observed, snapshot SN-3fa2…)
- REQ-VER-007@4 — Waiver спасает только FAIL. Причина: «…». Источник: openspec/specs/verification/spec.md#REQ-VER-007
  Код: src/verify/verdict.ts#attestationAccepted · Тесты: verify.test.ts
### Потребность: …  (нет в каталоге — gap absent)
### Потребность: …  (в каталоге нет, в источнике есть места — gap coverage: docs/…:12-30)
```

- Тексты и места даёт порт `source` проекта (`text`, `locate`, [21](21-compose.md) §8); ревизия источника уходит в `execution.source`.
- **Сверка текста** (RN-30, ADR-36): хэш ответа `text(ref)` сверяется с `text_hash` у `ref@n` решения. Совпал — в пакете полный текст. Не совпал или хэша нет — карточка `ref@n` (`title`, `summary`) и пометка «источник изменён после загрузки — `lattice load`», то же — в `note` стадии: доверие стоит только под тем текстом, который оно покрывает.
- **Тексты — данные:** тексты блоков, карточек и подсказок в пакете и в промптах стадий — в разметке цитаты (ограничители с `ref@n`); шапка пакета называет их данными, не инструкциями. Разметку ставит код `deliver` и сборки промпта, а не модель ([21](21-compose.md) §5 «текст ↔ проверка»).
- `header` — параметр стадии, его текст — часть версии конвейера (PF-config §3.5). Граница, сказанная в шапке, дублируется проверкой кода: закрытый мир держит `check` ([21](21-compose.md) §5), вердикт — метрика доли пропущенных ([21](21-compose.md) «текст ↔ проверка»).
- Пометки кандидатов (`marks`: `inferred`, `contested`, `deprecated`) и основание решения — в строке потребности.
- Пакет — также JSON для машин того же состава; в нём `execution` — id вызова, на который ссылается вердикт (§5).

### 5. Вердикт

**Вердикт** (`std/verdict@1`, T100) — событие: диагноз потребителя по одному выданному решению. Потребитель отвечает на **каждое выданное решение** в конце использования (команда — [30](30-adapters.md)):

```json
{ "type": "std/verdict@1",
  "body": { "execution": {"$ref": "warrant/01J8…X"}, "solution": {"$ref": "warrant/SOL-…"},
            "snapshot": {"$ref": "#3fa2…"},
            "same_need": true, "status": "complete | incomplete | wrong | none | unsure",
            "used": [{"$ref": "warrant/REQ-VER-007"}], "unused": [{"$ref": "warrant/REQ-VER-003"}],
            "add": [{ "ref": {"$ref": "warrant/ADR-0034@2"}, "reason": "«…»" }],
            "task_only": [{"$ref": "warrant/ADR-0036"}], "note": "…",
            "evidence": [{ "member": {"$ref": "warrant/REQ-VER-007"}, "kind": "commit", "at": "…" }] } }
```

- `execution` — вызов, выдавший решение (id в JSON-пакете, §4); через него гейт обучения находит кортеж (§1; раздел индекса `executions`, [12](12-ledger.md) §3, ADR-29). Автор — сессия строки (`by`); вид и модель участника — из реестра (ADR-25), в теле их нет. Пишет вердикт участник сессии вызова (любая его сессия) или владелец пространства; другой — отказ `verdict()` (RN-33): чужой участник, увидевший id вызова, не занимает ключ пары.
- **Один вердикт на пару `(execution, solution)`:** ключ коммита `verdict:<execution>:<solution>` — повтор с тем же содержимым возвращает прежний результат, с другим — отказ `differs` с адресом прежнего коммита ([12](12-ledger.md) §2, шаг 0, LG-20): переобуться нельзя, обучение не удваивается, и второй вердикт не теряется молча. Вердикт может прийти из другой сессии, чем вызов (агент перезапущен); ограничение — ключ, автор (RN-33) и группы независимости ([14](14-trust.md) §1).
- **Статусы:** `complete` — решения хватило; `incomplete` — не хватило (`add` — чего); `wrong` — решение ошибочно; `none` — ничего из выданного задаче не понадобилось; `unsure` — потребитель не может судить, обучение ничего не меняет. При `same_need: false` остальные поля не читаются.
- `used ∪ unused ⊆ snapshot.members` — по `id`: элементы — следующие ссылки, член относится к ревизии из snapshot вердикта, даже если блок с тех пор получил новую версию (RN-23). Член вне обоих списков — нет сигнала, а не `unused`. `task_only` — нужно задаче, не потребности.
- **`evidence`** (необязательно) — след исхода: `[{member?, kind, at}]`, где `kind` — вид следа (`commit`, `test`, `note`), `at` — его адрес (хэш, путь, имя теста). В v1 не взвешивается и обучение его не читает: поле есть, чтобы вердикты v1 можно было переинтерпретировать, когда появится источник следа (RN-28, видение: «чему учится»).
- **`add[]` — закрытый мир** для всех писателей (T-16): `ref@n` — блок каталога в области решения, проходящий правило выдачи (жив, не в `policy.lens.exclude`, [14](14-trust.md) TR-15), ревизия на `execution.seq`; `reason` — цитата из карточки или полного текста `ref@n` (проверка 4, [21](21-compose.md) §5). Нарушение цитаты отклоняет элемент `add`, не вердикт: он пишется без элемента, отклонённый — находка в ответе (CP-24).
- Проверки — код `verdict()` до коммита; нарушение — отказ в оболочке RL-11 ([13](13-rules.md)), кроме цитаты `add[]`. Одна проверка «замкнутого мира» для вызова, вердикта и `materialize` (`ClosedWorld`) — отложена до S6 (ADR-46, [21](21-compose.md) «Вопросы для grilling»).
- **Вердикт не пришёл** — `unknown`: ничего не меняется; доля выданных решений без вердикта — метрика (пары `(execution, solution)` без `std/verdict` в журнале).

### 6. Обучение — правила «вердикт → факты»

**Строки обучения** (T157) — одна форма для всего, что пишет обучение (RN-14):

- Тело несёт `from` — вердикт, `via` — сессию вердикта, `policy` — ревизию политики доверия, по которой строка выведена (T-15): политику кортежа вызова вердикта (§1), не текущую, — и `bench` — засчитанный прогон стенда, под которым строка принята (у вердиктов `simulate` в копии — нет). Типы: `std/member`, `std/cue` ([21](21-compose.md) §2) и утверждение обучения `std/learned-assert` (T158, `extends core/assert@1`); `writers`: у `std/member` и `std/learned-assert` — `grant`, у `std/cue` — `any` ([21](21-compose.md) §1).
- **Контракт `via`** (ADR-47): строка с `from` (выведенная из вердикта) несёт `via` = `by` вердикта — у всех трёх типов поле `via?` в схеме, у `std/learned-assert` — обязательное; строки тех же типов без `from` (член от Composer, подсказка `recall`) `via` не несут. Держит контракт гейт `learning-gate` — он и так закреплён в `rules` каждого типа с `from`: строка с `from` без `via` или с чужим `via` — отказ коммита ([13](13-rules.md) §2). Доверие считает автора голоса как `via ?? by` и не знает имён этих типов ([14](14-trust.md) §2): новый тип строки обучения без гейта в `rules` не учит, а не меняет смысл доверия молча.
- В `rules` этих типов — примитив `learning-gate` с путём `from` ([13](13-rules.md) §2, ADR-29): строка принимается, только если её `via` — сессия вердикта и сессия вердикта — `purpose: verdict` и `bench` — засчитанный прогон кортежа `verdict.execution` — значение `countedRun(view, tuple)` (T200, ADR-42), или `purpose: simulate` в копии кампании с меткой `std/bench-copy` (режим `simulate-consumer`, [23](23-bench.md) §3). После истечения сегмента вызова `bench` строки остаётся доказательством: видно, какие строки выучены под прогоном, который позже оказался ошибочным (RN-24).
- **Удаление члена — только строкой обучения:** в `rules` `std/member` — `schema {required: [from]}` с `when: {path: value, eq: false}` ([21](21-compose.md) §2); строка `value: false` без вердикта — отказ коммита для любого писателя, с вердиктом — через гейт. Окно `removal_window` (ниже) считает код `learn` — граница хоста, как `from` у писателя с допуском (инв. 5, 7; RN-25).
- Для доверия автор строки с `from` — её `via`, сессия вердикта; основание — по таблице [14](14-trust.md) §3 с этим автором (подтверждения других групп дают `observed`), не `derived`.
- **Сессия `learn`** (T159) — её открывает хост (ADR-25) для участника `machine` из реестра владельца; `purpose: learn` резервирует этот домен; `software` у неё нет — свои строки она `derived` не делает. Допуск участнику: `core/grant {create: ["std/member", "std/learned-assert"]}`; `std/cue` открыта всем (`writers: any`) ([15](15-catalog.md) «Кто что пишет»).

**Поток** (RN-13):

```text
verdict(json, session) → commit(author {drafts: [std/verdict], by: session, key: verdict:<execution>:<solution>})
learn(verdict)         → строки по таблице ниже → commit(author {drafts: rows, by: сессия learn, key: learn:<verdict>})
```

- Хост вызывает `learn` после `verdict` и повторяет для вердиктов без коммита обучения: `learn` берёт засчитанный прогон кортежа вызова — `countedRun(view, tuple)` — и пишет его в `bench` строк; его нет или последний прогон — `fail` — вердикт ждёт `pass`; отказ коммита вердикт не теряет. Кортеж, который установленным кодом стадий не прогнать (хэши стадий в `code` ≠ установленным), `pass` уже не получит: `learn` отвечает находкой владельцу «не выучится без стенда на прежнем коде» со счётом таких вердиктов, а не вечным ожиданием (RN-34). Вызов вердикта старше горизонта (§7) — `learn` отказывает «вызов истёк», вердикт остаётся неучтённым.
- Какие вердикты учат, `learn` узнаёт у `classify(session@seq).teaches` ([14](14-trust.md) §1), своего списка `purpose` не держит: вердикты сессий стенда (`purpose: bench`) не обучают (T-5) — `learn` их не берёт, гейт отклонит; сессии `purpose: simulate` учат только в копии кампании. Кандидаты в эталоны из решений, выученных вердиктами, — только `subset: dev` ([23](23-bench.md), T-5).

| Вердикт | Диагноз | Что пишется (веса — `calibration.verdict_weights`; утверждения — `std/learned-assert` с `via`) |
|---|---|---|
| `same_need: false` | ошибка сопоставления, решение ни при чём | утверждение `wrong` (−1) на подсказку-формулировку, по которой `recall` признал потребность той же; отвергнутую пару `recall` больше не сводит ([21](21-compose.md) §3); решение не трогается |
| член `used` (`complete`, `incomplete`) | подтверждение | утверждение `confirm` (+1) на членство |
| член `unused` (`complete`, `incomplete`) | возможно лишнее | утверждение `unused` на членство — вес в сумме спора 0 по умолчанию (`verdict_weights.unused`); выдача входит в окно удаления (RN-26) |
| `none` | ничего не понадобилось | как `unused` для каждого члена |
| `incomplete` + `add` | неполно | `std/member {value: true, found_by: verdict, reason}` на каждый `add` |
| `incomplete` без `add` | неполно, без указания | ничего; метрика |
| `wrong` | ошибочно | утверждение `wrong` (−1) на все членства; дальше решает доверие: отвергнутое (`rejected`) или спорное решение `recall` отдаёт заново через LENS ([14](14-trust.md) TR-14, [21](21-compose.md) §3) |
| `unsure` | нет суждения | ничего |
| `task_only` | нужно задаче, не потребности | в решение не входит; остаётся в вердикте — кандидат в новую потребность для владельца (`explain`) |
| член `found_by: self-search`, `used` | промах LENS | подсказка `std/cue {target: блок@n, value: текст потребности}`; пара — кандидат в ловушку стенда ([23](23-bench.md)) |
| член `used`, у блока есть подсказка с тем же нормализованным текстом, что формулировка потребности | подтверждение подсказки | утверждение `confirm` на подсказку |

**Калибровка** — числа в `calibration` политики доверия ([14](14-trust.md) §4); `policy@rev` строки — версия, по которой она выведена; смена политики — ревизия, её проверяет стенд (`calibration-Δ`, [23](23-bench.md)):

- **Асимметрия** (ADR-20): добавить — `add_min_verdicts` (1) вердикт с причиной; удалить — член `unused` в `removal_window.n` (3) из последних `removal_window.m` (5) выдач. Выдача — вердикт на решение с этим членом; от группы независимости — её последний вердикт; кто считается, решает `classify(session@seq)` ([14](14-trust.md) §1, ADR-40): `countsInWindow` и `group` — сессии стенда и группа `(agent, unknown)` не считаются (TR-16), своего списка `purpose` у окна нет. Окно выполнено → `std/member {value: false}` с `from` — вердиктом, который его замкнул.
- **Раскачка:** членство переключалось ≥ `oscillation_cycles` раз → `contested` ([14](14-trust.md) §3) → находка владельцу.
- **Граница:** `add` сверх `max` правила `solution-size` `learn` не пишет — находка «разбить потребность» (`divide`, [21](21-compose.md) §6).
- **Слияние и разделение:** обучение, записанное, пока потребности были слиты, при `split` не откатывается — факты остаются на каноническом решении; разделение возвращает A её собственные факты ([11](11-identity-grain.md) GR-16).
- **Устаревание — не калибровка:** изменилась версия члена → `recheck`; отвечает — новый snapshot, доверие не меняется; не отвечает — обычный путь `incomplete`.

**Подсказки** (T72, RN-16):

- Рождается выученная подсказка из `used` члена `found_by: self-search` (таблица), основание `inferred`.
- Подтверждает её вердикт `used` той же пары (блок, формулировка) от другой группы независимости; та же формулировка другой группы — тот же факт (ключ `[target, norm(value)]`), её голос — утверждение. В карточку подсказка входит, если `inForce(cue)` ([14](14-trust.md) «Операции», [20](20-lens.md) LN-22).
- **Прежняя ревизия.** Подсказки в силе прежней ревизии устаревших членов повторённого решения проверяет стадия `recheck` (Composer: «подсказка верна для `@n`?», [21](21-compose.md) §4); «да» — `std/cue` на `блок@n` в `rows` вызова (`inferred`, со следом `match`, [21](21-compose.md) CP-25; дальше тот же путь к `observed`). Подсказки прежних ревизий остальных блоков в карточку не входят.

### 7. Воспроизведение

`replay(execution)` повторяет вызов на записанном (T-4) — **тем же интерпретатором** (§3) с `Deps` из записанных адаптеров `recorded(execution)` (ADR-44): живой, фиктивный и записанный адаптер — три адаптера одного шва; отдельной механики воспроизведения нет.

- `view` — `rt.ledger.view(execution.seq)`: пересборка `scan(0, execution.seq)` ([12](12-ledger.md) §5); `ids` — записанный адаптер отдаёт id, выданные стадиями исходного вызова, по порядку (`stages[].ids`, §3).
- Порты — записанные адаптеры: `judge.score` — баллы из `std/measurement` вызова ([20](20-lens.md) §6); composer, `judge.verify`, `judge.choose`, `source.*` — ответы из `calls` трассы (вход и выход — значения по хэшу, §3). Записи нет — ошибка стадии «нет записанного ответа»; живых вызовов портов нет, поэтому ревизия источника (`execution.source`) и версии адаптеров в replay не сверяются. Вызов `status: error` не воспроизводится: его `rows` не записаны, `replay` отвечает «нет записи».
- Код **стадий** (их хэши в `code`) = установленному — иначе отказ `code-changed`; адаптеры не сверяются: их ответы — из записи; модели = `setup@n` (RN-34).
- Журнал не пишет; выход — пакет и расхождение с исходным `output`: первая стадия, чей выход отличается.
- **Кэш — только ускорение**: потеря каталога кэша удорожает повтор, данные не теряет; ключ кэша определяет потребитель порта ([20](20-lens.md) §6, [21](21-compose.md) §8), ведёт обёртка `Recording` (§3); он включает модель@версию. Истина воспроизведения — журнал.
- **Что доказывает:** детерминизм кода и параметров вокруг LLM — регрессия и аудит (E6 первого запуска). Поведение моделей и устойчивость новых версий — стенд повторными прогонами с разбросом ([23](23-bench.md)), не одиночный replay.
- **Горизонт replay** (T160) — насколько старый вызов система обязуется воспроизвести; это срок сегмента исполнения ([12](12-ledger.md) §1, ADR-3), и не дальше установленного кода стадий: после релиза, изменившего модуль стадии, прежние вызовы отвечают `code-changed` — это граница горизонта, не сбой (RN-34). Он не меньше окна обучения: гейт читает `verdict.execution`, и вердикт истёкшего вызова не учится. Вызов старше горизонта: `replay` — `expired`, `learn` — отказ, `revalidate` по гейту — находка «не проверяемо» ([13](13-rules.md)). Число — замером первого запуска; до замера сегменты не истекают.

## Операции (CLI / API)

| Операция | Вход → выход |
|---|---|
| `solve(task, scope?)` | → `{pack}` или `{pending, task}` (режим агента); коммит вызова (§3) |
| `answer(execution, json)` | ответ агента на `pending` → адаптеру, перезапуск вызова (ADR-19; команда `lattice answer` — [30](30-adapters.md)) |
| `verdict(json)` | → коммит вердикта (§5); нарушение — отказ RL-11 |
| `learn(verdict)` | → коммит строк обучения сессией `learn` (§6); идемпотентен по вердикту; отказ гейта — вердикт ждёт `pass`; кортеж не прогнать установленным кодом — находка владельцу (RN-34) |
| `replay(execution)` | → пакет и расхождение с исходным; журнал не пишет; старше горизонта — `expired` (§7) |
| `explain(solution)` | → история решения: вердикты, доверие, snapshot'ы |
| `pending(view, namespace)` | → вердикты, ждущие `pass` (гейт отказал, строки обучения не записаны), и находки «не выучится» — вид очереди владельца ([15](15-catalog.md) §6); чистая функция журнала |

## Инварианты

1. Вызов пишет журнал одним коммитом (`execution` ∪ значения `std/payload` ∪ `needs[].rows`, ключ — id вызова) или коммитом только вызова с ошибкой и его значений; частичный результат вызова в журнале не виден (RN-03, RN-11).
2. Вызов стартует, только если нет ни одного отказа таблицы `run/tuple.startRefusals` (§3, RN-10).
3. Стадия меняет только пути своих `writes` и готовит строки только типов своих `emits`, где типов блоков нет; все стадии вызова читают журнал на одном `seq` старта (RN-02, RN-09, RN-36).
4. Вызов несёт кортеж исполнения (§1): `setup@n`, `code`, `prompts`, `policy`; версия ядра — заголовок `kernel` его коммита (RN-06). Вызов `ok` несёт все ответы портов: `calls` и `std/measurement` (RN-07).
5. Строка обучения несёт `from` (вердикт), `policy@rev` и `bench` (засчитанный прогон) и принимается, только если гейт обучения пропускает кортеж вердикта (RN-14, RN-24, ADR-29). Писатель с допуском, опустивший `from`, пишет собственный голос без `derived`: эту границу держит хост, а не коммит (T-16) — кроме удаления члена (инв. 7).
6. Один вердикт на пару `(execution, solution)` и один коммит обучения на вердикт — ключи коммитов; повтор ключа с другим содержимым — отказ `differs`; вердикт пишет участник сессии вызова или владелец (RN-04, RN-13, RN-33).
7. Член удаляется только строкой обучения: `std/member {value: false}` без `from` отклоняет коммит (правило типа), с `from` — гейт (RN-25). Что строку пишет окно `removal_window` по группам независимости — держит код `learn` (граница хоста, как в инв. 5); сессии стенда не входят ни в окно, ни в подтверждения (RN-05, T-5).
8. `replay` журнал не пишет и живых вызовов портов не делает; сверяет код только стадий (RN-07, RN-34).
9. Полный текст блока попадает в пакет, только если его хэш равен `text_hash` у `ref@n`; иначе — карточка с пометкой (RN-30).
10. Засчитанный прогон вычисляет одна функция `countedRun` ([13](13-rules.md) §2): `bench ≠ null` в пакете ⇔ гейт принимает строку обучения вердикта на этот вызов (ADR-42).
11. Рантайм не делает ввода-вывода сам: всё внешнее — из `Runtime` корня сборки; ход — порт `Progress`, `env` — от корня сборки (ADR-41).
12. Строка обучения с `from` несёт `via` — сессию вердикта; держит гейт (ADR-47).
13. `replay` — тот же интерпретатор с записанными адаптерами; отдельной механики воспроизведения нет (ADR-44).

## Решения

| ID | Решение | Почему |
|---|---|---|
| RN-01 | Конвейер — объект LATTICE, стадии — закреплённые способности; действующие конвейер и модели — ревизия `std/setup` пространства | самоописание; замена стадии — версия со стендом; смена модели и конвейера — одна обратимая ревизия. v0.4 · ADR-28 · PF-config |
| RN-02 | Стадия — `(ctx, params, deps) → Promise<ctx>` (v0.6: `Promise<Ctx \| Pending>`, RN-39), объявляет `reads`/`writes` и `determinism`; внешнее — только через порты `Deps`, журнал — `view` на `seq` старта | одна сигнатура вместо трёх; «чистая функция» не описывала стадии с LLM; все стадии видят одно состояние. v0.4 · T-3 · И-1, И-2 · П-29 · Q-64 C-2, C-3 |
| RN-03 | Один коммит на вызов: `execution` ∪ значения `std/payload` ∪ `needs[].rows`, ключ — id вызова; `materialize` внутри вызова строк не пишет | вызов виден целиком или не виден вовсе — пока вызов короткий и без `exec`, полный переигрыш идёт из кэша; появился `exec` или вызовы дольше нескольких минут → запись частями с завершающим фактом ([12](12-ledger.md) вопрос 1). v0.4 · ADR-19 · T-9 · И-5, И-6 · Ф-4 · Q-65 C-1, C-2 |
| RN-04 | Вердикт — событие `std/verdict@1` на каждое выданное решение: `execution`, диагноз `complete · incomplete · wrong · none · unsure`, член вне `used`/`unused` — нет сигнала; один на `(execution, solution)` — ключ коммита; `add[]` — существование `ref@n` и цитата | обучение различает ошибки; основание факта восстанавливается по вызову; повтор не удваивает обучение. v0.4 · И-10, И-11 · N-10 · Q-66 C-2, C-3 · D10b Q3 |
| RN-05 | Правила обучения — данные политики (`calibration`: `verdict_weights`, `add_min_verdicts`, `removal_window`); асимметрия: добавить — один вердикт с причиной, удалить — `unused` в 3 из последних 5 выдач по группам | нехватка дороже лишнего; вечное вето «ни разу не `used`» закрепляло ошибку; смена весов — ревизия, её проверяет стенд. v0.4 · ADR-20 · T-15 · И-14, И-15 · П-28 · Q-67 C-1, C-2 |
| RN-06 | Вызов — одно событие на вызов, трасса стадий — в его теле по схеме `std/execution@1`; оценки judge — отдельные события | событие — на исход вызова, а не на технический шаг; объём журнала дают оценки judge (~200 карточек на потребность), их срок — сегменты хранения ([12](12-ledger.md) §1). v0.4 · ADR-3 · И-17, И-18 · Q-68 C-1, C-3 |
| RN-07 | Воспроизведение читает журнал: `view` на `seq` вызова, `judge.score` — `std/measurement` вызова, остальные вызовы портов (composer, `judge.verify`, `judge.choose`, `source.*`) — `calls` трассы, `ids` — из записи (часов у стадий нет, `at` ставит коммит); вызов пишет их и при попадании в кэш; кэш — только ускорение; журнал не пишет | регрессия и аудит без повторной оплаты и без потерь при утрате кэша; доказывает детерминизм кода вокруг LLM, поведение моделей — стенд повторами. v0.4 · T-4 · И-8, И-20, И-21, И-22, И-23 · Ф-3 · Q-69 C-1…C-4 · D10b Q6 · C1 B5, B6 · C2c Q5 |
| RN-08 | Список стадий v1 линейный, без условий и возвратов; `intake` нет, `materialize` — стадия | `contract` проверяет чтения по порядку; граф — новой версией интерпретатора. v0.4 · ADR-18 · 10-kernel/И-31 · И-4 · D10a Q1 |
| RN-09 | Строки коммита готовят стадии (`rows` в `writes`), id новых объектов — у стадии, `expect` — из `view`; рантайм сверяет изменённые пути с `writes` | коммит собирается без знания типов; строки коммита ссылаются друг на друга; граница контракта держится кодом, не честностью объявления. v0.4 · T-3 · T-9 · D10a Q2, Q3, Q7 |
| RN-10 | Отказы на старте — одна таблица `run/tuple.startRefusals` (§3; v0.6 · ADR-42, ADR-45): исполняется ровно закреплённый кортеж; нет `bench-run pass` — пакет помечен, вызов разрешён | исполняется ровно закреплённый кортеж; способности проектов — после первого запуска; барьер — на обучении, не на вызове. v0.4 · T-2 · ADR-15 · ADR-19 · ADR-28 · ADR-29 · 20-lens/И-7 · v0.3 вопрос 3 · D10a Q5 |
| RN-11 | Сбой — вызов с ошибкой отдельным коммитом (таблица §3) вместе со значениями `std/payload` его трассы; обрыв — восстановление при `open()`; `pending` — ничего в журнале (брошенный — RN-37) | доля сбоев и аудит видны, частичный результат — нет; ссылки трассы разрешаются. v0.4 · T-9 · И-7 · Ф-8 · D10a Q4 · C2b 2·Q1 |
| RN-12 | Ход вызова — вне журнала, порт `Progress` (адаптер `progress-fs` — файл `.lattice/runs/<id>.log`); после коммита удаляется | видно, где идёт или упал долгий вызов, без промежуточных коммитов. v0.4 · И-9 · T-12 · D10a Q6 · v0.6 · ADR-41: порт вместо файла — ввод-вывод вне run |
| RN-13 | Вердикт и обучение — два коммита: вердикт — сессией потребителя, строки обучения — сессией `learn` (хост), ключ — вердикт; гейт отказал — вердикт ждёт `bench-run pass` своего кортежа | один `by` на коммит ([12](12-ledger.md) §2); стенд, прогнанный после вызова, не теряет вердикты. v0.4 · ADR-25 · ADR-29 · N-15 · D10b Q2 |
| RN-14 | Строка обучения — `from` (вердикт), `via` (сессия вердикта) и `policy@rev` в теле `std/member`, `std/cue`; утверждения — `std/learned-assert` (`extends core/assert@1`); строка с `from` несёт `via` — сверяет гейт (v0.6 · ADR-47); `learning-gate(from)` в их `rules`; автор для доверия — `via` | гейт держит коммит для любого писателя, ядро не растёт; основание факта восстанавливается; вывод не отмывает основание — не `derived`, основание по таблице 14 §3 с автором — сессией вердикта. v0.4 · ADR-29 · ADR-5 · T-15 · П-16 · И-11, И-15 · N-28 · D10b Q1 · C2b 2·Q2 |
| RN-15 | `same_need: false` — утверждение −1 на подсказку-формулировку; отвергнутую пару «формулировка — потребность» `recall` не сводит | формулировка — не сущность, `std/distinct` к ней не применим; память отказов, как у пар сущностей. v0.4 · D10b Q4 |
| RN-16 | Подсказка блока рождается из `used` члена self-search, подтверждается `used` той же пары (блок, формулировка) другой группой; прежняя ревизия — `recheck` для устаревших членов повторённого решения | путь к `observed` без круга «в карточке только `observed`»; подсказка не переживает смену смысла блока. v0.4 · 20-lens/И-9, И-10 · LN-10 · T-15 · D10b Q5 |
| RN-17 | Горизонт replay = срок сегмента исполнения, не меньше окна обучения; старше — `replay` → `expired`, `learn` — отказ, `revalidate` — «не проверяемо» | гейт читает `verdict.execution` — истёкший вызов не проверить; число — замером, до него сегменты не истекают. v0.4 · ADR-3 · T-12 · N-34 · D10b Q7 |
| RN-18 | Вердикт не пришёл — `unknown`: ничего не меняется; доля пропущенных — метрика | неявный `complete` закреплял бы непроверенное. v0.4 · v0.3 вопрос 1 · Q-22-1 |
| RN-19 | Голос вердикта — голос сессии потребителя (`via`) с весом её группы (агент — 0,5 по `weights`); `declared` и решающее «−» — только явный `core/assert` человека-владельца или декларанта, вердикт владельца — обычный голос его группы (TR-17) | вес — политика доверия ([14](14-trust.md) §4), не правило run. v0.4 · ADR-5 · ADR-26 · v0.3 вопрос 2 · Q-22-2 · v0.5 · CA-F35 |
| RN-20 | Кортеж исполнения определён один раз (§1): `setup@n` + `code` (хэши модулей из манифеста кода, v0.6 · ADR-42) + `prompts` judge + `policy@n` (v0.5, RN-24) + заголовок `kernel`; `bench-run` пишет его целиком, совпадение `pass` — по `setup@n`, `code`, `prompts`, `policy` | обновление адаптера или шаблона judge не наследует чужой `pass`; релиз замороженного ядра не требует платного перезапуска стенда. v0.4 · T-2 · ADR-22 · ADR-29 · C1 B3, E26 |
| RN-21 | `Ctx.run {execution, setup, bench}` заполняет рантайм, стадиям — только чтение; `materialize` пишет `needs[].solution {ref, snapshot}`; `deliver` читает `request.task`, `run`, `solution` | всё, что выводит пакет, видно в `reads` и проверяется `contract`; `rows` — строки для коммита, не вход стадий (RN-09). v0.4 · T-3 · C1 E31 · C2b 2·Q3 |
| RN-22 | Значения трассы — `std/payload@1` (`content`, `{json}`); пишет рантайм в коммит вызова, `ok` и `error` | ссылки трассы разрешаются (`ref-exists`), одинаковые запросы и ответы дедуплицируются; вызов не раздувается телами. v0.4 · T-4 · C1 E5 · C2b 2·Q1 |
| RN-23 | `used`/`unused` вердикта — по `id`, член относится к ревизии из snapshot вердикта; обучение периода слияния при `split` не откатывается | после правки X@4 → X@5 вердикт `used: [X]` отклонялся или относился не к той ревизии; ключ членства после CP-18 — `id`. v0.5 · CA-F33, CA-F24 |
| RN-24 | `policy@n` — в кортеже исполнения и в совпадении гейта; строка обучения выводится по политике кортежа вызова и несёт `bench` — засчитанный прогон | `update std` с новой политикой менял выдачу и обучение при старом `pass`; после истечения сегмента не узнать, какие строки выучены под ошибочным прогоном. v0.5 · ADR-29 · CA-F05, CA-F04, CA-F31 |
| RN-25 | Удаление члена — только строкой обучения: `schema {required: [from]}` при `value: false` у `std/member`; окно — код `learn` | «член удаляется только окном» держал код `learn`: агент с допуском удалял член одной строкой без `from` мимо гейта и окна. v0.5 · ADR-20 · CA-F07 |
| RN-26 | `unused` питает только окно удаления; вес в сумме спора — 0 по умолчанию | полезность и ложность складывались: член, нужный в 40 % задач потребности, становился `contested` без ошибки и отключал `recall`. v0.5 · ADR-20 · CA-F38 |
| RN-27 | Стадия объявляет порты полем `uses`; в `deps` — только порты `setup.ports`, нехватка — отказ на старте | `Deps.judge` был обязателен — настройка без LLM (базовые линии E1) не выражалась, и «BM25» у исполнителей расходился. v0.5 · CA-F47 |
| RN-28 | `std/verdict@1` несёт необязательное `evidence` — след исхода; в v1 не взвешивается | схема `std` закрыта: без поля вердикты v1 нельзя переинтерпретировать, когда появится источник следа. v0.5 · VI-05 · CA-F52, CA-F50 |
| RN-29 | Действующая настройка — объект `<пространство>/setup`; прочие `std/setup` — базовые линии, вызов их не читает | «один `std/setup` на пространство» противоречил «базовая линия — ревизия настройки»: ревизия `setup` меняла рабочий конвейер, отдельный объект нарушал «один». v0.5 · ADR-28 · CA-F34 |
| RN-30 | `deliver` сверяет хэш `text(ref)` с `text_hash` у `ref@n`: иначе в пакете карточка и пометка «источник изменён после загрузки»; тексты блоков в пакете и промптах — в разметке цитаты | доверие `ref@n` подписывалось под текстом рабочего дерева: отменённая норма выдавалась «observed», строка, дописанная в рабочее дерево, уходила в промпт с печатью «проверено». v0.5 · ADR-36 · CA-F11 |
| RN-31 | Вызов пишет `env` (`node`, `icu`); вне кортежа и совпадения гейта; кампания с разной `env` или `source` — `invalid` | копия журнала не защищает от правки живого источника и смены среды посреди кампании — δ искажалась молча; смена Node не должна отменять `pass`, как `kernel`. v0.5 · ADR-36 · CA-F41 |
| RN-32 | `composer-caller`: `model` участника сессии ≠ `setup.ports.composer.model` — отказ на старте; `Meta.model` — из ответа поставщика, ≠ `setup` — ошибка стадии; эндпоинт — допущение AR-09 | `describe().model` было эхом `setup`: агент M2 учил систему под `pass` модели M1, а RN-10 и `invalid` стенда были тавтологичны. v0.5 · CA-F19 |
| RN-33 | Вердикт на пару пишет участник сессии вызова (любая его сессия) или владелец пространства | «один вердикт на пару» становился правом первого: чужой участник, увидевший id вызова, занимал ключ, и вердикт потребителя тихо отбрасывался. v0.5 · CA-F20 |
| RN-34 | `impl.pins` решает хэш модуля, версия — справочно; replay сверяет только код стадий; горизонт replay — не дальше установленного кода; кортеж, который не прогнать, — находка владельцу | любой релиз останавливал `solve` и replay, у replay было два ответа про адаптеры, вердикты непрогоняемого кортежа ждали `pass` вечно. v0.5 · CA-F21 |
| RN-35 | Пороги — `params` конвейера проекта `<пространство>/pipeline.solve`, калибровка пишет его ревизию и ревизию `setup`; `min_p` — в политике пространства; `candidates.calibrated_for` ≠ judge — кандидаты как без калибровки, пометка | пороги жили в `std/pipeline.solve@1`, который проект не пишет: «калибровка пишет ревизию `setup`» было не выразить; `calibrated_for` у `min_p` никто не сверял. v0.5 · CA-F40 |
| RN-36 | Способность объявляет типы строк `emits`; рантайм сверяет с ними `rows` (ошибка стадии), `contract` не допускает в `emits` типов блоков | `writes` ограничивал пути `ctx`, не типы строк: «Runtime не создаёт и не правит блоки» держалось честностью кода стадии, а при вызове владельцем `owner` пропустил бы ревизию любой нормы с основанием `declared`. v0.5 · CA-F48 |
| RN-37 | Брошенный `pending` (старше `pending_ttl` хоста) закрывает следующая `solve` или `answer` — вызов с ошибкой `abandoned` её сессией; `answer` на него — отказ. Уточняет RN-11 | брошенные вызовы не оставляли следа — не входили ни в долю сбоев и вызовов без вердикта, ни в цену. v0.5 · CA-F58 · v0.6 · ADR-41: брошенные отдаёт `Progress.abandoned` — тест на фиксированных часах |
| RN-38 | Кортеж в коде — модуль `run/tuple` (`capture`, `startRefusals`, `matches`); зерно `code` — модуль из манифеста кода; засчитанный прогон — `countedRun` ядра | кортеж сверялся в семи местах, T200 был записан четырежды; кто вычисляет `code`, не было сказано, а пример ключевал по пакету против RN-34 — при зерне «пакет» любой релиз ломал совпадение гейта и replay. v0.6 · ADR-42 · П-37 |
| RN-39 | Рантайм — `run(request, session, rt: Runtime, resume?) → {pack} \| {pending, task}`, `Runtime` — выход `assemble` (`ledger`, `namespace`, `deps` без `view`, `progress`, `clock`, `ids`, `manifest`, `env`, `pendingTtl` — уточнено F: рантайм пишет только `rt.ledger.commit`, `x` перезапуска — из `resume`); стадия может вернуть `Pending` (`{kind, prompt_hash, input, schema}`); ход — порт `Progress` (адаптеры fs, memory; `resume`, `reset` — для перезапуска); ответ агента привязан к кортежу вызова: перезапуск с другим кортежем (`sameTuple`) сбрасывает ответы, ключ ответа — `(kind, prompt_hash, хэш input)` | файл хода, `pending_ttl` и `env` процесса были вводом-выводом в run мимо портов; `run() → pack` не называл `pending`; ревизия `setup` между `pending` и `answer` переигрывала бы старый ответ под новым промптом. v0.6 · ADR-41 |
| RN-40 | Replay — тот же интерпретатор с записанными адаптерами `recorded(execution)`; сквозное поведение портов LLM (кэш, LN-18, `Meta.model`, запись) — обёртка `Recording` | один порт judge записывался двумя механизмами, ключ кэша жил в каждом адаптере, replay был отдельной механикой. v0.6 · ADR-44 |
| RN-41 | Калибровку рантайм сверяет обобщённо по полю `calibrated` способности (`CalibratedThreshold`, `onMismatch`); имён стадий интерпретатор не знает | три места `calibrated_for` с тремя поведениями; интерпретатор знал, что `threshold` — это `score`, а `recall` — `verify`. v0.6 · ADR-45 |
| RN-42 | Порта `exec` нет: способность с `impl.adapter` ≠ `builtin` — отказ на старте | ноль адаптеров и потребителей — гипотетический шов; тип был бы долгом без проверки. v0.6 · разбор 2026-09-29, кандидат 11 |
| RN-43 | `learn` и окно удаления читают свойства сессии у `classify` ([14](14-trust.md)), своих списков `purpose` не держат | пять читателей `purpose` — пять мест, где новое значение надо не забыть. v0.6 · ADR-40 |

## Вопросы для grilling

Открытых нет: v0.3 вопрос 3 закрыт в v0.4 — RN-10, вопросы 1–2 — RN-18, RN-19.

## Вне объёма

- Параллельное исполнение стадий, распределённый runtime.
- Граф стадий и условия в конвейере — новой версией интерпретатора (ADR-18). Триггер — стадия, которая должна исполняться по условию, которое её собственный пропуск (`done`, нет кандидатов) не выражает. В v1 уже сейчас: ничего сверх — пропуск внутри стадии.
- **Несколько конвейеров в пространстве** — действующая настройка одна (`<пространство>/setup`, RN-29); второй сценарий проекта с другим конвейером менял бы общий `setup@n` и требовал полной регрессии ради чужой правки. Решение — имя настройки в запросе (по умолчанию `setup`) и её в кортеже вызова. Триггер — второй сценарий проекта со своим конвейером. В v1 уже сейчас: настройка находится по имени, базовые линии — отдельные объекты `std/setup`.
- **Единица работы ≠ потребность.** `std/ctx@1` — модель compose (`needs[]`), интерпретатор коммитит только `needs[].rows`, вердикт и обучение — только на пару `(execution, solution)`. Конвейер, чья единица — не потребность (находка анализа, проверка, ответ), — `std/ctx@2`, новая версия интерпретатора и свои типы вердикта и обучения; настройкой v1 он не выражается (видение VI-05). Триггер — второй конвейер, чья единица — не потребность. В v1 уже сейчас: ничего сверх — `ctx` версионирован (`std/ctx@1`), данные v1 при переходе не портятся.
- Запись вызова частями с завершающим фактом — вариант (б) ADR-19, [12](12-ledger.md) вопрос 1.
- **Сигнал сессий внутри группы автора** — когда все потребители одной модели с автором решений, их вердикты — голос группы автора: `observed` недостижимо, окно удаления не замыкается, работает только `add` (F10). Механизм — ступень 6, только по замеру. Триггер — метрики стенда «групп с вердиктами за окно» и «доля решений с замыкаемым окном» ([23](23-bench.md) §2) на живых вердиктах ниже порога, который владелец пишет в регрессионный план. В v1 уже сейчас: обе метрики и прогон «потребители — группа автора» в R8 ([01](../01-first-run.md)).
- **Вес следа исхода** — поле `evidence` в вердикте есть (RN-28), но в v1 не взвешивается; политика сможет весить такие вердикты выше (И-12). Триггер — адаптер потребителя пишет `evidence` (первые вердикты с непустым полем). В v1 уже сейчас: поле в `std/verdict@1`.
- **Якорение пакетом** — пакет показывает потребителю доверие («решение observed»), и вердикт может повторять метку: метка → `used` → метка (довод ADR-26 о коррелированности одной модели применим к пакету целиком). Гипотеза о поведении агентов, на вердиктах симуляторов не видна. Триггер — живые вердикты агентов (не `simulate`): доля `used` у членов с меткой доверия и без неё; разрыв выше порога владельца — слепая шапка (без меток) для доли выдач. В v1 уже сейчас: ничего сверх — пакет с метками лежит в трассе (`output`, `std/payload`, не истекает), замер делается задним числом. CA-F39.
- Копия `setup@n` в вердикте ради гейта за горизонтом — нет: значение писал бы код `verdict()`, а гейт читает `verdict.execution` (ADR-29, D10b Q7 (б)).
- `replay` как проверка нового кода — нет: код ≠ записи — отказ; новый код проверяет стенд новой версией конвейера.
