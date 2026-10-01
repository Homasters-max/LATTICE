// Structure checks (REQ-AR-005…REQ-AR-010, design D-3) over the TypeScript AST of a file tree and a policy: the
// kernel perimeter imports nothing but itself and createHash of node:crypto and uses only the allowed free
// identifiers; everything reachable from the kernel entry stays in the perimeter; source files import each other
// without cycles; modules import each other by the matrix of ST-M01, and the pure ones keep the purity rules of the
// kernel; every node:test test is declared inside a function passed to a suite call. The checks parse source text and
// never run the checked files.

import ts from "typescript";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, resolve } from "node:path";

export type Violation = { readonly file: string; readonly line: number; readonly rule: string };

/**
 * A module of the matrix (REQ-AR-009): its name, the glob of its files, what it may import — module names, `adapters`
 * (every adapter) or `<module>:ports` (the port interface files under `src/<module>/ports/`) — and whether it may
 * import `node:` built-ins and packages. A module that may import neither is pure (REQ-AR-010).
 */
export type Module = {
  readonly name: string;
  readonly files: string;
  readonly imports: readonly string[];
  readonly builtins: boolean;
  readonly packages: boolean;
};

/** The modules and the ports (name → path of the interface file); adapters are `src/adapters/<port>-<name>/`. */
export type Modules = { readonly list: readonly Module[]; readonly ports: Readonly<Record<string, string>> };

/**
 * Globs of the sources and of the kernel perimeter and the path of the kernel entry, relative to the tree root; the
 * modules of REQ-AR-009, when given.
 */
export type Policy = {
  readonly sources: readonly string[];
  readonly entry: string;
  readonly perimeter: readonly string[];
  readonly modules?: Modules;
};

// Closed list of free identifiers of the kernel (UNK-KR-007); Math and Date only in the forms of `nondeterminism`.
const ALLOWED = new Set([
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Math", "JSON", "Reflect", "Map", "Set",
  "WeakMap", "Error", "TypeError", "RangeError", "ArrayBuffer", "DataView", "Uint8Array", "Date", "undefined", "NaN",
  "Infinity",
]);
const REFERENCE = /^\/\/\/\s*<reference\b/;
const MATH_EXACT = new Set(["floor", "ceil", "trunc", "abs", "min", "max", "sign"]);
const DATE_METHOD = /^(?:toISOString|getTime|valueOf|getUTC[A-Za-z]+)$/;
const LOCAL_TIME =
  /^(?:toLocale[A-Za-z]*|localeCompare|getTimezoneOffset|toDateString|toTimeString|getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|getMilliseconds|setFullYear|setMonth|setDate|setHours|setMinutes|setSeconds|setMilliseconds|getYear|setYear)$/;

function lineOf(sf: ts.SourceFile, node: ts.Node | number): number {
  const pos = typeof node === "number" ? node : node.getStart(sf);
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function parseDiagnostics(sf: ts.SourceFile): readonly ts.Diagnostic[] {
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
}

/**
 * A directory that is not a symbolic link: a root link is not followed, as no link of a tree is. The path is resolved
 * first — with a trailing `/` POSIX `lstat` would follow the link.
 */
function isRealDirectory(path: string): boolean {
  return lstatSync(resolve(path), { throwIfNoEntry: false })?.isDirectory() === true;
}

/**
 * Files of a directory, recursive, ordered by their relative paths; symbolic links are not followed, as in `walk`,
 * and a directory that is itself a link has no files.
 */
export function listFiles(dir: string): string[] {
  if (!isRealDirectory(dir)) return [];
  const files = new Set<string>();
  walk(dir, "", Infinity, files);
  return [...files].sort().map((file) => join(dir, file));
}

// ---- scopes -------------------------------------------------------------------------------------------------

function isDeclare(node: ts.Node): boolean {
  if (ts.isModuleDeclaration(node)) return true;
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return mods?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false;
}

function bindingNames(name: ts.BindingName, into: Set<string>): void {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
    return;
  }
  for (const el of name.elements) {
    if (ts.isBindingElement(el)) bindingNames(el.name, into);
  }
}

