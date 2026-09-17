#!/usr/bin/env node
/** Real Studio review for the Pull/Projection source and influence controls. Run under the shared render lease. */
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
const out = join(root, ".work/gallery-quality/effects-path-fields");
await mkdir(out, { recursive: true });
const base = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const errors = [];
async function ready(page) {
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-render-revision]");
    return Number(node?.dataset.renderRevision) > 0 && node?.dataset.renderStatus === "ready" && document.querySelector(".studio-workspace")?.dataset.hydrated === "true";
  }, {}, { timeout: 60000 });
}
async function edit(page, action) {
  const before = await page.locator("[data-render-revision]").getAttribute("data-render-revision");
  await action();
  await page.waitForFunction(old => {
    const node = document.querySelector("[data-render-revision]");
    return node?.dataset.renderRevision !== old && node?.dataset.renderStatus === "ready";
  }, before, { timeout: 60000 });
}
const canvas = page => page.locator(".canvas-wrap canvas");
const png = page => canvas(page).evaluate(element => element.toDataURL("image/png"));
async function capture(page, name) { await canvas(page).screenshot({ path: join(out, `${name}.png`) }); return png(page); }

try {
  for (const [id, alternate, countLabel] of [["pull-marks", "spokes", "Influences"], ["projection-marks", "spokes", "Discs"]]) {
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${base}/studio?technique=${id}`);
    await ready(page);
    const baseline = await capture(page, `${id}-default`);
    await edit(page, () => page.getByLabel("Source paths", { exact: true }).selectOption(alternate));
    const changed = await capture(page, `${id}-${alternate}`);
    assert.ok(changed !== baseline, `${id}: source path mode changes image`);
    const exact = page.getByLabel(`Exact ${countLabel}`, { exact: true });
    await edit(page, async () => { await exact.fill("1"); await exact.press("Enter"); });
    const single = await capture(page, `${id}-${alternate}-single`);
    assert.ok(single !== changed, `${id}: second influence changes image`);
    const coverage = await canvas(page).evaluate(element => {
      const data = element.getContext("2d").getImageData(0, 0, 640, 640).data;
      let colored = 0, alphaMin = 255;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) colored++;
        alphaMin = Math.min(alphaMin, data[i + 3]);
      }
      return { colored, alphaMin };
    });
    assert.ok(coverage.colored > 1000);
    assert.equal(coverage.alphaMin, 255, "Studio includes document paper");
    await page.close();
  }
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(`${base}/studio?technique=path-marks`); await ready(page);
  await canvas(page).evaluate(element => { window.__lower = new Uint8Array(element.getContext("2d").getImageData(0, 0, 640, 640).data); });
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  const picker = page.locator('dialog[aria-labelledby="layer-picker-title"]');
  await picker.getByLabel("Search techniques", { exact: true }).fill("Pull marks");
  await edit(page, () => picker.getByRole("button", { name: "Add Pull Marks layer", exact: true }).click());
  await capture(page, "pull-over-path");
  const composition = await canvas(page).evaluate(element => {
    const upper = element.getContext("2d").getImageData(0, 0, 640, 640).data;
    const lower = window.__lower;
    let unchanged = 0, changed = 0;
    for (let i = 0; i < upper.length; i += 4) {
      if (upper[i] === lower[i] && upper[i + 1] === lower[i + 1] && upper[i + 2] === lower[i + 2] && upper[i + 3] === lower[i + 3]) unchanged++;
      else changed++;
    }
    return { unchanged, changed };
  });
  assert.ok(composition.unchanged > 100000, "lower layer remains visible through clear space");
  assert.ok(composition.changed > 1000, "upper paths remain visible");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", composition, out }));
} finally { await browser.close(); }
