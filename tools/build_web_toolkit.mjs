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
assert.notEqual(outputIndex, -1, "usage: build_web_toolkit.mjs --output .work/dist/<new-release> [--allow-dirty]");
// Local preview only: package uncommitted inputs for a private app checkout. The report
// status becomes "local-preview" and lists the dirty inputs; such output is never a release.
const allowDirty = process.argv.includes("--allow-dirty");
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
const instrumentsRoot = join(root, "packages/instruments");
const instrumentsPackage = JSON.parse(readFileSync(join(instrumentsRoot, "package.json"), "utf8"));
const instrumentsMetadata = JSON.parse(readFileSync(join(instrumentsRoot, "metadata.json"), "utf8"));
assert.equal(instrumentsPackage.name, "@procedurals/instruments");
assert.equal(instrumentsPackage.version, javascriptPackage.version);
assert.equal(instrumentsPackage.peerDependencies["@procedurals/javascript"], javascriptPackage.version);
assert.equal(instrumentsMetadata.version, javascriptPackage.version);
assert.equal(instrumentsMetadata.coreVersion, javascriptPackage.version);
const instrumentIds = instrumentsMetadata.instruments.map(item => item.id).sort();
assert.ok(instrumentIds.length > 0, "instrument metadata must not be empty");
assert.equal(new Set(instrumentIds).size, instrumentIds.length, "duplicate instrument metadata");
for (const family of instrumentsMetadata.families) {
  assert.ok(instrumentIds.includes(family.id), `unknown family: ${family.id}`);
  for (const preset of family.presets)
    assert.ok(instrumentIds.includes(preset.id), `unknown preset: ${preset.id}`);
}
const buildDependencies = ["typescript", `@typescript/typescript-${process.platform}-${process.arch}`,
  "@babel/parser", "@babel/types", "@babel/helper-string-parser", "@babel/helper-validator-identifier"].map(name => {
  const directory = join(instrumentsRoot, "node_modules", name);
  assert.ok(existsSync(join(directory, "package.json")), `Install package build prerequisite: ${name}`);
  return directory;
});
const exampleSmokeContractPath = "tools/web_toolkit_example_subpaths.json";
const exampleSmokeContract = JSON.parse(readFileSync(join(root, exampleSmokeContractPath), "utf8"));
assert.deepEqual(Object.keys(exampleSmokeContract).sort(), ["package", "schemaVersion", "subpaths"]);
assert.equal(exampleSmokeContract.schemaVersion, 1);
assert.equal(exampleSmokeContract.package, javascriptPackage.name);
assert.ok(Array.isArray(exampleSmokeContract.subpaths) && exampleSmokeContract.subpaths.length > 0,
  "example smoke contract must name at least one public subpath");
const importedExampleSubpaths = exampleSmokeContract.subpaths;
assert.deepEqual(importedExampleSubpaths, [...new Set(importedExampleSubpaths)].sort(),
  "example smoke contract subpaths must be unique and sorted");
for (const specifier of importedExampleSubpaths) {
  assert.match(specifier, /^@procedurals\/javascript\/examples\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.js$/,
    `invalid JavaScript example smoke subpath: ${specifier}`);
}

