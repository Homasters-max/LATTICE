#!/usr/bin/env node
// Slice state, computed on every run: issues and PRs from GitHub, Change state from warrant (records on git refs,
// `warrant status` in each Change worktree), health of main from its `test` run and `warrant validate`, the decision
// log from the comments of the umbrella, the issues and the PRs (Change infra-coordinator, D-3, D-4).
// This file gathers the data and prints it; the rules are pure functions in rules.mjs.
// Usage: node status.mjs <slice> [--next] [--json] [--main-ref <ref>]   |   node status.mjs <change | #issue> [--json] [--main-ref <ref>]
// Exit: 0 printed; 2 no such milestone or Change issue; 64 usage.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  WIP_MAX, agentsBudget, areasAddedAfterInit, claimChanges, closable, collisionText, dispatch, heldText, holdersOf, isFixMain,
  isOpenP1WithoutChange, mainState, maintainerQueue, nextAction, parseIssue, testResult, validateResult, versionMatches,
} from './rules.mjs';
import { changeLastPush, pendingEntries } from './act-rules.mjs';
import { JUDGE_PREFIX, STATUS_PREFIX, sweepStale } from './temp.mjs';

const IMPL = new Set(['APPROVED', 'IMPLEMENTING', 'VERIFYING']);
const RANK = { PROPOSED: 1, SPECIFIED: 2, APPROVED: 3, IMPLEMENTING: 4, VERIFYING: 5, MERGED: 6, ARCHIVED: 7, ABANDONED: 8 };
const ACTIVE = (s) => s && RANK[s] < RANK.ARCHIVED;
const KINDS = ['archive', 'impl', 'spec'];
const WIN = process.platform === 'win32';
const ISSUE_LIMIT = 1000;

