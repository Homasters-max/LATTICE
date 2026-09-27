# ownership.md — карта владения (S0, черновик)

Черновик карты владения понятиями `design/` v0.3; владельцы уточняются в сессиях D. Правило ADR-24: контракт
порта закрепляется у домена-потребителя (основного, если их несколько); `30-adapters` — только реализации, корень
сборки, CLI. `?` в «Решение» — владелец предложен агентом, не решён.

## 1. Понятия v0.3

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/actor` | тип | 14-trust | `design/domains/14-trust.md:15` | 10-kernel (`by`), 15-catalog (owner) | TR-03 |
| `core/alias` | факт | 11-identity-grain | `design/domains/11-identity-grain.md:82` | 14-trust (п.7), 15-catalog | GR-05 |
| `core/assert` | тип | 14-trust | `design/domains/14-trust.md:23-24` | 23-bench (И-2) | TR-02 |
| `core/deprecate` | факт | 15-catalog | `design/domains/15-catalog.md:69` | 11-identity-grain (п.4) | CT-05 |
| `core/fact` | тип | 10-kernel | `design/domains/10-kernel.md:109-123` | все домены | KR-13 |
| `core/grant` | факт | 15-catalog | `design/domains/15-catalog.md:36` | — | CT-03 |
| `core/member` | факт | 21-compose | `design/domains/21-compose.md:18` | 13-rules (правило), 20-lens (пул) | CP-02 |
| `core/proposal` | событие | 15-catalog | `design/domains/15-catalog.md:45` | — | CT-03 |
| `core/retire` | факт | 15-catalog | `design/domains/15-catalog.md:70` | 20-lens (не выдаёт) | CT-05 |
| `core/rule` | тип | 13-rules | `design/domains/13-rules.md:14-22` | 10-kernel (`type.rules`), 12-ledger (коммит) | RL-01 |
| `core/session` | тип | 14-trust | `design/domains/14-trust.md:16` | 10-kernel (`by`) | TR-03 |
| `core/snapshot` | тип | 21-compose | `design/domains/21-compose.md:20` | 12-ledger (индекс `snapshots`) | CP-02 |
| `core/type` | тип | 10-kernel | `design/domains/10-kernel.md:78-107` | все домены | KR-08 |
| `std/bench-plan` | тип | 23-bench | `design/domains/23-bench.md:15` | — | BN-02 |
| `std/bench-run` | событие | 23-bench | `design/domains/23-bench.md:16` | — | BN-01 |
| `std/bench-set` | тип | 23-bench | `design/domains/23-bench.md:14` | 30-adapters (source-warrant) | BN-01 |
| `std/ctx` | тип | 22-run | `design/domains/22-run.md:45-59` | 20-lens, 21-compose (стадии), 13-rules (контракт) | RN-02 |
| `std/cue` | факт | 21-compose | `design/domains/21-compose.md:15` | 20-lens (LN-02), 14-trust (п.7), 15-catalog (допуск) | — |
| `std/distinct` | факт | 11-identity-grain | `design/02-glossary.md` T81 | 21-compose (потребности), 22-run (обучение), `core/trust-policy.candidates` (память отказов) | CP-01 · T-8 · R6 Q4 |
| `std/domain` | тип | 11-identity-grain `?` (см. §4) | `design/domains/11-identity-grain.md:28-33` | 10-kernel (пример), 30-adapters (создание доменов) | GR-03 |
| `std/gap` | событие | 21-compose | `design/domains/21-compose.md:21,64-68` | — | CP-07 |
| `std/knowledge` | тип | 20-lens `?` | `design/domains/30-adapters.md:66` | 15-catalog (публикация) | `?` — карточка и поиск блока знания естественно у LENS; своей модели у `std/knowledge` нет |
| `std/link` | факт | 21-compose | `design/domains/21-compose.md:19` | — | CP-04 |
| `std/measurement` | событие | 20-lens | `design/domains/20-lens.md:49,72` | 14-trust (TR-06), 30-adapters (`Meta`) | LN-08 |
| `std/need` | тип | 21-compose | `design/domains/21-compose.md:14` | 15-catalog (допуск), 20-lens (вход) | CP-01 |
| `std/solution` | тип | 21-compose | `design/domains/21-compose.md:17` | 15-catalog (допуск) | CP-02 |
| `std/term` | тип | 20-lens `?` | `design/domains/30-adapters.md:70` | — | `?` — термины питают стадию `lexicon` LENS; отдельного домена словаря нет |
| `std/trust-policy` | экземпляр политики по умолчанию | 14-trust | `design/domains/14-trust.md:63` | 15-catalog (`namespace.policy`) | TR-05 |
| `store` (порт) | порт | 12-ledger | `design/domains/12-ledger.md:58-64` | 30-adapters (`store-jsonl`) | ADR-24 (уже у потребителя) |
| `judge` (порт) | порт | 20-lens | `design/domains/30-adapters.md:18-22` — переезд | 21-compose (recall, select), 11-identity-grain (GR-06) | ADR-24 |
| `composer` (порт) | порт | 21-compose | `design/domains/30-adapters.md:25-28` — переезд | 22-run (runtime) | ADR-24 |
| `source` (порт) | порт | 21-compose `?` | `design/domains/30-adapters.md:30-35` — переезд | 22-run (deliver), 30-adapters (source-warrant) | `?` — self-search (compose) и deliver (run) оба прямые потребители; ADR-24 не называет |
| `exec` (порт) | порт | 22-run `?` | `design/domains/30-adapters.md:14` — переезд | — | `?` — единственный потребитель (runtime), альтернатив нет |
| `clock`, `ids` (порт) | порт | 10-kernel `?` | `design/domains/30-adapters.md:15` — переезд | 12-ledger (`at`, `seq`) | `?` — `newId`/`ulid` в операциях ядра (`10-kernel.md:144`) |
| `Meta` | формат | 22-run | `design/domains/30-adapters.md:23` — переезд; `design/02-glossary.md` T135 | 20-lens, 21-compose, 30-adapters (адаптеры отдают) | N-12 · R5 Q7: основной потребитель — рантайм (бюджет, трасса), ADR-24 |
| `Scored` | формат | 20-lens | `design/domains/30-adapters.md:19` — переезд | — | ADR-24 (принадлежит `judge` → lens) |
| `Chosen` | формат | 20-lens | `design/domains/30-adapters.md:21` — переезд | — | ADR-24 (принадлежит `judge` → lens) |
| `id` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:25` | все домены | KR-01 |
| `type` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:26` | все домены | KR-01 |
| `version` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:27` | 12-ledger (LG-06) | KR-03 |
| `at` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:28` | 12-ledger (порядок) | LG-04 |
| `by` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:29` | 14-trust (доверие) | TR-01 |
| `body` | поле заголовка | 10-kernel | `design/domains/10-kernel.md:30` | все домены | KR-02 |
| ревизия (формат записи) | формат | 10-kernel | `design/domains/10-kernel.md:12-21` | все домены | KR-01 |

