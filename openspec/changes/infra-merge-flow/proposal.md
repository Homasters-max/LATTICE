# Proposal

## Why

The transcripts of the four S0 sessions of 2026-10-02 (`s0-kernel`, `s0-apply-checks`, `s0-store`/`s0-store-2`,
`infra-process-rules`), summed up on umbrella #44
([friction](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5950268972)), show the maintainer's time
going to mechanics, not decisions (#111):

- **Merges.** Impl-PR #102 was asked for merge 4 times, #103 three times, #108 and #109 twice: under strict branch
  protection every merge left the other open PRs `BEHIND` `main`, each needed `gh pr update-branch`, new checks and a
  new request.
- **Waivers.** An activation was asked as six commands (`cd`, `warrant waive --activate`, `git add`, `git commit`,
  `git push`, `cd`), twice per waiver, and one activation (`3812fcf`) was lost when two Changes proposed the same id
  (Homasters-max/SRA#139).
- **Policy-path patches** came as `git -C … apply --index` plus a commit; the maintainer asked «как, где команды?» and
  «что мне поправить?».
- **Rule gaps** cost retries: `warrant transition <change> MERGED` without `--by` answered `USAGE` on every Change of
  S0 (all carry the profile `human-acceptance`); `spec-valid` went stale before `APPROVED` after merge commits; a local
  `warrant ci` left an evidence file that #109 committed; `gh pr edit` fails for the agent's token without `read:org`.

`allow_auto_merge` is on in the repository since 2026-10-02. The maintainer's decision (#111, plan
[#44](https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5950269274), wave 1): automate the mechanics
around every maintainer act; the act itself stays human — merge, waiver activation and policy-path edits are the
controls WARRANT checks.

## What Changes

- **`act.mjs`** (`.claude/skills/slice/act.mjs`, new): one command per maintainer act — `merge <N>`,
  `waiver <change> <WAV>`, `patch <change> <file>`. It checks who runs it and the state of the PR or worktree, does the
  act, commits, pushes and verifies the result, or refuses with a reason and changes nothing. `--dry-run` runs every
  check and acts on nothing; the agent runs it before asking. `merge` turns on auto-merge (`gh pr merge --merge
  --auto`).
- **`wait-pr.mjs`**: while auto-merge is on, a PR that falls `BEHIND` `main` is updated by the owner's watcher
  (`gh pr update-branch`); a conflict and a lost auto-merge are new outcomes the owner acts on. A PR is asked for merge
  once.
- **Pure rules** of both scripts in `.claude/skills/slice/act-rules.mjs`, checked by `act-rules.test.mjs`
  (`node --test`).
- **Rules** `maintainer-acts`, `process`, `env` (`.warrant/local/rules/*.json`): every request for a maintainer act is
  «❗ Выполнить» with exactly one `act.mjs` command; the merge flow with auto-merge and the watcher; `MERGED` always
  with `--by <maintainer>`; `warrant verify` right before `APPROVED`; the local `warrant ci` in a scratch worktree
  outside the repository, removed afterwards; the token scope `read:org` as a maintainer's act.
- **Skill `slice`** (`SKILL.md`): the `act` command and the new outcomes of `wait`.
- `warrant sync` regenerates `AGENTS.md` and the lock.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the product LATTICE does not change (`skip_specs: true`).

## Impact

- Paths: `.warrant/local/rules/{maintainer-acts,process,env}.json` (policy paths),
  `.claude/skills/slice/{act.mjs,act-rules.mjs,act-rules.test.mjs,wait-pr.mjs,SKILL.md}` (profile
  `human-acceptance`, outside the `implement` write scope); all come as the maintainer's patch. Generated:
  `AGENTS.md`, `.warrant/warrant.lock.json`.
- Every session of the project: the way it asks for a maintainer act and waits for a merge.
- Closes #111 (design D-9).

## Non-goals

- The coordinator routine, the decision-log tags and their acknowledgement in `status.mjs`, `review` / `broadcast` /
  `retro`, closing criteria of issues, session boundaries: #101 `infra-coordinator`. `status.mjs` and `rules.mjs` do
  not change here.
- Branch protection, repository settings and the agent token itself: the maintainer's settings.
- The WARRANT defects behind the frictions (SRA#138, SRA#139, SRA#141, SRA#142, SRA#143): fixed in WARRANT.
- Any change of `src/`, `test/` or `.github/workflows/**`.
