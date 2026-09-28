// Result of every kernel function (REQ-KR-001, design D-4): a refusal is a value, never an exception.

export type Refusal = { readonly code: string; readonly path: string };

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly Refusal[] };

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Identifier `namespace/local` or value id `#` + 32 hex (REQ-KR-005). */
export type Id = Brand<string, "Id">;
/** 64 lowercase hex digits of sha256 (REQ-KR-004). */
export type Hash = Brand<string, "Hash">;
/** Parsed reference: the next revision (`{ id }`) or a pinned one (`{ id, version }`). */
export type Ref = { readonly id: Id; readonly version?: number };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(errors: readonly Refusal[]): Result<T> {
  return { ok: false, errors };
}

export function refusal(code: string, path: string): Refusal {
  return { code, path };
}

/** One JSON Pointer segment (RFC 6901): `~` -> `~0`, `/` -> `~1`. */
export function segment(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}
