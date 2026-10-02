# Tasks

## 1. Patches and sync

- [ ] 1.1 The skill `slice` patch (design D-2…D-5) written outside the repository and run on a scratch checkout:
  `D:/tmp/infra-process-rules/3-slice.patch`; the two rule patches saved beside it from `44a3cb3` and `3c51478` (D-6);
  verified by `git apply --check` of all three on the impl branch
- [ ] 1.2 The maintainer's patches applied with `git apply --index` and committed; verified by
  `git diff --cached --name-only` naming exactly `.warrant/local/rules/{tracking,maintainer-acts,process}.json` and
  `.claude/skills/slice/{status.mjs,SKILL.md}`
- [ ] 1.3 `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`; verified by `warrant validate` and
  `warrant sync --check` green, `AGENTS.md` carrying the sentences of the design Appendix

## 2. Checks

- [ ] 2.1 `status.mjs` on the real repository, outputs pasted in the impl-PR body: `S0 --main-ref ed52281` prints
  `main: red` with `ID_DUPLICATE` and `--next` lists nothing (D-2); with a throwaway local branch
  `spec/s0-store-2` carrying a `PROPOSED` record from `warrant init change` (never pushed, removed after) `S0` prints
  an AREA collision `CL` in the maintainer queue and `s0-store-2` prints it as `not startable` (D-3); `S0` lists none of
  #92, #93, #94 as `launch (docs PR)` and prints them in `Open P1 without a Change` where P1 (D-4); an open spec-PR
  asks `merge`, not `approve + merge` (D-5)
- [ ] 2.2 `warrant check infra-process-rules tests-passed` `PROVEN` (the rule-delivery block of `pin.test.ts` sees the
  new texts); `npm run typecheck` green
- [ ] 2.3 Implementation review (rule `process`), result in the impl-PR body; `warrant verify infra-process-rules`
