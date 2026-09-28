# dev/ — состояние разработки LATTICE

Рабочее состояние разработки вместо скрытой памяти агента: откуда пришла работа, где мы, что мешает, какие указания
действуют, что показали разборы сессий. Всё в git, видно в PR. Модель — объекты LATTICE (тип, id, зерно, связи-факты),
чтобы при переходе T2 dev/ загрузился `source-files` без переделки. Основа — WARRANT-ADR-0032; отличия — [PRP-001](proposals/PRP-001.md).

## Граница и сигнал остановки

| Кто | Отвечает за | В dev/ |
|---|---|---|
| **WARRANT** | lifecycle и принуждение: этап Change, UNK, evidence, gates, `rule/1` | только ссылки |
| **OpenSpec** | требования (`specs/`), задачи Change с отметками (`tasks.md`), дизайн | только ссылки |
| **dev/** | вход, навигация, работа без Change, проблемы, правила, реестр и разборы сессий, триггер | хранится |
| **LATTICE** (после T2) | смысл, связи, история, обучение, предложения | — |

Тест новой идеи: (1) разрешено, доказано, доставка нормы → WARRANT; требования и задачи Change → OpenSpec; (2) смысл,
связи, история, обучение → LATTICE; (3) остальное и только про LATTICE → dev/. **Сигнал остановиться:** поле или файл
dev/ повторяет WARRANT или OpenSpec, либо dev/ растёт быстрее числа Change — пересмотр модели. Первое срабатывание —
шаги Change в dev/ повторяли lifecycle и `tasks.md` (2026-09-28, [IDEA-002](ideas/IDEA-002.md)): убраны.

## Где смотреть

| Вопрос | Где |
|---|---|
| что делаем сейчас | `STATE.md` → дорожка → work → следующий шаг |
| этап Change и что дальше по нему | `warrant status <change>` (`change_state`, `next`) |
| задачи Change и отметки | `openspec/changes/<id>/tasks.md`; после archive — `openspec/changes/archive/<дата>-<id>/` |
| требования | `openspec/changes/<id>/specs/`; после archive — `openspec/specs/` |
| задачи работы без Change | `work/<id>.md` → «Шаги» |
| проблемы, ловушки | `issues/` |
| кто что делал и что пошло не так | `sessions/` → `reports/` |
| решения maintainer'а | комментарий в PR (`gh/N#issuecomment-…`) |

## Объекты

Пространство `dev`. Файл — один объект (как `source-files`): frontmatter — поля, первый абзац под заголовком —
`summary`. Папка — тип; признаки, которые меняются (дорожка, источник, уровень, статус), — поля, не путь и не id.

| Тип | Вид LATTICE | id | Файл |
|---|---|---|---|
| `dev/state@1` | сущность, одна | `state` | `STATE.md` |
| `dev/idea@1` — **вход**: идея, запрос, тикет | сущность | `IDEA-NNN` | `ideas/` |
| `dev/track@1` — линия работы | сущность, зерно — имя | `infra`, `foundation`, `s0`…`s9` | `tracks/<id>.md` |
| `dev/work@1` — Change WARRANT или работа без Change | сущность, зерно — имя Change | `pin-v0-8-1`, `dev-model` | `work/<id>.md` |
| `dev/issue@1` — дефект, ловушка, пробел | сущность | `ISS-NNN` | `issues/` |
| `dev/rule@1` — правило | сущность | `RUL-NNN` | `rules:` в узле или в стандарте |
| `dev/guide@1` — стандарт: правила одной темы | сущность, зерно — тема | `code`, `quality`, `tests`, `git`, `docs`, `process`, `reports`, `output`, `env` | `rules/<id>.md` |
| `dev/session@1` — сессия агента в разработке | событие, зерно — транскрипт | `SES-<8 знаков id транскрипта>` | `sessions/` |
| `dev/report@1` — разбор сессии или сводный | **событие**, не правится | `RPT-NNN` | `reports/` |
| `dev/proposal@1` — предложение в другой проект | сущность | `PRP-NNN` | `proposals/` |

**id.** Префикс — для людей: тип задаёт поле `type`, из id он не выводится (design/domains/10-kernel.md:114). Номер —
следующий свободный по префиксу (смотреть `main` и открытые ветки), не переиспользуется. Где есть естественный ключ
(зерно) — id и есть ключ: имя Change, имя дорожки, id транскрипта. Переименование — `aliases: [<старый id>]` (как
`core/alias`), ссылки по старому id остаются верными.

**Ссылки** — `пространство/local`, пространство — владелец объекта:

| Вид | Пример |
|---|---|
| объект dev (пространство не пишется) | `ISS-018`, `RUL-012`, `IDEA-002`, `SES-6ea8baa8`, работа `dev-model`, шаг — `dev-model#3` |
| объект WARRANT этого репозитория | `lattice/pin-v0-8-1`, `lattice/UNK-KR-005`, `lattice/EVID-…`, `lattice/RUN-…`, задача — `lattice/pin-v0-8-1#task-3.1`, решение — `lattice/pin-v0-8-1#I-4` |
| продукт WARRANT | `warrant/BL-82`, `warrant/ADR-0042`, `warrant/REQ-VER-003` |
| git и GitHub этого репозитория | `git/b71a490`, `gh/5`, `gh/5#issuecomment-5865888855` |
| файл репозитория | `design/05-slices.md#s1` |

Временные каталоги, чат и проза («коммит в PR») ссылкой не бывают.

**Связь хранится один раз** — у объекта, который создан позже или зависит (в LATTICE — факт с ролями); обратная
вычисляется: сейчас `grep -rn <id> dev/`, после T2 — `lattice explain`.

| Поле | У кого | Куда |
|---|---|---|
| `from` | idea, work, issue, proposal | причина: `IDEA-…`, `RPT-…`, решение |
| `track` | work | дорожка |
| `waits` | work | что вне WARRANT блокирует: `ISS-…`, работа, шаг |
| `found` | issue | где найдено: `<work>#<шаг>`, `SES-…` или `RPT-…` |
| `source` | rule | основание: `ISS-…`, решение maintainer'а, `design/…`, `lattice/EVID-…` |
| `links` | session | работа, Change, задачи, шаги, PR, которых касалась сессия |
| `session`/`sessions`, `refs` | report | разобранные сессии; проблемы, найденные или повторившиеся |

Повтор проблемы — число отчётов, ссылающихся на неё. **Цепочка:** `IDEA` → `work` (`from`) → `lattice/<Change>` →
`tasks.md`, EVID, PR · шаги работы без Change; `SES` (`links`) → `RPT` (`session`) → `ISS` (`refs`, `found`) → `RUL`
(`source`) → `PRP` (upstream).

## Файл

Frontmatter: `id`, `type`, `title`, `aliases?`, поля типа. Затем `# <id> — <title>`, **первый абзац — одна фраза-суть**,
затем разделы строго по порядку:

| Тип | Разделы |
|---|---|
| state | Журнал |
| idea | Суть · Исход |
| track | Цель · Журнал |
| work с Change | Контекст (≤ 5 строк, ссылка на `tasks.md`) · Решения (только те, чего нет в WARRANT) · Журнал |
| work без Change | Контекст · Шаги · Приёмка · Решения · Журнал |
| issue | Симптом (точный текст) · Причина · Обход · Закрытие |
| session | Что делала · Разбор |
| report | Сессия (или Сессии) · Сбои · Не хватает · Улучшения · Итог |
| guide | Область · Процедуры (если есть) · Проверка; правила — в `rules:` frontmatter |
| proposal | Контекст · Пункты · Исход |

Строка журнала: `- ГГГГ-ММ-ДД — <событие> (<ref>)`. **Журнал, сессия и отчёт не правятся:** ошибку исправляет новая
строка «исправление к ГГГГ-ММ-ДД: …» со ссылкой. Исключение — `SES` идущей сессии: при её завершении один раз
закрывается `period`; повторный разбор — новый `RPT`, `audit` становится списком.

## Отметки: только там, где нет OpenSpec

У **Change** шагов в dev/ нет: этап — `warrant status`, задачи и отметки — `tasks.md` (всё, что нужно сделать в рамках
Change, включая акты человека, — задача там). Следующий шаг по Change = `next` из `warrant status` + первая неотмеченная
задача `tasks.md`.

У **работы без Change** шаги и приёмка — список задач в теле, как в `tasks.md`:

```markdown
## Шаги
- [x] 1 · agent · ветка и PR — gh/8
- [ ] 2 · human · комментарий-решение в PR
- [ ] 3 · agent · после решения — PR ready

## Приёмка
- [ ] каждый ref в from, found, source, waits, refs существует · cmd
```

- строка: `- [ ] <n> · <agent|human> · <что>`; `[x]` — **только со ссылкой** после ` — `; ожидание — в строке:
  `(ждёт ISS-018)`;
- **следующий шаг — первая строка `[ ]`**; номер постоянный (`dev-model#2`), новые шаги — следующим номером в нужное
  место; шаги не удаляются — отмена: `- [x] ~~…~~ — отменено: <причина> (ref)`;
- шаг агента отмечает агент; шаг человека — человек (веб-редактор GitHub в ветке) или агент после проверки факта
  (`gh pr view`, `git log`); отметка без проверяемой ссылки — вопрос, не галочка.

**Проблема:** `## Закрытие` — тот же список проверок; все отмечены → `status: verified`.

**Комментарии:** решение — комментарий в PR (ссылка `gh/N#issuecomment-…`); замечание к строке — комментарий к строке
файла dev/ в diff PR (агент читает `gh api`, отвечает коммитом; решением не считается); новая мысль вне PR — в чат,
агент заводит `IDEA-NNN`.

## Поля

| Тип | Поля (кроме общих) |
|---|---|
| state | `focus` (дорожка), `switch`, `env`, `rules` (только ловушки) |
| idea | `kind` (idea · request · defect), `by` (`human:<login>` · `agent`), `from` (решение или null), `outcome` (`{to: [ref]}` · `{rejected: причина, ref}` · null) |
| track | `focus` (work), `depends_on`, `rules` |
| work | `track`, `from`, `change` (`lattice/<id>` · null), `branch`, `pr`, `waits`, `rules` |
| issue | `origin` (warrant · lattice · env · agent), `kind` (defect · trap · gap · process), `severity` (blocker · major · minor), `status` (open · workaround · upstream · fixed · verified · wontfix), `date`, `found`, `upstream` (ref · null — не передано), `review_by` |
| session | `transcript` (id), `period`, `kind` (work · review · analysis · other), `links`, `audit` (`RPT-…` · null — не разобрана) |
| report | `kind` (session · synthesis), `session` или `sessions`, `period`, `refs` |
| proposal | `to` (проект), `from`, `outcome` |
| guide | `paths` (область, как у `rule/1`), `rules` |

Статуса у work и track нет: lifecycle — `warrant status`, готовность работы без Change — «Приёмка».
**`focus` — куда смотреть сейчас, не приоритет;** смена фокуса из-за blocker или решения — строка журнала с причиной.

## Правила

Поля: `id`, `text` (1–2 строки), `force` (`normative` — нарушение: стоп и вопрос, принуждения нет · `advisory` — по
суждению), `status` (candidate · active · retired), `source` (обязательно), `owner` (`human:<login>`), `when?`
(`{operation, actor}`), `until?` + `review_by` (у ловушки оба), `overrides?` + `reason`, `enforced_by?` (только если держит
WARRANT). Надмножество `warrant://rule/1` — перенос копированием.

- **Где:** стандарты — `rules/<тема>.md` (ловушки среды и техники — `rules/env.md`); ловушки WARRANT — `STATE.md`;
  уточнения — в узле, к которому относятся.
- **Кто создаёт:** `advisory` и ловушки — агент (`active`, с `source`); `normative` — только по комментарию maintainer'а в
  PR, до него `candidate`. Без `source` — на пересмотр.
- **Переопределение ниже:** `overrides: RUL-…` и `reason`; `advisory` — агент сам, со строкой журнала; `normative` — по
  решению maintainer'а. Молчаливое противоречие — стоп и вопрос.
- **Сборка контекста:** `AGENTS.md` → `rules/` по области → `STATE.md` → дорожка → work; фильтр `when`, `until`. Больше 7
  на уровне — сигнал поднять общее вверх или сделать формой в WARRANT. Субагенту применимые правила — текстом в промпте:
  `python scripts/dev/dev-check.py --brief <операция>` (RUL-013).
- **Жизнь ловушки:** проблема → ловушка → (upstream исправил → `retired`) · (повторяется и проверяема → форма в WARRANT) ·
  (нужна везде → уровень выше или `rules/`).

## Цикл разработки

**Штатный цикл WARRANT → разбор → исправление → следующий шаг.**

1. **Работа:** Change по `AGENTS.md` (или работа без Change по «Шагам»); вывод — по [rules/output.md](rules/output.md).
2. **Разбор:** каждая рабочая сессия — `SES` в реестре и `RPT` аналитика ([rules/reports.md](rules/reports.md));
   каждые 5 разобранных сессий или при archive Change — сводный `RPT` (`kind: synthesis`): системные проблемы.
3. **Исправление:** проблема LATTICE (dev/, процедуры, правила) — сразу, работой без Change или в следующем Change;
   проблема WARRANT — `PRP`/`ISS` с `upstream`, передача сессии WARRANT (`D:\project\SRA`) делает maintainer; до
   исправления — ловушка.
4. **Следующий шаг:** по `focus`.

## Протокол основной сессии

**Старт — первым сообщением, блоком «▶️ Старт» ([rules/output.md](rules/output.md)); данные — `python
scripts/dev/dev-check.py --start`:** (1) `warrant status` сверен с
цепочкой `focus`; (2) условия `switch`; (3) сигналы: просроченные `review_by` — строкой, не приоритетом; (4) шаги
`actor: human` и `WAIT` WARRANT — очередь maintainer'а; (5) правила цепочки: конфликты, >7, без `source`;
(6) неразобранные сессии — транскрипты без `SES` или `SES` без `audit`.

**Инварианты** (проверка — `python scripts/dev/dev-check.py`, 0 ошибок перед каждым коммитом dev/):
- цепочка `focus` без разрыва; следующий шаг один;
- каждый ref в `waits`, `from`, `found`, `source`, `links`, `refs` существует;
- dev/ обновляется в момент события, в коммите самой работы — после `warrant run finish` (внутри Run guard dev/**
  запрещает);
- история неизменна (журнал, сессии, отчёты);
- **выход из тупика:** если модель dev/ мешает работе — стоп, `ISS-…` с `origin: lattice`, вопрос maintainer'у; обход
  не изобретать.

**Промах агента** — строка журнала; повтор (по отчётам) или заметная цена → `ISS-…` с `origin: agent`.
**`review_by` по умолчанию:** ловушка +14 дней · blocker +3 · major +14 · minor +30 · шаг человека +1.

## Куда записывать

| Что | Куда |
|---|---|
| новая идея, запрос, тикет | `ideas/IDEA-NNN` |
| задача в рамках Change | `tasks.md` Change (OpenSpec) |
| решение по Change | UNK (`PROPOSED`/`SPECIFIED`) или `I-N` в design.md Change |
| решение по продукту | `design/` (заморожен) → spec Change |
| норма процесса для всего проекта | WARRANT rule; стандарт с текстом — `rules/`, доставка — WARRANT rule с `paths` |
| где мы, почему свернули | узел в фокусе, журнал |
| дефект, ловушка, пробел | `issues/ISS-NNN` |
| сессия и её разбор | `sessions/SES-…`, `reports/RPT-NNN` |
| личная память агента | нет: автопамять выключена (`.claude/settings.local.json`) |

## Решения

Модель dev/ — grilling 2026-09-28 Q1–Q29, подтверждение — `gh/3#issuecomment-5865372587`; модель объектов LATTICE,
отметки, реестр сессий, цикл, вывод — [IDEA-002](ideas/IDEA-002.md).
