# STATE — внедрение итогов разбора в design v0.3 → v0.4

Навык `/arch-integrate`. Новая сессия читает **только этот файл**, затем — то, на что он указывает. После сессии —
обновить этот файл (≤ 60 строк) и остановиться: следующую сессию начинает пользователь.

## Сейчас

- Фаза: **D** · последняя сессия: **D08** (2026-09-27) — `20-lens` пройден целиком (108 → 209 строк): карточка
  `std/card {of, title, summary, cues}` и шаблон типа `card` (пути тела или ссылка на тип, LN-09); `std/knowledge`,
  `std/term`, `std/pool` — владелец 20 (LN-14); стадии с `reads`/`writes` (`bm25`, `judge` — имена по 22-run);
  подсказки — к `блоку@n`, `cues_max` 10 (LN-10); буст — место в пуле и причина, не балл (LN-11); порог по
  `max(scores.judge)` + `calibrated_for`, без калибровки `no-match` не выносится (LN-07); `policy.lens` std
  `{exclude: [overruled], mark: [inferred, contested]}`; кандидат — `trust()` как есть + `marks`; порт `Judge` — §5;
  `std/measurement@1`. Обратная правка `13-rules.md:94`. Журнал `sessions/D08.md`.
- **Следующая: D09 — `21-compose`** (120 строк). 42 строки реестра (открыт 12), среди них N-43 (`std/cue.target`,
  `select` читает `trust`/`marks`, отказ при `uncalibrated`), N-40 (`policy.candidates`), N-41 (`trust()`), остатки
  T-2, T-3, T-14, ADR-24 (порт `composer`), 20-lens/И-7 (= 21-compose/И-3), И-9, И-10. ADR —
  `grep -ln 21-compose design/adr/0*.md`: 8, 13, 17, 18, 19, 24. Подготовка — сама сессия, чек-лист `prompts/brief.md`
  (режим «D»), `grep -rn "(21-compose.md)"` по пройденным; выше по течению — 10, 11, 12, 13, 14, 15, **20** (кандидат
  T87, `marks`, `judge.verify`, `std/term`, ключ потребности из `needs[].terms`).
- Ход D — `reference/phases.md` §D: подготовка (сама сессия) → раунд 0 (A/C/E/F) → B/D/E → правка →
  `set внесён --where` → закрытие. `внесён` — только когда пункт внесён целиком; ADR и T — после всех их файлов.
  Новая ADR — с 30.
- Правки навыка и техники (последние): D08 — поле чужого типа в рекомендации — из тела у владельца, `grep` (X-61);
  `ledger add` режет `--gist` до 150 — подробности сразу `set <ID> открыт --note` (X-62); ADR вне фильтра `--file`
  (пустые «Файлы») — искать по «Последствиям» (X-52, ADR-16). После D07 — **субагентов нет**, брифа нет; D07 — X-60.

## Реестр (ledger check, итог) · блокеров нет

372 строки: открыт 75 · решён 117 · внесён 180 · сверен 0 · последний N — N-46. Lint: 0 ошибок, 4 предупреждения —
`import()` ×3, `lattice import` (план, 30-adapters).

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0–R6 | подготовка; волны 0–5 (T-1…-16; ADR-1…29; PF-01…06) — журналы `sessions/` | ✓ |
| D01 | 10-kernel «Модель» + 02-glossary | ✓ |
| D02 | 10-kernel: операции, инварианты, решения, Q-10 | ✓ |
| D03 | 11-identity-grain | ✓ |
| D04 | 13-rules | ✓ |
| D05 | 12-ledger | ✓ |
| D06 | 15-catalog | ✓ |
| D07 | 14-trust | ✓ |
| D08 | 20-lens | ✓ |
| D09 | 21-compose | → |
| D10 | 22-run (две сессии, если > 60 строк с N) | |
| D11 | 23-bench + 01-first-run | |
| D12 | 30-adapters | |
| D13 | 04-architecture + 05-slices | |
| D14 | 00-vision + 03-python-lessons + README | |
| C1 | аудит субагентами → `integration/audit/` | |
| C2 | решения по аудиту, lint strict, CHANGELOG, тег rc | |
| F | свежее чтение, выборка 1/10, тег `design-v0.4` | |

## Где что

`integration/PLAN.md` — карта и причины · `ledger.md` — реестр · `renames.md` · `ownership.md` (черновик, `?` —
решают брифы D) · `lint-baseline.txt` · `sessions/` — журналы (S0, R1–R6, D01–D08) · `briefs/` — брифы (R1–R6 — образцы режима R) ·
`design/adr/README.md` — индекс решений (ADR-1…29).
