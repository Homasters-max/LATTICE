// node --test .claude/skills/slice/rules.test.mjs — the rules of the skill slice on fixtures (Changes infra-process-rules,
// infra-coordinator).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentsBudget, areasAddedAfterInit, claimChanges, closable, dependsOn, dispatch, firstSentence, holdersOf, isOpenP1WithoutChange,
  issueKind, mainState, maintainerQueue, nextAction, parseIssue, references, section, testResult, validateResult, versionMatches,
} from './rules.mjs';

const label = (...names) => names.map((name) => ({ name }));

describe('health of main (D-2)', () => {
  it('red over unknown over green', () => {
    assert.equal(mainState([{ state: 'green' }, { state: 'green' }]), 'green');
    assert.equal(mainState([{ state: 'green' }, { state: 'unknown' }]), 'unknown');
    assert.equal(mainState([{ state: 'unknown' }, { state: 'red' }]), 'red');
    assert.equal(mainState([{ state: 'red' }, { state: 'green' }]), 'red');
  });
  it('a failed warrant validate is red with its codes counted (the main of #92)', () => {
    const dup = (id) => ({ code: 'ID_DUPLICATE', message: `${id} is declared more than once` });
    const r = validateResult({ ok: false, errors: [...['REQ-CL-001', 'REQ-CL-004', 'SCN-CL-001'].map(dup), { code: 'LOCK_MISMATCH' }] }, 'ed52281');
    assert.equal(r.state, 'red');
    assert.equal(r.note, 'warrant validate ed52281: ID_DUPLICATE ×3, LOCK_MISMATCH');
  });
  it('ok is green; no envelope is unknown', () => {
    assert.equal(validateResult({ ok: true, errors: [] }, '59711ac').state, 'green');
    assert.equal(validateResult(null, '59711ac').state, 'unknown');
    assert.equal(validateResult({ data: {} }, '59711ac').state, 'unknown');
  });
  it('only a failed test run is red; a cancelled or skipped one is unknown', () => {
    assert.equal(testResult({ conclusion: 'success', url: 'u' }).state, 'green');
    assert.equal(testResult({ conclusion: 'failure', url: 'u' }).state, 'red');
    assert.equal(testResult({ conclusion: 'timed_out', url: 'u' }).state, 'red');
    assert.equal(testResult({ conclusion: 'cancelled', url: 'u' }).state, 'unknown');
    assert.equal(testResult({ conclusion: 'skipped', url: 'u' }).note, 'test skipped u');
    assert.equal(testResult(undefined).state, 'unknown');
  });
  it('the CLI version is checked against the kernel range of warrant.json', () => {
    assert.ok(versionMatches('0.10.0', '0.10'));
    assert.ok(versionMatches('0.10.3', '0.10'));
    assert.ok(versionMatches('0.10.0', '0.10.0'));
    assert.ok(!versionMatches('0.11.0', '0.10'));
    assert.ok(!versionMatches('0.10.1', '0.10.0'));
    assert.ok(!versionMatches('', '0.10'));
    assert.ok(!versionMatches('0.10.0', null));
  });
});

// #92: s0-apply-checks and s0-store both declared CL within a minute; both ran `warrant init change`.
const applyChecks = { change: 's0-apply-checks', areas: ['LG', 'AR', 'CL'], initAt: '2026-10-02T07:40:10.000Z' };
const store = { change: 's0-store', areas: ['SR', 'CL'], initAt: '2026-10-02T07:41:02.000Z' };
const kernel = { change: 's0-kernel', areas: ['KR'], initAt: '2026-10-02T07:39:00.000Z' };

