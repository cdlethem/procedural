#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { weightedRasterPoints2D } from "../../packages/javascript/src/weighted-raster-points-2d.js";
import { weightedRasterCentroids2D } from "../../packages/javascript/src/weighted-raster-centroids-2d.js";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? join(root, "packages/javascript"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const pathName = (value) => relative(root, value).split(sep).join("/");
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]); }

function pure() {
  const operations = [["weighted-raster-points-2d", weightedRasterPoints2D], ["weighted-raster-centroids-2d", weightedRasterCentroids2D]];
  let cases = 0;
  for (const [name, operation] of operations) {
    const fixture = JSON.parse(readFileSync(join(root, "fixtures/operations", `${name}.json`)));
    for (const vector of fixture.cases) {
      if (vector.error) assert.throws(() => operation(vector.input), (error) => error.code === vector.error, vector.id);
      else assert.deepStrictEqual(operation(vector.input), vector.output, vector.id);
      cases += 1;
    }
  }
  const weights = [1, 3], sites = [[0.5, 0.5]];
  const sampled = weightedRasterPoints2D({ width: 2, height: 1, weights, count: 1, rngState: 42, maxWork: 8 });
  const moved = weightedRasterCentroids2D({ width: 2, height: 1, weights, sites, maxWork: 4 });
  sampled.points[0][0] = 99; sampled.pixelIndices[0] = 99; moved.sites[0][0] = 99; moved.masses[0] = 99;
  assert.deepStrictEqual(weights, [1, 3]); assert.deepStrictEqual(sites, [[0.5, 0.5]]);
  assert.equal(weightedRasterPoints2D({ width: 2, height: 1, weights, count: 1, rngState: 42, maxWork: 8 }).points[0][0], 1.5772811983479187);
  for (const operation of [weightedRasterPoints2D, weightedRasterCentroids2D]) {
    const tail = operation === weightedRasterPoints2D ? { count: 0, rngState: 42 } : { sites: [] };
    const base = { width: 1, height: 1, weights: [0], ...tail, maxWork: 1 };
    assert.throws(() => operation({ ...base, weights: [,] }), (error) => error.code === "INVALID_INPUT", "hole rejected");
    assert.throws(() => operation({ ...base, extra: 1 }), (error) => error.code === "INVALID_INPUT", "extra key rejected");
    const getter = { ...base }; Object.defineProperty(getter, "width", { get() { throw Error("getter read"); }, enumerable: true });
    assert.throws(() => operation(getter), (error) => error.code === "INVALID_INPUT", "accessor rejected without invocation");
  }
  cases += 7;
  return cases;
}

