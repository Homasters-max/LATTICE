// Proposals (LG-P01, REQ-CL-004 Proposal, design D-4): intents, the form check that rejects by `LG-P01`, the canonical
// order of intents (LG-C07), the proposal hash (LG-C02) and the bytes of a proposal file (REQ-CL-003).

import { canonical, checkInput, hash, parseRef } from "../kernel/index.ts";
import type { Rejection } from "./rules.ts";
import { reject, sortRejections } from "./rules.ts";

export type EntityIntent = {
  readonly kind: "entity";
  readonly id: string;
  readonly type: string;
  readonly base: number;
  readonly by: string;
  readonly body: unknown;
};

export type EventIntent = {
  readonly kind: "event";
  readonly id: string;
  readonly type: string;
  readonly by: string;
  readonly at: string;
  readonly body: unknown;
};

export type Intent = EntityIntent | EventIntent;

/** A proposal whose form passed LG-P01; `intents` in the order of the file. */
export type Proposal = { readonly intents: readonly Intent[] };

export const SESSION_TYPE = "core/session@1";

const ENTITY_KEYS = ["kind", "id", "type", "base", "by", "body"] as const;
const EVENT_KEYS = ["kind", "id", "type", "by", "at", "body"] as const;
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** An identifier `namespace/local` (REQ-KR-005), not a value id and without a version. */
export function isName(value: unknown): value is string {
  if (typeof value !== "string" || value.startsWith("#")) return false;
  const r = parseRef(value);
  return r.ok && r.value.version === undefined;
}

/** A pinned type reference `namespace/local@n` (OM-E02). */
export function isPinnedType(value: unknown): value is string {
  if (typeof value !== "string" || value.startsWith("#")) return false;
  const r = parseRef(value);
  return r.ok && r.value.version !== undefined;
}

/** One JSON Pointer segment (RFC 6901). */
export function pointer(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldOk(key: string, value: unknown): boolean {
  switch (key) {
    case "id":
    case "by":
      return isName(value);
    case "type":
      return isPinnedType(value);
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
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
  if (extra !== undefined) return reject("LG-P01", id, at + pointer(extra), `the ${kind} intent has an extra key`);
  return null;
}

export type Parsed = { readonly ok: true; readonly proposal: Proposal } | { readonly ok: false; readonly rejections: readonly Rejection[] };

/** The text of a proposal file against the form of REQ-CL-004: a proposal, or its LG-P01 rejections. */
export function parseProposal(text: string): Parsed {
  const fail = (rejections: readonly Rejection[]): Parsed => ({ ok: false, rejections: sortRejections(rejections) });
  const admitted = checkInput(text);
  if (!admitted.ok) {
    const first = admitted.errors[0];
    return fail([reject("LG-P01", null, "", `the proposal is not admitted: ${first?.code ?? "?"} at '${first?.path ?? ""}'`)]);
  }
  const value = admitted.value;
  if (!isPlainObject(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "intents")) {
    return fail([reject("LG-P01", null, "", "the proposal is not an object with exactly the key intents")]);
  }
  const list = value.intents;
  if (!Array.isArray(list)) return fail([reject("LG-P01", null, "/intents", "intents is not a list")]);
  const found: Rejection[] = [];
  list.forEach((intent: unknown, i) => {
    const r = intentRejection(intent, i);
    if (r !== null) found.push(r);
  });
  if (found.length > 0) return fail(found);
  const intents = list as readonly Intent[];
  const sessions = intents.filter((x) => x.kind === "event" && x.type === SESSION_TYPE);
  if (sessions.length !== 1) {
    return fail([reject("LG-P01", null, "/intents", "the proposal holds not exactly one session event", 1, sessions.length)]);
  }
  const session = (sessions[0] as EventIntent).id;
  intents.forEach((x, i) => {
    if (x.by !== session) {
      found.push(reject("LG-P01", x.id, `/intents/${i}/by`, "the by of the intent is not the session", session, x.by));
    }
  });
  if (found.length > 0) return fail(found);
  return { ok: true, proposal: { intents } };
}

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Canonical order (LG-C07): entity intents by `id`, then event intents by `id`, by UTF-16 code units. */
export function canonicalOrder<T extends { readonly id: string }>(items: readonly T[], isEntity: (x: T) => boolean): T[] {
  const entities = items.filter(isEntity).sort((a, b) => byCodeUnits(a.id, b.id));
  const events = items.filter((x) => !isEntity(x)).sort((a, b) => byCodeUnits(a.id, b.id));
  return [...entities, ...events];
}

export function orderedIntents(intents: readonly Intent[]): Intent[] {
  return canonicalOrder(intents, (x) => x.kind === "entity");
}

/** A kernel result that cannot fail on admitted JSON; a failure is a defect of the caller. */
function sure<T>(r: { readonly ok: true; readonly value: T } | { readonly ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what}: not JSON`);
  return r.value;
}

/** The proposal hash (LG-C02): the kernel hash of type `core/proposal` over the intents in canonical order. */
export function proposalHash(proposal: Proposal): string {
  return sure(hash("core/proposal", orderedIntents(proposal.intents)), "proposal hash");
}

/** The bytes of a proposal file: the canonical JSON of `{"intents": […]}` in canonical order and a line feed. */
export function proposalText(proposal: Proposal): string {
  return sure(canonical({ intents: orderedIntents(proposal.intents) }), "proposal text") + "\n";
}
