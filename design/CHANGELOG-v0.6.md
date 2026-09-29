# CHANGELOG — design v0.5.1 → v0.6

v0.6 вносит итоги архитектурного разбора `design/` 2026-09-29: 11 кандидатов на углубление модулей и швов и два пункта «исправить до S1». Каталог размораживал maintainer; решения он принимал в сессиях S0 и R1–R4 (все — по рекомендациям разбора). Процесс — навык arch-integrate: S0 → R1–R4 → D01–D08 → C1 (аудит, 75 находок) → C2 → F. Журналы и реестр — в истории git (`integration/` удалён после F). Базовая линия — тег `design-v0.5.1`.

## Решения (ADR)

| ADR | Что | Статус |
|---|---|---|
| [38](adr/0038-commit-batch.md) | коммит — один глубокий модуль: вход `batch` (`author` / `copy` / `genesis`), реестр проверок, намерения `ensure` / `merge` / `split` | принято |
| [39](adr/0039-check-view.md) | вид проверки `CheckView` у rules; адаптеры `overlay` (ledger), `fromRows()` (rules) | принято |
| [40](adr/0040-authority-and-classify.md) | проекция полномочий `authority` в ядре; `classify` в trust — единственный читатель `purpose` вне ядра | принято |
| [41](adr/0041-assemble-and-progress.md) | корень сборки `assemble` с фазами и `Runtime`; порт хода `Progress`; `run() → pack \| pending`; ответ агента привязан к кортежу | принято |
| [42](adr/0042-execution-tuple-module.md) | зерно `code` — модуль из манифеста кода; `countedRun` и `sameTuple` — функции ядра; модуль `run/tuple` | принято |
| [43](adr/0043-kernel-entry-point.md) | точка входа замороженного ядра `kernel-v1` в `src/ledger/kernel-v1.ts`; тест структуры охраняет достижимое | принято |
| [44](adr/0044-replay-recorded-adapters.md) | replay — тот же интерпретатор с записанными адаптерами; обёртка `Recording` | принято |
| [45](adr/0045-calibrated-threshold-and-scorer.md) | `CalibratedThreshold` и `checkCalibration`; шов `Scorer`; LENS одной стадией — отложено до S5 | принято частично |
| [46](adr/0046-solve-need-closed-world.md) | `solveNeed` и `ClosedWorld` | отложено до S6 |
| [47](adr/0047-voice-provenance-in-force.md) | автор голоса `via ?? by`, контракт `via` держит гейт; `inForce`, `standing` в trust; проверка политики — `open()` и каталог | принято |

Уточнены прежние: ADR-25 (`declare` не-человеку — отказ при записи), ADR-35 (место отказа политики, перечень чтений ядра).

## Сквозное

- **Путь записи** (ADR-38, ADR-39): один вход коммита у CLI, импорта, `init`, обновления `std` и перехода ядра; исключения проверок — по виду входа, а не по `key`; перечни «построчные / относительные» — из реестра проверок `{scope, phase, appliesTo}`; отдельной операции `validate` нет; проверки читают `CheckView` из `Revision` ядра. `ref-exists` — один владелец (13 §2), `Clock.now()` — число (разбор, «исправить до S1»).
- **Периметр ядра** (ADR-40, ADR-43): `kernel-v1 = {kernel, genesis, checks, primitives, projections, authority}`; `authority.mayWrite(row, seq)` — одна модель прав, без цикла типов с `CheckView`.
- **Скелет** (ADR-41, ADR-42): `assemble(config, vars, overrides?) → {runtime, refusals}`; рантайм без ввода-вывода; одна таблица отказов старта; манифест кода.
- **Порты LLM** (ADR-44, ADR-45): кэш, LN-18, `Meta.model`, запись вызова — в обёртке `Recording`; адаптеры — транспорт; калибровка — одно значение с объявленным поведением.
- **Доверие** (ADR-40, ADR-47): перечень `purpose` со свойствами — таблица 14 §1; trust не знает типов run; «в силе ли» — `inForce`, правило выдачи — `standing`.
- **Кандидат 11**: catalog — `update`, `migrate`, `transfer`, `setPolicy` + сборка строк; очередь владельца — `cli/` из `pending(namespace, seq)` доменов; порта `exec` нет; `source` разделён на `Source` (стадии) и `Loader` (хост).

## По доменам

