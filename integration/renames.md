# Переименования v0.3 → v0.4

`план` — старое имя ещё допустимо в файлах, до которых не дошёл проход (lint — предупреждение); `действует` — старое
имя — ошибка lint вне `adr/` и `CHANGELOG`. В фазе C все строки → `действует`. Удалённое без замены — «Стало» = `—`.

| Было | Стало | Решение | Статус |
|---|---|---|---|
| `grounding` | `basis` | ADR-14 | действует |
| `import()` | `load()` | R4 Q11 (порт `source`) | действует |
| `lattice import` | `lattice load` | R4 Q11 | действует |
| `--mode` | поле `mode` плана стенда | R6 Q3 (23-bench/И-1) | действует |
| `sessions` | `groups` (поле `trust()`) | D07 Q4 | действует |
| `observe_sessions` | `observe_groups` | D07 Q4 (следствие) | действует |
| `remove_unused_sessions` | `removal_window` | ADR-20 | действует |
| `score.bm25` (стадия) | `bm25` (`std/stage.bm25`) | D08 Q0 (по 22-run, 13-rules) | действует |
| `score.judge` (стадия) | `judge` (`std/stage.judge`) | D08 Q0 | действует |
| `split: dev` | `subset: dev` (поле стенда, T176) | C2c Q6 (PF Н-13): `split` — T32 | действует |
| `split: test` | `subset: test` | C2c Q6 | действует |
