// The envelope (REQ-KR-017, OM-E01…E04, OM-K01, design D-7): entity and event records built from a header and an
// admitted body, deeply frozen; `at` formatted only here, from integer UTC milliseconds.

import type { Admitted, EntityRecord, EnvelopeCode, EventRecord, FormatAtCode, Id, Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";
import { byCodeUnits, isPlainObject, ownData } from "./values.ts";
import { isIdentifier, isVersion, parseRef } from "./ref.ts";
import { isAdmitted } from "./admission.ts";

const AT_MAX = 253402300799999; // 9999-12-31T23:59:59.999Z

function isAt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= AT_MAX;
}

/** `YYYY-MM-DDTHH:mm:ss.sssZ` of integer UTC milliseconds — the one formatter of `at` (OM-E03). */
function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function formatAt(ms: unknown): Result<string, FormatAtCode> {
  if (!isAt(ms)) return fail([refusal<FormatAtCode>("bad-at", "")]);
  return ok(iso(ms));
}

/** A header that passed its checks; an event header has no `rev`. */
type Header = { readonly id: Id; readonly rev: number; readonly by: Id; readonly at: number };
type Field = keyof Header;

const CHECKS: Readonly<Record<Field, { readonly code: EnvelopeCode; readonly valid: (v: unknown) => boolean }>> = {
  id: { code: "bad-id", valid: isIdentifier },
  rev: { code: "bad-rev", valid: isVersion },
  by: { code: "bad-by", valid: isIdentifier },
  at: { code: "bad-at", valid: isAt },
};

/** The refusals of a header with exactly these fields, in the order of REQ-KR-017, and the header when it has none. */
function readHeader(header: unknown, fields: readonly Field[]): { errors: Refusal<EnvelopeCode>[]; header: Header | null } {
  if (!isPlainObject(header)) return { errors: [refusal("bad-header", "/header")], header: null };
  const errors: Refusal<EnvelopeCode>[] = [];
  const own = Reflect.ownKeys(header);
  const extra = own.filter((k): k is string => typeof k === "string" && !(fields as readonly string[]).includes(k));
  for (const k of extra.sort(byCodeUnits)) errors.push(refusal("bad-header", "/header" + segment(k)));
  if (own.some((k) => typeof k === "symbol")) errors.push(refusal("bad-header", "/header"));
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    const d = ownData(header, f);
    if (!d.present || !CHECKS[f].valid(d.value)) errors.push(refusal(CHECKS[f].code, "/header/" + f));
    else values[f] = d.value;
  }
  return { errors, header: errors.length === 0 ? (values as Header) : null };
}

/** Refusals of the `of` of an event body (OM-E04): an object whose values are references; it may be empty (UNK-KR-009). */
function ofRefusals(a: Admitted): Refusal<EnvelopeCode>[] {
  const of = isPlainObject(a.body) ? ownData(a.body, "of") : { present: false, value: undefined };
  if (!of.present || !isPlainObject(of.value)) return [refusal("bad-of", "/admitted/body/of")];
  const o = of.value as Readonly<Record<string, unknown>>;
  return Object.keys(o)
    .sort(byCodeUnits)
    .filter((role) => !parseRef(o[role]).ok)
    .map((role) => refusal("bad-of", "/admitted/body/of" + segment(role)));
}

type Parts =
  | { readonly ok: true; readonly header: Header; readonly admitted: Admitted }
  | { readonly ok: false; readonly errors: Refusal<EnvelopeCode>[] };

/** The checked header and admitted body of a record, or every refusal of both, in the order of REQ-KR-017. */
function parts(header: unknown, admitted: unknown, fields: readonly Field[], bodyRefusals: (a: Admitted) => Refusal<EnvelopeCode>[]): Parts {
  const read = readHeader(header, fields);
  if (!isAdmitted(admitted)) return { ok: false, errors: [...read.errors, refusal("bad-admitted", "/admitted")] };
  const errors = [...read.errors, ...bodyRefusals(admitted)];
  if (read.header === null || errors.length > 0) return { ok: false, errors };
  return { ok: true, header: read.header, admitted };
}

export function entity(header: unknown, admitted: unknown): Result<EntityRecord, EnvelopeCode> {
  const p = parts(header, admitted, ["id", "rev", "by", "at"], () => []);
  if (!p.ok) return fail(p.errors);
  const { id, rev, by, at } = p.header;
  const { type, hash, body } = p.admitted;
  return ok(Object.freeze({ id, rev, type, hash, by, at: iso(at), body }));
}

export function event(header: unknown, admitted: unknown): Result<EventRecord, EnvelopeCode> {
  const p = parts(header, admitted, ["id", "by", "at"], ofRefusals);
  if (!p.ok) return fail(p.errors);
  const { id, by, at } = p.header;
  const { type, body } = p.admitted;
  return ok(Object.freeze({ id, type, by, at: iso(at), body }));
}