function isFunctionLike(node: ts.Node): node is ts.SignatureDeclaration & { body?: ts.Node } {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** `var` names of a function body or a module, not entering nested functions. */
function hoistedVars(root: ts.Node, into: Set<string>): void {
  const visit = (n: ts.Node): void => {
    if (n !== root && isFunctionLike(n)) return;
    if (ts.isVariableStatement(n) && !isDeclare(n) && !(n.declarationList.flags & ts.NodeFlags.BlockScoped)) {
      for (const d of n.declarationList.declarations) bindingNames(d.name, into);
    }
    if (ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n)) {
      const init = n.initializer;
      if (init !== undefined && ts.isVariableDeclarationList(init) && !(init.flags & ts.NodeFlags.BlockScoped)) {
        for (const d of init.declarations) bindingNames(d.name, into);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(root);
}

function statementNames(statements: readonly ts.Statement[], into: Set<string>): void {
  for (const s of statements) {
    if (isDeclare(s)) continue;
    if (ts.isVariableStatement(s) && s.declarationList.flags & ts.NodeFlags.BlockScoped) {
      for (const d of s.declarationList.declarations) bindingNames(d.name, into);
    } else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name !== undefined) {
      into.add(s.name.text);
    } else if (ts.isImportDeclaration(s) && s.importClause !== undefined) {
      const c = s.importClause;
      if (c.name !== undefined) into.add(c.name.text);
      if (c.namedBindings !== undefined) {
        if (ts.isNamespaceImport(c.namedBindings)) into.add(c.namedBindings.name.text);
        else for (const el of c.namedBindings.elements) into.add(el.name.text);
      }
    } else if (ts.isImportEqualsDeclaration(s)) {
      into.add(s.name.text);
    }
  }
}

const scopeCache = new WeakMap<ts.Node, Set<string> | null>();

/** Names declared directly in a scope node, or null when the node is not a scope. */
function scopeNames(node: ts.Node): Set<string> | null {
  const cached = scopeCache.get(node);
  if (cached !== undefined) return cached;
  let names: Set<string> | null = null;
  if (ts.isSourceFile(node)) {
    names = new Set();
    statementNames(node.statements, names);
    hoistedVars(node, names);
  } else if (ts.isBlock(node) || ts.isModuleBlock(node)) {
    names = new Set();
    statementNames(node.statements, names);
  } else if (ts.isCaseBlock(node)) {
    names = new Set();
    for (const clause of node.clauses) statementNames(clause.statements, names);
  } else if (isFunctionLike(node)) {
    names = new Set();
    for (const p of node.parameters) bindingNames(p.name, names);
    if (ts.isFunctionExpression(node) && node.name !== undefined) names.add(node.name.text);
    if (node.body !== undefined) hoistedVars(node.body, names);
  } else if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
    names = new Set();
    const init = node.initializer;
    if (init !== undefined && ts.isVariableDeclarationList(init)) {
      for (const d of init.declarations) bindingNames(d.name, names);
    }
  } else if (ts.isCatchClause(node)) {
    names = new Set();
    if (node.variableDeclaration !== undefined) bindingNames(node.variableDeclaration.name, names);
  } else if (ts.isClassExpression(node) && node.name !== undefined) {
    names = new Set([node.name.text]);
  }
  scopeCache.set(node, names);
  return names;
}

/** Bound in an enclosing scope of the file; `stopAt` excludes scopes from that node up (for shadowing checks). */
function isBound(id: ts.Identifier, stopAt?: ts.Node): boolean {
  for (let n: ts.Node | undefined = id.parent; n !== undefined && n !== stopAt; n = n.parent) {
    const names = scopeNames(n);
    if (names !== null && names.has(id.text)) return true;
  }
  return false;
}

/** An identifier in a value position (not a declared name, a property name, a key, a label or a type). */
function isValueIdentifier(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p)) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isShorthandPropertyAssignment(p)) return true;
  if (
    (ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isClassExpression(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isMethodSignature(p) ||
      ts.isEnumMember(p) ||
      ts.isTypeAliasDeclaration(p) ||
      ts.isInterfaceDeclaration(p) ||
      ts.isTypeParameterDeclaration(p) ||
      ts.isImportEqualsDeclaration(p)) &&
    p.name === id
  ) {
    return false;
  }
  if (ts.isBindingElement(p)) return p.initializer === id;
  if (
    ts.isImportSpecifier(p) ||
    ts.isImportClause(p) ||
    ts.isNamespaceImport(p) ||
    ts.isExportSpecifier(p) ||
    ts.isLabeledStatement(p) ||
    ts.isBreakOrContinueStatement(p) ||
    ts.isMetaProperty(p)
  ) {
    return false;
  }
  return true;
}

