#!/usr/bin/env node
/** Real Studio wave configurations. Run under tools/with_native_render_lock.py. */
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
const out = join(root, ".work/gallery-quality/systems-b-waves");
await mkdir(out, { recursive: true });
const base = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const errors = [];

async function ready(page) {
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-render-revision]");
    return Number(node?.dataset.renderRevision) > 0 && node?.dataset.renderStatus === "ready" &&
      document.querySelector(".studio-workspace")?.dataset.hydrated === "true";
  }, {}, { timeout: 60000 });
}
async function edit(page, action) {
  const before = await page.locator("[data-render-revision]").getAttribute("data-render-revision");
  await action();
  await page.waitForFunction(previous => {
    const node = document.querySelector("[data-render-revision]");
    return node?.dataset.renderRevision !== previous && node?.dataset.renderStatus === "ready";
  }, before, { timeout: 60000 });
}
async function setNumber(page, label, value) {
  await edit(page, async () => {
    const input = page.getByLabel(`Exact ${label}`, { exact: true });
    await input.fill(String(value));
    await input.press("Enter");
  });
}
async function setChoice(page, label, value) {
  await edit(page, () => page.getByLabel(label, { exact: true }).selectOption(value));
}
async function setToggle(page, label, value) {
  await edit(page, () => page.getByLabel(label, { exact: true }).setChecked(value));
}
async function image(page, name) {
  const canvas = page.locator(".canvas-wrap canvas");
  await canvas.screenshot({ path: join(out, `${name}.png`) });
  return await canvas.evaluate(element => element.toDataURL("image/png"));
}

try {
  for (const id of ["ripple-interference", "pinned-waves"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on("pageerror", error => errors.push(`${id}: ${error}`));
    await page.goto(`${base}/studio?technique=${id}`);
    await ready(page);
    const hashes = new Set();
    hashes.add(await image(page, `${id}-default`));
    await setNumber(page, "Passes", 0);
    await setNumber(page, "Impulse 1 amplitude", -1.5);
    await setNumber(page, "Impulse 1 X", .75);
    await setNumber(page, "Impulse 1 Y", .25);
    hashes.add(await image(page, `${id}-negative-source`));
    await setNumber(page, "Passes", 32);
    await setChoice(page, "Pin geometry", "vertical");
    await setNumber(page, "Pin X", .5);
    await setToggle(page, "Show pins", true);
    hashes.add(await image(page, `${id}-vertical-pin`));
    await setChoice(page, "Pin geometry", "disc");
    await setNumber(page, "Pin X", .62);
    await setNumber(page, "Pin Y", .48);
    await setNumber(page, "Pin radius", 5);
    await setNumber(page, "Cell spacing", 38);
    hashes.add(await image(page, `${id}-disc-crop`));
    assert.equal(hashes.size, 4, `${id}: four images must differ`);
    const corners = await page.locator(".canvas-wrap canvas").evaluate(canvas => {
      const context = canvas.getContext("2d"), points = [[0, 0], [639, 0], [0, 639], [639, 639]];
      return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    });
    assert.ok(corners.every(pixel => pixel[3] === 255), "Studio document includes its own paper");
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(`Passed 4 real Studio wave configurations per study; ${out}`);
} finally { await browser.close(); }
