// node --test .claude/skills/slice/act-rules.test.mjs — the rules of act.mjs and wait-pr.mjs on fixtures
// (Change infra-merge-flow, design D-8).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  actorRefusals, changeOfBranch, copyPlan, globToRegExp, isAgentIdent, lastPush, mainHealth, mergeRefusals,
  judgeVerdict, parsePatchPaths, parseWorktrees, patchSubject,
  patchPathWriter, patchRefusals, pendingEntries, waiverRefusals, watchStep, worktreeRefusals,
} from './act-rules.mjs';

const reasons = (refusals) => refusals.map((r) => r.reason).join(' | ');
const MAINTAINER = 'Kat <94626159+Homasters-max@users.noreply.github.com> 1727866000 +0300';
const AGENT = 'homasters <52467145+homasters@users.noreply.github.com> 1727866000 +0300';
const project = { maintainers: ['Homasters-max'], agentLogins: ['homasters'] };

describe('who runs act.mjs (D-2)', () => {
  it('the maintainer in their own terminal passes', () => {
    assert.deepEqual(actorRefusals({ ...project, agentShell: false, login: 'Homasters-max', authorIdent: MAINTAINER, needsAuthor: true }), []);
  });
  it("an agent's shell, the agent's login and the agent's identity are refused", () => {
    const r = actorRefusals({ ...project, agentShell: true, login: 'homasters', authorIdent: AGENT, needsAuthor: true });
    assert.match(reasons(r), /CLAUDECODE/);
    assert.match(reasons(r), /acts as homasters/);
    assert.match(reasons(r), /git author of the commit would be an agent/);
  });
  it('logins compare exactly and case-insensitively: homasters is not Homasters-max', () => {
    assert.deepEqual(actorRefusals({ ...project, login: 'homasters-MAX', needsAuthor: false }), []);
    assert.equal(isAgentIdent(MAINTAINER, ['homasters']), false);
    assert.equal(isAgentIdent(AGENT, ['homasters']), true);
    assert.equal(isAgentIdent('HOMASTERS <x@y> 1 +0000', ['homasters']), true);
    assert.equal(isAgentIdent('Kat <1+homasters@users.noreply.github.com.evil> 1 +0000', ['homasters']), false);
  });
  it('a merge does not need the git author', () => {
    assert.deepEqual(actorRefusals({ ...project, login: 'Homasters-max', authorIdent: AGENT, needsAuthor: false }), []);
  });
});

describe('which copy runs (D-2, I-5)', () => {
  const files = (local, main) => ['act.mjs', 'act-rules.mjs', 'rules.mjs'].map((name) => ({ name, local, main }));
  it('the copy of origin/main runs', () => assert.deepEqual(copyPlan({ files: files('a', 'a'), act: 'merge' }), { mode: 'run' }));
  it('a copy that differs runs the version of origin/main instead', () => {
    assert.deepEqual(copyPlan({ files: files('a', 'b'), act: 'merge' }), { mode: 'reexec' });
    assert.match(reasons(copyPlan({ files: files('a', 'b'), act: 'merge', reexecuted: true }).refusals), /after re-execution/);
  });
  it('bootstrap allows only patch, whoami and --dry-run', () => {
    assert.deepEqual(copyPlan({ files: files('a', null), act: 'patch' }), { mode: 'bootstrap' });
    assert.deepEqual(copyPlan({ files: files('a', null), act: 'whoami' }), { mode: 'bootstrap' });
    assert.deepEqual(copyPlan({ files: files('a', null), act: 'merge', dryRun: true }), { mode: 'bootstrap' });
    assert.match(reasons(copyPlan({ files: files('a', null), act: 'merge' }).refusals), /bootstrap/);
    assert.match(reasons(copyPlan({ files: files('a', null), act: 'waiver' }).refusals), /bootstrap/);
  });
});

