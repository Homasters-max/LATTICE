# Переименования v0.5.1 → v0.6

Имена, которые исчезают из дизайна, и решения, которые их убрали.

| Было | Стало | Решение | Статус |
|---|---|---|---|
| `commit(rows, by, key?)` | `commit(batch)` — вход `author` / `copy` / `genesis` | ADR-38 | действует |
| `validate(rows, state)` | шаг коммита по реестру проверок | ADR-38 | действует |
| `source.load()` | `Loader.load()` — порт загрузки хоста | ADR-24 · AD-20 | действует |
| `queue(namespace)` | `pending(view, namespace)` доменов, сборка в `cli/` | CT-17 · AD-22 | действует |
| `pending(namespace, seq)` | `pending(view, namespace)` (identity — `+ budget`) | AD-22 · финальное чтение F | действует |
| `Runtime.store` | `Runtime.ledger` — открытый журнал (`commit`, `view(seq)`) | AD-24 · ADR-41 «уточнено F» | действует |
