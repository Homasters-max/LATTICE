# 22. run — конвейер, исполнение, вердикт, обучение

**Назначение.** Исполнить конвейер (хранится в LATTICE), выдать результат потребителю, принять вердикт и превратить
его в факты и утверждения — замкнуть цикл.

**Зависит от:** все домены выше; порты `judge` ([20](20-lens.md) §5), `composer`, `source` ([21](21-compose.md) §8),
`clock`, `ids` ([12](12-ledger.md) §5) — контракты у владельцев (ADR-24); порт `exec` и формат `Meta` определяет этот
домен (§3). **Используют:** bench, CLI и хост ([30](30-adapters.md)), адаптеры проектов.

## Модель

### 1. Конвейер и настройка исполнения

**Конвейер** (`std/pipeline@1`, T95) — составная способность в LATTICE: тело `{title, input, output, stages[]}`,
стадия — `{name, cap: ref@n, params?}`.

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
        "params": {"same_hi": 0.85, "same_lo": 0.5, "top_n": 5, "calibrated_for": null} },
      { "name": "recheck",     "cap": {"$ref": "std/stage.recheck@1"} },
      { "name": "id-lookup",   "cap": {"$ref": "std/stage.id-lookup@1"} },
      { "name": "pool",        "cap": {"$ref": "std/stage.pool@1"},        "params": {"pool_max": 200, "cues_max": 10} },
      { "name": "bm25",        "cap": {"$ref": "std/stage.bm25@1"} },
      { "name": "judge",       "cap": {"$ref": "std/stage.judge@1"} },
      { "name": "fuse",        "cap": {"$ref": "std/stage.fuse@1"},        "params": {"mode": "linear", "bm25_weight": 0.3} },
      { "name": "trust",       "cap": {"$ref": "std/stage.trust@1"} },
      { "name": "threshold",   "cap": {"$ref": "std/stage.threshold@1"},   "params": {"no_match": 0.6, "calibrated_for": null} },
      { "name": "cut",         "cap": {"$ref": "std/stage.cut@1"},         "params": {"k": 20} },
      { "name": "select",      "cap": {"$ref": "std/stage.select@1"} },
      { "name": "self-search", "cap": {"$ref": "std/stage.self-search@1"} },
      { "name": "check",       "cap": {"$ref": "std/stage.check@1"} },
      { "name": "materialize", "cap": {"$ref": "std/stage.materialize@1"} },
      { "name": "deliver",     "cap": {"$ref": "std/stage.deliver@1"},     "params": {"header": "…"} }
    ] } }
```

- Стадии, их `reads`/`writes` и параметры определяют владельцы: LENS — [20](20-lens.md) §4, compose и `materialize` —
  [21](21-compose.md) §4, `deliver` — §4 здесь. Промпты стадий Composer — в их `params` ([21](21-compose.md) §8); в
  примере опущены. `select` своего `max` не несёт — читает `solution-size` из `std/member`.
- Все ссылки закреплены (`refs: pin`, CT-06). При публикации конвейера `contract` проверяет, что каждое чтение
  записано раньше — входом конвейера (`request.*`) или `writes` предыдущей стадии ([13](13-rules.md) §3, T132).
- **Конвейер v1 — линейный список без условий и возвратов** (ADR-18, T-3): стадия, которой нечего делать с
  потребностью (`done`, нет кандидатов), её пропускает; `self-search`, если нужно предложить выбор заново, делает это
  внутри своей реализации, а не возвратом к `select`. Граф стадий — новой версией интерпретатора, когда путей станет
  > 2 (10-kernel/И-31).
- Замена стадии, параметра или текста `header` = **новая версия конвейера**; её проверяет регрессия стенда
  ([23](23-bench.md)). Стадии `intake` нет: запрос по схеме `std/ctx` проверяет рантайм до первой стадии (§3).

**Настройка исполнения** (`std/setup@1`, T126, ADR-28) — один объект на пространство имён (например
`warrant/setup`); ревизии пишет владелец пространства (правило `owner`).

```json
{ "id": "warrant/setup", "type": "std/setup@1",
  "body": { "pipeline": {"$ref": "std/pipeline.solve@1"},
            "ports": { "judge":    { "adapter": "judge-jev",       "model": "<точная версия>" },
                       "composer": { "adapter": "composer-claude", "model": "<точная версия с датой>" },
                       "source":   { "adapter": "source-warrant" } } } }
