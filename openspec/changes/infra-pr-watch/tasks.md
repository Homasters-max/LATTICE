# Tasks

## 1. Patch and sync

- [ ] 1.1 The maintainer's patch (design D-1…D-4), applied with `git apply --index`: `.warrant/local/rules/process.json`,
  `.claude/skills/slice/{wait-pr.mjs,SKILL.md,status.mjs}`; verified by `git diff --cached --name-only` naming exactly
  these four paths
- [ ] 1.2 `warrant sync`: `AGENTS.md`, `.warrant/warrant.lock.json`; verified by `warrant validate` and
  `warrant sync --check` green, `AGENTS.md` carrying the paragraph of the design Appendix

## 2. Checks

- [ ] 2.1 `wait-pr.mjs` on the real repository: on the merged PR #65 it exits 0 at once with `MERGED`; an extra or
  unknown argument exits 64 (D-1, I-8, I-9); the live runs on #69 and #72; `status.mjs S0` and `status.mjs S0 --next`
  run (#67); verified by the pasted outputs in the impl-PR body
- [ ] 2.2 `warrant check infra-pr-watch tests-passed` `PROVEN` (the rule-delivery block of `pin.test.ts` sees the new
  text); `npm run typecheck` green
- [ ] 2.3 Implementation review (rule `process`), result in the impl-PR body; `warrant verify infra-pr-watch`
