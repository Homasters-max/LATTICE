// Namespace policy (CT-N01, CT-N03, CT-A05, REQ-CT-001, design D-7): the form of the body of a namespace entity, and
// the logins whose acts count — the writers listed by name. S0 writes and reads the policy; apply does not enforce it.

export type Writer = { readonly login: string } | { readonly kind: "human" | "agent" | "machine" };

export type Policy = { readonly owner: string; readonly writers: readonly Writer[]; readonly owner_acts: readonly string[] };

export type PolicyOf = { readonly ok: true; readonly policy: Policy } | { readonly ok: false; readonly path: string };

const LOGIN = /^[A-Za-z0-9-]+$/;
const KINDS: ReadonlySet<unknown> = new Set(["human", "agent", "machine"]);
const KEYS = ["owner", "writers", "owner_acts"];

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isLogin = (v: unknown): v is string => typeof v === "string" && LOGIN.test(v);

function writerOk(w: unknown): boolean {
  if (!isObject(w)) return false;
  const keys = Object.keys(w);
  if (keys.length !== 1) return false;
  return keys[0] === "login" ? isLogin(w.login) : keys[0] === "kind" && KINDS.has(w.kind);
}

const refused = (path: string): PolicyOf => ({ ok: false, path });

/** The policy of a namespace body, or the JSON pointer of its first deviation in the order of REQ-CT-001. */
export function policyOf(body: unknown): PolicyOf {
  if (!isObject(body)) return refused("");
  if (!isLogin(body.owner)) return refused("/owner");
  const writers = body.writers;
  if (!Array.isArray(writers)) return refused("/writers");
  const badWriter = writers.findIndex((w) => !writerOk(w));
  if (badWriter >= 0) return refused(`/writers/${badWriter}`);
  const acts = body.owner_acts;
  if (!Array.isArray(acts)) return refused("/owner_acts");
  const badAct = acts.findIndex((a, i) => typeof a !== "string" || a === "" || acts.indexOf(a) !== i);
  if (badAct >= 0) return refused(`/owner_acts/${badAct}`);
  const extra = Object.keys(body)
    .filter((k) => !KEYS.includes(k))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
  if (extra !== undefined) return refused("/" + extra.replace(/~/g, "~0").replace(/\//g, "~1"));
  return { ok: true, policy: { owner: body.owner, writers: writers as Writer[], owner_acts: acts as string[] } };
}

/** The logins of the writers listed by name, each once, by UTF-16 code units: only they can act (CT-A05). */
export function actLogins(policy: Policy): readonly string[] {
  const logins = new Set<string>();
  for (const w of policy.writers) if ("login" in w) logins.add(w.login);
  return Object.freeze([...logins].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}