const exampleDirectories = readdirSync(join(root, "packages/javascript/examples"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const publicGuides = exampleDirectories
  .map((name) => `docs/${name}.md`)
  .filter((path) => existsSync(join(root, path)));
const releaseInputs = [
  "packages/javascript",
  "packages/instruments/package.json",
  "packages/instruments/metadata.json",
  "packages/instruments/tsconfig.json",
  "packages/instruments/README.md",
  "packages/instruments/LICENSE",
  "packages/instruments/THIRD_PARTY_NOTICES.md",
  "packages/instruments/src",
  "packages/instruments/assets",
  "packages/instruments/guides",
  "packages/instruments/tools",
  "catalog/operations",
  "catalog/validation",
  "catalog/drawing",
  "catalog/recipes/execution-bindings.json",
  ...publicGuides,
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "tools/build_web_toolkit.mjs",
  exampleSmokeContractPath,
];
const dirty = git("status", "--porcelain=v1", "--untracked-files=all", "--", ...releaseInputs);
assert.ok(allowDirty || dirty === "", `release inputs must be committed and clean:\n${dirty}`);
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
// Package the actual, clean library sources rather than an app-local snapshot.
const instrumentsStage = join(out, "instruments-stage");
mkdirSync(instrumentsStage);
for (const name of ["src", "tools", "guides", "assets", "package.json", "metadata.json",
  "tsconfig.json", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"])
  cpSync(join(instrumentsRoot, name), join(instrumentsStage, name), { recursive: true });

// Build tools are locally installed prerequisites. The SDK tarball is the exact
// public peer, installed into the stage; only this isolated stage is compiled.
const javascriptPack = pack(javascriptStage);
// Install only explicit local build tools, not unrelated test-runner dev dependencies.
// Restore the exact authored package metadata before compilation and packaging.
writeFileSync(join(instrumentsStage, "package.json"),
  `${JSON.stringify({ ...instrumentsPackage, devDependencies: {} }, null, 2)}\n`);
run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
  "--no-package-lock", "--no-save", ...buildDependencies, join(out, javascriptPack.filename)],
  { cwd: instrumentsStage });
cpSync(join(instrumentsRoot, "package.json"), join(instrumentsStage, "package.json"));
run("npm", ["run", "build"], { cwd: instrumentsStage });
run("npm", ["run", "sources", "--", "--javascript-root", join(root, "packages/javascript")],
  { cwd: instrumentsStage });
const sourceMap = JSON.parse(readFileSync(join(instrumentsStage, "sources.json"), "utf8"));
assert.equal(sourceMap.version, instrumentsPackage.version);
assert.deepEqual(Object.keys(sourceMap.sources).sort(),
  instrumentsMetadata.instruments.map(item => item.id).sort());
for (const item of instrumentsMetadata.instruments) {
  assert.equal(sourceMap.sources[item.id].path, item.source);
  assert.ok(sourceMap.sources[item.id].source.includes(item.sourceEntry),
    `Source extraction did not include ${item.sourceEntry}: ${item.id}`);
}
const instrumentsInventory = [
  ...["src", "dist", "guides", "assets", "tools"].flatMap(directory => files(join(instrumentsStage, directory))),
  ...["package.json", "metadata.json", "sources.json", "tsconfig.json",
    "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"].map(name => join(instrumentsStage, name)),
].sort().map(path => ({
    path: relative(instrumentsStage, path).split(sep).join("/"),
    sha256: hashFile(path),
    bytes: statSync(path).size,
  }));
assert.ok(instrumentsInventory.some(entry => entry.path === "dist/index.js"));
assert.ok(instrumentsInventory.some(entry => entry.path === "dist/index.d.ts"));
assert.ok(instrumentsInventory.some(entry => entry.path.startsWith("src/assets/")));
assert.equal(instrumentsInventory.filter(entry => entry.path.startsWith("guides/")).length,
  new Set(instrumentsMetadata.instruments.map(item => item.guide)).size);
const instrumentsManifest = {
  schemaVersion: 1,
  sourceCommit,
  version: instrumentsPackage.version,
  coreVersion: javascriptPackage.version,
  files: instrumentsInventory,
};
writeFileSync(join(instrumentsStage, "manifest.json"), `${JSON.stringify(instrumentsManifest, null, 2)}\n`);
const instrumentsPack = pack(instrumentsStage);
const catalogPack = pack(catalogStage);

const consumer = join(out, "consumer");
mkdirSync(consumer);
writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`);
run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund",
  join(out, javascriptPack.filename), join(out, catalogPack.filename), join(out, instrumentsPack.filename)], { cwd: consumer });
const installedJavaScript = join(consumer, "node_modules/@procedurals/javascript");
const installedCatalog = join(consumer, "node_modules/@procedurals/catalog");
const installedInstruments = join(consumer, "node_modules/@procedurals/instruments");
for (const path of files(javascriptStage)) {
  const rel = relative(javascriptStage, path);
  assert.equal(hashFile(join(installedJavaScript, rel)), hashFile(path), `installed JavaScript byte drift: ${rel}`);
}
for (const entry of manifest.files) {
  assert.equal(hashFile(join(installedCatalog, entry.path)), entry.sha256, `installed catalog byte drift: ${entry.path}`);
  assert.equal(statSync(join(installedCatalog, entry.path)).size, entry.bytes, `installed catalog size drift: ${entry.path}`);
}
assert.deepEqual(JSON.parse(readFileSync(join(installedCatalog, "manifest.json"), "utf8")), manifest);
for (const entry of instrumentsManifest.files) {
  assert.equal(hashFile(join(installedInstruments, entry.path)), entry.sha256,
    `installed instruments byte drift: ${entry.path}`);
  assert.equal(statSync(join(installedInstruments, entry.path)).size, entry.bytes,
    `installed instruments size drift: ${entry.path}`);
}
assert.deepEqual(JSON.parse(readFileSync(join(installedInstruments, "manifest.json"), "utf8")), instrumentsManifest);

assert.ok(existsSync(join(installedJavaScript, "types/src/index.d.ts")), "installed JavaScript root declarations missing");
for (const specifier of importedExampleSubpaths) {
  const examplePath = specifier.slice("@procedurals/javascript/".length);
  const declaration = `${examplePath.slice("examples/".length, -3)}.d.ts`;
  assert.ok(existsSync(join(installedJavaScript, examplePath)), `installed example source missing: ${specifier}`);
  assert.ok(existsSync(join(installedJavaScript, "types/examples", declaration)), `installed example declarations missing: ${specifier}`);
}
const smokeSource = [
  "import * as api from '@procedurals/javascript';",
  "import manifest from '@procedurals/catalog/manifest.json' with { type: 'json' };",
  "import { definitions, createInstrument, validateInstrument } from '@procedurals/instruments';",
  "import instrumentMetadata from '@procedurals/instruments/metadata.json' with { type: 'json' };",
  "import instrumentSources from '@procedurals/instruments/sources.json' with { type: 'json' };",
  "import instrumentManifest from '@procedurals/instruments/manifest.json' with { type: 'json' };",
  ...importedExampleSubpaths.map((specifier, index) => `import * as example${index} from ${JSON.stringify(specifier)};`),
  `const ids = instrumentMetadata.instruments.map(item => item.id).sort(); if (JSON.stringify(definitions.map(item => item.id).sort()) !== JSON.stringify(ids)) throw Error('Runtime and metadata instrument IDs differ');`,
  `for (const id of ids) validateInstrument(createInstrument(id));`,
  `console.log(JSON.stringify({exports:Object.keys(api).sort(),catalogFiles:manifest.files.length,examples:${JSON.stringify(importedExampleSubpaths)},instrumentCount:ids.length,instrumentSources:Object.keys(instrumentSources.sources).length,instrumentFiles:instrumentManifest.files.length}));`,
].join("\n");
const smoke = JSON.parse(run(process.execPath, ["--input-type=module", "-e", smokeSource], { cwd: consumer, timeout: 30_000 }));
assert.ok(smoke.exports.length > 0);
assert.equal(smoke.catalogFiles, manifest.files.length);
assert.equal(smoke.instrumentCount, instrumentIds.length);
assert.equal(smoke.instrumentSources, instrumentIds.length);
assert.equal(smoke.instrumentFiles, instrumentsManifest.files.length);

const after = Object.fromEntries(inputFiles.map((path) => [relative(root, path).split(sep).join("/"), hashFile(path)]));
assert.deepEqual(after, before, "release builder modified source inputs");
const artifacts = [javascriptPack, catalogPack, instrumentsPack].map((record) => ({
  name: record.name,
  version: record.version,
  filename: record.filename,
  bytes: statSync(join(out, record.filename)).size,
  sha256: hashFile(join(out, record.filename)),
  integrity: record.integrity,
}));
const report = {
  schemaVersion: 1,
  status: dirty === "" ? "passed" : "local-preview",
  sourceCommit,
  ...(dirty === "" ? {} : { uncommittedInputs: dirty.split("\n") }),
  version: javascriptPackage.version,
  artifacts,
  catalogManifestSha256: hashFile(join(catalogStage, "manifest.json")),
  instrumentsManifestSha256: hashFile(join(instrumentsStage, "manifest.json")),
  exampleSubpathContract: exampleSmokeContractPath,
  importedExampleSubpaths,
  publicGuideCoverage: {
    exampleDirectories: exampleDirectories.length,
    guidesIncluded: publicGuides,
    directoriesWithoutPublicGuide: exampleDirectories.filter((name) => !publicGuides.includes(`docs/${name}.md`)),
  },
  inputSha256Before: before,
  inputSha256After: after,
  scope: `Packed and offline-installed all three public packages; verified byte inventories, TypeScript declarations, root imports, both manifests, all ${instrumentIds.length} current instrument defaults/source/guide entries, and every frozen public consumer example subpath. No registry publication or target-support claim.`,
};
writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, "SHA256SUMS"), `${artifacts.map((item) => `${item.sha256}  ${item.filename}`).join("\n")}\n`);
console.log(JSON.stringify({ status: report.status, out, sourceCommit, version: report.version, artifacts }, null, 2));