describe('AREA holders and collisions (D-3)', () => {
  it('the later holder of CL is in a collision, the first keeps it', () => {
    const h = holdersOf([store, kernel, applyChecks]);
    assert.deepEqual(h.busy.get('CL'), ['s0-apply-checks', 's0-store']);
    assert.deepEqual(h.collisions, [{ area: 'CL', first: 's0-apply-checks', later: ['s0-store'] }]);
    assert.deepEqual(h.collisionsOf('s0-store'), [{ area: 'CL', with: 's0-apply-checks' }]);
    assert.deepEqual(h.collisionsOf('s0-apply-checks'), []);
    assert.deepEqual(h.busy.get('SR'), ['s0-store']);
  });
  it('one holder per AREA is no collision', () => {
    assert.deepEqual(holdersOf([kernel, applyChecks]).collisions, []);
  });
  it('equal or missing init times: every holder collides', () => {
    const same = holdersOf([applyChecks, { ...store, initAt: applyChecks.initAt }]);
    assert.deepEqual(same.collisions, [{ area: 'CL', first: null, later: ['s0-apply-checks', 's0-store'] }]);
    assert.deepEqual(same.collisionsOf('s0-store'), [{ area: 'CL', with: 's0-apply-checks' }]);
    const missing = holdersOf([applyChecks, { ...store, initAt: null }]);
    assert.equal(missing.collisions.length, 1);
    assert.equal(missing.collisions[0].later.length, 2);
  });
  it('a fix-main-* Change never collides, but holds against later ones when it came first', () => {
    const fixLate = { change: 'fix-main-92', areas: ['CL'], initAt: '2026-10-02T09:00:00.000Z' };
    assert.deepEqual(holdersOf([applyChecks, fixLate]).collisions, []);
    const fixFirst = { ...fixLate, initAt: '2026-10-02T07:00:00.000Z' };
    assert.deepEqual(holdersOf([applyChecks, fixFirst]).collisions, [{ area: 'CL', first: 'fix-main-92', later: ['s0-apply-checks'] }]);
  });
  it('a Change without a record waits for a held AREA; a fix-main-* waits for none', () => {
    const h = holdersOf([applyChecks]);
    assert.deepEqual(h.heldFor('s0-store-cli', ['CL']), [{ area: 'CL', by: 's0-apply-checks' }]);
    assert.deepEqual(h.heldFor('s0-apply-checks', ['CL']), []);
    assert.deepEqual(h.heldFor('fix-main-92', ['CL']), []);
  });
});

// A row of the table, as status.mjs builds it.
const row = (over) => ({
  change: null, kind: 'docs', refersTo: undefined, issueState: 'OPEN', state: null, areas: [], hasWorktree: false,
  archivedOnMain: false, open: null, merged: { spec: false, impl: false }, deps: [], collided: [], ...over,
});
const ctx = (over) => ({ heldFor: () => [], wipCount: 0, ...over });

