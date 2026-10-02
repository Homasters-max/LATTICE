# The three PRs of a Change

The steps every Change session follows, as written (rule `process`). The rules in `AGENTS.md` say what must hold; this
file says how. A `warrant` error names its fix in `hint` — follow it.

One session per Change, in one worktree, where its three branches are made in turn; the session is restarted when the
process requires it (a new phase after a long wait, a pin of WARRANT, a guard that must reload) — a restart is the
maintainer's act, asked in the session's own chat.

## Where the record is read

The record of an open Change runs ahead on its branches: `main` has it only after the spec-PR merges, and then it lags,
so its state is read from the furthest branch — archive, impl, spec, then `main` (`status.mjs` does it).

## spec-PR — branch `spec/<change>` from `main`

1. `warrant init change <change>`, then `node .claude/skills/slice/status.mjs <change>`: on an AREA collision stop and
   ask on the umbrella.
2. The artifacts proposal, specs, design, tasks are written inside the Run `warrant run start <change> --operation
   specify` (then `warrant run finish`); editing them without an active Run is `deny`. A `skip_specs` Change sets
   `skip_specs: true` in `openspec/changes/<change>/.openspec.yaml` and declares no AREA.
3. `openspec validate <change> --strict`; `warrant classify <change>` (your own risk — `--propose`).
4. Spec review: `warrant run start <change> --operation review`; its whole JSON is the prompt of the subagent
   `warrant-reviewer`, with what the review needs from GitHub (the issue, its comments, the decisions it cites) written to
   a file the subagent reads — it runs no shell command but `warrant run submit`. A `NOT_PROVEN` review is taken into the
   artifacts in a new `specify` Run, then reviewed again.
5. `status.mjs <change>`: act on and acknowledge every `pending` entry, read every `unread` comment of the issue.
6. `warrant verify <change>`, then `warrant transition <change> SPECIFIED` as the last commit; the local judge
   (`node .claude/skills/slice/judge.mjs`: push only on no violation of the PR — a spec-PR and an archive-PR pass
   `warrant ci` outright; an impl-PR may wait only on CI and the merge: `tests-passed`, `factory-golden-passed`,
   `evidence-complete` of a `test-report`, `human-approval`; a `note:` is no violation); push; only then the PR — a
   spec-PR is never offered for review without `SPECIFIED`.
7. Request the merge (Requests). The merge is the maintainer's approval; changes the review still asks for become `I-N`
   rows of the impl-PR, proposed in the spec-PR body, and the merge is the decision on them.

A spec-PR merged without `SPECIFIED` is followed by a second spec-PR on the same branch name carrying only
`warrant transition <change> SPECIFIED`; the impl-PR refs that PR.

### UNKNOWN

Only in `PROPOSED` and `SPECIFIED`: `warrant unknown add <change> --area <AREA> --text <question> [--blocking]` (a
`skip_specs` Change that needs one adds `AR` to its `Where:` itself — the only AREA a Change adds without a
`[decision]`). An open blocking UNKNOWN makes `warrant status` `WAIT` (next `clarify`): commit the branch, open the
spec-PR (`gh pr create --draft` if the artifacts are not ready), ask the question in it with the UNKNOWN id
(`<!-- act: decision unknown <change> <UNK> -->`) and wait. The decision is a comment by an author from
`roles.maintainer` in the spec-PR: an issue comment `…/pull/<N>#issuecomment-<id>` or a review
`…/pull/<N>#pullrequestreview-<id>` (not a line comment `#discussion_r…`) whose text contains the UNKNOWN id; then
`warrant unknown resolve <change> <UNK> --as decision --text <answer> --ref <comment URL>` — `warrant ci` checks the
author, the text and the PR. A non-blocking UNKNOWN may also be closed `--as fact` or `--as assumption`. `--replace`
changes the answer before `APPROVED`; after the spec-PR merges, changing `--as` or removing `resolution` or `ref` is
`RECORD_MISMATCH` in CI — the question becomes an `I-N` row.

