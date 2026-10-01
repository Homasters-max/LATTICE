#!/usr/bin/env node
// Slice state, computed on every run: milestone issues and PRs from GitHub, Change state from
// warrant (records on git refs, `warrant status` in each Change worktree).
// Usage: node status.mjs <slice> [--next] [--json]   |   node status.mjs <change | #issue> [--json]
import { execFileSync } from 'node:child_process';

const WIP_MAX = 3;
const IMPL = new Set(['APPROVED', 'IMPLEMENTING', 'VERIFYING']);
const RANK = { PROPOSED: 1, SPECIFIED: 2, APPROVED: 3, IMPLEMENTING: 4, VERIFYING: 5, MERGED: 6, ARCHIVED: 7, ABANDONED: 8 };
const ACTIVE = (s) => s && RANK[s] < RANK.ARCHIVED;
const KINDS = ['archive', 'impl', 'spec'];

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const target = argv.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: node status.mjs <slice> [--next] [--json] | <change | #issue> [--json]');
  process.exit(64);
}

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

// ---------- sources ----------
git('fetch', '-q', '--prune', 'origin');
const milestones = gh('api', 'repos/{owner}/{repo}/milestones?state=all');
const prs = gh('pr', 'list', '--state', 'all', '--limit', '500', '--json',
  'number,title,headRefName,state,url,isDraft,reviewDecision,statusCheckRollup,body');
const refs = new Set(git('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin').split('\n').filter(Boolean));
const worktrees = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/).map((b) => ({
  path: b.match(/^worktree (.+)$/m)?.[1],
  branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1],
})).filter((w) => w.path);

const live = new Map(); // worktree path -> Map(change -> state), from `warrant status`
function warrantStates(cwd) {
  if (!live.has(cwd)) {
    const m = new Map();
    try {
      const out = JSON.parse(sh('warrant', ['status'], { cwd, ok: true, shell: process.platform === 'win32' }) || '{}');
      for (const c of out.data?.changes ?? []) m.set(c.change, c.change_state);
    } catch { /* not a warrant checkout */ }
    live.set(cwd, m);
  }
  return live.get(cwd);
}
const max = (a, b) => (!a ? b : !b ? a : RANK[b] > RANK[a] ? b : a);

// The state in the record of a Change on a git ref, or null.
function recordState(ref, change) {
  if (!refs.has(ref)) return null;
  const rec = git('show', `${ref}:.warrant/changes/${change}.json`);
  try { return rec ? JSON.parse(rec).change_state ?? null : null; } catch { return null; }
}
const stateCache = new Map();
function changeState(change) {
  if (stateCache.has(change)) return stateCache.get(change);
  let s = warrantStates(process.cwd()).get(change);
  for (const ref of ['origin/main', ...KINDS.flatMap((k) => [`${k}/${change}`, `origin/${k}/${change}`])]) s = max(s, recordState(ref, change));
  for (const w of worktrees) if (KINDS.some((k) => w.branch === `${k}/${change}`)) s = max(s, warrantStates(w.path).get(change));
  stateCache.set(change, s);
  return s;
}
// An archive-PR is merged when the record on origin/main is ARCHIVED.
const archivedOnMain = (change) => recordState('origin/main', change) === 'ARCHIVED';
const worktreeOf = (name) => worktrees.find((w) => w.branch && w.branch.split('/').slice(1).join('/') === name);

// ---------- issues ----------
function parseIssue(i) {
  const where = i.body.match(/^Where:(.*)$/m)?.[1] ?? '';
  const deps = i.body.match(/^Depends on:(.*)$/m)?.[1] ?? '';
  return {
    ...i,
    change: where.match(/Change `([^`]+)`/)?.[1] ?? null,
    // "AREA `TR` + `AC` + `CT`" — the "+"-joined list right after the word; trailing prose is ignored
    areas: (where.match(/AREA\s+(`?[A-Z]{2,}`?(?:\s*\+\s*`?[A-Z]{2,}`?)*)/)?.[1] ?? '').match(/[A-Z]{2,}/g) ?? [],
    depIssues: [...deps.matchAll(/#(\d+)/g)].map((m) => Number(m[1])),
    depBranches: [...deps.matchAll(/`([\w.-]+\/[\w.-]+)`/g)].map((m) => m[1]),
    umbrella: /^\s*- \[[ x]\] #\d+/m.test(i.body),
  };
}
const issueCache = new Map();
function issue(n) {
  if (!issueCache.has(n)) issueCache.set(n, parseIssue(gh('issue', 'view', String(n), '--json', 'number,title,state,body,url,milestone')));
  return issueCache.get(n);
}

function resolveSlice() {
  const m = milestones.find((x) => x.title.toLowerCase() === target.toLowerCase());
  if (m) return { slice: m, focus: null };
  const n = target.match(/^#?(\d+)$/)?.[1];
  const hit = n ? issue(Number(n))
    : gh('issue', 'list', '--state', 'all', '--search', `${target} in:title`, '--json', 'number,title,state,body,url,milestone')
      .map(parseIssue).find((i) => i.change === target);
  if (!hit) { console.error(`no milestone or Change issue named "${target}"`); process.exit(2); }
  if (!hit.milestone) { console.error(`issue #${hit.number} has no milestone`); process.exit(2); }
  return { slice: milestones.find((x) => x.title === hit.milestone.title), focus: hit.number };
}
const { slice, focus } = resolveSlice();
const all = gh('issue', 'list', '--milestone', slice.title, '--state', 'all', '--limit', '500', '--json', 'number,title,state,body,url,milestone')
  .map(parseIssue);
