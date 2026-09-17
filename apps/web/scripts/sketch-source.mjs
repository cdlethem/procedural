import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "@babel/parser";

/** Extract the actual technique function and its local dependencies, not a second demo. */
export function sketchSources(root) {
  const results = new Map();
  for (const [group, dispatchName] of [
    ["basic", "basic"],
    ["geometry", "geometry"],
    ["effects", "effects"],
    ["expansion", "expansion"],
    ["external-expansion", "externalExpansion"],
    ["paths", "paths"],
    ["systems", "systems"],
    ["materials", "materials"],
  ]) {
    const path = `apps/web/lib/adapters/${group}.ts`;
    if (["paths", "systems", "materials"].includes(group) && !existsSync(join(root, path))) continue;
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
        if (node.id.name === `draw${dispatchName[0].toUpperCase()}${dispatchName.slice(1)}`) dispatch = node;
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
      if (group === "paths" && ["rounded-panels", "road-margins", "nested-contour-strokes", "faceted-silhouettes", "concave-grain"].includes(node.test.value)) {
        const target = resolve(root, "apps/web/lib/adapters/paths-a-quality.ts");
        results.set(node.test.value, exampleDrawingSource(root, target, "drawPathsAQuality"));
        return;
      }
      if (group === "systems" && ["reaction-spots", "reaction-stripes", "organic-cells", "geometric-generations"].includes(node.test.value)) {
        const target = resolve(root, "apps/web/lib/adapters/systems-a-quality.ts");
        results.set(node.test.value, exampleDrawingSource(root, target, "drawSystemsAQuality"));
        return;
      }
      if (group === "geometry" && node.test.value === "loop-marks") {
        const target = resolve(root, "apps/web/lib/adapters/loop-marks-quality.ts");
        results.set(node.test.value, exampleDrawingSource(root, target, "drawLoopMarksModern"));
        return;
      }
      if (group === "systems" && ["ripple-interference", "pinned-waves"].includes(node.test.value)) {
        const target = resolve(root, "apps/web/lib/adapters/systems-b-wave-quality.ts");
        results.set(node.test.value, exampleDrawingSource(root, target, "drawWaveQuality"));
        return;
      }
      if (group === "materials") {
        const fields = {
          "quantized-stripes": "drawQuantizedStripesField",
          "perceptual-bands": "drawPerceptualBandsField",
          "reduced-mosaic": "drawReducedMosaicField",
          "nearest-feature-mosaic": "drawNearestFeatureField",
        };
        const entrypoint = fields[node.test.value];
        if (entrypoint) {
          const target = resolve(root, "apps/web/lib/adapters/materials-a-fields.ts");
          results.set(node.test.value, exampleDrawingSource(root, target, entrypoint));
          return;
        }
      }
      const call = node.consequent.find((value) => value.type === "ReturnStatement")?.argument;
      if (call?.type !== "CallExpression" || call.callee.type !== "Identifier")
        throw Error(`Unsupported source dispatch for ${node.test.value}`);
      // Native examples and web adapters may share an ordinary drawing module.
      // Show that module's real drawing function instead of an empty import wrapper.
      if (!declarations.has(call.callee.name)) {
        const statement = imports.find((entry) => entry.specifiers.some((specifier) => specifier.local.name === call.callee.name));
        const specifier = statement?.specifiers.find((entry) => entry.local.name === call.callee.name);
        if (specifier?.type !== "ImportSpecifier") throw Error(`Missing drawing declaration for ${node.test.value}`);
        const target = resolve(root, dirname(path), statement.source.value);
        const examples = resolve(root, "packages/javascript/examples") + sep;
        const adapters = resolve(root, "apps/web/lib/adapters") + sep;
        if (!(target.startsWith(examples) && target.endsWith(".js")) &&
            !(target.startsWith(adapters) && target.endsWith(".ts")))
          throw Error(`Drawing source must be an editable example or adapter: ${node.test.value}`);
        const importedName = specifier.imported.name ?? specifier.imported.value;
        results.set(node.test.value, exampleDrawingSource(root, target, importedName));
        return;
      }
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

/** Follow local declarations only; public operation/RNG imports remain visible imports. */
function exampleDrawingSource(root, target, entrypoint) {
  const source = readFileSync(target, "utf8");
  const ast = parse(source, { sourceType: "module", plugins: target.endsWith(".ts") ? ["typescript"] : [] });
  const declarations = new Map(), imports = [];
  for (const statement of ast.program.body) {
    const node = statement.declaration ?? statement;
    if (node.type === "ImportDeclaration") imports.push(node);
    if (node.type === "FunctionDeclaration") declarations.set(node.id.name, node);
    if (node.type === "VariableDeclaration") for (const item of node.declarations)
      if (item.id.type === "Identifier") declarations.set(item.id.name, node);
  }
  if (!declarations.has(entrypoint)) throw Error(`Missing example drawing function ${entrypoint}`);
  const selected = new Set(), names = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === "Identifier") { names.add(node.name); collect(node.name); }
    for (const [key, value] of Object.entries(node))
      if (!["loc", "start", "end", "comments", "tokens"].includes(key)) visit(value);
  };
  const collect = (name) => {
    const declaration = declarations.get(name);
    if (!declaration || selected.has(declaration)) return;
    selected.add(declaration); visit(declaration);
  };
  collect(entrypoint);
  const importText = imports.flatMap((statement) =>
    statement.specifiers.some((specifier) => names.has(specifier.local.name))
      ? [source.slice(statement.start, statement.end)] : []);
  const body = [...selected].sort((a, b) => a.start - b.start).map((node) => source.slice(node.start, node.end));
  const path = relative(root, target).split(sep).join("/");
  return {
    sketchSourcePath: path,
    sketchSource: `// Actual ${target.endsWith(".ts") ? "app" : "shared native and app"} drawing code. p is a p5 graphics buffer; layer contains the controls, seed and palette.\n// Imports are relative to ${path}.\n\n${importText.join("\n")}\n\n${body.join("\n\n")}\n`,
  };
}
