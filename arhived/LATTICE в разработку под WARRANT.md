# LATTICE — Development Readiness & Bootstrap Planning

## Цель

Подготовить **системный план перевода LATTICE из design в реальную разработку** под существующий governance-процесс WARRANT.

Не приступать к реализации автоматически. Сначала определить, **что именно должно быть зафиксировано, спроектировано и проверено, чтобы разработку можно было безопасно запустить и затем развивать саму LATTICE с помощью LATTICE**.

Главный принцип:

> Сначала минимально достаточное, самодостаточное и проверяемое ядро LATTICE; затем — развитие LATTICE через это ядро.

Не расширять систему ради полноты. Не превращать план в список мелких задач. Ищи минимальный набор решений, который создаёт рабочий фундамент для дальнейшего развития.

---

## 1. Проведи Development Readiness Review

Проанализируй текущий `design/` как архитектурный baseline и определи:

* что уже достаточно определено для реализации;
* что остаётся архитектурно неразрешённым;
* какие решения необходимо принять **до первого кода**;
* какие решения можно отложить;
* какие части design являются фундаментом, а какие — первым consumer/use case;
* какие assumptions нельзя оставлять неявными;
* какие документы, контракты, схемы и ADR отсутствуют.

Не переписывай существующий design без необходимости. Отделяй:

```text
FIXED
DECISION NEEDED
IMPLEMENTATION DETAIL
DEFERRED
RISK / UNKNOWN
```

---

## 2. Определи Minimal LATTICE Kernel

Сформулируй **минимально достаточное ядро**, без которого LATTICE перестаёт быть LATTICE.

Определи:

* canonical entities;
* identity и grain;
* версии;
* ledger / event model;
* canonical state;
* projections;
* provenance;
* ownership;
* trust boundary;
* минимальные rules;
* read/write boundaries;
* extension points;
* recovery/replay;
* compatibility/evolution mechanism.

Для каждого элемента ответь:

> Почему он относится к kernel, а не к consumer?

Отдельно сформулируй:

### Kernel MUST

Что обязано существовать в первой реализации.

### Kernel MUST NOT

Что сознательно не входит в ядро.

### Extension points

Что можно добавлять без изменения семантики kernel.

### First consumer

Какой минимальный consumer позволит доказать, что kernel реально работает.

Цель — получить **маленькое, но замкнутое ядро**, а не урезанную версию всей LATTICE.

---

## 3. Спроектируй архитектуру хранения

Определи storage architecture до начала реализации.

Рассмотри и выбери минимально достаточную модель:

```text
canonical ledger
     ↓
materialized state / projections
     ↓
indexes
     ↓
search / retrieval
```

Зафиксируй:

* что является SSOT;
* что является projection;
* что можно пересоздать;
* что нельзя потерять;
* формат canonical records/events;
* identity/version model;
* append/update/delete semantics;
* transactions / atomicity;
* concurrency/OCC, если требуется;
* idempotency;
* replay;
* migration/upcasting;
* snapshot strategy;
* indexing;
* backup/recovery;
* local development storage;
* production storage boundary;
* когда и почему storage можно заменить.

Не выбирать технологию только по удобству MVP. Но и не проектировать distributed infrastructure без необходимости.

Главный критерий:

> Можно ли удалить все derived data и восстановить рабочее состояние из canonical source?

---

## 4. Определи технологический стек

Предложи конкретный минимальный стек и объясни только архитектурно значимые решения:

* язык;
* runtime;
* package/build manager;
* CLI;
* storage;
* serialization/schema;
* migrations;
* test framework;
* lint/format/type checking;
* observability/logging;
* CI;
* local development;
* optional search/index layer;
* optional LLM/Jev integration boundary.

Для каждого выбора:

```text
chosen
alternative
reason
lock-in risk
```

Не добавляй технологии «на будущее».

---

## 5. Определи нормативную модель разработки

Сформируй минимальный набор документов, которые должны стать **normative source**, а не просто документацией.

Минимально проверить необходимость:

```text
VISION / SCOPE
ARCHITECTURE
KERNEL CONTRACT
DATA / STORAGE MODEL
IDENTITY & VERSIONING
EVENT / LEDGER CONTRACT
TRUST / PROVENANCE MODEL
API / PORT CONTRACT
DEVELOPMENT RULES
TEST STRATEGY
SECURITY / THREAT MODEL
EVOLUTION / MIGRATION POLICY
ADR INDEX
```

Для каждого документа определить:

* зачем он нужен;
* что является его authority;
* что в нём фиксируется;
* что туда не следует помещать;
* кто/что имеет право его менять.

Не создавать документы только ради количества.

---

## 6. Спроектируй вертикальные срезы

Разбей запуск разработки не по техническим слоям:

```text
storage
then API
then graph
then LENS
...
```

а по **вертикальным, проверяемым capability slices**.

Каждый slice должен по возможности проходить через реальное ядро:

```text
input
→ kernel
→ canonical state
→ projection/read
→ observable result
→ tests
```

Определи:

* какие slices являются foundation;
* какие можно разрабатывать параллельно;
* какие имеют dependency;
* какие можно отложить;
* какой slice является первым end-to-end proof.

Сделай dependency graph и предложи **несколько независимых workstreams**, чтобы разные агенты/разработчики могли работать параллельно без конфликтов.

---

## 7. Определи Phase 0 → First Release

Предложи компактную последовательность:

