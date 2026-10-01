# design-next deepening review: grilled

- **Дата:** 2026-10-01
- **Вход:** [2026-10-01-design-next-deepening](2026-10-01-design-next-deepening.md) — кандидаты A1–A6 и 21 мелкая находка.
- **Как:** grilling раундами; maintainer поручил выбирать рекомендованные ответы. Внесено в design-next 00–10 тем же PR.
- **Итог:** новых механизмов нет; ни одна NX не пересмотрена; ST-M01 — одно новое ребро (`capabilities → ledger`, только read view). D1 сохранён: gate один и всегда пересчитывает; меняется его место — шаг apply.

## A4 + A3 — bench и basis

| # | Вопрос | Решение | Почему |
|---|---|---|---|
| Q1 | Кто измеряет | Bench — не pipeline, а store command `bench`: запускает измеряемый pipeline по разу на каждый вход split (обычные runs, purpose `bench`) и упаковывает их как evidence с report. Упаковка не читает внешних источников и не решает (PL-E01). | Ни новой сущности, ни составной capability (NX-13). Report пишет сессия без judge → `observed`. |
| Q2 | Числа в report | Report хранит метрики; apply при приёме пересчитывает их из evidence через `measure` и отклоняет при расхождении. Хранимые числа — проверенная копия, источник — evidence. | Одно правило вместо двух дорог; ST-M01 не меняется; BN-G03 в `trust` читает числа. |
| Q3 | Basis без tape | Строка 2 TR-B02 статическая: `machine`-сессия run, чей `pipeline@n` содержит стадию `decide` или стадию либо fallback с `calls-llm` → `inferred`. | Ревизия pipeline в `knowledge`; apply решает без tape. Memo hit — тоже `inferred` (консервативно). |
| Q4 | Подбор runs | Cited runs покрывают входы split ровно: по одному run на вход item и на каждый variant, совпадение по input fingerprint; общий `pipeline@n`, один execution tuple, один knowledge commit; упавший run цитируется и считается промахом. | Иначе report можно собрать из удобных runs. |
| Q5 | Input fingerprint | `sha256(JCS(input))`, как OM-H01. | Опора Q4. |
| Q6 | Откуда apply знает pipeline сессии | Session event run (CT-P01) несёт `pipeline@n`; host объявляет его, как kind (CT-P03), — допущение v1. | То же допущение, что и для kind. |
| Q7 | Shadow-расхождения (TR-N03) | Пары runs упаковывает store command `cite` (purpose `check`) → `observed`. Hint непрокалиброванной точки пишет её run → `inferred`. `bench` упаковывает через `cite`. | Basis следует за тем, кто утверждает: run — сказанное judge, `cite` — сделанное runs. Одна упаковка. |
| Q8 | Где код упаковки | `ledger`: импортирует `measure`, знает формат proposal и `runtime`. | ST-M01 без изменений. |
| Q9 | Ключ report | subject `ref@n`, `set@n`, split. Gate и `calibration` — только report `holdout`. | Иначе tune и holdout перезаписывают друг друга; holdout не был шагом gate. |
| Q10 | `seq` в BN-G04 | Targets должны быть в силе на knowledge commit, прочитанном cited runs. | Runs лежат в другом ledger со своим `seq`. |

## A1 — вычисление policy

| # | Решение |
|---|---|
| Q11 | Операторы, DP-M05 и DP-R01…R04 — одна чистая функция `measure`: `evaluate(policy, evaluations, required, budget) → {status, reason, selected}`; её вызывают `decide`, gate и метрики калибровки. |
| Q12 | За `decide` — DP-M06, порт `judge`, `unavailable` (DP-R05), `trace`. |
| Q13 | DP-C02: sure band — элементы со статусом `selected`, precision по значению ответа; grey zone — доля `ambiguous` и `insufficient`. Результаты той же функции. |

## A5 — authoritative run