```

- Конвейер и модели меняются вместе одной ревизией; откат — ещё одна ревизия. `model` — точный идентификатор
  версии: алиас провайдера — отказ на старте (§3). Где лежат адаптеры и секреты — проводка `bindings`
  ([30](30-adapters.md), T128).
- Вызов закрепляет `setup@n`. **Кортеж исполнения** (T131) = `setup@n` + `impl.pins` стадий + `prompt_hash` + версия
  ядра (заголовок `kernel`, T113) — пишется в вызов (§3).
- Порт `exec` в `ports` появится вместе со способностями проектов — не в первом запуске (RN-10).

### 2. Контекст конвейера (`std/ctx`) и стадия

```ts
type Ctx = {
  request: { task: string; scope?: Ref; session: Ref; budget?: { usd?: number; ms?: number } }
  needs: Array<{
    text: string; norm?: string; scope?: Ref; findings?: Finding[]            // frame, normalize, route
    terms?: Ref[]; boosts?: Ref[]                                             // lexicon
    key?: string; need?: Ref                                                  // recall
    recall?: { solution: Ref; snapshot: Id; status: 'fresh' | 'stale' | 'broken';
               by: 'exact' | 'judge' | 'composer'; p?: number }
    candidates?: Candidate[]; pool?: Id; measurement?: Ref                    // id-lookup … cut
    scores?: Record<Id, { bm25?: number; judge?: number; fused?: number }>
    outcome?: 'candidates' | 'no-match'                                       // threshold
    selection?: Selection; found?: Ref[]                                      // select, self-search
    rows?: Row[]; done?: boolean
  }>
  pack?: Pack                                                                 // deliver
  notes?: string[]
}
```

- `request.session` — сессия, которую открыл хост (ADR-25, [14](14-trust.md) §1): участник, его вид и `purpose`
  берутся из неё, отдельного `actor` в запросе нет.
- Типы полей — у владельцев: `Candidate` (T87: `ref`, `card`, `scores`, `trust`, `marks`, `why`) — [20](20-lens.md) §7;
  `Selection` с собственным `outcome` (`selected` · `none-fit` · `absent` · `coverage`) — [21](21-compose.md) §7;
  `Finding` (T44) — [13](13-rules.md); `Row` — [12](12-ledger.md); `Pack` — §4. `needs[].outcome` — вывод порога LENS;
  исход выбора — `selection.outcome`.
- `found` (T152) пишет код по ответу `source.grep`, `found_by` членов ставит код ([21](21-compose.md) §5).
- **`rows`** (T156) — строки журнала, которые стадия готовит для коммита вызова (RN-03): значения `std/pool` и
  `std/card` (`pool`), `std/measurement` (`judge`), потребности, подсказки и кандидаты в алиасы (`recall`), `std/gap`
  (`self-search`), решение, `std/member`, `std/link`, snapshot (`materialize`). Стадия объявляет `rows` в `writes`.
  Новый объект получает id у стадии — `newId(namespace, deps.ids.ulid())`: строки одного коммита ссылаются друг на
  друга (оценка → потребность, → вызов). Строка, которая меняет существующую сущность, несёт `expect` — версию,
  прочитанную из `view`.
- `notes` — заметки стадии для трассы (`threshold: uncalibrated`, `recall: uncalibrated`); в `writes` не объявляются,
  рантайм переносит их в `note` стадии и очищает.
- Пути `reads`/`writes` внутри потребности — `needs[].<поле>` (T132); `request.*` — вход конвейера.

**Стадия** (T96) — способность `std/stage.<имя>` ([13](13-rules.md) §3):

```ts
type Stage = (ctx: Readonly<Ctx>, params: Json, deps: Deps) => Promise<Ctx>
type Deps  = { judge: Judge; composer: Composer; source: Source; exec: Exec; clock: Clock; ids: Ids; view: View }
```

- Вход заморожен, стадия возвращает новый объект. Внешнее — только через порты `deps`; стадия с портами LLM
  объявляет это полем способности `determinism` ([13](13-rules.md) §3). Стадия не знает о соседях.
- `view` (T133) — чтения индекса ([12](12-ledger.md) «Операции»: `get`, `history`, `facts`, `find`, `consumers`) и
  `trust()` ([14](14-trust.md)) на `seq` старта вызова: все стадии видят одно состояние. `store` стадии не получают —
  пишет только рантайм (RN-03).

### 3. Рантайм — интерпретатор

```text
run(request, session) → pack:                           // сессию открыл хост (ADR-25)
  setup = view.get(<пространство>/setup)                  // ревизия setup@n
  x     = newId(namespace, ids.ulid()); seq = view.seq    // id вызова: ключ коммита, файл хода, lattice answer
  старт: request по схеме std/ctx; describe() портов, impl.pins, calibrated_for, exec — отказы (RN-10)
  bench = bench-run pass на кортеж исполнения или null     // null → пакет «не проверено стендом» (ADR-29)
  ctx = {request, needs: []}
  for stage in setup.pipeline.stages:
      out = impl(freeze(ctx), stage.params, deps)         // builtin; exec — проекция ctx по reads
      изменённые пути ⊆ writes — иначе ошибка стадии       // RN-09
      trace += {name, cap@n, status, ms, usd?, error?, note?, calls?}; строка в .lattice/runs/<x>.log
      сумма Meta ≤ request.budget — иначе ошибка
      ctx = out
  commit([execution x] ∪ needs[].rows, session, expect из rows, key = x)   // один коммит (RN-03)
  удалить файл хода; return ctx.pack
