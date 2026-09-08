/** Bounded GrainMarks p5.js browser probe; no support or acceptance claim. */
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, ".work/environments/p5js");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_DIRECTORY");
const output = path.resolve(args[1]);
if (!output.startsWith(path.join(root, ".work") + path.sep)) throw new Error("Output must stay under .work");
await fs.mkdir(output);
const sourceNames = [
  "tools/run_p5_grain_marks.mjs", "tests/native/grain-marks-browser.mjs",
  "packages/javascript/examples/grain-marks/index.html",
  "packages/javascript/examples/grain-marks/sketch.js",
  "packages/javascript/examples/grain-marks/grain-marks.js",
  "packages/javascript/examples/grain-marks/README.md",
  "packages/javascript/src/triangle-points.js", "packages/javascript/src/quadrant-partition.js",
  "catalog/operations/seeded-triangle-points.json", "catalog/operations/triangle-coordinate-map.json",
  "fixtures/operations/seeded-triangle-points.json", "fixtures/operations/triangle-coordinate-map.json",
  "catalog/operations/seeded-quadrant-partition.json", "fixtures/operations/seeded-quadrant-partition.json",
  "design/capabilities/grain-marks-p5-acceptance.md",
  ".work/environments/p5js/package-lock.json", ".work/environments/p5js/node_modules/p5/lib/p5.min.js",
  ".work/environments/p5js/node_modules/playwright/package.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = async () => Object.fromEntries(await Promise.all(sourceNames.map(async (name) =>
  [name, digest(await fs.readFile(path.join(root, name)))])));
