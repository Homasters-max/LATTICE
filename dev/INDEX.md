# Индекс dev/

Все объекты и правила dev/ одной таблицей на тип: id, заголовок, суть, файл. Генерируется `python scripts/dev/dev-check.py --index` — руками не править; устарел — ошибка dev-check.

## Состояние (1)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| state | Состояние разработки LATTICE | Корень цепочки `focus`: дорожка в работе, переключатель lattice2lattice, ловушки проекта; порядок — `infra` (dev-model, session-audit) → срез `s0` (скелет, design/05-slices.md). | [STATE.md](STATE.md) |

## Идеи (7)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| IDEA-001 | Отказ от скрытой памяти агента | Состояние, ловушки и правила работы — в репозитории и механизмах WARRANT, а не в автопамяти Claude Code. | [ideas/IDEA-001.md](ideas/IDEA-001.md) |
| IDEA-002 | Модель dev/ на объектах LATTICE, отчёты отладки, стандарты разработки | Стандартные разделы узлов, классификация папок и единые id по идеям LATTICE, точка входа и сквозная цепочка, отчёты отладки сессий, общие правила разработки с переопределением ниже. | [ideas/IDEA-002.md](ideas/IDEA-002.md) |
| IDEA-003 | Правила текстом для промпта субагента | dev-check.py --brief <операция>: применимые правила (env, process, ловушки STATE и стандарты операции) текстом для промпта субагента. | [ideas/IDEA-003.md](ideas/IDEA-003.md) |
| IDEA-004 | Метрики в сжатии сессии | session-digest.py считает серии неудач, подсказки guard, ручной разбор JSON и коммиты dev/ — числа, сравнимые между отчётами. | [ideas/IDEA-004.md](ideas/IDEA-004.md) |
| IDEA-005 | След dev/ — число для сигнала остановки | dev-check.py --footprint: строки dev/ без проблем и отчётов на один ARCHIVED Change, объекты по типам, правила. | [ideas/IDEA-005.md](ideas/IDEA-005.md) |
| IDEA-006 | Проверка стандартов кода при разборе сессии | Аналитик проверяет правила code, quality, tests, если сессия правила src/** или test/**. | [ideas/IDEA-006.md](ideas/IDEA-006.md) |
| IDEA-007 | Версии всех документов в arhived/ папки | Изменённый документ — прежняя версия в `arhived/<имя>_vN.md` его папки, чтобы отслеживать изменения и оценивать их. | [ideas/IDEA-007.md](ideas/IDEA-007.md) |

## Дорожки (3)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| foundation | Общие контракты срезов | Change, чей контракт нужен нескольким срезам, а не одному: без него S1 и дальше не реализовать. | [tracks/foundation.md](tracks/foundation.md) |
| infra | Процесс и инструменты разработки | Постоянная дорожка: закрепление WARRANT, правила процесса, состояние разработки, разбор сессий, переход lattice2lattice. | [tracks/infra.md](tracks/infra.md) |
| s0 | Срез S0 — скелет | Все слои тонким настоящим кодом, фиктивные адаптеры через корень сборки, тест структуры, сквозной `solve` с коммитом. | [tracks/s0.md](tracks/s0.md) |

## Работы (9)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| dev-context | Подсистема контекста разработки — черновик и инварианты | Черновик концепции dev/ как подсистемы контекста (`dev/ARCHITECTURE.md`) и шесть инвариантов с критерием успеха; остальное — гипотезы до разбора одного полного цикла Change. | [work/dev-context.md](work/dev-context.md) |
| dev-model | Модель dev/ на объектах LATTICE | Типы, id и связи dev/ по модели LATTICE, отметки только там, где нет OpenSpec, стандарты разработки, реестр сессий, разборы и цикл разработки. | [work/dev-model.md](work/dev-model.md) |
| dev-state | Состояние разработки в репозитории | Автопамять Claude Code заменена каталогом dev/: состояние, ловушки, проблемы и правила — в git; закрыт. | [work/dev-state.md](work/dev-state.md) |
| kernel-format | Формат v1 ядра | Норма формата ядра — JCS, хэш, id и ссылки, ревизия, тест структуры; ARCHIVED (`gh/2`, `gh/9`, `gh/10`), нормы — `openspec/specs/kernel`, `openspec/specs/architecture`. | [work/kernel-format.md](work/kernel-format.md) |
| lattice2lattice-t1 | Форма dev/ в типах LATTICE | Заготовка: фокус сюда переводит `switch` T1-freeze (s2 ARCHIVED); отдельный Change по AGENTS.md — тогда задачи уйдут в его `tasks.md`. | [work/lattice2lattice-t1.md](work/lattice2lattice-t1.md) |
| lattice2lattice-t2 | Состояние разработки из LATTICE | Заготовка: фокус сюда переводит `switch` T2-switch (s4 ARCHIVED); dev/ остаётся источником, проекцию даёт LATTICE. | [work/lattice2lattice-t2.md](work/lattice2lattice-t2.md) |
| pin-v0-8-1 | Закрепить WARRANT v0.8.1 | Тег v0.8.1 в workflow, `warrant sync` 0.8.1, правила основной сессии — в `.warrant/local/rules/`; ARCHIVED (`gh/5`, `gh/6`, `gh/7`). | [work/pin-v0-8-1.md](work/pin-v0-8-1.md) |
| session-audit | Разбор сессий субагентом | Реестр сессий, сжатие транскрипта и навык аналитика: свежий субагент разбирает сессию и пишет `RPT` с классификацией, рабочий агент контекст не тратит; сводный анализ ищет системные проблемы. | [work/session-audit.md](work/session-audit.md) |
| wrap-cleanup | Переносы строк по ширине и ссылки на строки | Убрать из документов переносы строк по ширине и адреса строк так, чтобы они не возвращались: инструмент `md-wrap`, правила RUL-059 и RUL-038, шаблоны там, где агенты создают файлы. | [work/wrap-cleanup.md](work/wrap-cleanup.md) |

## Проблемы (30)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| ISS-001 | Bootstrap-PR всегда красный — CONFIG_MISSING без подсказки | `warrant ci` берёт политику из базы, а в `main` bootstrap-PR конфига ещё нет — job красный без подсказки. | [issues/ISS-001.md](issues/ISS-001.md) |
| ISS-002 | Guard запрещал любую команду node | Префикс guard по умолчанию был первым словом команды check — запрещался весь `node …`. | [issues/ISS-002.md](issues/ISS-002.md) |
| ISS-003 | Парсер junit не видел testcase вне testsuite (node:test) | Тесты `test()` вне `describe()` не учитывались в evidence; только верхнеуровневые — `INCONCLUSIVE`. | [issues/ISS-003.md](issues/ISS-003.md) |
| ISS-004 | Правило process привязано к pytest | Правило `process` берётся копией из slice с «тесты pytest»; шаблона без стека в продукте нет. | [issues/ISS-004.md](issues/ISS-004.md) |
| ISS-005 | warrant-reviewer недоступен в сессии, где выполнен sync | Claude Code читает `.claude/agents/` и hooks при старте сессии; после `sync` агент не находился, подсказки не было. | [issues/ISS-005.md](issues/ISS-005.md) |
| ISS-006 | run submit с длинным envelope через heredoc ломается | Envelope review ~16 КБ через heredoc искажается до shell; ошибка не показывала, что получено. | [issues/ISS-006.md](issues/ISS-006.md) |
| ISS-007 | Run review запрещает команды только для чтения | Пока идёт Run review, guard отклоняет любую команду, кроме `warrant run submit`, даже `cd` и `warrant status`. | [issues/ISS-007.md](issues/ISS-007.md) |
| ISS-008 | warrant id не резервирует номер | Номер вычисляется по файлам: повторные вызовы до записи дают один и тот же ID. | [issues/ISS-008.md](issues/ISS-008.md) |
| ISS-009 | Нет навыков процесса у подключённого проекта | Процесс — один текст правила `process`; агент импровизирует порядок шагов и ищет образцы в чужих репозиториях. | [issues/ISS-009.md](issues/ISS-009.md) |
| ISS-010 | Агент и maintainer — один аккаунт gh | `gh` авторизован как maintainer: комментарий, review или merge агента `warrant ci` засчитает как акт человека. | [issues/ISS-010.md](issues/ISS-010.md) |
| ISS-011 | init --frontend claude сразу включает hooks | Guard активен в текущей сессии до merge bootstrap-PR. | [issues/ISS-011.md](issues/ISS-011.md) |
| ISS-012 | В AGENTS.md нет правил раундов review | Агент подключённого проекта не знает, когда нужен второй review. | [issues/ISS-012.md](issues/ISS-012.md) |
| ISS-013 | PR без Change с правкой src/** проходит CI | `warrant ci` без record Change в diff даёт вид `none` и код без Change не ловит. | [issues/ISS-013.md](issues/ISS-013.md) |
| ISS-014 | Edit/Write превращают \uXXXX в символы | Инструменты Claude Code раскрывают литеральные escape-последовательности в символы. | [issues/ISS-014.md](issues/ISS-014.md) |
| ISS-015 | Git Bash — команда длиннее ~7 тыс. символов даёт unexpected EOF | Длинный heredoc через Bash-инструмент на Windows искажается до shell. | [issues/ISS-015.md](issues/ISS-015.md) |
| ISS-016 | Не больше 20 субагентов, HTTP 429 обрывает всех | Харнесс держит ≤ 20 одновременных агентов, кураторы — в том же лимите; 429 обрывает все сразу. | [issues/ISS-016.md](issues/ISS-016.md) |
| ISS-017 | perl -pe не находит кириллицу в шаблоне | Без `-Mutf8` исходник perl-скрипта читается как байты, и шаблон с кириллицей молча не совпадает. | [issues/ISS-017.md](issues/ISS-017.md) |
| ISS-018 | spec-report устаревает от любого коммита между verify и transition | `transition` отказывает, если после `verify` появился любой коммит, а по процессу между ними всегда есть коммит, PR и одобрение. | [issues/ISS-018.md](issues/ISS-018.md) |
| ISS-019 | Подсказка «start a Run first» на каждую правку вне Change | Правка dev/ без Run — норма процесса, но guard каждый раз советует начать Run; `AGENTS.md` называет это `deny`. | [issues/ISS-019.md](issues/ISS-019.md) |
| ISS-020 | Guard Bash запрещает команду check вне репозитория, а Write туда пропускает | Проба `node --test` в копии дерева во временном каталоге получила `deny`, хотя запись файлов туда guard пропустил. | [issues/ISS-020.md](issues/ISS-020.md) |
| ISS-021 | У warrant нет компактного вывода — JSON разбирается вручную | Чтобы достать поле из ответа `warrant`, агент каждый раз пишет `node -e 'JSON.parse…'`. | [issues/ISS-021.md](issues/ISS-021.md) |
| ISS-022 | Протокол старта сессии выполнен не полностью | Нормативный протокол старта (RUL-002) выполнен на 3 проверки из 5, отчёт дан через 14 минут, а не первым сообщением. | [issues/ISS-022.md](issues/ISS-022.md) |
| ISS-023 | Правила dev/ не доходят до субагентов | Субагенты dev/ не читают, поэтому ловушки (RUL-005) до исполнителя не доходят. | [issues/ISS-023.md](issues/ISS-023.md) |
| ISS-024 | Коммиты dev/ в ветке Change попадают в diff Change | Инвариант «dev/ — в коммите самой работы» кладёт dev/ в diff Change: `classify` видит dev/** в `changed`. | [issues/ISS-024.md](issues/ISS-024.md) |
| ISS-025 | Waiver в impl-PR делает Change factory-change | Waiver `spec-approved`, который правило `process` велит заводить в impl-PR, лежит на policy-пути — и `warrant ci` требует профиль `factory-change` и валит `scope-valid`. | [issues/ISS-025.md](issues/ISS-025.md) |
| ISS-026 | Задачи проверки Change нельзя отметить, archive их не требует | Задачи `tasks.md` о `verify` и локальном `warrant ci` выполняются после `run finish`, когда `tasks.md` вне `write_scope`, — и Change уходит в архив с неотмеченными задачами. | [issues/ISS-026.md](issues/ISS-026.md) |
| ISS-027 | Долгий вызов без промежуточного статуса — человек не понимает, что происходит | Пока субагент повторял неудачную сдачу review, агент молчал; человек принял тишину и повторные ошибки за сбой процесса. | [issues/ISS-027.md](issues/ISS-027.md) |
| ISS-028 | Авто-режим Claude Code запрещает shell-правку отслеживаемых файлов | Классификатор авто-режима Claude Code (не `warrant guard`) отклоняет `sed -i` по файлу проекта, даже когда путь в `write_scope` Run. | [issues/ISS-028.md](issues/ISS-028.md) |
| ISS-029 | Правка функции с регулярными выражениями кусками ломается раз за разом | Серия маленьких патчей Python-скрипта через heredoc и Edit по кускам: экранирование `\n` и кавычек сбивается, форма данных расходится с местами использования. | [issues/ISS-029.md](issues/ISS-029.md) |
| ISS-030 | Git Bash превращает аргумент ref:путь в путь Windows | MSYS переписывает аргументы, похожие на POSIX-путь, до передачи программе — `git show origin/main:<путь>` ломается. | [issues/ISS-030.md](issues/ISS-030.md) |

## Стандарты (9)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| code | Архитектура кода | Как устроен код LATTICE: слои, зависимости, ввод-вывод, данные вместо классов — выжимка `design/04-architecture.md` для правки `src/**`. | [rules/code.md](rules/code.md) |
| docs | Тексты и документы | Как писать тексты, которые читает и человек, и загрузчик LATTICE: суть первым абзацем, ссылки вместо пересказа. | [rules/docs.md](rules/docs.md) |
| env | Среда — Windows, Git Bash, инструменты агента | Ловушки среды и техники работы агента: Windows 11, Git Bash, инструменты Claude Code — что ломается и как обойти. | [rules/env.md](rules/env.md) |
| git | Git и PR | Ветки, коммиты и worktree так, чтобы цепочка от идеи до коммита читалась по `git log`. | [rules/git.md](rules/git.md) |
| output | Вывод агента человеку | Три шаблона — старт, остановка, готово: человек по одной таблице видит, где мы, что сделано, что от него нужно и что дальше. | [rules/output.md](rules/output.md) |
| process | Повторяющиеся процедуры | Процедуры для работы, которая повторяется: сначала шаги, потом — если повторится снова — навык или команда. | [rules/process.md](rules/process.md) |
| quality | Качество кода | Как писать код, который читается и прослеживается до дизайна: адресные отказы, термины глоссария, ссылки на решения. | [rules/quality.md](rules/quality.md) |
| reports | Отчёты отладки | Как разбирать рабочие сессии: сбои, чего не хватило, что улучшить системно — отдельным субагентом, по транскрипту. | [rules/reports.md](rules/reports.md) |
| tests | Тесты | Как тесты доказывают срез: до реализации, на фикстурах без сети, с именем сценария и инварианта. | [rules/tests.md](rules/tests.md) |

## Предложения (2)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| PRP-001 | Контекст разработки подключённого проекта — предложение WARRANT | Штатная часть для всех подключённых проектов: правила по операции с происхождением и сроком, их доставка и доказательство, канал старта сессии, очередь человека, разбор сессий; вход grilling нарезки фазы 5 WARRANT. | [proposals/PRP-001.md](proposals/PRP-001.md) |
| PRP-002 | Шаблоны артефактов Change без инструкций в комментариях и без переносов по ширине — предложение WARRANT | Шаблоны `warrant-sdd` (`proposal.md`, `spec.md`, `design.md`, `tasks.md`) — скелет итогового файла с короткими заглушками, а инструкции — один раз в описании схемы, потому что агент копирует форму шаблона в каждый Change. | [proposals/PRP-002.md](proposals/PRP-002.md) |

## Сессии (4)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| SES-4a6aa6ee | Состояние разработки в репозитории — dev-state, dev-model, session-audit | Проектирование и запуск dev/: grilling модели, отказ от автопамяти, модель объектов LATTICE, разборы сессий; RPT-004 — разбор среза, сессия ещё идёт. | [sessions/SES-4a6aa6ee.md](sessions/SES-4a6aa6ee.md) |
| SES-65298f6f | pin-v0-8-1 — spec-PR и начало impl | Первая сессия после отказа от автопамяти: закрыла dev-state, провела spec-PR pin-v0-8-1 и начала impl до перезапуска. | [sessions/SES-65298f6f.md](sessions/SES-65298f6f.md) |
| SES-6ea8baa8 | Архив pin-v0-8-1 и полный цикл kernel-format | Сессия закрыла pin-v0-8-1 (impl, archive) и провела kernel-format от review 2 до ARCHIVED: оба Change закрыты. | [sessions/SES-6ea8baa8.md](sessions/SES-6ea8baa8.md) |
| SES-fdf2e1d2 | Bootstrap LATTICE под WARRANT и spec-PR kernel-format до review 1 | Первая рабочая сессия под WARRANT: bootstrap слит, spec-PR kernel-format дошёл до review 1 и передачи W-1…W-12. | [sessions/SES-fdf2e1d2.md](sessions/SES-fdf2e1d2.md) |

## Отчёты (5)

| id | Заголовок | Суть | Файл |
|---|---|---|---|
| RPT-001 | Сессия pin-v0-8-1 — spec-PR и начало impl | Первая сессия после отказа от автопамяти: spec-PR pin-v0-8-1 слит, impl-PR остановлен штатно на перезапуске после `sync`; главные потери — STALE spec-report и разведка без процедуры pin. | [reports/RPT-001.md](reports/RPT-001.md) |
| RPT-002 | Сессия «старт» — архив pin-v0-8-1 и полный цикл kernel-format | За один прогон сессия закрыла archive-PR pin-v0-8-1 и провела kernel-format от Run specify через три review и impl до archive-PR #10 — оба Change ARCHIVED; главные потери — разведка дефекта classify/scope-valid (ISS-025, было W-014) и незамеченная до самого конца невозможность отметить последнюю задачу `tasks.md` до archive. | [reports/RPT-002.md](reports/RPT-002.md) |
| RPT-003 | Bootstrap-PR и spec-PR kernel-format — до review 1 (NOT_PROVEN) | Первая сессия разработки LATTICE под WARRANT: bootstrap слит (`gh/1`), spec-PR `kernel-format` дошёл до review 1 (`NOT_PROVEN`, 24 находки) и передачи проблем W-1…W-12 в сессию WARRANT; почти всё «Сбои» — сдача envelope review. | [reports/RPT-003.md](reports/RPT-003.md) |
| RPT-004 | Genesis-сессия dev/ — dev-state, dev-model, session-audit (срез на момент проверки навыка) | Сессия, которая создала сам каталог `dev/` (dev-state, gh/3-4) и модель объектов LATTICE поверх него (dev-model + session-audit, gh/8); разбор — по срезу на момент запуска этого субагента, сессия **ещё идёт**, часть шагов dev-model и session-audit не закрыта. Главный сбой — не техническая ошибка, а поправка maintainer'а: предложенная модель Change в dev/ дублировала lifecycle WARRANT и `tasks.md`. | [reports/RPT-004.md](reports/RPT-004.md) |
| RPT-005 | Первый сводный разбор — четыре сессии от bootstrap до двух ARCHIVED | Три причины дают больше половины потерь во всех четырёх сессиях: правила и обходы не доходят до исполнителя (субагента и даже основной сессии), JSON-вывод `warrant` разбирается вручную, а серия неудач идёт без смены подхода; ни одна из шести открытых проблем WARRANT с наибольшей ценой ещё не передана (`upstream: null`). | [reports/RPT-005.md](reports/RPT-005.md) |

## Правила (59)

| id | Правило | Где | Статус |
|---|---|---|---|
| RUL-001 | Акты maintainer'а (решение UNK комментарием, merge, активация waiver) агент не выполняет — присылает «❗ Выполнить — <что>:» и одну команду в блоке bash, без &&; результат проверяет сам (gh pr view) | [state](STATE.md) | retired |
| RUL-002 | Старт основной сессии — протокол dev/README.md «Протокол основной сессии», отчёт первым сообщением | [state](STATE.md) | retired |
| RUL-003 | Edit/Write превращают \uXXXX в символы — литеральный escape писать perl с \x5c | [env](rules/env.md) | retired |
| RUL-004 | Команду длиннее ~7 тыс. символов (сообщение коммита, тело PR, JSON) — файлом (-F/--body-file/--file), не heredoc | [env](rules/env.md) | active |
| RUL-005 | В Run review — только warrant run submit; status и git смотреть до run start (сдача --file — в инструкции warrant-reviewer 0.8.1) | [state](STATE.md) | active |
| RUL-006 | warrant id не резервирует — несколько ID за раз нумеровать подряд, проверит ids-valid | [state](STATE.md) | active |
| RUL-007 | Раунды review — BLOCKER → правка spec и review заново; PROVEN с MAJOR → I-N в impl-PR, не новый раунд | [state](STATE.md) | active |
| RUL-008 | Каждый тест node:test — внутри describe() (CI на v0.8.0 не видит тестов вне describe) | [state](STATE.md) | retired |
| RUL-009 | Правка с кириллицей в шаблоне — Edit; perl — только ASCII-шаблоны или perl -Mutf8 -CSD | [env](rules/env.md) | retired |
| RUL-010 | Тестовые векторы JCS формата v1 — эталон; их не правят под реализацию | [foundation](tracks/foundation.md) | active |
| RUL-011 | F-5 сам не решать — только blocking UNK к maintainer'у | [kernel-format](work/kernel-format.md) | retired |
| RUL-012 | warrant verify и transition — одной командой на одном HEAD (`warrant verify <c> && warrant transition <c> …`); любой коммит между ними делает spec-report STALE | [process](rules/process.md) | active |
| RUL-013 | Субагенту (warrant-reviewer и др.) применимые правила — текстом в промпте Agent: python scripts/dev/dev-check.py --brief <операция>; dev/ он не читает | [process](rules/process.md) | active |
| RUL-014 | Зависимости — только по матрице design/04-architecture.md §2; интерфейс домена (types.ts) — по правилу интерфейса | [code](rules/code.md) | active |
| RUL-015 | Ввод-вывод (node:fs, node:net, fetch, process.env, динамический import) и пакеты dependencies — только в src/adapters/ и src/cli/; adapters/* импортирует только src/cli/wire.ts, адаптеры друг друга не импортируют | [code](rules/code.md) | active |
| RUL-016 | Функции ядра чистые; внешнее стадии — только через порты Deps; время и id — порты clock, ids (в тестах фиксированы) | [code](rules/code.md) | active |
| RUL-017 | Тип — данные: одна структура Revision, «класс на тип» не заводится; ревизии из журнала заморожены; Id, Ref, Hash — branded types | [code](rules/code.md) | active |
| RUL-018 | Всё машинное — канонический JSON (ADR-1); второго формата нет | [code](rules/code.md) | active |
| RUL-019 | Имени технологии нет в схеме данных (типы, поля, ID, правила, стадии) — только значением проводки | [code](rules/code.md) | active |
| RUL-020 | Секреты — только ссылкой {"$env"}; литерал секрета в проводке или .lattice/ — ошибка | [code](rules/code.md) | active |
| RUL-021 | Отказ несёт код и адрес: путь поля, id объекта, адрес прежнего коммита — не просто текст | [quality](rules/quality.md) | active |
| RUL-022 | Имена в коде и сообщениях — термины design/02-glossary.md; синонимов не вводить | [quality](rules/quality.md) | active |
| RUL-023 | Публичная функция домена несёт ссылку на решение или инвариант дизайна (KR-11, 10-kernel инв. 3) — цепочка код → design | [quality](rules/quality.md) | active |
| RUL-024 | Комментарий объясняет «почему», не «что»; мёртвого и закомментированного кода нет; TODO — только со ссылкой ISS-… | [quality](rules/quality.md) | active |
| RUL-025 | Функция — одна ответственность; ветвление по типу объекта — данными std, не условиями в коде (AR-02) | [quality](rules/quality.md) | active |
| RUL-026 | Тесты среза пишутся до реализации; критерии «Готово, когда» исполнитель не меняет — уточнение решением в домене (SL-02) | [tests](rules/tests.md) | active |
| RUL-027 | Фикстуры — маленький синтетический проект, без сети; фиктивные адаптеры подключаются проводкой | [tests](rules/tests.md) | active |
| RUL-028 | Живой и фиктивный адаптер порта проходят один контрактный набор | [tests](rules/tests.md) | active |
| RUL-029 | Тест инварианта называет его (домен:номер, как в design/05-slices.md «Инварианты доменов → срез») рядом с токеном SCN-… | [tests](rules/tests.md) | active |
| RUL-030 | Наборы всех прежних срезов и тест структуры зелёные в каждом следующем срезе | [tests](rules/tests.md) | active |
| RUL-031 | Работа без Change — ветка chore/<work-id> от main, PR вида none (только dev/, CLAUDE.md, .gitignore, scripts/dev/) | [git](rules/git.md) | active |
| RUL-032 | Коммит: первая строка «<work или Change>: <что>»; в теле — зачем и id цепочки (IDEA-, ISS-, RUL-, RPT-) | [git](rules/git.md) | active |
| RUL-033 | Параллельная работа — отдельный git worktree; не переключать ветку в worktree, где работает другая сессия | [git](rules/git.md) | active |
| RUL-034 | Слитые ветки удаляются локально и на origin сразу после проверки merge | [git](rules/git.md) | active |
| RUL-035 | Язык — русский; термины, команды, коды ошибок и id — как есть | [docs](rules/docs.md) | active |
| RUL-036 | Первый абзац под заголовком — одна фраза-суть (summary при загрузке source-files) | [docs](rules/docs.md) | active |
| RUL-037 | Факт, который можно вычислить (git log, warrant status, состав каталога), прозой не пишется — ссылкой | [docs](rules/docs.md) | active |
| RUL-038 | Ссылки — по грамматике dev/README.md «Ссылки»: самая точная цель — id элемента → раздел (заголовок дословно) → файл, заметка базы — kb/ID#Раздел; номер строки не пишется; временные каталоги, чат и проза ссылкой не бывают | [docs](rules/docs.md) | active |
| RUL-039 | Закрепление новой версии WARRANT — по процедуре «Pin WARRANT» ниже, не разведкой в чужих репозиториях | [process](rules/process.md) | active |
| RUL-040 | Повторяющаяся работа, найденная в отчёте дважды, получает процедуру здесь; до повтора — строка журнала | [process](rules/process.md) | active |
| RUL-041 | Отчёт RPT-NNN пишет отдельный субагент по транскрипту сессии; рабочий агент — только блокирующие ISS и строки журнала | [reports](rules/reports.md) | active |
| RUL-042 | Каждая находка → ISS (существующая — в refs, это повтор; иначе новая); улучшение → IDEA; отчёт проблем не хранит | [reports](rules/reports.md) | active |
| RUL-043 | У находки: класс причины из перечня, цена (вызовы, время, токены), покрытие (ISS/RUL) и соблюдено ли правило | [reports](rules/reports.md) | active |
| RUL-044 | Не больше 120 строк; из транскрипта — только короткие цитаты ошибок; без секретов и личных данных | [reports](rules/reports.md) | active |
| RUL-045 | «Итог» — числа: вызовы, сбои по классам, след dev/ (правки, поля-дубли WARRANT/OpenSpec) — сигнал остановки модели | [reports](rules/reports.md) | active |
| RUL-046 | Разбор сессий и сводный — только по запросу человека (/session-audit); агент на старте показывает число неразобранных и может предложить разбор, сам не запускает; отчёт — событие, не правится | [reports](rules/reports.md) | active |
| RUL-047 | Ход, после которого агент останавливается, заканчивается блоком по шаблону: ⏸️ — нужен человек, ✅ — работа или Change закрыты; старт сессии — блок ▶️ первым сообщением | [output](rules/output.md) | active |
| RUL-048 | «Шаг N из M» не выдумывается: Change — этап warrant status (1 PROPOSED … 7 ARCHIVED) и задачи tasks.md x/y; работа без Change — шаги x/y | [output](rules/output.md) | active |
| RUL-049 | В блоке — только таблица и ссылки (PR — URL); проблемы: ⚠ сработавшая ISS, 🆕 новая; прозы до и после блока — не больше 3 строк | [output](rules/output.md) | active |
| RUL-050 | Действие человека — одна команда в конце блока ⏸️ под строкой «❗ Выполнить — <что>:» (правило WARRANT maintainer-acts) | [output](rules/output.md) | retired |
| RUL-051 | После 2 неудач одного действия — стоп: прочитать целиком (схему, --help, функцию) и сменить подход; после 3 или субагента дольше ~5 минут в foreground — строка статуса «▶️ <что, почему, что дальше>» | [output](rules/output.md) | active |
| RUL-052 | Change ведётся по AGENTS.md с тонкостями процедуры «Change» ниже — они из разборов RPT-001…003 | [process](rules/process.md) | retired |
| RUL-053 | Разработка — циклом: работа → разбор сессий → исправление LATTICE сразу, WARRANT — передачей → следующий шаг (README «Цикл разработки») | [process](rules/process.md) | retired |
| RUL-054 | Реестр sessions/: объект SES-<8 знаков> на каждую рабочую сессию с env.sessions_since; заводит аналитик (session-audit), audit — RPT разбора | [reports](rules/reports.md) | active |
| RUL-055 | git show <ref>:<путь> и другие аргументы вида a/b:c — с MSYS_NO_PATHCONV=1, иначе Git Bash превращает их в пути Windows | [env](rules/env.md) | active |
| RUL-056 | Код с регулярными выражениями или кавычками — Read функции целиком и одна замена всего блока (Edit/Write); не патчить кусками через heredoc; после смены формы данных — grep всех мест использования | [env](rules/env.md) | retired |
| RUL-057 | Правка файла проекта — Edit/Write; функцию с regex или кавычками — Read целиком и одна замена блока, после смены формы данных — grep использований; sed -i и perl -i — только вне проекта; литерал \uXXXX — perl -Mutf8 -CSD с \x5c | [env](rules/env.md) | active |
| RUL-058 | Документ dev/ или design/ перед коммитом правки — python scripts/dev/snapshot.py: прежняя версия в arhived/<имя>_vN.md, version +1; снимки не правятся и не удаляются | [docs](rules/docs.md) | active |
| RUL-059 | Markdown: абзац и пункт списка — одна строка любой длины, по ширине не переносить; новая строка — новый абзац, пункт, заголовок, строка таблицы или код; строка, которая должна быть видна отдельно, — отдельный абзац или пункт | [docs](rules/docs.md) | active |
