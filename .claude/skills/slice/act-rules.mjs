// The rules of act.mjs and wait-pr.mjs (Change infra-merge-flow), as pure functions over plain data: no gh, git or
// warrant here. The scripts gather the facts and act; act-rules.test.mjs checks the rules (node --test).
import { escapeRegExp as escape, isFixMain, testResult, versionMatches } from './rules.mjs';

export const END_STATE = { spec: 'SPECIFIED', impl: 'VERIFYING', archive: 'ARCHIVED' };
export const ENTRY_TAGS = ['[decision]', '[scope]', '[broadcast]'];
// Every tag of the decision log (Change infra-coordinator, D-3): `[incident]` binds no one, but a tagged comment is an
// entry, never an acknowledgement (I-4).
export const LOG_TAGS = [...ENTRY_TAGS, '[incident]'];
export const COPY_FILES = ['act.mjs', 'act-rules.mjs', 'rules.mjs'];
const BOOTSTRAP_ACTS = new Set(['patch', 'whoami']);

const refusal = (reason, fix) => ({ reason, fix });
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

// `impl/s0-store-2` → { kind: 'impl', change: 's0-store-2' }; any other branch → null.
export const CHANGE_NAME = /^[\w.-]+$/;
export function changeOfBranch(branch) {
  const m = /^(spec|impl|archive)\/([\w.-]+)$/.exec(branch ?? '');
  return m ? { kind: m[1], change: m[2] } : null;
}

// ---------- parsing of git output ----------

// `git worktree list --porcelain` → [{ path, branch }].
export const parseWorktrees = (out) => out.split(/\r?\n\r?\n/).map((b) => ({
  path: b.match(/^worktree (.+)$/m)?.[1],
  branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1],
})).filter((w) => w.path);

// Paths of `git apply --numstat -z`: "a\td\tpath\0", a rename "a\td\t\0old\0new\0" (both paths count).
export function parsePatchPaths(out) {
  const tokens = out.split('\0');
  const paths = [];
  for (let k = 0; k < tokens.length; k++) {
    const m = /^[\d-]+\t[\d-]+\t(.*)$/s.exec(tokens[k].replace(/^\r?\n/, ''));
    if (!m) continue;
    if (m[1]) paths.push(m[1]);
    else { paths.push(tokens[k + 1], tokens[k + 2]); k += 2; }
  }
  return [...new Set(paths.filter(Boolean))].sort();
}

// The Subject of a `git format-patch` mail, unfolded (a long one spans several header lines, RFC 5322), without
// `[PATCH]` and without a leading `<change>: `; null for a plain diff.
export function patchSubject(text, change) {
  const header = text.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  const raw = /^Subject: (?:\[PATCH[^\]]*\]\s*)?(.+)$/m.exec(header)?.[1]?.trim();
  return raw?.startsWith(`${change}: `) ? raw.slice(change.length + 2) : raw ?? null;
}

// ---------- who runs it, and which copy (D-2) ----------

// `Kat <94626159+Homasters-max@users.noreply.github.com> 1727866000 +0300`: is it an agent's identity?
// Exact, case-insensitive: the name is the login, or the email is `<digits>+<login>@users.noreply.github.com`.
export function isAgentIdent(ident, agentLogins) {
  const m = /^(.*?)\s*<([^>]*)>/.exec(ident ?? '');
  if (!m) return false;
  const [, name, email] = m;
  return agentLogins.some((login) => same(name.trim(), login)
    || new RegExp(`^\\d+\\+${escape(login)}@users\\.noreply\\.github\\.com$`, 'i').test(email.trim()));
}

// { agentShell, login, maintainers, agentLogins, authorIdent, committerIdent, needsAuthor } → refusals. The committer
// counts too: `lastPush` reads it, so an agent's committer would hide pending entries.
export function actorRefusals({ agentShell, login, maintainers, agentLogins, authorIdent, committerIdent, needsAuthor }) {
  const out = [];
  if (agentShell) {
    out.push(refusal("this is an agent's shell (CLAUDECODE is set)",
      "act.mjs is the maintainer's act: the agent asks for it, the maintainer runs it in their own terminal"));
  }
  if (!login) out.push(refusal('gh has no login here', 'gh auth login with your own account'));
  else if (maintainers.length && !maintainers.some((m) => same(m, login))) {
    out.push(refusal(`this terminal acts as ${login}, not as a maintainer (${maintainers.join(', ')})`,
      "run it where gh uses your own login, without the agent's GH_TOKEN"));
  }
  for (const [role, ident] of [['author', authorIdent], ['committer', committerIdent]]) {
    if (needsAuthor && isAgentIdent(ident, agentLogins)) {
      out.push(refusal(`the git ${role} of the commit would be an agent: ${ident}`,
        "run it in a terminal without the agent's GIT_AUTHOR_* / GIT_COMMITTER_* variables"));
    }
  }
  if (!maintainers.length) out.push(refusal('origin/main names no maintainer (roles.maintainer of .warrant/warrant.json)', 'report it to the agent'));
  return out;
}

