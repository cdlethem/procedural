#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? join(root, "packages/javascript"));
const output = resolve(process.argv[2] ?? "");
if (!output.startsWith(join(root, ".work") + sep) || existsSync(output)) throw Error("Fresh .work output required");
const directory = dirname(output); mkdirSync(directory, { recursive: true });
const sha = value => createHash("sha256").update(value).digest("hex");
const relativePath = path => relative(root, path).split(sep).join("/");
const files = path => readdirSync(path, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
const sources = [fileURLToPath(import.meta.url), join(root, "tools/serve_external_expansion_studies.mjs"),
  join(packageRoot, "src/elastic-curve-grow-step-2d.js"),
  join(packageRoot, "src/internal/elastic-growth-utils.js"),
  join(packageRoot, "src/internal/graph-growth-utils.js"),
  join(packageRoot, "src/internal/exact-rational.js"),
  join(packageRoot, "src/internal/fdlibm-hypot.js"),
  join(packageRoot, "src/fdlibm-trig.js"),
  ...files(join(packageRoot, "examples/elastic-loops")),
  join(root, ".work/environments/p5js/node_modules/p5/lib/p5.min.js")];
const sourceHashes = () => Object.fromEntries(sources.map(path => [relativePath(path), sha(readFileSync(path))]));
const timingSummary = values => { const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, median_ms: sorted[Math.floor(sorted.length / 2)],
    p95_ms: sorted[Math.floor((sorted.length - 1) * 0.95)], max_ms: sorted.at(-1) }; };
const before = sourceHashes();
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
const report = { status: "running", packageRoot, runtime: "p5 2.3.2 Canvas2D density1", scope: "Original three-strand open-curve composition through tick36, controlled curl branch, structure edit, independent acceleration transfer, source stability and reset/reload/save. Browser step timing includes click and redraw; no target acceptance.", input_sha256_before: before, frames: [] };
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 980, height: 900 }, acceptDownloads: true });
  const errors = [], timings = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${server.baseURL}/examples/elastic-loops/index.html`);
  await page.waitForSelector("#art canvas");
  await page.waitForFunction(() => Boolean(window.elasticLoops?.snapshot));
  const observe = () => page.evaluate(() => window.elasticLoops.snapshot());
  async function action(key) {
    const start = performance.now();
    await page.locator(`button[data-action="${key}"]`).click();
    const state = await observe();
    if (key === '.') timings.push(performance.now() - start);
    return state;
  }
  async function advanceTo(tick) { while ((await observe()).tick < tick) await action('.'); }
  async function capture(label) {
    const state = await observe();
    const dataUrl = await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"));
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64"), path = join(directory, `${label}.png`);
    writeFileSync(path, bytes); writeFileSync(join(directory, `${label}.json`), JSON.stringify(state, null, 2) + "\n");
    const frame = { label, tick: state.tick, nodes: state.state.nodes.length,
      edges: state.state.curves.reduce((sum, curve) => sum + curve.edgeIds.length, 0),
      state_sha256: sha(JSON.stringify(state)), png_sha256: sha(bytes), png_path: relativePath(path), png_bytes: bytes.length };
    report.frames.push(frame); return { frame, state };
  }
  const baseline = await capture("baseline"); assert.equal(baseline.state.tick, 0);
  await action('.'); const early = await capture("early-tick-001");
  assert.equal(early.state.tick, 1); assert.ok(early.frame.nodes > baseline.frame.nodes, "first step refines material edges");
  assert.notEqual(early.frame.png_sha256, baseline.frame.png_sha256);
  await advanceTo(12); const intermediate = await capture("intermediate-tick-012");
  assert.ok(intermediate.frame.nodes >= early.frame.nodes);
  await action('.'); const uneditedNext = await capture("unedited-tick-013");
  await advanceTo(24); const mature = await capture("mature-tick-024");
  await advanceTo(36); const late = await capture("folded-tick-036");
  assert.equal(late.state.tick, 36); assert.ok(late.frame.nodes > intermediate.frame.nodes);
  assert.notEqual(late.frame.png_sha256, mature.frame.png_sha256, "late frame folds visibly");
  await action('0'); assert.deepEqual(await observe(), baseline.state);
  await advanceTo(12); assert.deepEqual(await observe(), intermediate.state, "deterministic replay to branch point");
  await action('g'); const curlEdit = await capture("reverse-curl-no-tick");
  assert.deepEqual(curlEdit.state.state, intermediate.state.state, "curl edit preserves current material");
  assert.equal(curlEdit.state.tick, 12); assert.notEqual(curlEdit.state.reverseCurl, intermediate.state.reverseCurl);
  await action('.'); const editedNext = await capture("reverse-curl-tick-013");
  assert.notDeepEqual(editedNext.state.state, uneditedNext.state.state, "curl input changes next material state");
  assert.notEqual(editedNext.frame.png_sha256, uneditedNext.frame.png_sha256, "curl input changes visible geometry");
  await action('m'); const structure = await capture("structure-edit-no-tick");
  assert.equal(structure.state.tick, 13); assert.notEqual(structure.frame.png_sha256, editedNext.frame.png_sha256);
  await page.evaluate(() => window.elasticLoops.setWind([2, -1]));
  const supplied = await capture("supplied-acceleration");
  assert.deepEqual(supplied.state.state, structure.state.state, "wind transfer preserves current material");
  assert.deepEqual(supplied.state.wind, [2, -1]);
  await advanceTo(19); const transferred = await capture("wind-transfer-tick-019");
  assert.equal(transferred.state.tick, 19); assert.notEqual(transferred.frame.png_sha256, supplied.frame.png_sha256);
  await action('0'); const reset = await capture("reset");
  assert.deepEqual(reset.state, baseline.state); assert.equal(reset.frame.png_sha256, baseline.frame.png_sha256);
  await page.reload(); await page.waitForSelector("#art canvas");
  await page.waitForFunction(() => Boolean(window.elasticLoops?.snapshot));
  const reload = await capture("reload");
  assert.deepEqual(reload.state, baseline.state); assert.equal(reload.frame.png_sha256, baseline.frame.png_sha256);
  const beforeSave = await observe();
  const visible = Buffer.from((await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"))).split(",")[1], "base64");
  const downloadPromise = page.waitForEvent("download"); await page.locator('button[data-action="s"]').click();
  const saved = join(directory, "saved.png"); await (await downloadPromise).saveAs(saved);
  assert.deepEqual(await observe(), beforeSave); assert.equal(sha(readFileSync(saved)), sha(visible));
  assert.deepEqual(errors, [], "browser errors");
  report.step_wall_time = timingSummary(timings);
  report.saved_png_sha256 = sha(readFileSync(saved));
  report.input_sha256_after = sourceHashes(); assert.deepEqual(report.input_sha256_after, before);
  report.status = "passed"; await page.close();
} catch (failure) { report.status = "failed"; report.failure = String(failure.stack ?? failure); throw failure; }
finally { await browser?.close(); await server.close(); writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify({ status: report.status, output, frames: report.frames.length }));
