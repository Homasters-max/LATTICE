# STATE — внедрение итогов разбора в design v0.3 → v0.4

Навык `/arch-integrate`. Новая сессия читает **только этот файл**, затем — то, на что он указывает. После сессии —
обновить этот файл (≤ 60 строк) и остановиться: следующую сессию начинает пользователь.

## Сейчас

- Фаза: **D** · последняя сессия: **D03** (2026-09-27) — `11-identity-grain` пройден целиком (151 → 196 строк):
  область зерна — пространство автора; `std/domain` без `project` (ADR-27 уточнён); `ensure` → `{id, created,
  differs}` без upsert; `split` = `core/alias {value:false}`; канонический — меньший `seq`; `std/distinct {of:{a,b}}`;
  GR-01…GR-15, вопросов нет. Журнал `sessions/D03.md`.
- **Следующая: D04 — `13-rules`** (103 строки). 28 строк реестра (открыт 11) + N-9, N-25 (`regrain-plan` — любое
  изменение зерна; `grain-unique` — в области, форма `{rule, with, diff}`). ADR — `grep -ln 13-rules design/adr/0*.md`:
  2, 6, 9, 10, 11, 12, 17, 18, 27, 29. Бриф — субагент по `prompts/brief.md`, режим «D»; выше по течению — 10-kernel
  (KR-01…18), 11-identity-grain (GR-01…15).
- Ход D — `reference/phases.md` §D: бриф → раунд 0 (A/C/F) → B/D/E → правка → `set внесён --where` → закрытие.
  `внесён` — только когда пункт внесён целиком; ADR и T — после всех их файлов. Новая ADR — с 30.
- Правки навыка и техники (последние): D03 — подстановка в шаблон задания — `assert count==1`, владельцы — из
  `ownership.md`, опоры брифа сверяет главная сессия до раунда (X-55); D02 — длинный текст — Write во scratchpad +
  python-файл (X-54); D01 — `ledger.mjs set … --files "a,b"`; бриф D берёт ADR по `grep -ln` (X-52).

## Реестр (ledger check, итог) · блокеров нет

351 строка: открыт 127 · решён 161 · внесён 63 · сверен 0 · последний N — N-25. Lint: 0 ошибок, 10 предупреждений —
`grounding` ×4, `import()` ×3, `lattice import` (план); типы без домена: `core/commit` (D05), `std/setup` (D10).

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0–R6 | подготовка; волны 0–5 (T-1…-16; ADR-1…29; PF-01…06) — журналы `sessions/` | ✓ |
| D01 | 10-kernel «Модель» + 02-glossary | ✓ |
| D02 | 10-kernel: операции, инварианты, решения, Q-10 | ✓ |
| D03 | 11-identity-grain | ✓ |
| D04 | 13-rules | → |
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
решают брифы D) · `lint-baseline.txt` · `sessions/` — журналы (S0, R1–R6, D01–D03) · `briefs/` — брифы (R1–R6 — образцы режима R) ·
`design/adr/README.md` — индекс решений (ADR-1…29).