describe('health of main (D-3, I-1)', () => {
  it('a failed test run or an open "infra: main red" issue is red', () => {
    assert.equal(mainHealth({ testRun: { conclusion: 'failure', url: 'u' } }).state, 'red');
    assert.equal(mainHealth({ testRun: { conclusion: 'success', url: 'u' }, openIssueTitles: ['infra: main red — ID_DUPLICATE'] }).state, 'red');
    assert.equal(mainHealth({ testRun: { conclusion: 'success', url: 'u' }, openIssueTitles: ['infra: main is fine'] }).state, 'green');
    assert.equal(mainHealth({ testRun: undefined }).state, 'unknown');
  });
});

// Comments shaped like those of umbrella #44.
const U = 'https://github.com/Homasters-max/LATTICE/issues/44';
const plan = { where: 'umbrella', url: `${U}#issuecomment-5950269274`, createdAt: '2026-10-02T10:22:45Z',
  body: '[decision] Execution plan of S0 from 2026-10-02, the maintainer\'s decision. Touches: every open Change of S0, #111, #101.' };
const scopePJ = { where: 'umbrella', url: `${U}#issuecomment-5950536272`, createdAt: '2026-10-02T10:36:58Z',
  body: '[scope] `s0-projections` (#60, AREA `PJ`, spec phase). Touches: paths outside `src/ledger/projections/**`.' };
const incident = { where: 'umbrella', url: `${U}#issuecomment-5950268972`, createdAt: '2026-10-02T10:22:44Z',
  body: '[incident] Transcripts of the S0 sessions … #111: `act.mjs merge` …' };
const ctx = { change: 'infra-merge-flow', issue: 111, pr: 116, since: '2026-10-02T10:00:00Z', repo: 'Homasters-max/LATTICE' };

describe('pending entries — implementation review (I-20)', () => {
  it('the plan comment does not touch a Change it does not name (P-1)', () => {
    assert.deepEqual(pendingEntries({ ...ctx, change: 's0-kernel', issue: 55, pr: 102, comments: [plan] }), []);
  });
  it('a URL of another repository does not name the issue (P-3)', () => {
    const e = { where: 'umbrella', url: `${U}#issuecomment-7`, createdAt: '2026-10-02T10:30:00Z',
      body: '[decision] see https://github.com/Homasters-max/SRA/issues/111' };
    assert.deepEqual(pendingEntries({ ...ctx, comments: [e] }), []);
  });
  it('an acknowledgement links the whole comment id, not a prefix of it (P-4)', () => {
    const e = { ...plan, url: `${U}#issuecomment-595026927` };
    const ack = { where: 'pr', url: 'p#issuecomment-2', createdAt: '2026-10-02T11:00:00Z', body: `Read ${U}#issuecomment-5950269274` };
    assert.equal(pendingEntries({ ...ctx, comments: [e, ack] }).length, 1);
  });
  it('times compare as instants whatever their format (S-7)', () => {
    const e = { ...plan, createdAt: '2026-10-02T10:00:00Z' };
    assert.equal(pendingEntries({ ...ctx, since: '2026-10-02T10:00:00.000Z', comments: [e] }).length, 0);
    assert.equal(pendingEntries({ ...ctx, since: '2026-10-02T09:59:59.500Z', comments: [e] }).length, 1);
  });
  it("an agent's committer is refused like an agent's author (S-2)", () => {
    const r = actorRefusals({ ...project, login: 'Homasters-max', authorIdent: MAINTAINER, committerIdent: AGENT, needsAuthor: true });
    assert.match(reasons(r), /git committer of the commit would be an agent/);
  });
});

