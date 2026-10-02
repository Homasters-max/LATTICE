// Commits (LG-C01, LG-C02, LG-C04, REQ-CL-004, design D-5): the commit hash, and opening a ledger — every stored text
// admitted, canonical, of the commit form, `seq` growing and `prev` chained; the commits are frozen as they are read.
// Opening a store (REQ-LG-010, s0-bootstrap design D-8) adds the genesis chain and the four commits of store init.

import type { Hash } from "../kernel/index.ts";
import { canonical, checkInput, hash } from "../kernel/index.ts";
import { GENESIS_HASH } from "./genesis.ts";
import type { StoredLedger } from "./ports/store.ts";
import type { ReadView } from "./projections/latest.ts";
import { latest } from "./projections/latest.ts";
import type { Commit, EntityRecord, LedgerRecord } from "./records.ts";
import { frozen, isEntityRecord } from "./records.ts";
import { packageHash, STD_HASH } from "./std.ts";

/** The kernel version of the store before the switch (LG-G05, LG-G06). */
export const KERNEL_VERSION = "0";

/** The commit hash: the kernel hash of type `core/commit` over the commit (REQ-CL-004 Hashes). */
export function commitHash(commit: Commit): Hash {
  const h = hash("core/commit", commit);
  if (!h.ok) throw new Error("commit hash: not JSON");
  return h.value;
}

/** The entity record hash: the kernel hash of the type without `@n` over the body (design I-1). */
export function recordHash(type: string, body: unknown): Hash {
  const h = hash(type.slice(0, type.lastIndexOf("@")), body);
  if (!h.ok) throw new Error("record hash: not JSON");
  return h.value;
}

const COMMIT_KEYS = ["at", "base", "by", "kernel", "prev", "proposal", "records", "seq"];
const ENTITY_KEYS = ["at", "body", "by", "hash", "id", "rev", "type"];
const EVENT_KEYS = ["at", "body", "by", "id", "type"];

/** An object with exactly these keys (`keys` sorted). */
function exactly(value: unknown, keys: readonly string[]): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
}

const nonEmpty = (v: unknown): boolean => typeof v === "string" && v !== "";

/** An act record (REQ-LG-003): a non-empty list of `{login, names, ref}` of non-empty strings. */
function isActsForm(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (a: unknown) =>
        exactly(a, ["login", "names", "ref"]) &&
        nonEmpty(a.login) &&
        nonEmpty(a.ref) &&
        Array.isArray(a.names) &&
        a.names.length > 0 &&
        a.names.every(nonEmpty),
    )
  );
}

function isCommitForm(value: unknown): value is Commit {
  const withActs = exactly(value, [...COMMIT_KEYS, "acts"].sort());
  if (!withActs && !exactly(value, COMMIT_KEYS)) return false;
  if (withActs && !isActsForm(value.acts)) return false;
  return (
    typeof value.seq === "number" &&
    Number.isSafeInteger(value.seq) &&
    value.seq >= 1 &&
    (value.prev === null || typeof value.prev === "string") &&
    Array.isArray(value.records) &&
    value.records.every((r: unknown) => exactly(r, ENTITY_KEYS) || exactly(r, EVENT_KEYS))
  );
}

/** The `seq` of a commit text, when it has a readable one. */
function readableSeq(text: string): number | null {
  const admitted = checkInput(text);
  const v = admitted.ok ? admitted.value : null;
  return typeof v === "object" && v !== null && "seq" in v && typeof v.seq === "number" ? v.seq : null;
}

/**
 * An opened ledger: its tail, the latest-revision projection over its commits (LG-J01), and the `proposal` hash of
 * every commit mapped to the `seq` of the first commit holding it (LG-C08, design D-2).
 */
export type Ledger = {
  readonly tail: { readonly seq: number; readonly hash: Hash } | null;
  readonly view: ReadView;
  readonly proposals: ReadonlyMap<Hash, number>;
};

export type Opened = { readonly ok: true; readonly ledger: Ledger } | { readonly ok: false; readonly message: string };

/** Opens a stored ledger and verifies its hash chain (LG-C04); a refusal names the first broken commit. */
export function openLedger(stored: StoredLedger): Opened {
  const read = readLedger(stored);
  return read.ok ? { ok: true, ledger: read.ledger } : read;
}

const refusal = (rule: string, seq: number, why: string) => ({ ok: false, message: `${rule}: seq ${seq}: ${why}` }) as const;

/** The session record of a commit: the record whose `id` is the commit's `by`. */
const sessionOf = (c: Commit): LedgerRecord | undefined => c.records.find((r) => r.id === c.by);

