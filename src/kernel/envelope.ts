// The envelope (REQ-KR-017, OM-E01…E04, OM-K01, design D-7): entity and event records built from a header and an
// admitted body, deeply frozen; `at` formatted only here, from integer UTC milliseconds.

import type { EntityRecord, EnvelopeCode, EventRecord, FormatAtCode, Id, Refusal, Result } from "./types.ts";
import { byCodeUnits, fail, isPlainObject, ok, ownData, refusal, segment } from "./types.ts";
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

type Field = "id" | "rev" | "by" | "at";
const CODE: Readonly<Record<Field, EnvelopeCode>> = { id: "bad-id", rev: "bad-rev", by: "bad-by", at: "bad-at" };
const VALID: Readonly<Record<Field, (v: unknown) => boolean>> = { id: isIdentifier, rev: isVersion, by: isIdentifier, at: isAt };

/** The refusals of a header with exactly these fields, and its values when it has none. */
function readHeader(header: unknown, fields: readonly Field[]): { errors: Refusal<EnvelopeCode>[]; values: Record<string, unknown> } {
  const errors: Refusal<EnvelopeCode>[] = [];
  const values: Record<string, unknown> = {};
  if (!isPlainObject(header)) return { errors: [refusal("bad-header", "/header")], values };
  const own = Reflect.ownKeys(header);
  const extra = own.filter((k): k is string => typeof k === "string" && !(fields as readonly string[]).includes(k));
  for (const k of extra.sort(byCodeUnits)) errors.push(refusal("bad-header", "/header" + segment(k)));
  if (own.some((k) => typeof k === "symbol")) errors.push(refusal("bad-header", "/header"));
  for (const f of fields) {
    const d = ownData(header, f);
    if (!d.present || !VALID[f](d.value)) errors.push(refusal(CODE[f], "/header/" + f));
    else values[f] = d.value;
  }
  return { errors, values };
}

export function entity(header: unknown, admitted: unknown): Result<EntityRecord, EnvelopeCode> {
  const { errors, values } = readHeader(header, ["id", "rev", "by", "at"]);
  if (!isAdmitted(admitted)) errors.push(refusal("bad-admitted", "/admitted"));
  if (errors.length > 0 || !isAdmitted(admitted)) return fail(errors);
  return ok(
    Object.freeze({
      id: values["id"] as Id,
      rev: values["rev"] as number,
      type: admitted.type,
      hash: admitted.hash,
      by: values["by"] as Id,
      at: iso(values["at"] as number),
      body: admitted.body,
    }),
  );
}

/** Refusals of the `of` of an event body (OM-E04): an object whose values are references; it may be empty (UNK-KR-009). */
function ofRefusals(body: unknown): Refusal<EnvelopeCode>[] {
  const of = isPlainObject(body) ? ownData(body, "of") : { present: false, value: undefined };
  if (!of.present || !isPlainObject(of.value)) return [refusal("bad-of", "/admitted/body/of")];
  const roles = Object.keys(of.value).sort(byCodeUnits);
  const o = of.value as Readonly<Record<string, unknown>>;
  return roles.filter((role) => !parseRef(o[role]).ok).map((role) => refusal("bad-of", "/admitted/body/of" + segment(role)));
}

export function event(header: unknown, admitted: unknown): Result<EventRecord, EnvelopeCode> {
  const { errors, values } = readHeader(header, ["id", "by", "at"]);
  if (!isAdmitted(admitted)) errors.push(refusal("bad-admitted", "/admitted"));
  else errors.push(...ofRefusals(admitted.body));
  if (errors.length > 0 || !isAdmitted(admitted)) return fail(errors);
  return ok(
    Object.freeze({
      id: values["id"] as Id,
      type: admitted.type,
      by: values["by"] as Id,
      at: iso(values["at"] as number),
      body: admitted.body,
    }),
  );
}
