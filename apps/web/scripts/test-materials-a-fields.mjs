#!/usr/bin/env node
/** Actual Studio layer-composition check. Run under with_native_render_lock.py. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const legacy = join(root, ".work/environments/p5js/node_modules/playwright/index.mjs");
if (existsSync(legacy)) process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, ".work/toolchains/playwright");
const { chromium } = await import(existsSync(legacy) ? legacy : "playwright");
const out = join(root, ".work/gallery-quality/materials-a-fields");
await mkdir(out, { recursive: true });
const base = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

const ready = () => page.waitForFunction(() => {
  const node = document.querySelector("[data-render-revision]");
  return Number(node?.dataset.renderRevision) > 0 && node?.dataset.renderStatus === "ready" && document.querySelector(".studio-workspace")?.dataset.hydrated === "true";
}, {}, { timeout: 60000 });
async function edit(action) {
  const before = await page.locator("[data-render-revision]").getAttribute("data-render-revision");
  await action();
  await page.waitForFunction((prior) => {
    const node = document.querySelector("[data-render-revision]");
    return node?.dataset.renderRevision !== prior && node?.dataset.renderStatus === "ready";
  }, before, { timeout: 60000 });
}
const savePixels = (name) => page.locator(".canvas-wrap canvas").evaluate((canvas, label) => {
  window.__materialsFieldPixels ??= {};
  window.__materialsFieldPixels[label] = new Uint8Array(canvas.getContext("2d").getImageData(0, 0, 640, 640).data);
}, name);
const comparison = () => page.evaluate(() => {
  const { base, opaque, partial, zero } = window.__materialsFieldPixels;
  let painted = 0, gaps = 0, retained = 0, zeroDifference = 0, minAlpha = 255;
  for (let i = 0; i < base.length; i += 4) {
    const same = (a, b) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3];
    if (!same(base, opaque)) painted++;
    if (same(base, partial) && !same(base, opaque)) gaps++;
    if (!same(base, partial)) retained++;
    if (!same(base, zero)) zeroDifference++;
    minAlpha = Math.min(minAlpha, partial[i + 3]);
  }
  return { painted, gaps, retained, zeroDifference, minAlpha };
});
async function setBandCoverage(value) {
  await edit(async () => {
    const input = page.getByLabel("Exact Band coverage", { exact: true });
    await input.fill(String(value));
    await input.press("Enter");
  });
}

try {
  await page.goto(`${base}/studio?technique=path-marks`);
  await ready();
  await savePixels("base");
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  const picker = page.locator('dialog[aria-labelledby="layer-picker-title"]');
  await picker.getByLabel("Search techniques", { exact: true }).fill("Quantized Stripes");
  await edit(() => picker.getByRole("button", { name: "Add Quantized Stripes layer", exact: true }).click());
  await savePixels("opaque");
  await setBandCoverage(0.45);
  await savePixels("partial");
  await page.locator(".canvas-wrap canvas").screenshot({ path: join(out, "partial-composition.png") });
  const exportReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("dialog", { name: "Export composition" }).getByRole("button", { name: "Export PNG", exact: true }).click();
  await (await exportReady).saveAs(join(out, "partial-export.png"));
  assert.ok((await readFile(join(out, "partial-export.png"))).length > 1000);
  await page.getByRole("button", { name: "Close Export composition" }).click();
  await setBandCoverage(0);
  await savePixels("zero");
  const result = await comparison();
  assert.ok(result.painted > 1000, "opaque upper layer changes the lower composition");
  assert.ok(result.gaps > 1000, "partial coverage reveals unchanged lower-layer pixels");
  assert.ok(result.retained > 1000, "partial coverage still paints bands");
  assert.equal(result.zeroDifference, 0, "zero coverage is pixel-identical to lower layer alone");
  assert.equal(result.minAlpha, 255, "Studio export includes the document paper");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
  console.log(join(out, "partial-composition.png"));
  console.log(join(out, "partial-export.png"));
} finally {
  await browser.close();
}
