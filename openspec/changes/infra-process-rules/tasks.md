# Tasks

## 1. Patches and sync

- [x] 1.1 The four patches of design D-7 in `D:/tmp/infra-process-rules/` (I-19): `1-tracking.patch` and
  `2-merge-only.patch` cut from `44a3cb3` and `3c51478`, `3-rules.patch` (`tracking`, `process`: Appendix, I-8, I-15)
  and `4-slice.patch` (skill `slice`, D-2…D-6, I-1, I-3, I-5, I-9, I-16, I-17) drafted outside the repository and run on
  a scratch checkout; verified by `git apply --check` of the four in order on the impl branch
- [x] 1.2 The maintainer applies the four with `git apply --index` and commits them; verified by the commit naming
  exactly `.warrant/local/rules/{tracking,maintainer-acts,process}.json` and
  `.claude/skills/slice/{status.mjs,rules.mjs,rules.test.mjs,SKILL.md}`
- [x] 1.3 `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`; verified by `warrant validate` and
  `warrant sync --check` green, `AGENTS.md` carrying the sentences of the design Appendix
- [x] 1.4 The patches of the implementation review, `5-process-paragraph.patch` (I-21) and `6-slice-review.patch`
  (I-20), applied and committed by the maintainer, then `warrant sync`; verified by the commit naming exactly
  `.warrant/local/rules/process.json` and the four `.claude/skills/slice/*` files

## 2. Checks

- [x] 2.1 `node --test .claude/skills/slice/rules.test.mjs` green, output pasted in the impl-PR body: the state of
  `main` from its two checks (D-2); the #92 case — two holders of `CL`, the later one in a collision, one queue row;
  equal or missing init times; a `fix-main-*` Change on a red `main` and on a held AREA (D-3, I-6); `bug`, `question`,
  docs and Change issues, AREAs ignored without a Change (D-4); the CLI version against the `kernel` range (I-5);
  `Depends on: none. Closes #94.` (I-16); a bug issue naming a Change refers to it (I-17)
- [x] 2.2 `status.mjs` on the real repository, outputs pasted in the impl-PR body: `S0 --main-ref ed52281` prints
  `main: red` with `ID_DUPLICATE` and `S0 --next` with it lists nothing; `S0` lists none of #92, #93, #94 as
  `launch (docs PR)` and prints the open P1 ones in `Open P1 without a Change`; an open spec-PR asks `merge`, not
  `approve + merge` (D-5); no `lattice-status-*` worktree is left in `git worktree list`
- [x] 2.3 `warrant check infra-process-rules tests-passed` `PROVEN` (the rule-delivery block of `pin.test.ts` sees the
  new texts); `npm run typecheck` green
- [x] 2.4 Implementation review (rule `process`), result in the impl-PR body; `warrant verify infra-process-rules`
