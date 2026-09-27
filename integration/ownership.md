# ownership.md — карта владения (S0, черновик; архив с C2c)

**Действующая карта — `design/04-architecture.md` §8 (AR-13, C2c).** Этот файл — архив сверки v0.4: адреса строк и
история владельцев; новые понятия сюда не вносятся.

Черновик карты владения понятиями `design/` v0.3; владельцы уточняются в сессиях D. Правило ADR-24: контракт
порта закрепляется у домена-потребителя (основного, если их несколько); `30-adapters` — только реализации, корень
сборки, CLI. `?` в «Решение» — владелец предложен агентом, не решён.

## 1. Понятия v0.3

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/actor` | тип | 14-trust | `design/domains/14-trust.md:18#782700` | 10-kernel (`by`), 15-catalog (owner) | TR-03 |
| `core/alias` | факт | 11-identity-grain | `design/domains/11-identity-grain.md:104-118#a5ae62` | 14-trust (п.7), 15-catalog | GR-05 |
| `core/assert` | тип | 14-trust | `design/domains/14-trust.md:44-63#29e971` | 23-bench (И-2) | TR-02 |
| `core/deprecate` | факт | 15-catalog | `design/domains/15-catalog.md:107#500f23` | 11-identity-grain (п.4) | CT-05 |
| `core/fact` | тип | 10-kernel | `design/domains/10-kernel.md:167-193#55d8e5` | все домены | KR-13 |
| `core/grant` | факт | 15-catalog | `design/domains/15-catalog.md:62-66#8259bb` | 14-trust (`declare`) | CT-03, CT-13, CT-14 |
| `core/member` | факт | 10-kernel | `design/domains/10-kernel.md:166-193#45e4d0` (факт); домены — 15-catalog | 20-lens (пул), 21-compose (наследник `std/member`) | KR-13 · D09 Q1 |
| `std/member` | факт | 21-compose | `design/domains/21-compose.md:23,42-48,60#bc8f5c` | 13-rules (`solution-size`), 14-trust (доверие членств), 15-catalog (допуск), 22-run (обучение) | CP-11 · T151 · D09 Q1 |
| `core/proposal` | событие | 15-catalog | `design/domains/15-catalog.md:80-82#aa41b2` | 14-trust (`core/assert` ±1) | CT-03, CT-11 |
| `core/retire` | факт | 15-catalog | `design/domains/15-catalog.md:108#50ef86`; отзыв версии (`id@n`, T174) — `design/domains/15-catalog.md:109#c2f3c9` | 20-lens (не выдаёт), 22-run (отказ на старте), 10-kernel (§5) | CT-05 · ADR-15 · C2b |
| `core/rule` | тип | 13-rules | `design/domains/13-rules.md:15-25#db45bf` | 10-kernel (`type.rules`), 12-ledger (коммит) | RL-01 |
| `core/session` | тип | 14-trust | `design/domains/14-trust.md:19#5dd803`; пишет хост, `by` — она сама, `actor: null` + `claimed` — `design/domains/14-trust.md:28#62086c` | 10-kernel (`by`), 13-rules (`owner`), 30-adapters (хост) | TR-03 · TR-11 · C2b |
| `core/snapshot` | тип | 21-compose | `design/domains/21-compose.md:25#d2f8c3` | 12-ledger (индекс `snapshots`) | CP-02 |
| `core/type` | тип | 10-kernel | `design/domains/10-kernel.md:128-166#9f44e1` | все домены | KR-08 |
| `std/bench-plan` | событие | 23-bench | `design/domains/23-bench.md:20#ab0b3d`, `design/domains/23-bench.md:26-36#86906f` | 22-run (гейт — `base`), 01-first-run (R3, R10) | BN-02, BN-07 · ADR-21 · D11 Q2 |
| `std/bench-run` | событие | 23-bench | `design/domains/23-bench.md:21#adb69d`, `design/domains/23-bench.md:40-42#e409bb` | 22-run (`execution.bench`, гейт) | BN-01, BN-08 · D11 Q3 |
| `std/bench-set` | тип | 23-bench | `design/domains/23-bench.md:19#18fe68` | 30-adapters (source-warrant) | BN-01 |
| `std/bench-item` | тип | 23-bench | `design/domains/23-bench.md:18#bb3fa0`, `design/domains/23-bench.md:23-25#e27236`; T161 | 30-adapters (загрузка набора), 14-trust (`core/assert` разметчика) | BN-06 · D11 Q1 |
| `std/ctx` | тип | 22-run | `design/domains/22-run.md:83-125#55b604` | 20-lens, 21-compose (стадии), 13-rules (контракт) | RN-02 |
| `std/cue` | факт | 21-compose | `design/domains/21-compose.md:21,34-37#5e34af` | 20-lens (LN-02, LN-10), 14-trust (п.7), 22-run (обучение) | CP-01 · 20-lens/И-9 · N-43 |
| `std/distinct` | факт | 11-identity-grain | `design/domains/11-identity-grain.md:146-154#c260a3` | 21-compose (потребности), 22-run (обучение), `core/trust-policy.candidates` (память отказов) | CP-01 · T-8 · R6 Q4 |
| `std/domain` | тип | 11-identity-grain | `design/domains/11-identity-grain.md:26-35#62fe70` | 10-kernel (пример), 30-adapters (создание доменов) | GR-13 · D03 |
| `std/gap` | событие | 21-compose | `design/domains/21-compose.md:26,66,163-164#da6aa2` | 22-run (пакет), 23-bench (E4) | CP-07 · D09 Q4 |
| `std/knowledge` | тип | 20-lens | `design/domains/20-lens.md:50#a16157` | 15-catalog (публикация), 30-adapters (`warrant/norm` расширяет) | LN-14 · N-13 · D08 Q6 |
| `std/link` | факт | 21-compose | `design/domains/21-compose.md:24,64-65#9b7c0b` | 13-rules (`acyclic` с `role`) | CP-04 · ADR-17 |
| `std/measurement` | событие | 20-lens | `design/domains/20-lens.md:130-147#563e60` | 14-trust (TR-06), 22-run (трасса, replay), 12-ledger (сегмент) | LN-08 · И-14 · T-4 |
| `std/need` | тип | 21-compose | `design/domains/21-compose.md:20#0c3c7b` | 15-catalog (допуск), 20-lens (вход) | CP-01 |
| `std/solution` | тип | 21-compose | `design/domains/21-compose.md:22,63#52b79e` | 15-catalog (допуск) | CP-02, CP-04 |
| `std/term` | тип | 20-lens | `design/domains/20-lens.md:51#84b997` | 21-compose (ключ потребности, цель `std/cue`), 30-adapters (словарь WARRANT) | LN-14 · N-13 · D08 Q6 |
| `std/trust-policy` | экземпляр политики по умолчанию | 14-trust | `design/domains/14-trust.md:103-122#bcec58` | 15-catalog (`namespace.policy`) | TR-05 |
| `store` (порт) | порт | 12-ledger | `design/domains/12-ledger.md:123-155#d67487` | 30-adapters (`store-jsonl`, `store-memory`) | ADR-24 · LG-05 (D05) |
| `judge` (порт) | порт | 20-lens | `design/domains/20-lens.md:103-107#f49132` | 21-compose (recall, select), хост (`aliasCandidates` `design/domains/20-lens.md:171#2a297a`, 11-identity-grain GR-06 — ссылкой), 30-adapters (реализации) | ADR-24 · LN-04 · D08 · C2a (N-79) |
| `composer` (порт) | порт | 21-compose | `design/domains/21-compose.md:201-227#c94a30` (D09); 30 — ссылкой `design/domains/30-adapters.md:25#f71cb8` | 22-run (runtime) | ADR-24 · CP-14 |
| `source` (порт) | порт | 21-compose | `design/domains/21-compose.md:210-217#59ad86` (D09); 30 — ссылкой `design/domains/30-adapters.md:26#54cd28`, реализации `design/domains/30-adapters.md:165-195#89ac85` | 22-run (deliver), 30-adapters (source-warrant), 15-catalog (`load`) | ADR-24 · CP-14 · 30-adapters/И-9 (R4 Q7) |
| `exec` (порт) | порт | 22-run | `design/domains/22-run.md:232, 239-240#83e0ee` (D10a); 30 — ссылкой `design/domains/30-adapters.md:27#f49131` | — | ADR-24 · D10a Q0
| `clock`, `ids` (порт) | порт | 12-ledger | `design/domains/12-ledger.md:142-143#c2aa99` (D05); 30 — ссылкой `design/domains/30-adapters.md:23#cb5c42` | 10-kernel (`newId(namespace, ulid)`, `revision(input, at)` — аргументами), 22-run (`Deps`, T133) | D02 Q2, ADR-24 |
| `Meta` | формат | 22-run | `design/domains/22-run.md:229-236#da8471` (D10a, C2a: `detail` непрозрачен); 30 — ссылкой `design/domains/30-adapters.md:29-30#d90f81`; T135 | 20-lens, 21-compose, 30-adapters (адаптеры отдают) | N-12 · R5 Q7: основной потребитель — рантайм (бюджет, трасса), ADR-24 |
| `Scored` | формат | 20-lens | `design/domains/20-lens.md:109#9df097` | 30-adapters (реализации) | ADR-24 · D08 |
| `Chosen` | формат | 20-lens | `design/domains/20-lens.md:110#e09599` | 30-adapters (реализации) | ADR-24 · D08 |
| `id` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:27#f02776` | все домены | KR-01 |
| `type` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:28#d53a44` | все домены | KR-01 |
| `version` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:29#941a32` | 12-ledger (LG-06) | KR-03 |
| `at` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:30#5685de` | 12-ledger (порядок) | LG-04 |
| `by` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:31#0e65da` | 14-trust (доверие) | TR-01 |
| `body` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:32#696aa4` | все домены | KR-02 |
| ревизия (формат записи) | формат | 10-kernel | `design/domains/10-kernel.md:12-48#8ad27f` | все домены | KR-01 |

