// Admission (REQ-KR-013, REQ-KR-014, design D-3, D-4): text and type → frozen body, `type@n`, hash over `type@n`
// (OM-H01) and the references its schema declares. A `Type` and an `Admitted` are kernel-made values, recognised by
// identity in the registries below, so a body that never passed admission cannot reach a record (REQ-KR-008).

import { createHash } from "node:crypto";
import type { Admitted, AdmitCode, Hash, Id, Refusal, Result, Type, TypeOfCode } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { deepFreeze, isPlainObject, ownData } from "./values.ts";
import { checkInput } from "./input.ts";
import { canonical } from "./canonical.ts";
import { utf8Length } from "./strings.ts";
import { isIdentifier, isVersion } from "./ref.ts";
import type { SchemaNode } from "./schema.ts";
import { declaredRefs, validate } from "./schema.ts";
import { META_BODY, META_REF } from "./meta.ts";

/** The size limit of a body: bytes of the UTF-8 encoding of its canonical form (OM-H04). */
const MAX_BODY_BYTES = 1048576;
/** At most five records in a chain: the depth of `extends` is at most 4 (OM-T07). */
const MAX_CHAIN = 5;

/** Kernel-made types → the root schemas of their chain, child first. */
const TYPE_CHAINS = new WeakMap<object, readonly SchemaNode[]>();
/** Kernel-made admitted bodies. */
const ADMITTED = new WeakMap<object, true>();

function makeType(ref: string, body: SchemaNode, roots: readonly SchemaNode[]): Type {
  const type: Type = deepFreeze({ ref, body });
  TYPE_CHAINS.set(type, roots);
  return type;
}

/** The meta-type `core/type@1`, typed by itself (REQ-KR-016). */
export const metaType: Type = makeType(META_REF, META_BODY, [META_BODY.schema]);

/** True for an `Admitted` this kernel made (REQ-KR-017 takes only these). */
export function isAdmitted(value: unknown): value is Admitted {
  return typeof value === "object" && value !== null && ADMITTED.has(value);
}

/** Canonical text of a value `checkInput` returned: such a value is always JSON, so `canonical` never refuses it. */
function textOf(parsed: unknown): string {
  const form = canonical(parsed);
  return form.ok ? form.value : "";
}

function prefixed(errors: readonly Refusal<AdmitCode>[]): Refusal<AdmitCode>[] {
  return errors.map((e) => refusal(e.code, "/text" + e.path));
}

export function admit(text: unknown, type: unknown): Result<Admitted, AdmitCode> {
  const roots = typeof type === "object" && type !== null ? TYPE_CHAINS.get(type) : undefined;
  if (roots === undefined) return fail([refusal<AdmitCode>("bad-type", "/type")]);
  const parsed = checkInput(text);
  if (!parsed.ok) return fail(prefixed(parsed.errors));
  const body = parsed.value;
  if (utf8Length(textOf(body)) > MAX_BODY_BYTES) return fail([refusal<AdmitCode>("too-large", "/text")]);
  const errors = validate(body, roots);
  if (errors.length > 0) return fail(prefixed(errors));
  const ref = (type as Type).ref;
  const digest = createHash("sha256").update(textOf({ type: ref, body }), "utf8").digest("hex");
  const admitted: Admitted = deepFreeze({ body, type: ref, hash: ("sha256:" + digest) as Hash, refs: declaredRefs(body, roots) });
  ADMITTED.set(admitted, true);
  return ok(admitted);
}

/** A type record of the chain: its identity and its body admitted under the meta-type. */
type TypeRecord = { readonly id: Id; readonly rev: number; readonly body: SchemaNode };

/** `id@rev` of a type record — the pinned reference its child's `extends` names. */
const pinned = (r: TypeRecord): string => r.id + "@" + String(r.rev);

function typeRecord(element: { readonly present: boolean; readonly value: unknown }): TypeRecord | null {
  if (!element.present || !isPlainObject(element.value)) return null;
  const record = element.value;
  const id = ownData(record, "id");
  const rev = ownData(record, "rev");
  const type = ownData(record, "type");
  const body = ownData(record, "body");
  if (!id.present || !isIdentifier(id.value)) return null;
  if (!rev.present || !isVersion(rev.value)) return null;
  if (!type.present || type.value !== META_REF) return null;
  if (!body.present) return null;
  const text = canonical(body.value);
  if (!text.ok) return null;
  const admitted = admit(text.value, metaType);
  if (!admitted.ok) return null;
  return { id: id.value, rev: rev.value, body: admitted.value.body as SchemaNode };
}

/** True when the link from record `i` is wrong (REQ-KR-014); a link to an element that is not a type record is not checked. */
function badLink(records: readonly (TypeRecord | null)[], i: number, r: TypeRecord): boolean {
  const ext = ownData(r.body, "extends");
  if (i === records.length - 1) return ext.present;
  const next = records[i + 1] ?? null;
  if (next === null) return false;
  return ext.value !== pinned(next) || records.slice(0, i + 1).some((x) => x !== null && x.id === next.id);
}

export function typeOf(chain: unknown): Result<Type, TypeOfCode> {
  if (!Array.isArray(chain) || Object.getPrototypeOf(chain) !== Array.prototype || chain.length === 0) {
    return fail([refusal<TypeOfCode>("not-type", "")]);
  }
  if (chain.length > MAX_CHAIN) return fail([refusal<TypeOfCode>("chain-too-long", "")]);
  const records = Array.from({ length: chain.length }, (_, i) => typeRecord(ownData(chain, String(i))));
  const errors: Refusal<TypeOfCode>[] = [];
  records.forEach((r, i) => {
    if (r === null) errors.push(refusal("not-type", "/" + String(i)));
    else if (badLink(records, i, r)) errors.push(refusal("bad-extends", "/" + String(i) + "/body/extends"));
  });
  if (errors.length > 0) return fail(errors);
  const all = records as readonly TypeRecord[];
  const first = all[0] as TypeRecord;
  return ok(makeType(pinned(first), first.body, all.map((r) => r.body["schema"] as SchemaNode)));
}
