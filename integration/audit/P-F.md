# Аудит design/ v0.4 — разрез П-1…П-32, Ф-1…Ф-12

Источник списка: `research/analysis/arch-changes.md:368-420`. Опора: `ledger.mjs show --kind П` / `--kind Ф`, `design/adr/README.md`,
`integration/ownership.md`. Адреса — по `grep -n` на текущем `design/`.

Итог: 13 находок — блокирует 2, исправить 7, мелочь 4.

## Находки

| Н | Где (design/…:NN) | Против чего (ADR-n / другой адрес / принцип) | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|
| Н-1 | `design/domains/10-kernel.md:171` | `design/domains/21-compose.md:21` (владелец `std/cue` — `integration/ownership.md:30`), `design/02-glossary.md:135` (T72); род Ф-7 / П-20 (ADR-6) | 10-kernel:171 — «Пустой `key` — факты накапливаются (утверждения, подсказки)»; 21-compose:21 — подсказка `std/cue`: «ключ `[target, norm(value)]`; любой». Ключ подсказки: пустой или `[target, norm(value)]` | блокирует | в 10-kernel:171 убрать «подсказки» из примера пустого ключа: ключ `std/cue` задаёт его владелец (21-compose) |
| Н-2 | `design/domains/11-identity-grain.md:132-133`; то же `design/02-glossary.md:48` (T123) | `design/domains/10-kernel.md:254` (KR-13), `design/domains/10-kernel.md:171`; ADR-6, ADR-8 | 11:132-133 — «факт `std/alias-candidate` … ключ `[alias, canonical]`, накопительный, пишет любой»; KR-13 (10-kernel:254) — «пустой ключ — накопление». У «накопительного» два смысла: «`writers` — любой» (ADR-6, `design/domains/15-catalog.md:54`, `design/00-vision.md:68`) и «пустой `key`» (KR-13) | исправить | закрепить одно значение слова: для `std/alias-candidate` (11:133, T123) писать «`writers` — любой», а «накопление» оставить за пустым `key`, или наоборот поправить KR-13 |
| Н-3 | `design/domains/30-adapters.md:29-30` | `design/domains/22-run.md:212-213` (владелец `Meta` — `integration/ownership.md:47`), `design/02-glossary.md:174` (T135); род П-27 / П-32 (22-run/И-21: идентичность и ключ кэша — у адаптера) | 30-adapters:29-30 — «Адаптер отдаёт в `Meta` цену, время, токены, своё — в `detail` (у `judge-jev` — `promptHash`, `stateHash`)»; 22-run:212 — «Хэшей в `Meta` нет: идентичность — `describe()` и кортеж, ключ кэша — у адаптера»; T135 — «хэшей нет» | блокирует | убрать пример хэшей из 30-adapters:30 или оговорить в 22-run:212 / T135, что `detail` непрозрачен и хэши в нём не идентичность; решает владелец (22-run) |
| Н-4 | `design/05-slices.md:17` (S8) | `design/domains/23-bench.md:86-88`, `design/01-first-run.md:87-88`, `design/01-first-run.md:27` (E3); ADR-26 | S8 — «E3: симуляторы одного агента — одна группа, `observed` не достигается»; 23-bench:86-87 — «Каждый потребитель-симулятор — свой участник `machine` из реестра владельца, то есть своя группа независимости (ADR-26)»; 01:87-88 — «Симуляторы — разные участники, значит разные группы независимости»; критерий E3 (01:27) — «отрицательный контроль: те же вердикты одной группы не удаляют ничего» | исправить | привести критерий S8 к формулировке E3 (01:27): отрицательный контроль — вердикты одной группы не удаляют; «симуляторов одного агента» в модели стенда нет |
| Н-5 | `design/05-slices.md:12` (S3) | `design/domains/14-trust.md:94-95`, TR-04 `design/domains/14-trust.md:185`; П-17 (14-trust/И-11) | S3 — ««+» и «−» дают `contested`; «−» владельца отзывает»; 14-trust:94-95 — ««−» человека-владельца пространства цели или декларанта решающее … «−» агента-владельца — обычный голос в сумме». Правка среза из итогов (««−» отзывает только человек-владелец», `research/analysis/arch-changes.md:440`) в S3 не внесена | исправить | S3: «−» человека-владельца или декларанта отзывает; «−» агента-владельца — голос в сумме |
| Н-6 | `design/02-glossary.md:105` (T122); `design/02-glossary.md:100` (T55) | `design/domains/14-trust.md:94-95`, `design/domains/14-trust.md:70`, инв. 4 `design/domains/14-trust.md:174`; П-17 | T122 — «`{by, at}` — решающее «−» владельца пространства цели»; T55 — «`declared` (владелец)»; 14-trust:70 — `declared`: «действующее «+» … человека-владельца пространства цели или допущенного декларанта»; 14-trust:95 — ««−» агента-владельца — обычный голос в сумме». Глоссарий повторяет формулировку, которую закрывал П-17 | исправить | T122 и T55: «человек-владелец пространства цели или декларант» |
| Н-7 | `design/04-architecture.md:102` | `design/domains/22-run.md:395` (RN-02), `design/02-glossary.md:165` (T96); П-29 (22-run/И-1) | 04:102 — «Стадии и функции ядра — чистые; ввод-вывод — только в `adapters/` и `cli/`»; RN-02 — «одна сигнатура вместо трёх; «чистая функция» не описывала стадии с LLM» | исправить | 04:102: «функции ядра — чистые; стадия — внешнее только через порты `Deps` (RN-02)» |
| Н-8 | `design/02-glossary.md:76` (T43) | `design/02-glossary.md:77` (T134), `design/domains/13-rules.md:53`, `design/domains/13-rules.md:59`, список примитивов `design/domains/13-rules.md:69-78` | T43 — «функция ядра, которую параметризует правило (`schema`, `grain-unique`, `ref-exists` …)»; T134 — «`owner`, `immutable`, `grain-unique`, `ref-policy`, `roles`; не параметризуются правилом»; в 13-rules `grain-unique` — проверка ядра (:59), не примитив | исправить | убрать `grain-unique` из примеров T43 |
| Н-9 | `design/domains/21-compose.md:134` (и `check` → `findings`, `design/domains/21-compose.md:116`) | `design/02-glossary.md:78` (T44), `design/domains/13-rules.md:38`, `design/domains/22-run.md:102` (`Finding` (T44)); род П-15 (13-rules/И-9) | 21-compose:134 — «Нарушение отклоняет выбор целиком: строк решения нет, нарушения — в `findings` (оболочка RL-11)»; T44 — «находка — результат `soft`-проверки»; 13-rules:38 — «`soft` — в `lint`, результат — находка (T44)». Нарушения проверки выбора кладутся в поле, тип которого — находка | исправить | либо T44 расширить до «находка — нарушение или `soft`-результат в `findings`», либо назвать поле/тип для нарушений `check` иначе; решает 13-rules (владелец T44) |
| Н-10 | `design/02-glossary.md:30` (T21) | `design/04-architecture.md:10`, `design/00-vision.md:73`, `design/domains/10-kernel.md:193`; П-2 (10-kernel/И-32, ADR-30) | T21 — «замороженное пространство имён … меняется только версией кода»; 04:10 — «только версией ядра; хэш генезиса — константа версии»; 00:73 — «малое замороженное ядро (меняется лишь версией ядра)». Код системы тоже меняется «версией кода» (релизами, 04:11) | мелочь | T21: «меняется только версией ядра» |
| Н-11 | `design/domains/10-kernel.md:203-204` | `design/domains/13-rules.md:78` (`learning-gate`, ADR-29), `design/04-architecture.md:10`; род П-2 | 10-kernel:203-204 — «Код ядра знает только: форму ревизии, хэш, каноническую форму, ссылки, режимы идентичности, факты с ролями и примитивы проверок. Что такое «потребность» или «решение» — знают данные `std`»; примитив ядра `learning-gate` (13-rules:78) — «вердикт не из сессии стенда и у его кортежа (T131) есть `bench-run pass` по плану с `base` на регрессионный план, или вердикт из сессии `purpose: simulate`»: код ядра знает вердикт, прогон и план стенда, `purpose` | мелочь | в 10-kernel:203-204 назвать исключение — `learning-gate` (ADR-29) |
| Н-12 | `design/03-python-lessons.md:15` | `design/domains/10-kernel.md:47-48`, GR-01 `design/domains/11-identity-grain.md:171` (на него строка ссылается), KR-15 `design/domains/10-kernel.md:256`; Ф-12 | 03:15 — «значение с тем же содержимым — тот же `id` (`#hash`); повторная запись — no-op по `(type@n, hash)` \| KR-04, GR-01, ADR-2»; 10-kernel:47-48 — «Значение, которое уже лежит в хранилище, но пространство пишущей сессии его ещё не держит, — не no-op: шаг коммита пишет `core/holds`»; GR-01 — «значение, которое пространство не держит, — `core/holds`, не no-op» | мелочь | 03:15: «повторная запись — no-op или `core/holds`, если пространство его не держит» |
| Н-13 | `design/domains/23-bench.md:18` (`split: dev \| test`), также `design/02-glossary.md:202` (T161), `design/domains/22-run.md:302` | `design/02-glossary.md:50` (T32 «разделение \| split»), CP-10 `design/domains/21-compose.md:260`; род Ф-11 | T32 — «разделение \| split \| отмена алиаса»; CP-10 — «`split` занят (T32)»; 23-bench:18 — поле элемента стенда «`split: dev \| test`». Имя `split` — в двух смыслах; поле стенда в глоссарии не определено | мелочь | дать полю стенда термин в глоссарии со ссылкой на T32 или переименовать; решает 23-bench |

