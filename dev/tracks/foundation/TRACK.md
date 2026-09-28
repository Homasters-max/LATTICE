---
schema: lattice-dev/node@1
kind: foundation
depends_on: []
done_when: контракты, общие для S0 и далее (каноническая форма, коммит — ADR-1), — норма в openspec/specs/
focus: kernel-format
rules:
  - id: R-FD-01
    text: Тестовые векторы JCS формата v1 — эталон; их не правят под реализацию
    force: advisory
    status: active
    source: design/05-slices.md S1; ADR-1
    owner: human:Homasters-max
---

# foundation — общие контракты срезов

Change, чей контракт нужен нескольким срезам, а не одному (критерий: без него S1+ не реализовать).

## Журнал

- 2026-09-28 — kernel-format отнесён сюда (grilling: область действия контракта).
