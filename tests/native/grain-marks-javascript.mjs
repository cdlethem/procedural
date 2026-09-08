#!/usr/bin/env node
/** Compare actual Java and JavaScript composition output before native drawing. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGrainComposition } from "../../packages/javascript/examples/grain-marks/grain-marks.js";

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
  "tests/native/grain-marks-javascript.mjs",
  "packages/javascript/examples/grain-marks/grain-marks.js",
  "packages/javascript/src/quadrant-partition.js", "packages/javascript/src/triangle-points.js",
  "packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java",
  "packages/java/src/main/java/org/procedurals/sampling/TrianglePoints2D.java",
  "packages/java/examples/GrainMarks/GrainComposition.java",
];
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const hashes = () => Object.fromEntries(inputs.map((file) => [file, hash(path.join(root, file))]));
const before = hashes();
fs.mkdirSync(output, { recursive: true });
const probe = `import org.procedurals.examples.grainmarks.GrainComposition;
import org.procedurals.sampling.TrianglePoints2D;
public class GrainParity {
 static void emit(double v){System.out.println(Long.toUnsignedString(Double.doubleToRawLongBits(v),16));}
 public static void main(String[] args){
  GrainComposition[] cases={GrainComposition.create(42,.1,0,false),GrainComposition.create(43,.2,0,false),
   GrainComposition.create(42,.1,1,false),GrainComposition.create(42,.1,2,false),
   GrainComposition.create(42,.1,0,true),GrainComposition.create(43,.1,2,true)};
  double[] p=new double[2];
  for(GrainComposition c:cases){
   System.out.println(c.size());System.out.println(c.totalPoints());
   for(int r=0;r<c.size();r++){TrianglePoints2D points=c.regionAt(r);System.out.println(points.size());
    for(int i=0;i<points.size();i++){points.pointInto(i,p,0);emit(p[0]);emit(p[1]);}
   }
  }
 }
}`;
fs.writeFileSync(path.join(output, "GrainParity.java"), probe);
function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}
run(path.join(javaHome, "bin/javac"), ["--release", "8", "-d", output,
  ...inputs.filter((file) => file.endsWith(".java")), path.join(output, "GrainParity.java")]);
const expected = run(path.join(javaHome, "bin/java"), ["-cp", output, "GrainParity"]);
const buffer = new ArrayBuffer(8), view = new DataView(buffer);
const bits = (value) => { view.setFloat64(0, value); return view.getBigUint64(0).toString(16); };
const lines = [];
const cases = [createGrainComposition(42,.1,0,false),createGrainComposition(43,.2,0,false),
 createGrainComposition(42,.1,1,false),createGrainComposition(42,.1,2,false),
 createGrainComposition(42,.1,0,true),createGrainComposition(43,.1,2,true)];
const point = new Float64Array(2);
for(const c of cases){
 lines.push(String(c.size),String(c.totalPoints));
 for(let r=0;r<c.size;r++){
  const points=c.regionAt(r);lines.push(String(points.size));
  for(let i=0;i<points.size;i++){points.pointInto(i,point);lines.push(bits(point[0]),bits(point[1]));}
 }
}
if (lines.join("\n") + "\n" !== expected) throw new Error("Java/JavaScript composition differs");
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Sources changed during parity check");
const report = {
  status: "passed", scope: "Six actual Java/JavaScript grain composition comparisons; no native render or acceptance claim",
  triangle_counts: cases.map((c) => c.size), comparison: "Region/point counts and every point in raw binary64, including caller Java Random substitutions",
  input_sha256_before: before, input_sha256_after: after,
  java_home: javaHome, java_release_sha256: hash(path.join(javaHome, "release")),
  java_modules_sha256: hash(path.join(javaHome, "lib/modules")),
  node_version: process.version,
};
fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, triangle_counts: report.triangle_counts, output }));