describe('next action, dispatch and the maintainer queue (D-3, D-5, I-3)', () => {
  it('the #92 case: both spec-PRs open; the later holder waits for a decision, one queue row for CL', () => {
    const h = holdersOf([applyChecks, store]);
    const pr = (number) => ({ number, kind: 'spec', checks: 'green', isDraft: false });
    const first = nextAction(row({ change: 's0-apply-checks', kind: 'change', state: 'SPECIFIED', open: pr(87), collided: h.collisionsOf('s0-apply-checks') }), ctx());
    const later = nextAction(row({ change: 's0-store', kind: 'change', state: 'SPECIFIED', open: pr(89), collided: h.collisionsOf('s0-store') }), ctx());
    assert.deepEqual(first, { text: 'merge spec-PR #87', who: '👤 maintainer', action: 'merge' });
    assert.deepEqual(later, { text: 'AREA collision CL with s0-apply-checks — needs a decision', who: '👤 maintainer', action: null });
    const q = maintainerQueue({
      rows: [
        { change: 's0-apply-checks', number: 56, ...first, url: 'pr87', collided: [] },
        { change: 's0-store', number: 57, ...later, url: 'pr89', collided: h.collisionsOf('s0-store') },
      ],
      collisions: h.collisions, busy: h.busy, depPRs: [], mainState: 'green',
    });
    assert.deepEqual(q, [
      { what: 'AREA collision CL: s0-apply-checks, s0-store — needs a decision', url: '' },
      { what: 's0-apply-checks: merge spec-PR #87', url: 'pr87' },
    ]);
  });
  it('a red main blocks dispatch and holds merges, except for a fix-main-* Change', () => {
    const launch = nextAction(row({ change: 's0-codec-forms', kind: 'change' }), ctx());
    assert.equal(launch.action, 'start');
    assert.deepEqual(dispatch('s0-codec-forms', launch, 'red'), { startable: false, text: 'launch — blocked: main is red', who: '—' });
    assert.deepEqual(dispatch('s0-codec-forms', launch, 'unknown'), { startable: true, text: 'launch', who: 'coordinator' });
    assert.equal(dispatch('fix-main-92', nextAction(row({ change: 'fix-main-92', kind: 'change' }), ctx()), 'red').startable, true);
    const merge = (change, number) => ({ change, number, who: '👤 maintainer', text: `merge impl-PR #${number}`, action: 'merge', url: `pr${number}`, collided: [] });
    const q = maintainerQueue({
      rows: [merge('s0-kernel', 102), merge('fix-main-92', 110)], collisions: [], busy: new Map(),
      depPRs: [{ number: 111, title: 'dep', url: 'pr111', checks: 'green', head: 'impl/fix-main-93', dependentOf: 61 }], mainState: 'red',
    });
    assert.deepEqual(q.map((x) => x.what), [
      's0-kernel: merge impl-PR #102 — held: main is red', 'fix-main-92: merge impl-PR #110', '#111 dep (dependency of #61, CI green)',
    ]);
  });
  it('the WIP cap stops an impl-PR start, but not a fix-main-*', () => {
    const r = (change) => row({ change, kind: 'change', state: 'SPECIFIED', merged: { spec: true, impl: false } });
    assert.equal(nextAction(r('s0-bootstrap'), ctx({ wipCount: 3 })).text, 'wait WIP 3/3');
    assert.equal(nextAction(r('fix-main-92'), ctx({ wipCount: 3 })).action, 'start');
    assert.equal(nextAction(r('s0-bootstrap'), ctx({ wipCount: 2 })).action, 'start');
  });
  it('bug and question issues are not docs PRs; a draft PR waits for its owner', () => {
    assert.deepEqual(nextAction(row({ kind: 'bug' }), ctx()), { text: 'bug: needs a fix Change or a PR that closes it', who: '—', action: null });
    assert.equal(nextAction(row({ kind: 'bug', refersTo: 'infra-process-rules' }), ctx()).text, 'bug: fixed by Change infra-process-rules');
    assert.equal(nextAction(row({ kind: 'question' }), ctx()).who, '👤 maintainer');
    assert.equal(nextAction(row({ kind: 'docs' }), ctx()).text, 'launch (docs PR)');
    const draft = { number: 120, kind: 'docs', checks: 'green', isDraft: true };
    assert.equal(nextAction(row({ kind: 'docs', open: draft }), ctx()).text, 'finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)');
    assert.equal(nextAction(row({ change: 'x', kind: 'change', state: 'PROPOSED', open: { ...draft, kind: 'spec' } }), ctx()).text,
      'finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)');
  });
  it('a Change without a record waits for its held AREA', () => {
    const h = holdersOf([applyChecks]);
    assert.equal(nextAction(row({ change: 's0-store-cli', kind: 'change', areas: ['CL'] }), ctx({ heldFor: h.heldFor })).text, 'wait AREA CL (s0-apply-checks)');
  });
});