describe('parsing of git output (S-1, S-4)', () => {
  it('numstat -z: plain paths and both sides of a rename', () => {
    assert.deepEqual(parsePatchPaths('1\t1\t.warrant/local/rules/env.json\0' + '0\t0\t\0.claude/a.mjs\0.claude/b.mjs\0'),
      ['.claude/a.mjs', '.claude/b.mjs', '.warrant/local/rules/env.json']);
    assert.deepEqual(parsePatchPaths(''), []);
  });
  it('worktree list --porcelain', () => {
    const out = 'worktree D:/project/LATTICE\nHEAD abc\nbranch refs/heads/main\n\nworktree D:/wt\nHEAD def\ndetached\n';
    assert.deepEqual(parseWorktrees(out), [{ path: 'D:/project/LATTICE', branch: 'main' }, { path: 'D:/wt', branch: undefined }]);
  });
  it('a folded Subject is read whole, without [PATCH] and the Change prefix', () => {
    const mail = 'From abc Mon Sep 17 00:00:00 2001\nFrom: x <x@y>\nSubject: [PATCH] infra-merge-flow: rules maintainer-acts,\n process, env (design Appendix)\n\nbody\n';
    assert.equal(patchSubject(mail, 'infra-merge-flow'), 'rules maintainer-acts, process, env (design Appendix)');
    assert.equal(patchSubject('diff --git a/x b/x\n', 'infra-merge-flow'), null);
  });
  it('a patch with no worktree to check against is not called "does not apply" (S-9)', () => {
    assert.deepEqual(patchRefusals({ change: 'x', allowGlobs: ['.claude/**'], applies: null, file: { path: 'p', exists: true }, paths: ['.claude/a'] }), []);
  });
});

describe('pending entries (D-4, I-3, I-8, I-12, I-13)', () => {
  it('an entry naming the issue and newer than the last push is pending; an [incident] is not an entry', () => {
    const p = pendingEntries({ ...ctx, comments: [plan, incident] });
    assert.deepEqual(p.map((e) => e.url), [plan.url]);
  });
  it('an entry older than the last push is not pending', () => {
    assert.deepEqual(pendingEntries({ ...ctx, since: '2026-10-02T11:00:00Z', comments: [plan] }), []);
  });
  it('an entry for another Change does not touch this one; one naming an AREA it holds does', () => {
    assert.deepEqual(pendingEntries({ ...ctx, comments: [scopePJ] }), []);
    assert.equal(pendingEntries({ ...ctx, change: 's0-projections', issue: 60, areas: ['PJ'], comments: [scopePJ] }).length, 1);
    assert.equal(pendingEntries({ ...ctx, change: 'x', issue: 1, areas: ['PJ'], comments: [scopePJ] }).length, 1);
  });
  it('names match as words: s0-store is not s0-store-2, #11 is not #111, SRA#111 is not #111', () => {
    const e = (body) => ({ where: 'umbrella', url: `${U}#issuecomment-1`, createdAt: '2026-10-02T10:30:00Z', body });
    assert.deepEqual(pendingEntries({ ...ctx, change: 's0-store', issue: 11, comments: [e('[decision] `s0-store-2` and #111')] }), []);
    assert.deepEqual(pendingEntries({ ...ctx, comments: [e('[decision] see Homasters-max/SRA#111')] }), []);
    assert.equal(pendingEntries({ ...ctx, comments: [e('[decision] https://github.com/Homasters-max/LATTICE/issues/111 waits')] }).length, 1);
  });
  it('a comment in the PR linking the entry acknowledges it; a ⛔ comment does not', () => {
    const ack = { where: 'pr', url: 'p#issuecomment-2', createdAt: '2026-10-02T11:00:00Z', body: `Read ${plan.url}: wave 1, no change.` };
    assert.deepEqual(pendingEntries({ ...ctx, comments: [plan, ack] }), []);
    const stop = { ...ack, body: `⛔ Do not merge — ${plan.url}` };
    assert.equal(pendingEntries({ ...ctx, comments: [plan, stop] }).length, 1);
    const early = { ...ack, createdAt: '2026-10-02T10:00:00Z' };
    assert.equal(pendingEntries({ ...ctx, comments: [plan, early] }).length, 1);
  });
  it('a [broadcast] acknowledged for another PR is still pending for this one', () => {
    const b = { where: 'umbrella', url: `${U}#issuecomment-9`, createdAt: '2026-10-02T10:30:00Z', body: '[broadcast] pull main and restart watchers' };
    const ackOther = { where: 'umbrella', url: `${U}#issuecomment-10`, createdAt: '2026-10-02T10:40:00Z', body: `\`s0-bootstrap\` (#120) read ${b.url}` };
    assert.equal(pendingEntries({ ...ctx, comments: [b, ackOther] }).length, 1);
    const ackThis = { ...ackOther, body: `\`infra-merge-flow\` read ${b.url}` };
    assert.deepEqual(pendingEntries({ ...ctx, comments: [b, ackThis] }), []);
  });
  it('no last push known: every touching entry is pending (a refusal in doubt)', () => {
    assert.equal(pendingEntries({ ...ctx, since: null, comments: [plan] }).length, 1);
  });
});

