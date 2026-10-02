// The round trip of REQ-CD-008 (design D-9): import → proposal file → apply on an empty ledger → the ledger opened with
// that commit → export. Every call of `apply` and `openLedger` of the codec tests is here, so a change of their
// signatures changes one file.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportDocuments, importDocument } from "../../src/codec/index.ts";
import type { Exported, Session } from "../../src/codec/index.ts";
import type { Id } from "../../src/kernel/index.ts";
import type { Intent, Ledger, Proposal } from "../../src/ledger/index.ts";
import { apply, openLedger, parseProposal, proposalText } from "../../src/ledger/index.ts";

export const NS = "lattice";
export const FORMS = fileURLToPath(new URL("../fixtures/md/forms/", import.meta.url));
export const FIXTURES = ["paragraphs", "prose", "tables", "fields", "examples", "references", "sections", "verbatim"] as const;

export function session(n = 1): Session {
  return { id: `${NS}/01J0000000000000000000000${n}` as Id, at: `2026-10-02T00:00:0${n}.000Z` };
}

export function fixture(name: string): string {
  return readFileSync(`${FORMS}${name}.md`, "utf8");
}

/** The proposal of a file, through the proposal file form (REQ-CL-003, REQ-LG-001). */
export function imported(text: string, file: string, s: Session = session()): Proposal {
  const r = importDocument(text, file, NS, s);
  assert.ok(r.ok, r.ok ? "" : `refused at line ${r.line}: ${r.message}`);
  const parsed = parseProposal(proposalText(r.proposal));
  assert.ok(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.rejections));
  return parsed.proposal;
}

/** The entity intents of a proposal by `id`. */
export function entities(p: Proposal): Map<string, { type: string; body: Record<string, unknown> }> {
  const out = new Map<string, { type: string; body: Record<string, unknown> }>();
  for (const x of p.intents) if (x.kind === "entity") out.set(x.id, { type: x.type, body: x.body as Record<string, unknown> });
  return out;
}

/** A ledger of the commits of the given proposals, applied in order. */
export function ledgerOf(...proposals: Proposal[]): Ledger {
  const commits: { seq: number; text: string }[] = [];
  for (const p of proposals) {
    const opened = openLedger({ commits, torn: null });
    assert.ok(opened.ok, opened.ok ? "" : opened.message);
    const applied = apply(opened.ledger, p);
    assert.equal(applied.outcome, "commit", JSON.stringify(applied));
    if (applied.outcome !== "commit") throw new Error("unreachable");
    commits.push({ seq: applied.commit.seq, text: applied.text });
  }
  const opened = openLedger({ commits, torn: null });
  assert.ok(opened.ok, opened.ok ? "" : opened.message);
  return opened.ledger;
}

/** The round trip of one file: its export after import and apply. */
export function roundTrip(text: string, file: string): Exported {
  return exportDocuments(ledgerOf(imported(text, file)).view, NS);
}

/** A second proposal of the given entity intents at `base` 1 under a new session. */
export function revision(entitiesAtBase: readonly { id: string; type: string; body: unknown; base?: number }[]): Proposal {
  const s = session(2);
  const event: Intent = {
    kind: "event",
    id: s.id,
    type: "core/session@1",
    by: s.id,
    at: s.at,
    body: { of: {}, participant: "lattice", kind: "machine", purpose: "import" },
  };
  const intents: Intent[] = entitiesAtBase.map((e) => ({
    kind: "entity",
    id: e.id as Id,
    type: e.type,
    base: e.base ?? 1,
    by: s.id,
    body: e.body,
  }));
  intents.push(event);
  const parsed = parseProposal(proposalText({ intents, session: event as Proposal["session"] }));
  assert.ok(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.rejections));
  return parsed.proposal;
}