```

- **Реестр реализаций:** `impl: {adapter: "builtin", name, pins}` → функция пакета; рантайм исполняет её, только если
  модуль совпадает с `pins` (версия пакета + хэш) и версия способности не отозвана (ADR-15, T-2). `adapter: "exec"` —
  порт `exec`, не в первом запуске.
- **Отказы на старте** (до первой стадии): запрос не по схеме `std/ctx`; `describe().model` порта ≠ модели из `setup`
  (алиас, подмена); код стадии ≠ `impl.pins`; `calibrated_for` стадии ≠ `{adapter, model, prompts[вид вызова]}` judge
  (`threshold` — `score`, `recall` — `verify`, T136); стадия `exec`.
- **Гейт стенда** (ADR-29): рантайм ищет `bench-run pass` на кортеж исполнения по плану с `base` на регрессионный план
  владельца и тем же `setup@n` (ADR-22). Не нашёл — вызов разрешён, пакет помечен «не проверено стендом»,
  `execution.bench: null`. Запрет обучения держит коммит (примитив `learning-gate`, [13](13-rules.md) §2), а не рантайм.
- **Бюджет:** `request.budget` сверяется после каждой стадии по сумме `Meta` вызовов портов; у `std/setup` бюджета
  нет — он в плане стенда ([23](23-bench.md)).
- **Режим агента** (`composer-caller`, ADR-19): `pending` от Composer останавливает вызов; `answer(x, json)` кладёт
  ответ в кэш composer и перезапускает вызов с тем же id.

**Сбой → что пишется** (RN-11):

| Сбой | Что пишется |
|---|---|
| отказ на старте, ошибка стадии (невалидный выход Composer, запись вне `writes`), превышен бюджет | коммит только `std/execution {status: error}` с трассой до сбоя, `key` = id вызова; `rows` не пишутся, оплаченные оценки остаются в кэше адаптера |
| отказ коммита вызова (`hard`, конфликт `expect`, зарегистрированное значение) | то же, в `error` — нарушения `{row, rule, message}`; повтор — новым вызовом, оценки — из кэша |
| отказ и этого коммита | только файл хода |
| обрыв процесса | хвост без маркера `core/commit` → `.lattice/recovered/` при `open()` ([12](12-ledger.md) §2), без `lock()`; где остановился — в файле хода |
| `pending` (режим агента) | в журнал — ничего; файл хода со статусом `pending`; `answer` перезапускает вызов |

**Файл хода** (T155) `.lattice/runs/<id вызова>.log` — построчно `{stage, need?, at, ms?, status}`: телеметрия вне
журнала, не истина и не вход replay. Его писатель проходит проверку «нет зарегистрированных значений», как все
писатели `.lattice/` (T-12, [12](12-ledger.md) LG-16). После успешного коммита файл удаляется — трасса уже в
`std/execution`; при сбое и `pending` остаётся.

**Вызов** (`std/execution@1`, T98) — событие в сегменте исполнения ([12](12-ledger.md) §1, ADR-3):

```json
{ "id": "warrant/01J8…X", "type": "std/execution@1",
  "body": { "setup": {"$ref": "warrant/setup@3"}, "pipeline": {"$ref": "std/pipeline.solve@1"},
            "code": { "lattice-lens": "0.4.0", "judge-jev": "0.4.1", "composer-claude": "0.2.0" },
            "source": "<ревизия источника>", "seq": 18234, "bench": {"$ref": "warrant/01J8…B"},
            "status": "ok", "input": "#5d1a…", "output": "#c7e0…",
            "stages": [
              { "name": "judge", "cap": {"$ref": "std/stage.judge@1"}, "status": "ok", "ms": 840, "usd": 0.012 },
              { "name": "select", "cap": {"$ref": "std/stage.select@1"}, "status": "ok", "ms": 2100, "usd": 0.03,
                "calls": [ { "port": "composer", "kind": "select", "prompt_hash": "sha256:…",
                             "input": "#81f4…", "output": "#0b9e…" } ] } ] } }