describe('last push (I-3)', () => {
  it("the newest commit of an agent: the maintainer's act.mjs commit and the watcher's merges move nothing", () => {
    const commits = [
      { date: '2026-10-02T10:00:00.000Z', committer: 'homasters <52467145+homasters@users.noreply.github.com>' },
      { date: '2026-10-02T10:30:00.000Z', committer: 'Kat <94626159+Homasters-max@users.noreply.github.com>' },
    ];
    assert.equal(lastPush(commits, ['homasters']), '2026-10-02T10:00:00.000Z');
    assert.equal(lastPush([], ['homasters']), null);
  });
});

const openPR = (over = {}) => ({ number: 116, state: 'OPEN', baseRefName: 'main', isDraft: false, mergeStateStatus: 'BLOCKED',
  headRefName: 'impl/infra-merge-flow', statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }, { name: 'warrant', status: 'IN_PROGRESS' }], ...over });
const green = { state: 'green', note: 'test green u' };
const ok = { record: { change_state: 'VERIFYING' }, issueFound: true, pending: [], main: green };

describe('merge refusals (D-3)', () => {
  it('a PR in its end state, running checks, nothing pending: no refusal', () => {
    assert.deepEqual(mergeRefusals({ ...ok, pr: openPR() }), []);
  });
  it('closed, another base, draft, failed check, conflict', () => {
    assert.match(reasons(mergeRefusals({ ...ok, pr: openPR({ state: 'MERGED' }) })), /MERGED, not OPEN/);
    assert.match(reasons(mergeRefusals({ ...ok, pr: openPR({ baseRefName: 'dev' }) })), /targets dev/);
    assert.match(reasons(mergeRefusals({ ...ok, pr: openPR({ isDraft: true }) })), /draft/);
    assert.match(reasons(mergeRefusals({ ...ok, pr: openPR({ statusCheckRollup: [{ name: 'warrant', conclusion: 'FAILURE' }] }) })), /failed checks: warrant/);
    assert.match(reasons(mergeRefusals({ ...ok, pr: openPR({ mergeStateStatus: 'DIRTY' }) })), /conflict/);
  });
  it('the record on the head must be in the end state of its PR kind', () => {
    assert.match(reasons(mergeRefusals({ ...ok, record: { change_state: 'IMPLEMENTING' }, pr: openPR() })), /IMPLEMENTING, not VERIFYING/);
    assert.match(reasons(mergeRefusals({ ...ok, record: { change_state: 'PROPOSED' }, pr: openPR({ headRefName: 'spec/x' }) })), /not SPECIFIED/);
    assert.match(reasons(mergeRefusals({ ...ok, record: null, pr: openPR() })), /no record/);
  });
  it('a Change PR whose issue is not found is refused; a docs PR has no record or issue check', () => {
    assert.match(reasons(mergeRefusals({ ...ok, issueFound: false, pr: openPR() })), /no issue names Change/);
    assert.deepEqual(mergeRefusals({ ...ok, record: null, issueFound: false, pr: openPR({ headRefName: 'docs/issue-85' }) }), []);
  });
  it('a pending entry and a red main refuse; a fix-main Change merges on a red main', () => {
    assert.match(reasons(mergeRefusals({ ...ok, pending: [{ url: plan.url, line: '[decision] …' }], pr: openPR() })), /not acknowledged/);
    const red = { state: 'red', note: 'test red u' };
    assert.match(reasons(mergeRefusals({ ...ok, main: red, pr: openPR() })), /main is red/);
    assert.deepEqual(mergeRefusals({ ...ok, main: red, pr: openPR({ headRefName: 'impl/fix-main-120' }) }), []);
    assert.deepEqual(mergeRefusals({ ...ok, main: { state: 'unknown', note: 'n' }, pr: openPR() }), []);
  });
});