describe('issues (D-4, I-16, I-17)', () => {
  it('the kind of an issue: Change, bug, question, docs', () => {
    assert.equal(issueKind('s0-kernel', ['bug']), 'change');
    assert.equal(issueKind(null, ['bug', 'P1']), 'bug');
    assert.equal(issueKind(null, ['question', 'P2']), 'question');
    assert.equal(issueKind(null, ['enhancement', 'P3']), 'docs');
  });
  it('a bug issue without a Change declares no AREA (#91)', () => {
    const i = parseIssue({ number: 91, body: 'Why: x\n\nWhere: slice S0, AREA `CL` — the cli spec\n', labels: label('bug', 'P1') });
    assert.equal(i.change, null);
    assert.deepEqual(i.areas, []);
    assert.equal(i.kind, 'bug');
    assert.deepEqual(i.labels, ['bug', 'P1']);
  });
  it('a Change issue keeps its AREAs', () => {
    const i = parseIssue({ number: 59, body: 'Where: Change `s0-bootstrap`, AREA `TR` + `AC` + `CT` (see SL-T08)\n', labels: label('enhancement', 'P1') });
    assert.equal(i.change, 's0-bootstrap');
    assert.deepEqual(i.areas, ['TR', 'AC', 'CT']);
    assert.equal(i.kind, 'change');
  });
  it('of several issues naming one Change, the one titled with it is its issue; a bug naming it refers to it (#97, #100)', () => {
    const own = parseIssue({ number: 97, title: 'infra: infra-process-rules — WARRANT defects to SRA', body: 'Where: Change `infra-process-rules`, no AREA', labels: label('enhancement', 'P1') });
    const bug = parseIssue({ number: 100, title: 'infra: policy paths changed without a Change', body: 'Where: process; Change `infra-process-rules` (#97), AREA `CL`', labels: label('bug', 'P1') });
    const [a, b] = claimChanges([bug, own]);
    assert.equal(a.change, null);
    assert.equal(a.refersTo, 'infra-process-rules');
    assert.equal(a.kind, 'bug');
    assert.deepEqual(a.areas, []);
    assert.equal(b.change, 'infra-process-rules');
    // A P1 bug that a Change fixes is not "without a Change".
    assert.equal(isOpenP1WithoutChange({ ...a, state: 'OPEN' }), false);
    assert.equal(isOpenP1WithoutChange({ ...a, refersTo: undefined, state: 'OPEN' }), true);
    // s0-store is not named by the title of s0-store-2; without a titled issue the oldest is the Change's.
    const s2 = parseIssue({ number: 57, title: 's0: s0-store-2 — JSONL store', body: 'Where: Change `s0-store`, AREA `SR`', labels: [] });
    const s1 = parseIssue({ number: 80, title: 's0: store notes', body: 'Where: Change `s0-store`', labels: label('question') });
    assert.deepEqual(claimChanges([s1, s2]).map((i) => i.change), [null, 's0-store']);
  });
  it('"Depends on:" is read to the end of its first sentence', () => {
    assert.deepEqual(dependsOn('Depends on: none.\n\nCloses #94 (in its impl-PR).'), { issues: [], branches: [] });
    assert.deepEqual(dependsOn('Depends on: none. Closes #94.'), { issues: [], branches: [] });
    assert.deepEqual(dependsOn('Depends on: #55, #56 and `impl/pin-v0.10.0`. Refs #92.'), { issues: [55, 56], branches: ['impl/pin-v0.10.0'] });
    assert.deepEqual(dependsOn('Depends on: #54'), { issues: [54], branches: [] });
    assert.deepEqual(dependsOn('No such line'), { issues: [], branches: [] });
  });
});

// ---------- Change infra-coordinator (design D-4, I-1, I-7; #112) ----------