## impl-PR — branch `impl/<change>` from `main` with the spec-PR merged

Only when `node .claude/skills/slice/status.mjs <change>` prints `startable` (WIP < 3, `main` not red); otherwise
report and wait.

1. First commit: `warrant verify <change>` right before `warrant transition <change> APPROVED --ref <URL of the merged
   spec-PR> --by <maintainer>` (so `spec-valid` is fresh after merge commits), then `warrant transition <change>
   IMPLEMENTING`.
2. Code and tests inside the Run `warrant run start <change> --operation implement --scope <source and test paths the
   design names>,openspec/changes/<change>/**` (at the end `warrant run finish`; one active Run per worktree). Paths the
   profile `human-acceptance` names (`.claude/**`, `.warrant/local/**`, `.github/workflows/**`, `package.json` …) are
   written by no Run: they come as the maintainer's patch (`act.mjs patch`), drafted outside the repository.
3. `node:test` tests carry the token `SCN-…` of their scenario in the test name, every test inside `describe()`; a
   `skip` / `todo` test with an `SCN-…` token is `NOT_PROVEN`.
4. Before the last commit, the implementation review (skill `code-review`: Standards and Spec, in the deep-module
   vocabulary of `codebase-design`): a finding inside the Change is fixed in it, one outside it becomes an issue, and
   the impl-PR body states the findings and how each is closed.
5. `status.mjs <change>` as in the spec-PR; last commit `warrant verify <change>` and `warrant transition <change>
   VERIFYING`; the local judge; push; request the merge. The verdict is the job `warrant` in CI; the merge is a merge
   commit by the maintainer.

An implementation question is an `I-N` row in `design.md` with the maintainer's decision, not `warrant unknown`. A spec
change after approval only by the maintainer's decision: inside the `implement` Run an `I-N` row in `design.md` and an
edit of the delta spec; `proposal.md` is outside `write_scope` — a human edits it on the maintainer's decision, the agent
requests it. Then `warrant waive <change> spec-approved --reason "<I-N>: …" --risk <LOW|MEDIUM|HIGH> --control <…>
--owner human:<maintainer> --expires <YYYY-MM-DD not before the expected archive-PR>` — a waiver in `PROPOSED`; the agent
never activates it: it requests `act.mjs waiver <change> <WAV>` before the merge. Without an `ACTIVE` waiver (or with
one expired by `MERGED`) the job `warrant` is red — `GATE_NOT_PASSED` `spec-approved`.

A merge conflict with `main` in a path outside the Run's `write_scope` takes `origin/main`'s side, or is asked on the
umbrella; what `warrant` and a git merge write is not an edit of the agent (I-6).

## archive-PR — branch `archive/<change>` from `main` with the impl-PR merged

`warrant ci fetch <URL of the impl-PR>`, `warrant transition <change> MERGED --ref <URL of the impl-PR> --by
<maintainer>` — always with `--by` (a Change with the profile `human-acceptance` has the gate `human-approval` on
`VERIFYING->MERGED`, and `warrant` answers `USAGE` without it); `warrant archive <change>` (never `openspec archive`); the local judge; push; request the merge.
The archive-PR carries `Closes #<issue of the Change>` (rule `tracking`).

## The decision log

