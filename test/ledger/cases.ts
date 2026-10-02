// Proposals and ledgers for the ledger tests (design D-7, D-9): the fixture `md` imported in process under a session
// numbered like `ids-counter`, ledgers opened from commit texts, apply run on proposal texts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Id } from "../../src/kernel/index.ts";
import { newId } from "../../src/kernel/index.ts";
import { importMd } from "../../src/codec/index.ts";
import { apply, openLedger, parseProposal, proposalText } from "../../src/ledger/index.ts";
import type { Applied, Ledger, Rejection } from "../../src/ledger/index.ts";
import { FIXTURE } from "../cli/project.ts";

export type Json = Record<string, unknown>;

export const AT = "1970-01-01T00:00:00.000Z";

/** The session `id` the counter id source gives as its n-th ULID. */
export function session(n: number): Id {
  const id = newId("lattice", String(n).padStart(26, "0"));
  if (!id.ok) throw new Error("session id");
  return id.value;
}

/** The intents of the fixture `md` imported under session `n` (SCN-CL-003), as plain JSON in canonical order. */
export function fixtureIntents(n = 1): Json[] {
  const imported = importMd(readFileSync(FIXTURE, "utf8"), "fixture.md", "lattice", { id: session(n), at: AT });
  if (!imported.ok) throw new Error(imported.message);
  return (JSON.parse(proposalText(imported.proposal)) as { intents: Json[] }).intents;
}

/** The same intents as the next revision of every entity: `base` 1, the session `n`, bodies changed by `edit`. */
export function revisedIntents(n: number, edit: (intents: Json[]) => void = () => {}): Json[] {
  const intents = fixtureIntents(n).map((x) => (x.kind === "entity" ? { ...x, base: 1 } : x));
  edit(intents);
  return intents;
}

/** Intent `id` at `base` 1 with its body changed, and the session event `n`: one entity's next revision. */
export function revisionOf(n: number, id: string, text: string): Json[] {
  return revisedIntents(n, (xs) => {
    (xs.find((x) => x.id === id) as Json).body = { Rule: text };
  }).filter((x) => x.id === id || x.kind === "event");
}

/** Only a new session event `n`. */
export function sessionOnly(n: number): Json[] {
  return fixtureIntents(n).filter((x) => x.kind === "event");
}

export const textOf = (intents: readonly unknown[]): string => JSON.stringify({ intents });

/** A ledger opened from commit texts; it must open. */
export function ledgerOf(texts: readonly string[]): Ledger {
  const opened = openLedger({
    commits: texts.map((text) => ({ seq: (JSON.parse(text) as { seq: number }).seq, text })),
    torn: null,
  });
  if (!opened.ok) throw new Error(opened.message);
  return opened.ledger;
}

/** Reads a proposal text and applies it: its LG-P01 rejections, or the answer of apply. */
export function applyText(ledger: Ledger, text: string): Applied {
  const parsed = parseProposal(text);
  if (!parsed.ok) return { outcome: "rejected", rejections: parsed.rejections };
  return apply(ledger, parsed.proposal);
}

/** The commit texts after applying `intents` on the ledger of `texts`; the answer must be a commit. */
export function committed(texts: readonly string[], intents: readonly unknown[]): string[] {
  const answer = applyText(ledgerOf(texts), textOf(intents));
  if (answer.outcome !== "commit") throw new Error(`expected a commit, got ${answer.outcome}`);
  return [...texts, answer.text];
}

/** A rejection without its message, as fixtures compare it. */
export const bare = ({ message: _, ...rest }: Rejection): Json => rest;


export const rulesDir = join(FIXTURE, "..", "..", "rules");