describe('worktree, waiver, patch (D-5, D-6)', () => {
  const wt = [{ path: 'D:/wt' }];
  it('one clean worktree at or behind its remote passes', () => {
    assert.deepEqual(worktreeRefusals({ branch: 'impl/x', matches: wt, dirty: [], relation: 'equal' }), []);
    assert.deepEqual(worktreeRefusals({ branch: 'impl/x', matches: wt, dirty: [], relation: 'behind' }), []);
  });
  it('none, several, dirty, unpushed', () => {
    assert.match(reasons(worktreeRefusals({ branch: 'impl/x', matches: [], dirty: [], relation: null })), /no worktree/);
    assert.match(reasons(worktreeRefusals({ branch: 'impl/x', matches: [...wt, ...wt], dirty: [], relation: 'equal' })), /several/);
    assert.match(reasons(worktreeRefusals({ branch: 'impl/x', matches: wt, dirty: ['?? .warrant/runs/RUN-1.json'], relation: 'equal' })), /has changes/);
    assert.match(reasons(worktreeRefusals({ branch: 'impl/x', matches: wt, dirty: [], relation: 'ahead' })), /not on origin/);
  });
  const w = { change: 'x', wav: 'WAV-2026-007', cli: '0.10.0', kernel: '0.10' };
  it('a PROPOSED waiver of the Change, a unique id, the pinned warrant: no refusal', () => {
    assert.deepEqual(waiverRefusals({ ...w, waiver: { change: 'x', waiver_state: 'PROPOSED' }, others: [] }), []);
  });
  it('missing, another Change, not PROPOSED, the id on another impl branch (SRA#139), another warrant', () => {
    assert.match(reasons(waiverRefusals({ ...w, waiver: null, others: [] })), /no WAV-2026-007/);
    assert.match(reasons(waiverRefusals({ ...w, waiver: { change: 'y', waiver_state: 'PROPOSED' }, others: [] })), /waiver of y/);
    assert.match(reasons(waiverRefusals({ ...w, waiver: { change: 'x', waiver_state: 'ACTIVE' }, others: [] })), /ACTIVE, not PROPOSED/);
    assert.match(reasons(waiverRefusals({ ...w, waiver: { change: 'x', waiver_state: 'PROPOSED' }, others: [{ ref: 'origin/impl/y', change: 'y' }] })), /also a waiver of y on origin\/impl\/y/);
    assert.match(reasons(waiverRefusals({ ...w, cli: '0.11.0', waiver: { change: 'x', waiver_state: 'PROPOSED' }, others: [] })), /pins 0.10/);
  });
  const allow = ['.warrant/warrant.json', '.warrant/warrant.lock.json', '.warrant/local/**', '.warrant/waivers/**', '.claude/**',
    '**/AGENTS.md', '.github/workflows/**', 'package.json', 'package-lock.json', '**/tsconfig*.json'];
  it('globs', () => {
    assert.ok(globToRegExp('**/AGENTS.md').test('AGENTS.md'));
    assert.ok(globToRegExp('**/tsconfig*.json').test('test/tsconfig.build.json'));
    assert.ok(!globToRegExp('.claude/*').test('.claude/skills/x'));
  });
  it('a patch carries only paths no Run writes; the refused list wins over the profile (I-2)', () => {
    for (const p of ['.warrant/local/rules/process.json', '.claude/skills/slice/act.mjs', 'package.json', 'openspec/changes/x/proposal.md']) {
      assert.equal(patchPathWriter(p, 'x', allow), null, p);
    }
    assert.equal(patchPathWriter('src/kernel/index.ts', 'x', allow), 'the implement Run');
    assert.equal(patchPathWriter('openspec/changes/x/design.md', 'x', allow), 'the implement Run');
    assert.equal(patchPathWriter('AGENTS.md', 'x', allow), 'warrant sync');
    assert.equal(patchPathWriter('.warrant/warrant.lock.json', 'x', allow), 'warrant sync');
    assert.equal(patchPathWriter('.warrant/waivers/WAV-2026-007.json', 'x', allow), 'warrant only (rule process)');
    assert.match(patchPathWriter('README.md', 'x', allow), /not a path/);
  });
  it('patch refusals: missing, inside the repository, not applying, a path of a Run', () => {
    assert.match(reasons(patchRefusals({ file: { path: 'D:/p', exists: false } })), /no patch file/);
    const base = { change: 'x', allowGlobs: allow, applies: true };
    assert.deepEqual(patchRefusals({ ...base, file: { path: 'D:/tmp/p', exists: true }, paths: ['.claude/skills/slice/act.mjs'] }), []);
    assert.match(reasons(patchRefusals({ ...base, file: { path: 'D:/r/p', exists: true, insideRepo: true }, paths: ['package.json'] })), /inside a worktree/);
    assert.match(reasons(patchRefusals({ ...base, applies: false, applyError: 'patch failed', file: { path: 'p', exists: true }, paths: ['package.json'] })), /does not apply/);
    assert.match(reasons(patchRefusals({ ...base, file: { path: 'p', exists: true }, paths: ['src/a.ts'] })), /implement Run/);
  });
  it('branches of a Change', () => {
    assert.deepEqual(changeOfBranch('archive/s0-store-2'), { kind: 'archive', change: 's0-store-2' });
    assert.equal(changeOfBranch('claude/quizzical-bose'), null);
  });
});

