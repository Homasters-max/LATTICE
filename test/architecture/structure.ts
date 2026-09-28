// Structure checks (REQ-AR-001, REQ-AR-002, design D-5) over the TypeScript AST: the kernel imports nothing but
// itself and createHash of node:crypto and uses only the allowed free identifiers; every node:test test is declared
// inside a function passed to a suite call. The checks parse source text and never run the checked files.

import ts from "typescript";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type Violation = { readonly file: string; readonly line: number; readonly rule: string };

// Closed list of free identifiers of the kernel (UNK-KR-007); Math and Date only in the forms of `nondeterminism`.
const ALLOWED = new Set([
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Math", "JSON", "Reflect", "Map", "Set",
  "WeakMap", "Error", "TypeError", "RangeError", "ArrayBuffer", "DataView", "Uint8Array", "Date", "undefined", "NaN",
  "Infinity",
]);
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

/** Files of a directory, recursive, in a stable order. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
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

// ---- REQ-AR-001: kernel isolation ----------------------------------------------------------------------------

function insideRoot(spec: string, file: string, root: string): boolean {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return false;
  const target = resolve(dirname(file), spec);
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel) && target.endsWith(".ts");
}

function cryptoImportOk(node: ts.ImportDeclaration): boolean {
  const c = node.importClause;
  if (c === undefined || c.isTypeOnly || c.name !== undefined) return false;
  const nb = c.namedBindings;
  if (nb === undefined || !ts.isNamedImports(nb) || nb.elements.length === 0) return false;
  return nb.elements.every((el) => !el.isTypeOnly && (el.propertyName ?? el.name).text === "createHash");
}

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

function checkKernelFile(file: string, root: string, report: (line: number, rule: string) => void): void {
  const sf = parse(file);
  const diags = parseDiagnostics(sf);
  if (diags.length > 0) {
    report(lineOf(sf, diags[0]?.start ?? 0), "parse-error");
    return;
  }
  for (const ref of [...sf.referencedFiles, ...sf.typeReferenceDirectives, ...sf.libReferenceDirectives]) {
    report(lineOf(sf, ref.pos), "import-outside-kernel");
  }
  const moduleSpec = (spec: string, at: ts.Node, named: boolean): void => {
    if (spec === "node:crypto") {
      if (!named) report(lineOf(sf, at), "crypto-import");
    } else if (!insideRoot(spec, file, root)) {
      report(lineOf(sf, at), "import-outside-kernel");
    }
  };
  const visit = (node: ts.Node): void => {
    if (isDeclare(node)) return; // ambient declarations: no runtime, bind nothing
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      moduleSpec(node.moduleSpecifier.text, node, cryptoImportOk(node));
      return;
    }
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
        moduleSpec(node.moduleSpecifier.text, node, false);
      }
      return;
    }
    if (ts.isImportEqualsDeclaration(node)) {
      const ref = node.moduleReference;
      if (ts.isExternalModuleReference(ref) && ts.isStringLiteral(ref.expression)) {
        moduleSpec(ref.expression.text, node, false);
      }
      return;
    }
    if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      if (ts.isLiteralTypeNode(arg) && ts.isStringLiteral(arg.literal)) moduleSpec(arg.literal.text, node, false);
      return;
    }
    if (ts.isTypeNode(node) || ts.isExpressionWithTypeArguments(node)) {
      if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent) && node.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(node.parent.parent)) {
        visit(node.expression);
        return;
      }
      ts.forEachChild(node, (c) => {
        if (ts.isImportTypeNode(c) || ts.isTypeNode(c)) visit(c);
      });
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

/** Violations of the kernel directory `dir` (recursive); `no-kernel` when it is missing or has no `*.ts` file. */
export function checkKernel(dir: string): Violation[] {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) return [{ file: dir, line: 0, rule: "no-kernel" }];
  const files = listFiles(root);
  if (!files.some((f) => f.endsWith(".ts"))) return [{ file: dir, line: 0, rule: "no-kernel" }];
  const found = new Map<string, Violation>();
  for (const file of files) {
    const rel = relative(root, file).split("\\").join("/");
    const report = (line: number, rule: string): void => {
      const v = { file: rel, line, rule };
      found.set(`${rel}:${line}:${rule}`, v);
    };
    if (!file.endsWith(".ts")) {
      report(1, "non-ts-file");
      continue;
    }
    checkKernelFile(file, root, report);
  }
  return [...found.values()];
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