| # | Решение |
|---|---|
| Q14 | Одно правило в DP-L01: run authoritative iff его `pipeline@n` и `setup@n` названы `live` facts в силе на прочитанном knowledge commit. Чистая функция run record. PL-P06, PL-A01, PL-K04 ссылаются; DP-L03 удалён. |
| Q15 | Следствие: выход и outcome неавторитетного run помечены `non-authoritative` (как fallback, PL-R01, LN-O01); стадия с `irreversible` в нём отказывает, run — `refused`. |

## A2 — где gate

| # | Решение |
|---|---|
| Q16 | `trust → measure` не нужен (A2 не взят). Gate — шаг apply (LG-A03): `trust` отвечает, какая `calibration` в силе и применяется (TR-I01, DP-C01), `measure` — проходят ли пересчитанные метрики targets. D1 сохранён. LT-21 не срабатывает: BN-G03 читает проверенные числа report (Q2). |
| Q17 | «Явное решение владельца» о регрессии (BN-G03) — шаг gate: открытый finding BN-G03 по subject без `dismissed` (TR-N04) отклоняет `live`. |

## A6 — закрепления

| # | Решение |
|---|---|
| Q18 | `setup` для `judge` выбирает только режим (`service`/`recorded`/`fixture`) и memo; `service` — адаптер, закреплённый `judge@n` запроса. Блок `judge` и есть блок адаптера порта `judge`. |
| Q19 | Блок адаптера определён один раз, новым правилом PL-A05: std-тип с `impl: {module, hash}`, как capability (PL-C01); `setup` закрепляет его для портов без своего конфигурирующего блока (`source`, `clock`, `ids`, `llm`); новая ревизия — owner act (CT-A02). |
| Q20 | Модель `llm` — статический параметр `model` стадии с `calls-llm` (PL-P02); точный id, alias отклоняется при старте (PL-A03); ответ сверяется (PL-R04); ключ memo берёт `model@version` из него. |

## Мелкие находки

| Находка | Решение |
|---|---|
| PL-P03 | Поля входа run считаются записанными до стадии 1; ни одна стадия их не пишет. |
| LG-P05 / CT-P04 | Приём коммита в LG-P05 (1) — адаптер `github` порта `acts`; повторный apply (2) — `recorded`. |
| PL-C05 | `clock`, `ids` и read view получает каждая capability; эффекты дают остальное. |
| ST-M01 | `capabilities → ledger`, только read view (PL-K05). |
| OM-T04 / OM-L02 | Перечислить std-типы, включая run record, question event, listing fact, `example`, блок адаптера. |
| OM-T04: `rule` | Базовый тип `rule` не определён — заменён на `behaviour` (pipeline, `setup`, `judge`, блок адаптера, namespace; слово уже в GL-01). Типы событий без `supersedes`: OM-I07 — «every base entity type». |
| BN-M05 | Минимум по значению ответа — для точек; для pipeline — 30 items в `holdout`; оба — пол BN-G05. |
| BN-S01 | Expected refs хранятся pinned (OM-R02), сравниваются по `id`; нового finding нет. |
| LN-C03 | Токенизатор — код `lens.candidates`, покрыт PL-C01; «is a capability» убрано. |
| DP-M03 / PL-P04 | Выборка fallback не проходит через judge и помечена (PL-R01). |
| Глоссарий | Указатели: stage/run outcome, effect, trust evidence, `tune`/`holdout`, `variants`, read view, fallback/escalate, authoritative, input fingerprint; GL-14 — версия LATTICE поставляет ровно одну версию kernel, версия kernel может жить в нескольких версиях LATTICE. |
| Повторы | DP-L03 удалён (Q14). Указатель PL-K02 и пояснение evidence в глоссарии остаются: это ссылки, не повторы. |
| Примеры 01, 06 | id с namespace, `type` с `@n` — до нормализации LG-B04. |
| LN-X03 | «(S2)» убрано: правило действует, пока нет точки «sufficient?». |
