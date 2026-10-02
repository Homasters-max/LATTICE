# Tasks

## 1. Skill patch

- [ ] 1.1 `1-skill.patch` in `D:/tmp/infra-coordinator/` (design D-1…D-8): `.claude/skills/slice/{SKILL.md,change.md,
  status.mjs,rules.mjs,rules.test.mjs,act-rules.mjs,act-rules.test.mjs,judge.mjs,review.mjs,retro.mjs,temp.mjs}`,
  drafted outside the repository; verified by `act.mjs patch infra-coordinator <file> --dry-run` printing `would patch`
  with exactly these paths, and `node --test` of both test files on a scratch checkout with the patch applied
- [ ] 1.2 The maintainer applies patch 1 with `act.mjs patch infra-coordinator <file>`; verified by its
  `patched impl/infra-coordinator <sha>` line and the commit naming exactly the paths of 1.1

## 2. Rules patch and sync

- [ ] 2.1 `2-rules.patch` — `.warrant/local/rules/{process,tracking,maintainer-acts}.json` with the Appendix texts;
  verified by `--dry-run` printing `would patch` with the three paths
- [ ] 2.2 The maintainer applies patch 2 with `act.mjs patch`; then `warrant sync` (`AGENTS.md`, lock) as the agent's
  commit; verified by `warrant validate` and `warrant sync --check` green and `AGENTS.md` at most 12 288 bytes

## 3. Checks

- [ ] 3.1 `node --test .claude/skills/slice/rules.test.mjs` and `act-rules.test.mjs` green, outputs in the impl-PR body:
  `areasAddedAfterInit` on the edit history of #57 (`CL` added after the `init` of `s0-store`; no flag for
  `s0-store-2`), `closable` (an archived Change, a bug fixed by a Change, a `process` issue with done and with an SRA
  reference, a question), `declaredAreas` / kind `unnamed` on the bodies of #85 and #86, `scopeFindings` (evidence of
  another Change, a path outside the Runs' scope, a policy path not by the maintainer, an archive-PR's specs),
  `judgeVerdict` on the #123 envelope with `FRONTEND_HOOKS_INACTIVE` (ok) and with another finding (violation), the log
  of a Change with an untagged comment on its issue after its last push
- [ ] 3.2 The table "old sentence → new place" for every sentence of today's `process` and `tracking`, in the impl-PR
  body (design D-1); a sentence whose meaning changed is an `I-N` row
- [ ] 3.3 Live runs, outputs in the impl-PR body: `status.mjs S0` (budget line, Log column, Closable line),
  `status.mjs infra-coordinator` (Read first), `review.mjs` on an open PR of another Change or on this impl-PR,
  `judge.mjs` on this branch printing `note: FRONTEND_HOOKS_INACTIVE` and no violation
- [ ] 3.4 `retro S0`: `retro.mjs S0 --issues 74,92,93,94,100,112,124` posted on #44 as `[incident] retro S0 wave 1`
  with the transcript summary linked; grilled with the maintainer; the outcome posted as `[decision] retro S0 wave 1`
  and linked from the impl-PR body
- [ ] 3.5 `warrant check infra-coordinator tests-passed` `PROVEN`; implementation review (skill `code-review`), result
  in the impl-PR body; a fix it needs comes as a further maintainer's patch; `warrant verify infra-coordinator`
