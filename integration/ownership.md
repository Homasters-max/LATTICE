# ownership.md — карта владения (S0, черновик)

Черновик карты владения понятиями `design/` v0.3; владельцы уточняются в сессиях D. Правило ADR-24: контракт
порта закрепляется у домена-потребителя (основного, если их несколько); `30-adapters` — только реализации, корень
сборки, CLI. `?` в «Решение» — владелец предложен агентом, не решён.

## 1. Понятия v0.3

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/actor` | тип | 14-trust | `design/domains/14-trust.md:18` | 10-kernel (`by`), 15-catalog (owner) | TR-03 |
| `core/alias` | факт | 11-identity-grain | `design/domains/11-identity-grain.md:102-116` | 14-trust (п.7), 15-catalog | GR-05 |
| `core/assert` | тип | 14-trust | `design/domains/14-trust.md:40-58` | 23-bench (И-2) | TR-02 |
| `core/deprecate` | факт | 15-catalog | `design/domains/15-catalog.md:100` | 11-identity-grain (п.4) | CT-05 |
| `core/fact` | тип | 10-kernel | `design/domains/10-kernel.md:109-123` | все домены | KR-13 |
| `core/grant` | факт | 15-catalog | `design/domains/15-catalog.md:59-63` | 14-trust (`declare`) | CT-03, CT-13, CT-14 |
| `core/member` | факт | 10-kernel | `design/domains/10-kernel.md:156-176` (факт); домены — 15-catalog | 20-lens (пул), 21-compose (наследник `std/member`) | KR-13 · D09 Q1 |
| `std/member` | факт | 21-compose | `design/domains/21-compose.md:23,42-46,58` | 13-rules (`solution-size`), 14-trust (доверие членств), 15-catalog (допуск), 22-run (обучение) | CP-11 · T151 · D09 Q1 |
| `core/proposal` | событие | 15-catalog | `design/domains/15-catalog.md:73-75` | 14-trust (`core/assert` ±1) | CT-03, CT-11 |
| `core/retire` | факт | 15-catalog | `design/domains/15-catalog.md:101` | 20-lens (не выдаёт) | CT-05 |
| `core/rule` | тип | 13-rules | `design/domains/13-rules.md:14-22` | 10-kernel (`type.rules`), 12-ledger (коммит) | RL-01 |
| `core/session` | тип | 14-trust | `design/domains/14-trust.md:19` | 10-kernel (`by`) | TR-03 |
| `core/snapshot` | тип | 21-compose | `design/domains/21-compose.md:25` | 12-ledger (индекс `snapshots`) | CP-02 |
| `core/type` | тип | 10-kernel | `design/domains/10-kernel.md:117-155` | все домены | KR-08 |
| `std/bench-plan` | тип | 23-bench | `design/domains/23-bench.md:15` | — | BN-02 |
| `std/bench-run` | событие | 23-bench | `design/domains/23-bench.md:16` | — | BN-01 |
| `std/bench-set` | тип | 23-bench | `design/domains/23-bench.md:14` | 30-adapters (source-warrant) | BN-01 |
| `std/ctx` | тип | 22-run | `design/domains/22-run.md:76-114` | 20-lens, 21-compose (стадии), 13-rules (контракт) | RN-02 |
| `std/cue` | факт | 21-compose | `design/domains/21-compose.md:21,34-37` | 20-lens (LN-02, LN-10), 14-trust (п.7), 22-run (обучение) | CP-01 · 20-lens/И-9 · N-43 |
| `std/distinct` | факт | 11-identity-grain | `design/domains/11-identity-grain.md:138-146` | 21-compose (потребности), 22-run (обучение), `core/trust-policy.candidates` (память отказов) | CP-01 · T-8 · R6 Q4 |
| `std/domain` | тип | 11-identity-grain | `design/domains/11-identity-grain.md:26-35` | 10-kernel (пример), 30-adapters (создание доменов) | GR-13 · D03 |
| `std/gap` | событие | 21-compose | `design/domains/21-compose.md:26,62,154-155` | 22-run (пакет), 23-bench (E4) | CP-07 · D09 Q4 |
| `std/knowledge` | тип | 20-lens | `design/domains/20-lens.md:50` | 15-catalog (публикация), 30-adapters (`warrant/norm` расширяет) | LN-14 · N-13 · D08 Q6 |
| `std/link` | факт | 21-compose | `design/domains/21-compose.md:24,60-61` | 13-rules (`acyclic` с `role`) | CP-04 · ADR-17 |
| `std/measurement` | событие | 20-lens | `design/domains/20-lens.md:129-143` | 14-trust (TR-06), 22-run (трасса, replay), 12-ledger (сегмент) | LN-08 · И-14 · T-4 |
| `std/need` | тип | 21-compose | `design/domains/21-compose.md:20` | 15-catalog (допуск), 20-lens (вход) | CP-01 |
| `std/solution` | тип | 21-compose | `design/domains/21-compose.md:22,59` | 15-catalog (допуск) | CP-02, CP-04 |
| `std/term` | тип | 20-lens | `design/domains/20-lens.md:51` | 21-compose (ключ потребности, цель `std/cue`), 30-adapters (словарь WARRANT) | LN-14 · N-13 · D08 Q6 |
| `std/trust-policy` | экземпляр политики по умолчанию | 14-trust | `design/domains/14-trust.md:96-115` | 15-catalog (`namespace.policy`) | TR-05 |
| `store` (порт) | порт | 12-ledger | `design/domains/12-ledger.md:110-132` | 30-adapters (`store-jsonl`, `store-memory`) | ADR-24 · LG-05 (D05) |
| `judge` (порт) | порт | 20-lens | `design/domains/20-lens.md:100-126` | 21-compose (recall, select), 11-identity-grain (GR-06), 30-adapters (реализации) | ADR-24 · LN-04 · D08 |
| `composer` (порт) | порт | 21-compose | `design/domains/21-compose.md:192-217` (D09; 30-adapters:25-28 — снять, N-48) | 22-run (runtime) | ADR-24 · CP-14 |
| `source` (порт) | порт | 21-compose | `design/domains/21-compose.md:200-207` (D09; 30-adapters:30-35 — снять, N-48) | 22-run (deliver), 30-adapters (source-warrant), 15-catalog (`load`) | ADR-24 · CP-14 · 30-adapters/И-9 (R4 Q7) |
| `exec` (порт) | порт | 22-run | `design/domains/22-run.md:209,216-217` (D10a; 30-adapters:14 — снять, N-51) | — | ADR-24 · D10a Q0
| `clock`, `ids` (порт) | порт | 12-ledger | `design/domains/12-ledger.md:120-121` (D05; 30-adapters:15 — ссылкой, N-23) | 10-kernel (`newId(namespace, ulid)`, `revision(input, at)` — аргументами), 22-run (`Deps`, T133) | D02 Q2, ADR-24 |
| `Meta` | формат | 22-run | `design/domains/22-run.md:203-213` (D10a; 30-adapters:23 — снять, N-51); T135 | 20-lens, 21-compose, 30-adapters (адаптеры отдают) | N-12 · R5 Q7: основной потребитель — рантайм (бюджет, трасса), ADR-24 |
| `Scored` | формат | 20-lens | `design/domains/20-lens.md:108` | 30-adapters (реализации) | ADR-24 · D08 |
| `Chosen` | формат | 20-lens | `design/domains/20-lens.md:109` | 30-adapters (реализации) | ADR-24 · D08 |
| `id` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:25` | все домены | KR-01 |
| `type` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:26` | все домены | KR-01 |
| `version` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:27` | 12-ledger (LG-06) | KR-03 |
| `at` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:28` | 12-ledger (порядок) | LG-04 |
| `by` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:29` | 14-trust (доверие) | TR-01 |
| `body` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:30` | все домены | KR-02 |
| ревизия (формат записи) | формат | 10-kernel | `design/domains/10-kernel.md:12-48` | все домены | KR-01 |

## 2. Новые понятия из итогов

Понятия, которых нет в v0.3, введённые пунктами `research/analysis/arch-changes.md`; ещё не внесены в `design/`.

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/commit` | факт (маркер) | 12-ledger | `design/domains/12-ledger.md:30-32` | 10-kernel (генезис), 13-rules (`kernel`), 22-run | 12-ledger/И-9 · LG-12 (D05) |
| `core/holds` | событие | 10-kernel | `design/domains/10-kernel.md:177-186` | 14-trust | 10-kernel/И-6 · R4 Q9, D01 Q3: событие генезиса, провенанс |
| `core/namespace.origin` | поле | 10-kernel | `design/domains/10-kernel.md:100-102` | 15-catalog (импорт) | 10-kernel/И-27 · R1: владелец 10-kernel (`core/namespace` — тип генезиса) |
| `core/assert.via` | поле | 14-trust | `design/domains/14-trust.md:50` | 22-run (`learn`) | 14-trust/И-7 · ADR-5 |
| `core/rule.examples`, `core/rule.when` | поле | 13-rules | `design/domains/13-rules.md` §1 | 21-compose (`form`, ADR-17) | 13-rules/И-1 · D04 Q5 |
| нарушение (оболочка `{row, rule, message}`) | формат | 13-rules | `design/domains/13-rules.md` §2 | 11-identity-grain (`grain-unique`), 12-ledger (отказ коммита) | 13-rules/И-4 · D04 Q2 |
| `impl.pins` | поле | 13-rules | `design/domains/13-rules.md` §3 | 22-run (кортеж, отказ рантайма), 15-catalog | 10-kernel/И-33 · T-2 |
| `std/alias-candidate` | тип | 11-identity-grain | `design/domains/11-identity-grain.md:131-134` | 21-compose (И-2), 20-lens, 30-adapters (импорт) | ADR-8 · R3 |
| `core/type.grain_scope` | поле | 11-identity-grain | `design/adr/0027-grain-scope.md` | 12-ledger (индекс `grain`), 13-rules (`grain-unique`) | ADR-27 · R3 |
| уровень `core/type.schema` | поле | 13-rules | `design/adr/0009-schema-field-as-rule.md` | 10-kernel (`core/type`) | ADR-9 · R3 |
| `std/ctx.needs[].found` | поле | 22-run | `design/domains/22-run.md:79-114` (`Ctx`, D10a); стадии — `design/domains/21-compose.md:108-117` | 21-compose | 21-compose/И-9 · T152 |
| `core/type.writers`, `core/type.inForce` | поле | 10-kernel | `design/adr/0006-control-fact-writers.md` | 13-rules (`owner`), 15-catalog, 14-trust, 11-identity-grain | ADR-6 · R2 |
| реестр участников (`core/actor` пишет владелец) | правило | 14-trust | `design/domains/14-trust.md:22` | 15-catalog, 22-run, 30-adapters (хост) | ADR-25 · R2 |
| группа независимости | правило | 14-trust | `design/domains/14-trust.md:33` | 20-lens, 22-run, 23-bench | ADR-26 · R2 |
| `trust().overruled` | поле | 14-trust | `design/domains/14-trust.md:91` | 20-lens (исключает) | 14-trust/И-13 · R2 |
| `core/grant.value.declare`, `create`, `edit` | поле | 15-catalog | `design/domains/15-catalog.md:59-63` | 14-trust (`declared`) | ADR-25 · R2 |
| `std/setup` | тип | 22-run | `design/domains/22-run.md:58-74` | 15-catalog, 30-adapters (модели), 23-bench и вызов (`setup@n`) | ADR-28 · R4 |
| тело `core/namespace` (`name`, `owner`, `imports`, `policy`, `doc`) | тип (генезис) | 15-catalog | `design/domains/15-catalog.md:14-23` | 10-kernel (`origin` — поле 10-kernel, R1), 14-trust (`policy`) | ADR-28 · R4 (N-14) |
| кортеж исполнения | правило | 22-run | `design/domains/22-run.md:70-71`, `design/domains/22-run.md:189-190`; T131 | 10-kernel (`impl.pins`), 20-lens, 21-compose, 23-bench (план) | T-2 · R5 Q2 |
| обновление `std` (`update(package)`, коммит импорта) | операция | 15-catalog | `design/domains/15-catalog.md:36-44` | 12-ledger (шаг 1: заголовок копий), 11-identity-grain (план перезерновки), 22-run / 30-adapters (команда, хост-сессия) | CT-10 · D06 Q1 |
| `reads` / `writes` способности стадии | поле | 13-rules | `design/02-glossary.md` T132 | 22-run, 20-lens, 21-compose | T-3 · R5 Q1 |
| `Deps` (`view`) | формат | 22-run | `design/domains/22-run.md:115-126`; T133 | 20-lens, 21-compose, 30-adapters | T-3 · R5 Q1 |
| проверки ядра | правило | 13-rules | `design/02-glossary.md` T134 | 10-kernel, 11-identity-grain (`split`/`merge`), 21-compose | T-16 · R5 Q3 |
| `core/trust-policy.lens` (`exclude`, `mark`) | поле | 14-trust (форма) · 20-lens (значения `std`) | `design/domains/14-trust.md:109`; значения — `design/domains/20-lens.md:159` | 20-lens (`pool`, стадия `trust`) | 20-lens/И-6 · R5 Q5 · N-40 · D08 Q5 |
| `calibrated_for` порога | поле | 20-lens | `design/domains/20-lens.md:92-97` (T136) | 21-compose (`same_hi/lo`), 22-run (отказ) | 20-lens/И-4, И-7 · R5 Q10 · LN-07 · D08 Q4 |
| `std/pool` | значение | 20-lens | `design/domains/20-lens.md:59-67` (T77) | 22-run (коммит прогона), 23-bench (`pool-recall`) | LN-14 · И-14 · D08 Q7 |
| шаблон `card` типа | поле | 20-lens | `design/domains/20-lens.md:32-37` | 10-kernel (таблица полей `core/type`), 13-rules (`std/capability`) | LN-09 · ADR-12 · D08 Q1 |
| кандидат (`candidates[]`), `marks`, `boosts` | формат, поля | 20-lens | `design/domains/20-lens.md:81,86,157-160` (T87, T149, T150) | 21-compose (`select`), 22-run (`Ctx`) | LN-06, LN-11 · D08 Q3, Q5 |
| стадии LENS (`std/stage.normalize` … `cut`), их `reads`/`writes` | способности | 20-lens | `design/domains/20-lens.md:69-98` | 22-run (конвейер `std/pipeline.solve`) | LN-03 · T-3 · D08 |
| стадии compose (`frame`, `recall`, `recheck`, `select`, `self-search`, `check`), их `reads`/`writes`, параметры `recall` | способности | 21-compose | `design/domains/21-compose.md:101-117`, `:67-99` | 22-run (конвейер) | CP-05 · T-3 · D09 |
| `core/session.purpose` | поле | 14-trust | `design/domains/14-trust.md:28` | 22-run, 23-bench, 20-lens, 21-compose (`recall`), 30-adapters (хост) | T-5 · R6 Q1 |
| копия кампании (`.lattice/bench/<run>`, хэш в `bench-run`) | формат | 23-bench | `design/02-glossary.md` T138 | 12-ledger, 22-run | T-5 · R6 Q1 |
| гейт обучения (`learning-gate`) | примитив | 13-rules | `design/domains/13-rules.md` §2 (ADR-29) | 22-run (`run`, факты обучения), 23-bench, 14-trust | ADR-29 · R6 Q2 |
| `core/trust-policy.candidates` | поле | 14-trust (форма) · 21-compose (значения `std`) | `design/domains/14-trust.md:110`; значения — `design/domains/21-compose.md:168-173` | 11-identity-grain, 21-compose | T-8 · R6 Q4 · N-40 · D09 Q6 |
| `core/session.software` | поле | 14-trust | `design/domains/14-trust.md:31` | 30-adapters (хост, парсер) | 14-trust/И-4 · R4 Q5 · T148 |
| голос группы; `trust().groups`, `trust().policy` | правило, поля | 14-trust | `design/domains/14-trust.md:54-57,154-163` | 12-ledger (раздел `trust`), 20-lens, 23-bench | D07 Q3, Q4 · T147 |
| `divide(need, parts, by)` | операция | 21-compose | `design/02-glossary.md` T140 | 11-identity-grain (`core/deprecate`) | 21-compose/И-6 · R6 Q5 |
| окно удаления членства | правило | 22-run | `design/domains/22-run.md:320-323` (ADR-20) | 14-trust (числа в политике) | ADR-20 · R6 Q6 |
| регрессионный план (`base`, δ, ротация `test`) | правило | 23-bench | `design/02-glossary.md` T143 | 22-run (гейт ADR-29) | 23-bench/И-14, И-15 · R6 Q9 |
| `rows` (строки вызова), id новых у стадии | поле, правило | 22-run | `design/domains/22-run.md:105-112`; T156 | 20-lens (`pool`, `judge`), 21-compose (`recall`, `self-search`, `materialize`), 12-ledger (шаг 1 коммита) | RN-09 · D10a Q2, Q3 |
| стадия `materialize` | способность | 21-compose | `design/domains/21-compose.md:115` | 22-run (конвейер) | RN-08 · D10a Q1 |
| `describe()` (`Ident`) | метод портов LLM | 22-run | `design/domains/22-run.md:208,214-215`; T154 | 20-lens (`Judge`), 21-compose (`Composer`), 30-adapters | RN-10 · D10a Q5 |
| таблица сбоев вызова | правило | 22-run | `design/domains/22-run.md:162-170` | 12-ledger (`open()`), 30-adapters (CLI) | RN-11 · D10a Q4 |
| файл хода `.lattice/runs/<id>.log` | формат | 22-run | `design/domains/22-run.md:172-175`; T155 | 30-adapters (каталог `.lattice/`) | RN-12 · D10a Q6 |
| `std/pipeline`, стадии `std/pipeline.solve@1` | тип, объект | 22-run | `design/domains/22-run.md:12-56` | 13-rules (`contract`), 23-bench (регрессия) | RN-01, RN-08 · N-10 |
| `std/execution@1` | событие | 22-run | `design/domains/22-run.md:177-201`; T98 | 12-ledger (сегмент), 20-lens (`measurement.execution`), 23-bench, 14-trust (гейт — через вердикт) | RN-06 · И-18 · N-10 |
| `std/verdict@1` | событие | 22-run | `design/domains/22-run.md:243-271`; T100 | 14-trust (голос через `via`), 13-rules (`learning-gate`), 30-adapters (`lattice verdict`), 23-bench (`simulate-consumer`) | RN-04, RN-18 · D10b Q3 |
| строка обучения (`from`, `policy`) | правило, поля | 22-run | `design/domains/22-run.md:275-284`; T157 | 21-compose (`std/member`, `std/cue` — поля `design/domains/21-compose.md:21,23,46`), 14-trust (автор — сессия вердикта, `design/domains/14-trust.md:78`), 13-rules (гейт) | RN-14 · D10b Q1 |
| `std/learned-assert` | тип | 22-run | `design/domains/22-run.md:276-278`; T158 | 14-trust (утверждения и наследники, `design/domains/14-trust.md:51`) | RN-14 · D10b Q1 |
| сессия `learn` (`purpose: learn`), поток `verdict → learn` | правило, операция | 22-run | `design/domains/22-run.md:285-299`; T159 | 14-trust (`purpose`), 30-adapters (хост), 15-catalog (допуск) | RN-13 · D10b Q2 |
| правила обучения (таблица «вердикт → факты»), калибровка | правило | 22-run | `design/domains/22-run.md:303-329` | 14-trust (`calibration`), 21-compose (`recall`, `recheck`) | RN-05, RN-15 · D10b Q4 |
| путь подсказки (рождение, подтверждение, recheck прежней ревизии) | правило | 22-run | `design/domains/22-run.md:331-340` | 20-lens (LN-10), 21-compose (`recheck`, `design/domains/21-compose.md:113`) | RN-16 · D10b Q5 |
| `replay`, горизонт replay | операция, правило | 22-run | `design/domains/22-run.md:341-359`; T160 | 12-ledger (срок сегмента), 13-rules (`revalidate`, N-53), 20-lens (кэш) | RN-07, RN-17 · D10b Q6, Q7 |

