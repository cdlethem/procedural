#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputIndex = process.argv.indexOf("--output");
assert.notEqual(outputIndex, -1, "usage: build_web_toolkit.mjs --output .work/dist/<new-release>");
const out = resolve(root, process.argv[outputIndex + 1] ?? "");
const distRoot = join(root, ".work", "dist") + sep;
assert.ok(out.startsWith(distRoot), "output must be below .work/dist");
assert.ok(!existsSync(out), "output directory must not exist");

const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = (path) => hashBytes(readFileSync(path));
const files = (path) => readdirSync(path, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)])
  .sort();
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: join(out, "npm-cache"), ...options.env },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};
const git = (...args) => run("git", args);
const sourceCommit = git("rev-parse", "HEAD");
const javascriptPackage = JSON.parse(readFileSync(join(root, "packages/javascript/package.json"), "utf8"));
assert.equal(javascriptPackage.name, "@procedurals/javascript");
assert.match(javascriptPackage.version, /^0\.2\.\d+$/);
assert.equal(javascriptPackage.private, undefined);

const exampleDirectories = readdirSync(join(root, "packages/javascript/examples"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const publicGuides = exampleDirectories
  .map((name) => `docs/${name}.md`)
  .filter((path) => existsSync(join(root, path)));
const releaseInputs = [
  "packages/javascript",
  "catalog/operations",
  "catalog/validation",
  "catalog/drawing",
  "catalog/recipes/execution-bindings.json",
  ...publicGuides,
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "tools/build_web_toolkit.mjs",
];
const dirty = git("status", "--porcelain=v1", "--untracked-files=all", "--", ...releaseInputs);
assert.equal(dirty, "", `release inputs must be committed and clean:\n${dirty}`);
const inputFiles = releaseInputs.flatMap((path) => {
  const absolute = join(root, path);
  return statSync(absolute).isDirectory() ? files(absolute) : [absolute];
});
const before = Object.fromEntries(inputFiles.map((path) => [relative(root, path).split(sep).join("/"), hashFile(path)]));

mkdirSync(out, { recursive: true });
const javascriptStage = join(out, "javascript-stage");
const catalogStage = join(out, "catalog-stage");
mkdirSync(javascriptStage);
mkdirSync(catalogStage);
for (const name of ["src", "examples", "types", "package.json"]) cpSync(join(root, "packages/javascript", name), join(javascriptStage, name), { recursive: true });
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) cpSync(join(root, name), join(javascriptStage, name));
writeFileSync(join(javascriptStage, "README.md"), "# Procedurals JavaScript\n\nPublic MIT toolkit operations and editable p5.js examples. See the public repository documentation for reviewed target support and capability limits.\n");

const catalogPackage = {
  name: "@procedurals/catalog",
  version: javascriptPackage.version,
  type: "module",
  exports: {
    "./manifest.json": "./manifest.json",
    "./package.json": "./package.json",
    "./catalog/*": "./catalog/*",
    "./docs/*": "./docs/*",
  },
};
writeFileSync(join(catalogStage, "package.json"), `${JSON.stringify(catalogPackage, null, 2)}\n`);
for (const directory of ["operations", "validation", "drawing"]) {
  cpSync(join(root, "catalog", directory), join(catalogStage, "catalog", directory), { recursive: true });
}
mkdirSync(join(catalogStage, "catalog", "recipes"), { recursive: true });
cpSync(join(root, "catalog/recipes/execution-bindings.json"), join(catalogStage, "catalog/recipes/execution-bindings.json"));
for (const guide of publicGuides) {
  const destination = join(catalogStage, guide);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(root, guide), destination);
}
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) cpSync(join(root, name), join(catalogStage, name));
const catalogInventory = files(catalogStage)
  .filter((path) => relative(catalogStage, path) !== "manifest.json")
  .map((path) => ({
    path: relative(catalogStage, path).split(sep).join("/"),
    sha256: hashFile(path),
    bytes: statSync(path).size,
  }));
