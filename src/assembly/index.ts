// Module `assembly` (design-next ST-M01, PL-A03, design D-7): the composition root. It reads and writes the files of
// the project store (LG-S05) — the init configuration, proposal files and, through the `store` port, the ledger —,
// builds the ports, and runs the pure `ledger` and `codec` on them. Every operation returns a typed outcome; it never
// prints and never picks an exit code (that is `cli`).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, checkInput, formatAt, newId } from "../kernel/index.ts";
import type { Ledger, Rejection } from "../ledger/index.ts";
import {
  apply as applyProposal,
  checkTail,
  initProposals,
  openLedger,
  openStore,
  parseProposal,
  proposalHash,
  proposalText,
  readStd,
  unreadableProposal,
} from "../ledger/index.ts";
import type { StoredCommit, Store } from "../ledger/ports/store.ts";
import { exportMd, importMd as importTable, stemOf } from "../codec/index.ts";
import type { Clock } from "../runtime/ports/clock.ts";
import type { Ids } from "../runtime/ports/ids.ts";
import { jsonlStore } from "../adapters/store-jsonl/index.ts";
import { systemClock } from "../adapters/clock-system/index.ts";
import { ulidIds } from "../adapters/ids-ulid/index.ts";
import { initActs } from "../adapters/acts-init/index.ts";

/** The `std` package of this LATTICE installation (LG-S05, REQ-LG-007). */
const STD_FILE = fileURLToPath(new URL("../../std/std.json", import.meta.url));

/** `std` — the text of the `std` package, injected by tests in place of `std/std.json` (s0-bootstrap design D-3). */
export type Ports = { readonly store?: Store; readonly clock?: Clock; readonly ids?: Ids; readonly std?: string };

export type { Rejection };

