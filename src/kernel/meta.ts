// The body of the meta-type `core/type@1` (REQ-KR-016, OM-T01, OM-T02): a type body holds its `schema` and, optionally,
// `extends`, `unique` and `card`. It is typed by itself — the field type `schema` lets it declare its own `schema` —
// and it is the only type kernel code builds; every other type is data admitted under it.

export const META_REF = "core/type@1";

export const META_BODY = {
  schema: {
    type: "object",
    properties: {
      card: { type: "array", items: { type: "string" } },
      extends: { type: "string", ref: "core/type", pinned: true },
      schema: { type: "schema" },
      unique: { type: "array", items: { type: "string" } },
    },
    required: ["schema"],
  },
};