```

- `setup@n`, `pipeline@n`, `code` (фактические версии пакетов стадий и адаптеров), `prompt_hash` вызовов — кортеж
  исполнения; версия ядра — только заголовок `kernel` коммита (T113), в теле её нет.
- `source` — ревизия содержимого источника, которую адаптер `source` отдал вместе с текстами пакета (PF-04).
- `seq` — последний `seq` журнала на старте: на нём строится `view` (воспроизведение — §7).
- `bench` — найденный `bench-run pass` или `null`.
- `input`, `output` — значения запроса и пакета по хэшу; `calls` — ответы composer (вход и выход — значения по
  хэшу, [12](12-ledger.md) §1). Оценки judge — отдельные события `std/measurement` со ссылкой `execution`
  ([20](20-lens.md) §6).
- `status: error` — поле `error: {stage?, kind, message, violations?}`; у стадии — своё `error`.

**Сводка ответа порта и идентичность** — общие для портов LLM (judge, composer); порт `exec`:

```ts
type Meta  = { adapter: string; model: string; usd: number; ms: number;
               tokens?: { in: number; out: number }; detail?: Json }
type Ident = { adapter: string; model: string; prompts?: Record<string, string> }   // prompt_hash по виду вызова
interface Exec { invoke(impl: Impl, r: { ctx: Json; params: Json }): Promise<{ ctx: Json; meta?: Meta }> }
```

- `Meta` (T135) рантайм читает для бюджета и пишет в трассу. Хэшей в `Meta` нет: идентичность — `describe()` и
  кортеж, ключ кэша — у адаптера.
- `describe(): Ident` (T154) — у judge ([20](20-lens.md) §5: `prompts` для `score`, `verify`, `choose`) и composer
  ([21](21-compose.md) §8: без `prompts` — промпт стадии в её `params`, хэш считает рантайм); вызывается на старте.
- `Exec` — контракт для способностей проектов (ADR-24: потребитель — рантайм): `ctx` на входе — проекция по `reads`,
  на выходе — дополнение по `writes`. Не в первом запуске (RN-10).

### 4. Выдача (`deliver`) — пакет

Стадия `deliver` (код + порт `source`): `reads` — `needs[].text`, `needs[].recall`, `needs[].selection`,
`needs[].findings`; `writes` — `pack`; параметр `header`. Для знаний пакет — то, что попадает в промпт агента:

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

- Тексты и места даёт порт `source` проекта (`text`, `locate`, [21](21-compose.md) §8); ревизия источника уходит в
  `execution.source`.
- `header` — параметр стадии, его текст — часть версии конвейера (PF-config §3.5). Граница, сказанная в шапке,
  дублируется проверкой кода: закрытый мир держит `check` ([21](21-compose.md) §5), вердикт — метрика доли
  пропущенных ([21](21-compose.md) «текст ↔ проверка»).
- Пометки кандидатов (`marks`: `inferred`, `contested`, `deprecated`) и основание решения — в строке потребности.
- Пакет — также JSON для машин того же состава; в нём `execution` — id вызова, на который ссылается вердикт (§5).

### 5. Вердикт

Потребитель отвечает на **каждое выданное решение** в конце использования:

```json
{ "type": "std/verdict@1",
  "body": { "solution": {"$ref": "warrant/SOL-…"}, "snapshot": "#3fa2…", "same_need": true,
            "status": "complete | incomplete | wrong | none",
            "used": ["warrant/REQ-VER-007"], "unused": ["warrant/REQ-VER-003"],
            "add": [{ "ref": "warrant/ADR-0034", "reason": "«…»" }],
            "task_only": ["warrant/ADR-0036"], "note": "…" } }
