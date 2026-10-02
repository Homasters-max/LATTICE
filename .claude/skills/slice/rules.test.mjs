// node --test .claude/skills/slice/rules.test.mjs — the rules of the skill slice on fixtures (Change infra-process-rules).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaHolders, claimChanges, collisionsOf, dependsOn, heldFor, issueKind, mainState, parseIssue, validateResult, versionMatches } from './rules.mjs';

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

describe('AREA holders and collisions (D-3)', () => {
  // #92: s0-apply-checks and s0-store both declared CL within a minute; both ran `warrant init change`.
  const applyChecks = { change: 's0-apply-checks', areas: ['LG', 'AR', 'CL'], initAt: '2026-10-02T07:40:10.000Z' };
  const store = { change: 's0-store', areas: ['SR', 'CL'], initAt: '2026-10-02T07:41:02.000Z' };
  const kernel = { change: 's0-kernel', areas: ['KR'], initAt: '2026-10-02T07:39:00.000Z' };

  it('the later holder of CL is in a collision, the first keeps it', () => {
    const { busy, collisions } = areaHolders([store, kernel, applyChecks]);
    assert.deepEqual(busy.get('CL'), ['s0-apply-checks', 's0-store']);
    assert.deepEqual(collisions, [{ area: 'CL', first: 's0-apply-checks', later: ['s0-store'] }]);
    assert.deepEqual(collisionsOf('s0-store', collisions, busy), [{ area: 'CL', with: 's0-apply-checks' }]);
    assert.deepEqual(collisionsOf('s0-apply-checks', collisions, busy), []);
    assert.deepEqual(busy.get('SR'), ['s0-store']);
  });
  it('one holder per AREA is no collision', () => {
    const { collisions } = areaHolders([kernel, applyChecks]);
    assert.deepEqual(collisions, []);
  });
  it('equal or missing init times: every holder collides', () => {
    const same = areaHolders([applyChecks, { ...store, initAt: applyChecks.initAt }]);
    assert.deepEqual(same.collisions, [{ area: 'CL', first: null, later: ['s0-apply-checks', 's0-store'] }]);
    assert.deepEqual(collisionsOf('s0-store', same.collisions, same.busy), [{ area: 'CL', with: 's0-apply-checks' }]);
    const missing = areaHolders([applyChecks, { ...store, initAt: null }]);
    assert.equal(missing.collisions.length, 1);
    assert.equal(missing.collisions[0].later.length, 2);
  });
  it('a fix-main-* Change never collides, but holds against later ones when it came first', () => {
    const fixLate = { change: 'fix-main-92', areas: ['CL'], initAt: '2026-10-02T09:00:00.000Z' };
    assert.deepEqual(areaHolders([applyChecks, fixLate]).collisions, []);
    const fixFirst = { ...fixLate, initAt: '2026-10-02T07:00:00.000Z' };
    assert.deepEqual(areaHolders([applyChecks, fixFirst]).collisions, [{ area: 'CL', first: 'fix-main-92', later: ['s0-apply-checks'] }]);
  });
  it('a Change without a record waits for a held AREA; a fix-main-* waits for none', () => {
    const { busy } = areaHolders([applyChecks]);
    assert.deepEqual(heldFor('s0-store-cli', ['CL'], busy), [{ area: 'CL', by: 's0-apply-checks' }]);
    assert.deepEqual(heldFor('s0-apply-checks', ['CL'], busy), []);
    assert.deepEqual(heldFor('fix-main-92', ['CL'], busy), []);
  });
});

describe('issues (D-4, item 7 of #97)', () => {
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
    const bug = parseIssue({ number: 100, title: 'infra: policy paths changed without a Change', body: 'Where: process; Change `infra-process-rules` (#97), AREA `CL`', labels: label('bug', 'P2') });
    const [a, b] = claimChanges([bug, own]);
    assert.equal(a.change, null);
    assert.equal(a.refersTo, 'infra-process-rules');
    assert.equal(a.kind, 'bug');
    assert.deepEqual(a.areas, []);
    assert.equal(b.change, 'infra-process-rules');
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
