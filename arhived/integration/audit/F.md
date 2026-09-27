# Аудит F — свежее чтение design v0.4-rc

Сессия F (2026-09-27), одна сессия без субагентов (`prompts/audit.md` режим «F»). Прочитан весь каталог `design/` в
порядке README: 00–05, `adr/README`, домены 10 → 11 → 13 → 12 → 15 → 14 → 20 → 21 → 22 → 23 → 30; `proposals/` —
статус. Адреса — `grep -n` / чтение файла; цитаты — дословно.

## (а) Новый разработчик реализует первые срезы

| Н | Где | Против чего | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|
| F-1 | `design/domains/23-bench.md:18`, `:28`, `:33` | `design/02-glossary.md:206` (T161), `:207` (T176); текст до C2c (`git show 564f771`) | переименование `split` → `subset` (C2c Q6) испортило текст: «`subset: dev \|paraphrase_of?: ref, subset: dev \| test, origin`» (строка таблицы ломается на неэкранированной `\|`), «`subset:paraphrase_of?: ref, subset: dev \| test`, набор» (было «`split: test`, набор»), «`explore` со `subset:paraphrase_of?: ref, subset: dev \| test` не от» (было «`split: test`») | исправить | восстановить: `paraphrase_of?: ref, subset: dev \| test, origin`; `` `subset: test` ``; `` `subset: test` `` |
| F-2 | `design/domains/22-run.md:100`, `:113` | `design/domains/12-ledger.md:131`, `design/02-glossary.md:181` (T156) | «`rows?: Row[]; done?: boolean`», «`Row` — [12](12-ledger.md)» против «`type Draft = { type: string; id?: string; body: Json; expect?: number } // строка до коммита`» и T156 «— `Draft[]`»: C2c Q4 не дошёл до `Ctx` | исправить | `rows?: Draft[]`; «`Draft` — [12] §5» |
| F-3 | `design/domains/10-kernel.md:227-228`, `design/domains/12-ledger.md:157-158` | `design/domains/22-run.md:130`, T133 (`design/02-glossary.md:177`) | «порты `clock`, `ids` определяет 12 …; стадии получают их через `Deps`» и «`Clock` и `Ids` … стадии — через `Deps`» против «`Deps = { judge; composer; source; exec; ids; view } // clock стадиям не нужен`» (C2c Q3) | исправить | 10 и 12: «стадии получают `ids` через `Deps`; часов у стадий нет — `at` ставит коммит» |
| F-4 | `design/domains/22-run.md:96` | `design/domains/20-lens.md:83-87`, `design/domains/13-rules.md:102`, RN-09 (`22-run.md:154`) | `Ctx`: «`scores?: Record<Id, { bm25?: number; judge?: number; fused?: number }>`» — ключ первого уровня id карточки; стадии объявляют пути «`scores.bm25`», «`scores.judge`», «`scores.fused`», пример способности — «`"writes": ["needs[].scores.bm25"]`»; рантайм сверяет «изменённые пути ⊆ writes» — по типу `Ctx` таких путей нет | исправить | `scores?: { bm25?: Record<Id, number>; judge?: Record<Id, number>; fused?: Record<Id, number> }` — пути совпадают с объявленными |
| F-5 | `design/domains/13-rules.md:61`, `design/domains/15-catalog.md:21-28`, `design/domains/30-adapters.md:213` | правило `owner` при первой записи пространства | `owner`: «ревизию или факт пишет владелец пространства или допущенный»; `init` пишет «пространство, реестр, `<ns>/learner`»; тело `core/namespace` несёт `owner` — ссылку на `core/actor`, а `core/actor` пишет «владелец или допущенный» (14-trust:23-24). Правила, по которому проходит **первый** коммит пространства (пространства и владельца ещё нет в индексе), в дизайне нет — S1/S2 не реализовать без решения | решить | правило `owner`: пространство, которого нет в индексе, создаёт коммит, где есть его первая ревизия `core/namespace` и участники её `owner`, а сессия коммита — сессия одного из них; дальше — обычный `owner` |
| F-6 | `design/domains/11-identity-grain.md:136` | `design/domains/20-lens.md:130-145` (форма `std/measurement`), `design/domains/20-lens.md:145` | «`value: {p}` — балл `judge.verify` (версия judge — в `std/measurement` вызова `aliasCandidates`)» против «`std/measurement@1` … `{need, pool, judge, scores, execution}`» и «Ответы `verify` и `choose` — в `calls` стадии»: `aliasCandidates` — не вызов конвейера (нет `execution`, `need`, `pool`), записи с версией judge у кандидата нет | решить | версия judge — в значении кандидата: `value: {p, judge: {adapter, model, prompt_hash}}` (как `calibrated_for`); `std/measurement` — только оценки `score` вызова |
| F-7 | `design/01-first-run.md:56-57`, `design/domains/23-bench.md:105-107` | BN-04 (`23-bench.md:154`: «главный канал утечки — память (`recall`), поэтому изоляция — копия») | R2b «калибровка на dev … → ревизия warrant/setup@2 с calibrated_for» — не сказано, где идут вызовы калибровки; `solve` на `dev` в основном журнале оставит потребности и подсказки, которые `recall` потом отдаст на `test` | исправить | калибровка — кампания плана `explore` (`subset: dev`) на копии; в основной журнал — её `std/bench-run` и ревизия `setup@2` владельца |
| F-8 | `design/domains/23-bench.md:113-120`, `:141` | ADR-29, RN-20 (совпадение по `setup@n`) | «Гейт засчитывает `pass` только плана `candidate` с `base` на регрессионный план … и тем же кортежем»; план `candidate` сравнивает новую ревизию с текущей. Как `pass` получает **первая** рабочая ревизия (`setup@2` первого запуска) или откат (новая ревизия с прежним содержимым — другой `setup@n`), не сказано: без `pass` вердикты рабочего пространства не учат | исправить | 23 §5: первая ревизия и откат — план `candidate` с `setup` = ревизии регрессионного плана (сравнение с собой: δ выполнено тривиально, решают абсолютные критерии `primary`) |

