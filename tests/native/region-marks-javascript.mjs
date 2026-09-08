#!/usr/bin/env node
/** Compare actual Java and JavaScript composition output before native drawing. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthoredRegions, createSeededRegions } from "../../packages/javascript/examples/region-marks/region-marks.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--java-home" || args[2] !== "--output") {
  throw new Error("Usage: --java-home PATH --output FRESH_DIRECTORY");
}
const javaHome = path.resolve(args[1]), output = path.resolve(args[3]);
if (!output.startsWith(path.join(root, ".work") + path.sep) || fs.existsSync(output)) {
  throw new Error("Output must be a fresh directory under .work");
}
const inputs = [
  "tests/native/region-marks-javascript.mjs",
  "packages/javascript/examples/region-marks/region-marks.js",
  "packages/javascript/src/quadrant-partition.js", "packages/javascript/src/regular-grid.js",
  "packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java",
  "packages/java/src/main/java/org/procedurals/layout/RegularGrid.java",
  "packages/java/examples/RegionMarks/RegionComposition.java",
];
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const hashes = () => Object.fromEntries(inputs.map((file) => [file, hash(path.join(root, file))]));
const before = hashes();
fs.mkdirSync(output, { recursive: true });
const probe = `import org.procedurals.examples.regionmarks.RegionComposition;
public class RegionParity {
  static void emit(double v) { System.out.println(Long.toUnsignedString(Double.doubleToRawLongBits(v),16)); }
  public static void main(String[] args) {
    RegionComposition[] cases = {RegionComposition.seeded(42,100,.5),
      RegionComposition.seeded(42,100,1),RegionComposition.seeded(42,200,1),
      RegionComposition.seeded(43,200,1),RegionComposition.authored()};
    double[] b = new double[4], p = new double[2];
    for (RegionComposition c : cases) {
      System.out.println(c.size());
      for(int i=0;i<c.size();i++) {
        System.out.println(c.idAt(i)); c.boundsInto(i,b);
        for(double v:b) emit(v);
        for(int j=0;j<9;j++) {c.markInto(j,b,p);emit(p[0]);emit(p[1]);}
      }
    }
  }
}`;
fs.writeFileSync(path.join(output, "RegionParity.java"), probe);
function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}
run(path.join(javaHome, "bin/javac"), ["--release", "8", "-d", output,
  ...inputs.filter((file) => file.endsWith(".java")), path.join(output, "RegionParity.java")]);
const expected = run(path.join(javaHome, "bin/java"), ["-cp", output, "RegionParity"]);
const buffer = new ArrayBuffer(8), view = new DataView(buffer);
const bits = (value) => { view.setFloat64(0, value); return view.getBigUint64(0).toString(16); };
const lines = [];
const cases = [createSeededRegions(42,100,.5), createSeededRegions(42,100,1),
  createSeededRegions(42,200,1), createSeededRegions(43,200,1), createAuthoredRegions()];
const bounds = new Float64Array(4), point = new Float64Array(2);
for (const c of cases) {
  lines.push(String(c.size));
  for (let i = 0; i < c.size; i += 1) {
    lines.push(String(c.idAt(i))); c.boundsInto(i, bounds);
    lines.push(...Array.from(bounds, bits));
    for (let mark = 0; mark < 9; mark += 1) {
      c.markInto(mark, bounds, point); lines.push(bits(point[0]), bits(point[1]));
    }
  }
}
if (lines.join("\n") + "\n" !== expected) throw new Error("Java/JavaScript composition differs");
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Sources changed during parity check");
const report = {
  status: "passed", scope: "Five actual Java/JavaScript composition comparisons; no native render or acceptance claim",
  cell_counts: cases.map((c) => c.size), comparison: "Ordered IDs and raw binary64 bounds plus all nine mark positions per cell",
  input_sha256_before: before, input_sha256_after: after,
  java_home: javaHome, java_release_sha256: hash(path.join(javaHome, "release")),
  java_modules_sha256: hash(path.join(javaHome, "lib/modules")),
  node_version: process.version,
};
fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, cell_counts: report.cell_counts, output }));
