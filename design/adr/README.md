# Решения (ADR) — design v0.4

Номер файла = номер кандидата из итогов разбора (`research/analysis/arch-changes.md`, «Развилки»: кандидаты 1…23);
новые — с 24. Отклонённый или отложенный кандидат тоже получает файл (статус и довод «почему нет»).

| ADR | Решение | Статус | Затрагивает | Волна | Сессия |
|---|---|---|---|---|---|
| [24](0024-port-contract-at-consumer.md) | контракт порта — у домена-потребителя; `30-adapters` — реализации | принято | 30-adapters, 12-ledger, 20-lens, 21-compose, 22-run, 15-catalog, 04-architecture | — | S0 |
| [1](0001-canonical-form-jcs.md) | каноническая форма — JCS целиком, NFC на входе | принято | 10-kernel, 12-ledger, 02-glossary | 0 | R1 |
| [3](0003-execution-segments.md) | события исполнения — сегменты журнала со сроком, истекают целиком | принято | 10-kernel, 12-ledger, 22-run | 0 | R1 |
| [19](0019-run-commit-boundary.md) | один коммит на прогон (короткий, без `exec`); `materialize` в двух режимах; агент — перезапуск после `lattice answer`; триггер (б) — `exec` / долгие прогоны | принято | 22-run, 21-compose, 12-ledger, 30-adapters | 0 | R1 |
| [6](0006-control-fact-writers.md) | `writers` и `inForce` в типе факта; `owner` проверяет `writers` при коммите; «текущий» — последний по `seq` среди допущенных | принято | 10-kernel, 15-catalog, 13-rules, 14-trust, 11-identity-grain, 23-bench, 00-vision, 05-slices | 1 | R2 |
| [25](0025-participant-registry.md) | реестр участников: `core/actor` пишет владелец, декларант — `core/grant {declare}`, сессию открывает хост, вне реестра = `agent`; `owner` — участник или группа | принято | 14-trust, 15-catalog, 22-run, 30-adapters | 1 | R2 |
| [14](0014-trust-axis-basis.md) | ось `grounding` → `basis` | принято | 02-glossary, 14-trust, 12-ledger, 20-lens | 1 | R2 |
| [5](0005-assert-latest-in-trust.md) | утверждения копятся; «последнее» выбирает 14-trust по `via ?? by`, для владельца и декларанта — по участнику; поле `via` | принято | 10-kernel, 14-trust, 22-run | 1 | R2 |
| [26](0026-independence-groups.md) | группа независимости: участник для `human`/`machine`, `(kind, model)` для `agent`; `observed` — ≥ N групп, ≥ 1 не из группы автора | принято | 14-trust, 20-lens, 22-run, 23-bench, 05-slices, 01-first-run | 1 | R2 |
| [9](0009-schema-field-as-rule.md) | схема тела — поле `schema`, компилируется в правило с уровнем (`hard` по умолчанию для `core`/`std`) | принято | 10-kernel, 13-rules | 1 | R3 |
| [12](0012-extends-inherits-contract.md) | `extends` наследует правила, роли, `writers`/`inForce` только с сужением; карточка — нет; совместимость Р-4; закрытость по цепочке | принято | 10-kernel, 13-rules, 20-lens | 1 | R3 |
| [2](0002-same-body-new-type-version.md) | то же тело под `type@n+1` — новая ревизия; no-op по `(type@n, hash)` | принято | 10-kernel, 12-ledger, 11-identity-grain, 15-catalog, 05-slices | 1 | R3 |
| [8](0008-alias-candidate-type.md) | кандидат в алиас — `std/alias-candidate`; `core/alias` — подтверждение владельца | принято | 11-identity-grain, 14-trust, 21-compose, 30-adapters, 01-first-run, 12-ledger | 1 | R3 |
| [27](0027-grain-scope.md) | область зерна — пространство автора; `grain_scope: store` для справочников `std` | принято | 11-identity-grain, 12-ledger, 10-kernel, 13-rules | 1 | R3 |
| [7](0007-std-regrain-by-namespace.md) | смена зерна `std`-типа — перезерновка по пространствам с планами владельцев; принцип до первой смены | принято | 11-identity-grain, 15-catalog | 1 | R3 |
