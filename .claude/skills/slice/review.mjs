#!/usr/bin/env node
// The check before a PR enters the maintainer's queue (Change infra-coordinator, D-5): the PR's paths against what its
// Change may write, its dependencies, a conflict with main, the decision log, and the local judge on its head. The
// owner runs it before requesting a merge, the coordinator before showing the request. It prints and posts nothing.
// The rules are `scopeFindings` of act-rules.mjs; dependencies and the log come from `status.mjs <change> --json`.
// Usage: node review.mjs <N>
// Exit: 0 every check passes · 1 a check fails · 2 an error · 64 usage.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeOfBranch, scopeFindings } from './act-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
if (argv.length !== 1 || !/^\d+$/.test(argv[0])) { console.error('usage: node review.mjs <N>'); process.exit(64); }
const N = argv[0];

function sh(cmd, args, { ok = false } = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    if (ok) return e.stdout ?? '';
    throw new Error(`${cmd} ${args.join(' ')}: ${(e.stderr || e.message).toString().trim()}`);
  }
}
const git = (...a) => sh('git', a);
const show = (ref, path) => { try { return git('show', `${ref}:${path}`); } catch { return null; } };
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };

let failed = false;
const line = (ok, name, text) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${text ? `: ${text}` : ''}`); };

try {
  git('fetch', '-q', '--prune', 'origin');
  const pr = JSON.parse(sh('gh', ['pr', 'view', N, '--json', 'number,url,state,headRefName,mergeStateStatus,isDraft']));
  console.log(`review #${pr.number} ${pr.headRefName} (${pr.state}${pr.isDraft ? ', draft' : ''}) ${pr.url}`);
  const head = `origin/${pr.headRefName}`;
  const branch = changeOfBranch(pr.headRefName);

  // 0–1. Scope: the branch's own paths (three dots: merges of main add none).
  const files = git('diff', '--name-status', '--no-renames', `origin/main...${head}`).split(/\r?\n/).filter(Boolean)
    .map((l) => { const [status, ...p] = l.split('\t'); return { status: status[0], path: p.join('\t') }; });
  const runs = files.filter((f) => /^\.warrant\/runs\/RUN-[A-Z0-9]+\.json$/.test(f.path) && f.status !== 'D')
    .map((f) => json(show(head, f.path))).filter(Boolean);
  const waivers = Object.fromEntries(files.filter((f) => f.path.startsWith('.warrant/waivers/') && f.status !== 'D')
    .map((f) => [f.path, json(show(head, f.path))?.change ?? null]));
  const authors = new Map();
  let current = null;
  for (const l of git('log', '--no-merges', '--format=@%an <%ae>', '--name-only', `origin/main..${head}`).split(/\r?\n/)) {
    if (l.startsWith('@')) current = l.slice(1);
    else if (l.trim() && current) authors.set(l.trim(), [...(authors.get(l.trim()) ?? []), current]);
  }
  const config = json(show('origin/main', '.warrant/warrant.json')) ?? {};
  const profile = json(show('origin/main', '.warrant/local/profiles/human-acceptance.json')) ?? {};
  const findings = scopeFindings({
    branch: pr.headRefName, files, runs, waivers,
    authorsOf: (p) => authors.get(p) ?? [],
    agentLogins: (config.identities?.agents ?? []).map((a) => a.login),
    humanGlobs: profile.match?.paths ?? [],
  });
  line(!findings.length, 'scope', findings.length ? `\n${findings.map((x) => `       ${x.path} — ${x.why}`).join('\n')}`
    : branch ? `${files.length} paths of ${branch.change}` : 'no Change: no Change files, no policy path');

  // 2, 4. Dependencies and the log, from status.mjs.
  if (branch) {
    const st = spawnSync(process.execPath, [join(HERE, 'status.mjs'), branch.change, '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const row = json(st.stdout)?.rows?.[0];
    if (!row) line(false, 'status', `status.mjs ${branch.change} gave no row: ${(st.stderr || st.stdout || '').trim().split('\n')[0]}`);
    else {
      const waiting = row.depends.filter((d) => !d.done).map((d) => d.on);
      line(!waiting.length, 'dependencies', waiting.length ? `not done: ${waiting.join(', ')}` : 'done');
      const pending = row.log?.pending ?? [];
      line(!pending.length, 'log', pending.length ? `\n${pending.map((e) => `       ${e.url} — ${e.line}`).join('\n')}` : 'no pending entry');
      for (const c of row.log?.unread ?? []) console.log(`note unread: ${c.url} — ${c.line}`);
    }
  } else line(true, 'dependencies, log', 'no Change');

  // 3. Conflict with main.
  line(pr.mergeStateStatus !== 'DIRTY', 'conflict', pr.mergeStateStatus === 'DIRTY' ? 'a merge conflict with main' : `none (${pr.mergeStateStatus})`);

  // 5. The local judge on the PR's head.
  const judge = spawnSync(process.execPath, [join(HERE, 'judge.mjs'), head], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = (judge.stdout ?? '').trim().split(/\r?\n/);
  line(judge.status === 0, 'judge', `exit ${judge.status}\n${out.map((l) => `       ${l}`).join('\n')}`);
} catch (e) {
  console.log(`review: error: ${e.message}`);
  process.exit(2);
}
console.log(failed ? 'review: a check failed — not for the maintainer\'s queue yet' : 'review: every check passes');
process.exit(failed ? 1 : 0);