// files: [{ name, local, main }] — blob ids of the copy next to the script and of origin/main (null: absent there).
// → { mode: 'run' | 'reexec' | 'bootstrap' } or { refusals }. A copy that differs runs the version of origin/main.
export function copyPlan({ files, act, dryRun, reexecuted }) {
  if (!files.find((f) => f.name === 'act.mjs')?.main) {
    if (dryRun || BOOTSTRAP_ACTS.has(act)) return { mode: 'bootstrap' };
    return { refusals: [refusal(`bootstrap: origin/main has no act.mjs, and ${act} must not run the code under its own merge`,
      'until act.mjs is on main, the merge is asked as gh pr merge <N> --merge --auto')] };
  }
  if (files.every((f) => f.local === f.main)) return { mode: 'run' };
  if (reexecuted) {
    return { refusals: [refusal('the copy of origin/main differs from origin/main after re-execution',
      'report it to the agent: the temporary copy could not be written')] };
  }
  return { mode: 'reexec' };
}

// ---------- health of main (D-3, D-7, I-1) ----------

// The last completed `test.yml` run of main and the open issues titled `infra: main red — …` (rule tracking):
// either one makes main red. → { state: red | green | unknown, note }.
export function mainHealth({ testRun, openIssueTitles = [] }) {
  const red = openIssueTitles.filter((t) => /^infra: main red\b/.test(t));
  if (red.length) return { state: 'red', note: `open issue "${red[0]}"` };
  return testResult(testRun);
}

// ---------- entries of the umbrella (D-4, I-3, I-8, I-12, I-13) ----------

// "s0-store" is not in "s0-store-2" (as rules.mjs namesIn); "#11" is not in "#111" nor in "SRA#11", and a URL counts
// only for this repository (`<owner>/<repo>`).
const namesChange = (text, change) => !!change && new RegExp(`(?<![\\w.-])${escape(change)}(?![\\w-])`).test(text);
const namesNumber = (text, n, repo) => !!n && new RegExp(`(?<![\\w/-])#${n}(?!\\d)${repo ? `|github\\.com/${escape(repo)}/(?:issues|pull)/${n}(?!\\d)` : ''}`, 'i').test(text);
const namesArea = (text, area) => new RegExp(`\`${escape(area)}\`|\\bAREA ${escape(area)}\\b`).test(text);
const commentId = (url) => /#issuecomment-(\d+)/.exec(url ?? '')?.[1];

// The time of the last push of a PR: the newest commit that is not a merge and was committed by an agent — a merge
// of main by the watcher or the owner, and a commit of act.mjs by the maintainer, move nothing. commits: [{ date,
// committer }] of `git log --no-merges origin/main..<head>`; null when there is none.
export function lastPush(commits, agentLogins) {
  const own = commits.filter((c) => isAgentIdent(c.committer, agentLogins)).map((c) => Date.parse(c.date));
  return own.length ? new Date(Math.max(...own)).toISOString() : null;
}
// The last push of a Change (infra-coordinator D-3): `lastPush` over the commits of all its branches on origin
// (spec/, impl/, archive/), merged or not, whose subject starts with `<change>: ` — so a merged PR still counts.
// commits: [{ date, committer, subject }].
export const changeLastPush = (commits, change, agentLogins) => lastPush(commits.filter((c) => (c.subject ?? '').startsWith(`${change}: `)), agentLogins);
// Times compare as instants: GitHub writes `…:00Z`, `toISOString` `…:00.000Z`.
const after = (a, b) => Date.parse(a) > Date.parse(b);