Before `SPECIFIED` and before requesting a merge: `status.mjs <change>`, section "Read first". Act on every `pending`
entry, then acknowledge it by a reply on the umbrella (outside a slice: on the Change's issue) that links it and names
the Change — one reply may acknowledge several; a comment in your PR that links the entry counts too, and `act.mjs
merge` refuses a PR with an entry newer than its last push that neither acknowledges; read every `unread` comment of the issue, untagged ones included (a
scope change may arrive as one, #97). A scope change by message from the coordinator is acknowledged by message too,
before `SPECIFIED`. Your own `[scope]` posted after your push needs the acknowledgement too. An entry you post names in `Touches:` only the
Changes that must act on it.

A slice decision that changes an open PR (an AREA, an id, the order of Changes) stops its merge: the coordinator turns
the PR to draft, turns its auto-merge off and comments `⛔ Do not merge — <decision URL>` (I-3); the owner brings the PR
in line with the decision, marks it ready (`gh pr ready <N>`) with a comment naming the commit, and requests the merge
again.

## Requests for the maintainer's acts

An act of the maintainer (rule `maintainer-acts`) is requested by a comment on the PR or issue it concerns — a WARRANT
question on the LATTICE issue that waits on it, a setting without a PR on the Change's issue; never as a command in your
own chat. Then tell the coordinator by message. The comment:

```text
<!-- act: <kind> <fields> -->
**<what>** — <why>.
Executor: <session title> — <claude:// link of the session>
<the one command in a bash block, where there is one; an act.mjs act after its --dry-run printed `would …`>
```

Markers, by group (fields carry no spaces or shell characters):
1. `act.mjs` — `<!-- act: merge <N> -->` · `<!-- act: waiver <change> <WAV> -->` · `<!-- act: patch <change> <file> -->`;
2. decisions — `<!-- act: decision unknown <change> <UNK> -->` · `<!-- act: decision question <N> -->` ·
   `<!-- act: decision sra <N> -->` · `<!-- act: decision slice <umbrella comment id> -->` (I-9);
3. repository settings — `<!-- act: setting <slug> -->`;
4. files and git outside `act.mjs` — `<!-- act: file <branch> <path> -->` · `<!-- act: tag <name> -->`;
5. sessions — no marker: the coordinator's chip is the request to start one; a restart is asked in that session's chat
   (it has no command);
6. WARRANT (SRA) — a session working in `Homasters-max/SRA` sends its maintainer acts to the coordinator by message; they
   show in the queue as their own group and are never run from it.

The merge is requested once, when no check has failed (auto-merge waits for running ones), after `review.mjs <N>`
passes and a PR behind `main` is updated by its owner (`gh pr update-branch <N>`, after the local judge). Read the
result yourself — the `act-done` mark, the commit on your branch, the waiver `ACTIVE`, the PR merged or auto-merge on —
and never ask the maintainer whether an act is done. Until #133 (`infra-act-queue`) the coordinator reads the requests
and shows them in its "👤 queue" block.

## Waiting for the maintainer

The maintainer never announces a merge. A PR is owned by the session that opened it, and only the owner watches it and
acts on its outcome. After opening it, bind it in the desktop app with auto-fix on, so CI failures, merge conflicts and
review comments reach you — or tell the maintainer that its CI is not watched; CI is never polled.

Right after the push that makes a PR wait for the maintainer's merge, start in the background (the background mode of
your shell tool) `node .claude/skills/slice/wait-pr.mjs <N>`, unless one for the same PR still runs. On its report:
- `MERGED` — the next step: after a spec-PR the impl-PR (only when `status.mjs <change>` prints `startable`, otherwise
  report and wait); after an impl-PR the archive-PR; after an archive-PR the next Change;
- `CLOSED` — report to the maintainer and stop;
- `CONFLICT` (exit 4) — merge `origin/main`, resolve, run the local judge, push, start it again;
- `AUTO-MERGE OFF` (exit 5) — report why (a draft, ⛔, a red `main`, GitHub) and request again once fixed;
- exit 2 or 3 — report and start it again.

While auto-merge is on, the watcher updates a PR that falls behind `main` (`gh pr update-branch`, a merge commit; CI
judges it): `git pull --ff-only` before your next commit on that branch. A session that starts or resumes starts the
watchers of the PRs it owns that wait for the maintainer, and reports a PR whose merge it requested and whose
auto-merge is off (`gh pr view <N> --json autoMergeRequest`).