const manifest = {
  schemaVersion: 1,
  sourceCommit,
  javascriptVersion: javascriptPackage.version,
  files: catalogInventory,
};
writeFileSync(join(catalogStage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const pack = (stage) => JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", out], { cwd: stage }))[0];
const javascriptPack = pack(javascriptStage);
const catalogPack = pack(catalogStage);
const consumer = join(out, "consumer");
mkdirSync(consumer);
writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`);
run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(out, javascriptPack.filename), join(out, catalogPack.filename)], { cwd: consumer });
const installedJavaScript = join(consumer, "node_modules/@procedurals/javascript");
const installedCatalog = join(consumer, "node_modules/@procedurals/catalog");
for (const path of files(javascriptStage)) {
  const rel = relative(javascriptStage, path);
  assert.equal(hashFile(join(installedJavaScript, rel)), hashFile(path), `installed JavaScript byte drift: ${rel}`);
}
for (const entry of manifest.files) {
  assert.equal(hashFile(join(installedCatalog, entry.path)), entry.sha256, `installed catalog byte drift: ${entry.path}`);
  assert.equal(statSync(join(installedCatalog, entry.path)).size, entry.bytes, `installed catalog size drift: ${entry.path}`);
}
assert.deepEqual(JSON.parse(readFileSync(join(installedCatalog, "manifest.json"), "utf8")), manifest);

const appSourceFiles = files(join(root, "apps/web")).filter((path) => /\.(?:[cm]?js|tsx?)$/.test(path));
const importedExampleSubpaths = [...new Set(appSourceFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/["'](@procedurals\/javascript\/examples\/[^"']+)["']/g)].map((match) => match[1]);
}))].sort();
assert.ok(existsSync(join(installedJavaScript, "types/src/index.d.ts")), "installed JavaScript root declarations missing");
for (const specifier of importedExampleSubpaths) {
  const declaration = `${specifier.slice("@procedurals/javascript/examples/".length, -3)}.d.ts`;
  assert.ok(existsSync(join(installedJavaScript, "types/examples", declaration)), `installed example declarations missing: ${specifier}`);
}
const smokeSource = [
  "import * as api from '@procedurals/javascript';",
  "import manifest from '@procedurals/catalog/manifest.json' with { type: 'json' };",
  ...importedExampleSubpaths.map((specifier, index) => `import * as example${index} from ${JSON.stringify(specifier)};`),
  `console.log(JSON.stringify({exports:Object.keys(api).sort(),catalogFiles:manifest.files.length,examples:${JSON.stringify(importedExampleSubpaths)}}));`,
].join("\n");
const smoke = JSON.parse(run(process.execPath, ["--input-type=module", "-e", smokeSource], { cwd: consumer, timeout: 30_000 }));
assert.ok(smoke.exports.length > 0);
assert.equal(smoke.catalogFiles, manifest.files.length);

const after = Object.fromEntries(inputFiles.map((path) => [relative(root, path).split(sep).join("/"), hashFile(path)]));
assert.deepEqual(after, before, "release builder modified source inputs");
const artifacts = [javascriptPack, catalogPack].map((record) => ({
  name: record.name,
  version: record.version,
  filename: record.filename,
  bytes: statSync(join(out, record.filename)).size,
  sha256: hashFile(join(out, record.filename)),
  integrity: record.integrity,
}));
const report = {
  schemaVersion: 1,
  status: "passed",
  sourceCommit,
  version: javascriptPackage.version,
  artifacts,
  catalogManifestSha256: hashFile(join(catalogStage, "manifest.json")),
  importedExampleSubpaths,
  publicGuideCoverage: {
    exampleDirectories: exampleDirectories.length,
    guidesIncluded: publicGuides,
    directoriesWithoutPublicGuide: exampleDirectories.filter((name) => !publicGuides.includes(`docs/${name}.md`)),
  },
  inputSha256Before: before,
  inputSha256After: after,
  scope: "Packed and offline-installed both public packages; verified byte inventories, declarations, root import, catalog manifest, and every app-imported example subpath. No registry publication or target-support claim.",
};
writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, "SHA256SUMS"), `${artifacts.map((item) => `${item.sha256}  ${item.filename}`).join("\n")}\n`);
console.log(JSON.stringify({ status: report.status, out, sourceCommit, version: report.version, artifacts }, null, 2));
