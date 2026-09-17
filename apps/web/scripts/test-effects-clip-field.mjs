#!/usr/bin/env node
/** Real Studio Path Clip review; run under the shared native render lease. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const legacy = join(root, ".work/environments/p5js/node_modules/playwright/index.mjs");
if (existsSync(legacy)) process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, ".work/toolchains/playwright");
const { chromium } = await import(existsSync(legacy) ? legacy : "playwright");
const out = join(root, ".work/gallery-quality/effects-clip-field");
await mkdir(out, { recursive: true });
const base = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(String(error)));
async function ready() {
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-render-revision]");
    return Number(node?.dataset.renderRevision) > 0 && node?.dataset.renderStatus === "ready" && document.querySelector(".studio-workspace")?.dataset.hydrated === "true";
  }, {}, { timeout: 60000 });
}
async function edit(action) {
  const previous = await page.locator("[data-render-revision]").getAttribute("data-render-revision");
  await action();
  await page.waitForFunction(old => {
    const node = document.querySelector("[data-render-revision]");
    return node?.dataset.renderRevision !== old && node?.dataset.renderStatus === "ready";
  }, previous, { timeout: 60000 });
}
const canvas = () => page.locator(".canvas-wrap canvas");
const png = () => canvas().evaluate(element => element.toDataURL("image/png"));
async function capture(name) { await canvas().screenshot({ path: join(out, `${name}.png`) }); return png(); }
async function exact(label, value) {
  await edit(async () => { const input = page.getByLabel(`Exact ${label}`, { exact: true }); await input.fill(String(value)); await input.press("Enter"); });
}
try {
  await page.goto(`${base}/studio?technique=path-clip-marks`); await ready();
  const baseline = await capture("rows-portal-default");
  await edit(() => page.getByLabel("Clip boundary", { exact: true }).selectOption("rectangle"));
  const rectangle = await capture("rows-rectangle");
  assert.ok(rectangle !== baseline, "boundary change alters retained paths");
  await edit(() => page.getByLabel("Clip boundary", { exact: true }).selectOption("bay"));
  await edit(() => page.getByLabel("Source paths", { exact: true }).selectOption("fan"));
  const bayFan = await capture("fan-bay");
  assert.ok(bayFan !== rectangle, "source and boundary changes alter structure");
  await edit(() => page.getByLabel("Clip boundary", { exact: true }).selectOption("regular"));
  await edit(() => page.getByLabel("Source paths", { exact: true }).selectOption("wander"));
  await exact("Polygon sides", 5); await exact("Polygon angle", 30); await exact("Wander", 24);
  await edit(() => page.getByLabel("Show boundary", { exact: true }).uncheck());
  const wanderRegular = await capture("wander-regular-no-outline");
  assert.ok(wanderRegular !== bayFan);

  await page.goto(`${base}/studio?technique=path-marks`); await ready();
  await canvas().evaluate(element => { window.__lowerClip = new Uint8Array(element.getContext("2d").getImageData(0, 0, 640, 640).data); });
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  const picker = page.locator('dialog[aria-labelledby="layer-picker-title"]');
  await picker.getByLabel("Search techniques", { exact: true }).fill("Path Clip Marks");
  await edit(() => picker.getByRole("button", { name: "Add Path Clip Marks layer", exact: true }).click());
  await capture("clip-over-path");
  const composition = await canvas().evaluate(element => {
    const above = element.getContext("2d").getImageData(0, 0, 640, 640).data, below = window.__lowerClip;
    let unchanged = 0, changed = 0, alphaMin = 255;
    for (let i = 0; i < above.length; i += 4) {
      if (above[i] === below[i] && above[i + 1] === below[i + 1] && above[i + 2] === below[i + 2] && above[i + 3] === below[i + 3]) unchanged++;
      else changed++;
      alphaMin = Math.min(alphaMin, above[i + 3]);
    }
    return { unchanged, changed, alphaMin };
  });
  assert.ok(composition.unchanged > 100000, "lower layer visible in clipped-out region");
  assert.ok(composition.changed > 1000, "clipped paths and outline visible");
  assert.equal(composition.alphaMin, 255, "Studio paints document paper once");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", composition, out }));
} finally { await browser.close(); }
