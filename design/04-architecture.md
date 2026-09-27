# 04. Архитектура — домены, зависимости, раскладка кода

**Назначение.** Сказать, что где живёт и кто от кого зависит, так, чтобы это проверял тест, а не ревью. Определения
понятий — у доменов; здесь — матрица зависимостей, тест структуры, корень сборки, слои, раскладка репозитория и карта владения (§8).

## 1. Слои

| Слой | Что | Меняется |
|---|---|---|
| **замороженное ядро** (код) | генезис, форма ревизии, хэш и каноническая форма, ссылки, режимы идентичности, факты с ролями, примитивы и проверки ядра (T134, ADR-32; код проверок — `src/rules/kernel-checks/`) — единственный перечень периметра ядра: [10](domains/10-kernel.md) §8 (KR-11) и T21 ссылаются сюда | только версией ядра; слой задаётся версией, не каталогом; хэш генезиса — константа версии |
| **код системы** | identity, ledger, rules (кроме примитивов и проверок ядра), trust, catalog, интерпретатор конвейера, bench, реализации стадий `builtin` | обычными релизами пакета; стадия исполняется, только если код совпадает с `impl.pins` ([13](domains/13-rules.md) §3) |
| **библиотека `std`** (данные) | типы механизма, правила, политика доверия по умолчанию, способности, конвейер `solve`, шаблоны карточек, промпты стадий | ревизиями; в проект — копией при `init` / `update` ([15](domains/15-catalog.md) §1) |
| **адаптеры и CLI** (код) | реализации портов, фиктивные адаптеры, корень сборки, хост, команды ([30](domains/30-adapters.md)) | релизами пакета; адаптеры вне пакета — позже (AD-14) |
| **проект** (данные) | пространство имён, `std/setup`, типы проекта, объекты — журнал в `.lattice/`; проводка — `lattice.config.json` | ревизиями в журнале; проводка — правкой файла (§5) |

## 2. Матрица зависимостей

Единственный источник правила зависимостей: по ней работает тест структуры (§3), с ней сверяются строки «Зависит от»
доменов. Столбец — что **реализация** домена может импортировать; `kernel` доступен всем.

| Домен | Каталог | Реализация импортирует |
|---|---|---|
| [10](domains/10-kernel.md) kernel | `src/kernel/` | — |
| [11](domains/11-identity-grain.md) identity & grain | `src/identity/` | kernel |
| [13](domains/13-rules.md) rules | `src/rules/` | kernel, identity |
| [12](domains/12-ledger.md) ledger | `src/ledger/` | kernel, identity, rules |
| [15](domains/15-catalog.md) catalog | `src/catalog/` | kernel, identity, ledger, rules |
| [14](domains/14-trust.md) trust | `src/trust/` | kernel, ledger, catalog |
| [20](domains/20-lens.md) lens | `src/lens/` | kernel, ledger, rules, trust, catalog |
| [21](domains/21-compose.md) compose | `src/compose/` | kernel, identity, ledger, rules, trust, catalog, lens |
| [22](domains/22-run.md) run | `src/run/` | все домены выше |
| [23](domains/23-bench.md) bench | `src/bench/` | kernel, ledger, rules, trust, lens, compose, run |
| [30](domains/30-adapters.md) адаптеры | `src/adapters/<имя>/` | kernel; не домены и не другие адаптеры |
| [30](domains/30-adapters.md) CLI и хост | `src/cli/` | всё; `adapters/*` — только корень сборки `wire.ts` (§4) |

**Интерфейс домена** (T167) — файл `src/<домен>/types.ts`: типы и интерфейсы портов, которые домен определяет
(ADR-24). Матрица его не ограничивает: интерфейс импортирует только ядро и интерфейсы других доменов, и между файлами
нет циклов. Так типы ходят в обе стороны (`Ctx` у run читает кандидатов lens, `Judge` у lens возвращает `Meta` run;
rules получает `LedgerView` журнала), а вызовы — только по матрице. Адаптер импортирует ядро и интерфейс своего порта.
`ledger/types` нарушений не знает: выход `commit` (с нарушениями `rules`) — тип реализации `ledger/commit.ts`, которой
матрица разрешает rules; поэтому `rules/types` → `ledger/types` (`LedgerView`) цикла не даёт.

## 3. Тест структуры

Тест структуры (T169) разбирает импорты `src/` и проверяет с первого среза (S0, [05](05-slices.md)):

