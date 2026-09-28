---
id: tests
type: dev/guide@1
version: 2
title: Тесты
paths: ["test/**"]
rules:
  - {id: RUL-026, text: "Тесты среза пишутся до реализации; критерии «Готово, когда» исполнитель не меняет — уточнение решением в домене (SL-02)", force: advisory, status: active, source: "design/05-slices.md#SL-02", owner: "human:Homasters-max"}
  - {id: RUL-027, text: "Фикстуры — маленький синтетический проект, без сети; фиктивные адаптеры подключаются проводкой", force: advisory, status: active, source: "design/05-slices.md", owner: "human:Homasters-max"}
  - {id: RUL-028, text: "Живой и фиктивный адаптер порта проходят один контрактный набор", force: advisory, status: active, source: "design/domains/30-adapters.md#AD-07", owner: "human:Homasters-max"}
  - {id: RUL-029, text: "Тест инварианта называет его (домен:номер, как в design/05-slices.md «Инварианты доменов → срез») рядом с токеном SCN-…", force: advisory, status: active, source: "design/05-slices.md#SL-03", owner: "human:Homasters-max"}
  - {id: RUL-030, text: "Наборы всех прежних срезов и тест структуры зелёные в каждом следующем срезе", force: advisory, status: active, source: "design/05-slices.md", owner: "human:Homasters-max"}
---

# tests — Тесты

Как тесты доказывают срез: до реализации, на фикстурах без сети, с именем сценария и инварианта.

## Область

`test/**`. Не повторяет `AGENTS.md` (токен `SCN-…` в имени, тест внутри `describe()`) — это норма WARRANT rule `process`.

## Проверка

`warrant check tests-passed` (junit, токены SCN); RUL-029 — review.