const report = { status: "failed", scope: "GrainMarks p5.js browser workflow only; no release or support acceptance", input_sha256_before: await hashes(), states: [], errors: [] };
await fs.writeFile(path.join(output, "attempt.json"), JSON.stringify(report, null, 2));
const allowed = new Set(sourceNames.filter((name) => name.startsWith("packages/") || name === "tests/native/grain-marks-browser.mjs").map((name) => "/" + name));
const server = http.createServer(async (request, response) => {
  try {
    const name = new URL(request.url, "http://localhost").pathname;
    const file = name === "/p5.js" ? path.join(runtime, "node_modules/p5/lib/p5.min.js") : allowed.has(name) ? path.join(root, name.slice(1)) : null;
    if (!file) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", file.endsWith(".html") ? "text/html" : "text/javascript");
    response.end(await fs.readFile(file));
  } catch { response.writeHead(500); response.end(); }
});
let browser;
const timer = setTimeout(() => { console.error("GrainMarks browser deadline exceeded"); process.exit(1); }, 180000);
try {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
  const { chromium } = await import(path.join(runtime, "node_modules/playwright/index.mjs"));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ timeout: 30000 });
  report.browser = browser.version(); report.browser_executable_sha256 = digest(await fs.readFile(chromium.executablePath()));
  const context = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 });
  await context.route("**/*", (route) => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
  await page.goto(origin + "/packages/javascript/examples/grain-marks/index.html");
  await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");
  report.p5 = await page.evaluate(() => window.p5.VERSION);
  if (report.p5 !== "2.3.2" || !report.browser.startsWith("153.")) throw new Error("Unexpected runtime version");
  async function state(id, expected, image = true) {
    const observation = await page.evaluate(async (value) => (await import("/tests/native/grain-marks-browser.mjs")).observe(value), expected);
    const canvas = await page.evaluate(() => { const c = document.querySelector("#art canvas"); return { width: c.width, height: c.height, png: c.toDataURL("image/png") }; });
    if (canvas.width !== 640 || canvas.height !== 640) throw new Error("Canvas dimensions differ");
    const bytes = Buffer.from(canvas.png.split(",")[1], "base64");
    const record = { id, ...observation, width: canvas.width, height: canvas.height, png_sha256: digest(bytes) };
    if (image) { await fs.writeFile(path.join(output, id + ".png"), bytes); record.image = id + ".png"; }
    report.states.push(record); return bytes;
  }
  const click = (key) => page.locator(`button[data-action="${key}"]`).click();
  const press = (key) => page.keyboard.press(key);
  const defaults = { seed: 42, density: 0.1, distribution: 0, strokes: false, alternate: false, cells: false };
  const baseline = await state("baseline", { revision: 1, points: 15680, retained: false, settings: defaults });
  report.baseline_envelope = await page.evaluate(async () => {
    const {composition} = (await import("/packages/javascript/examples/grain-marks/sketch.js")).observeGrainMarks();
    const expected=[Infinity,Infinity,-Infinity,-Infinity], actual=[Infinity,Infinity,-Infinity,-Infinity], p=new Float64Array(2);
    for(let r=0;r<composition.size;r++){const points=composition.regionAt(r);for(let i=0;i<points.size;i++){
      points.pointInto(i,p);expected[0]=Math.min(expected[0],p[0]);expected[1]=Math.min(expected[1],p[1]);expected[2]=Math.max(expected[2],p[0]);expected[3]=Math.max(expected[3],p[1]);
    }}
    const c=document.querySelector("#art canvas"), pixels=c.getContext("2d").getImageData(0,0,640,640).data;
    for(let y=0;y<640;y++)for(let x=0;x<640;x++){const i=4*(y*640+x);
      if(pixels[i]!==243||pixels[i+1]!==240||pixels[i+2]!==232){actual[0]=Math.min(actual[0],x);actual[1]=Math.min(actual[1],y);actual[2]=Math.max(actual[2],x);actual[3]=Math.max(actual[3],y);}
    }
    if(actual.some((value,i)=>!Number.isFinite(value)||Math.abs(value-expected[i])>2))throw new Error("Dot raster envelope differs from retained points");
    return {expected,actual,tolerance_pixels:2};
  });
  await click("m"); const strokes = await state("strokes", { revision: 2, points: 15680, retained: true, settings: { ...defaults, strokes: true } });
  await press("c"); await state("colour", { revision: 3, points: 15680, retained: true, settings: { ...defaults, strokes: true, alternate: true } });
  await click("b"); await state("bias1", { revision: 4, points: 15680, retained: false, settings: { ...defaults, strokes: true, alternate: true, distribution: 1 } });
  await click("b"); await state("bias2", { revision: 5, points: 15680, retained: false, settings: { ...defaults, strokes: true, alternate: true, distribution: 2 } });
  await click("n"); await state("density", { revision: 6, points: 31360, retained: false, settings: { ...defaults, density: 0.2, strokes: true, alternate: true, distribution: 2 } }, false);
  await click("r"); await state("seed", { revision: 7, points: 31360, retained: false, settings: { ...defaults, seed: 43, density: 0.2, strokes: true, alternate: true, distribution: 2 } }, false);
  await click("x"); await state("cells", { revision: 8, points: 81920, retained: false, settings: { ...defaults, seed: 43, density: 0.2, strokes: true, alternate: true, distribution: 2, cells: true } });
  await click("0"); const reset = await state("reset", { revision: 9, points: 15680, retained: false, sameGeometry: true, settings: defaults });
  if (!baseline.equals(reset)) throw new Error("Reset capture differs from baseline");
  if (strokes.equals(baseline)) throw new Error("Stroke edit did not change image");
  const colour = report.states.find((value) => value.id === "colour");
  if (colour.png_sha256 === digest(strokes)) throw new Error("Colour edit did not change image");
  await press("q"); await new Promise((resolve) => setTimeout(resolve, 250));
  const quiet = await state("quiet", { revision: 9, points: 15680, retained: true, settings: defaults }, false);
  if (!quiet.equals(reset)) throw new Error("Ignored key changed canvas");
  const downloadEvent = page.waitForEvent("download"); await click("s"); const download = await downloadEvent; await download.saveAs(path.join(output, "saved.png"));
  const saved = await fs.readFile(path.join(output, "saved.png"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const afterSave = await state("save", { revision: 9, points: 15680, retained: true, settings: defaults }, false);
  if (!saved.equals(Buffer.from(reset)) || !saved.equals(Buffer.from(afterSave))) throw new Error("Saved PNG or post-save display differs from reset");
  report.saved_png_sha256 = digest(saved); report.quiet_delay_ms = 250;
  if (report.errors.length) throw new Error("Browser errors");
  report.input_sha256_after = await hashes(); if (JSON.stringify(report.input_sha256_before) !== JSON.stringify(report.input_sha256_after)) throw new Error("Inputs changed during run");
  report.status = "passed";
} catch (error) { report.failure = String(error.stack ?? error); }
finally { try { if (browser) await browser.close(); } catch (error) { report.cleanup_failure = String(error); report.status = "failed"; } server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); clearTimeout(timer); await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n"); }
console.log(JSON.stringify({ status: report.status, output, failure: report.failure }));
if (report.status !== "passed") process.exitCode = 1;
