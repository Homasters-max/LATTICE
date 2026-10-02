#!/usr/bin/env node
// Slice state, computed on every run: issues and PRs from GitHub, Change state from warrant (records on git refs,
// `warrant status` in each Change worktree), health of main from its `test` run and `warrant validate`.
// The rules themselves are pure functions in rules.mjs.
// Usage: node status.mjs <slice> [--next] [--json] [--main-ref <ref>]   |   node status.mjs <change | #issue> [--json] [--main-ref <ref>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { areaHolders, claimChanges, collisionsOf, heldFor, isFixMain, mainState, parseIssue, validateResult, versionMatches } from './rules.mjs';

const WIP_MAX = 3;
const IMPL = new Set(['APPROVED', 'IMPLEMENTING', 'VERIFYING']);
const RANK = { PROPOSED: 1, SPECIFIED: 2, APPROVED: 3, IMPLEMENTING: 4, VERIFYING: 5, MERGED: 6, ARCHIVED: 7, ABANDONED: 8 };
const ACTIVE = (s) => s && RANK[s] < RANK.ARCHIVED;
const KINDS = ['archive', 'impl', 'spec'];
const WIN = process.platform === 'win32';
const STALE_MS = 60 * 60 * 1000; // a temp worktree older than this was left by a killed run

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const option = (f) => { const k = argv.indexOf(f); return k >= 0 ? argv[k + 1] : undefined; };
const target = argv.find((a, k) => !a.startsWith('--') && argv[k - 1] !== '--main-ref');
if (!target || (flag('--main-ref') && !option('--main-ref'))) {
  console.error('usage: node status.mjs <slice> [--next] [--json] [--main-ref <ref>] | <change | #issue> [--json] [--main-ref <ref>]');
  process.exit(64);
}
const mainRef = option('--main-ref') ?? 'origin/main';

function sh(cmd, args, { cwd, ok = false, shell = false } = {}) {
  try {
    return execFileSync(cmd, args, { cwd, shell, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    if (ok) return e.stdout ?? '';
    throw new Error(`${cmd} ${args.join(' ')}: ${(e.stderr || e.message).trim()}`);
  }
}
const gh = (...a) => JSON.parse(sh('gh', a));
const git = (...a) => sh('git', a, { ok: true });
const warnings = [];

// ---------- sources ----------
git('fetch', '-q', '--prune', 'origin');
const milestones = gh('api', 'repos/{owner}/{repo}/milestones?state=all');
const prs = gh('pr', 'list', '--state', 'all', '--limit', '500', '--json',
  'number,title,headRefName,state,url,isDraft,statusCheckRollup,body');
const refs = new Set(git('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin').split('\n').filter(Boolean));
const worktrees = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/).map((b) => ({
  path: b.match(/^worktree (.+)$/m)?.[1],
  branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1],
})).filter((w) => w.path);
// Every issue of the repository: AREA holders and open P1 issues are not bounded by a milestone.
const ISSUE_FIELDS = 'number,title,state,body,url,milestone,labels';
const repoIssues = claimChanges(gh('issue', 'list', '--state', 'all', '--limit', '1000', '--json', ISSUE_FIELDS).map(parseIssue));
const issueCache = new Map(repoIssues.map((i) => [i.number, i]));
function issue(n) {
  if (!issueCache.has(n)) issueCache.set(n, claimChanges([...repoIssues, parseIssue(gh('issue', 'view', String(n), '--json', ISSUE_FIELDS))]).at(-1));
  return issueCache.get(n);
}

const live = new Map(); // worktree path -> Map(change -> state), from `warrant status`
function warrantStates(cwd) {
  if (!live.has(cwd)) {
    const m = new Map();
    try {
      const out = JSON.parse(sh('warrant', ['status'], { cwd, ok: true, shell: WIN }) || '{}');
      for (const c of out.data?.changes ?? []) m.set(c.change, c.change_state);
    } catch { /* not a warrant checkout */ }
    live.set(cwd, m);
  }
  return live.get(cwd);
}
const max = (a, b) => (!a ? b : !b ? a : RANK[b] > RANK[a] ? b : a);

