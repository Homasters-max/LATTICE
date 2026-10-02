# Tasks

## 1. Patches and sync

- [x] 1.1 `1-merge-flow-scripts.patch` in `D:/tmp/infra-merge-flow/` (design D-1…D-8, D-9 delivery):
  `.claude/skills/slice/{act.mjs,act-rules.mjs,act-rules.test.mjs,wait-pr.mjs,SKILL.md}`, drafted outside the
  repository; verified by `git apply --check` on `impl/infra-merge-flow` and `node --test` of `act-rules.test.mjs` on a
  scratch checkout with the patch applied
- [x] 1.2 The maintainer applies and commits patch 1 (`git -C <worktree> apply --index`, `git -C <worktree> commit`);
  verified by the commit naming exactly the five paths of 1.1, authored by the maintainer
- [x] 1.3 The maintainer runs `act.mjs whoami` from the run button; verified by its line `ok` with the login
  `Homasters-max` — or, when it refuses for the agent's environment, by the same line from a terminal of the
  maintainer's own, which then becomes the place of every `act.mjs` command (an `I-N` row)
- [x] 1.4 `2-merge-flow-rules.patch` (`.warrant/local/rules/{maintainer-acts,process,env}.json`, the Appendix), applied
  by the maintainer with `act.mjs patch infra-merge-flow <file>` after the agent's `--dry-run` prints `would patch`;
  verified by the commit naming exactly the three paths and the `patched impl/infra-merge-flow <sha>` line
- [x] 1.5 `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`; verified by `warrant validate` and
  `warrant sync --check` green, `AGENTS.md` carrying the sentences of the Appendix

## 2. Checks

- [x] 2.1 `node --test .claude/skills/slice/act-rules.test.mjs` green, output pasted in the impl-PR body: the cases of
  design D-8
- [x] 2.2 `act.mjs` on the real repository in the agent's shell, outputs pasted in the impl-PR body:
  - `merge <N>` without `--dry-run` → `refused: … CLAUDECODE …` and `refused: … acts as homasters …`;
  - `merge 109 --dry-run` (merged) → `refused: … not OPEN …`;
  - `merge <N> --dry-run` on this Change's impl-PR before `VERIFYING` → `refused: … record … IMPLEMENTING, not
    VERIFYING …`;
  - `merge <N> --dry-run` on an open spec-PR of another Change in `SPECIFIED`, if one is open → `would merge`; if none
    is, the same on this impl-PR after its `VERIFYING` commit, pasted in the PR body;
  - `waiver s0-store-2 WAV-2026-006 --dry-run` → `refused: … no worktree on impl/s0-store-2 …` or `… not PROPOSED …`;
  - `patch infra-merge-flow D:/tmp/infra-merge-flow/2-merge-flow-rules.patch --dry-run` before 1.4 → `would patch
    impl/infra-merge-flow: …` with the three paths; the same with a patch touching `src/**` → `refused: … implement
    Run …`
- [x] 2.3 `wait-pr.mjs` on a real PR: usage errors exit 64; a merged PR prints `MERGED` and exits 0
- [x] 2.4 `warrant check infra-merge-flow tests-passed` `PROVEN` (the rule-delivery block of `pin.test.ts` sees the
  new texts); `npm run typecheck` green
- [x] 2.5 Implementation review (rule `process`, skill `code-review`), result in the impl-PR body; a patch it needs
  applied with `act.mjs patch`; `warrant verify infra-merge-flow`
- [x] 2.6 `4-judge.patch` (I-22, #124): `.claude/skills/slice/judge.mjs`, `judgeVerdict` and its tests, `SKILL.md`
  "judge", the rule `process` naming it; applied by the maintainer with `act.mjs patch`, then `warrant sync`; verified
  by `node judge.mjs` on this branch printing the three steps and `no violation of the PR`, `act-rules.test.mjs` green
  and `tests-passed` `PROVEN` again
