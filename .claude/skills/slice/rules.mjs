// The rules of a slice, as pure functions over plain data: no gh, git or warrant here.
// status.mjs gathers the data and calls them; rules.test.mjs checks them (node --test).

export const WIP_MAX = 3;

// A literal string as a part of a RegExp (shared with act-rules.mjs).
export const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A fix of a red main (rule tracking): exempt from the freeze, the WIP cap and the AREA hold.
export const isFixMain = (change) => typeof change === 'string' && change.startsWith('fix-main-');

// ---------- issues ----------

// "Depends on: #55, `impl/x`. Closes #94." — only its first sentence lists dependencies.
export function dependsOn(body) {
  const line = body.match(/^Depends on:(.*)$/m)?.[1] ?? '';
  const sentence = line.split(/\.(?=\s|$)/)[0];
  return {
    issues: [...sentence.matchAll(/#(\d+)/g)].map((m) => Number(m[1])),
    branches: [...sentence.matchAll(/`([\w.-]+\/[\w.-]+)`/g)].map((m) => m[1]),
  };
}

// An issue of GitHub (`gh issue list --json number,title,state,body,url,milestone,labels`) with the fields a slice reads.
export function parseIssue(i) {
  const body = i.body ?? '';
  const where = whereOf(body);
  const change = changeOfWhere(where);
  const labels = (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  const deps = dependsOn(body);
  const declaredAreas = areasOfWhere(where);
  return {
    ...i,
    labels,
    change,
    // An AREA is held by a Change (SL-T08): without a Change the line holds none, but declares it (#112).
    declaredAreas,
    areas: change ? declaredAreas : [],
    depIssues: deps.issues,
    depBranches: deps.branches,
    umbrella: /^\s*- \[[ x]\] #\d+/m.test(body),
    kind: issueKind(change, labels, declaredAreas),
  };
}

// "AREA `TR` + `AC` + `CT`" — the "+"-joined list right after the word; trailing prose is ignored.
export const areasOfWhere = (where) => (where.match(/AREA\s+(`?[A-Z]{2,}`?(?:\s*\+\s*`?[A-Z]{2,}`?)*)/)?.[1] ?? '').match(/[A-Z]{2,}/g) ?? [];
function whereOf(body) { return (body ?? '').match(/^Where:(.*)$/m)?.[1] ?? ''; }
function changeOfWhere(where) { return where.match(/Change `([^`]+)`/)?.[1] ?? null; }

// Several issues may name one Change in `Where:` — its own issue and, say, a bug it fixes (rule tracking).
// The Change's issue is the one whose title names it (`<prefix>: <change> — …`), else the oldest; the others
// refer to it (`refersTo`) and are read by their labels, with no AREA.
const namesIn = (title, change) => new RegExp(`(?<![\\w.-])${escapeRegExp(change)}(?![\\w-])`).test(title ?? '');
export function claimChanges(issues) {
  const byChange = new Map();
  for (const i of issues) if (i.change) byChange.set(i.change, [...(byChange.get(i.change) ?? []), i]);
  const owner = new Map();
  for (const [change, list] of byChange) {
    const titled = list.filter((i) => namesIn(i.title, change));
    owner.set(change, [...(titled.length ? titled : list)].sort((a, b) => a.number - b.number)[0].number);
  }
  return issues.map((i) => (!i.change || owner.get(i.change) === i.number ? i
    : { ...i, change: null, refersTo: i.change, areas: [], kind: issueKind(null, i.labels, []) }));
}

// change | bug | question | unnamed | docs, in this order. A bug or a question without a Change is not a docs PR; nor
// is an issue whose `Where:` declares an AREA but names no Change (#112): it needs a Change name.
export function issueKind(change, labels, declaredAreas = []) {
  if (change) return 'change';
  if (labels.includes('bug')) return 'bug';
  if (labels.includes('question')) return 'question';
  if (declaredAreas.length) return 'unnamed';
  return 'docs';
}

// Open bug / question P1 issues that no Change takes (neither its own nor one it refers to).
export const isOpenP1WithoutChange = (i) => i.state === 'OPEN' && !i.change && !i.refersTo
  && (i.kind === 'bug' || i.kind === 'question') && i.labels.includes('P1');

// ---------- health of main ----------

// The state of main from its checks, each { state: green | red | unknown, note }: red over unknown over green.
export function mainState(checks) {
  const worst = checks.find((c) => c.state === 'red') ?? checks.find((c) => c.state === 'unknown');
  return worst ? worst.state : 'green';
}

// The last completed `test` run on main ({ conclusion, url } or undefined): only a failed run is red.
export function testResult(run) {
  if (!run) return { state: 'unknown', note: 'test: no completed run on main yet' };
  const state = run.conclusion === 'success' ? 'green' : /^(failure|timed_out|startup_failure)$/.test(run.conclusion ?? '') ? 'red' : 'unknown';
  return { state, note: `test ${state === 'unknown' ? run.conclusion : state} ${run.url}` };
}

// `warrant --version` against `kernel` of warrant.json ("0.10" a range of patches, "0.10.0" one version).
export function versionMatches(cli, kernel) {
  if (!cli || !kernel) return false;
  const want = String(kernel).trim().split('.');
  const have = String(cli).trim().split('.');
  return want.every((part, k) => have[k] === part);
}

// The summary of a `warrant validate` envelope: { state, note }.
export function validateResult(envelope, ref) {
  if (!envelope || typeof envelope.ok !== 'boolean') return { state: 'unknown', note: `warrant validate ${ref}: no JSON envelope` };
  if (envelope.ok) return { state: 'green', note: `warrant validate ${ref}: ok` };
  const counts = new Map();
  for (const e of envelope.errors ?? []) counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
  const codes = [...counts].map(([c, n]) => (n > 1 ? `${c} ×${n}` : c)).join(', ') || 'failed';
  return { state: 'red', note: `warrant validate ${ref}: ${codes}` };
}

// ---------- AREAs ----------

// Holders of AREAs, each { change, areas, initAt, areaAt } (initAt: ISO time of `warrant init change`, or null;
// areaAt: { AREA: time } for an AREA added after init by a [decision], held from that decision — I-1).
// Per AREA the holders are ordered by initAt; the first keeps it, each later one is in a collision.
// A fix-main-* Change is never a later holder (exempt), but holds against later ones when it came first.
// When the order cannot be read (a time missing, or two equal), every holder that is not fix-main collides.
export function holdersOf(holders) {
  const byArea = new Map();
  for (const h of holders) for (const a of h.areas) byArea.set(a, [...(byArea.get(a) ?? []), { ...h, initAt: h.areaAt?.[a] ?? h.initAt, byDecision: !!h.areaAt?.[a] }]);
  const busy = new Map();       // AREA -> [change, …] in init order
  const collisions = [];        // { area, first, later: [change, …] }
  for (const [area, holdersOfArea] of byArea) {
    const times = holdersOfArea.map((h) => h.initAt);
    const ordered = holdersOfArea.length > 1 && times.every(Boolean) && new Set(times).size === times.length;
    const sorted = ordered ? [...holdersOfArea].sort((x, y) => (x.initAt < y.initAt ? -1 : 1)) : holdersOfArea;
    busy.set(area, sorted.map((h) => h.change));
    if (holdersOfArea.length < 2) continue;
    // A later holder whose AREA a [decision] added (Adds: …, I-1) is ordered by that decision: it waits, no collision.
    const later = (ordered ? sorted.slice(1) : sorted).filter((h) => !isFixMain(h.change) && !(ordered && h.byDecision));
    if (later.length) collisions.push({ area, first: ordered ? sorted[0].change : null, later: later.map((h) => h.change) });
  }
  return {
    busy,
    collisions,
    // The collisions a Change is a later holder in: [{ area, with }] — the first holder, or the others when unordered.
    collisionsOf: (change) => collisions.filter((c) => c.later.includes(change))
      .map((c) => ({ area: c.area, with: c.first ?? busy.get(c.area).filter((x) => x !== change).join(', ') })),
    // The AREAs a Change waits for: held by another Change; a fix-main-* waits for none.
    heldFor: (change, areas) => (isFixMain(change) ? [] : areas.filter((a) => (busy.get(a) ?? []).some((c) => c !== change))
      .map((a) => ({ area: a, by: busy.get(a).filter((c) => c !== change)[0] }))),
  };
}
export const collisionText = (collided) => collided.map((c) => `${c.area} with ${c.with}`).join(', ');
export const heldText = (held) => held.map((h) => `${h.area} (${h.by})`).join(', ');

// ---------- next action ----------

// The next action of a row: { text, who, action } — action `start` (may be dispatched), `merge` (the maintainer
// merges a PR), or null. A row: { change, kind, refersTo, issueState, state, areas, hasWorktree, archivedOnMain,
// open: { number, kind, checks, isDraft } | null, merged: { spec, impl }, deps: [{ label, done, decide }], collided }.
// ctx: { heldFor(change, areas), wipCount }.
export function nextAction(r, ctx) {
  const say = (text, who, action = null) => ({ text, who, action });
  const p = r.open;
  const ci = p?.checks === 'running' ? ' (CI running)' : '';
  if (r.state === 'ABANDONED') return say('abandoned', '—');
  // ARCHIVED on its branch only: the archive-PR is not merged — an open one goes through the PR checks below.
  if (r.state === 'ARCHIVED' && r.archivedOnMain) return say('done', '—');
  // A later holder of an AREA waits for the maintainer's decision, whatever its other next step (rule process).
  if (r.collided?.length) return say(`AREA collision ${collisionText(r.collided)} — needs a decision`, '👤 maintainer');
  if (r.state === 'ARCHIVED' && !p) return say('open archive-PR', 'agent');
  if (!r.state && r.issueState === 'CLOSED') return r.change ? say('closed without a Change — needs a decision', '👤 maintainer') : say('done', '—');
  if (p && p.checks === 'red') return say(`fix CI on #${p.number}`, 'agent');
  if (p && p.isDraft) return say('finish draft PR (blocking UNKNOWN, or ⛔ a slice decision)', 'agent');
  if (r.kind === 'unnamed') return say('needs a Change name: its Where: declares an AREA (#112)', '👤 coordinator');
  if (!r.change && p) return say(`review + merge #${p.number}${ci}`, '👤 maintainer', 'merge');
  // A bug or a question without a Change is not a docs PR (rule tracking).
  if (r.kind === 'bug') return say(r.refersTo ? `bug: fixed by Change ${r.refersTo}` : 'bug: needs a fix Change or a PR that closes it', '—');
  if (r.kind === 'question') return say("question: needs the maintainer's answer", '👤 maintainer');
  if (p && p.kind === 'spec') {
    // SPECIFIED is the last commit before the review is asked (rule process, step 1); the merge is the approval.
    if (r.state === 'PROPOSED') return say('verify, transition SPECIFIED, push — before the review', 'agent');
    return say(`merge spec-PR #${p.number}${ci}`, '👤 maintainer', 'merge');
  }
  if (p && p.kind === 'impl') return r.state === 'VERIFYING' ? say(`merge impl-PR #${p.number}${ci}`, '👤 maintainer', 'merge') : say('implement → VERIFYING', 'agent');
  if (p && p.kind === 'archive') return say(`merge archive-PR #${p.number}${ci}`, '👤 maintainer', 'merge');
  if (p) return say(`review + merge #${p.number}${ci}`, '👤 maintainer', 'merge');
  if (!r.state) {
    const decide = r.deps.filter((d) => d.decide).map((d) => d.label);
    if (decide.length) return say(`decide on ${decide.join(', ')} (dependency)`, '👤 maintainer');
    const wait = r.deps.filter((d) => !d.done).map((d) => d.label);
    if (wait.length) return say(`wait ${wait.join(', ')}`, '—');
    const held = ctx.heldFor(r.change, r.areas);
    if (held.length) return say(`wait AREA ${heldText(held)}`, '—');
    if (r.hasWorktree) return say(r.change ? 'spec: init change, specify' : 'open the docs PR', 'agent');
    return say(r.change ? 'launch' : 'launch (docs PR)', 'coordinator', 'start');
  }
  switch (r.state) {
    case 'PROPOSED': return say('specify → review → spec-PR', 'agent');
    case 'SPECIFIED':
      if (!r.merged.spec) return say('open spec-PR', 'agent');
      return ctx.wipCount < WIP_MAX || isFixMain(r.change) ? say('start impl-PR', 'coordinator', 'start') : say(`wait WIP ${ctx.wipCount}/${WIP_MAX}`, '—');
    case 'APPROVED': case 'IMPLEMENTING': return say('implement → VERIFYING, impl-PR', 'agent');
    case 'VERIFYING': return r.merged.impl ? say('archive-PR', 'agent') : say('open impl-PR', 'agent');
    case 'MERGED': return say('warrant archive, archive-PR', 'agent');
  }
  return say('?', '—');
}

// A red main blocks dispatch, except the fix of main (rule tracking): { startable, text, who }.
export function dispatch(change, next, mainState) {
  const startable = next.action === 'start';
  if (startable && mainState === 'red' && !isFixMain(change)) return { startable: false, text: `${next.text} — blocked: main is red`, who: '—' };
  return { startable, text: next.text, who: next.who };
}

// The maintainer queue: one row per AREA collision, the rows the maintainer acts on (a row in a collision is
// covered by its AREA row), the open PRs other rows depend on; while main is red a merge of anything but its
// fix is held (rule tracking). rows: [{ change, number, who, text, action, url, collided }];
// depPRs: [{ number, title, url, checks, head, dependentOf }].
export function maintainerQueue({ rows, collisions, busy, depPRs, mainState }) {
  const queue = [
    ...collisions.map((c) => ({ what: `AREA collision ${c.area}: ${busy.get(c.area).join(', ')} — needs a decision`, url: '' })),
    ...rows.filter((r) => r.who.startsWith('👤') && !r.collided?.length)
      .map((r) => ({ what: `${r.change ?? `#${r.number}`}: ${r.text}`, url: r.url ?? '', merge: r.action === 'merge' && !isFixMain(r.change) })),
    ...depPRs.map((d) => ({ what: `#${d.number} ${d.title} (dependency of #${d.dependentOf}, CI ${d.checks})`, url: d.url,
      merge: !isFixMain(d.head.split('/').slice(1).join('/')) })),
  ].filter((q, k, a) => a.findIndex((x) => (q.url ? x.url === q.url : x.what === q.what)) === k);
  return queue.map(({ what, url, merge }) => ({ what: mainState === 'red' && merge ? `${what} — held: main is red` : what, url }));
}

// ---------- the decision log and issues (Change infra-coordinator) ----------

const instant = (t) => Date.parse(t);
export const INIT_GRACE_MS = 60 * 1000;

// An AREA added to `Where:` after `warrant init change` (D-4). revisions: [{ editedAt, body }] of the issue's
// userContentEdits (the oldest is the body as created; none: never edited). The revision in effect at init is the newest
// one edited at or before initAt + INIT_GRACE_MS (initAt is the session's clock, editedAt GitHub's). An AREA of today's
// Where: not in it is added — except AR on a skip_specs Change. A [decision] with a line `Adds: AREA <X> to <change>`
// clears it (I-7), and the Change holds it from that decision (I-1). → [{ area, editedAt, decision: { url, createdAt } | null }].
export function areasAddedAfterInit({ change, body, revisions = [], initAt, skipSpecs = false, decisions = [] }) {
  const known = revisions.filter((r) => typeof r.body === 'string' && r.editedAt);
  if (!initAt || !known.length) return [];
  const today = areasOfWhere(whereOf(body));
  const sorted = [...known].sort((a, b) => instant(a.editedAt) - instant(b.editedAt));
  const atInit = [...sorted].reverse().find((r) => instant(r.editedAt) <= instant(initAt) + INIT_GRACE_MS) ?? sorted[0];
  const where = whereOf(atInit.body);
  if (changeOfWhere(where) !== change) return [];
  const before = new Set(areasOfWhere(where));
  return today.filter((a) => !before.has(a) && !(skipSpecs && a === 'AR')).map((area) => {
    const first = sorted.find((r) => instant(r.editedAt) > instant(atInit.editedAt) && areasOfWhere(whereOf(r.body)).includes(area));
    const adds = new RegExp(`^Adds: AREA \`?${escapeRegExp(area)}\`? to \`?${escapeRegExp(change)}\`?\\s*$`, 'm');
    const d = decisions.find((c) => c.body.trimStart().startsWith('[decision]') && adds.test(c.body));
    return { area, editedAt: first?.editedAt ?? null, decision: d ? { url: d.url, createdAt: d.createdAt } : null };
  });
}

// A section of an issue body by its name ("Root cause", "Prevention"): a heading or a bold label line, up to the next
// heading, bold label line or `Where:` / `Depends on:` / `Why:` / `Done when` line. → its text, or null.
export function section(body, name) {
  const lines = (body ?? '').split(/\r?\n/);
  const n = escapeRegExp(name);
  const start = lines.findIndex((l) => new RegExp(`^(#{1,6}\\s*${n}\\b|\\*\\*${n}\\b|${n}:)`, 'i').test(l.trim()));
  if (start < 0) return null;
  const stop = (l) => /^#{1,6}\s/.test(l.trim()) || /^\*\*[^*]+\*\*:?/.test(l.trim()) || /^(Where|Depends on|Why|Done when)\b/.test(l.trim());
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(stop);
  const first = lines[start].trim().replace(new RegExp(`^(#{1,6}\\s*|\\*\\*)?${n}(\\*\\*)?:?(\\*\\*)?\\s*`, 'i'), '');
  return [first, ...(end < 0 ? rest : rest.slice(0, end))].join('\n').trim();
}
export const firstSentence = (text) => (text ?? '').replace(/\s+/g, ' ').trim().replace(/^[-*]\s+/, '').split(/(?<=[.;])\s/)[0] ?? '';

// The references of a text: `#N` of this repository (not `SRA#N`, not `owner/repo#N`) and its URLs; any other
// repository counts as foreign.
export function references(text, repo) {
  const local = new Set();
  let foreign = 0;
  const here = (r) => !!repo && r.toLowerCase() === repo.toLowerCase();
  for (const m of (text ?? '').matchAll(/(?<![\w/-])#(\d+)(?!\d)/g)) local.add(Number(m[1]));
  for (const m of (text ?? '').matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/(\d+)/g)) {
    if (here(m[1])) local.add(Number(m[2])); else foreign++;
  }
  for (const m of (text ?? '').matchAll(/([\w.-]+\/[\w.-]+)#(\d+)|\bSRA#\d+/g)) {
    if (m[1] && here(m[1])) local.add(Number(m[2])); else foreign++;
  }
  return { local: [...local].sort((a, b) => a - b), foreign };
}

// Is an open issue closable by rule tracking (a hint the coordinator judges)? ctx: { repo, archivedOnMain(change),
// prState(n) → MERGED | OPEN | CLOSED | null (not a PR), issueOf(n) → { state, change } | null }. → reason or null.
export function closable(i, ctx) {
  if (i.state !== 'OPEN') return null;
  if (i.change) return ctx.archivedOnMain(i.change) ? 'archived' : null;
  if (i.labels.includes('process')) {
    const refs = references(section(i.body, 'Prevention'), ctx.repo);
    if (!refs.local.length || refs.foreign) return null;
    const done = (n) => { const pr = ctx.prState(n); if (pr) return pr === 'MERGED';
      const o = ctx.issueOf(n); return !!o && (o.change ? ctx.archivedOnMain(o.change) : o.state === 'CLOSED'); };
    return refs.local.every(done) ? 'prevention landed' : null;
  }
  if (!i.labels.includes('bug') && !i.labels.includes('enhancement')) return null;
  return i.refersTo && ctx.archivedOnMain(i.refersTo) ? `fixed by ${i.refersTo}` : null;
}

// The size of AGENTS.md against WARRANT's limit (16 KiB): a warning above 14 KiB (D-1).
export const AGENTS_LIMIT = 16384;
export const AGENTS_WARN = 14336;
export function agentsBudget(bytes) {
  if (bytes == null) return { state: 'unknown', note: 'AGENTS.md: not read' };
  const note = `AGENTS.md ${bytes} / ${AGENTS_LIMIT} bytes`;
  return bytes > AGENTS_WARN ? { state: 'warn', note: `${note} ⚠ — move procedure from the rules into the skill` } : { state: 'ok', note };
}

// The comments of a Change's issue that are newer than its last push (all of them before the first push): read, never
// acknowledged (D-3, the #97 gap). comments: [{ url, createdAt, body }].
export const unreadComments = (comments, since) => comments.filter((c) => !since || Date.parse(c.createdAt) > Date.parse(since))
  .map((c) => ({ url: c.url, createdAt: c.createdAt, line: c.body.trimStart().split(/\r?\n/)[0].slice(0, 120) }));

// The refs whose commits count for the last push of a Change: its branches on origin, merged or not, and origin/main
// (a merged PR stays there even if its branch is deleted). refs: Set of short ref names.
export const changePushRefs = (change, refs) => ['spec', 'impl', 'archive'].map((k) => `origin/${k}/${change}`)
  .filter((r) => refs.has(r)).concat(refs.has('origin/main') ? ['origin/main'] : []);