```

### 6. Обучение — правила «вердикт → факты»

| Вердикт | Диагноз | Что пишется (сессия `learn`, `machine`, основание `derived` от вердикта) |
|---|---|---|
| `same_need: false` | ошибка сопоставления, решение ни при чём | `std/distinct` (эта формулировка ≠ сохранённая потребность); решение не трогается |
| `complete`, всё `used` | подтверждение | утверждение +1 (вес участника-потребителя) на каждое членство |
| `complete`, есть `unused` | возможно лишнее | утверждение −0,3 на членство `unused` |
| `incomplete` + `add` | неполно | факты членства `add` с причиной (основание `inferred`, пока не подтвердят) |
| `wrong` | ошибочно | утверждение −1 на все членства → `contested` → при следующем запросе заново через LENS |
| `task_only` | нужно задаче, не потребности | в решение не входит; текст → кандидат в новую потребность (подсказка) |
| член `via: self-search` | промах LENS | кандидат в ловушку стенда; подсказка блоку из текста потребности (`inferred`) |

Калибровка (пороги — политика доверия, [14](14-trust.md) п. 4):

- **Асимметрия:** добавить — один вердикт с причиной; удалить — член `unused` в ≥ 3 разных сессиях и ни разу не
  `used` → факт членства `value: false`.
- **Раскачка:** член добавлен и удалён ≥ 2 раз → `contested` → находка владельцу.
- **Граница:** после добавления > 7 → не добавлять, находка «разбить потребность».
- **Устаревание — не калибровка:** изменилась версия члена → `recheck`; отвечает — новый snapshot, доверие не
  меняется; не отвечает — обычный путь `incomplete`.

### 7. Воспроизведение

Закреплённый конвейер + кэш judge (по ключу оценки) + кэш composer (по `prompt_hash` + входу) → повторный прогон
того же запроса даёт побайтно тот же пакет. Это проверка регрессии и аудита (E6 первого запуска).

## Операции (CLI / API)

| Операция | Вход → выход |
|---|---|
| `solve(task, scope?)` | → пакет; коммит вызова (§3) |
| `answer(execution, json)` | ответ агента на `pending` → кэш composer, перезапуск вызова (ADR-19; команда `lattice answer` — [30](30-adapters.md)) |
| `verdict(json)` | → факты и утверждения |
| `replay(execution)` | → пакет; сравнение с исходным |
| `explain(solution)` | → история решения: вердикты, доверие, snapshot'ы |

## Инварианты

1. Вызов пишет журнал одним коммитом (`execution` ∪ `needs[].rows`, ключ — id вызова) или коммитом только вызова с
   ошибкой; частичный результат вызова в журнале не виден (RN-03, RN-11).
2. Стадия исполняется, только если её код совпадает с `impl.pins`, версия не отозвана, модели портов совпадают с
   `setup@n`, а `calibrated_for` — с `describe()` judge (RN-10).
3. Стадия меняет только пути своих `writes`; все стадии вызова читают журнал на одном `seq` старта (RN-02, RN-09).
4. Вызов несёт кортеж исполнения: `setup@n`, `pipeline@n`, `code`, `prompt_hash` вызовов; версия ядра — заголовок
   `kernel` его коммита (RN-06).

## Решения

| ID | Решение | Почему |
|---|---|---|
| RN-01 | Конвейер — объект LATTICE, стадии — закреплённые способности; действующие конвейер и модели — ревизия `std/setup` пространства | самоописание; замена стадии — версия со стендом; смена модели и конвейера — одна обратимая ревизия. v0.4 · ADR-28 · PF-config |
| RN-02 | Стадия — `(ctx, params, deps) → Promise<ctx>`, объявляет `reads`/`writes` и `determinism`; внешнее — только через порты `Deps`, журнал — `view` на `seq` старта | одна сигнатура вместо трёх; «чистая функция» не описывала стадии с LLM; все стадии видят одно состояние. v0.4 · T-3 · И-1, И-2 · П-29 · Q-64 C-2, C-3 |
| RN-03 | Один коммит на вызов: `execution` ∪ `needs[].rows`, ключ — id вызова; `materialize` внутри вызова строк не пишет | вызов виден целиком или не виден вовсе — пока прогон короткий и без `exec`, полный переигрыш идёт из кэша; появился `exec` или прогоны дольше нескольких минут → запись частями с завершающим фактом ([12](12-ledger.md) вопрос 1). v0.4 · ADR-19 · T-9 · И-5, И-6 · Ф-4 · Q-65 C-1, C-2 |
| RN-04 | Вердикт — на каждое выданное решение, типизированный диагноз | обучение различает ошибки |
| RN-05 | Правила обучения — данные политики; асимметрия добавления и удаления | нехватка дороже лишнего; ошибку сложно закрепить |
| RN-06 | Вызов — одно событие на прогон, трасса стадий — в его теле по схеме `std/execution@1`; оценки judge — отдельные события | событие — на исход прогона, а не на технический шаг; объём журнала дают оценки judge (~200 карточек на потребность), их срок — сегменты хранения ([12](12-ledger.md) §1). v0.4 · ADR-3 · И-17, И-18 · Q-68 C-1, C-3 |
| RN-07 | Воспроизведение через кэши judge и composer | регрессия и аудит без повторной оплаты |
| RN-08 | Список стадий v1 линейный, без условий и возвратов; `intake` нет, `materialize` — стадия | `contract` проверяет чтения по порядку; граф — новой версией интерпретатора. v0.4 · ADR-18 · 10-kernel/И-31 · И-4 · D10a Q1 |
| RN-09 | Строки коммита готовят стадии (`rows` в `writes`), id новых объектов — у стадии, `expect` — из `view`; рантайм сверяет изменённые пути с `writes` | коммит собирается без знания типов; строки коммита ссылаются друг на друга; граница контракта держится кодом, не честностью объявления. v0.4 · T-3 · T-9 · D10a Q2, Q3, Q7 |
| RN-10 | Отказ на старте: модель порта ≠ `setup`, код ≠ `impl.pins` или версия отозвана, `calibrated_for` ≠ `describe()` judge, стадия `exec`; нет `bench-run pass` — пакет помечен, вызов разрешён | исполняется ровно закреплённый кортеж; способности проектов — после первого запуска; барьер — на обучении, не на вызове. v0.4 · T-2 · ADR-15 · ADR-19 · ADR-28 · ADR-29 · 20-lens/И-7 · v0.3 вопрос 3 · D10a Q5 |
| RN-11 | Сбой — вызов с ошибкой отдельным коммитом (таблица §3); обрыв — восстановление при `open()`; `pending` — ничего в журнале | доля сбоев и аудит видны, частичный результат — нет. v0.4 · T-9 · И-7 · Ф-8 · D10a Q4 |
| RN-12 | Ход вызова — файл `.lattice/runs/<id>.log` вне журнала; после коммита удаляется | видно, где идёт или упал долгий прогон, без промежуточных коммитов. v0.4 · И-9 · T-12 · D10a Q6 |

## Вопросы для grilling

v0.3 вопрос 3 закрыт в v0.4 — RN-10.

1. **Вердикт не пришёл** (агент забыл) — считать «unknown» или неявным `complete`? Рекомендация: `unknown` — ничего не
   менять; доля пропущенных вердиктов — метрика.
2. **Вес вердикта агента** — как у любого агента (0,5)? Рекомендация: да; `declared` — только человек.

## Вне объёма

- Параллельное исполнение стадий, распределённый runtime.
- Граф стадий и условия в конвейере — новой версией интерпретатора (ADR-18).
- Запись вызова частями с завершающим фактом — вариант (б) ADR-19, [12](12-ledger.md) вопрос 1.