// comments: [{ url, createdAt, body, where: 'umbrella' | 'issue' | 'pr' }] → the entries that touch the PR, are newer
// than `since` and are not acknowledged. In doubt (no `since`) an entry is pending: a refusal, never a missed entry.
// repo: `<owner>/<repo>` of the PR.
export function pendingEntries({ comments, change, issue, pr, areas = [], since, repo }) {
  const touches = (text) => text.trimStart().startsWith('[broadcast]') || namesChange(text, change)
    || namesNumber(text, issue, repo) || namesNumber(text, pr, repo) || areas.some((a) => namesArea(text, a));
  const isEntry = (c) => c.where !== 'pr' && ENTRY_TAGS.some((t) => c.body.trimStart().startsWith(t));
  const tagged = (c) => LOG_TAGS.some((t) => c.body.trimStart().startsWith(t));
  const acknowledges = (c, entry) => after(c.createdAt, entry.createdAt) && !c.body.trimStart().startsWith('⛔') && !tagged(c)
    && new RegExp(`issuecomment-${commentId(entry.url)}(?!\\d)`).test(c.body)
    && (c.where === 'pr' || namesChange(c.body, change) || namesNumber(c.body, pr, repo));
  return comments
    .filter((c) => isEntry(c) && touches(c.body) && (!since || after(c.createdAt, since)))
    .filter((e) => commentId(e.url) && !comments.some((c) => c !== e && acknowledges(c, e)))
    .map((e) => ({ url: e.url, createdAt: e.createdAt, line: e.body.trimStart().split(/\r?\n/)[0].slice(0, 120) }));
}

// ---------- merge (D-3) ----------

const FAILED_CONCLUSIONS = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const FAILED_STATES = new Set(['FAILURE', 'ERROR']);
export const failedChecks = (rollup) => (rollup ?? [])
  .filter((c) => FAILED_CONCLUSIONS.has(c.conclusion) || FAILED_STATES.has(c.state))
  .map((c) => c.name ?? c.context ?? '?');

// pr: gh pr view fields; record: the Change record on the head (or null); issueFound: an issue names the Change;
// pending: pendingEntries; main: mainHealth.
export function mergeRefusals({ pr, record, issueFound, pending, main }) {
  const out = [];
  const branch = changeOfBranch(pr.headRefName);
  if (pr.state !== 'OPEN') out.push(refusal(`PR #${pr.number} is ${pr.state}, not OPEN`, 'nothing to merge'));
  if (pr.baseRefName !== 'main') out.push(refusal(`PR #${pr.number} targets ${pr.baseRefName}, not main`, 'the owner retargets it'));
  if (pr.isDraft) out.push(refusal(`PR #${pr.number} is a draft`, 'a draft PR is never merged: the owner marks it ready (gh pr ready)'));
  const failed = failedChecks(pr.statusCheckRollup);
  if (failed.length) out.push(refusal(`failed checks: ${failed.join(', ')}`, 'the owner fixes CI and pushes'));
  if (pr.mergeStateStatus === 'DIRTY') out.push(refusal('a merge conflict with main', 'the owner merges origin/main, resolves and pushes'));
  if (branch) {
    const want = END_STATE[branch.kind];
    if (!record) out.push(refusal(`no record of ${branch.change} on the head`, `the owner commits warrant transition ${branch.change} ${want}`));
    else if (record.change_state !== want) {
      out.push(refusal(`the record of ${branch.change} on the head is ${record.change_state}, not ${want}`,
        `the owner ends the PR with warrant transition ${branch.change} ${want}`));
    }
    if (!issueFound) out.push(refusal(`no issue names Change ${branch.change} in its Where: line`, 'the coordinator fixes the issue'));
  }
  for (const e of pending) {
    out.push(refusal(`entry ${e.url} touches this PR, is newer than its last push and not acknowledged: ${e.line}`,
      'the owner acts on it and comments in the PR with its link'));
  }
  if (main.state === 'red' && !(branch && isFixMain(branch.change))) {
    out.push(refusal(`main is red (${main.note})`, 'only the fix of main is merged (rule tracking); ask again when main is green'));
  }
  return out;
}

// ---------- worktree, waiver, patch (D-5, D-6) ----------

// matches: worktrees on the branch [{ path }]; dirty: lines of `git status --porcelain`;
// relation of HEAD to origin/<branch>: equal | behind | ahead | diverged | no-remote.
export function worktreeRefusals({ branch, matches, dirty, relation }) {
  if (matches.length === 0) return [refusal(`no worktree on ${branch}`, `the owner's session checks out ${branch} in its worktree`)];
  if (matches.length > 1) return [refusal(`several worktrees on ${branch}: ${matches.map((w) => w.path).join(', ')}`, 'one worktree per Change')];
  const out = [];
  if (dirty.length) out.push(refusal(`${matches[0].path} has changes: ${dirty.join('; ')}`, 'the owner commits them, with no Run active, and pushes'));
  if (relation === 'no-remote') out.push(refusal(`origin/${branch} does not exist`, 'the owner pushes the branch'));
  if (relation === 'ahead' || relation === 'diverged') out.push(refusal(`${branch} has commits not on origin`, 'the owner pushes first'));
  return out;
}