// ---- paths and globs (REQ-AR-001) ----------------------------------------------------------------------------

/**
 * Segments of a `/` path with empty and `.` segments dropped and `..` cancelling the segment before it; a `..` that
 * leaves the root stays as the first segment, so the path is outside the root. Null when `..` would cancel a segment
 * that `cancellable` refuses.
 */
function resolveSegments(path: string, cancellable: (seg: string) => boolean): string[] | null {
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    const last = out[out.length - 1];
    if (seg === ".." && last !== undefined && last !== "..") {
      if (!cancellable(last)) return null;
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out;
}

function normalize(path: string): string {
  return (resolveSegments(path, () => true) as string[]).join("/");
}

/** A glob normalised as a path; null (matches nothing) when `..` follows a wildcard segment it cannot cancel. */
function normalizeGlob(glob: string): string | null {
  return resolveSegments(glob, (seg) => !seg.includes("*"))?.join("/") ?? null;
}

function isRelative(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../");
}

/**
 * The path a relative specifier of `file` names; whether a file is there is not asked (design D-2). Inner empty
 * segments collapse (`.//a.ts`), as the file system resolves them; a specifier ending in `/`, `.` or `..` names a
 * directory, never a file — null, not an edge.
 */
function resolveSpec(file: string, spec: string): string | null {
  const last = spec.slice(spec.lastIndexOf("/") + 1);
  if (last === "" || last === "." || last === "..") return null;
  return normalize(file.slice(0, file.lastIndexOf("/") + 1) + spec);
}

/** A glob segment: `**` (any number of path segments, none included) or a pattern of one segment. */
type GlobSegment = "**" | RegExp;

/** `*` is any part of one segment, every other character is literal. */
function compileGlob(glob: string): GlobSegment[] {
  return glob.split("/").map((seg) => {
    if (seg === "**") return "**";
    const literal = seg.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`^${literal.join("[^/]*")}$`);
  });
}

/**
 * Whether the glob matches the path, in O(glob × path): `row[j]` — the glob from segment `j` matches the path from
 * segment `i`, filled for `i` from the end of the path down, `below` holding the row of `i + 1`.
 */
function matchSegments(path: readonly string[], glob: readonly GlobSegment[]): boolean {
  let below: boolean[] = [];
  for (let i = path.length; i >= 0; i--) {
    const row = new Array<boolean>(glob.length + 1).fill(false);
    row[glob.length] = i === path.length;
    for (let j = glob.length - 1; j >= 0; j--) {
      const g = glob[j] as GlobSegment;
      if (g === "**") row[j] = row[j + 1] === true || (i < path.length && below[j] === true);
      else row[j] = i < path.length && g.test(path[i] as string) && below[j + 1] === true;
    }
    below = row;
  }
  return below[0] === true;
}

/** Whether a path matches a list of globs; a path outside the root (first segment `..`) matches none. */
function globList(globs: readonly string[]): (path: string) => boolean {
  const compiled = globs.map(compileGlob);
  return (path) => {
    const segs = path === "" ? [] : path.split("/");
    return segs[0] !== ".." && compiled.some((glob) => matchSegments(segs, glob));
  };
}

// ---- the tree: files, parse facts, import edges (design D-1, D-2) --------------------------------------------

/**
 * The walk entry of a tree path: each segment is found by name, exactly and case-sensitively, in the listing of its
 * directory, so a path exists only as the walk of the root gives it; null when it does not.
 */
function treeEntry(root: string, segs: readonly string[]): Dirent | null {
  let dir = root;
  let entry: Dirent | null = null;
  for (const seg of segs) {
    if (entry !== null && !entry.isDirectory()) return null;
    entry = readdirSync(dir, { withFileTypes: true }).find((e) => e.name === seg) ?? null;
    if (entry === null) return null;
    dir = join(dir, seg);
  }
  return entry;
}

/**
 * Files of the directory `dir` at tree path `at`, `depth` levels down (1 — its own files only); a symbolic link is
 * neither a directory nor a file.
 */
function walk(dir: string, at: string, depth: number, into: Set<string>): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = at === "" ? e.name : `${at}/${e.name}`;
    if (e.isDirectory()) {
      if (depth > 1) walk(join(dir, e.name), path, depth - 1, into);
    } else if (e.isFile()) {
      into.add(path);
    }
  }
}

