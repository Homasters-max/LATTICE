# STATE — внедрение итогов разбора в design v0.3 → v0.4

Навык `/arch-integrate`. Новая сессия читает **только этот файл**, затем — то, на что он указывает. После сессии —
обновить этот файл (≤ 60 строк) и остановиться: следующую сессию начинает пользователь.

## Сейчас

- Фаза: **D** · последняя сессия: **D02** (2026-09-27) — `10-kernel` пройден целиком: «Операции», «Инварианты» (11),
  «Решения» KR-01…KR-18, «Вопросы» (Q-10-1…5 закрыты), «Вне объёма» (`10-kernel.md:207-271`). Решено: порт
  `clock`/`ids` — владелец 12-ledger, операции ядра чистые (`newId(namespace, ulid)`, `revision(input, at)`); резерв
  шифруемых полей — маркер `{"$enc": …}`, v1 отклоняет (T145); `by` — сессия, независимость — группы (ADR-26).
  Журнал `sessions/D02.md`.
- **Следующая: D03 — `11-identity-grain`.** 38 строк реестра (открыт 16) + N-11 (поля `std/domain`, `project`),
  N-16 (split — `core/alias {value: false}`), N-21 (`:44` no-op против `core/holds`, ADR-2). ADR — по
  `grep -ln 11-identity-grain design/adr/*.md`: 2, 6, 7, 8, 13, 27. Бриф — субагент по `prompts/brief.md`, режим «D»;
  интерфейсы выше по течению — только 10-kernel (пройден: §1–§8, KR-01…18).
- Ход D — `reference/phases.md` §D: бриф → раунд 0 (A/C/F) → B/D/E → правка → `set внесён --where` → закрытие.
  `внесён` — только когда пункт внесён целиком; ADR и T — после всех их файлов. Новая ADR — с 30.
- Правки навыка и техники (последние): D02 — длинный текст правки — Write во scratchpad + python-файл, не два
  heredoc в одном Bash (X-54); D01 — `ledger.mjs set … --files "a,b"`; бриф D берёт ADR по `grep -ln <файл>
  design/adr/*.md` (X-52); вставка в последнюю ячейку — до `|` (X-53); правки md — Python `newline=''` (X-45).

## Реестр (ledger check, итог) · блокеров нет

349 строк: открыт 141 · решён 165 · внесён 43 · сверен 0 · последний N — N-23. Lint: 0 ошибок, 11 предупреждений —
`grounding` ×4, `import()` ×3, `lattice import` (план); типы без домена: `core/commit` (D05), `std/setup` (D10),
`core/trust-policy.candidates` (D07).

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0–R6 | подготовка; волны 0–5 (T-1…-16; ADR-1…29; PF-01…06) — журналы `sessions/` | ✓ |
| D01 | 10-kernel «Модель» + 02-glossary | ✓ |
| D02 | 10-kernel: операции, инварианты, решения, Q-10 | ✓ |
| D03 | 11-identity-grain | → |
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
решают брифы D) · `lint-baseline.txt` · `sessions/` — журналы (S0, R1–R6, D01, D02) · `briefs/` — брифы (R1–R6 — образцы режима R) ·
`design/adr/README.md` — индекс решений (ADR-1…29).
