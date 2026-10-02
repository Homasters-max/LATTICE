#!/usr/bin/env node
// One command per maintainer act (Change infra-merge-flow, design D-1…D-6): it checks, acts, commits, pushes and
// verifies, or refuses with the reason and changes nothing. The maintainer runs it in their own terminal; the agent
// runs it with --dry-run before asking. This file gathers the facts and acts; the rules are in act-rules.mjs.
// Usage: node act.mjs merge <N> | waiver <change> <WAV> | patch <change> <file> | whoami   [--dry-run]
// Exit: 0 done (or would be done) · 1 refused, nothing changed · 2 failed: a gh or git error; a write before the push is
//       rolled back, a push is named · 64 usage.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COPY_FILES, actorRefusals, changeOfBranch, copyPlan, mainHealth, mergeRefusals, patchRefusals, pendingEntries,
  lastPush, waiverRefusals, worktreeRefusals,
} from './act-rules.mjs';
import { claimChanges, parseIssue } from './rules.mjs';

const WIN = process.platform === 'win32';
const SLICE = '.claude/skills/slice';
const ISSUE_LIMIT = 1000;

// ---------- arguments ----------
const USAGE = 'usage: node act.mjs merge <N> | waiver <change> <WAV> | patch <change> <file> | whoami   [--dry-run]';
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const args = argv.filter((a) => a !== '--dry-run');
const [act, ...rest] = args;
const ARITY = { merge: 1, waiver: 2, patch: 2, whoami: 0 };
if (!(act in ARITY) || rest.length !== ARITY[act] || args.some((a) => a.startsWith('--'))
  || (act === 'merge' && !/^\d+$/.test(rest[0])) || (act === 'waiver' && !/^WAV-[\w-]+$/.test(rest[1]))) {
  console.error(USAGE);
  process.exit(64);
}