## 2. Новые понятия из итогов

Понятия, которых нет в v0.3, введённые пунктами `research/analysis/arch-changes.md`; ещё не внесены в `design/`.

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/commit` | факт (маркер) | 12-ledger | `design/domains/12-ledger.md:30-32#13af22` | 10-kernel (генезис), 13-rules (`kernel`), 22-run | 12-ledger/И-9 · LG-12 (D05) |
| `core/holds` | событие | 10-kernel | `design/domains/10-kernel.md:195-204#41d6b3` | 14-trust | 10-kernel/И-6 · R4 Q9, D01 Q3: событие генезиса, провенанс |
| `core/namespace.origin` | поле | 10-kernel | `design/domains/10-kernel.md:110-112#68e98e` | 15-catalog (импорт) | 10-kernel/И-27 · R1: владелец 10-kernel (`core/namespace` — тип генезиса) |
| `core/assert.via` | поле | 14-trust | `design/domains/14-trust.md:54#03678d` | 22-run (`learn`) | 14-trust/И-7 · ADR-5 |
| `core/rule.examples`, `core/rule.when` | поле | 13-rules | `design/domains/13-rules.md` §1 | 21-compose (`form`, ADR-17) | 13-rules/И-1 · D04 Q5 |
| нарушение (оболочка `{row, rule, message}`) | формат | 13-rules | `design/domains/13-rules.md` §2 | 11-identity-grain (`grain-unique`), 12-ledger (отказ коммита) | 13-rules/И-4 · D04 Q2 |
| `impl.pins` | поле | 13-rules | `design/domains/13-rules.md` §3 | 22-run (кортеж, отказ рантайма), 15-catalog | 10-kernel/И-33 · T-2 |
| `std/alias-candidate` | тип | 11-identity-grain | `design/domains/11-identity-grain.md:135-142#a4e585` | 21-compose (И-2), 20-lens, 30-adapters (импорт) | ADR-8 · R3 |
| `core/type.grain_scope` | поле | 11-identity-grain | `design/adr/0027-grain-scope.md` | 12-ledger (индекс `grain`), 13-rules (`grain-unique`) | ADR-27 · R3 |
| уровень `core/type.schema` | поле | 13-rules | `design/adr/0009-schema-field-as-rule.md` | 10-kernel (`core/type`) | ADR-9 · R3 |
| `std/ctx.needs[].found` | поле | 22-run | `design/domains/22-run.md:86-125#09e8c2` (`Ctx`, D10a); стадии — `design/domains/21-compose.md:113-123#3d6eff` | 21-compose | 21-compose/И-9 · T152 |
| `core/type.writers`, `core/type.inForce` | поле | 10-kernel | `design/domains/10-kernel.md:180-186#7b09d8` (перечисления и порядки, C2b); ADR-6 | 13-rules (`owner`, наследование), 15-catalog, 14-trust, 11-identity-grain, 30-adapters (`{purpose}`) | ADR-6 · R2 · C2b |
| `core/type.target` (роль цели, T173) | поле | 10-kernel | `design/domains/10-kernel.md:177#b6e0ed` | 13-rules (`owner`), 15-catalog | ADR-6 · C2b |
| реестр участников (`core/actor` пишет владелец) | правило | 14-trust | `design/domains/14-trust.md:22#960690` | 15-catalog, 22-run, 30-adapters (хост) | ADR-25 · R2 |
| группа независимости | правило | 14-trust | `design/domains/14-trust.md:37#38974b` | 20-lens, 22-run, 23-bench | ADR-26 · R2 |
| `trust().overruled` | поле | 14-trust | `design/domains/14-trust.md:98#b63116` | 20-lens (исключает) | 14-trust/И-13 · R2 |
| `core/grant.value.declare`, `create`, `edit` | поле | 15-catalog | `design/domains/15-catalog.md:62-66#8259bb` | 14-trust (`declared`) | ADR-25 · R2 |
| `std/setup` | тип | 22-run | `design/domains/22-run.md:58-81#e36013` | 15-catalog, 30-adapters (модели), 23-bench и вызов (`setup@n`) | ADR-28 · R4 |
| тело `core/namespace` (`name`, `owner`, `imports`, `policy`, `doc`) | тип (генезис) | 15-catalog | `design/domains/15-catalog.md:14-23#a5db9d` | 10-kernel (`origin` — поле 10-kernel, R1), 14-trust (`policy`) | ADR-28 · R4 (N-14) |
| кортеж исполнения | правило | 22-run | `design/domains/22-run.md:72-80#2b7e11`; T131 | 10-kernel (`impl.pins`), 12-ledger (раздел `executions`), 13-rules (`learning-gate`), 20-lens, 21-compose, 23-bench (`bench-run.tuple`) | T-2 · R5 Q2 · C2a (N-74, N-108) · RN-20 |
| обновление `std` (`update(package)`, коммит импорта) | операция | 15-catalog | `design/domains/15-catalog.md:39-47#9cbb2f` | 12-ledger (шаг 1: заголовок копий), 11-identity-grain (план перезерновки), 22-run / 30-adapters (команда, хост-сессия) | CT-10 · D06 Q1 |
| `reads` / `writes` способности стадии | поле | 13-rules | `design/02-glossary.md` T132 | 22-run, 20-lens, 21-compose | T-3 · R5 Q1 |
| `Deps` (`view`), `View` | формат | 22-run | `design/domains/22-run.md:130-136#8fab77`; T133 | 20-lens, 21-compose, 30-adapters | T-3 · R5 Q1 · C2a (N-83) |
| `LedgerView` (чтения индекса на `seq`) | порт (чтение) | 12-ledger | `design/domains/12-ledger.md:137#1351a3` | 22-run (`View`), 13-rules | C2a (N-83) |
| раздел индекса `executions` | формат | 12-ledger | `design/domains/12-ledger.md:92#2d3ab2` | 13-rules (`ref-exists`, `learning-gate`) | ADR-3 · C2a (N-75) |
| проверки ядра | правило | 13-rules | `design/domains/13-rules.md:57-65#f1aeab`; T134; слой — замороженное ядро (ADR-32) | 10-kernel, 11-identity-grain (`split`/`merge`), 21-compose | T-16 · R5 Q3 |
| `core/trust-policy.lens` (`exclude`, `mark`) | поле | 14-trust (форма) · 20-lens (значения `std`) | `design/domains/14-trust.md:116#2031b8`; значения — `design/domains/20-lens.md:163#7a99d2` | 20-lens (`pool`, стадия `trust`) | 20-lens/И-6 · R5 Q5 · N-40 · D08 Q5 |
| `calibrated_for` порога | поле | 20-lens | `design/domains/20-lens.md:92-97#1c27e0` (T136) | 21-compose (`same_hi/lo`), 22-run (отказ) | 20-lens/И-4, И-7 · R5 Q10 · LN-07 · D08 Q4 |
| `std/pool` | значение | 20-lens | `design/domains/20-lens.md:59-67#c9d20c` (T77) | 22-run (коммит прогона), 23-bench (`pool-recall`) | LN-14 · И-14 · D08 Q7 |
| шаблон `card` типа | поле | 20-lens | `design/domains/20-lens.md:32-37#cb1e8d` | 10-kernel (таблица полей `core/type`), 13-rules (`std/capability`) | LN-09 · ADR-12 · D08 Q1 |
| кандидат (`candidates[]`), `marks`, `boosts` | формат, поля | 20-lens | `design/domains/20-lens.md:81,86,161-164#6ced0b` (T87, T149, T150) | 21-compose (`select`), 22-run (`Ctx`) | LN-06, LN-11 · D08 Q3, Q5 |
| стадии LENS (`std/stage.normalize` … `cut`), их `reads`/`writes` | способности | 20-lens | `design/domains/20-lens.md:69-98#8dbb7b` | 22-run (конвейер `std/pipeline.solve`) | LN-03 · T-3 · D08 |
| стадии compose (`frame`, `recall`, `recheck`, `select`, `self-search`, `check`), их `reads`/`writes`, параметры `recall` | способности | 21-compose | `design/domains/21-compose.md:106-123#3c18a6`, `:67-99` | 22-run (конвейер) | CP-05 · T-3 · D09 |
| `core/session.purpose` | поле | 14-trust | `design/domains/14-trust.md:31#584743` | 22-run, 23-bench, 20-lens, 30-adapters (хост) | T-5 · R6 Q1 · C2b: `recall` — не читает (T137) |
| копия кампании (`.lattice/bench/<run>`, хэш в `bench-run`), кампания | формат | 23-bench | `design/domains/23-bench.md:72-86#1b9b6a`; T138, T162 | 12-ledger, 22-run | T-5 · R6 Q1 |
| гейт обучения (`learning-gate`) | примитив | 13-rules | `design/domains/13-rules.md` §2 (ADR-29) | 22-run (`run`, факты обучения), 23-bench, 14-trust | ADR-29 · R6 Q2 |
| `core/trust-policy.candidates` | поле | 14-trust (форма) · 21-compose (значения `std`) | `design/domains/14-trust.md:117#f5f868`; значения — `design/domains/21-compose.md:177-182#ac4541` | 11-identity-grain, 21-compose | T-8 · R6 Q4 · N-40 · D09 Q6 |
| `core/session.software` | поле | 14-trust | `design/domains/14-trust.md:35#3e88c0` | 30-adapters (хост, парсер) | 14-trust/И-4 · R4 Q5 · T148 |
| голос группы; `trust().groups`, `trust().policy` | правило, поля | 14-trust | `design/domains/14-trust.md:59-62,162-171#43a365` | 12-ledger (раздел `trust`), 20-lens, 23-bench | D07 Q3, Q4 · T147 |
| `divide(need, parts, by)` | операция | 21-compose | `design/02-glossary.md` T140 | 11-identity-grain (`core/deprecate`) | 21-compose/И-6 · R6 Q5 |
| окно удаления членства | правило | 22-run | `design/domains/22-run.md:348-351#40340b` (ADR-20) | 14-trust (числа в политике) | ADR-20 · R6 Q6 |
| регрессионный план (`base`, δ, ротация `test`) | правило | 23-bench | `design/domains/23-bench.md:28-32#c4d2af`, `design/domains/23-bench.md:113-120#2346b5`, `design/domains/23-bench.md:125-127#733039`; T143 | 22-run (гейт ADR-29) | 23-bench/И-14, И-15 · R6 Q9 |
| `rows` (строки вызова), id новых у стадии | поле, правило | 22-run | `design/domains/22-run.md:116-123#bcfaa1`; T156 | 20-lens (`pool`, `judge`), 21-compose (`recall`, `self-search`, `materialize`), 12-ledger (шаг 1 коммита) | RN-09 · D10a Q2, Q3 |
| стадия `materialize` | способность | 21-compose | `design/domains/21-compose.md:120#63db43` | 22-run (конвейер) | RN-08 · D10a Q1 |
| `describe()` (`Ident`) | метод портов LLM | 22-run | `design/domains/22-run.md:231, 237-238#cbef3e`; T154 | 20-lens (`Judge`), 21-compose (`Composer`), 30-adapters | RN-10 · D10a Q5 |
| таблица сбоев вызова | правило | 22-run | `design/domains/22-run.md:180-188#e3ead9` | 12-ledger (`open()`), 30-adapters (CLI) | RN-11 · D10a Q4 |
| файл хода `.lattice/runs/<id>.log` | формат | 22-run | `design/domains/22-run.md:190-193#4a1e72`; T155 | 30-adapters (каталог `.lattice/`) | RN-12 · D10a Q6 |
| `std/pipeline`, стадии `std/pipeline.solve@1` | тип, объект | 22-run | `design/domains/22-run.md:12-56#1d5eff` | 13-rules (`contract`), 23-bench (регрессия) | RN-01, RN-08 · N-10 |
| `std/execution@1` | событие | 22-run | `design/domains/22-run.md:195-224#c20331`; T98 | 12-ledger (сегмент), 20-lens (`measurement.execution`), 23-bench, 14-trust (гейт — через вердикт) | RN-06 · И-18 · N-10 |
| `std/verdict@1` | событие | 22-run | `design/domains/22-run.md:268-297#ee4a53`; T100 | 14-trust (голос через `via`), 13-rules (`learning-gate`), 30-adapters (`lattice verdict`), 23-bench (`simulate-consumer`) | RN-04, RN-18 · D10b Q3 |
| строка обучения (`from`, `policy`) | правило, поля | 22-run | `design/domains/22-run.md:301-311#3c42cf`; T157 | 21-compose (`std/member`, `std/cue` — поля `design/domains/21-compose.md:21,23,46#ff2cbd`), 14-trust (автор — сессия вердикта, `design/domains/14-trust.md:81#2fd920`), 13-rules (гейт) | RN-14 · D10b Q1 |
| `std/learned-assert` | тип | 22-run | `design/domains/22-run.md:302-304#f5f8a5`; T158 | 14-trust (утверждения и наследники, `design/domains/14-trust.md:55#490ca0`) | RN-14 · D10b Q1 |
| сессия `learn` (`purpose: learn`), поток `verdict → learn` | правило, операция | 22-run | `design/domains/22-run.md:312-326#f3aeb8`; T159 | 14-trust (`purpose`), 30-adapters (хост), 15-catalog (допуск) | RN-13 · D10b Q2 |
| правила обучения (таблица «вердикт → факты»), калибровка | правило | 22-run | `design/domains/22-run.md:331-357#4416ff` | 14-trust (`calibration`), 21-compose (`recall`, `recheck`) | RN-05, RN-15 · D10b Q4 |
| путь подсказки (рождение, подтверждение, recheck прежней ревизии) | правило | 22-run | `design/domains/22-run.md:359-368#a95ff0` | 20-lens (LN-10), 21-compose (`recheck`, `design/domains/21-compose.md:116#b77215`) | RN-16 · D10b Q5 |
| `replay`, горизонт replay | операция, правило | 22-run | `design/domains/22-run.md:369-390#bed96e`; T160 | 12-ledger (срок сегмента), 13-rules (`revalidate`, N-53), 20-lens (кэш) | RN-07, RN-17 · D10b Q6, Q7 |
| сессия симулятора (`purpose: simulate`) | правило | 23-bench | `design/domains/23-bench.md:87-92#b75703`; T163 | 13-rules (`learning-gate`), 14-trust (`purpose`), 22-run (обучение), 30-adapters (хост), 01-first-run (R5, R8) | BN-04 · D11 Q5 |
| метрики стенда, протокол калибровок | правило | 23-bench | `design/domains/23-bench.md:52-70#3ec794`, `design/domains/23-bench.md:105-109#3aefe1` | 20-lens (`no_match`, `pool-recall`), 21-compose (`same_hi/lo`), 11-identity-grain (`min_p`), 01-first-run (замеры) | BN-03 · N-45, N-56, N-57 |
| хост (T164), `purpose` команд хоста | правило | 30-adapters | `design/domains/30-adapters.md:67-93#295eb5` | 14-trust, 15-catalog, 22-run, 23-bench | AD-10 · ADR-25 · D12 Q4 |
| корень сборки `src/cli/wire.ts` (T166) | модуль | 30-adapters | `design/domains/30-adapters.md:40-43#04c1bd`; 04 — ссылкой `design/04-architecture.md:56-58#e4b18d` | 04-architecture (матрица, тест структуры, AR-07) | AD-01 · T-10 · D12 Q0 |
| матрица зависимостей (T168), интерфейс домена `types.ts` (T167) | правило | 04-architecture | `design/04-architecture.md:16-39#b2115c` | все домены («Зависит от»), 30-adapters (`design/domains/30-adapters.md:13#9b212e`, :35-36) | AR-04, AR-06 · D13 Q1 |
| тест структуры (T169) | правило | 04-architecture | `design/04-architecture.md:43-52#9e9b16` | 30-adapters (инв. 1), 05-slices (S0) | AR-04 · 30-adapters/И-3 |
| проекция индекса `Projection` (T170) | формат | 12-ledger | `design/domains/12-ledger.md:97-100#3d43a9`; механизм — `design/04-architecture.md:60-62#0e4e5b` | 14-trust (раздел `trust`), 30-adapters (корень сборки) | AR-08 · N-32 · D13 Q2 |
| граница «журнал / проводка» | правило | 04-architecture | `design/04-architecture.md:64-73#d196e3` | 22-run (`std/setup`), 30-adapters (проводка) | AR-09 · PF-01 |
| срез, «Готово, когда», инвариант → срез (T171) | правило | 05-slices | `design/05-slices.md:7-45#d338a3` | все домены («Инварианты»), 01-first-run | SL-01…04 · D13 |
| проводка `bindings`, ссылка на секрет `$env` (T128, T127) | формат | 30-adapters | `design/domains/30-adapters.md:44-65#c74c34` | 22-run (`std/setup` — «что лежит»), 04-architecture | AD-06, AD-08 · PF-03 · N-5 |
| каталог данных `.lattice/` | формат | 30-adapters | `design/domains/30-adapters.md:95-110#907d2b` | 12-ledger, 22-run, 23-bench, 01-first-run | D12 Q0 |
| протокол режима агента (`pending`, `lattice answer`, `.lattice/answers/`) | правило | 30-adapters | `design/domains/30-adapters.md:146-163#7aa923` | 21-compose, 22-run | AD-09 · ADR-19 · D12 Q2 |
| «Формат v1» — перечень | правило | 10-kernel | `design/domains/10-kernel.md:80-87#c1d4a0` | 12-ledger (заголовок строки, маркер), 05-slices (S1) | KR-02 · ADR-1 · C2b |
| `std/payload` (T175) | тип | 22-run | `design/domains/22-run.md:216#d52d82` | 12-ledger (основной журнал), 10-kernel (`std`) | RN-22 · C2b |
| `Ctx.run`, `needs[].solution` | поля | 22-run | `design/domains/22-run.md:88#3c017c`, `design/domains/22-run.md:99#8a874b`, `design/domains/22-run.md:109#00a05d` | 21-compose (`materialize`), `deliver` | RN-21 · C2b |
| смена владельца, `transfer` | правило, операция | 15-catalog | `design/domains/15-catalog.md:68#ded37d`, `design/domains/15-catalog.md:126#773eaa` | 14-trust, 30-adapters | CT-03 · ADR-25 · C2b |
| `std/load-finding` (T165) | факт | 30-adapters | `design/domains/30-adapters.md:197-208#d28e23` | 13-rules (RL-06) | AD-11 · ADR-10 · D12 Q3 |
| `warrant/norm`, `warrant/summary` | типы проекта | 30-adapters (`source-warrant`) | `design/domains/30-adapters.md:168-175#66265f` | 20-lens (шаблон), 14-trust (TR-09) | AD-12 · D12 Q5, Q6 |