1. направление — импорт реализации по матрице §2, интерфейса — по правилу интерфейса;
2. ввод-вывод — встроенные модули (`node:fs`, `node:net`, `fetch`, `process.env`, динамический импорт модуля) — только в
   `adapters/` и `cli/`;
3. нет циклов между файлами;
4. адаптеры не импортируют друг друга;
5. пакеты из `dependencies` (SDK поставщика) — только в `adapters/` и `cli/`.

## 4. Корень сборки и проекции

**Корень сборки** `src/cli/wire.ts` (T166) — единственный модуль, который импортирует `adapters/*`: читает проводку,
открывает хранилище, берёт `std/setup` из журнала, создаёт адаптеры по `setup.ports` и собирает `Deps` (T133);
подробно — [30](domains/30-adapters.md) §2.

**Проекции индекса подключаемые** (T170, N-32). Каждый раздел индекса — проекция ([12](domains/12-ledger.md) §3). Разделы
журнала вычисляет 12; раздел `trust` — проекция [14](domains/14-trust.md): 14 зависит от 12, а не наоборот. Список
проекций корень сборки передаёт в `open()`; их имена и версии входят в кэш индекса (`IndexBlob.projection`).

## 5. Журнал или проводка

Признак (PF-01): что меняет пакет или цену при том же журнале — в журнале, остальное — в проводке.

- **Журнал:** конвейер, адаптеры портов и точные версии моделей — ревизия `std/setup`, одна на пространство
  ([22](domains/22-run.md) §1, ADR-28). Смена — новая ревизия, откат — ещё одна; отдельного закрепления нет, барьер
  стенда — на фактах обучения (ADR-29). `imports` — только в `core/namespace` ([15](domains/15-catalog.md) §1).
- **Проводка** `lattice.config.json` (`config/2`, T128) — где лежит: каталог данных, эндпоинты, корни источников,
  ссылки на секреты `{"$env"}`; строгая схема, запасного адаптера нет — [30](domains/30-adapters.md) §2.
- Каталог данных `.lattice/` и его писатели — [30](domains/30-adapters.md) §4.

## 6. Раскладка репозитория (TypeScript / Node, ESM)

```text
LATTICE/
  package.json                  node >= 22, ESM, без фреймворков (AR-03)
  src/
    kernel/                     types.ts, revision.ts, canonical.ts, hash.ts, ref.ts, ids.ts, genesis.ts
    identity/                   types.ts, grain.ts, ensure.ts, regrain.ts, alias.ts, resolve.ts
    rules/                      types.ts, validate.ts, primitives/*.ts, kernel-checks/*.ts, lint.ts, contract.ts
    ledger/                     types.ts (Store, Clock, Ids, LedgerView, Projection), commit.ts, open.ts, projections.ts, rebuild.ts, query.ts
    catalog/                    types.ts, namespace.ts, publish.ts, consumers.ts, migrate.ts
    trust/                      types.ts, assert.ts, compute.ts, projection.ts, policy.ts, explain.ts
    lens/                       types.ts (Judge), stages/{normalize,route,id-lookup,lexicon,pool,bm25,judge,fuse,trust,threshold,cut}.ts, card.ts, aliases.ts
    compose/                    types.ts (Composer, Source), stages/{frame,recall,recheck,select,self-search,check}.ts, materialize.ts
    run/                        types.ts (Ctx, Stage, Deps, View, Meta, Ident, Exec), interpreter.ts, registry.ts, deliver.ts, verdict.ts, learn.ts, replay.ts
    bench/                      plan.ts, metrics.ts, bootstrap.ts, report.ts
    adapters/                   store-jsonl/  store-memory/  judge-jev/  judge-fixture/  composer-claude/  composer-caller/
                                composer-fixture/  source-warrant/  source-files/  source-fixture/  (clock, ids — 30 §1)
    cli/                        main.ts, wire.ts, commands/*.ts
  std/                          *.json — библиотека (типы, правила, стадии, конвейер, промпты)
  test/                         node:test; структура, контрактные наборы портов, срезы S0–S9, фикстуры
  design/                       этот каталог
```

Фиктивные адаптеры лежат в `src/adapters/` и подключаются проводкой: срез можно показать командой CLI без сети
([05](05-slices.md)).

## 7. Принципы кода

- Функции ядра — чистые; стадия — внешнее только через порты `Deps` (RN-02); ввод-вывод — только в `adapters/` и
  `cli/`; коммит пишет через порт `store`.