for (const i of all) issueCache.set(i.number, i);
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
      // A Change dependency is done only when its archive-PR is merged; a docs issue when it is closed.
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
  return { ...i, issueState: i.state, state, wt, prs: ip, open, merged, deps };
});

// In implementation (WIP): from the first impl commit until the impl-PR merges, across all slices.
const implPR = (c, state) => prs.some((p) => p.headRefName === `impl/${c}` && p.state === state);
const inImpl = (c) => implPR(c, 'OPEN') || (IMPL.has(changeState(c)) && !implPR(c, 'MERGED'));
const candidates = new Set([...[...live.values()].flatMap((m) => [...m.keys()]), ...rows.map((r) => r.change).filter(Boolean),
  ...[...refs, ...prs.map((p) => p.headRefName)].map((x) => x.match(/^(?:origin\/)?impl\/(.+)$/)?.[1]).filter(Boolean)]);
const wip = [...candidates].filter(inImpl);
const wipCount = wip.length;
// An AREA is held from `warrant init change` (a record exists) until the archive-PR is merged into main
// (the record is ARCHIVED on origin/main) or the Change is ABANDONED.
const holds = (r) => r.change && (ACTIVE(r.state) || (r.state === 'ARCHIVED' && !archivedOnMain(r.change)));
const busy = new Map(); // AREA -> change holding it
for (const r of rows) if (holds(r)) for (const a of r.areas) busy.set(a, r.change);

