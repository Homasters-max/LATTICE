// Commits (LG-C01, LG-C02, LG-C04, REQ-CL-004, design D-5): the commit form, the commit hash, and opening a ledger —
// every stored text admitted, canonical, of the commit form, `seq` growing and `prev` chained.

import { canonical, checkInput, hash } from "../kernel/index.ts";
import type { StoredLedger } from "./ports/store.ts";
import type { Commit } from "./records.ts";
import type { ReadView } from "./projections/latest.ts";
import { latest } from "./projections/latest.ts";

/** The kernel version of the store before the switch (LG-G05, LG-G06). */
export const KERNEL_VERSION = "0";

/** The commit hash: the kernel hash of type `core/commit` over the commit (REQ-CL-004 Hashes). */
export function commitHash(commit: Commit): string {
  const h = hash("core/commit", commit);
  if (!h.ok) throw new Error("commit hash: not JSON");
  return h.value;
}

/** The entity record hash: the kernel hash of the type without `@n` over the body (design I-1). */
export function recordHash(type: string, body: unknown): string {
  const h = hash(type.slice(0, type.lastIndexOf("@")), body);
  if (!h.ok) throw new Error("record hash: not JSON");
  return h.value;
}

const COMMIT_KEYS = ["at", "base", "by", "kernel", "prev", "proposal", "records", "seq"];
const ENTITY_KEYS = ["at", "body", "by", "hash", "id", "rev", "type"];
const EVENT_KEYS = ["at", "body", "by", "id", "type"];

function hasExactly(value: unknown, keys: readonly string[]): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
}

function isCommitForm(value: unknown): value is Commit {
  if (!hasExactly(value, COMMIT_KEYS)) return false;
  return (
    typeof value.seq === "number" &&
    Number.isSafeInteger(value.seq) &&
    value.seq >= 1 &&
    (value.prev === null || typeof value.prev === "string") &&
    Array.isArray(value.records) &&
    value.records.every((r: unknown) => hasExactly(r, ENTITY_KEYS) || hasExactly(r, EVENT_KEYS))
  );
}

/** An opened ledger: its commits in order, its tail and the latest-revision projection over it (LG-J01). */
export type Ledger = {
  readonly commits: readonly Commit[];
  readonly tail: { readonly seq: number; readonly hash: string } | null;
  readonly view: ReadView;
};

export type Opened =
  | { readonly ok: true; readonly ledger: Ledger }
  | { readonly ok: false; readonly seq: number | null; readonly line: number; readonly message: string };

/** Opens a stored ledger and verifies its hash chain (LG-C04); a refusal names the first broken commit. */
export function openLedger(stored: StoredLedger): Opened {
  const commits: Commit[] = [];
  let tail: { seq: number; hash: string } | null = null;
  for (const [i, { text }] of stored.commits.entries()) {
    const line = i + 1;
    const broken = (seq: number | null, why: string): Opened => ({
      ok: false,
      seq,
      line,
      message: `LG-C04: ${seq === null ? `line ${line}` : `seq ${seq}`}: ${why}`,
    });
    const admitted = checkInput(text);
    if (!admitted.ok) return broken(null, "the commit is not JSON the kernel admits");
    const value = admitted.value;
    const seq = typeof value === "object" && value !== null && "seq" in value && typeof value.seq === "number" ? value.seq : null;
    const text2 = canonical(value);
    if (!text2.ok || text2.value !== text) return broken(seq, "the commit is not in canonical form");
    if (!isCommitForm(value)) return broken(seq, "the commit is not of the commit form");
    if (tail !== null && value.seq <= tail.seq) return broken(value.seq, "seq does not grow");
    if (value.prev !== (tail === null ? null : tail.hash)) {
      return broken(value.seq, "prev is not the hash of the commit before");
    }
    commits.push(value);
    tail = { seq: value.seq, hash: commitHash(value) };
  }
  if (stored.torn !== null) {
    const line = stored.commits.length + 1;
    return { ok: false, seq: null, line, message: `LG-C04: line ${line}: a tail without a commit end marker` };
  }
  return { ok: true, ledger: { commits, tail, view: latest(commits) } };
}
