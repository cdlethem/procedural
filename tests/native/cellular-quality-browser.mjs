#!/usr/bin/env node
/** Four revised native p5 cellular examples. Run under with_native_render_lock.py. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "../../apps/web/node_modules/esbuild/lib/main.js";
import { cellularInitialCells, cellularState } from "../../packages/javascript/examples/cellular-quality.js";
import { cellularQualitySettings } from "../../packages/javascript/examples/cellular-quality-settings.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(process.argv[2] ?? path.join(root, ".work/cellular-quality-browser"));
assert.ok(out.startsWith(path.join(root, ".work") + path.sep), "output must stay in ignored .work");
await mkdir(out, { recursive: false });
const digest = value => createHash("sha256").update(value).digest("hex");

const webSource = await readFile(path.join(root, "apps/web/lib/adapters/systems-a-quality.ts"), "utf8");
const expectedMirror = "/** Example-private mirror of the four revised web cellular studies; no public core API. */\n" +
  esbuild.transformSync(webSource, { loader: "ts", format: "esm", target: "es2022" }).code
    .replaceAll("../../../../packages/javascript/src/", "../src/");
assert.equal(await readFile(path.join(root, "packages/javascript/examples/cellular-quality.js"), "utf8"), expectedMirror,
  "native composition mirrors the current web source exactly after TS stripping");