// The id of a waiver: `WAV-<ULID>` (WARRANT 0.10.1, SRA#139) or the former `WAV-<year>-NNN` — the pattern of
// `.warrant/schemas/waiver.1.schema.json` (Change pin-v0-10-1, I-6).
export const WAIVER_ID = /^WAV-([0-9]{4}-[0-9]{3}|[0-9A-HJKMNP-TV-Z]{26})$/;

// waiver: the file on origin/impl/<change> (or null); others: [{ ref, change }] — the same id on origin/main and the
// other origin/impl/* branches (a collision of the former `WAV-<year>-NNN`, SRA#139); cli: `warrant --version`;
// kernel of warrant.json.
export function waiverRefusals({ change, wav, waiver, others, cli, kernel }) {
  const out = [];
  if (!waiver) out.push(refusal(`no ${wav} on origin/impl/${change}`, `the owner proposes it (warrant waive ${change} …) and pushes`));
  else {
    if (waiver.change !== change) out.push(refusal(`${wav} is a waiver of ${waiver.change}, not of ${change}`, 'check the id'));
    if (waiver.waiver_state !== 'PROPOSED') out.push(refusal(`${wav} is ${waiver.waiver_state}, not PROPOSED`, 'nothing to activate'));
  }
  for (const o of others.filter((x) => x.change !== change)) {
    out.push(refusal(`${wav} is also a waiver of ${o.change} on ${o.ref}`, `the owner re-proposes it under a new id (SRA#139)`));
  }
  if (!versionMatches(cli, kernel)) out.push(refusal(`warrant ${cli || '(none)'} here, the project pins ${kernel}`, `install warrant ${kernel}`));
  return out;
}

// '**/' any directories, '**' anything, '*' within one segment.
export function globToRegExp(glob) {
  const body = glob.split(/(\*\*\/|\*\*|\*)/).map((p) => (p === '**/' ? '(?:.*/)?' : p === '**' ? '.*' : p === '*' ? '[^/]*' : escape(p))).join('');
  return new RegExp(`^${body}$`);
}

// The writer of a path, when it is not the maintainer's patch (refused first, I-2), or null when a patch may carry it.
export function patchPathWriter(path, change, allowGlobs) {
  const own = `openspec/changes/${change}/`;
  const refused = [
    [['src/**', 'test/**', `${own}design.md`, `${own}tasks.md`, `${own}specs/**`], 'the implement Run'],
    [['**/AGENTS.md', '.warrant/warrant.lock.json'], 'warrant sync'],
    [['.warrant/changes/**', '.warrant/evidence/**', '.warrant/runs/**', '.warrant/waivers/**', 'openspec/specs/**'], 'warrant only (rule process)'],
  ];
  for (const [globs, writer] of refused) if (globs.some((g) => globToRegExp(g).test(path))) return writer;
  if (path === `${own}proposal.md` || allowGlobs.some((g) => globToRegExp(g).test(path))) return null;
  return 'not a path the maintainer patches (profile human-acceptance or the proposal of the Change)';
}

// file: { exists, insideRepo }; paths of the patch; applies: git apply --check on origin/<branch> (null: not checked,
// there is no worktree — its own refusal says so).
export function patchRefusals({ change, file, paths, allowGlobs, applies, applyError }) {
  const out = [];
  if (!file.exists) return [refusal(`no patch file ${file.path}`, 'the agent names the path it wrote')];
  if (file.insideRepo) out.push(refusal(`${file.path} lies inside a worktree of the repository`, 'the agent writes patches outside the repository'));
  if (!paths.length) out.push(refusal('the patch changes no path', 'the agent re-cuts it'));
  for (const p of paths) {
    const writer = patchPathWriter(p, change, allowGlobs);
    if (writer) out.push(refusal(`${p} is written by ${writer}`, 'the agent drops it from the patch'));
  }
  if (applies === false) out.push(refusal(`the patch does not apply: ${applyError ?? ''}`.trim(), 'the agent re-cuts it on the branch'));
  return out;
}