/** Commit 2 is a load of the `std` package by the conditions of its exemption (REQ-LG-002). */
function isStdLoad(c: Commit): boolean {
  const session = sessionOf(c);
  const body = session?.body as { kind?: unknown; purpose?: unknown } | undefined;
  if (session === undefined || isEntityRecord(session) || body?.kind !== "machine" || body?.purpose !== "init") return false;
  const entities = c.records.filter(isEntityRecord);
  if (entities.length + 1 !== c.records.length) return false;
  return packageHash(entities) === STD_HASH;
}

/** A commit of store init: besides its session event, exactly `entity` at `rev` 1 and events of the types `events`. */
function holdsExactly(c: Commit, entity: { id: string; type: string }, events: readonly string[]): boolean {
  const session = sessionOf(c);
  if (session === undefined || isEntityRecord(session)) return false;
  const rest = c.records.filter((r) => r !== session);
  const entities = rest.filter(isEntityRecord) as EntityRecord[];
  const others = rest.filter((r) => !isEntityRecord(r)).map((r) => r.type).sort();
  const e = entities[0];
  return (
    entities.length === 1 &&
    e !== undefined &&
    e.id === entity.id &&
    e.rev === 1 &&
    e.type === entity.type &&
    others.join("\n") === [...events].sort().join("\n")
  );
}

/**
 * Opens a project store (REQ-LG-010): `openLedger`, then its history must start with the four commits of store init for
 * `namespace` on the genesis chain of kernel `0`. A refusal names the rule (`LG-G01`…`LG-G04`) and the `seq`.
 */
export function openStore(stored: StoredLedger, namespace: string): Opened {
  const read = readLedger(stored);
  if (!read.ok) return read;
  const commits = read.commits;
  for (const [i, c] of commits.entries()) {
    if (c.kernel !== KERNEL_VERSION) return refusal("LG-G03", c.seq, `kernel ${c.kernel} is not ${KERNEL_VERSION}; no transition commit is known`);
    if (i === 0 && commitHash(c) !== GENESIS_HASH) return refusal("LG-G01", c.seq, "the first commit is not the genesis of kernel 0");
    if (i === 1 && !isStdLoad(c)) return refusal("LG-G02", c.seq, "the second commit is not a load of the std package of this LATTICE version");
    if (i === 2 && !holdsExactly(c, { id: `${namespace}/namespace`, type: "std/namespace@1" }, [])) {
      return refusal("LG-G04", c.seq, `the third commit does not create the namespace ${namespace} of store/lattice.json`);
    }
    if (i === 3 && !holdsExactly(c, { id: `${namespace}/setup`, type: "std/setup@1" }, ["std/live@1"])) {
      return refusal("LG-G04", c.seq, `the fourth commit does not write ${namespace}/setup@1 and its live fact`);
    }
  }
  if (commits.length < 4) {
    const seq = (commits.at(-1)?.seq ?? 0) + 1;
    return refusal("LG-G04", seq, `the store holds ${commits.length} of the four commits of store init; remove store/ and run lattice init again`);
  }
  return { ok: true, ledger: read.ledger };
}

function readLedger(stored: StoredLedger): { readonly ok: true; readonly ledger: Ledger; readonly commits: readonly Commit[] } | { readonly ok: false; readonly message: string } {
  const broken = (seq: number | null, line: number, why: string) =>
    ({ ok: false, message: `LG-C04: ${seq === null ? `line ${line}` : `seq ${seq}`}: ${why}` }) as const;
  const commits: Commit[] = [];
  const proposals = new Map<Hash, number>();
  let tail: { seq: number; hash: Hash } | null = null;
  for (const [i, { text }] of stored.commits.entries()) {
    const admitted = checkInput(text);
    const seq = readableSeq(text);
    if (!admitted.ok) return broken(seq, i + 1, "the commit is not JSON the kernel admits");
    const value = admitted.value;
    const again = canonical(value);
    if (!again.ok || again.value !== text) return broken(seq, i + 1, "the commit is not in canonical form");
    if (!isCommitForm(value)) return broken(seq, i + 1, "the commit is not of the commit form");
    if (tail !== null && value.seq <= tail.seq) return broken(value.seq, i + 1, "seq does not grow");
    if (value.prev !== (tail === null ? null : tail.hash)) {
      return broken(value.seq, i + 1, "prev is not the hash of the commit before");
    }
    commits.push(frozen(value));
    if (!proposals.has(value.proposal)) proposals.set(value.proposal, value.seq);
    tail = { seq: value.seq, hash: commitHash(value) };
  }
  if (stored.torn !== null) {
    return broken(readableSeq(stored.torn), stored.commits.length + 1, "a tail without a commit end marker");
  }
  return { ok: true, ledger: { tail, view: latest(commits), proposals }, commits };
}