// ---------- shell ----------
function sh(cmd, a, { cwd, ok = false, shell = false, env, encoding = 'utf8' } = {}) {
  try {
    return execFileSync(cmd, a, { cwd, shell, env, encoding, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    if (ok) return e.stdout ?? '';
    throw new Error(`${cmd} ${a.join(' ')}: ${(e.stderr || e.message).toString().trim()}`);
  }
}
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repo = process.env.LATTICE_ACT_REPO || sh('git', ['-C', scriptDir, 'rev-parse', '--show-toplevel']).trim();
const git = (a, opts = {}) => sh('git', ['-C', opts.cwd ?? repo, ...a], opts);
const gh = (...a) => JSON.parse(sh('gh', a, { cwd: repo }));
const ghLines = (...a) => sh('gh', a, { cwd: repo }).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const warrant = (a, cwd) => sh('warrant', a, { cwd, shell: WIN });
const fromMain = (path) => git(['show', `origin/main:${path}`], { ok: true });
const lines = (s) => s.split(/\r?\n/).filter(Boolean);

function refuse(refusals) {
  for (const r of refusals) console.log(`refused: ${r.reason} — ${r.fix}`);
  process.exit(1);
}
function fail(msg) {
  console.log(`failed: ${msg}`);
  process.exit(2);
}

// ---------- copy (D-2) ----------
git(['fetch', '-q', '--prune', 'origin']);
const files = COPY_FILES.map((name) => ({
  name,
  local: sh('git', ['hash-object', name], { cwd: scriptDir }).trim(),
  main: git(['rev-parse', '--verify', '-q', `origin/main:${SLICE}/${name}`], { ok: true }).trim() || null,
}));
const plan = copyPlan({ files, act, dryRun, reexecuted: !!process.env.LATTICE_ACT_REEXEC });
if (plan.refusals) refuse(plan.refusals);
if (plan.mode === 'bootstrap') console.log('bootstrap: origin/main has no act.mjs — running this copy');
if (plan.mode === 'reexec') {
  const dir = mkdtempSync(join(tmpdir(), 'lattice-act-'));
  try {
    for (const f of files) writeFileSync(join(dir, f.name), git(['cat-file', 'blob', f.main], { encoding: 'buffer' }));
    console.log(`this copy differs from origin/main: running the act.mjs of origin/main (${files[0].main.slice(0, 7)})`);
    const r = spawnSync(process.execPath, [join(dir, 'act.mjs'), ...argv], {
      stdio: 'inherit', env: { ...process.env, LATTICE_ACT_REPO: repo, LATTICE_ACT_REEXEC: '1' },
    });
    process.exitCode = r.status ?? 2;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit();
}

// ---------- project and actor (D-2) ----------
const config = JSON.parse(fromMain('.warrant/warrant.json') || '{}');
const maintainers = config.roles?.maintainer ?? [];
const agentLogins = (config.identities?.agents ?? []).map((a) => a.login);
const login = sh('gh', ['api', 'user', '--jq', '.login'], { cwd: repo, ok: true }).trim();
const authorIdent = git(['var', 'GIT_AUTHOR_IDENT'], { ok: true }).trim();
const actor = actorRefusals({
  agentShell: !!process.env.CLAUDECODE, login, maintainers, agentLogins, authorIdent, needsAuthor: act !== 'merge',
});
if (act === 'whoami') {
  if (actor.length) refuse(actor);
  console.log(`ok: gh acts as ${login}, git authors as ${authorIdent.replace(/ \d+ [+-]\d{4}$/, '')}`);
  process.exit(0);
}
if (!dryRun && actor.length) refuse(actor);

// ---------- worktrees ----------
const worktrees = git(['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/).map((b) => ({
  path: b.match(/^worktree (.+)$/m)?.[1],
  branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1],
})).filter((w) => w.path);

function relation(cwd, branch) {
  const remote = git(['rev-parse', '--verify', '-q', `origin/${branch}`], { ok: true }).trim();
  if (!remote) return 'no-remote';
  const head = git(['rev-parse', 'HEAD'], { cwd }).trim();
  if (head === remote) return 'equal';
  const isAncestor = (a, b) => spawnSync('git', ['-C', cwd, 'merge-base', '--is-ancestor', a, b]).status === 0;
  if (isAncestor(head, remote)) return 'behind';
  return isAncestor(remote, head) ? 'ahead' : 'diverged';
}
// The worktree of a Change on one of `branches`, with its refusals.
function changeWorktree(branches) {
  const matches = worktrees.filter((w) => branches.includes(w.branch));
  const branch = matches[0]?.branch ?? branches[0];
  const dirty = matches.length === 1 ? lines(git(['status', '--porcelain'], { cwd: matches[0].path })) : [];
  const rel = matches.length === 1 ? relation(matches[0].path, branch) : null;
  return { wt: matches[0], branch, relation: rel, refusals: worktreeRefusals({ branch, matches, dirty, relation: rel }) };
}

// The act on a worktree: fast-forward, the change, commit, push. Any failure before the push rolls the worktree back
// to where it started (it was clean, at or behind its remote).
function writeAndPush({ wt, branch, relation: rel }, change, message) {
  const start = git(['rev-parse', 'HEAD'], { cwd: wt.path }).trim();
  let pushed = false;
  try {
    if (rel === 'behind') git(['merge', '-q', '--ff-only', `origin/${branch}`], { cwd: wt.path });
    change();
    git(['commit', '-q', '-m', message], { cwd: wt.path });
    git(['push', '-q', 'origin', `HEAD:${branch}`], { cwd: wt.path });
    pushed = true;
  } catch (e) {
    if (pushed) fail(`${e.message} (pushed ${git(['rev-parse', 'HEAD'], { cwd: wt.path }).trim()})`);
    git(['reset', '-q', '--hard', start], { cwd: wt.path, ok: true });
    for (const l of lines(git(['status', '--porcelain'], { cwd: wt.path, ok: true }))) {
      if (l.startsWith('?? ')) rmSync(join(wt.path, l.slice(3).replace(/^"|"$/g, '')), { recursive: true, force: true });
    }
    fail(`${e.message} — ${wt.path} rolled back to ${start.slice(0, 7)}`);
  }
  git(['fetch', '-q', 'origin']);
  const head = git(['rev-parse', 'HEAD'], { cwd: wt.path }).trim();
  if (git(['rev-parse', `origin/${branch}`]).trim() !== head) fail(`pushed, but origin/${branch} is not ${head}`);
  return head;
}

// ---------- merge (D-3) ----------
function comments(issue, where) {
  return ghLines('api', `repos/{owner}/{repo}/issues/${issue}/comments`, '--paginate', '--jq', '.[] | {url: .html_url, createdAt: .created_at, body}')
    .map((c) => ({ ...c, where }));
}
function merge(n) {
  const pr = gh('pr', 'view', n, '--json', 'number,url,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,'
    + 'statusCheckRollup,autoMergeRequest,comments,closingIssuesReferences');
  const branch = changeOfBranch(pr.headRefName);
  const record = branch ? JSON.parse(git(['show', `${pr.headRefOid}:.warrant/changes/${branch.change}.json`], { ok: true }) || 'null') : null;
  const issues = claimChanges(gh('issue', 'list', '--state', 'all', '--limit', String(ISSUE_LIMIT), '--json',
    'number,title,state,body,url,milestone,labels').map(parseIssue));
  const issue = branch ? issues.find((i) => i.change === branch.change)
    : issues.find((i) => (pr.closingIssuesReferences ?? []).some((c) => c.number === i.number));
  const umbrella = issue?.milestone && issues.find((i) => i.umbrella && i.milestone?.title === issue.milestone.title);
  const all = [
    ...(umbrella ? comments(umbrella.number, 'umbrella') : []),
    ...(issue ? comments(issue.number, 'issue') : []),
    ...(pr.comments ?? []).map((c) => ({ url: c.url, createdAt: c.createdAt, body: c.body, where: 'pr' })),
  ];
  const commits = lines(git(['log', '--no-merges', '--format=%cI%x09%cn <%ce>', `origin/main..${pr.headRefOid}`], { ok: true }))
    .map((l) => { const [date, committer] = l.split('\t'); return { date: new Date(date).toISOString(), committer }; });
  const since = lastPush(commits, agentLogins);
  const pending = pendingEntries({ comments: all, change: branch?.change, issue: issue?.number, pr: pr.number, areas: issue?.areas ?? [], since });
  const [testRun] = gh('run', 'list', '--workflow', 'test.yml', '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'conclusion,url');
  const main = mainHealth({ testRun, openIssueTitles: issues.filter((i) => i.state === 'OPEN').map((i) => i.title) });

  const refusals = mergeRefusals({ pr, record, issueFound: !!issue, pending, main });
  if (main.state === 'unknown') console.log(`warning: main is unknown (${main.note})`);
  if (!umbrella) console.log(`note: no umbrella read (${issue ? `#${issue.number} has no milestone umbrella` : 'no issue'})`);
  if (refusals.length) refuse(refusals);
  if (dryRun) { console.log(`would merge #${pr.number} (auto-merge): ${pr.url}`); return; }

  sh('gh', ['pr', 'merge', n, '--merge', '--auto'], { cwd: repo });
  const after = gh('pr', 'view', n, '--json', 'state,mergeCommit,autoMergeRequest,url');
  if (after.state === 'MERGED') console.log(`merged #${n} ${after.mergeCommit?.oid ?? ''} ${after.url}`);
  else if (after.autoMergeRequest) console.log(`auto-merge on for #${n}: merges when its checks pass and it is up to date; the owner's watcher keeps it up to date — ${after.url}`);
  else fail(`gh pr merge --auto returned, but #${n} is ${after.state} without auto-merge`);
}

// ---------- waiver (D-5) ----------
function waiver(change, wav) {
  const target = changeWorktree([`impl/${change}`]);
  const path = `.warrant/waivers/${wav}.json`;
  const read = (ref) => { try { return JSON.parse(git(['show', `${ref}:${path}`], { ok: true }) || 'null'); } catch { return null; } };
  const refs = ['origin/main', ...lines(git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/impl']))]
    .filter((r) => r !== `origin/impl/${change}`);
  const others = refs.map((ref) => ({ ref, change: read(ref)?.change })).filter((o) => o.change);
  const cli = sh('warrant', ['--version'], { cwd: target.wt?.path ?? repo, shell: WIN, ok: true }).trim().split(/\s+/)[0];
  const refusals = [...target.refusals, ...waiverRefusals({ change, wav, waiver: read(`origin/impl/${change}`), others, cli, kernel: config.kernel })];
  if (refusals.length) refuse(refusals);
  if (dryRun) { console.log(`would activate ${wav} on impl/${change} in ${target.wt.path} (--by ${login || '<maintainer>'})`); return; }

  const head = writeAndPush(target, () => {
    warrant(['waive', '--activate', wav, '--by', login], target.wt.path);
    const changed = lines(git(['status', '--porcelain'], { cwd: target.wt.path })).map((l) => l.slice(3));
    if (changed.length !== 1 || changed[0] !== path) throw new Error(`warrant changed ${changed.join(', ')}, not only ${path}`);
    git(['add', path], { cwd: target.wt.path });
  }, `${change}: activate ${wav} (act.mjs)`);
  const state = read(`origin/impl/${change}`)?.waiver_state;
  if (state !== 'ACTIVE') fail(`pushed ${head}, but ${wav} on origin/impl/${change} is ${state}`);
  console.log(`${wav} ACTIVE on impl/${change} ${head}`);
}

// ---------- patch (D-6) ----------
// Paths of `git apply --numstat -z`: "a\td\tpath\0", a rename "a\td\t\0old\0new\0".
function patchPaths(out) {
  const tokens = out.split('\0');
  const paths = [];
  for (let k = 0; k < tokens.length; k++) {
    const m = /^[\d-]+\t[\d-]+\t(.*)$/s.exec(tokens[k]);
    if (!m) continue;
    if (m[1]) paths.push(m[1]);
    else { paths.push(tokens[k + 1], tokens[k + 2]); k += 2; }
  }
  return [...new Set(paths.filter(Boolean))].sort();
}
function patch(change, fileArg) {
  const file = resolve(fileArg);
  const insideRepo = worktrees.some((w) => { const r = relative(resolve(w.path), file); return !r.startsWith('..') && !isAbsolute(r); });
  const target = changeWorktree(['spec', 'impl', 'archive'].map((k) => `${k}/${change}`));
  if (!existsSync(file)) refuse(patchRefusals({ file: { path: file, exists: false } }));
  const cwd = target.wt?.path ?? repo;
  const paths = patchPaths(sh('git', ['apply', '--numstat', '-z', file], { cwd, ok: true }));
  // Applies on origin/<branch>, checked in a temporary index: the worktree is not touched.
  let applies = false;
  let applyError = '';
  const tmp = mkdtempSync(join(tmpdir(), 'lattice-act-index-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index') };
    if (target.relation && target.relation !== 'no-remote') {
      sh('git', ['read-tree', `origin/${target.branch}`], { cwd, env });
      sh('git', ['apply', '--cached', '--check', file], { cwd, env });
      applies = true;
    }
  } catch (e) {
    applyError = e.message.split('\n').slice(-3).join(' ');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const profile = JSON.parse(fromMain('.warrant/local/profiles/human-acceptance.json') || '{}');
  const refusals = [...target.refusals, ...patchRefusals({
    change, file: { path: file, exists: true, insideRepo }, paths, allowGlobs: profile.match?.paths ?? [], applies, applyError,
  })];
  if (refusals.length) refuse(refusals);
  if (dryRun) { console.log(`would patch ${target.branch} in ${target.wt.path}: ${paths.join(', ')}`); return; }

  const subject = /^Subject: (?:\[PATCH[^\]]*\]\s*)?(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim();
  const head = writeAndPush(target, () => {
    git(['apply', '--index', file], { cwd: target.wt.path });
    const staged = lines(git(['diff', '--cached', '--name-only'], { cwd: target.wt.path })).sort();
    if (staged.join('\n') !== paths.join('\n')) throw new Error(`staged ${staged.join(', ')}, the patch names ${paths.join(', ')}`);
  }, `${change}: maintainer's patch ${basename(file)} (act.mjs)${subject ? ` — ${subject}` : ''}`);
  console.log(`patched ${target.branch} ${head}: ${paths.join(', ')}`);
}

// ---------- run ----------
try {
  if (act === 'merge') merge(rest[0]);
  else if (act === 'waiver') waiver(rest[0], rest[1]);
  else patch(rest[0], rest[1]);
} catch (e) {
  fail(e.message);
}