// The record of a Change on a git ref, or in a worktree's files (before its first commit), or null.
function refRecord(ref, change) {
  if (!refs.has(ref)) return null;
  const rec = git('show', `${ref}:.warrant/changes/${change}.json`);
  try { return rec ? JSON.parse(rec) : null; } catch { return null; }
}
function fileRecord(dir, change) {
  try { return JSON.parse(readFileSync(join(dir, '.warrant', 'changes', `${change}.json`), 'utf8')); } catch { return null; }
}
// State: the furthest of the records and of `warrant status`; initAt: the time of `warrant init change`.
const infoCache = new Map();
function changeInfo(change) {
  if (infoCache.has(change)) return infoCache.get(change);
  let state = warrantStates(process.cwd()).get(change);
  let initAt = null;
  const take = (rec) => {
    if (!rec) return;
    state = max(state, rec.change_state ?? null);
    const at = rec.transitions?.[0]?.at;
    if (at && (!initAt || at < initAt)) initAt = at;
  };
  for (const ref of ['origin/main', ...KINDS.flatMap((k) => [`${k}/${change}`, `origin/${k}/${change}`])]) take(refRecord(ref, change));
  for (const w of worktrees) {
    if (!KINDS.some((k) => w.branch === `${k}/${change}`)) continue;
    state = max(state, warrantStates(w.path).get(change));
    take(fileRecord(w.path, change));
  }
  const info = { state, initAt };
  infoCache.set(change, info);
  return info;
}
const changeState = (change) => changeInfo(change).state;
// An archive-PR is merged when the record on origin/main is ARCHIVED.
const archivedOnMain = (change) => refRecord('origin/main', change)?.change_state === 'ARCHIVED';
const worktreeOf = (name) => worktrees.find((w) => w.branch && w.branch.split('/').slice(1).join('/') === name);