// ---------- review of a PR (Change infra-coordinator, D-5) ----------

const POLICY_PATHS = ['.warrant/local/**', '.warrant/warrant.lock.json', '.github/workflows/**'];
const CHANGE_FILES = ['.warrant/changes/**', '.warrant/evidence/**', '.warrant/runs/**', 'openspec/changes/**'];
const matchesAny = (globs, p) => globs.some((g) => globToRegExp(g).test(p));

// The paths of a PR (`git diff --name-status origin/main...<head>`: [{ path, status }]) against what its Change may
// write. runs: the Run files of the diff [{ id, change, operation, write_scope, scope }]; authorsOf(path): the authors
// of the PR's commits that touch it; waivers: { path: change } of the waiver files of the diff; humanGlobs: the profile
// `human-acceptance` of origin/main. → [{ path, why }]; empty when every path is the Change's own.
export function scopeFindings({ branch, files, runs = [], authorsOf = () => [], agentLogins = [], humanGlobs = [], waivers = {} }) {
  const b = changeOfBranch(branch);
  if (!b) {
    return files.flatMap((f) => (matchesAny(CHANGE_FILES, f.path) ? [{ path: f.path, why: "a Change's files on a branch outside <kind>/<change>" }]
      : matchesAny(POLICY_PATHS, f.path) ? [{ path: f.path, why: 'a policy path in a PR without a Change (rule tracking)' }] : []));
  }
  const { kind, change } = b;
  const own = `openspec/changes/${change}/`;
  const mine = runs.filter((r) => r.change === change);
  const runIds = new Set(mine.map((r) => r.id));
  const byRun = (p) => mine.filter((r) => r.operation === 'implement').some((r) => matchesAny(r.write_scope ?? [], p)
    && (!(r.scope ?? []).length || matchesAny(r.scope, p)));
  const byMaintainer = (p) => { const a = authorsOf(p); return a.length > 0 && a.every((x) => !isAgentIdent(x, agentLogins)); };
  // What `warrant sync` writes after a rule or a pin changes; the job's `validate` and `sync --check` prove it is
  // exactly that (Change pin-v0-10-1, I-2).
  const synced = files.some((f) => f.path.startsWith('.warrant/local/rules/') || f.path === '.warrant/warrant.lock.json');
  const archived = new RegExp(`^openspec/changes/archive/[\\w.-]+-${escape(change)}/`);
  const caps = new Set(files.map((f) => (archived.test(f.path) ? /\/specs\/([\w.-]+)\//.exec(f.path.replace(archived, '/'))?.[1] : null)).filter(Boolean));
  const why = (f) => {
    const p = f.path;
    if (p === `.warrant/changes/${change}.json` || p.startsWith(`.warrant/evidence/${change}/`)) return null;
    const run = /^\.warrant\/runs\/(RUN-[A-Z0-9]+)(?:\.result)?\.json$/.exec(p);
    if (run) return runIds.has(run[1]) ? null : "another Change's Run";
    if (p.startsWith('.warrant/changes/')) return "another Change's record";
    if (p.startsWith('.warrant/evidence/')) return 'evidence of another Change';
    if (kind === 'spec') return p.startsWith(own) ? null : 'outside the spec of the Change';
    if (kind === 'archive') {
      if (p.startsWith(own) && f.status === 'D') return null;
      if (archived.test(p)) return null;
      const cap = /^openspec\/specs\/([\w.-]+)\//.exec(p)?.[1];
      return cap && caps.has(cap) ? null : 'outside the archive of the Change';
    }
    if ([`${own}tasks.md`, `${own}design.md`].includes(p) || p.startsWith(`${own}specs/`)) return null;
    if (p.startsWith('.warrant/waivers/')) return waivers[p] === change ? null : "another Change's waiver";
    if (p === `${own}proposal.md`) return byMaintainer(p) ? null : 'the proposal, not by the maintainer';
    if ((p === 'AGENTS.md' || p === '.warrant/warrant.lock.json' || p.startsWith('.warrant/schemas/')) && synced) return null;
    if (matchesAny(humanGlobs, p)) return byMaintainer(p) ? null : 'a policy path not by the maintainer';
    return byRun(p) ? null : "outside the Runs' scope";
  };
  return files.map((f) => ({ path: f.path, why: why(f) })).filter((x) => x.why);
}

// ---------- the local judge (#124, I-22) ----------

// The gates an impl-PR waits on from CI and the merge (rule process): a test-report attested by CI, the evidence that
// follows from it, and the maintainer's merge.
const WAITS_ON_CI = new Set(['tests-passed', 'factory-golden-passed', 'evidence-complete', 'human-approval']);
const waitsOnCi = (f) => (f.code === 'ATTESTATION_REQUIRED' && f.kind === 'test-report')
  || (f.code === 'EVIDENCE_MISSING' && (f.items ?? []).every((i) => i === 'test-report'))
  || f.kind === 'human-approval';
const codes = (env) => (env?.errors ?? []).map((e) => e.code).join(', ') || 'failed';
// The envelopes of the three steps of the job `warrant / warrant`, in its order. → { ok, lines, waits }: ok when
// validate and sync --check pass and `warrant ci` reports no violation of the PR (an impl-PR may wait on CI and the
// merge only). Every other finding is a violation — FRONTEND_HOOKS_INACTIVE too: the guard of WARRANT 0.10.1 sees a
// worktree session (#93; Change pin-v0-10-1, I-12, ending the exception of #128).
export function judgeVerdict({ validate, syncCheck, ci }) {
  const lines = [];
  let ok = true;
  for (const [name, env] of [['warrant validate', validate], ['warrant sync --check', syncCheck]]) {
    if (env?.ok === true) lines.push(`${name}: ok`);
    else { ok = false; lines.push(`${name}: ${env ? codes(env) : 'no JSON envelope'}`); }
  }
  const kind = ci?.data?.kind ?? '?';
  if (!ci) { lines.push('warrant ci: no JSON envelope'); return { ok: false, lines, waits: [] }; }
  if (ci.ok) { lines.push(`warrant ci (${kind}): ok`); return { ok, lines, waits: [] }; }
  const gates = Object.entries(ci.data?.gates ?? {}).filter(([, v]) => v !== 'PASS').map(([g]) => g);
  const findings = ci.data?.findings ?? [];
  const violations = [
    ...(ci.errors ?? []).filter((e) => e.code !== 'GATE_NOT_PASSED').map((e) => e.code),
    ...(kind === 'impl' ? gates.filter((g) => !WAITS_ON_CI.has(g)) : gates).map((g) => `gate ${g}`),
    ...(kind === 'impl' ? findings.filter((f) => !waitsOnCi(f)) : findings).map((f) => `${f.code}${f.gate ? ` (${f.gate})` : ''}`),
  ];
  if (violations.length) {
    lines.push(`warrant ci (${kind}): ${[...new Set(violations)].join(', ')}`);
    return { ok: false, lines, waits: [] };
  }
  if (!gates.length) { lines.push(`warrant ci (${kind}): ${codes(ci)}`); return { ok: false, lines, waits: [] }; }
  lines.push(`warrant ci (${kind}): waits on CI and the merge only — ${gates.join(', ')}`);
  return { ok, lines, waits: gates };
}

// ---------- the watcher (D-7) ----------

// facts: { number, state, mergeCommit, url, mergeStateStatus, autoMerge, headRefOid, headRefName, main } (main only
// while auto-merge is on); memo: { seenAuto, updatedFrom }. → { line, exit, update, disableAuto, memo }.
export function watchStep(f, memo = {}) {
  const pr = `PR #${f.number}`;
  if (f.state === 'MERGED') return { line: `${pr} MERGED ${f.mergeCommit ?? ''} ${f.url}`, exit: 0, memo };
  if (f.state === 'CLOSED') return { line: `${pr} CLOSED ${f.url}`, exit: 0, memo };
  if (f.mergeStateStatus === 'DIRTY') return { line: `${pr} CONFLICT ${f.url}`, exit: 4, memo };
  const fixMain = isFixMain(changeOfBranch(f.headRefName)?.change);
  if (f.autoMerge && f.main?.state === 'red' && !fixMain) {
    return { line: `${pr} AUTO-MERGE OFF (main red: ${f.main.note}) ${f.url}`, exit: 5, disableAuto: true, memo };
  }
  if (!f.autoMerge && memo.seenAuto) return { line: `${pr} AUTO-MERGE OFF ${f.url}`, exit: 5, memo };
  const next = { ...memo, seenAuto: memo.seenAuto || !!f.autoMerge };
  if (f.autoMerge && f.mergeStateStatus === 'BEHIND' && f.headRefOid !== memo.updatedFrom) {
    return { line: `${pr} behind main — updated`, update: true, memo: { ...next, updatedFrom: f.headRefOid } };
  }
  return { memo: next };
}