/**
 * Candidate tree files of normalised globs, to be filtered by them. The walk starts at the static prefix of each
 * glob — its segments before the last one and before the first one with `*` — and, for a glob without `**`, goes no
 * deeper than its segments reach (`entry.ts` — the root level only), so it never enters what no glob matches
 * (`node_modules` of the project). A prefix that is a file is itself the candidate (`lib/api.ts/**` matches
 * `lib/api.ts`: `**` is zero segments too); a prefix that is not in the tree gives none.
 */
function treeFiles(root: string, globs: readonly string[]): Set<string> {
  const files = new Set<string>();
  for (const glob of globs) {
    const segs = glob.split("/");
    const dirs = segs.slice(0, -1);
    const wild = dirs.findIndex((seg) => seg.includes("*"));
    const prefix = wild === -1 ? dirs : dirs.slice(0, wild);
    const at = prefix.join("/");
    const entry = prefix.length === 0 ? null : treeEntry(root, prefix);
    if (entry?.isFile() === true) {
      files.add(at);
    } else if (prefix.length === 0 || entry?.isDirectory() === true) {
      const depth = segs.includes("**") ? Infinity : segs.length - prefix.length;
      walk(join(root, ...prefix), at, depth, files);
    }
  }
  return files;
}

/** An import of a file: its specifier, its line (of the first token) and the path a relative specifier names. */
type Import = {
  readonly spec: string;
  readonly line: number;
  readonly hashOnly: boolean; // the named value import of createHash, nothing else
  readonly target: string | null;
};

/** A `*.ts` file parsed once: the line of its first parse diagnostic, or null and its imports in text order. */
type Parsed = { readonly sf: ts.SourceFile; readonly errorLine: number | null; readonly imports: readonly Import[] };

type Report = (file: string, line: number, rule: string) => void;

function cryptoImportOk(node: ts.ImportDeclaration): boolean {
  const c = node.importClause;
  if (c === undefined || c.isTypeOnly || c.name !== undefined) return false;
  const nb = c.namedBindings;
  if (nb === undefined || !ts.isNamedImports(nb) || nb.elements.length === 0) return false;
  return nb.elements.every((el) => !el.isTypeOnly && (el.propertyName ?? el.name).text === "createHash");
}

/**
 * `import`, `import type`, `export … from`, `import x = require(…)` and `import("…")` in a type position, wherever
 * they stand — in type aliases, interfaces and ambient declarations too — so the purity rules and the edges see one
 * set of imports.
 */
