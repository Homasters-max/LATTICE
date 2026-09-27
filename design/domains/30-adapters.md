# 30. adapters — порты и внешние технологии

**Назначение.** Подключить внешнее (хранилище, технологию оценки, LLM, исходные данные проекта, исполнение) так,
чтобы ядро о нём не знало. Порт — интерфейс в ядре; адаптер — реализация снаружи (гексагональная архитектура).

## Порты

| Порт | Интерфейс | Первый адаптер | Позже |
|---|---|---|---|
| `store` | `append`, `scan`, `lock`, `saveIndex?`, `loadIndex?` ([12](12-ledger.md)) | `store-jsonl` | SQLite, PostgreSQL |
| `judge` | `score`, `verify`, `choose` | `judge-jev` (TypeSafe) | любая модель оценки, локальный классификатор |
| `composer` | `run({kind, input, schema}) → {output, meta}` | `composer-claude` (API), `composer-caller` (агент) | другие LLM |
| `source` | `import()`, `text(ref)`, `locate(ref)`, `grep(q, scope)` | `source-warrant` | другие проекты |
| `exec` | `invoke(impl, input) → output` | — (builtin-реестр в коде) | внешние способности |
| `clock`, `ids` | `now()`, `ulid()` | системные | фиксированные — для тестов и воспроизведения |

```ts
interface Judge {
  score(r: { state: Json; query: string; items: { id: Id; text: string }[] }): Promise<Scored>
  verify(r: { state: Json; statements: string[] }): Promise<{ p: number[]; meta: Meta }>
  choose(r: { state: Json; query: string; options: { id: Id; text: string }[] }): Promise<Chosen>
}
type Meta = { adapter: string; model: string; promptHash: string; stateHash: string; usd: number; ms: number }

interface Composer {
  run<T>(t: { kind: 'frame' | 'confirm-same' | 'select' | 'recheck' | 'self-search';
             input: Json; schema: JsonSchema }): Promise<{ output: T; meta: Meta }>
}

interface Source {
  import(): AsyncIterable<RevisionInput>          // объекты проекта для первичной загрузки и обновления
  text(ref: Ref): Promise<string>                  // полный текст блока для пакета и self-search
  locate(ref: Ref): Promise<{ doc?: string; code?: string[]; tests?: string[] }>
  grep(q: string, scope: Ref): Promise<Ref[]>      // поиск по тексту блоков области (self-search)
}
```

## Адаптеры

### `store-jsonl`

- Каталог данных проекта `.lattice/`: `ledger.jsonl`, `index.json` (кэш), `cache/judge/`, `cache/composer/`,
  `runs/` (отчёты).
- Замок — файл `.lattice/lock`. Запись — дописывание с `fsync`.

### `judge-jev` — технология оценки TypeSafe

- Отображение вызовов: `score` → оценка релевантности каждой карточки по шкале; `verify` → вопрос «истинно ли»;
  `choose` → выбор из вариантов. Вопросы в одном запросе независимы и идут параллельно.
- `state` — словарь области и описание, один раз на запрос.
- Кэш по ключу оценки ([20](20-lens.md) п. 5); ключ API — из окружения, в журнал не пишется.
- Версия модели и шаблона вопроса → `Meta` → тело события `std/measurement`.
- Исходные замеры (черновики): ~$0,002 и ~1 с на вопрос при пуле ~200 карточек.

### `composer-claude` и `composer-caller`

- `composer-claude`: вызов модели Claude с JSON-схемой выхода; промпт стадии — из `params` стадии в LATTICE;
  кэш по `prompt_hash` + входу; модель — в конфигурации проекта.
- `composer-caller`: для работы внутри агента — LATTICE возвращает задание (JSON), вызывающий агент отвечает
  командой. Отдельного вызова модели нет.
- Выход всегда проверяется схемой; невалидный выход — ошибка стадии, не «лучшее, что получилось».

### `source-warrant` — первый проект

- **Импорт знаний:** нормы WARRANT → `warrant/<внешний ID>` (`REQ-…`, `SCN-…`, `ADR-…#п`, `TERM-…`), тип
  `warrant/norm` (расширяет `std/knowledge`); тело — `title`, `summary`, `refs` (документ, код, тесты).
  - нормы, разобранные парсером из структуры документов, — автор `machine` → основание `derived`;
  - `summary` и алиасы, написанные LLM (существующие units доменов), — автор `agent` → `inferred`.
- **Домены:** `lifecycle` (`LCY`), `cli-core` (`CLI`) → `std/domain` + членство норм.
- **Словарь:** `docs/02-vocabulary.md` → `std/term` + подсказки.
- **Набор стенда:** вопросы и эталоны → `std/bench-set` (данные — от maintainer'а).
- `text`, `locate`, `grep` — чтение файлов репозитория WARRANT; ссылки — ID, путь и строки вычисляются при чтении
  (путь и строки — не identity).

### CLI

```text
lattice init                      создать .lattice/, записать core + std, пространство проекта
lattice import                    source.import() → коммиты
lattice solve "<задача>" [--scope <домен>] [--json]
lattice verdict <файл|json>
lattice lint                      находки soft
lattice regrain <тип> [--plan <файл>]
lattice bench <план> [--mode simulate-consumer]
lattice replay <execution>
lattice rebuild [--check]         пересборка индекса; --check — сравнить побайтно
lattice explain <ref>             история, доверие, потребители
```

## Решения

| ID | Решение | Почему |
|---|---|---|
| AD-01 | Всё внешнее — через порты; ядро не импортирует адаптеры | P10, заменяемость |
| AD-02 | Технология оценки (Jev) — только адаптер `judge-jev` | имя технологии не входит в модель |
| AD-03 | Composer — два адаптера: вызов модели и сам вызывающий агент | автоматический прогон и работа агентов одним кодом |
| AD-04 | Проект подключается одним адаптером `source` + конфигурацией | новый проект — новый адаптер, не правка ядра |
| AD-05 | Выход LLM всегда проверяется схемой | закрытый мир, без «примерно» |
| AD-06 | Секреты — только из окружения, в журнал не пишутся | журнал можно показывать и переносить |

## Вопросы для grilling

1. **Импорт WARRANT:** брать существующие units доменов (370, написаны LLM) как стартовые блоки или разобрать
   нормы заново парсером? Рекомендация: оба — парсер даёт `derived`-скелет (ID, заголовок, место), units дают
   `summary` и алиасы (`inferred`); расхождения — находки.
2. **Модель для `composer-claude`** — фиксировать в конфигурации проекта и в `Meta` каждого вызова? Рекомендация: да.