## 2. Новые понятия из итогов

Понятия, которых нет в v0.3, введённые пунктами `research/analysis/arch-changes.md`; ещё не внесены в `design/`.

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `core/commit` | факт (маркер) | 12-ledger | `research/analysis/arch-changes.md:166` (не в design/) | 10-kernel, 22-run | 12-ledger/И-9 |
| `core/holds` | событие | 10-kernel | `research/analysis/arch-changes.md:105` | 14-trust | 10-kernel/И-6 · R4 Q9: событие генезиса |
| `core/namespace.origin` | поле | 10-kernel | `research/analysis/arch-changes.md:126` | 15-catalog (импорт) | 10-kernel/И-27 · R1: владелец 10-kernel (`core/namespace` — тип генезиса) |
| `core/assert.via` | поле | 14-trust | `research/analysis/arch-changes.md:199` | 22-run (`learn`) | 14-trust/И-7 · ADR-5 |
| `core/rule.examples` | поле | 13-rules | `research/analysis/arch-changes.md:180` | — | 13-rules/И-1 |
| `std/alias-candidate` | тип | 11-identity-grain | `design/adr/0008-alias-candidate-type.md` | 21-compose (И-2), 20-lens, 30-adapters (импорт) | ADR-8 · R3 |
| `core/type.grain_scope` | поле | 11-identity-grain | `design/adr/0027-grain-scope.md` | 12-ledger (индекс `grain`), 13-rules (`grain-unique`) | ADR-27 · R3 |
| уровень `core/type.schema` | поле | 13-rules | `design/adr/0009-schema-field-as-rule.md` | 10-kernel (`core/type`) | ADR-9 · R3 |
| `std/ctx.needs[].found` | поле | 22-run `?` | `research/analysis/arch-changes.md:258` | 21-compose | 21-compose/И-9 |
| `core/type.writers`, `core/type.inForce` | поле | 10-kernel | `design/adr/0006-control-fact-writers.md` | 13-rules (`owner`), 15-catalog, 14-trust, 11-identity-grain | ADR-6 · R2 |
| реестр участников (`core/actor` пишет владелец) | правило | 14-trust | `design/adr/0025-participant-registry.md` | 15-catalog, 22-run, 30-adapters (хост) | ADR-25 · R2 |
| группа независимости | правило | 14-trust | `design/adr/0026-independence-groups.md` | 20-lens, 22-run, 23-bench | ADR-26 · R2 |
| `trust().overruled` | поле | 14-trust | `research/analysis/arch-changes.md:205` | 20-lens (исключает) | 14-trust/И-13 · R2 |
| `core/grant.value.declare` | поле | 15-catalog | `design/adr/0025-participant-registry.md` | 14-trust (`declared`) | ADR-25 · R2 |
| `std/setup` | тип | 22-run | `design/adr/0028-setup-object.md` | 15-catalog, 30-adapters (модели), 23-bench и вызов (`setup@n`) | ADR-28 · R4 |
| тело `core/namespace` (`name`, `owner`, `imports`, `policy`, `doc`) | тип (генезис) | 15-catalog | `design/domains/15-catalog.md:13-16` | 10-kernel (`origin` — поле 10-kernel, R1), 14-trust (`policy`) | ADR-28 · R4 (N-14) |
| кортеж исполнения | правило | 22-run | `design/02-glossary.md` T131 | 10-kernel (`impl.pins`), 20-lens, 21-compose, 23-bench (план) | T-2 · R5 Q2 |
| `reads` / `writes` способности стадии | поле | 13-rules | `design/02-glossary.md` T132 | 22-run, 20-lens, 21-compose | T-3 · R5 Q1 |
| `Deps` (`view`) | формат | 22-run | `design/02-glossary.md` T133 | 20-lens, 21-compose, 30-adapters | T-3 · R5 Q1 |
| проверки ядра | правило | 13-rules | `design/02-glossary.md` T134 | 10-kernel, 11-identity-grain (`split`/`merge`), 21-compose | T-16 · R5 Q3 |
| `core/trust-policy.lens` (`exclude`, `mark`) | поле | 14-trust | `research/analysis/arch-changes.md:238` | 20-lens (`pool`, стадия `trust`) | 20-lens/И-6 · R5 Q5 |
| `calibrated_for` порога | поле | 20-lens | `design/02-glossary.md` T136 | 21-compose (`same_hi/lo`), 22-run (отказ) | 20-lens/И-4, И-7 · R5 Q10 |
| `core/session.purpose` | поле | 14-trust | `design/02-glossary.md` T137 | 22-run, 23-bench, 20-lens, 21-compose (`recall`), 30-adapters (хост) | T-5 · R6 Q1 |
| копия кампании (`.lattice/bench/<run>`, хэш в `bench-run`) | формат | 23-bench | `design/02-glossary.md` T138 | 12-ledger, 22-run | T-5 · R6 Q1 |
| гейт обучения | правило | 13-rules | `design/adr/0029-learning-gate.md` | 22-run (`run`, факты обучения), 23-bench, 14-trust | ADR-29 · R6 Q2 |
| `core/trust-policy.candidates` | поле | 14-trust | `design/02-glossary.md` T142 | 11-identity-grain, 21-compose | T-8 · R6 Q4 |
| `divide(need, parts, by)` | операция | 21-compose | `design/02-glossary.md` T140 | 11-identity-grain (`core/deprecate`) | 21-compose/И-6 · R6 Q5 |
| окно удаления членства | правило | 22-run | `design/adr/0020-membership-removal-window.md` | 14-trust (числа в политике) | ADR-20 · R6 Q6 |
| регрессионный план (`base`, δ, ротация `test`) | правило | 23-bench | `design/02-glossary.md` T143 | 22-run (гейт ADR-29) | 23-bench/И-14, И-15 · R6 Q9 |

