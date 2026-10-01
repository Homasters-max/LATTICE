# LATTICE

A memory of decisions with provenance and trust: it stores verified blocks of knowledge and capabilities, finds the ones that fit a task, remembers what a solution was assembled from and why, and calibrates trust by the verdicts of consumers.

- The system design is [`design-next/`](design-next/README.md): the source of requirements, frozen (tag `design-next-v0.1`, SL-T01); slices S0–S4, the switch SW (the design moves into the ledger) and the order of the transition are in [`09-slices`](design-next/09-slices.md).
- [`design/`](design/README.md) is history: v0.6 (tag `design-v0.6`), not norm.
- The norm is `openspec/specs/` (REQ/SCN); every change of code and specs is an OpenSpec Change under WARRANT; the process is in [`AGENTS.md`](AGENTS.md).
- Stack: TypeScript / Node.js 22 (ESM); tests: `node:test`.
- The history of research, integration and audit is git (`git log`).