describe('the watcher (D-7)', () => {
  const f = (over = {}) => ({ number: 116, state: 'OPEN', url: 'u', mergeStateStatus: 'BLOCKED', autoMerge: false,
    headRefOid: 'h1', headRefName: 'impl/x', main: green, ...over });
  it('merged and closed exit 0; a conflict exits 4', () => {
    assert.deepEqual([watchStep(f({ state: 'MERGED', mergeCommit: 'm' })).exit, watchStep(f({ state: 'MERGED', mergeCommit: 'm' })).line],
      [0, 'PR #116 MERGED m u']);
    assert.equal(watchStep(f({ state: 'CLOSED' })).exit, 0);
    assert.equal(watchStep(f({ mergeStateStatus: 'DIRTY' })).exit, 4);
  });
  it('behind without auto-merge waits; with it, updates once per head', () => {
    assert.equal(watchStep(f({ mergeStateStatus: 'BEHIND' })).update, undefined);
    const s = watchStep(f({ mergeStateStatus: 'BEHIND', autoMerge: true }));
    assert.equal(s.update, true);
    assert.equal(watchStep(f({ mergeStateStatus: 'BEHIND', autoMerge: true }), s.memo).update, undefined);
    assert.equal(watchStep(f({ mergeStateStatus: 'BEHIND', autoMerge: true, headRefOid: 'h2' }), s.memo).update, true);
  });
  it('auto-merge seen and then off exits 5; never seen waits', () => {
    const s = watchStep(f({ autoMerge: true }));
    assert.equal(watchStep(f(), s.memo).exit, 5);
    assert.equal(watchStep(f()).exit, undefined);
  });
  it('a red main turns auto-merge off and exits 5, except for a fix-main Change', () => {
    const red = { state: 'red', note: 'test red r' };
    const s = watchStep(f({ autoMerge: true, main: red }));
    assert.deepEqual([s.exit, s.disableAuto], [5, true]);
    assert.match(s.line, /AUTO-MERGE OFF \(main red: test red r\)/);
    assert.equal(watchStep(f({ autoMerge: true, main: red, headRefName: 'impl/fix-main-120' })).exit, undefined);
  });
});

