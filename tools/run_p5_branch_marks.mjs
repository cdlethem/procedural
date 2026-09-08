/** Bounded BranchMarks p5.js browser probe; no support or acceptance claim. */
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
  "tools/run_p5_branch_marks.mjs", "tests/native/branch-marks-browser.mjs",
  "packages/javascript/examples/branch-marks/index.html",
  "packages/javascript/examples/branch-marks/sketch.js",
  "packages/javascript/examples/branch-marks/branch-marks.js",
  "packages/javascript/examples/branch-marks/README.md",
  "packages/javascript/src/branch-tree.js", "packages/javascript/src/circle-placements.js",
  "catalog/operations/seeded-endpoint-branches.json", "fixtures/operations/seeded-endpoint-branches.json",
  "design/capabilities/branch-marks-p5-acceptance.md",
  ".work/environments/p5js/package-lock.json", ".work/environments/p5js/node_modules/p5/lib/p5.min.js",
  ".work/environments/p5js/node_modules/playwright/package.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = async () => Object.fromEntries(await Promise.all(sourceNames.map(async (name) =>
  [name, digest(await fs.readFile(path.join(root, name)))])));
const report = { status: "failed", scope: "BranchMarks p5.js browser workflow only; no release or support acceptance", input_sha256_before: await hashes(), states: [], errors: [] };
await fs.writeFile(path.join(output, "attempt.json"), JSON.stringify(report, null, 2));
const allowed = new Set(sourceNames.filter((name) => name.startsWith("packages/") || name === "tests/native/branch-marks-browser.mjs").map((name) => "/" + name));
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
const timer = setTimeout(() => { console.error("BranchMarks browser deadline exceeded"); process.exit(1); }, 180000);
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
  await page.goto(origin + "/packages/javascript/examples/branch-marks/index.html");
  await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");
  report.p5 = await page.evaluate(() => window.p5.VERSION);
  if (report.p5 !== "2.3.2" || !report.browser.startsWith("153.")) throw new Error("Unexpected runtime version");
  async function state(id, expected, image = true) {
    const observation = await page.evaluate(async (value) => (await import("/tests/native/branch-marks-browser.mjs")).observe(value), expected);
    const canvas = await page.evaluate(() => { const c = document.querySelector("#art canvas"); return { width: c.width, height: c.height, png: c.toDataURL("image/png") }; });
    if (canvas.width !== 640 || canvas.height !== 640) throw new Error("Canvas dimensions differ");
    const bytes = Buffer.from(canvas.png.split(",")[1], "base64");
    const record = { id, ...observation, width: canvas.width, height: canvas.height, png_sha256: digest(bytes) };
    if (image) { await fs.writeFile(path.join(output, id + ".png"), bytes); record.image = id + ".png"; }
    report.states.push(record); return bytes;
  }
  const click = (key) => page.locator(`button[data-action="${key}"]`).click();
  const press = (key) => page.keyboard.press(key);
  const sequence = [{"id": "initial", "key": null, "revision": 1, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "extended", "key": "n", "revision": 2, "segments": 192, "trees": 1, "tips": 99, "settings": {"seed": 42, "more": true, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": true}, {"id": "extended-restored", "key": "n", "revision": 3, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": true, "prefixPrevious": false}, {"id": "narrowing", "key": "g", "revision": 4, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": true, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "reset-1", "key": "0", "revision": 5, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": true, "prefixPrevious": false}, {"id": "wide", "key": "w", "revision": 6, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": true, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "reset-2", "key": "0", "revision": 7, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": true, "prefixPrevious": false}, {"id": "binary", "key": "b", "revision": 8, "segments": 38, "trees": 1, "tips": 16, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": true, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "reset-3", "key": "0", "revision": 9, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": true, "prefixPrevious": false}, {"id": "recolour", "key": "c", "revision": 10, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": true}, "retained": true, "sameGeometry": false, "prefixPrevious": false}, {"id": "thin", "key": "m", "revision": 11, "segments": 101, "trees": 1, "tips": 0, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": false, "alternate": true}, "retained": true, "sameGeometry": false, "prefixPrevious": false}, {"id": "forest", "key": "x", "revision": 12, "segments": 288, "trees": 7, "tips": 0, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": true, "taper": false, "alternate": true}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "forest-taper", "key": "m", "revision": 13, "segments": 288, "trees": 7, "tips": 145, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": true, "taper": true, "alternate": true}, "retained": true, "sameGeometry": false, "prefixPrevious": false}, {"id": "forest-palette", "key": "c", "revision": 14, "segments": 288, "trees": 7, "tips": 145, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": true, "taper": true, "alternate": false}, "retained": true, "sameGeometry": false, "prefixPrevious": false}, {"id": "forest-extended", "key": "n", "revision": 15, "segments": 560, "trees": 7, "tips": 280, "settings": {"seed": 42, "more": true, "narrowing": false, "binary": false, "wider": false, "forest": true, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": true}, {"id": "forest-seed", "key": "r", "revision": 16, "segments": 634, "trees": 8, "tips": 313, "settings": {"seed": 43, "more": true, "narrowing": false, "binary": false, "wider": false, "forest": true, "taper": true, "alternate": false}, "retained": false, "sameGeometry": false, "prefixPrevious": false}, {"id": "final-reset", "key": "0", "revision": 17, "segments": 101, "trees": 1, "tips": 53, "settings": {"seed": 42, "more": false, "narrowing": false, "binary": false, "wider": false, "forest": false, "taper": true, "alternate": false}, "retained": false, "sameGeometry": true, "prefixPrevious": false}];
  let baseline, reset, previousImage;
  for(const expected of sequence){
    if(expected.key){if(expected.key==='c')await press(expected.key);else await click(expected.key);}
    const bytes=await state(expected.id,expected);
    if(!baseline)baseline=bytes;
    if(expected.sameGeometry&&!baseline.equals(bytes))throw new Error('reset image differs');
    if(previousImage&&previousImage.equals(bytes))throw new Error('edit image unchanged');
    previousImage=bytes;reset=bytes;
  }
  const last=sequence.at(-1);
  await press("q"); await new Promise((resolve) => setTimeout(resolve, 250));
  const quiet = await state("quiet", { ...last, retained: true, sameGeometry: true, prefixPrevious: false }, false);
  if (!quiet.equals(reset)) throw new Error("Ignored key changed canvas");
  const downloadEvent = page.waitForEvent("download"); await click("s"); const download = await downloadEvent; await download.saveAs(path.join(output, "saved.png"));
  const saved = await fs.readFile(path.join(output, "saved.png"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const afterSave = await state("save", { ...last, retained: true, sameGeometry: true, prefixPrevious: false }, false);
  if (!saved.equals(Buffer.from(reset)) || !saved.equals(Buffer.from(afterSave))) throw new Error("Saved PNG or post-save display differs from reset");
  report.saved_png_sha256 = digest(saved); report.quiet_delay_ms = 250;
  if (report.errors.length) throw new Error("Browser errors");
  report.input_sha256_after = await hashes(); if (JSON.stringify(report.input_sha256_before) !== JSON.stringify(report.input_sha256_after)) throw new Error("Inputs changed during run");
  report.status = "passed";
} catch (error) { report.failure = String(error.stack ?? error); }
finally { try { if (browser) await browser.close(); } catch (error) { report.cleanup_failure = String(error); report.status = "failed"; } server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); clearTimeout(timer); await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n"); }
console.log(JSON.stringify({ status: report.status, output, failure: report.failure }));
if (report.status !== "passed") process.exitCode = 1;
