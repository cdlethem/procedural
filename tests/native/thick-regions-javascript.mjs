#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { regionClearance2D } from "../../packages/javascript/src/region-clearance-2d.js";
import { taperedStrokeStrip2D } from "../../packages/javascript/src/tapered-stroke-strip-2d.js";
import { selectTaperedStrokeStrips2D } from "../../packages/javascript/src/select-tapered-stroke-strips-2d.js";
import { hatchRegionLines2D } from "../../packages/javascript/src/hatch-region-lines-2d.js";
import { svgPlotPlan01 } from "../../packages/javascript/src/svg-plot-plan-01.js";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? join(root, "packages/javascript"));
const operations = { "region-clearance-2d": regionClearance2D, "tapered-stroke-strip-2d": taperedStrokeStrip2D, "select-tapered-stroke-strips-2d": selectTaperedStrokeStrips2D, "hatch-region-lines-2d": hatchRegionLines2D, "svg-plot-plan-01": svgPlotPlan01 };
const sha = (value) => createHash("sha256").update(value).digest("hex");
const pathName = (value) => relative(root, value).split(sep).join("/");
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]); }
function error(action, code) { assert.throws(action, (value) => value.code === code); }
async function pure() {
  let cases = 0;
  for (const [name, operation] of Object.entries(operations)) {
    const fixture = JSON.parse(readFileSync(join(root, "fixtures/operations", `${name}.json`)));
    for (const vector of fixture.cases) {
      if (vector.error) error(() => operation(vector.input), vector.error);
      else assert.deepStrictEqual(operation(vector.input), vector.output, vector.id);
      cases += 1;
    }
  }
  const oracle = JSON.parse(readFileSync(join(root, "tests/native/fixtures/region-oracles.json")));
  for (const vector of oracle.region_clearance) {
    const actual = regionClearance2D(vector.input);
    for (const [key, expected] of Object.entries(vector.expected)) {
      if (key === "witnessKind") assert.equal(actual.witness.kind, expected, vector.id);
      else assert.deepStrictEqual(actual[key], expected, vector.id);
    }
    cases += 1;
  }
  for (const vector of oracle.tapered_strip) {
    const actual = taperedStrokeStrip2D(vector.input);
    for (const [key, expected] of Object.entries(vector.expected)) assert.deepStrictEqual(actual[key], expected, vector.id);
    cases += 1;
  }
  for (const vector of oracle.selection) {
    const actual = selectTaperedStrokeStrips2D(vector.input);
    if (vector.expected.acceptedIds) assert.deepStrictEqual(actual.accepted.map((item) => item.id), vector.expected.acceptedIds, vector.id);
    if (vector.expected.rejectedIds) assert.deepStrictEqual(actual.rejected.map((item) => item.id), vector.expected.rejectedIds, vector.id);
    if (vector.expected.rejected) for (let i = 0; i < vector.expected.rejected.length; i += 1) for (const [key, expected] of Object.entries(vector.expected.rejected[i])) {
      if (key === "witness") for (const [field, value] of Object.entries(expected)) assert.deepStrictEqual(actual.rejected[i].witness[field], value, vector.id);
      else assert.deepStrictEqual(actual.rejected[i][key], expected, vector.id);
    }
    cases += 1;
  }
  for (const vector of oracle.hatch) { assert.deepStrictEqual(hatchRegionLines2D(vector.input), vector.expected, vector.id); cases += 1; }
  for (const vector of oracle.svg) { assert.deepStrictEqual(svgPlotPlan01(vector.input), vector.expected, vector.id); cases += 1; }
  for (const vector of oracle.adversarial) {
    const operation = operations[vector.operation];
    if (vector.error) error(() => operation(vector.input), vector.error);
    else assert.deepStrictEqual(operation(vector.input), vector.expected, vector.id);
    cases += 1;
  }
  // Public values are plain detached carriers. The exact rational comparison state stays private.
  const stripInput = oracle.tapered_strip[0].input, first = taperedStrokeStrip2D(stripInput);
  const original = JSON.stringify(stripInput), visible = JSON.stringify(first.visible);
  first.visible.outer[0][0] = 987654;
  assert.equal(JSON.stringify(stripInput), original, "input unchanged after returned geometry edit");
  assert.equal(JSON.stringify(taperedStrokeStrip2D(stripInput).visible), visible, "output detached across calls");
  const regionInput = oracle.region_clearance[0].input, compared = regionClearance2D(regionInput);
  assert.deepStrictEqual(Reflect.ownKeys(compared), ["relation", "minimumDistance", "witness"], "no private rational on query output");
  cases += 1;
  return cases;
}
async function native(pureCases) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
  const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
  const sourceFiles = [...new Set([fileURLToPath(import.meta.url), join(root, "tools/serve_external_expansion_studies.mjs"), join(root, "tests/native/fixtures/region-oracles.json"), ...[join(root, "packages/javascript"), packageRoot].flatMap((base) => [join(base, "src/internal/region-utils.js"), join(base, "src/internal/exact-rational.js"), ...Object.keys(operations).map((name) => join(base, "src", `${name}.js`))]), ...Object.keys(operations).flatMap((name) => [join(root, "catalog/operations", `${name}.json`), join(root, "fixtures/operations", `${name}.json`)]), ...["guarded-bands", "hatched-islands"].flatMap((slug) => files(join(packageRoot, "examples", slug))), join(root, ".work/environments/p5js/node_modules/p5/lib/p5.min.js")])];
  const hashes = () => Object.fromEntries(sourceFiles.map((file) => [pathName(file), sha(readFileSync(file))]));
  const before = hashes();
  const output = process.argv[2] === "--output" ? resolve(process.argv[3]) : null;
  if (output && (!output.startsWith(join(root, ".work") + sep) || existsSync(output))) throw new Error("Output must be fresh under .work");
  const directory = output ? dirname(output) : await mkdtemp(join(root, ".work/thick-regions-native-"));
  mkdirSync(directory, { recursive: true });
  const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
  const report = { status: "running", runtime: "p5 2.3.2 Canvas2D density1", scope: "Two original p5 studies: full retained state and pixels, independent appearance, geometry substitution, reset/reload, saved PNG and parsed SVG. No artist recreation or support acceptance claim.", package_root: packageRoot, input_sha256_before: before, pure_cases: pureCases, studies: [] };
  try {
    browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
    report.browser = browser.version();
    for (const study of [
      { slug: "guarded-bands", global: "guardedBandsStudy", shape: "candidates", first: "w", second: "g" },
      { slug: "hatched-islands", global: "hatchedIslandsStudy", shape: "region", first: "a", second: "d" },
    ]) {
      const out = join(directory, study.slug); mkdirSync(out, { recursive: true });
      const page = await browser.newPage({ viewport: { width: 980, height: 900 }, acceptDownloads: true });
      const errors = []; page.on("pageerror", (value) => errors.push(String(value))); page.on("console", (value) => { if (value.type() === "error") errors.push(value.text()); });
      await page.goto(`${server.baseURL}/examples/${study.slug}/index.html`);
      await page.waitForSelector("#art canvas");
      await page.waitForFunction((key) => document.querySelector("#art")?.dataset.renderStatus === "ready" && Boolean(window[key]?.snapshot), study.global);
      const observe = () => page.evaluate((key) => window[key].snapshot(), study.global);
      async function capture(label) {
        const state = await observe();
        const encoded = await page.locator("#art canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
        const png = Buffer.from(encoded.split(",")[1], "base64");
        const image = join(out, `${label}.png`), stateFile = join(out, `${label}.json`);
        writeFileSync(image, png); writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
        return { label, state, state_sha256: sha(JSON.stringify(state)), png_sha256: sha(png), png_bytes: png.length, png_path: pathName(image), state_path: pathName(stateFile) };
      }
      async function action(key) {
        const revision = Number(await page.locator("#art").getAttribute("data-revision"));
        await page.locator(`button[data-action="${key}"]`).click();
        await page.waitForFunction((old) => Number(document.querySelector("#art")?.dataset.revision) > old, revision);
        return observe();
      }
      const frames = [], baseline = await capture("baseline"); frames.push(baseline);
      await action(study.first); const first = await capture("first-control"); frames.push(first);
      assert.notDeepEqual(first.state.model, baseline.state.model, `${study.slug} first geometry control`);
      await action(study.second); const second = await capture("second-control"); frames.push(second);
      assert.notDeepEqual(second.state.settings, first.state.settings, `${study.slug} second control`);
      assert.notDeepEqual(second.state.model, first.state.model, `${study.slug} second control changes geometry`);
      await action("0"); assert.deepStrictEqual(await observe(), baseline.state, `${study.slug} reset after controls`);
      await action("c"); const appearance = await capture("appearance"); frames.push(appearance);
      assert.deepStrictEqual(appearance.state.model, baseline.state.model, `${study.slug} ink preserves geometry`);
      assert.notEqual(appearance.png_sha256, baseline.png_sha256, `${study.slug} ink changes pixels`);
      await action("0");
      await action("t"); const transfer = await capture("geometry-transfer"); frames.push(transfer);
      assert.notDeepEqual(transfer.state[study.shape], baseline.state[study.shape], `${study.slug} substituted supplied geometry`);
      assert.notDeepEqual(transfer.state.model, baseline.state.model, `${study.slug} retained result responds to substitution`);
      await action("0"); const reset = await capture("reset"); frames.push(reset);
      assert.deepStrictEqual(reset.state, baseline.state, `${study.slug} full reset state`);
      assert.equal(reset.png_sha256, baseline.png_sha256, `${study.slug} exact reset pixels`);
      await page.reload(); await page.waitForSelector("#art canvas");
      await page.waitForFunction((key) => document.querySelector("#art")?.dataset.renderStatus === "ready" && Boolean(window[key]?.snapshot), study.global);
      const reload = await capture("reload"); frames.push(reload);
      assert.deepStrictEqual(reload.state, baseline.state, `${study.slug} reload state`);
      assert.equal(reload.png_sha256, baseline.png_sha256, `${study.slug} reload pixels`);
      const saveState = await observe(), visible = Buffer.from((await page.locator("#art canvas").evaluate((canvas) => canvas.toDataURL("image/png"))).split(",")[1], "base64");
      const download = page.waitForEvent("download"); await page.locator('button[data-action="s"]').click();
      const saved = join(out, "saved.png"); await (await download).saveAs(saved);
      assert.deepStrictEqual(await observe(), saveState, `${study.slug} save does not edit state`);
      assert.equal(sha(readFileSync(saved)), sha(visible), `${study.slug} saved PNG equals displayed canvas`);
      let svg = null;
      if (study.slug === "hatched-islands") {
        const svgDownload = page.waitForEvent("download"); await page.locator('button[data-action="v"]').click();
        const svgFile = join(out, "saved.svg"); await (await svgDownload).saveAs(svgFile);
        const actual = readFileSync(svgFile, "utf8"), expected = svgPlotPlan01({ widthMm: 72, heightMm: 56, paths: saveState.model.paths.map((path) => path.map(([x, y]) => [x / 10, y / 10])), strokeWidthMm: 0.15, maxOutputBytes: 100000 }).svg;
        assert.equal(actual, expected, "downloaded SVG exact core path stream");
        const metadata = await page.evaluate((text) => { const document = new DOMParser().parseFromString(text, "image/svg+xml"); return { error: document.querySelector("parsererror")?.textContent ?? null, paths: document.querySelectorAll("path").length, viewBox: document.documentElement.getAttribute("viewBox") }; }, actual);
        assert.equal(metadata.error, null, "SVG parses"); assert.equal(metadata.paths, saveState.model.paths.length, "one path per pen lift"); assert.equal(metadata.viewBox, "0 0 72 56");
        svg = { path: pathName(svgFile), sha256: sha(actual), paths: metadata.paths };
      }
      assert.deepStrictEqual(errors, [], `${study.slug} browser errors`);
      report.studies.push({ slug: study.slug, frames: frames.map(({ state, ...record }) => record), transfer: study.shape, saved_png: { path: pathName(saved), sha256: sha(readFileSync(saved)), bytes: readFileSync(saved).length }, svg, checks: ["complete state/pixels under geometry controls", "appearance retains complete geometry", "supplied geometry substitution", "exact reset and reload", "saved PNG matches displayed canvas", ...(svg ? ["downloaded SVG parses and equals core path stream"] : [])] });
      await page.close();
    }
    report.input_sha256_after = hashes(); assert.deepStrictEqual(report.input_sha256_after, before, "source stability"); report.status = "passed";
  } catch (error) { report.status = "failed"; report.failure = String(error.stack ?? error); throw error; }
  finally { await browser?.close(); await server.close(); writeFileSync(output ?? join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
  return { directory, output: output ?? join(directory, "report.json"), status: report.status, studies: report.studies.length, pure_cases: report.pure_cases };
}
const pureCases = await pure();
if (process.argv[2] === "--pure") console.log(JSON.stringify({ status: "passed", pure_cases: pureCases }));
else console.log(JSON.stringify(await native(pureCases)));