- Одна структура `Revision` на всё; «класс на тип» не заводится — тип — данные.
- Ревизии из журнала заморожены (`Object.freeze`); меняется только индекс.
- Номинальные строки: `Id`, `Ref`, `Hash` — branded types.
- Детерминизм: `clock` и `ids` — порты ([12](domains/12-ledger.md) §5); в тестах — фиксированные; пересборка и
  воспроизведение — побайтно.
- Тесты: `node:test`; у каждого среза ([05](05-slices.md)) — набор тестов конец-в-конец на фикстурах; у каждого порта —
  контрактный набор, общий для живого и фиктивного адаптера (AD-07).
- Всё машинное — канонический JSON (ADR-1); второго формата нет.

## 8. Карта владения

Каждое понятие определено в одном файле, остальные на него ссылаются; имя — из [глоссария](02-glossary.md). Контракт
порта — у домена-потребителя (ADR-24). Новое понятие — строкой здесь в том же изменении, что и его определение
(AR-13). Адреса строк и история карты — `integration/ownership.md` (архив сверки v0.4).

| Понятие | Вид | Владелец | Решение |
|---|---|---|---|
| `core/actor` | тип | [14-trust](domains/14-trust.md) §1 | TR-03 |
| `core/alias` | факт | [11-identity-grain](domains/11-identity-grain.md) §4 | GR-05 |
| `core/assert` | тип | [14-trust](domains/14-trust.md) §2 | TR-02 |
| `core/deprecate` | факт | [15-catalog](domains/15-catalog.md) §5 | CT-05 |
| `core/fact` | тип | [10-kernel](domains/10-kernel.md) §7 | KR-13 |
| `core/grant` | факт | [15-catalog](domains/15-catalog.md) §2 | CT-03, CT-13, CT-14 |
| `core/member` | факт | [10-kernel](domains/10-kernel.md) §7 | KR-13 · D09 Q1 |
| `std/member` | факт | [21-compose](domains/21-compose.md) §1 | CP-11 · T151 · D09 Q1 |
| `core/proposal` | событие | [15-catalog](domains/15-catalog.md) §3 | CT-03, CT-11 |
| `core/retire` | факт | [15-catalog](domains/15-catalog.md) §5 | CT-05 · ADR-15 · C2b |
| `core/rule` | тип | [13-rules](domains/13-rules.md) §1 | RL-01 |
| `core/session` | тип | [14-trust](domains/14-trust.md) §1 | TR-03 · TR-11 · C2b |
| `core/snapshot` | тип | [21-compose](domains/21-compose.md) §1 | CP-02 |
| `core/type` | тип | [10-kernel](domains/10-kernel.md) §6 | KR-08 |
| `std/bench-plan` | событие | [23-bench](domains/23-bench.md) §1 | BN-02, BN-07 · ADR-21 · D11 Q2 |
| `std/bench-run` | событие | [23-bench](domains/23-bench.md) §1 | BN-01, BN-08 · D11 Q3 |
| `std/bench-set` | тип | [23-bench](domains/23-bench.md) §1 | BN-01 |
| `std/bench-item` | тип | [23-bench](domains/23-bench.md) §1 | BN-06 · D11 Q1 |
| `std/ctx` | тип | [22-run](domains/22-run.md) §2 | RN-02 |
| `std/cue` | факт | [21-compose](domains/21-compose.md) §1 | CP-01 · 20-lens/И-9 · N-43 |
| `std/distinct` | факт | [11-identity-grain](domains/11-identity-grain.md) §6 | CP-01 · T-8 · R6 Q4 |
| `std/domain` | тип | [11-identity-grain](domains/11-identity-grain.md) §1 | GR-13 · D03 |
| `std/gap` | событие | [21-compose](domains/21-compose.md) §1 | CP-07 · D09 Q4 |
| `std/knowledge` | тип | [20-lens](domains/20-lens.md) §2 | LN-14 · N-13 · D08 Q6 |
| `std/link` | факт | [21-compose](domains/21-compose.md) §1 | CP-04 · ADR-17 |
| `std/measurement` | событие | [20-lens](domains/20-lens.md) §6 | LN-08 · И-14 · T-4 |
| `std/need` | тип | [21-compose](domains/21-compose.md) §1 | CP-01 |
| `std/solution` | тип | [21-compose](domains/21-compose.md) §1 | CP-02, CP-04 |
| `std/term` | тип | [20-lens](domains/20-lens.md) §2 | LN-14 · N-13 · D08 Q6 |
| `std/trust-policy` | экземпляр политики по умолчанию | [14-trust](domains/14-trust.md) §4 | TR-05 |
| `store` (порт) | порт | [12-ledger](domains/12-ledger.md) §5 | ADR-24 · LG-05 (D05) |
| `judge` (порт) | порт | [20-lens](domains/20-lens.md) §5 | ADR-24 · LN-04 · D08 · C2a (N-79) |
| `composer` (порт) | порт | [21-compose](domains/21-compose.md) §8 | ADR-24 · CP-14 |
| `source` (порт) | порт | [21-compose](domains/21-compose.md) §8 | ADR-24 · CP-14 · 30-adapters/И-9 (R4 Q7) |
| `exec` (порт) | порт | [22-run](domains/22-run.md) §3 | — |
| `clock`, `ids` (порт) | порт | [12-ledger](domains/12-ledger.md) §5 | D02 Q2, ADR-24 |
| `Meta` | формат | [22-run](domains/22-run.md) §3 | N-12 · R5 Q7: основной потребитель — рантайм (бюджет, трасса), ADR-24 |
| `Scored` | формат | [20-lens](domains/20-lens.md) §5 | ADR-24 · D08 |
| `Chosen` | формат | [20-lens](domains/20-lens.md) §5 | ADR-24 · D08 |
| `id` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | KR-01 |
| `type` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | KR-01 |
| `version` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | KR-03 |
| `at` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | LG-04 |
| `by` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | TR-01 |
| `body` | поле заголовка | [10-kernel](domains/10-kernel.md) §1 | KR-02 |
| ревизия (формат записи) | формат | [10-kernel](domains/10-kernel.md) §1 | KR-01 |
| `core/commit` | факт (маркер) | [12-ledger](domains/12-ledger.md) §1 | 12-ledger/И-9 · LG-12 (D05) |
| `core/holds` | событие | [10-kernel](domains/10-kernel.md) §7 | 10-kernel/И-6 · R4 Q9, D01 Q3: событие генезиса, провенанс |
| `origin` (`core/namespace`) | поле | [10-kernel](domains/10-kernel.md) §4 | 10-kernel/И-27 · R1: владелец 10-kernel (`core/namespace` — тип генезиса) |
| `via` (`core/assert`) | поле | [14-trust](domains/14-trust.md) §2 | 14-trust/И-7 · ADR-5 |
| `examples`, `when` (`core/rule`) | поле | [13-rules](domains/13-rules.md) §1 | 13-rules/И-1 · D04 Q5 |
| нарушение (оболочка `{row, rule, message}`) | формат | [13-rules](domains/13-rules.md) §2 | 13-rules/И-4 · D04 Q2 |
| `impl.pins` | поле | [13-rules](domains/13-rules.md) §3 | 10-kernel/И-33 · T-2 |
| `std/alias-candidate` | тип | [11-identity-grain](domains/11-identity-grain.md) §6 | ADR-8 · R3 |
| `grain_scope` (`core/type`) | поле | [11-identity-grain](domains/11-identity-grain.md) §1 | ADR-27 · R3 |
| уровень поля `schema` (`core/type`) | поле | [13-rules](domains/13-rules.md) §1 | ADR-9 · R3 |
| `std/ctx.needs[].found` | поле | [22-run](domains/22-run.md) §2 | 21-compose/И-9 · T152 |
| `writers`, `inForce` (`core/type`) | поле | [10-kernel](domains/10-kernel.md) §7 | ADR-6 · R2 · C2b |
| `target` (`core/type`, роль цели, T173) | поле | [10-kernel](domains/10-kernel.md) §7 | ADR-6 · C2b |
| реестр участников (`core/actor` пишет владелец) | правило | [14-trust](domains/14-trust.md) §1 | ADR-25 · R2 |
| группа независимости | правило | [14-trust](domains/14-trust.md) §1 | ADR-26 · R2 |
| `trust().overruled` | поле | [14-trust](domains/14-trust.md) §3 | 14-trust/И-13 · R2 |
| `declare`, `create`, `edit` (`core/grant`) | поле | [15-catalog](domains/15-catalog.md) §2 | ADR-25 · R2 |
| `std/setup` | тип | [22-run](domains/22-run.md) §1 | ADR-28 · R4 |
| тело `core/namespace` (`name`, `owner`, `imports`, `policy`, `doc`) | тип (генезис) | [15-catalog](domains/15-catalog.md) §1 | ADR-28 · R4 (N-14) |
| кортеж исполнения | правило | [22-run](domains/22-run.md) §1 | T-2 · R5 Q2 · C2a (N-74, N-108) · RN-20 |
| обновление `std` (`update(package)`, коммит импорта) | операция | [15-catalog](domains/15-catalog.md) §1 | CT-10 · D06 Q1 |
| `reads` / `writes` способности стадии | поле | [13-rules](domains/13-rules.md) §3 | T-3 · R5 Q1 |
| `Deps` (`view`), `View` | формат | [22-run](domains/22-run.md) §2 | T-3 · R5 Q1 · C2a (N-83) |
| `LedgerView` (чтения индекса на `seq`) | порт (чтение) | [12-ledger](domains/12-ledger.md) §5 | C2a (N-83) |
| раздел индекса `executions` | формат | [12-ledger](domains/12-ledger.md) §3 | ADR-3 · C2a (N-75) |
| проверки ядра | правило | [13-rules](domains/13-rules.md) §2 | T-16 · R5 Q3 |
| `lens` (`core/trust-policy`: `exclude`, `mark`) | поле | [14-trust](domains/14-trust.md) §4 | 20-lens/И-6 · R5 Q5 · N-40 · D08 Q5 |
| `calibrated_for` порога | поле | [20-lens](domains/20-lens.md) §4 | 20-lens/И-4, И-7 · R5 Q10 · LN-07 · D08 Q4 |
| `std/pool` | значение | [20-lens](domains/20-lens.md) §3 | LN-14 · И-14 · D08 Q7 |
| шаблон `card` типа | поле | [20-lens](domains/20-lens.md) §1 | LN-09 · ADR-12 · D08 Q1 |
| кандидат (`candidates[]`), `marks`, `boosts` | формат, поля | [20-lens](domains/20-lens.md) §4 | LN-06, LN-11 · D08 Q3, Q5 |
| стадии LENS (`normalize` … `cut`), их `reads`/`writes` | способности | [20-lens](domains/20-lens.md) §4 | LN-03 · T-3 · D08 |
| стадии compose (`frame`, `recall`, `recheck`, `select`, `self-search`, `check`), их `reads`/`writes`, параметры `recall` | способности | [21-compose](domains/21-compose.md) §4 | CP-05 · T-3 · D09 |
| `purpose` (`core/session`) | поле | [14-trust](domains/14-trust.md) §1 | T-5 · R6 Q1 · C2b: `recall` — не читает (T137) |
| копия кампании (`.lattice/bench/<run>`, хэш в `bench-run`), кампания | формат | [23-bench](domains/23-bench.md) §3 | T-5 · R6 Q1 |
| гейт обучения (`learning-gate`) | примитив | [13-rules](domains/13-rules.md) §2 | ADR-29 · R6 Q2 |
| `candidates` (`core/trust-policy`) | поле | [14-trust](domains/14-trust.md) §4 | T-8 · R6 Q4 · N-40 · D09 Q6 |
| `software` (`core/session`) | поле | [14-trust](domains/14-trust.md) §1 | 14-trust/И-4 · R4 Q5 · T148 |
| голос группы; `trust().groups`, `trust().policy` | правило, поля | [14-trust](domains/14-trust.md) §2 | D07 Q3, Q4 · T147 |
| `divide(need, parts, by)` | операция | [21-compose](domains/21-compose.md) §6 | 21-compose/И-6 · R6 Q5 |
| окно удаления членства | правило | [22-run](domains/22-run.md) §6 | ADR-20 · R6 Q6 |
| регрессионный план (`base`, δ, ротация `test`) | правило | [23-bench](domains/23-bench.md) §1 | 23-bench/И-14, И-15 · R6 Q9 |
| `rows` (строки вызова), id новых у стадии | поле, правило | [22-run](domains/22-run.md) §2 | RN-09 · D10a Q2, Q3 |
| стадия `materialize` | способность | [21-compose](domains/21-compose.md) §4 | RN-08 · D10a Q1 |
| `describe()` (`Ident`) | метод портов LLM | [22-run](domains/22-run.md) §3 | RN-10 · D10a Q5 |
| таблица сбоев вызова | правило | [22-run](domains/22-run.md) §3 | RN-11 · D10a Q4 |
| файл хода `.lattice/runs/<id>.log` | формат | [22-run](domains/22-run.md) §3 | RN-12 · D10a Q6 |
| `std/pipeline`, конвейер `solve@1` | тип, объект | [22-run](domains/22-run.md) §1 | RN-01, RN-08 · N-10 |
| `std/execution@1` | событие | [22-run](domains/22-run.md) §3 | RN-06 · И-18 · N-10 |
| `std/verdict@1` | событие | [22-run](domains/22-run.md) §5 | RN-04, RN-18 · D10b Q3 |
| строка обучения (`from`, `policy`) | правило, поля | [22-run](domains/22-run.md) §6 | RN-14 · D10b Q1 |
| `std/learned-assert` | тип | [22-run](domains/22-run.md) §6 | RN-14 · D10b Q1 |
| сессия `learn` (`purpose: learn`), поток `verdict → learn` | правило, операция | [22-run](domains/22-run.md) §6 | RN-13 · D10b Q2 |
| правила обучения (таблица «вердикт → факты»), калибровка | правило | [22-run](domains/22-run.md) §6 | RN-05, RN-15 · D10b Q4 |
| путь подсказки (рождение, подтверждение, recheck прежней ревизии) | правило | [22-run](domains/22-run.md) §6 | RN-16 · D10b Q5 |
| `replay`, горизонт replay | операция, правило | [22-run](domains/22-run.md) §7 | RN-07, RN-17 · D10b Q6, Q7 |
| сессия симулятора (`purpose: simulate`) | правило | [23-bench](domains/23-bench.md) §3 | BN-04 · D11 Q5 |
| метрики стенда, протокол калибровок | правило | [23-bench](domains/23-bench.md) §2 | BN-03 · N-45, N-56, N-57 |
| хост (T164), `purpose` команд хоста | правило | [30-adapters](domains/30-adapters.md) §3 | AD-10 · ADR-25 · D12 Q4 |
| корень сборки `src/cli/wire.ts` (T166) | модуль | [30-adapters](domains/30-adapters.md) §2 | AD-01 · T-10 · D12 Q0 |
| матрица зависимостей (T168), интерфейс домена `types.ts` (T167) | правило | §2 | AR-04, AR-06 · D13 Q1 |
| тест структуры (T169) | правило | §3 | AR-04 · 30-adapters/И-3 |
| проекция индекса `Projection` (T170) | формат | [12-ledger](domains/12-ledger.md) §3 | AR-08 · N-32 · D13 Q2 |
| граница «журнал / проводка» | правило | §5 | AR-09 · PF-01 |
| срез, «Готово, когда», инвариант → срез (T171) | правило | [05-slices](05-slices.md) | SL-01…04 · D13 |
| проводка `bindings`, ссылка на секрет `$env` (T128, T127) | формат | [30-adapters](domains/30-adapters.md) §2 | AD-06, AD-08 · PF-03 · N-5 |
| каталог данных `.lattice/` | формат | [30-adapters](domains/30-adapters.md) §4 | D12 Q0 |
| протокол режима агента (`pending`, `lattice answer`, `.lattice/answers/`) | правило | [30-adapters](domains/30-adapters.md) §5 | AD-09 · ADR-19 · D12 Q2 |
| «Формат v1» — перечень | правило | [10-kernel](domains/10-kernel.md) §3 | KR-02 · ADR-1 · C2b |
| `std/payload` (T175) | тип | [22-run](domains/22-run.md) §3 | RN-22 · C2b |
| `Ctx.run`, `needs[].solution` | поля | [22-run](domains/22-run.md) §2 | RN-21 · C2b |
| смена владельца, `transfer` | правило, операция | [15-catalog](domains/15-catalog.md) §2 | CT-03 · ADR-25 · C2b |
| `std/load-finding` (T165) | факт | [30-adapters](domains/30-adapters.md) §6 | AD-11 · ADR-10 · D12 Q3 |
| `warrant/norm`, `warrant/summary` | типы проекта | [30-adapters](domains/30-adapters.md) §5 | AD-12 · D12 Q5, Q6 |
| `Draft`, `Row` (строка до коммита и хранимая) | формат | [12-ledger](domains/12-ledger.md) §5 | LG-05 · C2c Q4 |
| `determinism` способности (`deterministic`, `ports`) | поле | [13-rules](domains/13-rules.md) §3 | RL-07 · T-3 · C2c Q3 |
| часть набора `subset` (T176) | поле | [23-bench](domains/23-bench.md) §1 | BN-06 · C2c Q6 |

