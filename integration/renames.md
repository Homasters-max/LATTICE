# Переименования v0.5.1 → v0.6

Имена, которые исчезают из дизайна, и решения, которые их убрали.

| Было | Стало | Решение | Статус |
|---|---|---|---|
| `commit(rows, by, key?)` | `commit(batch)` — вход `author` / `copy` / `genesis` | ADR-38 | план |
| `validate(rows, state)` | шаг коммита по реестру проверок | ADR-38 | план |
| `wire.ts` как описание корня | `assemble(config, env, store)` в `src/cli/wire.ts` | ADR-41 | план |