async function native(pureCases) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
  const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
  const sourceFiles = [...new Set([
    fileURLToPath(import.meta.url), join(root, "tools/serve_external_expansion_studies.mjs"),
    ...[join(root, "packages/javascript"), packageRoot].flatMap((base) => ["src/internal/geometry-b-utils.js", "src/internal/exact-rational.js", "src/internal/weighted-raster-utils.js", "src/weighted-raster-points-2d.js", "src/weighted-raster-centroids-2d.js"].map((path) => join(base, path))),
    ...["weighted-raster-points-2d", "weighted-raster-centroids-2d"].flatMap((name) => [join(root, "catalog/operations", `${name}.json`), join(root, "fixtures/operations", `${name}.json`)]),
    ...files(join(packageRoot, "examples/weighted-image-atlas")), join(root, ".work/environments/p5js/node_modules/p5/lib/p5.min.js"),
  ])];
  const hashes = () => Object.fromEntries(sourceFiles.map((file) => [pathName(file), sha(readFileSync(file))]));
  const before = hashes();
  const output = process.argv[2] === "--output" ? resolve(process.argv[3]) : null;
  if (output && (!output.startsWith(join(root, ".work") + sep) || existsSync(output))) throw new Error("Output must be fresh under .work");
  const directory = output ? dirname(output) : await mkdtemp(join(root, ".work/weighted-image-native-"));
  mkdirSync(directory, { recursive: true });
  const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
  const report = { status: "running", scope: "Original p5 image-density study and independent thermal mask transfer; exact pure fixtures, structural/appearance edits, full-state replay, installed package browser imports and observed performance. No external artwork recreation or support acceptance claim.", package_root: packageRoot, runtime: "p5 2.3.2 Canvas2D density1", pure_cases: pureCases, input_sha256_before: before, frames: [], checks: [] };
  try {
    browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, acceptDownloads: true });
    const errors = []; page.on("pageerror", (value) => errors.push(String(value))); page.on("console", (value) => { if (value.type() === "error") errors.push(value.text()); });
    await page.goto(`${server.baseURL}/examples/weighted-image-atlas/index.html`);
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready" && Boolean(window.weightedImageStudy?.snapshot));
    const observe = () => page.evaluate(() => window.weightedImageStudy.snapshot());
    async function capture(label) {
      const state = await observe();
      const encoded = await page.locator("#art canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
      const png = Buffer.from(encoded.split(",")[1], "base64");
      const image = join(directory, `${label}.png`), stateFile = join(directory, `${label}.json`);
      writeFileSync(image, png); writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
      const record = { label, state_sha256: sha(JSON.stringify(state)), png_sha256: sha(png), png_bytes: png.length, png_path: pathName(image), state_path: pathName(stateFile) };
      report.frames.push(record); return { state, ...record };
    }
    async function action(key) {
      const revision = Number(await page.locator("#art").getAttribute("data-revision"));
      await page.locator(`button[data-action="${key}"]`).click();
      await page.waitForFunction((old) => Number(document.querySelector("#art")?.dataset.revision) > old, revision);
    }
    const baseline = await capture("baseline");
    await action("d"); const inverted = await capture("inverted-density");
    assert.deepStrictEqual(inverted.state.tones, baseline.state.tones, "density inversion keeps source input");
    assert.notDeepStrictEqual(inverted.state.model.weights, baseline.state.model.weights, "density weights change");
    assert.notDeepStrictEqual(inverted.state.model.points, baseline.state.model.points, "density changes mark positions");
    const meanTone = ({ state }) => state.model.pixelIndices.reduce((sum, index) => sum + state.tones[index], 0) / state.model.pixelIndices.length;
    assert.ok(meanTone(baseline) > meanTone(inverted) + 0.08, "dark versus light density response");
    await action("0"); await action("n"); const many = await capture("more-marks");
    assert.equal(many.state.model.points.length, 700); assert.equal(baseline.state.model.points.length, 420);
    await action("0"); await action("r"); const relaxed = await capture("weighted-centroids");
    assert.deepStrictEqual(relaxed.state.model.pixelIndices, baseline.state.model.pixelIndices, "same source draws for relaxation");
    assert.notDeepStrictEqual(relaxed.state.model.points, baseline.state.model.points, "weighted step changes positions");
    assert.equal(relaxed.state.model.masses.reduce((sum, mass) => sum + mass, 0), baseline.state.model.weights.reduce((sum, weight) => sum + weight, 0), "all positive mass assigned");
    await action("0"); await action("m"); const stitches = await capture("stitches");
    assert.deepStrictEqual(stitches.state.model, baseline.state.model, "mark treatment preserves geometry");
    assert.notEqual(stitches.png_sha256, baseline.png_sha256, "mark treatment changes pixels");
    await action("0"); await action("i"); const ink = await capture("ochre-ink");
    assert.deepStrictEqual(ink.state.model, baseline.state.model, "ink preserves geometry");
    assert.notEqual(ink.png_sha256, baseline.png_sha256, "ink changes pixels");
    await action("0"); await action("t"); const transfer = await capture("thermal-transfer");
    assert.equal(transfer.state.sourceKind, "thermal");
    assert.notDeepStrictEqual(transfer.state.tones, baseline.state.tones, "independent source image");
    assert.notDeepStrictEqual(transfer.state.model.points, baseline.state.model.points, "transfer changes mark positions");
    await action("0"); const reset = await capture("reset");
    assert.deepStrictEqual(reset.state, baseline.state, "complete reset state");
    assert.equal(reset.png_sha256, baseline.png_sha256, "complete reset pixels");
    await page.reload(); await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready" && Boolean(window.weightedImageStudy?.snapshot));
    const reload = await capture("reload");
    assert.deepStrictEqual(reload.state, baseline.state, "reload state");
    assert.equal(reload.png_sha256, baseline.png_sha256, "reload pixels");
    const saveState = await observe(), visible = Buffer.from((await page.locator("#art canvas").evaluate((canvas) => canvas.toDataURL("image/png"))).split(",")[1], "base64");
    const download = page.waitForEvent("download"); await page.locator('button[data-action="s"]').click();
    const saved = join(directory, "saved.png"); await (await download).saveAs(saved);
    assert.deepStrictEqual(await observe(), saveState, "save preserves state");
    assert.equal(sha(readFileSync(saved)), sha(visible), "saved PNG equals displayed canvas");
    report.saved_png = { path: pathName(saved), sha256: sha(readFileSync(saved)) };
    report.performance = await page.evaluate(async () => {
      const { weightedRasterPoints2D } = await import("/src/weighted-raster-points-2d.js");
      const { weightedRasterCentroids2D } = await import("/src/weighted-raster-centroids-2d.js");
      const cases = [[32, 24, 40], [80, 100, 420], [120, 120, 700]];
      const results = [];
      for (const [width, height, count] of cases) {
        const weights = Array.from({ length: width * height }, (_, index) => 1 + (index * 37) % 1200);
        const sampleInput = { width, height, weights, count, rngState: 42, maxWork: 100000000 };
        const sampled = weightedRasterPoints2D(sampleInput);
        const centroidInput = { width, height, weights, sites: sampled.points, maxWork: 100000000 };
        const times = { sample: [], centroid: [] };
        for (let rep = -1; rep < 3; rep += 1) {
          let start = performance.now(); const a = weightedRasterPoints2D(sampleInput); const sampleMs = performance.now() - start;
          start = performance.now(); const b = weightedRasterCentroids2D(centroidInput); const centroidMs = performance.now() - start;
          if (rep >= 0) { times.sample.push(sampleMs); times.centroid.push(centroidMs); }
          if (a.rngState !== sampled.rngState || b.masses.reduce((sum, mass) => sum + mass, 0) !== weights.reduce((sum, value) => sum + value, 0)) throw Error("benchmark output drift");
        }
        const median = (values) => values.sort((a, b) => a - b)[1];
        results.push({ width, height, count, warmup: 1, repetitions: 3, sample_median_ms: median(times.sample), centroid_median_ms: median(times.centroid), output_checksum: sampled.pixelIndices.reduce((sum, index) => (sum + index) >>> 0, 0), memory_bytes: performance.memory?.usedJSHeapSize ?? null });
      }
      return results;
    });
    assert.deepStrictEqual(errors, [], "browser errors");
    report.checks = ["23 frozen exact fixtures and 7 passive/ownership cases", "density inversion changes sampled tone", "count and one centroid step change structure", "mark and ink edits retain geometry", "independent thermal image transfer", "full reset/reload state and pixels", "downloaded PNG equals displayed canvas", "tiny, study-scale and stress timings in actual browser"];
    await page.close();
    report.input_sha256_after = hashes(); assert.deepStrictEqual(report.input_sha256_after, before, "source stability");
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.failure = String(error.stack ?? error); throw error; }
  finally { await browser?.close(); await server.close(); writeFileSync(output ?? join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
  return { directory, output: output ?? join(directory, "report.json"), status: report.status, pure_cases: report.pure_cases };
}

const pureCases = pure();
if (process.argv[2] === "--pure") console.log(JSON.stringify({ status: "passed", pure_cases: pureCases }));
else console.log(JSON.stringify(await native(pureCases)));
