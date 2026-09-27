# 22. run — конвейер, исполнение, вердикт, обучение

**Назначение.** Исполнить конвейер (хранится в LATTICE), выдать результат потребителю, принять вердикт и превратить
его в факты и утверждения — замкнуть цикл.

**Зависит от:** все домены выше; порты `exec`, `composer`, `judge`, `source`. **Используют:** bench, CLI, адаптеры
проектов.

## Модель

### 1. Конвейер — составная способность в LATTICE

```json
{ "id": "std/pipeline.solve", "type": "std/pipeline@1", "version": 1,
  "body": {
    "title": "Решить задачу из блоков LATTICE",
    "input": {"$ref": "std/ctx@1"}, "output": {"$ref": "std/ctx@1"},
    "stages": [
      { "name": "intake",    "cap": {"$ref": "std/stage.intake@1"} },
      { "name": "frame",     "cap": {"$ref": "std/stage.frame@1"}, "params": {"max_needs": 5} },
      { "name": "normalize", "cap": {"$ref": "std/stage.normalize@1"} },
      { "name": "lexicon",   "cap": {"$ref": "std/stage.lexicon@1"} },
      { "name": "recall",    "cap": {"$ref": "std/stage.recall@1"}, "params": {"same_hi": 0.85, "same_lo": 0.5} },
      { "name": "id-lookup", "cap": {"$ref": "std/stage.id-lookup@1"} },
      { "name": "pool",      "cap": {"$ref": "std/stage.pool@1"}, "params": {"pool_max": 200} },
      { "name": "bm25",      "cap": {"$ref": "std/stage.bm25@1"} },
      { "name": "judge",     "cap": {"$ref": "std/stage.judge@1"} },
      { "name": "fuse",      "cap": {"$ref": "std/stage.fuse@1"}, "params": {"mode": "linear", "bm25_weight": 0.3} },
      { "name": "trust",     "cap": {"$ref": "std/stage.trust@1"} },
      { "name": "threshold", "cap": {"$ref": "std/stage.threshold@1"}, "params": {"no_match": 0.6} },
      { "name": "cut",       "cap": {"$ref": "std/stage.cut@1"}, "params": {"k": 20} },
      { "name": "select",    "cap": {"$ref": "std/stage.select@1"}, "params": {"max_members": 7} },
      { "name": "self-search","cap": {"$ref": "std/stage.self-search@1"} },
      { "name": "check",     "cap": {"$ref": "std/stage.check@1"} },
      { "name": "deliver",   "cap": {"$ref": "std/stage.deliver@1"} }
    ] } }
```

- Все ссылки закреплены (`refs: pin`, CT-06). Замена стадии или параметра = **новая версия конвейера**; она проходит
  регрессию стенда до того, как проект её закрепит ([23](23-bench.md)).
- Проект закрепляет конвейер в конфигурации: `"pipeline": "std/pipeline.solve@1"` или свой `warrant/pipeline.…@n`.
- Линейный список стадий в первой версии; ветвление — через `ctx.needs[i].done` (стадия пропускает готовые
  потребности).

### 2. Контекст конвейера (`std/ctx`)

```ts
type Ctx = {
  request: { task: string; scope?: Ref; actor: Ref; session: Ref; budget?: { usd?: number; ms?: number } }
  needs: Array<{
    need?: Ref; text: string; norm?: string; scope?: Ref; terms?: Ref[]; key?: string
    recall?: { solution: Ref; snapshot: Id; status: 'fresh' | 'stale' | 'broken' }
    pool?: Id; scores?: Record<Id, { bm25?: number; judge?: number; fused?: number }>
    candidates?: Candidate[]; outcome?: 'served' | 'candidates' | 'no-match'
    selection?: Selection; findings?: Finding[]; done?: boolean
  }>
  pack?: Pack
  trace: Array<{ stage: string; ms: number; usd?: number; note?: string }>
}
```

Стадия — чистая функция `(ctx, deps) → ctx`; внешние вызовы — только через порты из `deps`. Стадия не знает о
соседях (как в черновике архитектуры поиска).

### 3. Runtime — интерпретатор

```text
run(pipelineRef, request):
  pipeline = resolve(pipelineRef)                       // закреплённая ревизия
  for stage in pipeline.stages:
      impl = registry[stage.cap.body.impl]              // builtin или адаптер exec
      ctx  = impl(ctx, params, deps)                    // бюджет проверяется после каждой стадии
  commit([execution, measurements…, needs, solutions, facts, snapshots])   // один коммит на прогон
  return ctx.pack
```

- **Реестр реализаций:** `impl: {adapter: "builtin", name: "lens.bm25"}` → функция в коде; `adapter: "exec"` —
  внешняя реализация через порт (позже, для способностей проектов).
- Ошибка стадии → событие вызова с ошибкой, частичные результаты не пишутся.

### 4. Выдача (`deliver`) — пакет

