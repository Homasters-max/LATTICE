// The schema subset (REQ-KR-014, REQ-KR-015, OM-T06, OM-R02, design D-5, D-6): the check that a value is a schema of
// the closed subset, the validation of a body against the schemas of an `extends` chain, and the references those
// schemas declare in a valid body. Paths are JSON Pointers into the body; the caller prefixes them.

import type { BodyRef, Ref, Refusal, SchemaCode } from "./types.ts";
import { refusal, segment } from "./types.ts";
import { byCodeUnits, isPlainObject } from "./values.ts";
import { isIdentifier, parseRef } from "./ref.ts";
import { codePoints } from "./strings.ts";

/** A node of an admitted schema. */
export type SchemaNode = Readonly<Record<string, unknown>>;
type Node = SchemaNode;
type Found = Refusal<SchemaCode>;

const NODE_TYPES = ["object", "array", "string", "integer", "number", "boolean", "null", "schema"] as const;
type NodeType = (typeof NODE_TYPES)[number];

/** Keywords allowed next to `type`, and the ones a node of that type must have. */
const KEYWORDS: Readonly<Record<NodeType, { readonly allowed: readonly string[]; readonly required: readonly string[] }>> = {
  object: { allowed: ["properties", "required"], required: ["properties"] },
  array: { allowed: ["items"], required: ["items"] },
  string: { allowed: ["maxLength", "enum", "ref", "pinned"], required: [] },
  integer: { allowed: ["enum"], required: [] },
  number: { allowed: ["enum"], required: [] },
  boolean: { allowed: [], required: [] },
  null: { allowed: [], required: [] },
  schema: { allowed: [], required: [] },
};

function isNodeType(t: unknown): t is NodeType {
  return typeof t === "string" && (NODE_TYPES as readonly string[]).includes(t);
}

