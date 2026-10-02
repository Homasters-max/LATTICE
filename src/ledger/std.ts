// The `std` package (LG-G02, OM-L02, REQ-LG-007, design D-3): the text of `std/std.json`, read and checked against the
// package hash, a constant of the LATTICE version; the `std` proposal loads it in a `machine` / `init` session.

import type { Hash, Id } from "../kernel/index.ts";
import { canonical, checkInput, hash, parseRef } from "../kernel/index.ts";
import { INIT_SESSION_BODY, TYPE_TYPE } from "./genesis.ts";
import type { Proposal } from "./proposal.ts";
import { SESSION_TYPE } from "./proposal.ts";
import { byCodeUnits, frozen } from "./records.ts";

/** One entity of the package: a type of `std`, typed by the meta-type. */
export type StdEntity = { readonly id: Id; readonly type: string; readonly body: unknown };

/** The package hash of the `std` package of this LATTICE version (SCN-LG-010 pins it). */
export const STD_HASH = "1caa163883681578a53c8ab35ca07a7c9964174e04f49c5f6d1a715f7683c416" as Hash;

/** The package hash: the kernel hash of type `core/std` over `{id, type, body}` of the entities in `id` order. */
export function packageHash(entities: readonly StdEntity[]): Hash {
  const h = hash("core/std", entities.map(({ id, type, body }) => ({ id, type, body })));
  if (!h.ok) throw new Error("package hash: not JSON");
  return h.value;
}

export type ReadStd = { readonly ok: true; readonly entities: readonly StdEntity[] } | { readonly ok: false; readonly message: string };

const refused = (why: string): ReadStd => ({ ok: false, message: `LG-G02: the std package ${why}` });

function entityForm(e: unknown): e is StdEntity {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return false;
  if (Object.keys(e).sort().join(",") !== "body,id,type") return false;
  const x = e as Record<string, unknown>;
  if (typeof x.id !== "string" || x.id.startsWith("#")) return false;
  const r = parseRef(x.id);
  return r.ok && r.value.version === undefined && x.type === TYPE_TYPE;
}

/** The entities of a package text, or the refusal naming `LG-G02`. */
export function readStd(text: string): ReadStd {
  const parsed = checkInput(text);
  if (!parsed.ok) return refused("is not JSON the kernel admits");
  const value = parsed.value;
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).join(",") !== "entities") {
    return refused("is not an object with exactly the key entities");
  }
  const entities = (value as { entities: unknown }).entities;
  if (!Array.isArray(entities) || !entities.every(entityForm)) return refused("holds an entity outside the form {id, type, body}");
  if (!entities.every((e, i) => i === 0 || byCodeUnits((entities[i - 1] as StdEntity).id, e.id) < 0)) {
    return refused("is not ordered by id");
  }
  const again = canonical(value);
  if (!again.ok || again.value + "\n" !== text) return refused("is not in canonical form followed by one line feed");
  if (packageHash(entities) !== STD_HASH) return refused("does not have the package hash of this LATTICE version");
  return { ok: true, entities: frozen(entities) };
}

/** The `std` proposal for a session: one entity intent per entity at `base` 0, and the session event. */
export function stdProposal(entities: readonly StdEntity[], session: { readonly id: Id; readonly at: string }): Proposal {
  const event = { kind: "event", id: session.id, type: SESSION_TYPE, by: session.id, at: session.at, body: INIT_SESSION_BODY } as const;
  return frozen({
    intents: [...entities.map((e) => ({ kind: "entity", id: e.id, type: e.type, base: 0, by: session.id, body: e.body }) as const), event],
    session: event,
  });
}
