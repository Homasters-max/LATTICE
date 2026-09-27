# STATE — внедрение итогов разбора в design v0.3 → v0.4

Навык `/arch-integrate`. Новая сессия читает **только этот файл**, затем — то, на что он указывает. После сессии —
обновить этот файл (≤ 60 строк) и остановиться: следующую сессию начинает пользователь.

## Сейчас

- Фаза: **R закрыта → D** · последняя сессия: **R6** (2026-09-27) — волны 4–5 решены: T-5 (кампания на копии
  `.lattice/bench/<run>`, `purpose` у всех сессий — T137, T138), N-4 (в) → ADR-29 гейт обучения (hard на фактах
  `from: verdict`; `lattice pin` нет; уточняет PF-05), план стенда — событие с `setup: ref@n` и `base` (ADR-21, T111,
  T143), T-8 (`core/trust-policy.candidates`, `std/distinct` на любых сущностях — T142), `divide` (T140), ADR-20 (3 из
  5 — T141), ADR-16, -11, -22, -23. Журнал `sessions/R6.md`. Открытых ADR, T, PF нет; N-2…N-16 — доменные.
- **Следующая: D01 — `10-kernel` (модель: объект, заголовок, формат, идентичность) + `02-glossary`** (PLAN.md:81;
  файл > 60 строк — две сессии, D02 — операции, инварианты, решения, Q-10-1…5). Бриф `integration/briefs/D01.md`
  (субагент Opus, `prompts/brief.md` режим D, `sed` → `briefs/D01.prompt.md` + дополнения: `ledger.mjs show --file
  10-kernel` и `--file 02-glossary`, ● ADR файла, N этому файлу, `renames` в файле, глоссарий T89 и термины R1–R6).
  Ход D — `reference/phases.md` §D: бриф → раунд 0 (триаж A/C/F) → B/D/E → правка → `set внесён --where` → закрытие.
- Ход сессии R (R1–R6): бриф → сверка опор (`sed -n`) → раунды → запись сразу (ADR + индекс, глоссарий, `renames`,
  `ownership`, реестр) → lint → журнал → STATE → коммит. Новая ADR — с 30. `set` заменяет «Заметку» целиком.
- Правки навыка и техники (последние): R6 — в ADR только существующие ID, будущие строки «Решения» доменов —
  «сессия Dnn» (X-50, `reference/formats.md` §ADR); Python-вставка — якорь из `sed -n`, индекс = номер − 1 (X-51);
  R5 — «§n» в ADR — из `grep -n "^#"` (X-48); переменная оболочки — путь скрипта без подкоманды (X-49); R4 — lint:
  имя со скобками или пробелом в `renames` ищется как есть (X-46); R3 — длинные тексты Write-ом, правки md — Python
  `newline=''` (X-45).

## Реестр (ledger check, итог) · блокеров нет

342 строки: открыт 168 · решён 174 · внесён 0 · сверен 0 · последний N — N-16. Lint: 0 ошибок, 14 предупреждений —
`grounding` ×4, `import()` ×3, `lattice import`, `--mode` (план); типы без домена: `std/alias-candidate` (D03),
`core/commit` (D05), `core/holds` (D01), `core/namespace` (D06), `std/setup` (D10), `core/trust-policy.candidates` (D07).

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0–R6 | подготовка; волны 0–5 (T-1…-16; ADR-1…29; PF-01…06) — журналы `sessions/` | ✓ |
| D01–D02 | 10-kernel (две сессии) + 02-glossary | → |
| D03 | 11-identity-grain | |
| D04 | 13-rules | |
| D05 | 12-ledger | |
| D06 | 15-catalog | |
| D07 | 14-trust | |
| D08 | 20-lens | |
| D09 | 21-compose | |
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
решают брифы D) · `lint-baseline.txt` · `sessions/` — журналы (S0, R1–R6) · `briefs/` — брифы (R1–R6 — образцы режима R) ·
`design/adr/README.md` — индекс решений (ADR-1…29).
