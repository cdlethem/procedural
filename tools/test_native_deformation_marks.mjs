#!/usr/bin/env node
/** Focused real-p5 interaction and alpha check for the two deformation studies.
 * Run with: python3 tools/with_native_render_lock.py -- node tools/test_native_deformation_marks.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startExternalExpansionServer } from "./serve_external_expansion_studies.mjs";

const root = resolve(".");
const out = join(root, ".work/gallery-quality/native-deformation-marks");
await mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, ".work/toolchains/playwright");
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
const browser = await chromium.launch({ headless: true });
const cases = {
  "pull-marks": [
    ["rows-two", { sourceMode: "rows", pathCount: 36, jitter: 8, power1: .65, radius2: 300 }],
    ["columns-one", { sourceMode: "columns", pathCount: 42, influenceCount: 1, centerX1: 500, centerY1: 135, radius1: 330, power1: 2.8 }],
    ["spokes-offset", { sourceMode: "spokes", pathCount: 20, jitter: 25, centerX2: 135, centerY2: 500, radius2: 290, power2: .35 }],
  ],
  "projection-marks": [
    ["columns-one", { sourceMode: "columns", pathCount: 32, influenceCount: 1, centerX1: 320, centerY1: 320, radius1: 200, strength: 1 }],
    ["spokes-two", { sourceMode: "spokes", pathCount: 48, jitter: 12, centerX2: 145, centerY2: 465, radius2: 250, strength: .9 }],
    ["rows-zero", { sourceMode: "rows", pathCount: 18, jitter: 18, strength: 0 }],
  ],
};
const report = [];

async function canvasStats(page) {
  const pixels = await page.locator("#art canvas").evaluate(canvas => Array.from(
    canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data,
  ));
  let painted = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted += 1;
  return {
    hash: createHash("sha256").update(Uint8Array.from(pixels)).digest("hex"),
    painted,
    cornerAlpha: [pixels[3], pixels[4 * 639 + 3], pixels[4 * (639 * 640) + 3], pixels[4 * (640 * 640 - 1) + 3]],
  };
}
async function setFields(page, values) {
  const before = Number(await page.locator("#art").getAttribute("data-revision"));
  for (const [key, value] of Object.entries(values)) {
    const field = page.locator(`[name="${key}"]`);
    if (await field.evaluate(node => node.tagName === "SELECT")) await field.selectOption(String(value));
    else await field.fill(String(value));
  }
  await page.waitForFunction(previous => Number(document.querySelector("#art")?.dataset.revision) > previous, before);
  assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready");
}

try {
  for (const [slug, variants] of Object.entries(cases)) {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${server.baseURL}/examples/${slug}/index.html`);
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");
    const exposed = slug === "pull-marks" ? "pullMarksStudy" : "projectionMarksStudy";
    const baseline = await canvasStats(page);
    assert.ok(baseline.painted > 1000, `${slug} default has visible marks`);
    assert.deepEqual(baseline.cornerAlpha, [0, 0, 0, 0], `${slug} page keeps canvas corners transparent`);
    await page.locator("#art canvas").screenshot({ path: join(out, `${slug}-default.png`) });
    const hashes = [baseline.hash];
    report.push({ slug, case: "default", ...baseline });
    for (const [name, values] of variants) {
      await setFields(page, values);
      const result = await canvasStats(page);
      assert.ok(result.painted > 1000, `${slug} ${name} has visible marks`);
      assert.deepEqual(result.cornerAlpha, [0, 0, 0, 0], `${slug} ${name} keeps canvas corners transparent`);
      assert.ok(!hashes.includes(result.hash), `${slug} ${name} yields a distinct image`);
      hashes.push(result.hash);
      await page.locator("#art canvas").screenshot({ path: join(out, `${slug}-${name}.png`) });
      report.push({ slug, case: name, ...result });
    }
    await page.getByRole("button", { name: "Reset" }).click();
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready");
    assert.equal((await canvasStats(page)).hash, baseline.hash, `${slug} reset restores pixels`);
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save PNG" }).click();
    const download = await downloadReady;
    const pngPath = join(out, `${slug}-saved.png`);
    await download.saveAs(pngPath);
    const png = await readFile(pngPath);
    assert.ok(png.length > 1000 && png.subarray(1, 4).toString() === "PNG", `${slug} saves PNG`);
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");
    assert.equal((await canvasStats(page)).hash, baseline.hash, `${slug} reload starts from default`);
    assert.deepEqual(errors, [], `${slug} has no browser exceptions`);
    const snapshot = await page.evaluate(name => window[name].snapshot(), exposed);
    assert.equal(snapshot.renderStatus, "ready");
    await page.close();
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Passed ${report.length} native deformation configurations; ${out}`);
} finally {
  await browser.close();
  await server.close();
}
