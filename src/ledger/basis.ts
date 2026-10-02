// The basis of each record of a commit (TR-B02, LG-A05, REQ-LG-009, design D-7): from the commit alone — its session
// event and its act record — so it is the same when the commit is read back, re-applied or rebuilt.

import type { Basis } from "../trust/index.ts";
import { basis } from "../trust/index.ts";
import type { Commit } from "./records.ts";

/** The basis of every record of `commit`, by record `id`; frozen. */
export function bases(commit: Commit): Readonly<Record<string, Basis>> {
  const session = commit.records.find((r) => r.id === commit.by)?.body ?? null;
  const named = new Set(commit.acts?.flatMap((a) => a.names) ?? []);
  return Object.freeze(
    Object.fromEntries(commit.records.map((r) => [r.id, basis(session, named.has(commit.proposal) || named.has(r.id))])),
  );
}
