// The generator of the reference ledgers (REQ-PJ-005, design D-8). Never run by a test: run by hand,
// `node --experimental-strip-types test/projections/reference.ts --write`, when the kernel, the commit or record form,
// the opening checks or the meaning of a projection change; the diff of `index.json` goes into that PR.
// `skeleton` goes through apply on the fixed session and clock of the ledger tests; `typed` is built commit by commit
// without apply, so it can hold what apply would reject (unresolved types, repeated revisions, an event `id` written
// twice).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import type { Hash, Id } from "../../src/kernel/index.ts";
import { canonical } from "../../src/kernel/index.ts";
import { commitHash, KERNEL_VERSION, recordHash } from "../../src/ledger/commit.ts";
import type { Intent } from "../../src/ledger/proposal.ts";
import { proposalHash, SESSION_TYPE } from "../../src/ledger/proposal.ts";
import type { Commit, EntityRecord, EventRecord, LedgerRecord } from "../../src/ledger/records.ts";
import { byCodeUnits, isEntityRecord } from "../../src/ledger/records.ts";
import { serialize } from "../../src/ledger/projections/view.ts";
import { AT, committed, fixtureIntents, ledgerOf, revisionOf, session } from "../ledger/cases.ts";
import { FIXTURES } from "./ledgers.ts";

/** `skeleton`: the fixture `md` imported and applied on an empty ledger, then the revision of SCN-CL-009. */
function skeleton(): string[] {
  const first = committed([], fixtureIntents(1));
  return committed(first, revisionOf(2, "lattice/fx-a02", "The second synthetic rule, revised."));
}

const META = "core/type@1";
const refs = (target: string, pinned?: boolean) => ({ type: "array", items: ref(target, pinned) });
const ref = (target: string, pinned?: boolean) => (pinned === undefined ? { type: "string", ref: target } : { type: "string", ref: target, pinned });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties });

const NODE = { schema: object({ uses: refs("test/node"), pins: ref("test/node", true), supersedes: refs("test/node", true) }) };
const NOTE = {
  schema: object({ of: object({ subject: ref("test/node", true), about: ref("test/note") }), cites: ref("test/node") }),
};

type Draft = { readonly id: string; readonly rev?: number; readonly type: string; readonly body: unknown };
const entity = (id: string, rev: number, type: string, body: unknown): Draft => ({ id, rev, type, body });
const event = (id: string, type: string, body: unknown): Draft => ({ id, type, body });

/** The `typed` commits, commit `k` at `seq` `k` and `base` `k − 1`, each with its session event (design D-8). */
const TYPED: readonly (readonly Draft[])[] = [
  [
    entity("test/node", 1, META, NODE),
    entity("test/note", 1, META, NOTE),
    entity("test/twice", 1, META, { schema: object({ uses: refs("test/node") }) }),
    entity("test/n1", 1, "test/node@1", { uses: ["test/n2"] }),
    entity("test/n2", 1, "test/node@1", {}),
    entity("test/n10", 1, "test/twice@1", { uses: ["test/n2"] }),
  ],
  [
    entity("test/sub", 1, META, { extends: "test/node@1", schema: object({}) }),
    entity("test/n3", 1, "test/sub@1", { uses: ["test/n1"] }),
  ],
  [
    entity("test/n1", 2, "test/node@1", { uses: ["test/n3"] }),
    event("test/e0", "test/note@1", { of: { subject: "test/n2@1" } }),
    entity("test/n8", 1, "test/node@1", { uses: ["test/n1"] }),
    entity("test/n11", 2, "test/node@1", { uses: ["test/n2"] }),
  ],
  [
    entity("test/n1", 3, "test/node@1", { uses: ["test/n2", "test/n3"], pins: "test/n2@1" }),
    event("test/e1", "test/note@1", { of: { subject: "test/n1@2", about: "test/e0" }, cites: "test/n2" }),
    event("test/e0", "test/note@1", { of: { subject: "test/n3@1" } }),
    event("test/e2", "test/phantom@1", { of: { "a/b~c": "test/n3", subject: "test/n2@1" } }),
    entity("test/n4", 1, "test/node@1", { supersedes: ["test/n1@3"] }),
    entity("test/n5", 1, "test/ghost@1", { uses: ["test/n1"] }),
    entity("test/n6", 1, "test/node@1", { uses: ["test/n1"], extra: "not declared" }),
    entity("test/loop-a", 1, META, { extends: "test/loop-b@1", schema: object({ uses: refs("test/node") }) }),
    entity("test/loop-b", 1, META, { extends: "test/loop-a@1", schema: object({}) }),
    entity("test/n7", 1, "test/loop-a@1", { uses: ["test/n1"] }),
    entity("test/n8", 1, "test/node@1", { uses: ["test/n3"] }),
    entity("test/twice", 1, META, { schema: object({ uses: { type: "array", items: { type: "string" } } }) }),
    entity("test/n9", 1, "test/twice@1", { uses: ["test/n2"] }),
    entity("test/n11", 1, "test/node@1", { uses: ["test/n3"] }),
  ],
];

/** Canonical record order (LG-C07): entities by `id`, then events by `id`. */
const recordOrder = (a: LedgerRecord, b: LedgerRecord): number =>
  Number(!isEntityRecord(a)) - Number(!isEntityRecord(b)) || byCodeUnits(a.id, b.id);

function typed(): string[] {
  const texts: string[] = [];
  let prev: Hash | null = null;
  for (const [i, drafts] of TYPED.entries()) {
    const seq = i + 1;
    const by = session(seq);
    const all: Draft[] = [...drafts, event(by, SESSION_TYPE, { of: {}, participant: "lattice", kind: "machine", purpose: "import" })];
    const records: LedgerRecord[] = all
      .map((d): LedgerRecord =>
        d.rev === undefined
          ? ({ id: d.id as Id, type: d.type, by, at: AT, body: d.body } satisfies EventRecord)
          : ({ id: d.id as Id, rev: d.rev, type: d.type, hash: recordHash(d.type, d.body), by, at: AT, body: d.body } satisfies EntityRecord),
      )
      .sort(recordOrder);
    const intents = records.map((r): Intent =>
      isEntityRecord(r)
        ? { kind: "entity", id: r.id, type: r.type, base: r.rev - 1, by, body: r.body }
        : { kind: "event", id: r.id, type: r.type, by, at: AT, body: r.body },
    );
    const sessionIntent = intents.find((x) => x.id === by && x.kind === "event");
    if (sessionIntent === undefined || sessionIntent.kind !== "event") throw new Error("typed: no session");
    const commit: Commit = {
      seq,
      prev,
      kernel: KERNEL_VERSION,
      base: seq - 1,
      proposal: proposalHash({ intents, session: sessionIntent }),
      by,
      at: AT,
      records,
    };
    const text = canonical(commit);
    if (!text.ok) throw new Error("typed: not JSON");
    texts.push(text.value);
    prev = commitHash(commit);
  }
  return texts;
}

/** The cases of REQ-PJ-005: the commit texts of each reference ledger. */
export const CASES: Readonly<Record<string, () => string[]>> = { skeleton, typed };

function write(): void {
  for (const [name, build] of Object.entries(CASES)) {
    const texts = build();
    const dir = join(FIXTURES, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.jsonl"), texts.map((t) => t + "\n").join(""));
    writeFileSync(join(dir, "index.json"), serialize(ledgerOf(texts).view) + "\n");
  }
}

if (argv[1] !== undefined && import.meta.url === pathToFileURL(argv[1]).href && argv.includes("--write")) write();