## 3. Без владельца

Понятия, встречающиеся только в глоссарии (lint знает 7). Для каждого — все упоминания в `design/` (включая
JSON-примеры внутри кода, которые индексатор lint не считает «Моделью»), предложенный владелец и довод.

| Понятие | Упоминания (grep design/) | Предложенный владелец | Довод |
|---|---|---|---|
| `core/trust-policy` | закрыто D07 (N-7): `design/domains/14-trust.md` §4 | 14-trust | поля и кто переопределяет — таблица §4 (TR-05) |
| `std/block` | — | нет типа (D01 Q0) | T66: блок — признак (`card`); тип убран из списка `std` (10-kernel/И-22); N-8 — только `std/card` |
| `std/capability` | закрыто D04 (N-9): `design/domains/13-rules.md` §3 | 13-rules | тело в прозе «Модели» §3 |
| `std/card` | закрыто D08 (N-8): `design/domains/20-lens.md` §1 | 20-lens | тело `{of, title, summary, cues}` и шаблон типа `card` — §1, LN-09 |
| `std/pipeline` | закрыто D10a (N-10): `design/domains/22-run.md:12-56#1d5eff`; v0.3 04-architecture:86; `design/domains/22-run.md:17-44#8a33df` (тело в JSON-примере) | 22-run | конвейер определён и исполняется целиком в 22-run.md §1,3 |
| `std/execution` | закрыто D10a (N-10): `design/domains/22-run.md:195-224#c20331` | 22-run | событие вызова описано текстом в RN-06; формализация — предложение 22-run/И-18 (`std/execution@1`) |
| `std/verdict` | закрыто D10b (N-10): `design/domains/22-run.md:268-297#ee4a53` | 22-run | вердикт и цикл обучения — 22-run.md §5-6 (RN-04) |

## 4. Два определения

| Понятие | Адреса | Расхождение | Предложенный владелец |
|---|---|---|---|
| `std/domain` | `design/domains/10-kernel.md:19#f52b0e` (пример ревизии, тело: `name, code, language`) vs `design/domains/11-identity-grain.md:33-34#3ba8c8` (пример сущности, тело: `project, name, language, code`) | у kernel-примера нет поля `project`, которое зерно типа (v0.3 11-identity-grain:29) включает как измерение — тела двух примеров одного типа не совпадают по составу полей | 11-identity-grain (зерно и правила слияния определены здесь; kernel-пример — иллюстрация формата ревизии вообще, не модель `std/domain`); **D01:** 10-kernel — только иллюстрация, ссылка на [11] (N-11); **D03:** закрыто — тело без `project`, область — пространство (GR-13) |