const where57 = (change, areas) => `Why: …\n\nWhere: Change \`${change}\`, AREA ${areas.map((a) => `\`${a}\``).join(' + ')} (\`SR\`, not \`ST\`).\n\nDepends on: #55.`;
// The edit history of #57 as GitHub keeps it (userContentEdits; the oldest is the body as created).
const history57 = [
  { editedAt: '2026-10-01T17:14:29Z', body: where57('s0-store', ['ST']) },
  { editedAt: '2026-10-01T17:27:18Z', body: where57('s0-store', ['SR']) },
  { editedAt: '2026-10-02T07:25:34Z', body: where57('s0-store', ['SR', 'CL']) },
  { editedAt: '2026-10-02T08:25:59Z', body: where57('s0-store-2', ['SR', 'CL']) },
  { editedAt: '2026-10-02T08:46:29Z', body: where57('s0-store-2', ['SR']) },
];

describe('an AREA added after init (infra-coordinator D-4)', () => {
  it('the real history of #57 raises no flag: CL came 11 s before the init of s0-store, s0-store-2 kept SR', () => {
    const today = history57.at(-1).body;
    assert.deepEqual(areasAddedAfterInit({ change: 's0-store', body: today, revisions: history57, initAt: '2026-10-02T07:25:45.020Z' }), []);
    assert.deepEqual(areasAddedAfterInit({ change: 's0-store-2', body: today, revisions: history57, initAt: '2026-10-02T08:49:09.533Z' }), []);
    assert.deepEqual(areasAddedAfterInit({ change: 's0-store', body: history57[2].body, revisions: history57.slice(0, 3), initAt: '2026-10-02T07:25:45.020Z' }), []);
  });
  it('an edit after init is flagged, with the time of the edit that added it', () => {
    const later = [...history57, { editedAt: '2026-10-02T09:30:00Z', body: where57('s0-store-2', ['SR', 'CL']) }];
    assert.deepEqual(areasAddedAfterInit({ change: 's0-store-2', body: later.at(-1).body, revisions: later, initAt: '2026-10-02T08:49:09.533Z' }),
      [{ area: 'CL', editedAt: '2026-10-02T09:30:00Z', decision: null }]);
  });
  it('an edit within 60 s after init counts as before it (two clocks); 90 s does not', () => {
    const at = (s) => new Date(Date.parse('2026-10-02T10:00:00Z') + s * 1000).toISOString();
    const revs = (s) => [{ editedAt: '2026-10-01T10:00:00Z', body: where57('x', ['SR']) }, { editedAt: at(s), body: where57('x', ['SR', 'CL']) }];
    assert.deepEqual(areasAddedAfterInit({ change: 'x', body: revs(30)[1].body, revisions: revs(30), initAt: '2026-10-02T10:00:00Z' }), []);
    assert.equal(areasAddedAfterInit({ change: 'x', body: revs(90)[1].body, revisions: revs(90), initAt: '2026-10-02T10:00:00Z' }).length, 1);
  });
  it('a [decision] with "Adds: AREA CL to x" clears it, whenever posted; a [scope] or a decision without the line does not (I-7)', () => {
    const revs = [{ editedAt: '2026-10-01T10:00:00Z', body: where57('x', ['SR']) }, { editedAt: '2026-10-02T12:00:00Z', body: where57('x', ['SR', 'CL']) }];
    const run = (decisions) => areasAddedAfterInit({ change: 'x', body: revs[1].body, revisions: revs, initAt: '2026-10-02T10:00:00Z', decisions })[0].decision;
    const decision = { url: 'u#issuecomment-1', createdAt: '2026-10-02T09:00:00Z', body: '[decision] x takes CL. Touches: `x`.\n\nAdds: AREA `CL` to `x`' };
    assert.deepEqual(run([decision]), { url: 'u#issuecomment-1', createdAt: '2026-10-02T09:00:00Z' });
    assert.equal(run([{ ...decision, body: decision.body.replace('[decision]', '[scope]') }]), null);
    assert.equal(run([{ ...decision, body: '[decision] x must not take `CL`. Touches: `x`.' }]), null);
    assert.equal(run([{ ...decision, body: decision.body.replace('to `x`', 'to `x-2`') }]), null);
  });
  it('AR on a skip_specs Change is its own to add; a never edited issue and a renamed Change are not compared', () => {
    const revs = [{ editedAt: '2026-10-01T10:00:00Z', body: 'Where: Change `infra-x`, no AREA.' }, { editedAt: '2026-10-02T12:00:00Z', body: 'Where: Change `infra-x`, AREA `AR`.' }];
    assert.deepEqual(areasAddedAfterInit({ change: 'infra-x', body: revs[1].body, revisions: revs, initAt: '2026-10-02T10:00:00Z', skipSpecs: true }), []);
    assert.equal(areasAddedAfterInit({ change: 'infra-x', body: revs[1].body, revisions: revs, initAt: '2026-10-02T10:00:00Z' }).length, 1);
    assert.deepEqual(areasAddedAfterInit({ change: 'x', body: where57('x', ['SR', 'CL']), revisions: [], initAt: '2026-10-02T10:00:00Z' }), []);
  });
  it('an AREA added by a [decision] is held from that decision: an earlier holder keeps it (I-1)', () => {
    const h = holdersOf([
      { change: 'a', areas: ['CL'], initAt: '2026-10-02T08:00:00Z' },
      { change: 'b', areas: ['SR', 'CL'], initAt: '2026-10-02T07:00:00Z', areaAt: { CL: '2026-10-02T09:00:00Z' } },
    ]);
    assert.deepEqual(h.collisions, [{ area: 'CL', first: 'a', later: ['b'] }]);
    assert.deepEqual(h.busy.get('SR'), ['b']);
  });
});

describe('issues: kinds, sections, closable (infra-coordinator D-4, D-7; #112)', () => {
  it('an AREA with no Change is unnamed, not a docs PR — the old Where: of #86; bug and question come first', () => {
    const old86 = parseIssue({ number: 86, title: 's0: store port', state: 'OPEN', labels: label('enhancement', 'P3'),
      body: 'Why: …\n\nWhere: a separate small Change after `s0-store-2` is archived, AREA `SR`.\n' });
    assert.equal(old86.kind, 'unnamed');
    assert.deepEqual(old86.areas, []);
    assert.deepEqual(old86.declaredAreas, ['SR']);
    assert.equal(nextAction({ ...old86, deps: [], merged: {} }, { heldFor: () => [], wipCount: 0 }).who, '👤 coordinator');
    assert.equal(issueKind(null, ['bug'], ['CL']), 'bug');
    assert.equal(issueKind(null, ['question'], ['CL']), 'question');
    assert.equal(issueKind(null, [], []), 'docs');
  });
  it('Root cause and Prevention as bold lines or headings, up to the next label', () => {
    const body = 'Why: x\n\n**Root cause:**\n- the rule names no exception.\n\n**Prevention:** #97 items 2, 4 — the merge is the approval.\nMore.\n\nWhere: process';
    assert.equal(firstSentence(section(body, 'Root cause')), 'the rule names no exception.');
    assert.equal(section(body, 'Prevention'), '#97 items 2, 4 — the merge is the approval.\nMore.');
    assert.equal(section('## Prevention\nA test.\n## Other\nno', 'Prevention'), 'A test.');
    assert.equal(section('Why: nothing', 'Prevention'), null);
  });
  it('references: #N and its URL are local; SRA#N and another repository are foreign', () => {
    assert.deepEqual(references('#97, https://github.com/Homasters-max/LATTICE/pull/108 and Homasters-max/SRA#138; SRA#139'),
      { local: [97, 108], foreign: 2 });
  });
  it('closable: an archived Change, a process issue whose prevention landed, a bug fixed by a Change; never a question', () => {
    const ctx = { archivedOnMain: (c) => c === 'done-change', prState: (n) => ({ 108: 'MERGED', 109: 'OPEN' })[n] ?? null,
      issueOf: (n) => ({ 97: { state: 'CLOSED', change: 'done-change' }, 98: { state: 'OPEN', change: null } })[n] ?? null };
    const proc = (prevention) => ({ state: 'OPEN', change: null, labels: ['bug', 'process'], body: `**Root cause:** x.\n\n**Prevention:** ${prevention}` });
    assert.equal(closable({ state: 'OPEN', change: 'done-change', labels: [] }, ctx), 'archived');
    assert.equal(closable({ state: 'OPEN', change: 'open-change', labels: ['process'] }, ctx), null);
    assert.equal(closable(proc('#97 and #108.'), ctx), 'prevention landed');
    assert.equal(closable(proc('#97 and #109.'), ctx), null);
    assert.equal(closable(proc('#97 and Homasters-max/SRA#138.'), ctx), null);
    assert.equal(closable(proc('a rule, some day.'), ctx), null);
    assert.equal(closable({ state: 'OPEN', change: null, refersTo: 'done-change', labels: ['bug'] }, ctx), 'fixed by done-change');
    assert.equal(closable({ state: 'OPEN', change: null, refersTo: 'done-change', labels: ['question'] }, ctx), null);
    assert.equal(closable({ state: 'CLOSED', change: 'done-change', labels: [] }, ctx), null);
  });
  it('the AGENTS.md budget warns above 14 336 bytes', () => {
    assert.equal(agentsBudget(11528).state, 'ok');
    assert.equal(agentsBudget(16276).state, 'warn');
    assert.equal(agentsBudget(null).state, 'unknown');
  });
});
