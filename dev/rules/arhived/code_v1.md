---
id: code
type: dev/guide@1
version: 1
title: Архитектура кода
paths: ["src/**"]
rules:
  - {id: RUL-014, text: "Зависимости — только по матрице design/04-architecture.md §2; интерфейс домена (types.ts) — по правилу интерфейса", force: advisory, status: active, source: "design/04-architecture.md#2", owner: "human:Homasters-max", enforced_by: "тест структуры (с S0)"}
  - {id: RUL-015, text: "Ввод-вывод (node:fs, node:net, fetch, process.env, динамический import) и пакеты dependencies — только в src/adapters/ и src/cli/; adapters/* импортирует только src/cli/wire.ts, адаптеры друг друга не импортируют", force: advisory, status: active, source: "design/04-architecture.md#3", owner: "human:Homasters-max", enforced_by: "тест структуры (с S0)"}
  - {id: RUL-016, text: "Функции ядра чистые; внешнее стадии — только через порты Deps; время и id — порты clock, ids (в тестах фиксированы)", force: advisory, status: active, source: "design/04-architecture.md#7", owner: "human:Homasters-max"}
  - {id: RUL-017, text: "Тип — данные: одна структура Revision, «класс на тип» не заводится; ревизии из журнала заморожены; Id, Ref, Hash — branded types", force: advisory, status: active, source: "design/04-architecture.md#7", owner: "human:Homasters-max"}
  - {id: RUL-018, text: "Всё машинное — канонический JSON (ADR-1); второго формата нет", force: advisory, status: active, source: "design/04-architecture.md#7", owner: "human:Homasters-max"}
  - {id: RUL-019, text: "Имени технологии нет в схеме данных (типы, поля, ID, правила, стадии) — только значением проводки", force: advisory, status: active, source: "design/domains/30-adapters.md#AD-02", owner: "human:Homasters-max"}
  - {id: RUL-020, text: "Секреты — только ссылкой {\"$env\"}; литерал секрета в проводке или .lattice/ — ошибка", force: advisory, status: active, source: "design/domains/30-adapters.md#AD-06", owner: "human:Homasters-max"}
---

# code — Архитектура кода

Как устроен код LATTICE: слои, зависимости, ввод-вывод, данные вместо классов — выжимка `design/04-architecture.md`
для правки `src/**`.

## Область

`src/**`. Источник — `design/04-architecture.md` §1–7 и решения AR-01…AR-14, AD-01…AD-16; при расхождении прав
`design/`, правило исправляется. Стек — AR-03 (TypeScript, Node ESM, `node:test`, без фреймворков).

## Проверка

RUL-014, RUL-015 — тест структуры (T169, с S0). Остальные — review. Доставка при правке `src/**` — WARRANT rule с
`paths` (следующий factory-change); до того — сборка контекста по README.