- [10-kernel](domains/10-kernel.md): §7 — `authority` (`principal`, `mayWrite`); `inForce` с `{basis}` — trust; §8 — `kernel-v1`, генезис входом `genesis`; KR-03, KR-11, KR-16 уточнены; KR-20, KR-21; инв. 5, 12, 13.
- [11-identity-grain](domains/11-identity-grain.md): «Операции» — чистые функции (`resolveIntent`, `pending`) и намерения; §1 — смысл `grain` / `aliases`; GR-19, GR-20.
- [12-ledger](domains/12-ledger.md): §2 — вход `batch`, шаги по виду входа; §3 — `overlay`, проекции ядра, `authority`, независимость от порядка проекций; §5 — `Batch`, `Intent`, `Clock.now(): number`; `open()` — проверка политики; LG-23…LG-27.
- [13-rules](domains/13-rules.md): §2 — реестр проверок, `CheckView`, `fromRows`, `countedRun`, `sameTuple`, `owner` через `authority`, гейт сверяет `via`; §3 — `calibrated`, `checkCalibration`; «Операции» без отдельной проверки строк; RL-20…RL-24.
- [14-trust](domains/14-trust.md): §1 — таблица `purpose`, `authority.principal`; §2 — автор `via ?? by`, признаки голоса на `seq`; «Операции» — `classify`, `inForce`, `standing`; TR-18…TR-21.
- [15-catalog](domains/15-catalog.md): §1 — обновление `std` входом `copy`; §2 — исполнитель прав `authority`; §6 — очередь из `pending` доменов; «Операции» — `setPolicy`, сборка строк; CT-19, CT-20.
- [20-lens](domains/20-lens.md): шов `Scorer`, `fuse` — единственный создатель кандидатов; `no_match` — `CalibratedThreshold`; кэш в `Recording`; пул и подсказки — через `standing` / `inForce`; LN-19…LN-22; вопрос 1 — LENS одной стадией.
- [21-compose](domains/21-compose.md): пороги `recall` и `min_p` — `CalibratedThreshold`; `Source` без загрузки; `Composer.run` — промпт на входе, `Pending`; ключ кэша composer; `pending` (пробелы); CP-27, CP-28; вопрос 1 — `solveNeed` / `ClosedWorld`.
- [22-run](domains/22-run.md): модуль `run/tuple`, таблица отказов старта; `run(request, session, rt)`; `Stage → Ctx \| Pending`; порт `Progress` (`resume`, `reset`); `Recording`; replay записанными адаптерами; контракт `via`; зерно `code` — модуль; порта `exec` нет; `pending`; RN-38…RN-43.
- [23-bench](domains/23-bench.md): `classify`, `countedRun`, `run/tuple.matches`; `pending` (находки BN-18); BN-21, BN-22.
- [30-adapters](domains/30-adapters.md): `assemble` и `Runtime`; манифест кода; `Recording`, адаптеры — транспорт; порт `Loader`; `progress-fs` / `progress-memory`; `answers/` — владельцы; AD-17…AD-22.
- [04-architecture](04-architecture.md): §1 — `kernel-v1`, перечень чтений ядра; §2 — `CheckView` у rules; §3 п. 6 — периметр ядра; §4 — `assemble`; §6 — раскладка v0.6; §8 — 20+ строк карты; AR-15, AR-16.
- [05-slices](05-slices.md): тесты v0.6 в S0–S9; новые инварианты в таблице срезов; SL-05.
- [01-first-run](01-first-run.md): R7 — порча без удаления членов; E7 и R12 — адаптер проекта в `setup.ports`.
- [00-vision](00-vision.md): абзац «Самоописание» — периметр ядра `kernel-v1`.
- [02-glossary](02-glossary.md): новые T187–T200 (кроме занятых); уточнены T29, T96, T117, T120, T129, T131, T133, T134, T137, T139, T155, T157, T166, T169, T119.

## Переименования

`commit(rows, by, key?)` → `commit(batch)`; `validate(rows, state)` → шаг коммита по реестру проверок; `source.load()` → `Loader.load()`; `queue(namespace)` → `pending(namespace, seq)` доменов.

## Отложено

- LENS одной стадией `retrieve` — 20 «Вопросы для grilling» 1, триггер S5 (ADR-45).
- `solveNeed`, `ClosedWorld` — 21 «Вопросы для grilling» 1, триггер S6 (ADR-46).
- 12 «Вопросы для grilling» 1–2 — как в v0.5.

## Для кода

- Change S0 — после ADR-41, ADR-42 (скелет, кортеж); Change S1 — после ADR-38, ADR-39, ADR-40, ADR-43 (путь записи, периметр ядра).
- REQ-AR-001 (`openspec/specs/architecture`) расширяется периметром ядра (ADR-43) — отдельный Change.
