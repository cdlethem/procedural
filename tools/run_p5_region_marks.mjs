/** Bounded RegionMarks native probe, using the established local p5/Playwright runtime. */
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, ".work/environments/p5js");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_DIRECTORY (run under shared native lock)");
const output = path.resolve(args[1]);
if (!output.startsWith(path.join(root, ".work") + path.sep)) throw new Error("Output must stay under .work");
await fs.mkdir(output); // Fresh leaf required; parent must already exist.
const sourceNames = [
  "tools/run_p5_region_marks.mjs", "tests/native/region-marks-browser.mjs",
  "packages/javascript/examples/region-marks/index.html",
  "packages/javascript/examples/region-marks/sketch.js",
  "packages/javascript/examples/region-marks/region-marks.js",
  "packages/javascript/examples/region-marks/README.md",
  "packages/javascript/src/quadrant-partition.js", "packages/javascript/src/regular-grid.js",
  "catalog/operations/seeded-quadrant-partition.json",
  "fixtures/operations/seeded-quadrant-partition.json",
  "design/capabilities/region-marks-p5-acceptance.md",
  ".work/environments/p5js/package-lock.json",
  ".work/environments/p5js/node_modules/p5/lib/p5.min.js",
  ".work/environments/p5js/node_modules/playwright/package.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = async () => Object.fromEntries(await Promise.all(sourceNames.map(async (name) =>
  [name, digest(await fs.readFile(path.join(root, name)))])));
const report = { status: "failed", scope: "RegionMarks p5.js native workflow only; no release or reproduction acceptance", input_sha256_before: await hashes(), states: [], errors: [] };
await fs.writeFile(path.join(output, "attempt.json"), JSON.stringify(report, null, 2));
const allowed = new Set(sourceNames.filter((name) => name.startsWith("packages/") || name === "tests/native/region-marks-browser.mjs").map((name) => "/" + name));
const server = http.createServer(async (request, response) => {
  try {
    const name = new URL(request.url, "http://localhost").pathname;
    const file = name === "/p5.js" ? path.join(runtime, "node_modules/p5/lib/p5.min.js")
      : allowed.has(name) ? path.join(root, name.slice(1)) : null;
    if (!file) { response.writeHead(404); response.end(); return; }
    const bytes = await fs.readFile(file);
    response.setHeader("Content-Type", file.endsWith(".html") ? "text/html" : "text/javascript");
    response.end(bytes);
  } catch { response.writeHead(500); response.end(); }
});
let browser;
// Outer shared wrapper bounds the whole process and descendants; this timer also
// fails the local attempt rather than silently extending the registered session.
const timer = setTimeout(() => { console.error("RegionMarks native deadline exceeded"); process.exit(1); }, 180000);
try {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
  const { chromium } = await import(path.join(runtime, "node_modules/playwright/index.mjs"));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ timeout: 30000 });
  report.browser = browser.version();
  report.browser_executable_sha256 = digest(await fs.readFile(chromium.executablePath()));
  const context = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 });
  await context.route("**/*", (route) => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
  await page.goto(origin + "/packages/javascript/examples/region-marks/index.html");
  await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");
  report.p5 = await page.evaluate(() => window.p5.VERSION);
  if (report.p5 !== "2.3.2" || !report.browser.startsWith("153.")) throw new Error("Unexpected runtime version");
  async function state(id, expected, image = false) {
    const observation = await page.evaluate(async (expected) =>
      (await import("/tests/native/region-marks-browser.mjs")).observe(expected), expected);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("#art canvas");
      return { width: c.width, height: c.height, png: c.toDataURL("image/png") };
    });
    if (canvas.width !== 640 || canvas.height !== 640) throw new Error("Canvas dimensions differ");
    const bytes = Buffer.from(canvas.png.split(",")[1], "base64");
    const record = { id, ...observation, width: canvas.width, height: canvas.height, png_sha256: digest(bytes) };
    if (image) { await fs.writeFile(path.join(output, id + ".png"), bytes); record.image = id + ".png"; }
    report.states.push(record);
    return bytes;
  }
  const click = (key) => page.locator(`button[data-action="${key}"]`).click();
  await state("baseline", { revision: 1, cells: 301, marks: 301 }, true);
  await click("m"); await state("grid", { revision: 2, cells: 301, marks: 2709, retained: true, settings: { grid: true } }, true);
  await page.keyboard.press("c"); await state("colour", { revision: 3, cells: 301, marks: 2709, retained: true, settings: { alternate: true } }, true);
  await click("g"); await state("layout", { revision: 4, cells: 301, marks: 2709, retained: false, settings: { fraction: 1 } }, true);
  await click("n"); await state("count", { revision: 5, cells: 601, marks: 5409, retained: false, settings: { replacements: 200 } });
  await click("r"); await state("seed", { revision: 6, cells: 601, marks: 5409, retained: false, settings: { seed: 43 } });
  await click("x"); const displayed = await state("authored", { revision: 7, cells: 11, marks: 99, retained: false, settings: { authored: true } }, true);
  for (const key of ["r", "n", "g"]) {
    await click(key);
    const current = await state("ignored-" + key, { revision: 7, cells: 11, marks: 99, retained: true });
    if (!current.equals(displayed)) throw new Error("Ignored control changed canvas");
  }
  const downloadEvent = page.waitForEvent("download");
  await click("s"); const download = await downloadEvent;
  await download.saveAs(path.join(output, "saved.png"));
  const saved = await fs.readFile(path.join(output, "saved.png"));
  const afterSave = await state("save", { revision: 7, cells: 11, marks: 99, retained: true });
  if (!saved.equals(displayed) || !afterSave.equals(displayed)) throw new Error("Save differs from cached canvas");
  report.saved_png_sha256 = digest(saved);
  if (report.states[0].png_sha256 === report.states[1].png_sha256 || report.states[1].png_sha256 === report.states[2].png_sha256) throw new Error("Style edit did not change image");
  if (report.errors.length) throw new Error("Browser errors");
  report.input_sha256_after = await hashes();
  if (JSON.stringify(report.input_sha256_before) !== JSON.stringify(report.input_sha256_after)) throw new Error("Inputs changed during render");
  report.status = "passed";
} catch (error) { report.failure = String(error.stack ?? error); }
finally {
  try { if (browser) await browser.close(); }
  catch (error) { report.status = "failed"; report.cleanup_failure = String(error); }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  clearTimeout(timer);
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ status: report.status, output, failure: report.failure }));
if (report.status !== "passed") process.exitCode = 1;
