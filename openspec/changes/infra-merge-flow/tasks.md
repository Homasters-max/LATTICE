# Tasks

## 1. Patches and sync

- [ ] 1.1 `1-merge-flow-scripts.patch` in `D:/tmp/infra-merge-flow/` (design D-1…D-8, D-9 delivery):
  `.claude/skills/slice/{act.mjs,act-rules.mjs,act-rules.test.mjs,wait-pr.mjs,SKILL.md}`, drafted outside the
  repository; verified by `git apply --check` on `impl/infra-merge-flow` and `node --test` of `act-rules.test.mjs` on a
  scratch checkout with the patch applied
- [ ] 1.2 The maintainer applies and commits patch 1 (`git -C <worktree> apply --index`, `git -C <worktree> commit`);
  verified by the commit naming exactly the five paths of 1.1, authored by the maintainer
- [ ] 1.3 `2-merge-flow-rules.patch` (`.warrant/local/rules/{maintainer-acts,process,env}.json`, the Appendix), applied
  by the maintainer with `act.mjs patch infra-merge-flow <file>` after the agent's `--dry-run` passes; verified by the
  commit naming exactly the three paths and the output line of `act.mjs`
- [ ] 1.4 `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`; verified by `warrant validate` and
  `warrant sync --check` green, `AGENTS.md` carrying the sentences of the Appendix

## 2. Checks

- [ ] 2.1 `node --test .claude/skills/slice/act-rules.test.mjs` green, output pasted in the impl-PR body: every refusal
  of D-2, D-3, D-5, D-6 and its absence; `pendingEntries` (D-4) on comments of #44 — touching, not touching,
  acknowledged, `[incident]`; every step of `watchStep` (D-7)
- [ ] 2.2 `act.mjs` on the real repository, outputs pasted in the impl-PR body: without `--dry-run` in the agent's
  shell it refuses (`CLAUDECODE`, login `homasters`); `merge <N> --dry-run` on a merged PR, on a draft or a PR whose
  head record is not in its end state, and on this Change's impl-PR; `waiver s0-store-2 WAV-2026-006 --dry-run`
  refuses (no worktree on `impl/s0-store-2` or not `PROPOSED`); `patch infra-merge-flow <patch 2> --dry-run` passes
  before 1.3
- [ ] 2.3 `wait-pr.mjs` on a real PR: usage errors exit 64; a merged PR prints `MERGED` and exits 0
- [ ] 2.4 `warrant check infra-merge-flow tests-passed` `PROVEN` (the rule-delivery block of `pin.test.ts` sees the
  new texts); `npm run typecheck` green
- [ ] 2.5 Implementation review (rule `process`, skill `code-review`), result in the impl-PR body; a patch it needs
  applied with `act.mjs patch`; `warrant verify infra-merge-flow`