function distinct(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

/** The members of a plain object of the body, in UTF-16 code unit order. */
function members(o: object): string[] {
  return Object.keys(o).sort(byCodeUnits);
}

/**
 * Check that `node` (at `path`) is a node of the subset; `root` — the root of a `schema` value, which must be an
 * `object` node. Refusals in walk order: keywords of a node in UTF-16 code unit order, at most one per keyword.
 */
function checkNode(node: unknown, path: string, root: boolean, out: Found[]): void {
  if (!isPlainObject(node)) {
    out.push(refusal("bad-keyword", path));
    return;
  }
  const n = node as Node;
  const type = n["type"];
  if (!isNodeType(type)) {
    out.push(refusal("bad-keyword", path + "/type"));
    return;
  }
  const spec = KEYWORDS[type];
  const names = new Set([...Object.keys(n), ...spec.required]);
  for (const k of [...names].sort(byCodeUnits)) {
    const at = path + segment(k);
    const present = Object.hasOwn(n, k);
    const v = n[k];
    if (k === "type") {
      if (root && type !== "object") out.push(refusal("bad-keyword", at));
      continue;
    }
    if (!spec.allowed.includes(k)) {
      out.push(refusal("unknown-keyword", at));
      continue;
    }
    if (!present) {
      out.push(refusal("bad-keyword", at));
      continue;
    }
    switch (k) {
      case "properties":
        if (!isPlainObject(v)) {
          out.push(refusal("bad-keyword", at));
          break;
        }
        for (const name of members(v)) checkNode((v as Node)[name], at + segment(name), false, out);
        break;
      case "required": {
        const props = n["properties"];
        const declared = (name: unknown): boolean =>
          typeof name === "string" && isPlainObject(props) && Object.hasOwn(props, name);
        if (!Array.isArray(v) || !distinct(v) || !v.every(declared)) out.push(refusal("bad-keyword", at));
        break;
      }
      case "items":
        checkNode(v, at, false, out);
        break;
      case "maxLength":
        if (!(typeof v === "number" && Number.isSafeInteger(v) && v >= 0) || Object.hasOwn(n, "ref")) {
          out.push(refusal("bad-keyword", at));
        }
        break;
      case "enum": {
        const fits = (x: unknown): boolean =>
          type === "string" ? typeof x === "string" : type === "integer" ? Number.isSafeInteger(x) : typeof x === "number";
        if (!Array.isArray(v) || v.length === 0 || !distinct(v) || !v.every(fits) || Object.hasOwn(n, "ref")) {
          out.push(refusal("bad-keyword", at));
        }
        break;
      }
      case "ref":
        if (!isIdentifier(v)) out.push(refusal("bad-keyword", at));
        break;
      case "pinned":
        if (typeof v !== "boolean" || !Object.hasOwn(n, "ref")) out.push(refusal("bad-keyword", at));
        break;
    }
  }
}

/** Refusals of a value that should be a schema of the subset (its root an `object` node). */
function checkSchema(value: unknown, path: string): Found[] {
  const out: Found[] = [];
  checkNode(value, path, true, out);
  return out;
}

function fitsType(type: NodeType, v: unknown): boolean {
  switch (type) {
    case "object":
    case "schema":
      return isPlainObject(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "number":
      return typeof v === "number";
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
  }
}

/**
 * The members of a body object together with the names it must have, in UTF-16 code unit order: `missing` for an absent
 * required name, `unknown-field` for an undeclared member, otherwise the refusals `check` gives for the member.
 */
function eachMember(
  o: Node,
  required: ReadonlySet<string>,
  path: string,
  declared: (name: string) => boolean,
  check: (name: string, at: string) => Found[],
): Found[] {
  const errors: Found[] = [];
  for (const name of [...new Set([...Object.keys(o), ...required])].sort(byCodeUnits)) {
    const at = path + segment(name);
    if (!Object.hasOwn(o, name)) errors.push(refusal("missing", at));
    else if (!declared(name)) errors.push(refusal("unknown-field", at));
    else errors.push(...check(name, at));
  }
  return errors;
}

/**
 * Refusals of `v` (at `path`) against a node of an admitted schema — a node the subset check accepted. Within a node
 * the first check that refuses wins, in the order `wrong-type`, `too-long`, `not-in-enum`, `bad-ref`.
 */
function validateNode(node: Node, v: unknown, path: string): Found[] {
  const type = node["type"] as NodeType;
  if (!fitsType(type, v)) return [refusal("wrong-type", path)];
  const errors: Found[] = [];
  switch (type) {
    case "object": {
      const props = node["properties"] as Node;
      const o = v as Node;
      const required = new Set((node["required"] ?? []) as readonly string[]);
      errors.push(
        ...eachMember(o, required, path, (name) => Object.hasOwn(props, name), (name, at) => validateNode(props[name] as Node, o[name], at)),
      );
      break;
    }
    case "array": {
      const items = node["items"] as Node;
      (v as readonly unknown[]).forEach((x, i) => errors.push(...validateNode(items, x, path + "/" + String(i))));
      break;
    }
    case "string": {
      const s = v as string;
      const max = node["maxLength"];
      const choices = node["enum"] as readonly unknown[] | undefined;
      if (typeof max === "number" && codePoints(s) > max) errors.push(refusal("too-long", path));
      else if (choices !== undefined && !choices.includes(s)) errors.push(refusal("not-in-enum", path));
      else if (typeof node["ref"] === "string" && pinnedRef(node, s) === null) errors.push(refusal("bad-ref", path));
      break;
    }
    case "integer":
    case "number": {
      const choices = node["enum"] as readonly unknown[] | undefined;
      if (choices !== undefined && !choices.includes(v)) errors.push(refusal("not-in-enum", path));
      break;
    }
    case "schema":
      errors.push(...checkSchema(v, path));
      break;
    case "boolean":
    case "null":
      break;
  }
  return errors;
}

/** The reference a string of a `ref` node holds, when it fits the node's `pinned` rule. */
function pinnedRef(node: Node, s: string): Ref | null {
  const parsed = parseRef(s);
  if (!parsed.ok) return null;
  const pinned = node["pinned"];
  if (pinned === true && parsed.value.version === undefined) return null;
  if (pinned === false && parsed.value.version !== undefined) return null;
  return parsed.value;
}

/**
 * Refusals of a body against the root schemas of a chain, child first (REQ-KR-014): the root is closed over the union
 * of the root properties; a name required by any schema is required; a member gets the refusals of the first schema
 * that refuses it — one refusal per place across the chain.
 */
export function validate(body: unknown, roots: readonly Node[]): Found[] {
  if (!isPlainObject(body)) return [refusal("wrong-type", "")];
  const o = body as Node;
  const required = new Set<string>();
  for (const s of roots) for (const name of (s["required"] ?? []) as readonly string[]) required.add(name);
  const nodesOf = (name: string): Node[] =>
    roots.filter((s) => Object.hasOwn(s["properties"] as Node, name)).map((s) => (s["properties"] as Node)[name] as Node);
  // A member gets the refusals of the first node of the chain that refuses it.
  const firstRefusal = (name: string, at: string): Found[] =>
    nodesOf(name)
      .map((node) => validateNode(node, o[name], at))
      .find((r) => r.length > 0) ?? [];
  return eachMember(o, required, "", (name) => nodesOf(name).length > 0, firstRefusal);
}

/**
 * The references of a valid body (REQ-KR-015): in walk order — members by UTF-16 code units, elements by index —
 * every string at a place where a schema of the chain declares a `ref` node, with the target of the first such node.
 */
export function declaredRefs(body: unknown, roots: readonly Node[]): BodyRef[] {
  const out: BodyRef[] = [];
  const walk = (v: unknown, nodes: readonly Node[], path: string): void => {
    if (nodes.length === 0) return;
    if (typeof v === "string") {
      const node = nodes.find((n) => typeof n["ref"] === "string");
      const ref = node === undefined ? null : pinnedRef(node, v);
      if (node !== undefined && ref !== null) out.push({ path, ref, target: node["ref"] as string });
      return;
    }
    if (Array.isArray(v)) {
      const items = nodes.filter((n) => n["type"] === "array").map((n) => n["items"] as Node);
      v.forEach((x, i) => walk(x, items, path + "/" + String(i)));
      return;
    }
    if (isPlainObject(v)) {
      const objects = nodes.filter((n) => n["type"] === "object").map((n) => n["properties"] as Node);
      const o = v as Node;
      for (const name of Object.keys(o).sort(byCodeUnits)) {
        const next = objects.filter((p) => Object.hasOwn(p, name)).map((p) => p[name] as Node);
        walk(o[name], next, path + segment(name));
      }
    }
  };
  walk(body, roots.map((s) => ({ type: "object", properties: s["properties"] }) as Node), "");
  return out;
}
