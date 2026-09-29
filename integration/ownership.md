# Карта владения — design v0.6 (черновик S0)

Каждое понятие определено в одном файле; остальные ссылаются на владельца. Действующая карта — [`design/04-architecture.md` §8](../design/04-architecture.md); здесь — только понятия, которые v0.6 вводит или у которых меняется владелец. Владелец — план по рекомендации отчёта; окончательно — после решения R-сессии (столбец «Решение»). В фазе C строки переезжают в 04 §8.

| Понятие | Вид | Владелец (файл) | Определение (адрес) | Используют | Решение |
|---|---|---|---|---|---|
| `commit(batch)`, пакет `author` / `copy` / `genesis` | операция, тип | 12-ledger | `design/domains/12-ledger.md#2. Коммит — всё или ничего` | 10-kernel, 11-identity-grain, 13-rules, 15-catalog, 30-adapters | ADR-38 (план) |
| намерения `ensure` / `merge` / `split` | поле пакета | 11-identity-grain | `design/domains/11-identity-grain.md` | 12-ledger | ADR-38 (план) |
| реестр проверок `{name, scope, phase, appliesTo}` | модуль | 13-rules | `design/domains/13-rules.md#2. Проверки ядра и примитивы (код ядра)` | 12-ledger | ADR-38 (план) |
| `CheckView` | порт (чтение) | 13-rules | `design/domains/13-rules.md` | 12-ledger (адаптер `overlay`), 04-architecture | ADR-39 (план) |
| `overlay(ix, rows)` | адаптер | 12-ledger | `design/domains/12-ledger.md#3. Индекс — вычисляемое состояние` | 13-rules | ADR-39 (план) |
| `authority`: `principal`, `mayWrite` | проекция ядра | 10-kernel | `design/domains/10-kernel.md` | 13-rules, 15-catalog, 04-architecture | ADR-40 (план) |
| `classify(session@seq)` | операция | 14-trust | `design/domains/14-trust.md` | 20-lens, 22-run, 23-bench | ADR-40 (план) |
| `purpose` — поле и закрытый перечень значений | поле | 14-trust (поле) · 30-adapters (перечень, AD-15) — два места | `design/04-architecture.md#8. Карта владения` | 13-rules, 20-lens, 22-run, 23-bench | N-136 → R3 |
| `assemble(config, env, store)` | модуль | 30-adapters | `design/domains/30-adapters.md` | 04-architecture, 22-run | ADR-41 (план) |
| `Progress` | порт | 22-run | `design/domains/22-run.md` | 30-adapters | ADR-41 (план) |
| манифест кода (`CodeManifest`) | артефакт сборки | 30-adapters | `design/domains/30-adapters.md` | 22-run, 23-bench | ADR-42 (план) |
| `run/tuple`: `capture`, `startRefusals`, `matches` | модуль | 22-run | `design/domains/22-run.md` | 23-bench | ADR-42 (план) |
| `countedRun(view, tuple)` (T139) | функция ядра | 13-rules | `design/domains/13-rules.md` | 22-run, 23-bench | ADR-42 (план) |
| `kernel-v1` — точка входа замороженного ядра | модуль | 04-architecture | `design/04-architecture.md#1. Слои` | 10-kernel, 12-ledger, 13-rules | ADR-43 (план) |
| `Recording`, `recorded(execution)` | обёртка порта, адаптер | 22-run | `design/domains/22-run.md` | 20-lens, 30-adapters | ADR-44 (R4) |
| `lens.retrieve`, `Scorer` | операция, шов | 20-lens | `design/domains/20-lens.md` | 22-run | ADR-45 (R4) |
| `CalibratedThreshold` | значение | 13-rules | `design/domains/13-rules.md#3. Способности и контракты` | 20-lens, 21-compose, 22-run | ADR-45 (R4) |
| `solveNeed`, `ClosedWorld` | операция, модуль | 21-compose | `design/domains/21-compose.md` | 22-run | ADR-46 (R4) |
| `inForce(fact)`, `standing(target)` | операция | 14-trust | `design/domains/14-trust.md` | 10-kernel, 20-lens | ADR-47 (R4) |
| `Loader` / `Source` | порт | 30-adapters (`Loader`) · 21-compose (`Source`) | `design/domains/21-compose.md` | 22-run | 30-adapters/И-105 (R4) |