/**
 * `done` — exit 0 with lines for standard output; `rejected` — exit 1 with the rejections of apply; `refused-input` —
 * exit 1, the codec refused the md file; `refused` — exit 2 (REQ-CL-001).
 */
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
/** The local parts of the entities store init writes; a document of that stem would collide (REQ-CL-003 step 1). */
const INIT_STEMS = new Set(["namespace", "setup"]);

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

  /** Strict UTF-8: a file whose bytes are not text is refused, never repaired with U+FFFD. */
  const decode = (bytes: Uint8Array): string | null => {
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      return null;
    }
  };

  /** Opens the store of `s` (LG-C04, then REQ-LG-010); an unreadable ledger file is a refusal too (REQ-CL-001). */
  const open = (s: Store, config: Config): Ledger | string => {
    if (ports.store === undefined && !existsSync(ledgerFile)) return `${shown(ledgerFile)} is missing`;
    try {
      const opened = openStore(s.read(), config.namespace);
      return opened.ok ? opened.ledger : opened.message;
    } catch (e) {
      return `cannot read ${shown(ledgerFile)}: ${(e as Error).message}`;
    }
  };

  return {
    init(namespace, owner) {
      if (existsSync(storeDir)) return refused(`${shown(storeDir)} already exists`);
      if (!namespaceOk(namespace)) return refused(`the namespace ${namespace} is not [a-z][a-z0-9-]*, at most 64 characters, not core or std`);
      if (!LOGIN.test(owner)) return refused(`the owner ${owner} is not a login [A-Za-z0-9-]+`);
      let stdText = ports.std;
      if (stdText === undefined) {
        try {
          stdText = readFileSync(STD_FILE, "utf8");
        } catch {
          return refused(`LG-G02: cannot read the std package ${shown(STD_FILE)}`);
        }
      }
      const std = readStd(stdText);
      if (!std.ok) return refused(std.message);
      const now = clock.now();
      const at = formatAt(now);
      if (!at.ok) return refused(`the clock gave a time the kernel refuses: ${now}`);
      const built = initProposals({
        namespace,
        owner,
        at: at.value,
        ulids: [ids.ulid(), ids.ulid(), ids.ulid(), ids.ulid()],
        std: std.entities,
      });
      if (!built.ok) return refused(built.message);

      // REQ-CL-002: the four commits are built in memory through apply before anything is written.
      const commits: StoredCommit[] = [];
      for (const [i, proposal] of built.proposals.entries()) {
        const opened = openLedger({ commits, torn: null });
        if (!opened.ok) return refused(`store init: commit ${i + 1}: ${opened.message}`);
        const acts = i === 0 ? [] : initActs(owner).actsOn(proposalHash(proposal));
        const applied = applyProposal(opened.ledger, proposal, acts);
        if (applied.outcome !== "commit") return refused(`store init: commit ${i + 1}: apply answered ${applied.outcome}`);
        commits.push({ seq: applied.commit.seq, text: applied.text });
      }

      let made = writing(storeDir, () => mkdirSync(storeDir)); // fails when another init made it since the check
      if (made !== null) return refused(existsSync(storeDir) ? `${shown(storeDir)} already exists` : made);
      made = writing(storeDir, () => {
        mkdirSync(proposalsDir);
        writeFileSync(configFile, configText({ namespace, owner }));
        writeFileSync(ledgerFile, "");
      });
      if (made !== null) return refused(made);
      const s = store();
      let after = 0;
      for (const commit of commits) {
        let appended: ReturnType<Store["append"]> | undefined;
        const failed = writing(ledgerFile, () => {
          appended = s.append(commit, after);
        });
        if (failed !== null) return refused(failed);
        if (appended?.ok !== true) {
          return refused(`${shown(ledgerFile)}: the store answered that the tail moved during init (another writer); the store may hold a partial write`);
        }
        after = commit.seq;
      }
      return done(...commits.map((c) => JSON.stringify({ outcome: "commit", seq: c.seq })));
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
      // step 1 (the file name) before step 2 (the encoding), REQ-CL-003
      const stem = stemOf(basename(path));
      if (stem === null) {
        return { kind: "refused-input", message: `${shown(path)}:0: the file name is not <stem>.md of the form` };
      }
      if (INIT_STEMS.has(stem.toLowerCase())) {
        return { kind: "refused-input", message: `${shown(path)}:0: the stem ${stem} names an entity of store init` };
      }
      const text = decode(bytes);
      if (text === null) return { kind: "refused-input", message: `${shown(path)}:0: the file is not valid UTF-8` };
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
      let bytes: Uint8Array;
      try {
        bytes = readFileSync(path);
      } catch {
        return refused(`cannot read ${shown(path)}`);
      }
      const s = store();
      const ledger = open(s, config);
      if (typeof ledger === "string") return refused(ledger);
      const text = decode(bytes);
      const parsed = text === null ? unreadableProposal() : parseProposal(text);
      if (!parsed.ok) return { kind: "rejected", rejections: parsed.rejections };
      // LG-P04: the proposal file goes once the outcome is final; a file another writer of the same proposal already
      // removed counts as removed (REQ-CL-004, design D-6).
      const settled = (answer: { outcome: "commit"; seq: number } | { outcome: "no-op" }): Outcome => {
        try {
          unlinkSync(path);
        } catch (e) {
          if (existsSync(path)) {
            const stays = answer.outcome === "commit" ? `the commit seq ${answer.seq} stays; ` : "";
            return refused(`${stays}cannot remove ${shown(path)}: ${(e as Error).message} — the proposal file is left behind`);
          }
        }
        return done(JSON.stringify(answer));
      };

      const applied = applyProposal(ledger, parsed.proposal);
      if (applied.outcome === "rejected") return { kind: "rejected", rejections: applied.rejections };
      if (applied.outcome === "existing") return settled({ outcome: "commit", seq: applied.seq }); // LG-C08
      if (applied.outcome === "no-op") return settled({ outcome: "no-op" }); // LG-C05
      let appended: ReturnType<Store["append"]> | undefined;
      const failed = writing(ledgerFile, () => {
        appended = s.append({ seq: applied.commit.seq, text: applied.text }, applied.commit.base);
      });
      if (failed !== null) return refused(failed);
      if (appended?.ok !== true) {
        // LG-C03: the tail moved since opening — read the ledger again and check the commit against it (REQ-LG-004)
        const again = open(s, config);
        if (typeof again === "string") return refused(again);
        const check = checkTail(again, applied.commit);
        if (check.outcome === "existing") return settled({ outcome: "commit", seq: check.seq });
        if (check.outcome === "rejected") return { kind: "rejected", rejections: check.rejections };
        return refused("the store answered that the tail moved, but its tail is the one the commit was built on; nothing was appended");
      }
      return settled({ outcome: "commit", seq: applied.commit.seq });
    },

    exportTo(out) {
      const config = readConfig();
      if (typeof config === "string") return refused(config);
      const ledger = open(store(), config);
      if (typeof ledger === "string") return refused(ledger);
      const exported = exportMd(ledger.view, config.namespace);
      if (!exported.ok) return refused(`export refused: ${exported.message}`);
      const dir = resolve(root, out);
      const made = writing(dir, () => mkdirSync(dir, { recursive: true }));
      if (made !== null) return refused(made);
      const written: string[] = [];
      for (const { file, text } of exported.files) {
        const target = join(dir, file);
        const failed = writing(target, () => writeFileSync(target, text));
        if (failed !== null) return refused(failed);
        written.push(shown(target));
      }
      return done(...written);
    },
  };
}