## (б) Противоречия и недоопределённость по всему каталогу

| Н | Где | Против чего | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|
| F-9 | `design/domains/12-ledger.md:50`, `:59`, `:169` | `design/domains/12-ledger.md:131` (`Draft.expect`), `design/domains/22-run.md:159` | «`commit(rows: Draft[], by, expect?, key?)`», шаг 4 «`expect[id]` обязателен» против «`Draft` … `expect?: number` // версия изменяемой сущности, прочитанная из view» и «`commit(…, session, expect из rows, key = x)`» — два источника `expect` | исправить | `commit(rows: Draft[], by, key?)`: `expect` — из `Draft.expect`; `Store.append(…, expect)` собирает коммит |
| F-10 | `design/domains/13-rules.md:118` | «Вопросы для grilling» 13 (`:178`: «Нет открытых»), `design/03-python-lessons.md:19` | «Структурная (по схеме) — вопрос grilling (PY-Q1)»: `PY-Q1` в каталоге больше нигде нет; 03: «структурная совместимость — не в первой версии» | мелочь | «Структурная — не в v1 ([03](../03-python-lessons.md), RL-05)» |
| F-11 | `design/domains/20-lens.md:32` | `design/domains/10-kernel.md` §6 (таблица полей типа, строка `card`) | «**Шаблон** — поле типа `card` ([10](10-kernel.md) п. 5)» — п. 5 в 10 — «Ссылки», поле `card` — §6 | мелочь | «([10](10-kernel.md) §6)» |
| F-12 | `design/02-glossary.md:212` (T109) | `design/domains/23-bench.md:21` | T109: «`{plan, results, metrics, verdict: pass \| fail \| invalid, copy}`» против «`{plan: ref, tuple: {setup: ref@n, code, prompts, kernel}, results: #value, …}`» — в глоссарии нет `tuple` | мелочь | T109: `{plan, tuple, results, metrics, verdict, copy}` |
| F-13 | `design/adr/0021-bench-plan-event.md:9`, `:11`, `:15`; `design/adr/README.md:35` | `integration/renames.md:17-18` (`split: dev/test` → `subset`, «действует»), T176 | «типа по полю `split` нет», «В плане — `split`, `n` …», «`criteria[]`, `split`, `n`», индекс «правила по `split` нет» — старое имя после переименования | мелочь | заменить на `subset`; в ADR-21 строка «Уточнено C2c: `split` → `subset` (T176)» |
| F-14 | `design/proposals/PF-config.md:3-5`, `design/proposals/PF-config-kb.md:9` | реестр: строки PF-01…PF-06 — `внесён`; `design/README.md:12-21` | «Файлы `design/` ещё не изменены — правки в п. 5», «в `design/` — нет»; README каталог `proposals/` не называет, а 21, 22, ADR-28, ADR-29 на него ссылаются | мелочь | статус: «внесено в v0.4 (ADR-28, ADR-29, 04 §5, 30 §2); история, не норма»; README — строка `proposals/` |
| F-15 | `design/domains/22-run.md:426` (RN-03) | `design/domains/22-run.md:159`, `:405` (инвариант 1), RN-22 | RN-03: «Один коммит на вызов: `execution` ∪ `needs[].rows`» против «`[execution x] ∪ vals ∪ needs[].rows`» и инварианта «`execution` ∪ значения `std/payload` ∪ `needs[].rows`» | мелочь | RN-03: «`execution` ∪ значения `std/payload` ∪ `needs[].rows`» |
| F-16 | `design/domains/22-run.md:130` | RN-10 (`:433`: «стадия `exec`» — отказ на старте), `design/domains/30-adapters.md:27` (адаптеров `exec` нет) | «`Deps = { … exec: Exec; … }`» — обязательное поле, которое корень сборки в v1 собрать не из чего | мелочь | `exec?: Exec` — нет адаптера → поля нет |

