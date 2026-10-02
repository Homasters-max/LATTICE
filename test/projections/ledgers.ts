// The reference ledgers as the projection tests read them (REQ-PJ-005, design D-10): a fixture folder opened through
// `openLedger` without a store adapter, its commits, and the edges SCN-PJ-002…004 and SCN-PJ-011 expect — asserted
// once against the view and once against the parsed `index.json` (SCN-PJ-009).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ledger } from "../../src/ledger/index.ts";
import { openLedger } from "../../src/ledger/index.ts";
import type { Commit } from "../../src/ledger/records.ts";
import type { Edge } from "../../src/ledger/projections/projection.ts";
import { FIXTURES } from "./reference.ts";

export { FIXTURES };

export type Case = { readonly texts: readonly string[]; readonly ledger: Ledger; readonly index: string };

/** A fixture folder: its ledger must open and both files must exist; a failure names the folder. */
export function readCase(dir: string): Case {
  const ledgerFile = join(dir, "ledger.jsonl");
  const indexFile = join(dir, "index.json");
  for (const file of [ledgerFile, indexFile]) if (!existsSync(file)) throw new Error(`${dir}: no ${file.slice(dir.length + 1)}`);
  const texts = readFileSync(ledgerFile, "utf8").split("\n").slice(0, -1);
  const opened = openLedger({ commits: texts.map((text) => ({ seq: (JSON.parse(text) as { seq: number }).seq, text })), torn: null });
  if (!opened.ok) throw new Error(`${dir}: ${opened.message}`);
  return { texts, ledger: opened.ledger, index: readFileSync(indexFile, "utf8") };
}

export const typedCase = (): Case => readCase(join(FIXTURES, "typed"));
export const skeletonCase = (): Case => readCase(join(FIXTURES, "skeleton"));

/** The commits of a case, as `openLedger` would read them. */
export const commitsOf = (c: Case): Commit[] => c.texts.map((text) => JSON.parse(text) as Commit);

const edge = (from: string, path: string, ref: string): Edge => ({ from, path, ref });

/** The exact referrers of these targets in `typed`, in the order of REQ-PJ-002. */
export const EXPECTED: Readonly<Record<string, readonly Edge[]>> = {
  // SCN-PJ-002, SCN-PJ-003, SCN-PJ-004: one edge from test/e1, the edges of test/n1@3 only, the successor test/n4.
  "test/n1": [
    edge("test/e1", "/body/of/subject", "test/n1@2"),
    edge("test/n3@1", "/body/uses/0", "test/n1"),
    edge("test/n4@1", "/body/supersedes/0", "test/n1@3"),
  ],
  // SCN-PJ-002, SCN-PJ-011: test/n10@1 read under the first test/twice@1, test/n9@1 under the second.
  "test/n2": [
    edge("test/e0", "/body/of/subject", "test/n2@1"),
    edge("test/e1", "/body/cites", "test/n2"),
    edge("test/n10@1", "/body/uses/0", "test/n2"),
    edge("test/n1@3", "/body/pins", "test/n2@1"),
    edge("test/n1@3", "/body/uses/0", "test/n2"),
  ],
  // SCN-PJ-003, SCN-PJ-011: test/n8 and test/n11 at their last revision only.
  "test/n3": [
    edge("test/n11@1", "/body/uses/0", "test/n3"),
    edge("test/n1@3", "/body/uses/1", "test/n3"),
    edge("test/n8@1", "/body/uses/0", "test/n3"),
  ],
  "test/e0": [edge("test/e1", "/body/of/about", "test/e0")],
  "test/node": [
    edge("test/n11@1", "/type", "test/node@1"),
    edge("test/n1@3", "/type", "test/node@1"),
    edge("test/n2@1", "/type", "test/node@1"),
    edge("test/n4@1", "/type", "test/node@1"),
    edge("test/n6@1", "/type", "test/node@1"),
    edge("test/n8@1", "/type", "test/node@1"),
    edge("test/sub@1", "/body/extends", "test/node@1"),
  ],
  "core/type": ["test/loop-a@1", "test/loop-b@1", "test/node@1", "test/note@1", "test/sub@1", "test/twice@1"].map((from) =>
    edge(from, "/type", "core/type@1"),
  ),
  "test/ghost": [edge("test/n5@1", "/type", "test/ghost@1")],
  "test/loop-a": [edge("test/loop-b@1", "/body/extends", "test/loop-a@1"), edge("test/n7@1", "/type", "test/loop-a@1")],
};
