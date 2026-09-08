#!/usr/bin/env node
/**
 * Assemble the additive CP2 JavaScript 0.2.0 local package and PathMarks starter.
 *
 * This is deliberately separate from the I1 builder: it never writes its artifacts
 * or evidence report.  It installs dependencies and checks imports only; it does not
 * launch a browser or render a canvas.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = join(ROOT, "packages/javascript");
const EXAMPLE = join(PACKAGE, "examples/path-marks");
const OUTPUT_ROOT = join(ROOT, ".work/dist/cp2");
const DEFAULT_OUTPUT = join(OUTPUT_ROOT, "javascript");
const EVIDENCE = join(ROOT, "evidence/distribution/cp2-javascript.json");
const VERSION = "0.2.0";
const NAME = "@procedurals/javascript";
const DRAWING_FILES = ["p5-frame.js", "drawing-state.js", "drawing.js"];
const FIXTURE = join(ROOT, "fixtures/operations/gradient-path.json");
const CORE_CONFORMANCE = join(ROOT, "evidence/conformance/gradient-path.json");
const NATIVE_REVIEW = join(ROOT, "evidence/reproductions/cp2-p5js/review.json");
const NATIVE_REPORT = join(ROOT, "evidence/conformance/p5js-path-marks.json");
const NOTICES = [join(ROOT, "LICENSE"), join(ROOT, "THIRD_PARTY_NOTICES.md")];

function digest(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function digestBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function display(path) { return relative(ROOT, path).split(sep).join("/"); }
function copy(source, target) { mkdirSync(dirname(target), { recursive: true }); cpSync(source, target); }
function write(path, text) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
function files(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
function manifest(root, prefix = root) {
  return files(root).map(path => ({ path: relative(prefix, path).split(sep).join("/"), sha256: digest(path) }));
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stdout}${result.stderr}`);
  return result;
}
function json(stdout, label) {
  const text = stdout.trim();
  if (!text) throw new Error(`Expected JSON from ${label}`);
  return JSON.parse(text);
}
function assertSourceStable(hashes) {
  for (const [path, expected] of Object.entries(hashes)) {
    if (digest(join(ROOT, path)) !== expected) throw new Error(`Source changed during build: ${path}`);
  }
}
function sourceHashes(paths) { return Object.fromEntries(paths.map(path => [display(path), digest(path)])); }
function required(path) {
  if (!existsSync(path)) throw new Error(`Required CP2 distribution input is missing: ${display(path)}`);
  return path;
}
function fixtureVector() {
  const document = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const item = document.cases?.find(value => value.id === "evolving-field");
  if (!item?.input || !item.output || !item.comparison) throw new Error("Missing named gradient-path evolving-field fixture");
  return {
    fixture: display(FIXTURE), catalog_sha256: document.catalog_sha256,
    id: item.id, input: item.input, output: item.output, comparison: item.comparison,
  };
}
function acceptedReviewBinding() {
  const review = JSON.parse(readFileSync(NATIVE_REVIEW, "utf8"));
  if (review.status !== "accepted") throw new Error("CP2 p5js native review is not accepted");
  for (const [path, expected] of Object.entries(review.implementation_sha256 ?? {})) {
    required(join(ROOT, path));
    if (digest(join(ROOT, path)) !== expected) throw new Error(`Accepted native review source drifted: ${path}`);
  }
  for (const [path, expected] of Object.entries(review.evidence_sha256 ?? {})) {
    required(join(ROOT, path));
    if (digest(join(ROOT, path)) !== expected) throw new Error(`Accepted native review evidence drifted: ${path}`);
  }
  return {
    review: { path: display(NATIVE_REVIEW), sha256: digest(NATIVE_REVIEW), status: review.status },
    bound_implementation_sha256: review.implementation_sha256,
    bound_evidence_sha256: review.evidence_sha256,
  };
}
function stagedPackageMetadata() {
  const source = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"));
  if (source.name !== NAME || source.version !== "0.1.0") throw new Error("Unexpected source package metadata for CP2 staging");
  const staged = { ...source, version: VERSION };
  return {
    source, staged,
    transformation: { kind: "staged_package_metadata_version", path: "packages/javascript/package.json", from: source.version, to: VERSION },
  };
}
function packageReadme() {
  return "# Procedurals JavaScript 0.2.0\n\nLocal CP2 artifact containing regular grid, gradient noise, cyclic palette, and gradient path operations. The bundled FieldMarks and PathMarks examples are editable compositions; the p5 drawing adapter is versioned starter code, not a public package API.\n";
}
function starterReadme(tarball) {
  return `# PathMarks browser starter\n\nRun \`npm install\` then \`npm start\`, and open the printed local URL. This installs the adjacent \`${tarball}\` and pinned \`p5@2.3.2\`; it has no Procedurals checkout dependency. Edit \`path-marks.js\` for the retained movement and mark treatment, or \`sketch.js\` for the browser composition.\n`;
}
function starterPackage(tarball) {
  return JSON.stringify({ name: "procedurals-path-marks-starter", private: true, version: VERSION,
    type: "module", scripts: { start: "node server.mjs" }, dependencies: {
      [NAME]: `file:vendor/${tarball}`, p5: "2.3.2" } }, null, 2) + "\n";
}
function starterServer() {
  return `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
const root=resolve('.'); const port=Number.parseInt(process.env.PORT??'8765',10);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be an integer from 0 through 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
function target(value){if(value==='/')return join(root,'index.html');if(value==='/p5.js')return join(root,'node_modules/p5/lib/p5.min.js');if(value.startsWith('/node_modules/@procedurals/javascript/'))return join(root,value.slice(1));if(value.startsWith('/vendor/drawing/'))return join(root,value.slice(1));if(/^\\/[a-z0-9-]+\\.(html|js)$/i.test(value))return join(root,value.slice(1));return null;}
createServer(async(request,response)=>{const path=target(new URL(request.url,'http://localhost').pathname);if(!path||!normalize(path).startsWith(root)){response.writeHead(404);response.end();return;}try{response.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});response.end(await readFile(path));}catch{response.writeHead(404);response.end();}}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({event:'ready',url:'http://127.0.0.1:'+port})));
`;
}
function transformedStarterSources() {
  const index = readFileSync(join(EXAMPLE, "index.html"), "utf8");
  const model = readFileSync(join(EXAMPLE, "path-marks.js"), "utf8");
  const sketch = readFileSync(join(EXAMPLE, "sketch.js"), "utf8");
  const importMap = `<script type="importmap">{"imports":{"${NAME}":"/node_modules/${NAME}/src/index.js","${NAME}/":"/node_modules/${NAME}/"}}</script>`;
  if (index.split("</head>").length !== 2 || model.split('"../../src/index.js"').length !== 2 ||
      sketch.split('"../../src/internal/p5-frame.js"').length !== 2) throw new Error("Unexpected PathMarks import template");
  return {
    originals: { index, model, sketch },
    generated: {
      index: index.replace("</head>", `${importMap}</head>`),
      model: model.replace('"../../src/index.js"', `"${NAME}"`),
      sketch: sketch.replace('"../../src/internal/p5-frame.js"', '"./vendor/drawing/p5-frame.js"'),
    },
    rewrites: {
      "index.html": { inserted: importMap },
      "path-marks.js": { from: "../../src/index.js", to: NAME },
      "sketch.js": { from: "../../src/internal/p5-frame.js", to: "./vendor/drawing/p5-frame.js" },
    },
  };
}
function imports(path) {
  const text = readFileSync(path, "utf8");
  const matcher = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  return [...text.matchAll(matcher)].map(match => match[1]);
}
function staticGraph(starter) {
  const publicEntry = join(starter, "node_modules/@procedurals/javascript/src/index.js");
  const roots = [join(starter, "path-marks.js"), join(starter, "sketch.js"),
    ...DRAWING_FILES.map(name => join(starter, "vendor/drawing", name))];
  const seen = new Set(); const edges = [];
  function visit(path) {
    path = resolve(path);
    if (seen.has(path)) return;
    if (!existsSync(path)) throw new Error(`Static import root is absent: ${path}`);
    seen.add(path);
    for (const specifier of imports(path)) {
      const target = specifier === NAME ? publicEntry : specifier.startsWith(".") ? resolve(dirname(path), specifier) : null;
      if (!target || !existsSync(target)) throw new Error(`Starter static import does not resolve: ${specifier} from ${path}`);
      edges.push({ from: relative(starter, path).split(sep).join("/"), specifier, to: relative(starter, target).split(sep).join("/") });
      visit(target);
    }
  }
  roots.forEach(visit);
  return { roots: roots.map(path => relative(starter, path).split(sep).join("/")), edges };
}
function publicSmoke(vector) {
  return `import { gradientPath2D } from '${NAME}';
import { pathToFileURL } from 'node:url';
function check(ok,message){if(!ok)throw new Error(message);}
function close(actual,expected,tolerance,label){check(typeof actual==='number'&&Math.abs(actual-expected)<=tolerance,label+': '+actual+' != '+expected);}
const vector=${JSON.stringify(vector)};
const path=gradientPath2D(vector.input); const values=path.toValues();
check(path.steps===vector.input.steps,'steps');
for(let i=0;i<vector.output.positions.length;i++){close(values.positions[i][0],vector.output.positions[i][0],vector.comparison.positions_abs,'position x '+i);close(values.positions[i][1],vector.output.positions[i][1],vector.comparison.positions_abs,'position y '+i);}
for(let i=0;i<vector.output.headings.length;i++)close(values.headings[i],vector.output.headings[i],vector.comparison.headings_abs,'heading '+i);
const replay=gradientPath2D(path.serialize()).toValues(); check(JSON.stringify(replay)===JSON.stringify(values),'serialize replay');
const resolved=await import.meta.resolve('${NAME}'); const expected=pathToFileURL(process.argv[2]).href; check(resolved===expected,'package resolved outside starter: '+resolved);
console.log(JSON.stringify({resolved,fixture:vector.fixture,case:vector.id,steps:path.steps}));
`;
}
function starterSmoke() {
  return `import { createPathMarks } from './path-marks.js';
const movement=createPathMarks(42,1,0.4);
if(!Object.isFrozen(movement)||movement.paths.length!==24||movement.paths.some(path=>path.steps!==1))throw new Error('PathMarks module did not load its installed public operation');
console.log(JSON.stringify({paths:movement.paths.length,steps:movement.steps}));
`;
}
function removeNodeModules(starter) {
  rmSync(join(starter, "node_modules"), { recursive: true, force: true });
  if (existsSync(join(starter, "node_modules"))) throw new Error("node_modules remained in starter input");
}

async function main() {
  let output = DEFAULT_OUTPUT;
  let offline = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--output") output = resolve(args[++index] ?? "");
    else if (args[index] === "--offline") offline = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  output = resolve(output);
  if (!(output === OUTPUT_ROOT || output.startsWith(OUTPUT_ROOT + sep))) throw new Error("output must stay under .work/dist/cp2");
  if (existsSync(output)) throw new Error(`Refusing occupied CP2 output destination: ${display(output)}`);
  if (existsSync(EVIDENCE)) throw new Error(`Refusing occupied CP2 evidence destination: ${display(EVIDENCE)}`);

  const metadata = stagedPackageMetadata();
  const vector = fixtureVector();
  const review = acceptedReviewBinding();
  const allInputs = [join(PACKAGE, "package.json"), ...files(join(PACKAGE, "src")), ...files(join(PACKAGE, "examples")),
    FIXTURE, CORE_CONFORMANCE, NATIVE_REVIEW, NATIVE_REPORT, ...NOTICES, fileURLToPath(import.meta.url)].map(required);
  const hashes = sourceHashes(allInputs);
  mkdirSync(output, { recursive: true });
  const build = join(output, "build"); mkdirSync(build);
  const npmCache = join(output, ".npm-cache"); mkdirSync(npmCache);
  const npmEnvironment = { ...process.env, npm_config_cache: npmCache };

  const stagedPackage = join(build, "package");
  cpSync(join(PACKAGE, "src"), join(stagedPackage, "src"), { recursive: true });
  cpSync(join(PACKAGE, "examples"), join(stagedPackage, "examples"), { recursive: true });
  for (const notice of NOTICES) copy(notice, join(stagedPackage, basename(notice)));
  write(join(stagedPackage, "package.json"), JSON.stringify(metadata.staged, null, 2) + "\n");
  write(join(stagedPackage, "README.md"), packageReadme());
  const pack = json(run("npm", ["pack", "--json"], { cwd: stagedPackage, env: npmEnvironment }).stdout, "npm pack")[0];
  if (!pack?.filename) throw new Error("npm pack did not report an artifact filename");
  const tarball = join(output, pack.filename); copy(join(stagedPackage, pack.filename), tarball);
  const unpacked = join(build, "unpacked"); mkdirSync(unpacked);
  run("tar", ["-xzf", tarball, "-C", unpacked]);
  for (const requiredPath of ["package/src/index.js", "package/src/gradient-path.js", "package/examples/field-marks/index.html", "package/examples/path-marks/index.html", "package/LICENSE", "package/THIRD_PARTY_NOTICES.md"]) {
    if (!existsSync(join(unpacked, requiredPath))) throw new Error(`Tarball omitted required file: ${requiredPath}`);
  }

  const starter = join(build, "procedurals-path-marks-browser");
  const source = transformedStarterSources();
  mkdirSync(join(starter, "vendor/drawing"), { recursive: true });
  copy(tarball, join(starter, "vendor", pack.filename));
  write(join(starter, "package.json"), starterPackage(pack.filename));
  write(join(starter, "README.md"), starterReadme(pack.filename));
  write(join(starter, "server.mjs"), starterServer());
  write(join(starter, "index.html"), source.generated.index);
  write(join(starter, "path-marks.js"), source.generated.model);
  write(join(starter, "sketch.js"), source.generated.sketch);
  for (const notice of NOTICES) copy(notice, join(starter, basename(notice)));
  for (const path of [join(starter, "server.mjs"), join(starter, "path-marks.js"), join(starter, "sketch.js")]) run("node", ["--check", path]);
  const joinedStarter = [source.generated.index, source.generated.model, source.generated.sketch].join("\n");
  if (joinedStarter.includes("../../src/") || joinedStarter.includes(ROOT)) throw new Error("Starter retained a checkout import path");
  if (source.generated.index !== source.originals.index.replace("</head>", `${source.rewrites["index.html"].inserted}</head>`) ||
      source.generated.model !== source.originals.model.replace('"../../src/index.js"', `"${NAME}"`) ||
      source.generated.sketch !== source.originals.sketch.replace('"../../src/internal/p5-frame.js"', '"./vendor/drawing/p5-frame.js"')) throw new Error("Starter changed source beyond recorded import rewrites");

  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...(offline ? ["--offline"] : [])], { cwd: starter, env: npmEnvironment });
  const lock = JSON.parse(readFileSync(join(starter, "package-lock.json"), "utf8"));
  const installedPackage = join(starter, "node_modules/@procedurals/javascript");
  const installedEntry = join(installedPackage, "src/index.js");
  if (!lock.packages?.["node_modules/p5"]?.integrity || lock.packages?.["node_modules/@procedurals/javascript"]?.resolved !== `file:vendor/${pack.filename}` || !existsSync(installedEntry)) throw new Error("Installed starter is not pinned to p5 and its local tarball");
  write(join(starter, ".public-smoke.mjs"), publicSmoke(vector));
  const publicResult = json(run("node", [".public-smoke.mjs", installedEntry], { cwd: starter }).stdout, "installed public smoke");
  rmSync(join(starter, ".public-smoke.mjs"));
  write(join(starter, ".starter-smoke.mjs"), starterSmoke());
  const starterResult = json(run("node", [".starter-smoke.mjs"], { cwd: starter }).stdout, "PathMarks starter smoke");
  rmSync(join(starter, ".starter-smoke.mjs"));
  const drawingHashes = {};
  for (const name of DRAWING_FILES) {
    const installed = join(installedPackage, "src/internal", name);
    const rootSource = join(PACKAGE, "src/internal", name);
    const vendor = join(starter, "vendor/drawing", name);
    if (!existsSync(installed)) throw new Error(`Installed tarball omitted internal adapter file: ${name}`);
    copy(installed, vendor);
    if (digest(installed) !== digest(rootSource) || digest(vendor) !== digest(installed)) throw new Error(`Internal adapter copy differs from source or installed tarball: ${name}`);
    drawingHashes[name] = { source: digest(rootSource), installed_tarball: digest(installed), vendor: digest(vendor) };
  }
  const graph = staticGraph(starter);
  removeNodeModules(starter);
  const starterManifest = manifest(starter, build);
  if (starterManifest.some(item => item.path.includes("/node_modules/"))) throw new Error("Starter archive would include node_modules");
  const starterZip = join(output, `procedurals-path-marks-browser-${VERSION}.zip`);
  run("zip", ["-q", "-r", starterZip, basename(starter)], { cwd: build });

  assertSourceStable(hashes);
  const report = {
    status: "passed",
    scope: "CP2 JavaScript 0.2.0 local tarball and installed PathMarks browser starter import checks only; no browser launch, native render, registry publication, or new public adapter claim.",
    package_version: VERSION,
    source_metadata_transformation: metadata.transformation,
    input_sha256: hashes,
    artifacts: {
      npm_tarball: { path: display(tarball), sha256: digest(tarball), entries: manifest(join(unpacked, "package")) },
      browser_starter_zip: { path: display(starterZip), sha256: digest(starterZip), entries: starterManifest },
    },
    installed_consumer: {
      public_gradient_path_fixture: { ...vector, result: publicResult },
      path_marks_module_load: starterResult,
      resolved_public_module: publicResult.resolved,
      expected_public_module: pathToFileURL(installedEntry).href,
      p5_version: "2.3.2",
      package_lock: { path: "procedurals-path-marks-browser/package-lock.json", sha256: digest(join(starter, "package-lock.json")), p5_integrity: lock.packages["node_modules/p5"].integrity, local_resolved: lock.packages["node_modules/@procedurals/javascript"].resolved },
      static_import_graph: graph,
      copied_internal_sha256: drawingHashes,
      starter_rewrites: source.rewrites,
    },
    accepted_native_binding: review,
    core_conformance: { path: display(CORE_CONFORMANCE), sha256: digest(CORE_CONFORMANCE) },
    included_file_manifest: { staged_package: manifest(stagedPackage), starter: starterManifest },
    environment: { node: process.version, npm: run("npm", ["--version"], { env: npmEnvironment }).stdout.trim(), npm_cache: display(npmCache), install_mode: offline ? "offline" : "default-network-enabled" },
  };
  write(join(output, "build-result.json"), JSON.stringify(report, null, 2) + "\n");
  write(EVIDENCE, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ tarball: display(tarball), starter_zip: display(starterZip), evidence: display(EVIDENCE), scope: report.scope }));
}

main().catch(error => { console.error(error?.stack ?? error); process.exitCode = 1; });
