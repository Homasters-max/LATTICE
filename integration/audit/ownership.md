# Аудит C1 — владение понятиями

Разрез: каждое понятие v0.6 определено в одном месте, остальные ссылаются; опора — `integration/ownership.md`, `design/04-architecture.md#8. Карта владения`, `design-lint --index`, `grep -rlF` определяющих строк.

| Н | Где | Против чего | Суть | Серьёзность | Предложение |
|---|---|---|---|---|---|

Находок нет.

## Проверено без находок

- Единственное определение (`grep -rlF` по `design/`): `interface CheckView` — только 13-rules; `interface Authority` — 10-kernel; `interface Progress`, `type Pending` — 22-run; `interface Loader` — 30-adapters; `interface Source` — 21-compose; `type Batch` — 12-ledger; `countedRun(view, tuple) →` — 13-rules; `classify`, `inForce`, `standing` в «Операциях» — только 14-trust.
- `assemble(config, env, store) → {deps, refusals}` встречается в 30 §2 (определение с таблицей фаз), 04 §4 (сводка со ссылкой «подробно — 30 §2»), T166 и ADR-41 — глоссарий и ADR по формату повторяют сигнатуру; определение одно.
- `CalibratedThreshold {value…` — 13 §3 (определение), 20 §4, 21 §3 (применение с конкретными `call`, `onMismatch` и ссылкой на T198 / 13 §3), ADR-45.
- `design-lint` без базовой линии: предупреждений «тип без владельца» больше нет (были `std/verdict.execution`, `core/session.purpose` — N-137, N-136); остаются только 19 циклов «Зависит от» из базовой линии v0.5.
- Карта 04 §8: строки всех 20 понятий `integration/ownership.md` перенесены; строка `exec` удалена.
