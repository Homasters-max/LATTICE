# STATE — внедрение архитектурного разбора 2026-09-29 в design v0.5.1 → v0.6

Навык `/arch-integrate`. Новая сессия читает только этот файл. Ветка `design/v0.6`, draft PR https://github.com/Homasters-max/LATTICE/pull/34; merge в `main` — maintainer, после F.

## Сейчас

- Фаза: **F** (финальное чтение) · последняя сессия: C1–C2 (2026-09-29) + чтение F (2026-09-30) — два отчёта записаны, **не разобраны**
- Следующая: **F2 — правки по находкам F**; входы — `integration/audit/F-dev.md` (43 находки: блокирует 1, исправить 29, мелочь 13) и `integration/audit/F-gaps.md` (26: исправить 10, мелочь 16). Многие находки совпадают (`mayWrite(row, seq)` в 13 §2 и T191; T194 без `resume`/`reset`; `seq` строк `overlay`).
- Ритм (решение maintainer'а, R1–R4 Q0): сессии подряд без остановок; находки, следующие из принятых ADR, правятся без вопроса; к maintainer'у — только настоящая новая развилка.
- Блокеры: нет. Кандидаты на вопрос maintainer'у в F2 (локальные решения, агент может решить сам и записать доводом): порядок `init` и `signer` первой копии `std` (F-gaps Н7; рекомендация — первую копию подписывает сессия пакета `std/release-<v>`, порядок генезис → `copy std` → самоустановление); команда и `purpose` для `setPolicy` (F-gaps Н17; рекомендация — `lattice policy <policy@n>`, `purpose: policy`, строка в 14 §1).
- Правки навыка: S0 — `ledger.mjs set … --wave n`; журнал X-n (`research/kb-findings.md`) в проекте удалён — правки навыка пишутся здесь и в журнале сессии. F проведено субагентами (свежий контекст) вместо новой сессии — по просьбе maintainer'а «закончить до конца».

## План F2 (в таком порядке)

1. **Блокирует — F-dev Н1:** `fromRows` в rules не может собрать `CheckView` без проекций ledger (матрица 04 §2). Рекомендация: `fromRows(rows) = overlay(пустой индекс, rows).total()` — в ledger рядом с `overlay`; проверкам `examples` вид передаётся аргументом. Правки: 13 §2, «Операции», RL-21, 12 §3, 04 §6, T190, ADR-39 «уточнено F».
2. **Вид проверки — F-gaps Н5, F-dev Н3, Н39:** `CheckView` += `events(type, where?)` (планы, прогоны, метка копии для `countedRun` и гейта) и `referrers`; строки `overlay` — условный `seq = t + 1 + i`; перечень 04 §1.
3. **Ядро и коммит — F-dev Н4–Н10, Н13, Н17, Н21–Н23, Н29–Н31, Н36–Н38, F-gaps Н6, Н16, Н21:** форма ответа `Store.append` (`conflict`/`locked`), замок и часы адаптера, отрезание хвоста (`recovered`), `expect` для v1 → v2, `valueId` / `newId(namespace)`, `ids` и `row` в ответе и нарушениях, реестр секретов на вход коммита, `open()` вход/выход и пустой журнал, `init` — фазы 1–2, S0 — какие шаги коммита, `Runtime` += `ledger`, `namespace`, `deps` без `view`, `Progress` и часы, генезис (что хэшируется, `at`, `key`, `purpose: genesis`), `owner` `appliesTo: author, copy`, тип `Check` и `Violation`, `RevisionInput`, `seq` пустого журнала, секционные строки, JCS-векторы.
4. **Корень сборки и CLI — F-dev Н12, Н17–Н19, Н24–Н28, Н41, Н42, F-gaps Н7, Н17, Н19, Н20, Н24:** схема `config/2`, форма отказа `assemble`, манифест кода (ключ, байты, скрипт), `init` и сессия владельца, `claimed_via: tty` (шов терминала), `os_user`, команда приёмки S1 (`lattice commit`), версия порта, адаптеры часов/ULID, фазы по командам, `run(..., resume?)`, `pending_ttl` у хоста, `setPolicy` — команда.
5. **Тест структуры и ядро — F-dev Н20–Н22:** что разрешено ядру (`node:crypto`, JCS), п. 6 — явный перечень периметра, форма `kernel-v1`.
6. **Мелочи и ссылки:** ADR-42 п. 3 (`matches`), ADR-44 п. 3 (`std/measurement` пишет стадия), T136, T191, T194, 20 §4 `trust` → `standing`, 20/21 ссылки ADR-45, 12 `facts` про `write`, 15 CT-19, 15 §6 `classify`, 21 §1 `bench?`, 21 §8 `Pending` форма, 11 `pending(view, …)`, 00 «Универсальность», `bm25.doc` и `Source`, `Meta.model` при replay, 05 S0/S5 инв. 30:4, 22 `startRefusals` сигнатура, `README` «Статус» (F-gaps Н8).
7. Закрытие F: lint без базовой линии — 0 ошибок; `ledger check --strict`; каждая находка — строка в журнале `integration/sessions/F.md` (исправлено / не находка с доводом); выборка 1/10 реестра уже сделана (8 строк — соответствуют); реестр → `сверен` (`ledger set <ID> "сверен:<вердикт>"`); `design/README.md` «Статус» — v0.6 заморожен снова; тег `design-v0.6`; удалить `integration/` (история — git); README корня — «заморожен, v0.6»; `git push`, PR #34 → Ready for review; maintainer: merge commit.

## Реестр

PASS integration/ledger.md · строк 88 · открыт 0 · решён 9 (все `отложить`) · внесён 79 · сверен 0. Последний N — N-138.

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0 | подготовка: ветка, тег `design-v0.5.1`, реестр, lint, ownership | ✓ |
| R1–R4 | ADR-38…ADR-47 (46 — отложено) | ✓ |
| D01…D08 | доменные проходы 10, 11, 12, 13, 14+15, 22, 20+21, 23+30, 04+05+02 | ✓ |
| C1 | аудит 6 разрезов, 75 находок | ✓ |
| C2 | 75 находок закрыты; CHANGELOG-v0.6; тег `design-v0.6-rc` | ✓ |
| F | чтение: F-dev, F-gaps — отчёты записаны | ✓ |
| F2 | правки по находкам F, тег `design-v0.6`, удаление `integration/`, PR | → |

## Где что

`integration/`: отчёт разбора `architecture-review-2026-09-29.md` · разложение `review-changes.md` · реестр `ledger.md` · `ownership.md` (перенесено в 04 §8) · `renames.md` (все `действует`) · `lint-baseline.txt` · журналы `sessions/` (S0, R1-4, D01–D08, C1-C2) · аудит `audit/` (C1: T-17-18, T-19-26, T-20-21, T-22-24-11, slices-firstrun-vision, ownership; F: F-dev, F-gaps); ADR — `design/adr/README.md` (новые ADR-38…ADR-47); изменения — `design/CHANGELOG-v0.6.md`. Скрипты навыка: `C:/Users/Xiaomi/.claude/skills/arch-integrate/scripts/{ledger,design-lint}.mjs`.
