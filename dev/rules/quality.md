---
id: quality
type: dev/guide@1
title: Качество кода
paths: ["src/**", "test/**"]
rules:
  - {id: RUL-021, text: "Отказ несёт код и адрес: путь поля, id объекта, адрес прежнего коммита — не просто текст", force: advisory, status: active, source: "design/05-slices.md#s0", owner: "human:Homasters-max"}
  - {id: RUL-022, text: "Имена в коде и сообщениях — термины design/02-glossary.md; синонимов не вводить", force: advisory, status: active, source: "design/README.md", owner: "human:Homasters-max"}
  - {id: RUL-023, text: "Публичная функция домена несёт ссылку на решение или инвариант дизайна (KR-11, 10-kernel инв. 3) — цепочка код → design", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-024, text: "Комментарий объясняет «почему», не «что»; мёртвого и закомментированного кода нет; TODO — только со ссылкой ISS-…", force: advisory, status: active, source: IDEA-002, owner: "human:Homasters-max"}
  - {id: RUL-025, text: "Функция — одна ответственность; ветвление по типу объекта — данными std, не условиями в коде (AR-02)", force: advisory, status: active, source: "design/04-architecture.md#AR-02", owner: "human:Homasters-max"}
---

# quality — Качество кода

Как писать код, который читается и прослеживается до дизайна: адресные отказы, термины глоссария, ссылки на решения.

## Область

`src/**`, `test/**`. Уточняет [code](code.md); противоречие — стоп и вопрос.

## Проверка

Review. RUL-024 (TODO со ссылкой) — кандидат в проверку `grep`, если нарушения повторятся в отчётах.
