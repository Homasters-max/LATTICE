# Tasks

## 1. Skill patch

- [ ] 1.1 `1-skill.patch` in `D:/tmp/infra-coordinator/` (design D-1…D-8, D-12): `.claude/skills/slice/{SKILL.md,
  change.md,status.mjs,rules.mjs,rules.test.mjs,act.mjs,act-rules.mjs,act-rules.test.mjs,judge.mjs,review.mjs,retro.mjs,
  temp.mjs}`, drafted outside the repository; verified by `act.mjs patch infra-coordinator <file> --dry-run` printing
  `would patch` with exactly these paths, and `node --test` of both test files on a scratch checkout with the patch
  applied
- [ ] 1.2 The maintainer applies patch 1 with `act.mjs patch infra-coordinator <file>` (requested by hand, D-10);
  verified by its `patched impl/infra-coordinator <sha>` line and the commit naming exactly the paths of 1.1

## 2. Rules patch and sync

- [ ] 2.1 `2-rules.patch` — `.warrant/local/rules/{process,tracking,maintainer-acts}.json` with the texts of Appendix A;
  verified by `--dry-run` printing `would patch` with the three paths
- [ ] 2.2 Patch 2 requested as a marked comment in the impl-PR (`<!-- act: patch infra-coordinator <file> -->`),
  reviewed with `review.mjs <N> --mark`, and run by the maintainer with `act.mjs queue --run` from the Run button;
  verified by `act.mjs queue` listing it before and not after, and the `patched …` line
- [ ] 2.3 `warrant sync` (`AGENTS.md`, lock) as the agent's commit; verified by `warrant validate` and
  `warrant sync --check` green and `AGENTS.md` at most 12 288 bytes

## 3. Checks

- [ ] 3.1 `node --test .claude/skills/slice/rules.test.mjs` and `act-rules.test.mjs` green, outputs in the impl-PR body.
  Cases: `areasAddedAfterInit` on the real edit history of #57 with the real `initAt` of `s0-store` (07:25:45.020Z) and
  `s0-store-2` — no flag —, a synthetic edit after `init` — flagged —, the same cleared by a `[scope]` naming the Change
  and the AREA, `AR` on a `skip_specs` Change — not flagged; `closable` (an archived Change, a `process` issue with done
  references and with an SRA reference, a bug fixed by a Change, a question); kind precedence and `unnamed` on the
  bodies of #85 and #86; `changeLastPush` over a merged and an open branch; the log split (`pending` with a PR-comment
  acknowledgement, `unread`); `scopeFindings` (evidence of another Change, a path outside the Runs' scope, a policy path
  not by the maintainer, an archive-PR's specs, a PR without a Change touching a policy path); `judgeVerdict` on the
  #123 envelope with `FRONTEND_HOOKS_INACTIVE` (ok) and with another finding (violation); `actRequest` on every marker
  and on malformed ones (spaces, shell characters, a wrong WAV id); `actDone` for each kind; a review mark voided by a new
  head and by an edited patch
- [ ] 3.2 Appendix B re-checked against the final rule texts and `change.md`; a difference is an `I-N` row
- [ ] 3.3 Live runs, outputs in the impl-PR body: `status.mjs S0` (budget line, Log column, Closable line),
  `status.mjs infra-coordinator` (Read first), `review.mjs` on an open PR of another Change or on this impl-PR,
  `judge.mjs` on this branch printing `note: FRONTEND_HOOKS_INACTIVE` and no violation, `act.mjs queue` on the real
  requests of the repository
- [ ] 3.4 Broadcast and Coordinator section: the session list `broadcast` would message today (D-6, step 2), in the
  impl-PR body; the coordinator session reads the section "Coordinator" and confirms by message that it matches its
  practice, or names the differences (each an `I-N` row)
- [ ] 3.5 `retro S0`: `retro.mjs S0 --issues 74,92,93,94,100,112,124` posted on #44 as `[incident] retro S0 wave 1`
  with the transcript summary linked; grilled with the maintainer; the outcome posted as `[decision] retro S0 wave 1`
  and linked from the impl-PR body
- [ ] 3.6 `warrant check infra-coordinator tests-passed` `PROVEN`; implementation review (skill `code-review`), result
  in the impl-PR body; a fix it needs comes as a further maintainer's patch; `warrant verify infra-coordinator`
