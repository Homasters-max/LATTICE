// The basis of each record of a commit (TR-B02, LG-A05, REQ-LG-009, design D-7): from the commit alone — its session
// event and its act record — so it is the same when the commit is read back, re-applied or rebuilt.

import type { Id } from "../kernel/index.ts";
import type { Basis } from "../trust/index.ts";
import { basis } from "../trust/index.ts";
import type { Commit } from "./records.ts";

export function bases(commit: Commit): ReadonlyMap<Id, Basis> {
  const session = commit.records.find((r) => r.id === commit.by)?.body ?? null;
  const named = new Set(commit.acts?.flatMap((a) => a.names) ?? []);
  const out = new Map<Id, Basis>();
  for (const r of commit.records) out.set(r.id, basis(session, named.has(commit.proposal) || named.has(r.id)));
  return out;
}
