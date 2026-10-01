#!/usr/bin/env node
// Wait for the maintainer's merge of a PR of this repository (Change infra-pr-watch, design D-1): exit when the PR
// is merged or closed. Checks GitHub every minute; a failed check is retried after a minute.
// Usage: node wait-pr.mjs <N> [--max-hours <h>]
// Exit: 0 outcome printed · 2 three gh errors in a row · 3 still open after --max-hours · 64 usage.
import { execFileSync } from 'node:child_process';

const usage = () => {
  console.error('usage: node wait-pr.mjs <N> [--max-hours <h>]');
  process.exit(64);
};
const opts = { '--max-hours': '24' };
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] in opts) opts[argv[i]] = argv[++i];
  else if (argv[i].startsWith('--')) usage();
  else positional.push(argv[i]);
}
const [pr] = positional;
const maxHours = Number(opts['--max-hours']);
if (positional.length !== 1 || !/^\d+$/.test(pr) || !(maxHours > 0)) usage();

const view = () => JSON.parse(execFileSync('gh', ['pr', 'view', pr, '--json', 'state,mergeCommit,url'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const deadline = Date.now() + maxHours * 3600_000;
let errors = 0;
for (;;) {
  let p;
  try {
    p = view();
  } catch (e) {
    if (++errors >= 3) { console.error(`PR #${pr}: gh failed 3 times: ${(e.stderr || e.message).toString().trim()}`); process.exit(2); }
    await sleep(60_000);
    continue;
  }
  errors = 0;
  if (p.state === 'MERGED') { console.log(`PR #${pr} MERGED ${p.mergeCommit?.oid ?? ''} ${p.url}`); process.exit(0); }
  if (p.state === 'CLOSED') { console.log(`PR #${pr} CLOSED ${p.url}`); process.exit(0); }
  if (Date.now() >= deadline) { console.log(`PR #${pr} still ${p.state} after ${maxHours} h`); process.exit(3); }
  await sleep(60_000);
}
