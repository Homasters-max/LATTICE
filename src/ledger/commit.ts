// Commits (LG-C01, LG-C02, LG-C04, REQ-CL-004, design D-5): the commit hash, and opening a ledger — every stored text
// admitted, canonical, of the commit form, `seq` growing and `prev` chained; the commits are frozen as they are read.

import type { Hash } from "../kernel/index.ts";
import { canonical, checkInput, hash } from "../kernel/index.ts";
import type { StoredLedger } from "./ports/store.ts";
import type { ReadView } from "./projections/latest.ts";
import { latest } from "./projections/latest.ts";
import type { Commit } from "./records.ts";
import { frozen } from "./records.ts";

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

function isCommitForm(value: unknown): value is Commit {
  if (!exactly(value, COMMIT_KEYS)) return false;
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
  readonly proposals: ReadonlyMap<string, number>;
};

/** Opens a stored ledger and verifies its hash chain (LG-C04); a refusal names the first broken commit. */
export function openLedger(stored: StoredLedger): { readonly ok: true; readonly ledger: Ledger } | { readonly ok: false; readonly message: string } {
  const broken = (seq: number | null, line: number, why: string) =>
    ({ ok: false, message: `LG-C04: ${seq === null ? `line ${line}` : `seq ${seq}`}: ${why}` }) as const;
  const commits: Commit[] = [];
  const proposals = new Map<string, number>();
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
  return { ok: true, ledger: { tail, view: latest(commits), proposals } };
}
