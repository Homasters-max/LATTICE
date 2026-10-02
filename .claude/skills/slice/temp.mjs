// Temporary worktrees of the slice scripts in the OS temp directory: `lattice-status-*` (status.mjs) and
// `lattice-judge-*` (judge.mjs). A killed run skips its own cleanup (#126); the next run sweeps what is older than
// STALE_MS — a younger one may belong to a run of another session.
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export const STALE_MS = 60 * 60 * 1000;
export const STATUS_PREFIX = 'lattice-status-';
export const JUDGE_PREFIX = 'lattice-judge-';

const git = (args, cwd) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return ''; }
};

// Removes the stale temp worktrees with one of `prefixes`: registered ones through git, directories left before
// `git worktree add` registered them by deletion. `cwd`: a directory of the repository.
export function sweepStale(prefixes, cwd = process.cwd()) {
  const tmp = resolve(tmpdir());
  const ours = (p) => prefixes.some((x) => basename(p).startsWith(x));
  const old = (p) => { try { return Date.now() - statSync(p).mtimeMs > STALE_MS; } catch { return false; } };
  const registered = git(['worktree', 'list', '--porcelain'], cwd).split(/\r?\n/)
    .filter((l) => l.startsWith('worktree ')).map((l) => resolve(l.slice(9).trim()));
  for (const p of registered) {
    if (dirname(p).toLowerCase() === tmp.toLowerCase() && ours(p) && old(p)) git(['worktree', 'remove', '--force', p], cwd);
  }
  git(['worktree', 'prune'], cwd);
  let names = [];
  try { names = readdirSync(tmp).filter((n) => ours(n)); } catch { /* unreadable temp */ }
  for (const n of names) {
    const p = join(tmp, n);
    if (!registered.some((r) => r.toLowerCase() === p.toLowerCase()) && old(p)) {
      try { rmSync(p, { recursive: true, force: true }); } catch { /* in use */ }
    }
  }
}