### Phase 0 — Architecture Lock

Зафиксировать только решения, без которых безопасная реализация невозможна.

### Phase 1 — Kernel

Минимальный работающий LATTICE kernel.

### Phase 2 — First Vertical Slice

Первый полностью работающий consumer.

### Phase 3 — Development on LATTICE

Начать использовать сам LATTICE для хранения/поиска/связывания знаний, необходимых для дальнейшей разработки.

### Phase 4 — Hardening

Recovery, migration, security, performance, observability, failure cases.

### Phase 5 — Second Consumer

Принципиально другой сценарий, который проверяет универсальность kernel.

Не расписывай сотни задач. Для каждой фазы дай:

```text
purpose
architectural outcome
entry criteria
exit criteria
parallel work
blocking dependencies
```

---

## 8. Особо спроектируй «LATTICE развивается на LATTICE»

Это ключевая цель проекта.

Определи минимальный механизм, позволяющий LATTICE хранить собственные:

* архитектурные решения;
* requirements;
* capabilities;
* ADR;
* design knowledge;
* implementation knowledge;
* test evidence;
* known limitations;
* provenance;
* relationships;
* historical decisions.

При этом не допустить рекурсивного самообмана:

> LATTICE не должна считать собственные прошлые решения доказательством их истинности только потому, что они были ранее записаны в LATTICE.

Раздели:

```text
LATTICE knowledge
LATTICE source/design
LATTICE implementation
LATTICE evidence
LATTICE learning
```

и определи, что из этого является authoritative.

Цель первого self-hosting этапа:

> LATTICE должна быть достаточно сильной, чтобы помогать проектировать и развивать следующую версию самой себя, но не настолько замкнутой, чтобы её собственные выводы становились единственным источником истины.

---

## 9. Определи требования к качеству разработки

Сформулируй engineering contract:

* типизация;
* форматирование;
* lint;
* unit/integration/vertical tests;
* deterministic tests;
* contract tests;
* migration tests;
* replay/recovery tests;
* property/invariant tests там, где они действительно полезны;
* test isolation;
* fixture strategy;
* CI gates;
* code review;
* observability;
* backward compatibility;
* security boundaries.

Главный принцип:

> Проверять прежде всего архитектурные инварианты, а не количество строк покрытия.

---

## 10. Определи parallel development model

Для каждого vertical slice определить:

```text
owner
dependencies
contracts consumed
contracts produced
files / areas
test boundary
integration point
```

Параллельная работа допустима только если:

> два workstream могут развиваться независимо, опираясь на заранее зафиксированный контракт.

Отдельно выяви места, где параллельная работа создаст скрытый конфликт в:

* schema;
* identity;
* storage;
* kernel;
* public contracts;
* normative docs.

---

## 11. Проведи Architecture-to-Implementation Traceability

Для каждого фундаментального решения показать цепочку:

```text
design principle
→ normative rule
→ contract
→ implementation boundary
→ test / invariant
```

Если элемент существует только в документации и не имеет enforcement/test — отметить это.

Если implementation содержит семантику, которой нет в design — отметить как architectural drift.

---

## 12. Определи Deferred Decisions

Создай отдельную карту:

```text
NOW
LATER
ONLY WHEN NEEDED
DO NOT BUILD
```

Особенно для:

* distributed storage;
* advanced graph;
* embeddings;
* complex trust algorithms;
* automatic learning;
* multi-agent coordination;
* advanced Jev integration;
* external knowledge;
* production-scale optimization.

Цель — защитить kernel от преждевременного усложнения.

---

## 13. Финальный результат

Подготовь не backlog, а **Development Architecture Package**, состоящий из:

1. Executive architecture decision.
2. Definition of Minimal LATTICE Kernel.
3. Kernel boundaries and extension points.
4. Storage architecture.
5. Technology stack.
6. Normative documentation map.
7. Development/quality contract.
8. Vertical-slice architecture.
9. Phase/dependency map.
10. Parallel workstreams.
11. Self-hosting / «LATTICE develops LATTICE» model.
12. Risks and unresolved decisions.
13. Deferred decisions.
14. First-release acceptance criteria.
15. Recommended OpenSpec/WARRANT change decomposition.

---

## Критерий хорошего результата

После выполнения плана должно быть возможно ответить «да» на следующие вопросы:

* Можно начать реализацию без архитектурных догадок?
* Понятно, что является настоящим kernel?
* Kernel можно реализовать независимо от Jev/LLM/конкретного consumer?
* Понятно, где находится SSOT?
* Понятно, как хранится и восстанавливается состояние?
* Понятно, какие части можно разрабатывать параллельно?
* Каждый vertical slice даёт работающий результат?
* Понятно, какие решения нормативны?
* Понятно, что намеренно не строится?
* Первый consumer доказывает полезность kernel?
* LATTICE может начать использоваться для собственной разработки?
* Второй consumer сможет проверить универсальность kernel без его переписывания?

### Главное ограничение

**Не проектируй «идеальную LATTICE».**

Проектируй:

> **минимальную LATTICE, которая уже обладает правильной фундаментальной семантикой, может быть проверена end-to-end и способна стать substrate для дальнейшего развития самой LATTICE.**

Если для универсальности требуется добавить новый механизм — сначала проверь, нельзя ли выразить требование существующими identity, ledger, provenance, rules, projections и extension points.

**Минимальность ядра важнее полноты первого релиза.**