// ---------- slice ----------
function resolveSlice() {
  const m = milestones.find((x) => x.title.toLowerCase() === target.toLowerCase());
  if (m) return { slice: m, focus: null };
  const n = target.match(/^#?(\d+)$/)?.[1];
  const hit = n ? issue(Number(n)) : repoIssues.find((i) => i.change === target);
  if (!hit) { console.error(`no milestone or Change issue named "${target}"`); process.exit(2); }
  // An issue outside a slice is shown alone, against the repository-wide holders.
  if (!hit.milestone) return { slice: null, focus: hit.number };
  return { slice: milestones.find((x) => x.title === hit.milestone.title), focus: hit.number };
}
const { slice, focus } = resolveSlice();
const all = slice ? repoIssues.filter((i) => i.milestone?.title === slice.title) : [issue(focus)];
const umbrella = all.find((i) => i.umbrella);
const items = all.filter((i) => !i.umbrella).sort((a, b) => a.number - b.number);

// ---------- PRs ----------
function checks(pr) {
  const r = pr.statusCheckRollup ?? [];
  if (!r.length) return '—';
  const c = r.map((x) => x.conclusion || x.state || '');
  if (c.some((x) => /FAILURE|ERROR|CANCELLED|TIMED_OUT|ACTION_REQUIRED/.test(x))) return 'red';
  if (r.some((x) => (x.status && x.status !== 'COMPLETED') || x.state === 'PENDING')) return 'running';
  return 'green';
}
function prsOf(i) {
  const heads = i.change ? KINDS.map((k) => `${k}/${i.change}`) : [`docs/issue-${i.number}`];
  const closes = new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\\s+#${i.number}\\b`, 'i');
  return prs.filter((p) => heads.includes(p.headRefName) || closes.test(p.body ?? ''))
    .map((p) => ({ ...p, kind: p.headRefName.split('/')[0], checks: checks(p) }));
}

// ---------- AREAs ----------
// A Change holds its AREAs from `warrant init change` (a record exists) until the archive-PR is merged into main
// (the record is ARCHIVED on origin/main) or it is ABANDONED. Holders come from every issue of the repository.
const holds = (change) => { const s = changeState(change); return ACTIVE(s) || (s === 'ARCHIVED' && !archivedOnMain(change)); };
const holderList = [];
const seenChanges = new Set();
for (const i of repoIssues) {
  if (!i.change || !i.areas.length || seenChanges.has(i.change)) continue;
  seenChanges.add(i.change);
  if (holds(i.change)) holderList.push({ change: i.change, areas: i.areas, initAt: changeInfo(i.change).initAt });
}
const { busy, collisions } = areaHolders(holderList);

// ---------- rows ----------
const rows = items.map((i) => {
  const state = i.change ? changeState(i.change) : null;
  const wt = worktreeOf(i.change ?? `issue-${i.number}`);
  const ip = prsOf(i);
  const open = ip.find((p) => p.state === 'OPEN');
  const merged = (kind) => ip.some((p) => p.kind === kind && p.state === 'MERGED');
  const deps = [
    ...i.depIssues.map((n) => {
      const d = issue(n);
      // A Change dependency is done only when its archive-PR is merged; an issue without a Change when it is closed.
      if (!d.change) return { label: `#${n}`, done: d.state === 'CLOSED' };
      const s = changeState(d.change);
      if (s === 'ABANDONED') return { label: `#${n} abandoned`, done: false, decide: true };
      if (!s && d.state === 'CLOSED') return { label: `#${n} closed without a Change`, done: false, decide: true };
      return { label: `#${n}`, done: archivedOnMain(d.change) };
    }),
    ...i.depBranches.map((b) => {
      const p = prs.find((x) => x.headRefName === b);
      return { label: p ? `#${p.number}` : b, done: p?.state === 'MERGED', pr: p };
    }),
  ];
  const coll = i.change ? collisionsOf(i.change, collisions, busy) : [];
  return { ...i, issueState: i.state, state, wt, prs: ip, open, merged, deps, coll };
});

// In implementation (WIP): from the first impl commit until the impl-PR merges, across all slices; fix-main-* is exempt.
const implPR = (c, state) => prs.some((p) => p.headRefName === `impl/${c}` && p.state === state);
const inImpl = (c) => implPR(c, 'OPEN') || (IMPL.has(changeState(c)) && !implPR(c, 'MERGED'));
const candidates = new Set([...[...live.values()].flatMap((m) => [...m.keys()]), ...rows.map((r) => r.change).filter(Boolean),
  ...[...refs, ...prs.map((p) => p.headRefName)].map((x) => x.match(/^(?:origin\/)?impl\/(.+)$/)?.[1]).filter(Boolean)]);
const wip = [...candidates].filter((c) => !isFixMain(c)).filter(inImpl);
const wipCount = wip.length;

// ---------- health of main ----------
// test: the last completed `test.yml` run on main.
function testHealth() {
  try {
    const [run] = gh('run', 'list', '--workflow', 'test.yml', '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'conclusion,url');
    if (!run) return { state: 'unknown', note: 'test: no completed run on main yet' };
    const state = run.conclusion === 'success' ? 'green' : 'red';
    return { state, note: `test ${state} ${run.url}` };
  } catch {
    return { state: 'unknown', note: 'test: workflow test.yml not found' };
  }
}
// Temp worktrees of killed runs: registered, in the OS temp directory, named lattice-status-*, older than STALE_MS.
function sweepStale() {
  const tmp = resolve(tmpdir()).toLowerCase();
  for (const w of worktrees) {
    const p = resolve(w.path);
    if (dirname(p).toLowerCase() !== tmp || !basename(p).startsWith('lattice-status-')) continue;
    let age = Infinity;
    try { age = Date.now() - statSync(p).mtimeMs; } catch { /* gone: prune drops it */ }
    if (age > STALE_MS) git('worktree', 'remove', '--force', p);
  }
  git('worktree', 'prune');
}
// warrant: `warrant validate` on a detached checkout of mainRef in a fresh temp directory, removed afterwards.
function warrantHealth() {
  const sha = git('rev-parse', '--verify', '--quiet', `${mainRef}^{commit}`).trim();
  if (!sha) return { state: 'unknown', note: `warrant validate: ref ${mainRef} not found` };
  const short = sha.slice(0, 7);
  sweepStale();
  let dir;
  try { dir = mkdtempSync(join(tmpdir(), 'lattice-status-')); } catch (e) { return { state: 'unknown', note: `warrant validate ${short}: ${e.message}` }; }
  let added = false;
  try {
    try { sh('git', ['worktree', 'add', '--detach', '--quiet', dir, sha]); added = true; } catch (e) { return { state: 'unknown', note: `warrant validate ${short}: ${e.message}` }; }
    let kernel = null;
    try { kernel = JSON.parse(readFileSync(join(dir, '.warrant', 'warrant.json'), 'utf8')).kernel ?? null; } catch { /* no config */ }
    let cli = '';
    try { cli = sh('warrant', ['--version'], { shell: WIN }).trim().split(/\r?\n/)[0]; } catch { return { state: 'unknown', note: 'warrant validate: no warrant on PATH' }; }
    // A validate by another CLI version proves nothing about main.
    if (!versionMatches(cli, kernel)) return { state: 'unknown', note: `warrant ${cli} on PATH, ${short} pins ${kernel ?? '?'}` };
    let envelope = null;
    try { envelope = JSON.parse(sh('warrant', ['validate'], { cwd: dir, ok: true, shell: WIN })); } catch { /* not JSON */ }
    return validateResult(envelope, short);
  } finally {
    if (added) {
      try { sh('git', ['worktree', 'remove', '--force', dir]); } catch { warnings.push(`temp worktree left — git worktree remove --force ${dir.replace(/\\/g, '/')}`); }
    }
    if (existsSync(dir)) try { rmSync(dir, { recursive: true, force: true }); } catch { /* removed by the next sweep */ }
  }
}
const mainChecks = [testHealth(), warrantHealth()];
const main = { state: mainState(mainChecks), note: mainChecks.map((c) => c.note).join(' · '), checks: mainChecks };

// ---------- next action ----------
function next(r) {
  const p = r.open;
  const ci = p?.checks === 'running' ? ' (CI running)' : '';
  if (r.state === 'ABANDONED') return ['abandoned', '—'];
  // ARCHIVED on its branch only: the archive-PR is not merged — an open one goes through the PR checks below.
  if (r.state === 'ARCHIVED' && archivedOnMain(r.change)) return ['done', '—'];
  // A later holder of an AREA waits for the maintainer's decision, whatever its other next step (rule process).
  if (r.coll.length) return [`AREA collision ${r.coll.map((c) => `${c.area} with ${c.with}`).join(', ')} — needs a decision`, '👤 maintainer'];
  if (r.state === 'ARCHIVED' && !p) return ['open archive-PR', 'agent'];
  if (!r.state && r.issueState === 'CLOSED') return r.change ? ['closed without a Change — needs a decision', '👤 maintainer'] : ['done', '—'];
  if (!r.change && p) {
    return p.checks === 'red' ? [`fix CI on #${p.number}`, 'agent'] : p.isDraft ? ['finish the PR', 'agent'] : [`review + merge #${p.number}${ci}`, '👤 maintainer'];
  }
  // A bug or a question without a Change is not a docs PR (rule tracking).
  if (r.kind === 'bug') return [r.refersTo ? `bug: fixed by Change ${r.refersTo}` : 'bug: needs a fix Change or a PR that closes it', '—'];
  if (r.kind === 'question') return ["question: needs the maintainer's answer", '👤 maintainer'];
  if (p && p.checks === 'red') return [`fix CI on #${p.number}`, 'agent'];
  if (p && p.isDraft) return ['finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)', 'agent'];
  if (p && p.kind === 'spec') {
    // SPECIFIED is the last commit before the review is asked (rule process, step 1); the merge is the approval.
    if (r.state === 'PROPOSED') return ['verify, transition SPECIFIED, push — before the review', 'agent'];
    return [`merge spec-PR #${p.number}${ci}`, '👤 maintainer'];
  }
  if (p && p.kind === 'impl') return r.state === 'VERIFYING' ? [`merge impl-PR #${p.number}${ci}`, '👤 maintainer'] : ['implement → VERIFYING', 'agent'];
  if (p && p.kind === 'archive') return [`merge archive-PR #${p.number}${ci}`, '👤 maintainer'];
  if (p) return [`review + merge #${p.number}${ci}`, '👤 maintainer'];
  if (!r.state) {
    const decide = r.deps.filter((d) => d.decide).map((d) => d.label);
    if (decide.length) return [`decide on ${decide.join(', ')} (dependency)`, '👤 maintainer'];
    const wait = r.deps.filter((d) => !d.done).map((d) => d.label);
    if (wait.length) return [`wait ${wait.join(', ')}`, '—'];
    const held = heldFor(r.change, r.areas, busy);
    if (held.length) return [`wait AREA ${held.map((h) => `${h.area} (${h.by})`).join(', ')}`, '—'];
    if (r.wt) return [r.change ? 'spec: init change, specify' : 'open the docs PR', 'agent'];
    return [r.change ? 'launch' : 'launch (docs PR)', 'coordinator'];
  }
  switch (r.state) {
    case 'PROPOSED': return ['specify → review → spec-PR', 'agent'];
    case 'SPECIFIED':
      if (!r.merged('spec')) return ['open spec-PR', 'agent'];
      return wipCount < WIP_MAX || isFixMain(r.change) ? ['start impl-PR', 'coordinator'] : [`wait WIP ${wipCount}/${WIP_MAX}`, '—'];
    case 'APPROVED': case 'IMPLEMENTING': return ['implement → VERIFYING, impl-PR', 'agent'];
    case 'VERIFYING': return r.merged('impl') ? ['archive-PR', 'agent'] : ['open impl-PR', 'agent'];
    case 'MERGED': return ['warrant archive, archive-PR', 'agent'];
  }
  return ['?', '—'];
}
for (const r of rows) {
  [r.next, r.who] = next(r);
  r.startable = r.next === 'launch' || r.next === 'launch (docs PR)' || r.next === 'start impl-PR';
  // A red main blocks dispatch, except the fix of main (rule tracking).
  if (r.startable && main.state === 'red' && !isFixMain(r.change)) [r.next, r.who, r.startable] = [`${r.next} — blocked: main is red`, '—', false];
}

// ---------- maintainer queue ----------
const queue = [
  ...collisions.map((c) => ({ what: `AREA collision ${c.area}: ${busy.get(c.area).join(', ')} — needs a decision`, url: '' })),
  ...rows.filter((r) => r.who.startsWith('👤') && !r.coll.length)
    .map((r) => ({ what: `${r.change ?? `#${r.number}`}: ${r.next}`, url: r.open?.url ?? '', merge: /\bmerge\b/.test(r.next) && !isFixMain(r.change) })),
  ...rows.flatMap((r) => r.deps.filter((d) => d.pr?.state === 'OPEN' && !d.pr.isDraft)
    .map((d) => ({ what: `#${d.pr.number} ${d.pr.title} (dependency of #${r.number}, CI ${checks(d.pr)})`, url: d.pr.url, merge: true }))),
].filter((q, k, a) => a.findIndex((x) => (q.url ? x.url === q.url : x.what === q.what)) === k);
// While main is red only its fix is merged (rule tracking).
if (main.state === 'red') for (const q of queue) if (q.merge) q.what += ' — held: main is red';

// Open bug / question P1 issues without a Change, of this milestone and of none.
const openP1 = repoIssues.filter((i) => i.state === 'OPEN' && (i.kind === 'bug' || i.kind === 'question') && i.labels.includes('P1')
  && (!i.milestone || (slice && i.milestone.title === slice.title))).map((i) => i.number).sort((a, b) => a - b);

// ---------- output ----------
const areaLine = (r) => {
  if (!r.change) return null;
  if (isFixMain(r.change)) return 'AREA: exempt (fix-main)';
  if (!r.areas.length) return 'AREA: none';
  if (r.coll.length) return `AREA: collision ${r.coll.map((c) => `${c.area} with ${c.with}`).join(', ')} — stop and ask on the umbrella (no umbrella: in the issue)`;
  const held = heldFor(r.change, r.areas, busy);
  if (!r.state && held.length) return `AREA: wait ${held.map((h) => `${h.area} (${h.by})`).join(', ')}`;
  return `AREA: ${r.areas.join(' + ')} — ${holds(r.change) ? 'held by this Change, no collision' : 'free'}`;
};
const pick = (r) => ({ issue: r.number, change: r.change, refers_to: r.refersTo ?? null, kind: r.kind, areas: r.areas, state: r.state ?? (r.wt ? 'launched' : null),
  issue_state: r.issueState, pr: r.open ? { number: r.open.number, kind: r.open.kind, checks: r.open.checks, url: r.open.url } : null,
  depends: r.deps.map((d) => ({ on: d.label, done: d.done })), next: r.next, who: r.who, startable: r.startable,
  area: areaLine(r), worktree: r.wt?.path ?? null, url: r.url });
const shown = focus ? rows.filter((r) => r.number === focus) : flag('--next') ? rows.filter((r) => r.startable) : rows;
if (flag('--json')) {
  console.log(JSON.stringify({ slice: slice?.title ?? null, umbrella: umbrella?.number ?? null, main, wip: wipCount, wip_max: WIP_MAX,
    wip_changes: wip, busy_areas: Object.fromEntries(busy),
    area_collisions: collisions.map((c) => ({ area: c.area, changes: busy.get(c.area), later: c.later })),
    open_p1: openP1, maintainer_queue: queue.map(({ what, url }) => ({ what, url })), warnings, rows: shown.map(pick) }, null, 2));
  process.exit(0);
}
const cell = (s) => String(s).replace(/\|/g, '\\|');
const stateCell = (r) => r.state ?? (r.wt ? 'launched' : r.change ? 'not started' : r.issueState.toLowerCase());
const prCell = (r) => (r.open ? `[#${r.open.number}](${r.open.url}) ${r.open.kind}${r.open.isDraft ? ' draft' : ''} · ${r.open.checks}` : '—');
const depCell = (r) => r.deps.map((d) => `${d.label} ${d.done ? '✓' : '⏳'}`).join(' ') || '—';
const heldCell = ([a, cs]) => {
  const c = collisions.find((x) => x.area === a);
  if (!c) return `${a} (${cs.join(', ')})`;
  return c.first ? `${a} (${c.first}; ${c.later.join(', ')} ⚠)` : `${a} (${cs.join(', ')} ⚠)`;
};
console.log(slice
  ? `## ${slice.title} — ${slice.description ?? ''}${umbrella ? ` · umbrella [#${umbrella.number}](${umbrella.url})` : ''}`
  : `## #${focus} — no milestone`);
console.log(`main: ${main.state} (${main.note})${main.state === 'red' ? ' — dispatch blocked' : ''}`);
console.log(`WIP ${wipCount}/${WIP_MAX} in implementation${wip.length ? ` (${wip.join(', ')})` : ''} · held AREAs: ${[...busy].map(heldCell).join(', ') || '—'}`);
if (openP1.length) console.log(`Open P1 without a Change: ${openP1.map((n) => `#${n}`).join(', ')}`);
console.log(queue.length ? `👤 Maintainer queue:\n${queue.map((q) => `- ${q.what}${q.url ? ` — ${q.url}` : ''}`).join('\n')}` : '👤 Maintainer queue: empty');
for (const w of warnings) console.log(`⚠ ${w}`);
console.log('');
if (focus) {
  const r = shown[0];
  console.log(`${r.startable ? 'startable' : 'not startable'}: #${r.number} ${r.change ?? '(no Change)'} — ${r.next}`);
  const area = areaLine(r);
  if (area) console.log(area);
}
if (!shown.length) {
  console.log(!flag('--next') ? 'No issues in this milestone.' : main.state === 'red' ? `Nothing can start: main is red (${main.note}).` : 'Nothing can start now.');
  process.exit(0);
}
console.log('| Issue | Change | AREA | State | PR · checks | Depends on | Next | Who |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of shown) {
  console.log(`| [#${r.number}](${r.url}) | ${r.change ? `\`${r.change}\`` : '—'} | ${r.areas.join(' + ') || '—'} | ${stateCell(r)} | ${prCell(r)} | ${depCell(r)} | ${cell(r.next)} | ${r.who} |`);
}
