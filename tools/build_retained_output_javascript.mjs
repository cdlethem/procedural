#!/usr/bin/env node
/** CP6.1 retained-output package/starter build gate.
 *
 * This intentionally separates the reviewed input gate from archive creation. The
 * historical CP5/CP6 builders remain immutable. Exact checked adaptations reuse
 * their archive and installed-consumer workflows under a fresh output directory.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = join(ROOT, "packages/javascript");
const VERSION = "0.6.1";
const NAME = "@procedurals/javascript";
const SUCCESSOR = "evidence/conformance/javascript-retained-output-export-successor.json";
const ROOT_REVIEW = "evidence/conformance/javascript-retained-output-root-review.json";
const SOURCE_FILES = [
  "index.js", "regular-grid.js", "gradient-noise-2d-01.js", "cyclic-palette.js",
  "gradient-path.js", "circle-placements.js", "quadrant-partition.js",
  "triangle-points.js", "branch-tree.js",
  "internal/noise-hash.js", "internal/drawing.js", "internal/drawing-state.js", "internal/p5-frame.js",
];
const EXAMPLES = ["field-marks", "path-marks", "placement-marks", "region-marks", "grain-marks", "branch-marks"];

function sha(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function required(path) { if (!existsSync(path)) throw new Error(`Missing retained-output build input: ${path}`); return path; }
function review(path) {
  const record = JSON.parse(readFileSync(required(join(ROOT, path))));
  if (record.status !== "accepted" || record.owner !== "root" || record.reviewer !== "root") throw new Error(`Review is not root accepted: ${path}`);
  for (const section of ["implementation_sha256", "evidence_sha256"]) {
    if (!record[section] || typeof record[section] !== "object") throw new Error(`Missing ${section}: ${path}`);
    for (const [bound, expected] of Object.entries(record[section])) if (sha(required(join(ROOT, bound))) !== expected) throw new Error(`Review binding changed: ${bound}`);
  }
  return record;
}
function check() {
  const successor = review(SUCCESSOR), rootReview = review(ROOT_REVIEW);
  if (successor.previous_review_sha256 !== sha(join(ROOT, ROOT_REVIEW))) throw new Error("Retained-output successor predecessor mismatch");
  if (!Object.keys(successor.implementation_sha256).includes("tools/reviewed_export_extension.py")) throw new Error("Successor omits export bridge");
  const source = JSON.parse(readFileSync(join(PACKAGE, "package.json")));
  if (source.name !== NAME || source.version !== "0.1.0") throw new Error("Unexpected source package metadata");
  for (const file of SOURCE_FILES) required(join(PACKAGE, "src", file));
  for (const example of EXAMPLES) required(join(PACKAGE, "examples", example));
  const exported = readFileSync(join(PACKAGE, "src/index.js"), "utf8");
  for (const name of ["regularGrid", "gradientNoise2D01", "gradientPath2D", "seededEndpointBranches2D", "seededTrianglePoints2D"]) if (!exported.includes(name)) throw new Error(`Missing retained export: ${name}`);
  return { status: "passed", mode: "no-op-check", package_version: VERSION, successor: SUCCESSOR, root_review: ROOT_REVIEW, source_files: SOURCE_FILES, examples: EXAMPLES, root_review_bindings: Object.keys(rootReview.implementation_sha256).length };
}
function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 600000 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error ?? ""}\n${result.stdout}${result.stderr}`);
  return result.stdout;
}
function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return files(path);
    if (!entry.isFile()) throw new Error(`Unsupported source entry: ${path}`);
    return [path];
  }).sort();
}
function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Historical builder shape changed: ${before}`);
  return text.replace(before, after);
}
function stagedScript(original, version, outputRoot, kind) {
  let text = readFileSync(original, "utf8");
  text = replaceOnce(text, 'ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..")', `ROOT=${JSON.stringify(ROOT)}`);
  text = replaceOnce(text, `VERSION="${kind === "branch" ? "0.6.0" : "0.5.0"}"`, `VERSION="${version}"`);
  text = replaceOnce(text, `OUTPUT_ROOT=join(ROOT,".work/dist/${kind === "branch" ? "cp6" : "cp5"}")`, `OUTPUT_ROOT=${JSON.stringify(outputRoot)}`);
  text = replaceOnce(text, 'cpSync(join(PACKAGE,"src"),join(staged,"src"),{recursive:true});',
    `for(const file of ${JSON.stringify(SOURCE_FILES)})copy(join(PACKAGE,"src",file),join(staged,"src",file));`);
  text = replaceOnce(text, 'cpSync(join(PACKAGE,"examples"),join(staged,"examples"),{recursive:true});',
    `for(const example of ${JSON.stringify(EXAMPLES)}){mkdirSync(join(staged,"examples",example),{recursive:true});cpSync(join(PACKAGE,"examples",example),join(staged,"examples",example),{recursive:true});}`);
  if (kind === "branch") {
    text = replaceOnce(text, '["evidence/conformance/branch-export-compatibility-review.json","evidence/conformance/branch-tree-javascript-root-review.json","evidence/conformance/branch-p5js-native-root-review.json"].map(reviewBinding)',
      `${JSON.stringify([SUCCESSOR, ROOT_REVIEW])}.map(reviewBinding)`);
  }
  text = text.replace(kind === "branch" ? 'CP6 JavaScript 0.6.0 local' : 'CP5 JavaScript 0.5.0 local', `Retained-output JavaScript ${version} local`);
  return text;
}
function build(output) {
  check();
  if (!output.startsWith(join(ROOT, ".work/dist") + sep) || existsSync(output)) throw new Error("Build output must be fresh under .work/dist");
  const templates = ["tools/build_branch_marks_javascript.mjs", "tools/build_grain_marks_javascript.mjs"];
  const bound = [...SOURCE_FILES.map(name => join(PACKAGE,"src",name)), ...EXAMPLES.flatMap(name => files(join(PACKAGE,"examples",name))),
    ...templates.map(name => join(ROOT,name)), fileURLToPath(import.meta.url), join(PACKAGE,"package.json"),
    ...["LICENSE","THIRD_PARTY_NOTICES.md",SUCCESSOR,ROOT_REVIEW].map(name => join(ROOT,name))];
  const bindings = () => Object.fromEntries(bound.map(path => [relative(ROOT,path),sha(path)]));
  const before = bindings();
  mkdirSync(output, { recursive: true });
  const work = join(output,"builders"); mkdirSync(work);
  const report = { status:"failed", scope:"Corrected retained JavaScript packages and extracted BranchMarks/GrainMarks consumers; no native rendering or registry release.", input_sha256_before:before, builds:{} };
  try {
    for (const [kind,version,template] of [["branch","0.6.1",templates[0]],["grain","0.5.1",templates[1]]]) {
      const tool = join(work,kind+".mjs"), destination = join(output,kind);
      writeFileSync(tool,stagedScript(join(ROOT,template),version,output,kind));
      run("node",["--check",tool]);
      run("node",[tool,"--output",destination]);
      const result = join(destination,"build-result.json");
      const raw = JSON.parse(readFileSync(result));
      if (raw.status !== "passed") throw new Error(`Failed ${kind} package workflow`);
      report.builds[kind] = { path:relative(ROOT,result),sha256:sha(result),template,template_sha256:sha(join(ROOT,template)),adapted_builder:relative(ROOT,tool),adapted_builder_sha256:sha(tool),package_version:version };
    }
    check(); report.input_sha256_after=bindings();
    if (JSON.stringify(before)!==JSON.stringify(report.input_sha256_after)) throw new Error("Inputs changed during build");
    report.status="passed";
  } catch (error) { report.failure=String(error.stack ?? error); throw error; }
  finally { writeFileSync(join(output,"result.json"),JSON.stringify(report,null,2)+"\n"); }
  return report;
}
const args = process.argv.slice(2);
if (args.length===0 || (args.length===1 && args[0]==="--check")) console.log(JSON.stringify(check()));
else if (args.length===3 && args[0]==="--build" && args[1]==="--output") console.log(JSON.stringify(build(resolve(args[2]))));
else throw new Error("Usage: --check | --build --output FRESH_DIRECTORY");