## 3. Без владельца

Понятия, встречающиеся только в глоссарии (lint знает 7). Для каждого — все упоминания в `design/` (включая
JSON-примеры внутри кода, которые индексатор lint не считает «Моделью»), предложенный владелец и довод.

| Понятие | Упоминания (grep design/) | Предложенный владелец | Довод |
|---|---|---|---|
| `core/trust-policy` | `02-glossary.md:86`; `domains/14-trust.md:57` (тело в JSON-примере, не в прозе) | 14-trust | тело (`weights`, `observe_sessions`…) уже дано примером в 14-trust.md:57 |
| `std/block` | `02-glossary.md:105` (больше нигде) | 20-lens | T66: карточка и поиск определяют блок; ср. находку 10-kernel/И-22 (предлагает убрать `std/block` как обязательного родителя) |
| `std/capability` | `02-glossary.md:107`; `domains/13-rules.md:54` (тело в JSON-примере) | 13-rules | контракт (`input`/`output`/`impl`) и правило `contract` — в 13-rules.md:44,54 |
| `std/card` | `02-glossary.md:110`; `domains/20-lens.md:16-21` (тело в JSON-примере) | 20-lens | полное тело и назначение карточки описаны в 20-lens.md §1 |
| `std/pipeline` | `02-glossary.md:134`; `04-architecture.md:86`; `domains/22-run.md:14-36` (тело в JSON-примере) | 22-run | конвейер определён и исполняется целиком в 22-run.md §1,3 |
| `std/execution` | `02-glossary.md:137` (больше нигде, даже в JSON) | 22-run | событие вызова описано текстом в RN-06; формализация — предложение 22-run/И-18 (`std/execution@1`) |
| `std/verdict` | `02-glossary.md:139`; `domains/22-run.md:100-105` (тело в JSON-примере) | 22-run | вердикт и цикл обучения — 22-run.md §5-6 (RN-04) |

## 4. Два определения

| Понятие | Адреса | Расхождение | Предложенный владелец |
|---|---|---|---|
| `std/domain` | `design/domains/10-kernel.md:19` (пример ревизии, тело: `name, code, language`) vs `design/domains/11-identity-grain.md:32-33` (пример сущности, тело: `project, name, language, code`) | у kernel-примера нет поля `project`, которое зерно типа (`identity-grain.md:29`) включает как измерение — тела двух примеров одного типа не совпадают по составу полей | 11-identity-grain (зерно и правила слияния определены здесь; kernel-пример — иллюстрация формата ревизии вообще, не модель `std/domain`) |