// A red main (last completed `test` run on main failed) blocks dispatch.
function mainHealth() {
  try {
    const [run] = gh('run', 'list', '--workflow', 'test.yml', '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'conclusion,url');
    if (!run) return { state: 'unknown', note: 'no completed test run on main yet' };
    return { state: run.conclusion === 'success' ? 'green' : 'red', note: run.url };
  } catch {
    return { state: 'unknown', note: 'workflow test.yml not found — not blocking' };
  }
}
const main = mainHealth();

function next(r) {
  const p = r.open;
  const ci = p?.checks === 'running' ? ' (CI running)' : '';
  if (r.state === 'ABANDONED') return ['abandoned', '—'];
  // ARCHIVED on its branch only: the archive-PR is not merged — an open one goes through the PR checks below.
  if (r.state === 'ARCHIVED' && archivedOnMain(r.change)) return ['done', '—'];
  if (r.state === 'ARCHIVED' && !p) return ['open archive-PR', 'agent'];
  if (!r.state && r.issueState === 'CLOSED') return r.change ? ['closed without a Change — needs a decision', '👤 maintainer'] : ['done', '—'];
  if (!r.change && p) {
    return p.checks === 'red' ? [`fix CI on #${p.number}`, 'agent'] : p.isDraft ? ['finish the PR', 'agent'] : [`review + merge #${p.number}${ci}`, '👤 maintainer'];
  }
  if (p && p.checks === 'red') return [`fix CI on #${p.number}`, 'agent'];
  if (p && p.isDraft) return ['finish draft PR (blocking UNKNOWN → 👤 answers in PR)', 'agent'];
  if (p && p.kind === 'spec') {
    // SPECIFIED is the last commit before the review is asked (rule process, step 1).
    if (r.state === 'PROPOSED') return ['verify, transition SPECIFIED, push — before the review', 'agent'];
    return [`${p.reviewDecision === 'APPROVED' ? 'merge' : 'approve + merge'} spec-PR #${p.number}${ci}`, '👤 maintainer'];
  }
  if (p && p.kind === 'impl') return r.state === 'VERIFYING' ? [`merge impl-PR #${p.number}${ci}`, '👤 maintainer'] : ['implement → VERIFYING', 'agent'];
  if (p && p.kind === 'archive') return [`merge archive-PR #${p.number}${ci}`, '👤 maintainer'];
  if (p) return [`review + merge #${p.number}${ci}`, '👤 maintainer'];
  if (!r.state) {
    const decide = r.deps.filter((d) => d.decide).map((d) => d.label);
    if (decide.length) return [`decide on ${decide.join(', ')} (dependency)`, '👤 maintainer'];
    const wait = r.deps.filter((d) => !d.done).map((d) => d.label);
    if (wait.length) return [`wait ${wait.join(', ')}`, '—'];
    const held = r.areas.filter((a) => busy.has(a) && busy.get(a) !== r.change);
    if (held.length) return [`wait AREA ${held.map((a) => `${a} (${busy.get(a)})`).join(', ')}`, '—'];
    if (r.wt) return [r.change ? 'spec: init change, specify' : 'open the docs PR', 'agent'];
    return [r.change ? 'launch' : 'launch (docs PR)', 'coordinator'];
  }
  switch (r.state) {
    case 'PROPOSED': return ['specify → review → spec-PR', 'agent'];
    case 'SPECIFIED':
      if (!r.merged('spec')) return ['open spec-PR', 'agent'];
      return wipCount < WIP_MAX ? ['start impl-PR', 'coordinator'] : [`wait WIP ${wipCount}/${WIP_MAX}`, '—'];
    case 'APPROVED': case 'IMPLEMENTING': return ['implement → VERIFYING, impl-PR', 'agent'];
    case 'VERIFYING': return r.merged('impl') ? ['archive-PR', 'agent'] : ['open impl-PR', 'agent'];
    case 'MERGED': return ['warrant archive, archive-PR', 'agent'];
  }
  return ['?', '—'];
}
for (const r of rows) {
  [r.next, r.who] = next(r);
  r.startable = r.next === 'launch' || r.next === 'launch (docs PR)' || r.next === 'start impl-PR';
  if (r.startable && main.state === 'red') [r.next, r.who, r.startable] = [`${r.next} — blocked: main is red`, '—', false];
}

const queue = [
  ...rows.filter((r) => r.who.startsWith('👤')).map((r) => ({ what: `${r.change ?? `#${r.number}`}: ${r.next}`, url: r.open?.url ?? '' })),
  ...rows.flatMap((r) => r.deps.filter((d) => d.pr?.state === 'OPEN' && !d.pr.isDraft)
    .map((d) => ({ what: `#${d.pr.number} ${d.pr.title} (dependency of #${r.number}, CI ${checks(d.pr)})`, url: d.pr.url }))),
].filter((q, k, a) => a.findIndex((x) => (q.url ? x.url === q.url : x.what === q.what)) === k);

// ---------- output ----------
const pick = (r) => ({ issue: r.number, change: r.change, areas: r.areas, state: r.state ?? (r.wt ? 'launched' : null),
  issue_state: r.issueState, pr: r.open ? { number: r.open.number, kind: r.open.kind, checks: r.open.checks, url: r.open.url } : null,
  depends: r.deps.map((d) => ({ on: d.label, done: d.done })), next: r.next, who: r.who, startable: r.startable,
  worktree: r.wt?.path ?? null, url: r.url });
const shown = focus ? rows.filter((r) => r.number === focus) : flag('--next') ? rows.filter((r) => r.startable) : rows;
if (flag('--json')) {
  console.log(JSON.stringify({ slice: slice.title, umbrella: umbrella?.number ?? null, main, wip: wipCount, wip_max: WIP_MAX,
    wip_changes: wip, busy_areas: Object.fromEntries(busy), maintainer_queue: queue, rows: shown.map(pick) }, null, 2));
  process.exit(0);
}
const cell = (s) => String(s).replace(/\|/g, '\\|');
const stateCell = (r) => r.state ?? (r.wt ? 'launched' : r.change ? 'not started' : r.issueState.toLowerCase());
const prCell = (r) => (r.open ? `[#${r.open.number}](${r.open.url}) ${r.open.kind}${r.open.isDraft ? ' draft' : ''} · ${r.open.checks}` : '—');
const depCell = (r) => r.deps.map((d) => `${d.label} ${d.done ? '✓' : '⏳'}`).join(' ') || '—';
console.log(`## ${slice.title} — ${slice.description ?? ''}${umbrella ? ` · umbrella [#${umbrella.number}](${umbrella.url})` : ''}`);
console.log(`main: ${main.state} (${main.note})${main.state === 'red' ? ' — dispatch blocked' : ''}`);
console.log(`WIP ${wipCount}/${WIP_MAX} in implementation${wip.length ? ` (${wip.join(', ')})` : ''} · held AREAs: ${[...busy].map(([a, c]) => `${a} (${c})`).join(', ') || '—'}`);
console.log(queue.length ? `👤 Maintainer queue:\n${queue.map((q) => `- ${q.what}${q.url ? ` — ${q.url}` : ''}`).join('\n')}` : '👤 Maintainer queue: empty');
console.log('');
if (focus) {
  const r = shown[0];
  console.log(`${r.startable ? 'startable' : 'not startable'}: #${r.number} ${r.change ?? '(no Change)'} — ${r.next}`);
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