## Решения

| ID | Решение | Почему |
|---|---|---|
| AR-01 | Гексагональная архитектура: ядро → порты ← адаптеры; контракт порта — у домена-потребителя | заменяемость технологий, тестируемость; форму порта решают те, кто её читает. v0.4 · ADR-24 |
| AR-02 | Код ядра мал; поведение — данные `std` | самоописание: новая версия конвейера, правил, типов — без релиза кода, пока стадии — существующие `builtin`; новый `builtin` — релиз пакета под `impl.pins`. v0.4 · П-9 · 10-kernel/И-33 · T-2 |
| AR-03 | TypeScript / Node ESM, `node:test`, без фреймворков. Фреймворк — код, который забирает управление (DI-контейнер, веб- или агентный фреймворк); библиотеки и SDK поставщика — только внутри своего адаптера | данные — канонический JSON, код заменим без миграции; просто: CLI и библиотека без инверсии управления. v0.4 · 30-adapters/И-11 · П-31 |
| AR-04 | Правило зависимостей — матрица §2, единственный источник для теста структуры и строк «Зависит от»; тест проверяет пять пунктов §3 с первого среза | архитектура не расползается: эрозия структуры не даёт красных поведенческих тестов. v0.4 · T-10 · 30-adapters/И-2 · И-3 · П-30 |
| AR-05 | Срезы — единица реализации и приёмки; первый — скелет S0 | каждый шаг даёт работающий результат; стыки слоёв видны с начала. v0.4 · 30-adapters/И-13 |
| AR-06 | Интерфейс домена (`types.ts`) вне матрицы: импортирует только ядро и интерфейсы, без циклов; матрица ограничивает реализацию | типы нужны в обе стороны (`Ctx` ↔ `Judge`, `LedgerView` для rules), вызовы — только по направлению. v0.4 · D13 Q1 · ADR-24 |
| AR-07 | Корень сборки `src/cli/wire.ts` — единственный импортёр `adapters/*`; собирает адаптеры, `Deps` и список проекций | одна точка знает технологии; правило проверяемо тестом. v0.4 · 30-adapters/И-1 · AD-01 |
| AR-08 | Раздел индекса вычисляет домен-владелец; проекцию выше журнала (`trust`) подключает корень сборки | индекс хранит результат `trust()`, но 12 от 14 не зависит. v0.4 · N-32 · D13 Q2 |
| AR-09 | Меняет пакет или цену при том же журнале — журнал (`std/setup`), иначе — проводка | воспроизводимость по журналу; проводка не влияет на результат. v0.4 · PF-01 · ADR-28 |
| AR-10 | Один пакет с каталогами; разделение (`@lattice/core`, `@lattice/adapters-*`) — когда адаптеры понадобятся отдельно | нет второго потребителя; матрица и тест держат границы и без пакетов. v0.4 · Q-04-1 · AD-14 |
| AR-11 | `std` — JSON-файлы в репозитории; тест — они проходят правила ядра и свои `examples`; генезис, в отличие от `std`, порождается кодом | данные под ревью; генезис — корень доверия, его хэш — константа версии. v0.4 · Q-04-2 · T-10 |
| AR-12 | Проверки ядра (T134) — слой замороженного ядра по версии `kernel`; код — `src/rules/kernel-checks/` (в том числе `owner`, прежде `catalog/owner.ts`) | валидатор не меняется посреди работы (P9); коммит (ledger) вызывает проверки через rules — catalog ему недоступен (AR-04). v0.4 · ADR-32 · C1 B9, E34 |
| AR-13 | Карта владения (§8) — понятие → файл-владелец и раздел; новое понятие вносится строкой в том же изменении, что и его определение | у каждого понятия один владелец, остальные ссылаются — иначе определения расходятся молча (аудит C1); адреса строк хрупки — в карте только раздел. v0.4 · C2c Q8 |

## Вне объёма

- Монорепо и отдельные пакеты адаптеров — до второго потребителя (AR-10).
- Фреймворки (DI-контейнер, веб-, агентный) — не используются (AR-03).
- Циклы `import type` как исключение из теста — отклонено: интерфейс домена решает то же без исключений (AR-06).
