// Proposals (LG-P01, REQ-CL-004 Proposal, design D-4): intents, the form check that rejects by `LG-P01`, the canonical
// order of intents (LG-C07), the proposal hash (LG-C02) and the bytes of a proposal file (REQ-CL-003).

import type { Hash, Id } from "../kernel/index.ts";
import { canonical, checkInput, hash, parseRef } from "../kernel/index.ts";
import { byCodeUnits } from "./records.ts";
import type { Rejection } from "./rules.ts";
import { reject, sortRejections } from "./rules.ts";

export type EntityIntent = {
  readonly kind: "entity";
  readonly id: Id;
  readonly type: string;
  readonly base: number;
  readonly by: Id;
  readonly body: unknown;
};

export type EventIntent = {
  readonly kind: "event";
  readonly id: Id;
  readonly type: string;
  readonly by: Id;
  readonly at: string;
  readonly body: unknown;
};

export type Intent = EntityIntent | EventIntent;

/** A proposal whose form passed LG-P01: its intents in the order of the file and its one session event. */
export type Proposal = { readonly intents: readonly Intent[]; readonly session: EventIntent };

export const SESSION_TYPE = "core/session@1";

const ENTITY_KEYS = ["kind", "id", "type", "base", "by", "body"] as const;
const EVENT_KEYS = ["kind", "id", "type", "by", "at", "body"] as const;
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A reference of the kernel grammar (REQ-KR-005) that names an identifier `namespace/local`, with or without `@n`. */
function nameRef(value: unknown, pinned: boolean): boolean {
  if (typeof value !== "string" || value.startsWith("#")) return false;
  const r = parseRef(value);
  return r.ok && (r.value.version !== undefined) === pinned;
}

function pointer(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldOk(key: string, value: unknown): boolean {
  switch (key) {
    case "id":
    case "by":
      return nameRef(value, false);
    case "type":
      return nameRef(value, true); // a pinned type reference `type@n` (OM-E02)
    case "base":
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    case "at":
      return typeof value === "string" && AT.test(value);
    default:
      return true; // `body`: any JSON value
  }
}

/** The one LG-P01 rejection of intent `i`, at its first failing check (REQ-CL-004, design I-8), or null. */
function intentRejection(value: unknown, i: number): Rejection | null {
  const at = `/intents/${i}`;
  if (!isPlainObject(value)) return reject("LG-P01", null, at, "an intent is not an object");
  const id = typeof value.id === "string" ? value.id : null;
  const kind = value.kind;
  if (kind !== "entity" && kind !== "event") {
    return reject("LG-P01", id, at + "/kind", "an intent's kind is neither entity nor event");
  }
  const keys: readonly string[] = kind === "entity" ? ENTITY_KEYS : EVENT_KEYS;
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) return reject("LG-P01", id, at + pointer(key), `the ${kind} intent has no ${key}`);
    if (!fieldOk(key, value[key])) return reject("LG-P01", id, at + pointer(key), `the ${key} of the intent is malformed`);
  }
  const extra = Object.keys(value)
    .filter((key) => !keys.includes(key))
    .sort(byCodeUnits)[0];
  if (extra !== undefined) return reject("LG-P01", id, at + pointer(extra), `the ${kind} intent has an extra key`);
  return null;
}

export type Parsed =
  | { readonly ok: true; readonly proposal: Proposal }
  | { readonly ok: false; readonly rejections: readonly Rejection[] };

const failed = (rejections: readonly Rejection[]): Parsed => ({ ok: false, rejections: sortRejections(rejections) });

/** A proposal file whose bytes are not text (not UTF-8): the first row of the LG-P01 table. */
export function unreadableProposal(): Parsed {
  return failed([reject("LG-P01", null, "", "the proposal file is not valid UTF-8 text")]);
}

/** The text of a proposal file against the form of REQ-CL-004: a proposal, or its LG-P01 rejections. */
export function parseProposal(text: string): Parsed {
  const admitted = checkInput(text);
  if (!admitted.ok) {
    const first = admitted.errors[0];
    return failed([reject("LG-P01", null, "", `the proposal is not admitted: ${first?.code ?? "?"} at '${first?.path ?? ""}'`)]);
  }
  const value = admitted.value;
  if (!isPlainObject(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "intents")) {
    return failed([reject("LG-P01", null, "", "the proposal is not an object with exactly the key intents")]);
  }
  const list = value.intents;
  if (!Array.isArray(list)) return failed([reject("LG-P01", null, "/intents", "intents is not a list")]);
  const found: Rejection[] = [];
  list.forEach((intent: unknown, i) => {
    const r = intentRejection(intent, i);
    if (r !== null) found.push(r);
  });
  if (found.length > 0) return failed(found);
  const intents = list as readonly Intent[]; // every intent passed the form above
  const sessions = intents.filter((x): x is EventIntent => x.kind === "event" && x.type === SESSION_TYPE);
  const session = sessions[0];
  if (sessions.length !== 1 || session === undefined) {
    return failed([reject("LG-P01", null, "/intents", "the proposal holds not exactly one session event", 1, sessions.length)]);
  }
  intents.forEach((x, i) => {
    if (x.by !== session.id) {
      found.push(reject("LG-P01", x.id, `/intents/${i}/by`, "the by of the intent is not the session", session.id, x.by));
    }
  });
  if (found.length > 0) return failed(found);
  return { ok: true, proposal: { intents, session } };
}

/** Canonical order (LG-C07): entity intents by `id`, then event intents by `id`, by UTF-16 code units. */
export function orderedIntents(intents: readonly Intent[]): Intent[] {
  const of = (kind: Intent["kind"]): Intent[] => intents.filter((x) => x.kind === kind).sort((a, b) => byCodeUnits(a.id, b.id));
  return [...of("entity"), ...of("event")];
}

/** The proposal hash (LG-C02): the kernel hash of type `core/proposal` over the intents in canonical order. */
export function proposalHash(proposal: Proposal): Hash {
  const h = hash("core/proposal", orderedIntents(proposal.intents));
  if (!h.ok) throw new Error("proposal hash: not JSON");
  return h.value;
}

/** The bytes of a proposal file: the canonical JSON of `{"intents": […]}` in canonical order and a line feed. */
export function proposalText(proposal: Proposal): string {
  const text = canonical({ intents: orderedIntents(proposal.intents) });
  if (!text.ok) throw new Error("proposal text: not JSON");
  return text.value + "\n";
}