const webBundle = await esbuild.build({ entryPoints: [path.join(root, "apps/web/lib/adapters/systems-a.ts")],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { systemsADefinitions } = await import("data:text/javascript;base64," + Buffer.from(webBundle.outputFiles[0].text).toString("base64"));
const webStateBundle = await esbuild.build({ entryPoints: [path.join(root, "apps/web/lib/adapters/systems-a-quality.ts")],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const webState = await import("data:text/javascript;base64," + Buffer.from(webStateBundle.outputFiles[0].text).toString("base64"));
const controlShape = field => [field.key, field.label, field.type, field.min, field.max,
  field.hardMin, field.hardMax, field.step, field.integer || false,
  field.options?.map(option => typeof option === "string" ? option : option.value)];
for (const [slug, settings] of Object.entries(cellularQualitySettings)) {
  const web = systemsADefinitions.find(definition => definition.id === slug);
  assert.deepEqual(settings.defaults, web.defaults, `${slug} defaults match web`);
  assert.deepEqual(settings.controls.map(controlShape), web.parameters.filter(field => !field.hidden).map(controlShape),
    `${slug} visible controls match web`);
  for (const params of [settings.defaults, { ...settings.defaults, source: "disc", sourceX: .21, occupancy: .55 },
    { ...settings.defaults, passes: 0 }, { ...settings.defaults, passes: 24,
      ...(slug.startsWith("reaction-") ? { feed: .05, kill: .07 } : { rule: "seeds", boundary: "DEAD" }) }]) {
    assert.deepEqual(cellularInitialCells(slug, params, 42), webState.cellularInitialCells(slug, params, 42),
      `${slug} initial field parity`);
    assert.deepEqual(cellularState(slug, params, 42), webState.cellularState(slug, params, 42),
      `${slug} evolved state parity`);
  }
}

function pngCornerAlpha(png) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png[25], 6, "PNG retains RGBA color type");
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), kind = png.toString("ascii", offset + 4, offset + 8);
    if (kind === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (kind === "IEND") break;
  }
  return inflateSync(Buffer.concat(chunks))[4];
}

const cases = [
  { slug: "reaction-spots", source: "bands", behavior: ["Feed", ".05"], appearance: ["Cell size", "30"] },
  { slug: "reaction-stripes", source: "disc", behavior: ["Kill", ".08"], appearance: ["Cell size", "30"] },
  { slug: "organic-cells", source: "bands", behavior: ["Rule", "seeds"], appearance: ["Cell size", "36"] },
  { slug: "geometric-generations", source: "speckle", behavior: ["Boundary", "DEAD"], appearance: ["Cell size", "36"] },
];
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relative = pathname === "/p5.js" ? "apps/web/node_modules/p5/lib/p5.min.js" : pathname.slice(1);
    if (!(pathname === "/p5.js" || /^packages\/javascript\/(src|examples)\/[\w./-]+$/.test(relative)) || relative.includes("..")) {
      response.writeHead(404); response.end(); return;
    }
    response.setHeader("Content-Type", relative.endsWith(".html") ? "text/html" : "text/javascript");
    response.end(await readFile(path.join(root, relative)));
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, ".work/toolchains/playwright");
const { chromium } = await import(path.join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const report = { status: "failed", scope: "Four native p5 cellular examples; source/state parity, editable controls, legacy, reset/reload, transparent PNG. Worker visual review only.", cases: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  for (const item of cases) {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1100, height: 1000 } });
    const errors = []; page.on("pageerror", error => errors.push(String(error)));
    const dir = path.join(out, item.slug); await mkdir(dir);
    const image = () => page.locator("canvas").first().evaluate(canvas => canvas.toDataURL("image/png"));
    const revision = () => page.locator("#art").getAttribute("data-revision");
    async function ready() {
      await page.waitForFunction(() => ["ready", "error"].includes(document.querySelector("#art")?.dataset.renderStatus));
      assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready", await page.locator("#status").textContent());
    }
    async function changed(before) {
      await page.waitForFunction(old => Number(document.querySelector("#art")?.dataset.revision) > Number(old), before);
      await ready();
    }
    async function capture(name) {
      const file = path.join(dir, `${name}.png`);
      await page.locator("canvas").first().screenshot({ path: file });
      return { label: name, path: path.relative(root, file), sha256: digest(await readFile(file)) };
    }
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${item.slug}/index.html`);
      await ready();
      const baseline = await image();
      assert.equal(await page.locator("canvas").first().evaluate(canvas => canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]), 0);
      const frames = [await capture("modern-default")];
      const interfacePath = path.join(dir, "native-interface.png"); await page.screenshot({ path: interfacePath, fullPage: true });
      for (const field of cellularQualitySettings[item.slug].controls)
        assert.equal(await page.locator(`[data-param="${field.key}"]`).count(), 1, `${field.key} editable`);
      if (item.slug === "reaction-stripes") {
        assert.deepEqual(await page.locator('[data-param="source"] option').allTextContents(),
          ["disc", "bands", "speckle"], "all ranked stripe source choices are exposed");
        for (const source of ["disc", "speckle"]) {
          const old = await revision();
          await page.locator('[data-param="source"]').selectOption(source); await changed(old);
          assert.notEqual(digest(await image()), digest(baseline), `${source} changes the default stripe drawing`);
          assert.ok(await page.locator("canvas").first().evaluate(canvas => {
            const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
            return false;
          }), `${source} remains visibly nonempty`);
          frames.push(await capture(`source-${source}`));
        }
        const old = await revision();
        await page.locator('[data-param="source"]').selectOption("bands"); await changed(old);
        assert.equal(digest(await image()), digest(baseline), "returning to bands restores the default drawing");
      }
      let before = await revision();
      await page.locator('[data-param="source"]').selectOption(item.source); await changed(before);
      assert.notEqual(digest(await image()), digest(baseline), "source edit changes artwork");
      frames.push(await capture("source-edit"));
      const [behaviorLabel, behaviorValue] = item.behavior; before = await revision();
      const sourceImage = await image();
      const behavior = page.getByLabel(behaviorLabel === "Rule" || behaviorLabel === "Boundary" ? behaviorLabel : `Exact ${behaviorLabel}`, { exact: true });
      if (behaviorLabel === "Rule" || behaviorLabel === "Boundary") await behavior.selectOption(behaviorValue);
      else { await behavior.fill(behaviorValue); await behavior.dispatchEvent("change"); }
      await changed(before); assert.notEqual(digest(await image()), digest(sourceImage), "rule or coefficient edit changes artwork");
      frames.push(await capture("behavior-edit"));
      const [appearanceLabel, appearanceValue] = item.appearance; before = await revision();
      const behaviorImage = await image();
      const appearance = page.getByLabel(`Exact ${appearanceLabel}`, { exact: true });
      await appearance.fill(appearanceValue); await appearance.dispatchEvent("change"); await changed(before);
      assert.equal(await appearance.inputValue(), appearanceValue, "exact value outside slider retained");
      assert.notEqual(digest(await image()), digest(behaviorImage), "mark size edit changes artwork");
      frames.push(await capture("appearance-edit"));
      before = await revision(); await page.locator('button[data-action="c"]').click(); await changed(before);
      frames.push(await capture("palette-edit"));
      before = await revision(); await page.locator('button[data-action="legacy"]').click(); await changed(before);
      assert.equal(await page.locator('button[data-action="legacy"]').getAttribute("aria-pressed"), "true");
      frames.push(await capture("original-composition"));
      before = await revision(); await page.locator('button[data-action="t"]').click(); await changed(before);
      frames.push(await capture("original-variant"));
      before = await revision(); await page.locator('button[data-action="0"]').click(); await changed(before);
      assert.equal(digest(await image()), digest(baseline), "reset exact");
      const saveRevision = await revision(), downloadPromise = page.waitForEvent("download");
      await page.locator('button[data-action="s"]').click();
      const download = await downloadPromise, saved = path.join(dir, "saved-transparent.png"); await download.saveAs(saved);
      assert.equal(pngCornerAlpha(await readFile(saved)), 0, "PNG corner is transparent");
      assert.equal(await revision(), saveRevision, "save does not redraw");
      await page.reload(); await ready(); assert.equal(digest(await image()), digest(baseline), "reload exact");
      assert.deepEqual(errors, []);
      report.cases.push({ slug: item.slug, status: "passed", controls: cellularQualitySettings[item.slug].controls.length,
        interface: path.relative(root, interfacePath), frames, transparentPng: path.relative(root, saved) });
      console.log(`${item.slug}: passed`);
    } catch (error) { report.cases.push({ slug: item.slug, status: "failed", error: String(error), errors }); console.error(`${item.slug}: ${error}`); }
    finally { await page.close(); }
  }
  assert.ok(report.cases.every(item => item.status === "passed"), "all four studies pass");
  report.status = "passed";
} catch (error) { report.failure = String(error); console.error(error); }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
if (report.status !== "passed") process.exitCode = 1;
