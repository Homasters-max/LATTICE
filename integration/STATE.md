# STATE — внедрение архитектурного разбора 2026-09-29 в design v0.5.1 → v0.6

Навык `/arch-integrate`. Новая сессия читает только этот файл. После сессии — обновить и остановиться. Ветка `design/v0.6`; merge в `main` — maintainer, после F.

## Сейчас

- Фаза: D · последняя сессия: R1–R4, 2026-09-29 — ADR-38…ADR-47 (9 принято, 46 отложено), глоссарий
- Следующая: **D01** — 10-kernel + 11-identity-grain; входы — `ledger.mjs show --file 10-kernel`, `--file 11-identity`
- Ритм (S0-R Q0): сессии подряд без остановок до F; находки C/F, следующие из принятого, правятся без вопроса
- Блокеры: нет. Срезы кода: Change S0 — после R2 и проходов 04 / 22 / 30; Change S1 — после R1, R3 (ADR-40, ADR-43 блокируют S1) и проходов 10 / 11 / 12 / 13
- Правки навыка: S0 — `ledger.mjs set … --wave n` (волна по карте сессий, когда вывод из «блокирует» среза не совпадает); журнал X-n (`research/kb-findings.md`) в проекте удалён — правки навыка пишутся здесь и в журнале сессии

## Реестр

PASS integration/ledger.md · строк 85 · открыт 56 · решён 29 · внесён 0 · сверен 0. Последний N — N-137.

## Очередь сессий

| ID | Что | Статус |
|---|---|---|
| S0 | подготовка: ветка, тег `design-v0.5.1`, реестр, lint, ownership | ✓ |
| R1–R4 | волны 1–4 одним раундом: ADR-38…ADR-47, П-33…П-37, N-136, N-137 | ✓ |
| D01 | 10-kernel + 11-identity-grain | → |
| D02 | 12-ledger | |
| D03 | 13-rules | |
| D04 | 14-trust + 15-catalog | |
| D05 | 22-run | |
| D06 | 20-lens + 21-compose | |
| D07 | 23-bench + 30-adapters | |
| D08 | 04-architecture + 05-slices + 02-glossary + README | |
| C1, C2 | сверка; карта владения → 04 §8; CHANGELOG-v0.6; тег `design-v0.6-rc` | |
| F | финальное чтение; тег `design-v0.6`; `integration/` удалить | |

## Где что

`integration/`: отчёт `architecture-review-2026-09-29.md` · разложение `review-changes.md` · реестр `ledger.md` · `ownership.md` · `renames.md` · `lint-baseline.txt` · журналы `sessions/` · брифы `briefs/` · аудит `audit/`; ADR — `design/adr/README.md` (новые — с ADR-38).
