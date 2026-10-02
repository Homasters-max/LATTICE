// The rules of a slice, as pure functions over plain data: no gh, git or warrant here.
// status.mjs gathers the data and calls them; rules.test.mjs checks them (node --test).

// A fix of a red main (rule tracking): exempt from the freeze, the WIP cap and the AREA hold.
export const isFixMain = (change) => typeof change === 'string' && change.startsWith('fix-main-');

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
  const where = body.match(/^Where:(.*)$/m)?.[1] ?? '';
  const change = where.match(/Change `([^`]+)`/)?.[1] ?? null;
  const labels = (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  const deps = dependsOn(body);
  return {
    ...i,
    labels,
    change,
    // An AREA is held by a Change (SL-T08): without a Change the line names none.
    // "AREA `TR` + `AC` + `CT`" — the "+"-joined list right after the word; trailing prose is ignored.
    areas: change ? (where.match(/AREA\s+(`?[A-Z]{2,}`?(?:\s*\+\s*`?[A-Z]{2,}`?)*)/)?.[1] ?? '').match(/[A-Z]{2,}/g) ?? [] : [],
    depIssues: deps.issues,
    depBranches: deps.branches,
    umbrella: /^\s*- \[[ x]\] #\d+/m.test(body),
    kind: issueKind(change, labels),
  };
}

// Several issues may name one Change in `Where:` — its own issue and, say, a bug it fixes (rule tracking).
// The Change's issue is the one whose title names it (`<prefix>: <change> — …`), else the oldest; the others
// refer to it (`refersTo`) and are read by their labels, with no AREA.
const namesIn = (title, change) => new RegExp(`(?<![\\w.-])${change.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(title ?? '');
export function claimChanges(issues) {
  const byChange = new Map();
  for (const i of issues) if (i.change) byChange.set(i.change, [...(byChange.get(i.change) ?? []), i]);
  const owner = new Map();
  for (const [change, list] of byChange) {
    const titled = list.filter((i) => namesIn(i.title, change));
    owner.set(change, [...(titled.length ? titled : list)].sort((a, b) => a.number - b.number)[0].number);
  }
  return issues.map((i) => (!i.change || owner.get(i.change) === i.number ? i
    : { ...i, change: null, refersTo: i.change, areas: [], kind: issueKind(null, i.labels) }));
}

// change | bug | question | docs. A bug or a question without a Change is not a docs PR.
export function issueKind(change, labels) {
  if (change) return 'change';
  if (labels.includes('bug')) return 'bug';
  if (labels.includes('question')) return 'question';
  return 'docs';
}

// The state of main from its checks, each { state: green | red | unknown, note }: red over unknown over green.
export function mainState(checks) {
  const worst = checks.find((c) => c.state === 'red') ?? checks.find((c) => c.state === 'unknown');
  return worst ? worst.state : 'green';
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

// Holders of AREAs, each { change, areas, initAt } (initAt: ISO time of `warrant init change`, or null).
// Per AREA the holders are ordered by initAt; the first keeps it, each later one is in a collision.
// A fix-main-* Change is never a later holder (exempt), but holds against later ones when it came first.
// When the order cannot be read (a time missing, or two equal), every holder that is not fix-main collides.
export function areaHolders(holders) {
  const byArea = new Map();
  for (const h of holders) for (const a of h.areas) {
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(h);
  }
  const busy = new Map();       // AREA -> [change, …] in init order
  const collisions = [];        // { area, first, later: [change, …] }
  for (const [area, hs] of byArea) {
    const times = hs.map((h) => h.initAt);
    const ordered = hs.length > 1 && times.every(Boolean) && new Set(times).size === times.length;
    const sorted = ordered ? [...hs].sort((x, y) => (x.initAt < y.initAt ? -1 : 1)) : hs;
    busy.set(area, sorted.map((h) => h.change));
    if (hs.length < 2) continue;
    const later = (ordered ? sorted.slice(1) : sorted).filter((h) => !isFixMain(h.change));
    if (later.length) collisions.push({ area, first: ordered ? sorted[0].change : null, later: later.map((h) => h.change) });
  }
  return { busy, collisions };
}

// The collisions a Change is a later holder in: [{ area, with }] — `with` the first holder, or the others when unordered.
export function collisionsOf(change, collisions, busy) {
  return collisions.filter((c) => c.later.includes(change))
    .map((c) => ({ area: c.area, with: c.first ?? busy.get(c.area).filter((x) => x !== change).join(', ') }));
}

// The AREAs a Change without a record waits for: held by another Change; a fix-main-* waits for none.
export function heldFor(change, areas, busy) {
  if (isFixMain(change)) return [];
  return areas.filter((a) => (busy.get(a) ?? []).some((c) => c !== change)).map((a) => ({ area: a, by: busy.get(a).filter((c) => c !== change)[0] }));
}