## (в) Принципы и цель первого запуска

| Н | Где | Против чего | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|
| — | F-7, F-8 | E3, E6 (`design/01-first-run.md:27`, `:30`) | см. (а): утечка памяти калибровки в `test` бьёт по E1/E2; без правила первого `pass` рабочая настройка после R10 с `fail` не учится | — | — |

## Выборка 1 из 10 строк `внесён` (сама сессия)

Строки 6, 16, 26, … (каждая десятая из 452, 46 строк): `10-kernel/И-6, И-16, И-26`, `11/И-2, И-12`, `12/И-8`,
`13/И-1`, `14/И-3, И-13`, `15/И-4`, `20/И-3, И-13`, `21/И-11`, `22/И-5, И-15`, `23/И-2, И-12`, `30/И-6, И-17`, `ADR-10`,
`ADR-20`, `T-7`, `П-1, П-11, П-21, П-31`, `Ф-9`, `PF-config:04-architecture`, `Q-01-3, Q-11-3, Q-14-3, Q-22-1`,
`N-5, N-14, N-21, N-31, N-41, N-51, N-61, N-71, N-81, N-91, N-101, N-111, N-121`. Текст по адресу соответствует
решению у 45 из 46.

| Н | Где | Суть | Предложение |
|---|---|---|---|
| F-17 | `integration/ledger.md` строка N-41 → `design/domains/22-run.md:338#860f40` | адрес указывает на «`incomplete` без `add` \| неполно, без указания \| ничего; метрика» — к контракту `trust()` отношения не имеет (отпечаток проставлен уже по сдвинутому адресу); контракт — `design/domains/14-trust.md:167`, кандидат — `design/domains/20-lens.md:155-156` | переадресовать N-41 |

## Проверено без находок

- Инварианты доменов → срезы (05): у каждого домена все номера инвариантов покрыты таблицей (10: 1–11, 11: 1–5,
  12: 1–6, 13: 1–6, 14: 1–6, 15: 1–5, 20: 1–6, 21: 1–8, 22: 1–8, 23: 1–6, 30: 1–7).
- «Зависит от» доменов против матрицы 04 §2: 11, 12, 13, 14, 15, 20, 21, 23, 30 — без расхождений.
- Принципы P1–P12: P4 — `writers` (10 §7, 15 §2); P5 — ADR-13 во всех местах решения по баллу (11 §6, 20 §4, 21 §3);
  P6 — `check` и `add[]` (21 §5, 22 §5); P9 — периметр ядра одним перечнем (04 §1), исключение `learning-gate` названо
  (10 §8); P10 — ядро знает только `core`/`std`; P11 — гейт (ADR-29). Молчаливых нарушений нет.
- Цель первого запуска E1–E7 против протокола R0–R14: у каждого эффекта есть шаг и строка отчёта.
- Сквозное: `purpose` (14 §1, 22 §6, 23 §3, 30 §3), кортеж исполнения (22 §1, 23 §1, 13 §2), `calibrated_for`
  (20 §4, 21 §3, 22 §3, 23 §4), окно удаления (14 §4, 22 §6, 01 E3) — одно решение везде.