## Замечание к реестру (вне design/)

Столбец «Где» реестра для части строк указывает не на тот текст (сверено `grep -n`): 22-run — П-29 `:305` (разделитель таблицы
обучения; RN-02 — `:395`), П-25/Ф-4 `:306` (строка `same_need: false`; RN-03 — `:396`), П-26 `:309` (строка `none`; RN-06 — `:399`),
Ф-8 `:167` (→ `:169`); 21-compose — П-23 `:250` (разделитель; CP-04 — `:254`), П-24 `:254` (CP-04; CP-08 — `:258`), Ф-2 `:255`
(CP-05; CP-09 — `:259`), Ф-11 `:256` / `:173` (CP-06 / … ; CP-10 — `:260`, `divide` — `:176`). Остальные сдвиги — 1–3 строки.

## Проверено без находок

- П-1 — `design/domains/10-kernel.md:30`, `design/domains/10-kernel.md:170-171`; LG-04 `design/domains/12-ledger.md:176`.
- П-3 — `design/domains/10-kernel.md:94-96`.
- П-4 — T12 `design/02-glossary.md:21`; `design/domains/10-kernel.md:69`.
- П-5 — CT-02 `design/domains/15-catalog.md:138`; импорт копией `design/domains/15-catalog.md:33`.
- П-6 — `design/domains/10-kernel.md:62`.
- П-7 — `design/domains/10-kernel.md:171-172`; `design/domains/14-trust.md:56-60`.
- П-8 — `design/domains/15-catalog.md:53`, `design/domains/15-catalog.md:57`.
- П-9 — AR-02 `design/04-architecture.md:117`; `design/domains/22-run.md:147`.
- П-10 — `design/domains/10-kernel.md:200-201`; T66 `design/02-glossary.md:129`.
- П-11 — `design/domains/10-kernel.md:43`; `design/domains/14-trust.md:61`.
- П-12 — `design/domains/11-identity-grain.md:116`; GR-07 `design/domains/11-identity-grain.md:177`.
- П-13 — `design/domains/11-identity-grain.md:132-134`; GR-06 `design/domains/11-identity-grain.md:176`.
- П-14 — `design/domains/12-ledger.md:76`; LG-14 `design/domains/12-ledger.md:186`.
- П-15 — «ноль нарушений hard» `design/01-first-run.md:55`; S4 «`lint` без нарушений `hard`» `design/05-slices.md:13` (новая находка того же рода — Н-9).
- П-16 — `design/domains/22-run.md:283-284`; `design/domains/14-trust.md:78`.
- П-18 — `design/domains/10-kernel.md:99`; `design/domains/15-catalog.md:22`.
- П-19 — `design/domains/15-catalog.md:29`; `design/04-architecture.md:68`.
- П-20 — `design/domains/15-catalog.md:57`; CT-04 `design/domains/15-catalog.md:140`.
- П-21 — `design/domains/20-lens.md:86`, LN-06 `design/domains/20-lens.md:190`; `design/domains/15-catalog.md:102`.
- П-22 — `design/01-first-run.md:43` (≥ 10 пустышек; 6 — только ориентир черновиков); `design/domains/23-bench.md:93`.
- П-23 — `design/domains/21-compose.md:50`; CP-04 `design/domains/21-compose.md:254`.
- П-24 — `design/domains/21-compose.md:40-41`; CP-08 `design/domains/21-compose.md:258`.
- П-25 — CP-13 `design/domains/21-compose.md:263`; RN-03 `design/domains/22-run.md:396`.
- П-26 — RN-06 `design/domains/22-run.md:399`; T98 `design/02-glossary.md:167`.
- П-27 — `design/domains/30-adapters.md:131`, `design/domains/30-adapters.md:140`; `design/domains/20-lens.md:141`.
- П-28 — `design/domains/22-run.md:321-324`; RN-05 `design/domains/22-run.md:398`.
- П-30 — матрица `design/04-architecture.md:16-33`; AR-04 `design/04-architecture.md:119`.
- П-31 — `design/04-architecture.md:77`; AR-03 `design/04-architecture.md:118`.
- П-32 — AD-02 `design/domains/30-adapters.md:249`; `design/domains/20-lens.md:135`.
- Ф-1 — `design/domains/11-identity-grain.md:116`; T40 `design/02-glossary.md:63`; LG-04 `design/domains/12-ledger.md:176`.
- Ф-2 — `design/domains/21-compose.md:167-170`; CP-09 `design/domains/21-compose.md:259`.
- Ф-3 — `design/domains/22-run.md:352-353`; `design/domains/30-adapters.md:161`.
- Ф-4 — RN-03 `design/domains/22-run.md:396`; вопрос 1 `design/domains/12-ledger.md:194`.
- Ф-5 — `design/domains/20-lens.md:73`; `design/domains/22-run.md:51-54`.
- Ф-6 — `design/domains/10-kernel.md:139`, KR-09 `design/domains/10-kernel.md:250`; `design/domains/13-rules.md:32-34`.
- Ф-7 — `design/domains/10-kernel.md:167-171`; `design/domains/15-catalog.md:57` (поля `authority` в design/ нет).
- Ф-8 — `design/domains/22-run.md:169`; `design/domains/12-ledger.md:67`.
- Ф-9 — `design/domains/30-adapters.md:119-120`; LG-09 `design/domains/12-ledger.md:181`.
- Ф-10 — `design/domains/20-lens.md:92`; `design/domains/14-trust.md:146-147`; T91 `design/02-glossary.md:157`.
- Ф-11 — `divide` `design/domains/21-compose.md:176`, CP-10 `design/domains/21-compose.md:260`; T140 `design/02-glossary.md:193` (новое употребление `split` — Н-13).