Для знаний пакет — то, что попадает в промпт агента:

```md
## Нормы для задачи: <задача>
### Потребность: Что спасает waiver?  (решение observed, snapshot SN-3fa2…)
- REQ-VER-007 — Waiver спасает только FAIL. Причина: «…». Источник: openspec/specs/verification/spec.md#REQ-VER-007
  Код: src/verify/verdict.ts#attestationAccepted · Тесты: verify.test.ts
### Потребность: …  (нет в каталоге — gap absent)
```

Тексты и ссылки на источник даёт порт `source` проекта. Пакет — также JSON для машин.

### 5. Вердикт

Потребитель отвечает на **каждое выданное решение** в конце использования:

```json
{ "type": "std/verdict@1",
  "body": { "solution": {"$ref": "warrant/SOL-…"}, "snapshot": "#3fa2…", "same_need": true,
            "status": "complete | incomplete | wrong | none",
            "used": ["warrant/REQ-VER-007"], "unused": ["warrant/REQ-VER-003"],
            "add": [{ "ref": "warrant/ADR-0034", "reason": "«…»" }],
            "task_only": ["warrant/ADR-0036"], "note": "…" } }
```

### 6. Обучение — правила «вердикт → факты»

| Вердикт | Диагноз | Что пишется (сессия `learn`, `machine`, основание `derived` от вердикта) |
|---|---|---|
| `same_need: false` | ошибка сопоставления, решение ни при чём | `std/distinct` (эта формулировка ≠ сохранённая потребность); решение не трогается |
| `complete`, всё `used` | подтверждение | утверждение +1 (вес участника-потребителя) на каждое членство |
| `complete`, есть `unused` | возможно лишнее | утверждение −0,3 на членство `unused` |
| `incomplete` + `add` | неполно | факты членства `add` с причиной (основание `inferred`, пока не подтвердят) |
| `wrong` | ошибочно | утверждение −1 на все членства → `contested` → при следующем запросе заново через LENS |
| `task_only` | нужно задаче, не потребности | в решение не входит; текст → кандидат в новую потребность (подсказка) |
| член `via: self-search` | промах LENS | кандидат в ловушку стенда; подсказка блоку из текста потребности (`inferred`) |

Калибровка (пороги — политика доверия, [14](14-trust.md) п. 4):

- **Асимметрия:** добавить — один вердикт с причиной; удалить — член `unused` в ≥ 3 разных сессиях и ни разу не
  `used` → факт членства `value: false`.
- **Раскачка:** член добавлен и удалён ≥ 2 раз → `contested` → находка владельцу.
- **Граница:** после добавления > 7 → не добавлять, находка «разбить потребность».
- **Устаревание — не калибровка:** изменилась версия члена → `recheck`; отвечает — новый snapshot, доверие не
  меняется; не отвечает — обычный путь `incomplete`.

### 7. Воспроизведение

Закреплённый конвейер + кэш judge (по ключу оценки) + кэш composer (по `prompt_hash` + входу) → повторный прогон
того же запроса даёт побайтно тот же пакет. Это проверка регрессии и аудита (E6 первого запуска).

## Операции (CLI / API)

| Операция | Вход → выход |
|---|---|
| `solve(task, scope?)` | → пакет + события |
| `verdict(json)` | → факты и утверждения |
| `replay(execution)` | → пакет; сравнение с исходным |
| `explain(solution)` | → история решения: вердикты, доверие, snapshot'ы |

## Решения

| ID | Решение | Почему |
|---|---|---|
| RN-01 | Конвейер — объект LATTICE, стадии — закреплённые способности | самоописание; замена стадии — версия со стендом |
| RN-02 | Стадия — чистая функция `(ctx) → ctx`, внешнее — только через порты | тестируемость, воспроизводимость |
| RN-03 | Один коммит на прогон | прогон виден целиком или не виден вовсе |
| RN-04 | Вердикт — на каждое выданное решение, типизированный диагноз | обучение различает ошибки |
| RN-05 | Правила обучения — данные политики; асимметрия добавления и удаления | нехватка дороже лишнего; ошибку сложно закрепить |
| RN-06 | Вызов — одно событие на прогон, трасса стадий — в его теле; оценки judge — отдельные события | объём журнала против аудита |
| RN-07 | Воспроизведение через кэши judge и composer | регрессия и аудит без повторной оплаты |

## Вопросы для grilling

1. **Вердикт не пришёл** (агент забыл) — считать «unknown» или неявным `complete`? Рекомендация: `unknown` — ничего не
   менять; доля пропущенных вердиктов — метрика.
2. **Вес вердикта агента** — как у любого агента (0,5)? Рекомендация: да; `declared` — только человек.
3. **Способности проектов (`exec`)** — в первом прогоне не исполняются? Рекомендация: да, первый прогон — знания +
   builtin-стадии; `exec` — после.

## Вне объёма

- Параллельное исполнение стадий, распределённый runtime.
