# Аудит C1 — ownership (сама сессия)

Разрез: каждое понятие определено в одном месте, остальные ссылаются. Опора: `design-lint --index` (PASS, 0 новых
ошибок), `integration/ownership.md`, таблицы «Модель» доменов, JSON-примеры типов (`grep '"type": "…@n"'`).

| Н | Где (design/…:NN) | Против чего | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|
| O-1 | `design/domains/12-ledger.md:147-158` (Операции) · `design/domains/22-run.md:119`, `:124`, `:133`, `:346` | `design/04-architecture.md:82` | 04: «ledger/ types.ts (Store, Clock, Ids, View, Projection)»; 22-run:119 `view: View`, :133 «seq = view.seq», :346 «`view` — на `scan(0, execution.seq)`». В 12-ledger типа `View` нет, операции (`get`, `history`, `facts`, `find`, `consumers`) — без `seq` и без построения чтения на прошлом `seq` (индекс — текущий, §3). Подтверждает N-65 | исправить | 12-ledger §5: `type View = {seq; get; history; facts; find; consumers}` и операция `viewAt(seq)` (индекс на `seq` — пересборкой `scan(0, seq)`); 22-run ссылается |
| O-2 | `design/00-vision.md:68` · `design/domains/10-kernel.md:109` · `design/domains/15-catalog.md:103` · `design/domains/22-run.md:148`, `:377`, `:403` | `design/domains/15-catalog.md:98-104` (жизненный цикл), `design/domains/15-catalog.md:118` (операции) | 10-kernel:109 «Для исполнения — нет, если версия отозвана»; 15-catalog:103 «код исполняется только при совпадении `impl.pins` и без отзыва версии». Механизма «отзыв версии» нет: жизненный цикл знает `core/retire {object}` — «не живой; следующие — `broken`» (объект целиком), операции — `retire(ref, by)`; в глоссарии термина нет. ADR-15 «выводит старую версию … затем `core/retire`» — `retire` объекта убил бы и новую версию | исправить | владелец — 15-catalog: либо `core/retire {object: id@n}` = отзыв версии (жизненный цикл + глоссарий), либо термин «отзыв» заменить на `retire` с явной областью |
| O-3 | `design/domains/30-adapters.md:77` | `design/domains/30-adapters.md:87`, `:89`, `:91` | :77 «**Одна сессия на команду;** `purpose` — имя команды»; таблица той же секции: `load` — «владелец · `load` …; парсер (`machine`, `software`) · `load`; автор обогащения (`agent`) · `load`», `verdict` — «потребитель · `verdict`; затем `<пространство>/learner` · `learn`», `bench` — «`--as` · `bench`; симуляторы · `simulate`» | исправить | :77 → «одна сессия на участника команды; `purpose` — имя команды, кроме `learn` и `simulate`» (так же AD-10 `design/domains/30-adapters.md:257`) |
| O-4 | `design/domains/10-kernel.md:193` | `design/02-glossary.md:147`, `:140`, `:179`, `:183`, `:202` | Слой `std` перечисляет типы: «`knowledge`, `capability`, `card`, `cue`, `term`, `domain`, `need`, `distinct`, `alias-candidate`, `solution`, `link`, `pipeline`, `setup`, `ctx`, стадии, `measurement`, `execution`, `verdict`, `gap`, `bench-set`, `bench-plan`, `bench-run`, политика доверия по умолчанию». Нет `std/member` (T151), `std/pool` (T77), `std/learned-assert` (T158), `std/load-finding` (T165), `std/bench-item` (T161) | мелочь | дописать пять имён или заменить список ссылкой на глоссарий |
| O-5 | `design/02-glossary.md:97` | `design/domains/14-trust.md:23` | T118: «сущности `core/actor` в пространстве проекта; пишет владелец»; 14-trust: «`core/actor` — ревизии пространства проекта, их пишет владелец или допущенный» | мелочь | T118: «пишет владелец или допущенный» |
| O-6 | `design/domains/22-run.md:277` · `design/02-glossary.md:178` | `design/domains/14-trust.md:100` | 22-run: «`policy` — `core/trust-policy@rev`»; T157: «`policy` — `core/trust-policy@rev`». `core/trust-policy` — тип; объект политики — `{ "id": "std/trust-policy", "type": "core/trust-policy@1"` (14-trust:100). Ссылка строки обучения — на объект политики `@n`, не на тип | мелочь | «`policy` — ревизия политики доверия (`std/trust-policy@n` или политика пространства)» |

Проверено без находок:
- Таблицы «Модель» с определением типа (`grep '| \`core|std/…\` | тип|факт|событие|сущность|значение'`): каждый из
  `core/snapshot`, `std/bench-item`, `-plan`, `-run`, `-set`, `std/cue`, `std/gap`, `std/link`, `std/member`,
  `std/need`, `std/solution` определён ровно в одном файле.
- JSON-примеры типов (`"type": "…@n"`): каждый тип — в файле своего владельца; `std/domain@1` в 10-kernel:15 помечен как
  иллюстрация формы (10-kernel:22 → [11]).
- `core/member` / `std/member`: 02-glossary:146-147, 21-compose:23, :42-44, :60, 13-rules:19, :30, 22-run:48, :278 —
  одно решение (наследник, `solution-size` в `rules` `std/member`).
- `core/trust-policy` (тип, 14-trust §4) и `std/trust-policy` (экземпляр, 15-catalog:17, 20-lens:153, :160,
  21-compose:171) — разведены согласованно.
- Порты: `Store`, `Clock`, `Ids` — только 12-ledger:116-127; `Judge`, `Scored`, `Chosen` — 20-lens:103-110; `Composer`,
  `Source`, `Place` — 21-compose:198-211; `Ctx`, `Stage`, `Deps`, `Meta`, `Ident`, `Exec` — 22-run; 30-adapters —
  ссылками (:8, :23-30). `Row` — проза 12-ledger:20-28; `Impl` — 13-rules:95-105.
- `core/holds`, `core/commit`, `core/namespace.origin` — владельцы по карте (10-kernel §7, 12-ledger:30-32,
  10-kernel:101).
- Карта `integration/ownership.md` §3 «Без владельца»: все 7 закрыты (lint: `std/block` — только глоссарий T66 как
  «типа нет»; `std/verdict` — определён 22-run:243-271, индекс lint не видит его как «Модель» — отметка индексатора).