describe('the local judge (#124, I-22)', () => {
  const ok = { ok: true, errors: [] };
  // The shape of `warrant ci` on this impl-PR at VERIFYING, before CI and the merge.
  const implWaiting = { ok: false, data: { kind: 'impl',
    gates: { 'analyze-clean': 'PASS', 'evidence-complete': 'FAIL', 'factory-golden-passed': 'BLOCKED', 'human-approval': 'BLOCKED', 'ids-valid': 'PASS', 'scope-valid': 'PASS', 'spec-approved': 'PASS', 'tests-passed': 'BLOCKED' },
    findings: [
      { code: 'STALE', kind: 'human-approval', reason: 'commit' },
      { code: 'EVIDENCE_MISSING', gate: 'evidence-complete', items: ['test-report'] },
      { code: 'ATTESTATION_REQUIRED', gate: 'factory-golden-passed', kind: 'test-report' },
      { code: 'NO_EVIDENCE', gate: 'human-approval', kind: 'human-approval' },
      { code: 'ATTESTATION_REQUIRED', gate: 'tests-passed', kind: 'test-report' },
    ] },
    errors: ['evidence-complete', 'factory-golden-passed', 'tests-passed'].map((g) => ({ code: 'GATE_NOT_PASSED', message: `gate ${g}` })) };
  it('an impl-PR waiting only on CI and the merge passes', () => {
    const v = judgeVerdict({ validate: ok, syncCheck: ok, ci: implWaiting });
    assert.equal(v.ok, true);
    assert.deepEqual(v.waits, ['evidence-complete', 'factory-golden-passed', 'human-approval', 'tests-passed']);
  });
  it('a failed validate is a violation though warrant ci waits only on CI (the case of #122)', () => {
    const v = judgeVerdict({ validate: { ok: false, errors: [{ code: 'ID_DANGLING' }] }, syncCheck: ok, ci: implWaiting });
    assert.equal(v.ok, false);
    assert.match(v.lines.join('\n'), /warrant validate: ID_DANGLING/);
  });
  it('a stale generated file is a violation', () => {
    assert.equal(judgeVerdict({ validate: ok, syncCheck: { ok: false, errors: [{ code: 'GENERATED_DRIFT' }] }, ci: { ok: true, data: { kind: 'spec' } } }).ok, false);
  });
  it('an impl-PR with another failed gate or an IMPLEMENTING record is a violation', () => {
    const scope = structuredClone(implWaiting);
    scope.data.gates['scope-valid'] = 'FAIL';
    scope.data.findings.push({ code: 'SCOPE_VIOLATION', gate: 'scope-valid' });
    assert.match(judgeVerdict({ validate: ok, syncCheck: ok, ci: scope }).lines.join(), /gate scope-valid, SCOPE_VIOLATION \(scope-valid\)/);
    const early = { ...implWaiting, errors: [...implWaiting.errors, { code: 'CHANGE_NOT_VERIFYING' }] };
    assert.match(judgeVerdict({ validate: ok, syncCheck: ok, ci: early }).lines.join(), /CHANGE_NOT_VERIFYING/);
  });
  it('a spec-PR must pass warrant ci outright; no JSON is a violation', () => {
    const spec = { ok: false, data: { kind: 'spec', gates: { 'human-approval': 'BLOCKED' }, findings: [{ code: 'NO_EVIDENCE', kind: 'human-approval' }] }, errors: [{ code: 'GATE_NOT_PASSED' }] };
    assert.equal(judgeVerdict({ validate: ok, syncCheck: ok, ci: spec }).ok, false);
    assert.equal(judgeVerdict({ validate: ok, syncCheck: ok, ci: null }).ok, false);
    assert.equal(judgeVerdict({ validate: null, syncCheck: ok, ci: { ok: true, data: { kind: 'archive' } } }).ok, false);
  });
});