С находками: П-2 (Н-10, Н-11), П-17 (Н-5, Н-6), П-29 (Н-7), Ф-12 (Н-12).

## Проверка сессии C1

Каждая находка сверена `sed -n` / `grep -n` обоих мест (2026-09-27). Все 13 — подтверждены. Закрытые П/Ф (список выше) —
выборочно сверены П-1, П-9, Ф-3, Ф-8 (адреса ведут на новый текст).

| Н | Вердикт | Заметка сессии |
|---|---|---|
| Н-1 | подтверждено · исправить (понижено с «блокирует») | = `T-8-10-12-13-16.md` №2: 10-kernel:171 «пустой `key` — … подсказки» vs 21-compose:21; владелец ключа ясен (21-compose), правка текстовая |
| Н-2 | подтверждено · исправить | = `T-8-10-12-13-16.md` №2 (два смысла «накопительный») |
| Н-3 | подтверждено · блокирует | 30-adapters:29-30 «в `detail` (у `judge-jev` — `promptHash`, `stateHash`)» vs 22-run:212 «Хэшей в `Meta` нет», T135 |
| Н-4 | подтверждено · исправить | = A-3 |
| Н-5 | подтверждено · исправить | = `T-1-6-7-11.md` №8 |
| Н-6 | подтверждено · исправить | T122 (02:105) «решающее «−» владельца», T55 (02:100) «`declared` (владелец)» vs 14-trust:94-95 (связано с `T-1-6-7-11.md` №5) |
| Н-7 | подтверждено · исправить | 04:102 «Стадии … — чистые» vs RN-02 |
| Н-8 | подтверждено · исправить | T43 (02:76) `grain-unique` — пример примитива; 13-rules:59 — проверка ядра |
| Н-9 | подтверждено · исправить | 21-compose:134 «нарушения — в `findings`» vs T44 (02:78) «находка — результат `soft`» |
| Н-10 | подтверждено · мелочь | = `T-8-10-12-13-16.md` №8 |
| Н-11 | подтверждено · мелочь | 10-kernel:203-204 «знают данные `std`» vs `learning-gate` (13-rules:78) знает вердикт, план, `purpose` |
| Н-12 | подтверждено · мелочь | 03:15 «no-op по `(type@n, hash)`» без `core/holds` (10-kernel:47-48, GR-01) |
| Н-13 | подтверждено · мелочь | 23-bench:18 поле `split: dev \| test` vs T32 `split` (02:50), CP-10 «`split` занят» |
