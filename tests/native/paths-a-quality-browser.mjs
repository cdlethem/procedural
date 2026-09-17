#!/usr/bin/env node
/** Focused real-p5 review for the five revised path studies. Run under the native render lease. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "../../apps/web/node_modules/esbuild/lib/main.js";
import { pathStudyConfigs } from "../../packages/javascript/examples/paths-a-quality-controls.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(process.argv[2] ?? path.join(root, ".work/paths-a-quality-browser"));
assert.ok(out.startsWith(path.join(root, ".work") + path.sep), "output must stay in ignored .work");
await mkdir(out, { recursive: false });

// The native composition mirror must have exactly the current web drawing semantics.
const webSource = await readFile(path.join(root, "apps/web/lib/adapters/paths-a-quality.ts"), "utf8");
const expectedMirror = "/** Example-private mirror of the web path-study composition. Keep construction semantics in parity. */\n" +
  esbuild.transformSync(webSource, { loader: "ts", format: "esm", target: "es2022" }).code
    .replaceAll("../../../../packages/javascript/src/", "../src/");
assert.equal(await readFile(path.join(root, "packages/javascript/examples/paths-a-quality.js"), "utf8"), expectedMirror,
  "native composition must match the reviewed web adapter after TS-only stripping");
const webBundle = await esbuild.build({ entryPoints: [path.join(root, "apps/web/lib/adapters/paths-a.ts")],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { pathsADefinitions } = await import("data:text/javascript;base64," + Buffer.from(webBundle.outputFiles[0].text).toString("base64"));
const controlShape = field => [field.key, field.label, field.type === "boolean" ? "check" : field.type,
  field.min, field.max, field.hardMin, field.hardMax, field.step, field.integer || false,
  field.options?.map(option => typeof option === "string" ? option : option.value)];
for (const [slug, config] of Object.entries(pathStudyConfigs)) {
  const web = pathsADefinitions.find(definition => definition.id === slug);
  assert.deepEqual(config.defaults, web.defaults, `${slug} defaults match web`);
  assert.deepEqual(config.controls.map(controlShape), web.parameters.filter(field => !field.hidden).map(controlShape),
    `${slug} visible control semantics match web`);
}

const cases = [
  { slug: "rounded-panels", construction: ["panels", "9"], exact: ["Panel radius", "160"], mark: ["treatment", "outline"] },
  { slug: "road-margins", construction: ["turns", "5"], exact: ["Bend amplitude", "190"], mark: ["showNodes", true] },
  { slug: "nested-contour-strokes", construction: ["sides", "10"], exact: ["Signed ring gap", "-65"], mark: ["marks", "dots"] },
  { slug: "faceted-silhouettes", construction: ["kind", "notched"], exact: ["Boundary radius", "350"], mark: ["hatchMode", "dots"] },
  { slug: "concave-grain", construction: ["kind", "convex"], exact: ["Boundary radius", "350"], mark: ["hatchMode", "none"] },
];
const digest = value => createHash("sha256").update(value).digest("hex");
function firstPixelAlpha(png) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
  assert.equal(png[25], 6, "saved PNG retains RGBA color type");
  const compressed = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), kind = png.toString("ascii", offset + 4, offset + 8);
    if (kind === "IDAT") compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (kind === "IEND") break;
  }
  const scanlines = inflateSync(Buffer.concat(compressed));
  return scanlines[4]; // filter byte, then first RGBA pixel; no left/up neighbors at 0,0
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost"), pathname = url.pathname;
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
const report = { status: "failed", scope: "Five native p5 example interfaces only; modern construction, mark edits, exact entry, legacy, reset/reload, transparent PNG. No acceptance claim.", cases: [] };
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
      await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready" || document.querySelector("#art")?.dataset.renderStatus === "error");
      assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready", await page.locator("#status").textContent());
    }
    async function changed(before) {
      await page.waitForFunction(old => Number(document.querySelector("#art")?.dataset.revision) > Number(old), before);
      await ready();
    }
    async function capture(name) {
      const file = path.join(dir, `${name}.png`);
      await page.locator("canvas").first().screenshot({ path: file });
      return { path: path.relative(root, file), sha256: digest(await readFile(file)) };
    }
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${item.slug}/index.html`);
      await ready();
      const baseline = await image();
      const alpha = await page.locator("canvas").first().evaluate(canvas => canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]);
      assert.equal(alpha, 0, "canvas background is transparent");
      const frames = [await capture("modern-default")];
      const interfacePath = path.join(dir, "native-interface.png");
      await page.screenshot({ path: interfacePath, fullPage: true });
      const controls = pathStudyConfigs[item.slug].controls.map(control => control.key);
      for (const key of controls) assert.ok(await page.locator(`[data-param="${key}"]`).count(), `${key} is editable`);
      const [constructionKey, constructionValue] = item.construction;
      let before = await revision();
      const constructionControl = page.locator(`[data-param="${constructionKey}"]`);
      if (await constructionControl.getAttribute("type") === "number") { await constructionControl.fill(constructionValue); await constructionControl.dispatchEvent("change"); }
      else await constructionControl.selectOption(constructionValue);
      await changed(before); const construction = await image();
      assert.notEqual(digest(construction), digest(baseline), "construction edit changes artwork");
      frames.push(await capture("construction-edit"));
      before = await revision();
      const [exactLabel, exactValue] = item.exact;
      const exact = page.getByLabel(`Exact ${exactLabel}`, { exact: true });
      await exact.fill(exactValue); await exact.dispatchEvent("change"); await changed(before);
      assert.equal(await exact.inputValue(), exactValue, "exact value outside slider interval remains entered");
      const [markKey, markValue] = item.mark; before = await revision();
      const mark = page.locator(`[data-param="${markKey}"]`);
      if (typeof markValue === "boolean") await mark.setChecked(markValue);
      else await mark.selectOption(markValue);
      await changed(before); frames.push(await capture("mark-edit"));
      if (item.slug === "rounded-panels") {
        const lastGood = await image(), cuts = page.getByLabel("Exact Corner cuts", { exact: true });
        await cuts.fill("16"); await cuts.dispatchEvent("change");
        await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "error");
        assert.match(await page.locator("#status").textContent(), /budget exceeded/);
        assert.equal(await image(), lastGood, "over-budget edit retains the last successful image");
        before = await revision(); await cuts.fill("2"); await cuts.dispatchEvent("change"); await changed(before);
        assert.equal(await image(), lastGood, "recovering from budget error restores the same composition");
      }
      before = await revision(); await page.locator('button[data-action="c"]').click(); await changed(before);
      frames.push(await capture("palette-edit"));
      before = await revision(); await page.locator('button[data-action="legacy"]').click(); await changed(before);
      assert.equal(await page.locator('button[data-action="legacy"]').getAttribute("aria-pressed"), "true");
      frames.push(await capture("original-composition"));
      before = await revision(); await page.locator('button[data-action="t"]').click(); await changed(before);
      frames.push(await capture("original-variant"));
      before = await revision(); await page.locator('button[data-action="0"]').click(); await changed(before);
      assert.equal(digest(await image()), digest(baseline), "reset restores modern default pixels");
      const saveRevision = await revision(), downloadPromise = page.waitForEvent("download");
      await page.locator('button[data-action="s"]').click();
      const download = await downloadPromise, saved = path.join(dir, "saved-transparent.png"); await download.saveAs(saved);
      assert.equal(firstPixelAlpha(await readFile(saved)), 0, "download retains transparent corner pixel");
      assert.equal(await revision(), saveRevision, "save does not redraw");
      await page.reload(); await ready();
      assert.equal(digest(await image()), digest(baseline), "reload restores modern default pixels");
      assert.deepEqual(errors, [], "no browser errors");
      report.cases.push({ slug: item.slug, status: "passed", controls: controls.length, frames,
        interface: path.relative(root, interfacePath), transparentPng: path.relative(root, saved) });
      console.log(`${item.slug}: passed`);
    } catch (error) {
      report.cases.push({ slug: item.slug, status: "failed", error: String(error), errors });
      console.error(`${item.slug}: ${error}`);
    } finally { await page.close(); }
  }
  assert.ok(report.cases.every(item => item.status === "passed"), "all five studies pass");
  report.status = "passed";
} catch (error) { report.failure = String(error); }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
if (report.status !== "passed") process.exitCode = 1;