function importsOf(sf: ts.SourceFile, file: string): Import[] {
  const out: Import[] = [];
  const visit = (node: ts.Node): void => {
    let spec: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) spec = node.moduleSpecifier;
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      spec = node.moduleReference.expression;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) spec = node.argument.literal;
    if (spec !== undefined && ts.isStringLiteral(spec)) {
      out.push({
        spec: spec.text,
        line: lineOf(sf, node),
        hashOnly: ts.isImportDeclaration(node) && cryptoImportOk(node),
        target: isRelative(spec.text) ? resolveSpec(file, spec.text) : null,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** A file after a syntax error has no imports: its AST is recovered by heuristics (design D-2). */
function parseFile(root: string, file: string): Parsed {
  const sf = parse(join(root, file));
  const diags = parseDiagnostics(sf);
  if (diags.length > 0) return { sf, errorLine: lineOf(sf, diags[0]?.start ?? 0), imports: [] };
  return { sf, errorLine: null, imports: importsOf(sf, file) };
}

// ---- REQ-AR-001: kernel isolation ----------------------------------------------------------------------------

function dateFormOk(id: ts.Identifier): boolean {
  const n = id.parent;
  if (!ts.isNewExpression(n) || n.expression !== id) return false;
  const args = n.arguments ?? [];
  if (args.length !== 1) return false;
  const a = args[0] as ts.Expression;
  if (ts.isSpreadElement(a) || ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return false;
  const access = n.parent;
  return ts.isPropertyAccessExpression(access) && access.expression === n && DATE_METHOD.test(access.name.text);
}

function mathFormOk(id: ts.Identifier): boolean {
  const p = id.parent;
  return ts.isPropertyAccessExpression(p) && p.expression === id && MATH_EXACT.has(p.name.text);
}

/**
 * The purity rules over a file parsed without errors. With `inPerimeter` — a perimeter file: its imports stay in the
 * kernel as relative `.ts` paths of the perimeter (REQ-AR-005). Without it — a file of a pure module: only
 * `dynamic-import`, `forbidden-global` and `nondeterminism`, its imports being the matrix's (REQ-AR-010).
 */
function purity(
  file: Parsed,
  inPerimeter: ((path: string) => boolean) | null,
  report: (line: number, rule: string) => void,
): void {
  const sf = file.sf;
  if (inPerimeter !== null) {
    // every `/// <reference …>` directive of the file head, whatever its attribute (`path`, `types`, `lib`,
    // `no-default-lib`): the parser keeps only some of them in `referencedFiles` and its siblings
    for (const c of ts.getLeadingCommentRanges(sf.text, 0) ?? []) {
      if (REFERENCE.test(sf.text.slice(c.pos, c.end))) report(lineOf(sf, c.pos), "import-outside-kernel");
    }
    for (const imp of file.imports) {
      if (imp.spec === "node:crypto") {
        if (!imp.hashOnly) report(imp.line, "crypto-import");
      } else if (imp.target === null || !imp.target.endsWith(".ts") || !inPerimeter(imp.target)) {
        report(imp.line, "import-outside-kernel");
      }
    }
  }
  const visit = (node: ts.Node): void => {
    if (isDeclare(node)) return; // ambient declarations: no runtime, bind nothing
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    // imports are checked above, `import("…")` in a type position with the type nodes below
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    if (ts.isTypeNode(node) || ts.isExpressionWithTypeArguments(node)) {
      if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent) && node.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(node.parent.parent)) {
        visit(node.expression);
      }
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) report(lineOf(sf, node), "dynamic-import");
      if (ts.isIdentifier(callee) && callee.text === "require" && !isBound(callee)) {
        report(lineOf(sf, node), "dynamic-import");
        node.arguments.forEach(visit);
        return;
      }
    }
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      report(lineOf(sf, node), "forbidden-global");
    }
    if (ts.isPropertyAccessExpression(node) && LOCAL_TIME.test(node.name.text)) {
      report(lineOf(sf, node), "nondeterminism");
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      LOCAL_TIME.test(node.argumentExpression.text)
    ) {
      report(lineOf(sf, node), "nondeterminism");
    }
    if (ts.isIdentifier(node) && isValueIdentifier(node) && !isBound(node)) {
      const name = node.text;
      if (!ALLOWED.has(name)) report(lineOf(sf, node), "forbidden-global");
      else if (name === "Date" && !dateFormOk(node)) report(lineOf(sf, node), "nondeterminism");
      else if (name === "Math" && !mathFormOk(node)) report(lineOf(sf, node), "nondeterminism");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// ---- REQ-AR-003: everything reachable from the entry stays in the perimeter ----------------------------------

/**
 * `outside-perimeter` over a breadth-first walk from the entry along the edges of existing perimeter files: an edge
 * into a path outside the perimeter is refused at its import line and not followed; an entry outside it, at line 0.
 */
function perimeter(
  entry: string,
  parsed: ReadonlyMap<string, Parsed>,
  inPerimeter: (path: string) => boolean,
  report: Report,
): void {
  if (!inPerimeter(entry)) {
    report(entry, 0, "outside-perimeter");
    return;
  }
  const reached = new Set([entry]);
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i] as string;
    for (const { target, line } of parsed.get(file)?.imports ?? []) {
      if (target === null) continue;
      if (!inPerimeter(target)) {
        report(file, line, "outside-perimeter");
      } else if (!reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }
}

// ---- REQ-AR-004: no cycles between source files --------------------------------------------------------------

/**
 * `import-cycle` over a depth-first walk of the nodes in the given order, edges in text order, each node walked once:
 * an edge into a node on the current walk path (the node itself included) closes a cycle.
 */
function cycles(nodes: readonly string[], parsed: ReadonlyMap<string, Parsed>, report: Report): void {
  const isNode = new Set(nodes);
  const state = new Map<string, "on-path" | "done">();
  const visit = (file: string): void => {
    state.set(file, "on-path");
    for (const { target, line } of parsed.get(file)?.imports ?? []) {
      if (target === null || !isNode.has(target)) continue;
      const s = state.get(target);
      if (s === "on-path") report(file, line, "import-cycle");
      else if (s === undefined) visit(target);
    }
    state.set(file, "done");
  };
  for (const file of nodes) if (!state.has(file)) visit(file);
}

// ---- REQ-AR-009, REQ-AR-010: the module matrix and pure modules -----------------------------------------------

const ADAPTER = /^([a-z]+)-[a-z0-9][a-z0-9-]*$/;

/** A module a file belongs to: a module of the list, or an adapter `src/adapters/<port>-<name>/` of a known port. */
type Owner = { readonly module: Module; readonly adapterPort: string | null };

function owners(modules: Modules): (path: string) => Owner | null {
  const listed = modules.list.map((module) => ({ module, matches: globList([module.files]) }));
  return (path) => {
    const segs = path.split("/");
    if (segs[0] === "src" && segs[1] === "adapters") {
      const port = segs.length >= 4 ? ADAPTER.exec(segs[2] as string)?.[1] : undefined;
      if (port === undefined || !Object.hasOwn(modules.ports, port)) return null;
      const module: Module = { name: `adapters/${segs[2]}`, files: "", imports: [], builtins: true, packages: true };
      return { module, adapterPort: port };
    }
    const hit = listed.find((m) => m.matches(path));
    return hit === undefined ? null : { module: hit.module, adapterPort: null };
  };
}

/** Whether a file of `from` may have an edge to `target` (REQ-AR-009). */
function mayImport(from: Owner, target: string, ownerOf: (path: string) => Owner | null, modules: Modules): boolean {
  const to = ownerOf(target);
  if (to !== null && to.module.name === from.module.name) return true;
  if (from.adapterPort !== null) return target === normalize(modules.ports[from.adapterPort] as string);
  if (to === null) return false;
  const allowed = from.module.imports;
  if (allowed.includes(to.module.name)) return true;
  if (to.adapterPort !== null) return allowed.includes("adapters");
  return allowed.includes(`${to.module.name}:ports`) && target.startsWith(`src/${to.module.name}/ports/`);
}

/**
 * `outside-matrix`, `non-ts-file`, `import-direction`, `package-import` (REQ-AR-009) and the purity of pure modules
 * (REQ-AR-010) over the source files under `src/` that are neither perimeter files nor files with `parse-error`.
 */
function matrix(
  files: readonly string[],
  parsed: ReadonlyMap<string, Parsed>,
  modules: Modules,
  report: Report,
): void {
  const ownerOf = owners(modules);
  for (const file of files) {
    const owner = ownerOf(file);
    if (owner === null) {
      report(file, 0, "outside-matrix");
      continue;
    }
    const facts = parsed.get(file);
    if (facts === undefined) {
      report(file, 1, "non-ts-file");
      continue;
    }
    const { builtins, packages } = owner.module;
    for (const imp of facts.imports) {
      if (isRelative(imp.spec)) {
        if (imp.target !== null && !mayImport(owner, imp.target, ownerOf, modules)) {
          report(file, imp.line, "import-direction");
        }
      } else if (imp.spec.startsWith("node:") ? !builtins : !packages) {
        report(file, imp.line, "package-import");
      }
    }
    if (!builtins && !packages) purity(facts, null, (line, rule) => report(file, line, rule));
  }
}

// ---- the check -----------------------------------------------------------------------------------------------

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Violations of the tree at `root` under `policy` (REQ-AR-005, REQ-AR-007…REQ-AR-010): distinct file–line–rule
 * triples ordered by file (UTF-16 code units), line as a number, rule (UTF-16 code units). `no-kernel` alone, at line
 * 0, by the first condition met: no root directory (named as given), no `*.ts` file in the perimeter (the root), no
 * entry file (the entry path).
 */
export function checkStructure(root: string, policy: Policy): Violation[] {
  const noKernel = (file: string): Violation[] => [{ file, line: 0, rule: "no-kernel" }];
  if (!isRealDirectory(root)) return noKernel(root);
  const globs = (list: readonly string[]): string[] =>
    list.map(normalizeGlob).filter((glob): glob is string => glob !== null);
  const sources = globs(policy.sources);
  const perimeterGlobs = globs(policy.perimeter);
  const inSources = globList(sources);
  const inPerimeter = globList(perimeterGlobs);
  const files = [...treeFiles(root, [...sources, ...perimeterGlobs])]
    .filter((file) => inSources(file) || inPerimeter(file))
    .sort(byCodeUnits);
  if (!files.some((file) => inPerimeter(file) && file.endsWith(".ts"))) return noKernel(root);
  const entry = normalize(policy.entry);
  if (treeEntry(root, entry.split("/"))?.isFile() !== true) return noKernel(entry);

  const parsed = new Map<string, Parsed>();
  for (const file of files) if (file.endsWith(".ts")) parsed.set(file, parseFile(root, file));
  const found = new Map<string, Violation>();
  const report: Report = (file, line, rule) => found.set(`${file}:${line}:${rule}`, { file, line, rule });
  for (const file of files) {
    const facts = parsed.get(file);
    if (facts !== undefined && facts.errorLine !== null) {
      report(file, facts.errorLine, "parse-error"); // the only refusal of the file: no purity rules, no edges
    } else if (inPerimeter(file)) {
      if (facts === undefined) report(file, 1, "non-ts-file");
      else purity(facts, inPerimeter, (line, rule) => report(file, line, rule));
    }
  }
  perimeter(entry, parsed, inPerimeter, report);
  cycles(files.filter((file) => inSources(file) && parsed.has(file)), parsed, report);
  if (policy.modules !== undefined) {
    const checked = files.filter(
      (file) =>
        inSources(file) && file.startsWith("src/") && !inPerimeter(file) && parsed.get(file)?.errorLine == null,
    );
    matrix(checked, parsed, policy.modules, report);
  }
  return [...found.values()].sort(
    (a, b) => byCodeUnits(a.file, b.file) || a.line - b.line || byCodeUnits(a.rule, b.rule),
  );
}

// ---- REQ-AR-002: tests inside describe -----------------------------------------------------------------------

const TEST_FNS = new Set(["test", "it"]);
const SUITE_FNS = new Set(["describe", "suite"]);
const MODES = new Set(["skip", "only", "todo"]);

type TestBindings = { readonly tests: Set<string>; readonly suites: Set<string>; readonly namespaces: Set<string> };

function testBindings(sf: ts.SourceFile): TestBindings {
  const b: TestBindings = { tests: new Set(), suites: new Set(), namespaces: new Set() };
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== "node:test") continue;
    const c = s.importClause;
    if (c === undefined) continue;
    if (c.name !== undefined) b.tests.add(c.name.text);
    const nb = c.namedBindings;
    if (nb === undefined) continue;
    if (ts.isNamespaceImport(nb)) {
      b.namespaces.add(nb.name.text);
      continue;
    }
    for (const el of nb.elements) {
      const imported = (el.propertyName ?? el.name).text;
      if (TEST_FNS.has(imported)) b.tests.add(el.name.text);
      if (SUITE_FNS.has(imported)) b.suites.add(el.name.text);
    }
  }
  return b;
}

/** The imported name (not shadowed by an inner binding) called directly, with a mode, or through a namespace. */
function callKind(callee: ts.Expression, b: TestBindings): "test" | "suite" | null {
  let e = callee;
  if (ts.isPropertyAccessExpression(e) && MODES.has(e.name.text)) e = e.expression;
  if (ts.isIdentifier(e)) {
    const shadowed = isBound(e, e.getSourceFile());
    if (shadowed) return null;
    if (b.tests.has(e.text)) return "test";
    if (b.suites.has(e.text)) return "suite";
    return null;
  }
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && b.namespaces.has(e.expression.text)) {
    if (isBound(e.expression, e.getSourceFile())) return null;
    if (TEST_FNS.has(e.name.text)) return "test";
    if (SUITE_FNS.has(e.name.text)) return "suite";
  }
  return null;
}

function insideSuite(node: ts.Node, b: TestBindings): boolean {
  for (let n = node.parent; n !== undefined; n = n.parent) {
    if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && ts.isCallExpression(n.parent)) {
      const call = n.parent;
      if (call.arguments.includes(n as ts.Expression) && callKind(call.expression, b) === "suite") return true;
    }
  }
  return false;
}

/** Violations of `test-outside-describe` in the given test files (paths reported as given). */
export function checkTests(files: readonly string[]): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const sf = parse(file);
    const b = testBindings(sf);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && callKind(node.expression, b) === "test" && !insideSuite(node, b)) {
        out.push({ file, line: lineOf(sf, node), rule: "test-outside-describe" });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

/** `test/**` files named `*.test.ts`. */
export function projectTestFiles(dir: string): string[] {
  return listFiles(dir).filter((f) => f.endsWith(".test.ts"));
}
