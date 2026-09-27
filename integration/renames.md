# Переименования v0.3 → v0.4

`план` — старое имя ещё допустимо в файлах, до которых не дошёл проход (lint — предупреждение); `действует` — старое
имя — ошибка lint вне `adr/` и `CHANGELOG`. В фазе C все строки → `действует`. Удалённое без замены — «Стало» = `—`.

| Было | Стало | Решение | Статус |
|---|---|---|---|
| `grounding` | `basis` | ADR-14 | действует |
| `import()` | `load()` | R4 Q11 (порт `source`) | план |
| `lattice import` | `lattice load` | R4 Q11 | план |
| `--mode` | поле `mode` плана стенда | R6 Q3 (23-bench/И-1) | план |
| `sessions` | `groups` (поле `trust()`) | D07 Q4 | действует |
| `observe_sessions` | `observe_groups` | D07 Q4 (следствие) | действует |
| `remove_unused_sessions` | `removal_window` | ADR-20 | действует |
| `score.bm25` (стадия) | `bm25` (`std/stage.bm25`) | D08 Q0 (по 22-run, 13-rules) | действует |
| `score.judge` (стадия) | `judge` (`std/stage.judge`) | D08 Q0 | действует |