## 3. Без владельца

Понятия, встречающиеся только в глоссарии (lint знает 7). Для каждого — все упоминания в `design/` (включая
JSON-примеры внутри кода, которые индексатор lint не считает «Моделью»), предложенный владелец и довод.

| Понятие | Упоминания (grep design/) | Предложенный владелец | Довод |
|---|---|---|---|
| `core/trust-policy` | закрыто D07 (N-7): `design/domains/14-trust.md` §4 | 14-trust | поля и кто переопределяет — таблица §4 (TR-05) |
| `std/block` | — | нет типа (D01 Q0) | T66: блок — признак (`card`); тип убран из списка `std` (10-kernel/И-22); N-8 — только `std/card` |
| `std/capability` | закрыто D04 (N-9): `design/domains/13-rules.md` §3 | 13-rules | тело в прозе «Модели» §3 |
| `std/card` | закрыто D08 (N-8): `design/domains/20-lens.md` §1 | 20-lens | тело `{of, title, summary, cues}` и шаблон типа `card` — §1, LN-09 |
| `std/pipeline` | закрыто D10a (N-10): `design/domains/22-run.md:12-56`; `04-architecture.md:86`; `domains/22-run.md:14-36` (тело в JSON-примере) | 22-run | конвейер определён и исполняется целиком в 22-run.md §1,3 |
| `std/execution` | закрыто D10a (N-10): `design/domains/22-run.md:177-201` | 22-run | событие вызова описано текстом в RN-06; формализация — предложение 22-run/И-18 (`std/execution@1`) |
| `std/verdict` | закрыто D10b (N-10): `design/domains/22-run.md:243-271` | 22-run | вердикт и цикл обучения — 22-run.md §5-6 (RN-04) |

## 4. Два определения

| Понятие | Адреса | Расхождение | Предложенный владелец |
|---|---|---|---|
| `std/domain` | `design/domains/10-kernel.md:19` (пример ревизии, тело: `name, code, language`) vs `design/domains/11-identity-grain.md:32-33` (пример сущности, тело: `project, name, language, code`) | у kernel-примера нет поля `project`, которое зерно типа (`identity-grain.md:29`) включает как измерение — тела двух примеров одного типа не совпадают по составу полей | 11-identity-grain (зерно и правила слияния определены здесь; kernel-пример — иллюстрация формата ревизии вообще, не модель `std/domain`); **D01:** 10-kernel — только иллюстрация, ссылка на [11] (N-11); **D03:** закрыто — тело без `project`, область — пространство (GR-13) |
