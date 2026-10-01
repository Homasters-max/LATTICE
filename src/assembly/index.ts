// Module `assembly` (design-next ST-M01, PL-A03, design D-7): the composition root. It reads and writes the files of
// the project store (LG-S05) — the init configuration, proposal files and, through the `store` port, the ledger —,
// builds the ports, and runs the pure `ledger` and `codec` on them. Every operation returns a typed outcome; it never
// prints and never picks an exit code (that is `cli`).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonical, checkInput, newId } from "../kernel/index.ts";
import type { Ledger, Rejection } from "../ledger/index.ts";
import { apply as applyProposal, openLedger, parseProposal, proposalHash, proposalText } from "../ledger/index.ts";
import type { Store } from "../ledger/ports/store.ts";
import { exportMd, importMd as importTable } from "../codec/index.ts";
import type { Clock } from "../runtime/ports/clock.ts";
import type { Ids } from "../runtime/ports/ids.ts";
import { jsonlStore } from "../adapters/store-jsonl/index.ts";
import { systemClock } from "../adapters/clock-system/index.ts";
import { ulidIds } from "../adapters/ids-ulid/index.ts";

export type Ports = { readonly store?: Store; readonly clock?: Clock; readonly ids?: Ids };

export type { Rejection };

/** `done` — exit 0 with lines for standard output; `rejected` — exit 1; `refused` — exit 2 (REQ-CL-001). */
export type Outcome =
  | { readonly kind: "done"; readonly output: readonly string[] }
  | { readonly kind: "rejected"; readonly rejections: readonly Rejection[] }
  | { readonly kind: "refused-input"; readonly message: string }
  | { readonly kind: "refused"; readonly message: string };

export type Lattice = {
  init(namespace: string, owner: string): Outcome;
  importMd(file: string): Outcome;
  apply(file: string): Outcome;
  exportTo(out: string): Outcome;
};

type Config = { readonly namespace: string; readonly owner: string };

const NAMESPACE = /^[a-z][a-z0-9-]*$/;
const LOGIN = /^[A-Za-z0-9-]+$/;
const RESERVED = new Set(["core", "std"]);

const done = (...output: string[]): Outcome => ({ kind: "done", output });
const refused = (message: string): Outcome => ({ kind: "refused", message });

function configText(config: Config): string {
  const text = canonical({ namespace: config.namespace, owner: config.owner });
  if (!text.ok) throw new Error("configuration: not JSON");
  return text.value + "\n";
}

function namespaceOk(namespace: string): boolean {
  return NAMESPACE.test(namespace) && namespace.length <= 64 && !RESERVED.has(namespace);
}

