#!/usr/bin/env node
// Wait for the maintainer's merge of a PR of this repository (Changes infra-pr-watch D-1, infra-merge-flow D-7): exit
// when the PR is merged or closed, has a conflict, or loses its auto-merge. While auto-merge is on, a PR that falls
// behind main is updated (`gh pr update-branch`), and a red main turns auto-merge off. Checks GitHub every minute; a
// failed check is retried after a minute. The steps are `watchStep` of act-rules.mjs.
// Usage: node wait-pr.mjs <N> [--max-hours <h>]
// Exit: 0 merged or closed · 2 three gh errors in a row · 3 still open after --max-hours · 4 conflict ·
//       5 auto-merge off · 64 usage.
import { execFileSync } from 'node:child_process';
import { mainHealth, watchStep } from './act-rules.mjs';

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

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ghJson = (...a) => JSON.parse(gh(...a));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (e) => (e.stderr || e.message).toString().trim();

function facts() {
  const p = ghJson('pr', 'view', pr, '--json', 'number,state,mergeCommit,url,mergeStateStatus,autoMergeRequest,headRefOid,headRefName');
  const f = { ...p, mergeCommit: p.mergeCommit?.oid, autoMerge: !!p.autoMergeRequest };
  if (f.state === 'OPEN' && f.autoMerge) {
    const [testRun] = ghJson('run', 'list', '--workflow', 'test.yml', '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'conclusion,url');
    const open = ghJson('issue', 'list', '--state', 'open', '--limit', '1000', '--json', 'title');
    f.main = mainHealth({ testRun, openIssueTitles: open.map((i) => i.title) });
  }
  return f;
}

const deadline = Date.now() + maxHours * 3600_000;
let errors = 0;
let memo = {};
for (;;) {
  let step;
  try {
    const f = facts();
    step = watchStep(f, memo);
    if (step.disableAuto) gh('pr', 'merge', pr, '--disable-auto');
    if (step.update) {
      try {
        gh('pr', 'update-branch', pr);
      } catch (e) {
        if (/conflict/i.test(errorText(e))) step = { line: `PR #${pr} CONFLICT ${f.url} (update-branch: ${errorText(e)})`, exit: 4 };
        else throw e;
      }
    }
    memo = step.memo ?? memo; // a failed update is tried again on the next check
  } catch (e) {
    if (++errors >= 3) { console.error(`PR #${pr}: gh failed 3 times: ${errorText(e)}`); process.exit(2); }
    await sleep(60_000);
    continue;
  }
  errors = 0;
  if (step.line) console.log(step.line);
  if (step.exit !== undefined) process.exit(step.exit);
  if (Date.now() >= deadline) { console.log(`PR #${pr} still OPEN after ${maxHours} h`); process.exit(3); }
  await sleep(60_000);
}
