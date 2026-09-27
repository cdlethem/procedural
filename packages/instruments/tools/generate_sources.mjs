#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const javascriptIndex = process.argv.indexOf("--javascript-root");
const javascriptRoot = javascriptIndex < 0
  ? join(repositoryRoot, "packages/javascript")
  : resolve(process.argv[javascriptIndex + 1]);
const metadata = JSON.parse(readFileSync(join(packageRoot, "metadata.json"), "utf8"));
const sourceFiles = new Map();
const extracted = new Map();

function sourceFile(path) {
  assert.match(path, /^packages\/(?:instruments\/src\/[\w./-]+\.ts|javascript\/[\w./-]+\.js)$/,
    `Invalid public source location: ${path}`);
  const root = path.startsWith("packages/instruments/") ? packageRoot : javascriptRoot;
  const target = path.startsWith("packages/instruments/")
    ? join(root, path.slice("packages/instruments/".length))
    : join(root, path.slice("packages/javascript/".length));
  assert.ok(target.startsWith(root + sep) && existsSync(target), `Missing library source: ${path}`);
  if (!sourceFiles.has(path)) {
    const text = readFileSync(target, "utf8");
    const ast = parse(text, { sourceType: "module", plugins: target.endsWith(".ts") ? ["typescript"] : [] });
    const declarations = new Map();
    const imports = [];
    for (const statement of ast.program.body) {
      const node = statement.declaration ?? statement;
      if (node.type === "ImportDeclaration") imports.push(node);
      if (["FunctionDeclaration", "ClassDeclaration", "TSTypeAliasDeclaration", "TSInterfaceDeclaration", "TSEnumDeclaration"].includes(node.type))
        declarations.set(node.id.name, statement);
      if (node.type === "VariableDeclaration") for (const item of node.declarations)
        if (item.id.type === "Identifier") declarations.set(item.id.name, statement);
    }
    sourceFiles.set(path, { text, declarations, imports });
  }
  return sourceFiles.get(path);
}

// Same dependency-following extraction as the original gallery source viewer: retain the
// actual declaration, local helpers and referenced imports rather than reimplementing art.
function drawingSource(path, entrypoint) {
  const key = `${path}:${entrypoint}`;
  if (extracted.has(key)) return extracted.get(key);
  const { text, declarations, imports } = sourceFile(path);
  assert.ok(declarations.has(entrypoint), `Missing current library drawing entrypoint ${entrypoint} in ${path}`);
  const selected = new Set();
  const names = new Set();
  const collect = (name) => {
    const declaration = declarations.get(name);
    if (!declaration || selected.has(declaration)) return;
    selected.add(declaration);
    visit(declaration);
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === "Identifier") { names.add(node.name); collect(node.name); }
    for (const [key, value] of Object.entries(node))
      if (!["loc", "start", "end", "comments", "tokens", "leadingComments", "trailingComments", "innerComments"].includes(key)) visit(value);
  };
  collect(entrypoint);
  const importText = imports.filter(statement => statement.specifiers.some(specifier => names.has(specifier.local.name)))
    .map(statement => text.slice(statement.start, statement.end));
  const body = [...selected].sort((a, b) => a.start - b.start).map(node => {
    const firstComment = node.leadingComments?.[0];
    return text.slice(firstComment?.start ?? node.start, node.end);
  });
  const result = {
    path,
    source: `// Actual library source; imports are relative to ${path}.\n\n${importText.join("\n")}\n\n${body.join("\n\n")}\n`,
  };
  extracted.set(key, result);
  return result;
}

assert.equal(metadata.schemaVersion, 1);
const sources = {};
for (const instrument of metadata.instruments) {
  assert.ok(!sources[instrument.id], `Duplicate instrument ID: ${instrument.id}`);
  assert.ok(existsSync(join(packageRoot, instrument.guide)), `Missing teaching guide: ${instrument.id}`);
  sources[instrument.id] = drawingSource(instrument.source, instrument.sourceEntry);
}
const result = { schemaVersion: 1, version: metadata.version, sources };
const output = join(packageRoot, "sources.json");
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Extracted current library drawing sources for ${Object.keys(sources).length} instruments`);