export function lattice(root: string, ports: Ports = {}): Lattice {
  const storeDir = join(root, "store");
  const proposalsDir = join(storeDir, "proposals");
  const configFile = join(storeDir, "lattice.json");
  const ledgerFile = join(storeDir, "knowledge.jsonl");
  const store = (): Store => ports.store ?? jsonlStore(ledgerFile);
  const clock = ports.clock ?? systemClock();
  const ids = ports.ids ?? ulidIds();

  /** A printed path (REQ-CL-001): relative to the root when under it, otherwise absolute; `/` as separator. */
  const shown = (path: string): string => {
    const rel = relative(root, path);
    const out = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel) ? rel : resolve(path);
    return out.split(sep).join("/");
  };

  /** Runs `write`; a failure of the file system is a refusal naming the file (no atomicity before s0-store). */
  const writing = (file: string, write: () => void): string | null => {
    try {
      write();
      return null;
    } catch (e) {
      return `cannot write ${shown(file)}: ${(e as Error).message}`;
    }
  };

  const readConfig = (): Config | string => {
    if (!existsSync(storeDir)) return "no store: run lattice init first";
    let text: string;
    try {
      text = readFileSync(configFile, "utf8");
    } catch {
      return `cannot read ${shown(configFile)}`;
    }
    const value = checkInput(text);
    if (value.ok && typeof value.value === "object" && value.value !== null) {
      const v = value.value as Record<string, unknown>;
      if (typeof v.namespace === "string" && typeof v.owner === "string") {
        const config = { namespace: v.namespace, owner: v.owner };
        if (namespaceOk(config.namespace) && LOGIN.test(config.owner) && configText(config) === text) return config;
      }
    }
    return `${shown(configFile)} is not the init configuration`;
  };

  const open = (): Ledger | string => {
    const opened = openLedger(store().read());
    return opened.ok ? opened.ledger : opened.message;
  };

  return {
    init(namespace, owner) {
      if (existsSync(storeDir)) return refused(`${shown(storeDir)} already exists`);
      if (!namespaceOk(namespace)) return refused(`the namespace ${namespace} is not [a-z][a-z0-9-]*, at most 64 characters, not core or std`);
      if (!LOGIN.test(owner)) return refused(`the owner ${owner} is not a login [A-Za-z0-9-]+`);
      const failed = writing(storeDir, () => {
        mkdirSync(proposalsDir, { recursive: true });
        writeFileSync(configFile, configText({ namespace, owner }));
        writeFileSync(ledgerFile, "");
      });
      return failed === null ? done() : refused(failed);
    },

    importMd(file) {
      const config = readConfig();
      if (typeof config === "string") return refused(config);
      const path = resolve(root, file);
      let bytes: Uint8Array;
      try {
        bytes = readFileSync(path);
      } catch {
        return refused(`cannot read ${shown(path)}`);
      }
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        return { kind: "refused-input", message: `${shown(path)}:0: the file is not valid UTF-8` };
      }
      const ulid = ids.ulid();
      const session = newId(config.namespace, ulid);
      if (!session.ok) return refused(`the ids port gave a ULID the kernel refuses: ${ulid}`);
      const at = new Date(clock.now()).toISOString(); // design I-2: moves into the kernel with s0-kernel (#55)
      const imported = importTable(text, basename(path), config.namespace, { id: session.value, at });
      if (!imported.ok) return { kind: "refused-input", message: `${shown(path)}:${imported.line}: ${imported.message}` };
      const target = join(proposalsDir, `${proposalHash(imported.proposal)}.json`);
      if (existsSync(target)) return refused(`${shown(target)} already exists`);
      const failed = writing(target, () => writeFileSync(target, proposalText(imported.proposal)));
      return failed === null ? done(shown(target)) : refused(failed);
    },

    apply(file) {
      const config = readConfig();
      if (typeof config === "string") return refused(config);
      const path = resolve(root, file);
      if (dirname(path) !== resolve(proposalsDir)) return refused(`${shown(path)} is not a file in store/proposals/`);
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        return refused(`cannot read ${shown(path)}`);
      }
      const s = store();
      const opened = openLedger(s.read());
      if (!opened.ok) return refused(opened.message);
      const parsed = parseProposal(text);
      if (!parsed.ok) return { kind: "rejected", rejections: parsed.rejections };
      const applied = applyProposal(opened.ledger, parsed.proposal);
      if (applied.outcome === "rejected") return { kind: "rejected", rejections: applied.rejections };
      const after = opened.ledger.tail?.seq ?? 0;
      let appended: ReturnType<Store["append"]> | undefined;
      const failed = writing(ledgerFile, () => {
        appended = s.append({ seq: applied.commit.seq, text: applied.text }, after);
      });
      if (failed !== null) return refused(failed);
      if (appended?.ok !== true) return refused("LG-C03: the tail of the ledger moved; nothing was appended");
      const removed = writing(path, () => unlinkSync(path));
      if (removed !== null) return refused(`the commit seq ${applied.commit.seq} stays; ${removed} — the proposal file is left behind`);
      return done(JSON.stringify({ outcome: "commit", seq: applied.commit.seq }));
    },

    exportTo(out) {
      const config = readConfig();
      if (typeof config === "string") return refused(config);
      const ledger = open();
      if (typeof ledger === "string") return refused(ledger);
      const exported = exportMd(ledger.view, config.namespace);
      if (!exported.ok) return refused(`export refused: ${exported.message}`);
      const dir = resolve(root, out);
      const written: string[] = [];
      for (const { file, text } of exported.files) {
        const target = join(dir, file);
        const failed = writing(target, () => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(target, text);
        });
        if (failed !== null) return refused(failed);
        written.push(shown(target));
      }
      return done(...written);
    },
  };
}
