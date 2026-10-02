#!/usr/bin/env node
// The retro of a wave (Change infra-coordinator, D-7): the `process` issues of a slice's wave as a markdown table for
// the umbrella — failure, root cause, prevention, proposed (left empty for the grilling), closable — and the issues that
// miss "Root cause" or "Prevention". It writes nothing: the coordinator posts the table as `[incident] retro <slice>
// wave <n>` and grills it with the maintainer (skill slice, "retro").
// Usage: node retro.mjs <slice> [--since <ISO date>] [--issues <N,…>]
// Exit: 0 printed · 2 no such milestone · 64 usage.
import { execFileSync } from 'node:child_process';
import { claimChanges, closable, firstSentence, parseIssue, section } from './rules.mjs';

const USAGE = 'usage: node retro.mjs <slice> [--since <ISO date>] [--issues <N,…>]';
const argv = process.argv.slice(2);
const opts = { since: null, issues: null };
const positional = [];
for (let k = 0; k < argv.length; k++) {
  const a = argv[k];
  if (a === '--since' || a === '--issues') {
    const v = argv[++k];
    if (!v || v.startsWith('--')) { console.error(USAGE); process.exit(64); }
    if (a === '--since') { if (Number.isNaN(Date.parse(v))) { console.error(USAGE); process.exit(64); } opts.since = v; }
    else opts.issues = v.split(',').map((x) => Number(x.replace('#', ''))).filter(Boolean);
  } else if (a.startsWith('--')) { console.error(USAGE); process.exit(64); } else positional.push(a);
}
if (positional.length !== 1) { console.error(USAGE); process.exit(64); }
const [target] = positional;

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const gh = (...a) => JSON.parse(sh('gh', a));
const git = (...a) => { try { return sh('git', a); } catch { return ''; } };

git('fetch', '-q', 'origin');
const milestone = gh('api', 'repos/{owner}/{repo}/milestones?state=all').find((m) => m.title.toLowerCase() === target.toLowerCase());
if (!milestone) { console.error(`no milestone named "${target}"`); process.exit(2); }
const issues = claimChanges(gh('issue', 'list', '--state', 'all', '--limit', '1000', '--json',
  'number,title,state,body,url,milestone,labels,createdAt,closedAt').map(parseIssue));
const umbrella = issues.find((i) => i.umbrella && i.milestone?.title === milestone.title);
const prs = gh('pr', 'list', '--state', 'all', '--limit', '500', '--json', 'number,state');

// The wave starts after the last `[decision] retro` of the umbrella, else at the milestone's creation.
let since = opts.since;
if (!since && umbrella) {
  const retro = sh('gh', ['api', '--paginate', `repos/{owner}/{repo}/issues/${umbrella.number}/comments`, '--jq',
    '.[] | select(.body | startswith("[decision] retro")) | .created_at']).split(/\r?\n/).filter(Boolean).at(-1);
  since = retro ?? null;
}
since ??= milestone.created_at;

const record = (change) => { try { return JSON.parse(git('show', `origin/main:.warrant/changes/${change}.json`)); } catch { return null; } };
const archivedOnMain = (change) => record(change)?.change_state === 'ARCHIVED';
const ctx = {
  archivedOnMain,
  prState: (n) => prs.find((p) => p.number === n)?.state ?? null,
  issueOf: (n) => issues.find((i) => i.number === n) ?? null,
};
const inWave = (i) => i.labels.includes('process') && (!i.milestone || i.milestone.title === milestone.title)
  && (Date.parse(i.createdAt) >= Date.parse(since) || (i.closedAt && Date.parse(i.closedAt) >= Date.parse(since)));
const chosen = opts.issues ? opts.issues.map((n) => issues.find((i) => i.number === n)).filter(Boolean) : issues.filter(inWave);
const missing = opts.issues ? opts.issues.filter((n) => !issues.some((i) => i.number === n)) : [];

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
console.log(`retro ${milestone.title}: ${chosen.length} process issues${opts.issues ? ' (given)' : ` since ${since}`}`);
console.log('');
console.log('| Issue | State | Failure | Root cause | Prevention | Proposed | Closable |');
console.log('|---|---|---|---|---|---|---|');
const gaps = [];
for (const i of chosen.sort((a, b) => a.number - b.number)) {
  const cause = section(i.body, 'Root cause');
  const prevention = section(i.body, 'Prevention');
  if (!cause || !prevention) gaps.push(`#${i.number} (${[!cause && 'Root cause', !prevention && 'Prevention'].filter(Boolean).join(', ')})`);
  console.log(`| [#${i.number}](${i.url}) | ${i.state.toLowerCase()} | ${cell(i.title)} | ${cell(firstSentence(cause) || '—')} | `
    + `${cell(firstSentence(prevention) || '—')} |  | ${closable(i, ctx) ?? '—'} |`);
}
console.log('');
if (gaps.length) console.log(`Missing sections: ${gaps.join(', ')}`);
if (missing.length) console.log(`Not found: ${missing.map((n) => `#${n}`).join(', ')}`);
