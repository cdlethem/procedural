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
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const relativePath = path => relative(root, path).split(sep).join("/");
const files = path => readdirSync(path, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
const sources = [fileURLToPath(import.meta.url), join(root, "tools/serve_external_expansion_studies.mjs"),
  ...["insert-segment-bridge-2d", "relative-neighborhood-pairs-2d", "threshold-edge-relaxation-2d", "radius-pairs-2d"].map(name => join(packageRoot, `src/${name}.js`)),
  join(packageRoot, "src/internal/graph-growth-utils.js"),
  join(packageRoot, "src/internal/exact-rational.js"), join(packageRoot, "src/internal/fdlibm-hypot.js"),
  ...["bridge-web", "neighborhood-growth"].flatMap(name => files(join(packageRoot, `examples/${name}`))),
  join(root, ".work/environments/p5js/node_modules/p5/lib/p5.min.js")];
const sourceHashes = () => Object.fromEntries(sources.map(path => [relativePath(path), hash(readFileSync(path))]));
const percentiles = values => { const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, median_ms: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95_ms: sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0, max_ms: sorted.at(-1) ?? 0 }; };
const before = sourceHashes();
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
const report = { status: "running", packageRoot, runtime: "p5 2.3.2 Canvas2D density1", scope: "Original bridge-web sequence and coupled neighborhood growth: density-filtered insertion, growth toggle, real graph edits, source bindings, pixels, reset/reload/save and bounded browser-step timing. No target acceptance.", input_sha256_before: before, studies: [] };
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  report.browser = browser.version();
  for (const study of [{ slug: "bridge-web", global: "bridgeWeb" }, { slug: "neighborhood-growth", global: "neighborhoodGrowth" }]) {
    const directory = join(dirname(output), study.slug); mkdirSync(directory, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 980, height: 900 }, acceptDownloads: true });
    const errors = [], timings = [];
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${server.baseURL}/examples/${study.slug}/index.html`);
    await page.waitForSelector("#art canvas");
    await page.waitForFunction(key => Boolean(window[key]?.snapshot), study.global);
    const observe = () => page.evaluate(key => window[key].snapshot(), study.global);
    async function action(key) {
      const start = performance.now();
      await page.locator(`button[data-action="${key}"]`).click();
      const state = await observe();
      if (key === '.') timings.push(performance.now() - start);
      return state;
    }
    async function capture(label) {
      const state = await observe();
      const dataUrl = await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"));
      const bytes = Buffer.from(dataUrl.split(",")[1], "base64"), path = join(directory, `${label}.png`);
      writeFileSync(path, bytes);
      writeFileSync(join(directory, `${label}.json`), JSON.stringify(state, null, 2) + "\n");
      return { label, state, png_sha256: hash(bytes), png_path: relativePath(path), png_bytes: bytes.length };
    }
    const frames = [];
    const baseline = await capture("baseline"); frames.push(baseline); assert.equal(baseline.state.tick, 0);
    await action('.'); const early = await capture("early-tick-001"); frames.push(early);
    assert.equal(early.state.tick, 1); assert.notEqual(early.png_sha256, baseline.png_sha256);
    let transfer;
    if (study.slug === "bridge-web") {
      while ((await observe()).tick < 12) await action('.');
      const intermediate = await capture("intermediate-tick-012"); frames.push(intermediate);
      assert.ok(intermediate.state.graph.edges.length > early.state.graph.edges.length + 20);
      await action('r'); const routeEdit = await capture("route-edit-no-tick"); frames.push(routeEdit);
      assert.equal(routeEdit.state.tick, 12); assert.deepEqual(routeEdit.state.graph, intermediate.state.graph);
      assert.notEqual(routeEdit.png_sha256, intermediate.png_sha256, "route preview changes pixels");
      await action('.'); const routeNext = await capture("route-next-tick-013"); frames.push(routeNext);
      assert.equal(routeNext.state.tick, 13); assert.ok(routeNext.state.lastEvents.some(event => event.type === 'link'));
      while ((await observe()).tick < 24) await action('.');
      const mature = await capture("mature-tick-024"); frames.push(mature);
      while ((await observe()).tick < 42) await action('.');
      const final = await capture("full-web-tick-042"); frames.push(final);
      assert.equal(final.state.tick, 42); assert.equal(final.state.edgeKinds.filter(([, kind]) => kind === 'bridge').length, 42);
      assert.notEqual(final.png_sha256, mature.png_sha256, "web keeps accumulating");
      await action('0'); assert.deepEqual(await observe(), baseline.state);
      for (let i = 0; i < 10; i++) await action('.');
      const beforeTransfer = await capture("before-graph-transfer"); frames.push(beforeTransfer);
      const replacement = { nodes: [], edges: [], nextNodeId: 0, nextEdgeId: 0 };
      for (let column = 0; column < 5; column++) {
        const top = replacement.nextNodeId++, bottom = replacement.nextNodeId++;
        replacement.nodes.push({ id: top, point: [100 + column * 100, 65] }, { id: bottom, point: [118 + column * 100, 575] });
        replacement.edges.push({ id: replacement.nextEdgeId++, a: top, b: bottom });
      }
      await page.evaluate(graph => window.bridgeWeb.setGraph(graph), replacement);
      const supplied = await capture("supplied-graph"); frames.push(supplied);
      assert.deepEqual(supplied.state.graph, replacement); assert.equal(supplied.state.tick, 10);
      assert.notEqual(supplied.png_sha256, beforeTransfer.png_sha256);
      await action('.'); const transferred = await capture("transfer-next-tick"); frames.push(transferred);
      assert.equal(transferred.state.tick, 11); assert.ok(transferred.state.lastEvents.some(event => event.type === 'link'));
      transfer = "independent five-strand graph receives a new selected bridge";
    } else {
      assert.ok(early.state.inserted > 0, "growth inserts nodes on the first tick");
      await action('n'); const growthOff = await capture("growth-off"); frames.push(growthOff);
      assert.equal(growthOff.state.growth, false); assert.equal(growthOff.state.tick, 1);
      await action('.'); const frozen = await capture("growth-off-step"); frames.push(frozen);
      assert.equal(frozen.state.tick, 2);
      assert.equal(frozen.state.points.length, early.state.points.length, "growth off freezes the point set");
      assert.notEqual(frozen.png_sha256, growthOff.png_sha256, "relaxation still moves points");
      await action('n'); const growthOn = await capture("growth-on"); frames.push(growthOn);
      assert.equal(growthOn.state.growth, true); assert.equal(growthOn.state.tick, 2);
      await action('g'); const edit = await capture("appearance-edit"); frames.push(edit);
      assert.equal(edit.state.tick, 2); assert.notEqual(edit.png_sha256, growthOn.png_sha256);
      const pairs = Array.from({ length: edit.state.points.length - 1 }, (_, i) => [i, i + 1]);
      await page.evaluate(value => window.neighborhoodGrowth.setPairs(value), pairs);
      const supplied = await capture("supplied-graph"); frames.push(supplied);
      assert.deepEqual(supplied.state.pairs, pairs); assert.deepEqual(supplied.state.points, edit.state.points);
      await action('.'); const transferred = await capture("transfer-next-tick"); frames.push(transferred);
      assert.equal(transferred.state.tick, 3); assert.notEqual(transferred.png_sha256, supplied.png_sha256);
      transfer = "coupled density-filtered insertion and relaxation; independent ordered pair graph changes one relaxation";
    }
    await action('0'); const reset = await capture("reset"); frames.push(reset);
    assert.deepEqual(reset.state, baseline.state); assert.equal(reset.png_sha256, baseline.png_sha256);
    await page.reload(); await page.waitForSelector("#art canvas");
    await page.waitForFunction(key => Boolean(window[key]?.snapshot), study.global);
    const reload = await capture("reload"); frames.push(reload);
    assert.deepEqual(reload.state, baseline.state); assert.equal(reload.png_sha256, baseline.png_sha256);
    const beforeSave = await observe();
    const visible = Buffer.from((await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"))).split(",")[1], "base64");
    const downloadPromise = page.waitForEvent("download"); await page.locator('button[data-action="s"]').click();
    const saved = join(directory, "saved.png"); await (await downloadPromise).saveAs(saved);
    assert.deepEqual(await observe(), beforeSave); assert.equal(hash(readFileSync(saved)), hash(visible));
    assert.deepEqual(errors, [], "browser errors");
    report.studies.push({ slug: study.slug, transfer, step_wall_time: percentiles(timings),
      frames: frames.map(({ state, ...frame }) => ({ ...frame, state_sha256: hash(JSON.stringify(state)), tick: state.tick,
        nodes: state.graph?.nodes.length, edges: state.graph?.edges.length })), saved_png_sha256: hash(readFileSync(saved)) });
    await page.close();
  }
  report.input_sha256_after = sourceHashes(); assert.deepEqual(report.input_sha256_after, before);
  report.status = "passed";
} catch (failure) { report.status = "failed"; report.failure = String(failure.stack ?? failure); throw failure; }
finally { await browser?.close(); await server.close(); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify({ status: report.status, output, studies: report.studies.length }));
