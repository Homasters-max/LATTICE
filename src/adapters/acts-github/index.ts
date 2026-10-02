// Adapter `github` of the `acts` port (CT-A03, CT-A05, LG-A04, LG-A05, REQ-AC-005): issue comments and reviews of one
// pull request, by a login of `logins`, naming the asked hash or intent ids — the way WARRANT accepts UNKNOWN
// decisions. The transport is injected and synchronous, as the port is; S0 ships none that reaches GitHub (slice SW).

import type { Act, Acts } from "../../ledger/ports/acts.ts";

/** A GET of the GitHub REST API at `path`, parsed; it throws on failure. */
export type Transport = (path: string) => unknown;

export type GithubActsOptions = {
  readonly repo: string;
  readonly pr: number;
  readonly logins: readonly string[];
  readonly transport: Transport;
};

type Item = { readonly login: string; readonly body: string; readonly ref: string };

const PAGE = 100;
// An identifier of the kernel grammar (REQ-KR-012): `namespace/local`, the namespace at most 64 characters.
const IDENTIFIER = /^([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*)\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LEADING = /^[(["'`]+/;
const TRAILING = /[.,;:!?)\]"'`]+$/;

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every page of one endpoint, from page 1 until a page holds fewer than 100 items; a page not a list fails. */
function readAll(transport: Transport, path: string): unknown[] {
  const all: unknown[] = [];
  for (let page = 1; ; page++) {
    const items = transport(`${path}?per_page=${PAGE}&page=${page}`);
    if (!Array.isArray(items)) throw new Error(`${path}: page ${page} is not a list`);
    all.push(...items);
    if (items.length < PAGE) return all;
  }
}

/** An item by one of `logins` on the pull request (`urlKey` ends with `suffix`), or `null`. */
function itemOf(raw: unknown, urlKey: string, suffix: string, logins: ReadonlySet<string>): Item | null {
  if (!isObject(raw)) return null;
  const user = raw.user;
  const login = isObject(user) ? user.login : undefined;
  const { body, html_url: ref } = raw;
  const url = raw[urlKey];
  if (typeof login !== "string" || typeof body !== "string" || typeof ref !== "string") return null;
  if (!logins.has(login) || typeof url !== "string" || !url.endsWith(suffix)) return null;
  return { login, body, ref };
}

/** What a text names for the hash `hash`: the hash first, then the identifiers in order of first appearance. */
function namesIn(body: string, hash: string): readonly string[] {
  let named = false;
  const ids: string[] = [];
  for (const raw of body.split(/\s+/u)) {
    const token = raw.replace(LEADING, "").replace(TRAILING, "");
    if (token === hash) named = true;
    else {
      const m = IDENTIFIER.exec(token);
      if (m !== null && (m[1] as string).length <= 64 && !ids.includes(token)) ids.push(token);
    }
  }
  return named ? [hash, ...ids] : ids;
}

export function githubActs(options: GithubActsOptions): Acts {
  const logins = new Set(options.logins);
  let items: readonly Item[] | null = null;
  const read = (): readonly Item[] => {
    const base = `/repos/${options.repo}`;
    const comments = readAll(options.transport, `${base}/issues/${options.pr}/comments`);
    const reviews = readAll(options.transport, `${base}/pulls/${options.pr}/reviews`);
    return [
      ...comments.map((c) => itemOf(c, "issue_url", `/issues/${options.pr}`, logins)),
      ...reviews.map((r) => itemOf(r, "pull_request_url", `/pulls/${options.pr}`, logins)),
    ].filter((x) => x !== null);
  };
  return {
    actsOn(proposal: string): readonly Act[] {
      items ??= read(); // a failed read throws and keeps nothing: the next call reads again
      const acts: Act[] = [];
      for (const { login, body, ref } of items) {
        const names = namesIn(body, proposal);
        if (names.length > 0) acts.push(Object.freeze({ login, names: Object.freeze([...names]), ref }));
      }
      return Object.freeze(acts.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)));
    },
  };
}