// ---------- arguments ----------
const USAGE = 'usage: node status.mjs <slice> [--next] [--json] [--main-ref <ref>] | <change | #issue> [--json] [--main-ref <ref>]';
const argv = process.argv.slice(2);
const opts = { next: false, json: false, mainRef: 'origin/main' };
const positional = [];
for (let k = 0; k < argv.length; k++) {
  const a = argv[k];
  if (a === '--next') opts.next = true;
  else if (a === '--json') opts.json = true;
  else if (a === '--main-ref') {
    const v = argv[++k];
    if (!v || v.startsWith('--')) { console.error(USAGE); process.exit(64); }
    opts.mainRef = v;
  } else if (a.startsWith('--')) { console.error(USAGE); process.exit(64); }
  else positional.push(a);
}
if (positional.length !== 1) { console.error(USAGE); process.exit(64); }
const [target] = positional;

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
const rawIssues = gh('issue', 'list', '--state', 'all', '--limit', String(ISSUE_LIMIT), '--json', ISSUE_FIELDS);
if (rawIssues.length >= ISSUE_LIMIT) warnings.push(`${ISSUE_LIMIT} issues read — older ones, and the AREAs they hold, are not seen`);
const repoIssues = claimChanges(rawIssues.map(parseIssue));
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
const furthest = (a, b) => (!a ? b : !b ? a : RANK[b] > RANK[a] ? b : a);

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
  const readRecord = (rec) => {
    if (!rec) return;
    state = furthest(state, rec.change_state ?? null);
    const at = rec.transitions?.[0]?.at;
    if (at && (!initAt || at < initAt)) initAt = at;
  };
  for (const ref of ['origin/main', ...KINDS.flatMap((k) => [`${k}/${change}`, `origin/${k}/${change}`])]) readRecord(refRecord(ref, change));
  for (const w of worktrees) {
    if (!KINDS.some((k) => w.branch === `${k}/${change}`)) continue;
    state = furthest(state, warrantStates(w.path).get(change));
    readRecord(fileRecord(w.path, change));
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
// (the record is ARCHIVED on origin/main) or it is ABANDONED. Holders come from every issue of the repository;
// claimChanges leaves one issue per Change.
const holds = (change) => { const s = changeState(change); return ACTIVE(s) || (s === 'ARCHIVED' && !archivedOnMain(change)); };
const holderIssues = repoIssues.filter((i) => i.change && i.areas.length && holds(i.change));

// ---------- the decision log (D-3) ----------
const REPO = gh('repo', 'view', '--json', 'nameWithOwner').nameWithOwner;
const [OWNER, NAME] = REPO.split('/');
const commentCache = new Map();
// The comments of an issue or a PR: [{ url, createdAt, body }], every page.
function commentsOf(n) {
  if (!commentCache.has(n)) {
    let list = [];
    try {
      list = sh('gh', ['api', '--paginate', `repos/${REPO}/issues/${n}/comments`, '--jq', '.[] | {url: .html_url, createdAt: .created_at, body} | @json'])
        .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) { warnings.push(`comments of #${n} not read: ${e.message.split('\n')[0]}`); }
    commentCache.set(n, list);
  }
  return commentCache.get(n);
}
let agentLogins = [];
try { agentLogins = (JSON.parse(git('show', 'origin/main:.warrant/warrant.json')).identities?.agents ?? []).map((a) => a.login); } catch { /* none */ }
const umbrellaOf = (i) => repoIssues.find((u) => u.umbrella && u.milestone?.title && u.milestone.title === i.milestone?.title);
// The last push of a Change over all its branches on origin, merged or not (changeLastPush).
function changePush(change) {
  const branches = KINDS.map((k) => `origin/${k}/${change}`).filter((r) => refs.has(r));
  if (!branches.length) return null;
  const commits = git('log', '--no-merges', '--format=%cI%x1f%cn <%ce>%x1f%s', ...branches).split(/\r?\n/).filter(Boolean)
    .map((l) => { const [date, committer, subject] = l.split('\x1f'); return { date, committer, subject }; });
  return changeLastPush(commits, change, agentLogins);
}
// pending: entries touching the Change that no comment acknowledges, with no time cut; unread: the comments of its
// issue newer than its last push (all before the first push).
function logOf(i, open) {
  const u = umbrellaOf(i);
  const prComments = prs.filter((p) => KINDS.some((k) => p.headRefName === `${k}/${i.change}`))
    .flatMap((p) => commentsOf(p.number).map((c) => ({ ...c, where: 'pr' })));
  const comments = [...(u ? commentsOf(u.number).map((c) => ({ ...c, where: 'umbrella' })) : []),
    ...commentsOf(i.number).map((c) => ({ ...c, where: 'issue' })), ...prComments];
  const pending = pendingEntries({ comments, change: i.change, issue: i.number, pr: open?.number, areas: i.areas, since: null, repo: REPO });
  const since = changePush(i.change);
  const unread = commentsOf(i.number).filter((c) => !since || Date.parse(c.createdAt) > Date.parse(since))
    .map((c) => ({ url: c.url, createdAt: c.createdAt, line: c.body.trimStart().split(/\r?\n/)[0].slice(0, 120) }));
  return { pending, unread, lastPush: since };
}

// ---------- AREAs added after init (D-4, I-1, I-7) ----------
function editsOf(numbers) {
  if (!numbers.length) return new Map();
  const q = numbers.map((n) => `i${n}: issue(number: ${n}) { userContentEdits(first: 100) { nodes { editedAt diff } } }`).join(' ');
  try {
    const data = gh('api', 'graphql', '-f', `query=query { repository(owner: "${OWNER}", name: "${NAME}") { ${q} } }`).data.repository;
    return new Map(numbers.map((n) => [n, (data[`i${n}`]?.userContentEdits?.nodes ?? []).map((e) => ({ editedAt: e.editedAt, body: e.diff ?? '' }))]));
  } catch (e) { warnings.push(`issue history not read: ${e.message.split('\n')[0]}`); return new Map(); }
}
const skipSpecs = (change) => KINDS.flatMap((k) => [`origin/${k}/${change}`, `${k}/${change}`]).concat('origin/main').filter((r) => refs.has(r))
  .some((r) => /^skip_specs:\s*true/m.test(git('show', `${r}:openspec/changes/${change}/.openspec.yaml`)));
const historyOf = editsOf(holderIssues.map((i) => i.number));
const addedAreas = new Map(holderIssues.map((i) => {
  const u = umbrellaOf(i);
  const decisions = [...(u ? commentsOf(u.number) : []), ...commentsOf(i.number)];
  return [i.change, areasAddedAfterInit({ change: i.change, body: i.body, revisions: historyOf.get(i.number) ?? [],
    initAt: changeInfo(i.change).initAt, skipSpecs: skipSpecs(i.change), decisions })];
}));
const unclearedOf = (change) => (addedAreas.get(change) ?? []).filter((a) => !a.decision);
const holders = holdersOf(holderIssues.map((i) => ({ change: i.change, areas: i.areas, initAt: changeInfo(i.change).initAt,
  areaAt: Object.fromEntries((addedAreas.get(i.change) ?? []).filter((a) => a.decision).map((a) => [a.area, a.decision.createdAt])) })));

// ---------- WIP ----------
// In implementation: from the first impl commit until the impl-PR merges, across all slices; fix-main-* is exempt.
const implPR = (c, state) => prs.some((p) => p.headRefName === `impl/${c}` && p.state === state);
const inImpl = (c) => implPR(c, 'OPEN') || (IMPL.has(changeState(c)) && !implPR(c, 'MERGED'));
const candidates = new Set([...[...live.values()].flatMap((m) => [...m.keys()]), ...items.map((i) => i.change).filter(Boolean),
  ...[...refs, ...prs.map((p) => p.headRefName)].map((x) => x.match(/^(?:origin\/)?impl\/(.+)$/)?.[1]).filter(Boolean)]);
const wip = [...candidates].filter((c) => !isFixMain(c)).filter(inImpl);

// ---------- health of main ----------
function testHealth() {
  try {
    const [run] = gh('run', 'list', '--workflow', 'test.yml', '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'conclusion,url');
    return testResult(run);
  } catch {
    return { state: 'unknown', note: 'test: workflow test.yml not found' };
  }
}
// `warrant validate` on a detached checkout of mainRef in a fresh temp directory, removed afterwards.
function warrantHealth() {
  const sha = git('rev-parse', '--verify', '--quiet', `${opts.mainRef}^{commit}`).trim();
  if (!sha) return { state: 'unknown', note: `warrant validate: ref ${opts.mainRef} not found` };
  const short = sha.slice(0, 7);
  sweepStale([STATUS_PREFIX, JUDGE_PREFIX]); // temp worktrees of killed runs (#126)
  let dir;
  try { dir = mkdtempSync(join(tmpdir(), STATUS_PREFIX)); } catch (e) { return { state: 'unknown', note: `warrant validate ${short}: ${e.message}` }; }
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
    if (added) try { sh('git', ['worktree', 'remove', '--force', dir]); } catch { /* checked below */ }
    if (existsSync(dir)) try { rmSync(dir, { recursive: true, force: true }); } catch { /* checked below */ }
    git('worktree', 'prune');
    if (existsSync(dir)) warnings.push(`temp worktree left — git worktree remove --force ${dir.replace(/\\/g, '/')}`);
  }
}
const mainChecks = [testHealth(), warrantHealth()];
const main = { state: mainState(mainChecks), note: mainChecks.map((c) => c.note).join(' · '), checks: mainChecks };

// ---------- rows ----------
const rows = items.map((i) => {
  const state = i.change ? changeState(i.change) : null;
  const wt = worktreeOf(i.change ?? `issue-${i.number}`);
  const ip = prsOf(i);
  const open = ip.find((p) => p.state === 'OPEN') ?? null;
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
  const row = {
    ...i, issueState: i.state, state, wt, hasWorktree: Boolean(wt), prs: ip, open, deps,
    merged: { spec: merged('spec'), impl: merged('impl') },
    archivedOnMain: state === 'ARCHIVED' && archivedOnMain(i.change),
    collided: i.change ? holders.collisionsOf(i.change) : [],
  };
  const next = nextAction(row, { heldFor: holders.heldFor, wipCount: wip.length });
  const { startable, text, who } = dispatch(i.change, next, main.state);
  const log = i.change && (holds(i.change) || i.number === focus) ? logOf(i, open) : null;
  return { ...row, next: text, who, action: next.action, startable, log, added: i.change ? unclearedOf(i.change) : [] };
});

const depPRs = rows.flatMap((r) => r.deps.filter((d) => d.pr?.state === 'OPEN' && !d.pr.isDraft)
  .map((d) => ({ number: d.pr.number, title: d.pr.title, url: d.pr.url, checks: checks(d.pr), head: d.pr.headRefName, dependentOf: r.number })));
const addedRows = rows.flatMap((r) => r.added.map((a) => ({ what: `${r.change}: AREA ${a.area} added to #${r.number} after init (${a.editedAt}) — needs a [decision] (Adds: AREA ${a.area} to ${r.change})`, url: r.url })));
const queue = [...addedRows, ...maintainerQueue({
  rows: rows.map((r) => ({ change: r.change, number: r.number, who: r.who, text: r.next, action: r.action, url: r.open?.url, collided: r.collided })),
  collisions: holders.collisions, busy: holders.busy, depPRs, mainState: main.state,
})];
// Open issues whose closing condition looks met (rule tracking; the coordinator judges, D-4).
const prState = (n) => prs.find((p) => p.number === n)?.state ?? null;
const closables = all.filter((i) => i.state === 'OPEN' && !i.umbrella)
  .map((i) => ({ number: i.number, reason: closable(i, { archivedOnMain, prState, issueOf: (n) => { try { return issue(n); } catch { return null; } } }) }))
  .filter((x) => x.reason);
let agentsBytes = null;
try { agentsBytes = Buffer.byteLength(execFileSync('git', ['show', 'origin/main:AGENTS.md'], { maxBuffer: 1 << 24 })); } catch { /* none */ }
const budget = agentsBudget(agentsBytes);
// Open bug / question P1 issues no Change takes, of this milestone and of none.
const openP1 = repoIssues.filter((i) => isOpenP1WithoutChange(i) && (!i.milestone || (slice && i.milestone.title === slice.title)))
  .map((i) => i.number).sort((a, b) => a - b);

// ---------- output ----------
const areaLine = (r) => {
  if (!r.change) return null;
  if (isFixMain(r.change)) return 'AREA: exempt (fix-main)';
  if (!r.areas.length) return 'AREA: none';
  if (r.collided.length) return `AREA: collision ${collisionText(r.collided)} — stop and ask on the umbrella (no umbrella: in the issue)`;
  if (r.added.length) return `AREA ${r.added.map((a) => `${a.area} added after init (${a.editedAt})`).join(', ')} — needs a decision`;
  const held = holders.heldFor(r.change, r.areas);
  if (!r.state && held.length) return `AREA: wait ${heldText(held)}`;
  return `AREA: ${r.areas.join(' + ')} — ${holds(r.change) ? 'held by this Change, no collision' : 'free'}`;
};
const rowJson = (r) => ({ issue: r.number, change: r.change, refers_to: r.refersTo ?? null, kind: r.kind, areas: r.areas, state: r.state ?? (r.wt ? 'launched' : null),
  issue_state: r.issueState, pr: r.open ? { number: r.open.number, kind: r.open.kind, checks: r.open.checks, url: r.open.url } : null,
  depends: r.deps.map((d) => ({ on: d.label, done: d.done })), next: r.next, who: r.who, startable: r.startable,
  area: areaLine(r), worktree: r.wt?.path ?? null, url: r.url, log: r.log ? { pending: r.log.pending, unread: r.log.unread, last_push: r.log.lastPush } : null,
  added_areas: r.added });
const shown = focus ? rows.filter((r) => r.number === focus) : opts.next ? rows.filter((r) => r.startable) : rows;
if (opts.json) {
  console.log(JSON.stringify({ slice: slice?.title ?? null, umbrella: umbrella?.number ?? null, main, wip: wip.length, wip_max: WIP_MAX,
    wip_changes: wip, busy_areas: Object.fromEntries(holders.busy),
    area_collisions: holders.collisions.map((c) => ({ area: c.area, changes: holders.busy.get(c.area), later: c.later })),
    open_p1: openP1, maintainer_queue: queue, closable: closables, agents_md: { bytes: agentsBytes, ...budget }, warnings,
    rows: shown.map(rowJson) }, null, 2));
  process.exit(0);
}
const cell = (s) => String(s).replace(/\|/g, '\\|');
const stateCell = (r) => r.state ?? (r.wt ? 'launched' : r.change ? 'not started' : r.issueState.toLowerCase());
const prCell = (r) => (r.open ? `[#${r.open.number}](${r.open.url}) ${r.open.kind}${r.open.isDraft ? ' draft' : ''} · ${r.open.checks}` : '—');
const depCell = (r) => r.deps.map((d) => `${d.label} ${d.done ? '✓' : '⏳'}`).join(' ') || '—';
const heldCell = ([area, changes]) => {
  const c = holders.collisions.find((x) => x.area === area);
  if (!c) return `${area} (${changes.join(', ')})`;
  return c.first ? `${area} (${c.first}; ${c.later.join(', ')} ⚠)` : `${area} (${changes.join(', ')} ⚠)`;
};
console.log(slice
  ? `## ${slice.title} — ${slice.description ?? ''}${umbrella ? ` · umbrella [#${umbrella.number}](${umbrella.url})` : ''}`
  : `## #${focus} — no milestone`);
console.log(`main: ${main.state} (${main.note})${main.state === 'red' ? ' — dispatch blocked' : ''}`);
console.log(`WIP ${wip.length}/${WIP_MAX} in implementation${wip.length ? ` (${wip.join(', ')})` : ''} · held AREAs: ${[...holders.busy].map(heldCell).join(', ') || '—'}`);
if (openP1.length) console.log(`Open P1 without a Change: ${openP1.map((n) => `#${n}`).join(', ')}`);
if (closables.length) console.log(`Closable: ${closables.map((c) => `#${c.number} (${c.reason})`).join(', ')}`);
console.log(budget.note);
console.log(queue.length ? `👤 Waiting for the maintainer:\n${queue.map((q) => `- ${q.what}${q.url ? ` — ${q.url}` : ''}`).join('\n')}` : '👤 Waiting for the maintainer: nothing');
for (const w of warnings) console.log(`⚠ ${w}`);
console.log('');
if (focus) {
  const r = shown[0];
  console.log(`${r.startable ? 'startable' : 'not startable'}: #${r.number} ${r.change ?? '(no Change)'} — ${r.next}`);
  const area = areaLine(r);
  if (area) console.log(area);
  if (r.log) {
    const lines = [...r.log.pending.map((e) => `- pending: ${e.url} — ${e.line}`), ...r.log.unread.map((c) => `- unread: ${c.url} — ${c.line}`)];
    console.log(`Read first (last push ${r.log.lastPush ?? 'none'}): ${lines.length ? `\n${lines.join('\n')}` : 'nothing'}`);
  }
}
if (!shown.length) {
  console.log(!opts.next ? 'No issues in this milestone.' : main.state === 'red' ? `Nothing can start: main is red (${main.note}).` : 'Nothing can start now.');
  process.exit(0);
}
const logCell = (r) => (r.log ? `${r.log.pending.length}${r.log.unread.length ? ` +${r.log.unread.length}` : ''}` : '—');
console.log('| Issue | Change | AREA | State | PR · checks | Depends on | Log | Next | Who |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of shown) {
  console.log(`| [#${r.number}](${r.url}) | ${r.change ? `\`${r.change}\`` : '—'} | ${r.areas.join(' + ') || '—'} | ${stateCell(r)} | ${prCell(r)} | ${depCell(r)} | ${logCell(r)} | ${cell(r.next)} | ${r.who} |`);
}
