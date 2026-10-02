#!/usr/bin/env node
// The local CI judge (#124; Change infra-merge-flow, I-22): the three steps of the job `warrant / warrant` —
// `warrant validate`, `warrant sync --check`, `warrant ci` — on the merge of HEAD with fresh origin/main, in a scratch
// worktree outside the repository, removed afterwards, so no evidence of the judge lands in a Change's folder.
// Run it from the worktree of the branch before a push that opens or updates a PR (rule process). The verdict is
// `judgeVerdict` of act-rules.mjs.
// Usage: node judge.mjs
// Exit: 0 no violation of the PR (an impl-PR may wait on CI and the merge) · 1 a violation or a conflict · 2 an error ·
//       64 usage.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeVerdict } from './act-rules.mjs';

if (process.argv.length > 2) {
  console.error('usage: node judge.mjs   (from the worktree of the branch to judge)');
  process.exit(64);
}
const WIN = process.platform === 'win32';
function sh(cmd, args, { cwd, ok = false, shell = false } = {}) {
  try {
    return execFileSync(cmd, args, { cwd, shell, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    if (ok) return e.stdout ?? '';
    throw new Error(`${cmd} ${args.join(' ')}: ${(e.stderr || e.message).toString().trim()}`);
  }
}
const envelope = (out) => { try { return JSON.parse(out); } catch { return null; } };

let dir;
let code = 2;
try {
  const head = sh('git', ['rev-parse', 'HEAD']).trim();
  if (sh('git', ['status', '--porcelain']).trim()) console.log('note: uncommitted changes are not judged — only HEAD');
  sh('git', ['fetch', '-q', 'origin']);
  const main = sh('git', ['rev-parse', 'origin/main']).trim();
  dir = mkdtempSync(join(tmpdir(), 'lattice-judge-'));
  sh('git', ['worktree', 'add', '-q', '--detach', dir, main]);
  console.log(`judge ${head.slice(0, 7)} merged with origin/main ${main.slice(0, 7)}:`);
  try {
    sh('git', ['-c', 'user.name=judge', '-c', 'user.email=judge@local', 'merge', '-q', '--no-ff', '--no-edit', head], { cwd: dir });
  } catch {
    const files = sh('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: dir, ok: true }).trim().split(/\r?\n/).join(', ');
    console.log(`judge: the merge with origin/main conflicts (${files}) — merge origin/main and resolve first`);
    code = 1;
    throw null;
  }
  const run = (args) => envelope(sh('warrant', args, { cwd: dir, ok: true, shell: WIN }));
  const verdict = judgeVerdict({ validate: run(['validate']), syncCheck: run(['sync', '--check']), ci: run(['ci']) });
  for (const l of verdict.lines) console.log(`  ${l}`);
  console.log(verdict.ok ? 'judge: no violation of the PR — push' : 'judge: violation — fix it before the push');
  code = verdict.ok ? 0 : 1;
} catch (e) {
  if (e) console.log(`judge: error: ${e.message}`);
} finally {
  if (dir) {
    sh('git', ['worktree', 'remove', '--force', dir], { ok: true });
    rmSync(dir, { recursive: true, force: true });
    sh('git', ['worktree', 'prune'], { ok: true });
  }
}
process.exit(code);
