import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";

/** Extract the actual technique function and its local dependencies, not a second demo. */
export function sketchSources(root) {
  const results = new Map();
  for (const group of ["basic", "geometry", "effects"]) {
    const path = `apps/web/lib/adapters/${group}.ts`;
    const source = readFileSync(join(root, path), "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["typescript"] });
    const declarations = new Map();
    const imports = [];
    let dispatch;
    for (const statement of ast.program.body) {
      const node = statement.declaration ?? statement;
      if (node.type === "ImportDeclaration") imports.push(node);
      if (node.type === "FunctionDeclaration" || node.type === "TSTypeAliasDeclaration") {
        declarations.set(node.id.name, node);
        if (node.id.name === `draw${group[0].toUpperCase()}${group.slice(1)}`) dispatch = node;
      }
      if (node.type === "VariableDeclaration") {
        for (const declaration of node.declarations) {
          if (declaration.id.type === "Identifier" && !declaration.id.name.endsWith("Definitions"))
            declarations.set(declaration.id.name, node);
        }
      }
    }
    const visit = (node, callback) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach((value) => visit(value, callback)); return; }
      callback(node);
      for (const [key, value] of Object.entries(node))
        if (!["loc", "start", "end", "comments", "tokens"].includes(key)) visit(value, callback);
    };
    visit(dispatch, (node) => {
      if (node.type !== "SwitchCase" || node.test?.type !== "StringLiteral") return;
      const call = node.consequent.find((value) => value.type === "ReturnStatement")?.argument;
      if (call?.type !== "CallExpression" || call.callee.type !== "Identifier")
        throw Error(`Unsupported source dispatch for ${node.test.value}`);
      const selected = new Set();
      const names = new Set();
      const collect = (name) => {
        const declaration = declarations.get(name);
        if (!declaration || selected.has(declaration)) return;
        selected.add(declaration);
        visit(declaration, (child) => {
          if (child.type === "Identifier") { names.add(child.name); collect(child.name); }
        });
      };
      collect(call.callee.name);
      const importText = imports.flatMap((statement) => {
        const specifiers = statement.specifiers.filter((specifier) => names.has(specifier.local.name));
        if (!specifiers.length) return [];
        const bindings = specifiers.map((specifier) => source.slice(specifier.start, specifier.end)).join(", ");
        return [`import ${statement.importKind === "type" ? "type " : ""}{ ${bindings} } from ${JSON.stringify(statement.source.value)};`];
      });
      const body = [...selected].sort((a, b) => a.start - b.start).map((value) => source.slice(value.start, value.end));
      results.set(node.test.value, {
        sketchSourcePath: path,
        sketchSource: `// Actual app drawing code. p is a p5 graphics buffer; layer contains the controls, seed and palette.\n// Imports are relative to ${path}.\n\n${importText.join("\n")}\n\n${body.join("\n\n")}\n`,
      });
    });
  }
  return results;
}
