/** Real p5 controls, topology errors, transparent pixels and export. Run under native render lease. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, ".work/gallery-quality/path-clip-native");
await fs.mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
const { chromium } = await import(path.join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
let browser;
const scenarios = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1200, height: 1150 } });
  const pageErrors = []; page.on("pageerror", error => pageErrors.push(String(error)));
  const ready = () => page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready", { timeout: 30000 });
  const dataURL = () => page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"));
  const alpha = () => page.locator("#art canvas").evaluate(canvas => {
    const bytes = canvas.getContext("2d").getImageData(0, 0, 640, 640).data;
    let clear = 0, marked = 0;
    for (let i = 3; i < bytes.length; i += 4) {
      if (bytes[i] === 0) clear++; else marked++;
    }
    return { clear, marked, corner: bytes[3], portal: bytes[4 * (500 * 640 + 320) + 3] };
  });
  const set = async (label, value, expectedStatus = "ready") => {
    const input = page.getByLabel(label, { exact: true });
    if (await input.evaluate(el => el.tagName === "SELECT")) await input.selectOption(String(value));
    else { await input.fill(String(value)); await input.press("Tab"); }
    await page.waitForFunction(status => document.querySelector("#art")?.dataset.renderStatus === status,
      expectedStatus, { timeout: 30000 });
  };
  const capture = async (name) => {
    const data = await dataURL();
    await fs.writeFile(path.join(out, `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
    const counts = await alpha();
    assert.ok(counts.clear > 1000 && counts.marked > 1000, `${name}: canvas contains both alpha-clear and marked pixels`);
    assert.equal(counts.corner, 0, `${name}: corner remains transparent`);
    scenarios.push({ name, ...counts, size: await page.locator("#art").getAttribute("data-clipped-size") });
    return data;
  };

  await page.goto(`${server.baseURL}/examples/path-clip-marks/`);
  await ready();
  const baseline = await capture("rows-portal-default");
  assert.equal((await alpha()).portal, 0, "default portal opening stays clear");
  await set("Clip boundary", "rectangle");
  const rectangle = await capture("rows-rectangle");
  assert.notEqual(rectangle, baseline, "rectangle changes kept rows");

  await set("Clip boundary", "bay");
  await set("Source paths", "fan");
  await set("Notch opening", 170);
  await set("Notch depth", 220);
  const fanBay = await capture("fan-bay");
  assert.notEqual(fanBay, rectangle, "fan and bay visibly change composition");

  await set("Source paths", "wander");
  await set("Clip boundary", "regular");
  await set("Polygon sides", 7);
  await set("Polygon angle", 16);
  await set("Wander", 25);
  await set("Wander seed", 23);
  const wanderRegular = await capture("wander-regular");
  assert.notEqual(wanderRegular, fanBay, "wander and regular polygon visibly change composition");

  await set("Clip boundary", "portal");
  const beforeInvalid = await dataURL();
  await set("Notch opening", 900, "error");
  assert.equal(await page.locator("#art").getAttribute("data-render-status"), "error");
  assert.match(await page.locator("#status").textContent(), /Notch opening exceeds/);
  assert.ok((await dataURL()) === beforeInvalid, "invalid topology does not destroy the last valid artwork");
  await set("Notch opening", 160);
  await set("Notch depth", 480, "error");
  assert.equal(await page.locator("#art").getAttribute("data-render-status"), "error");
  assert.match(await page.locator("#status").textContent(), /Full-depth notch/);
  await set("Notch depth", 220);
  assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready");

  const beforeSave = await dataURL();
  const download = page.waitForEvent("download");
  await page.locator('button[data-action="save"]').click();
  const exported = path.join(out, "path-clip-export.png");
  await (await download).saveAs(exported);
  const encoded = (await fs.readFile(exported)).toString("base64");
  const exportMatches = await page.evaluate(async ({ encoded, expected }) => {
    const pixelBytes = async data => {
      const image = await createImageBitmap(await (await fetch(data)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = await pixelBytes(`data:image/png;base64,${encoded}`);
    const b = await pixelBytes(expected);
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }, { encoded, expected: beforeSave });
  assert.ok(exportMatches, "saved PNG preserves transparent canvas pixels");

  await page.locator('button[data-action="reset"]').click();
  await ready();
  assert.equal(await dataURL(), baseline, "reset restores exact defaults");
  await page.locator('button[data-action="reload"]').click();
  await ready();
  assert.equal(await dataURL(), baseline, "reload restores exact defaults");
  assert.deepEqual(pageErrors, []);
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ status: "passed", scenarios }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "passed", scenarios }));
} finally {
  if (browser) await browser.close();
  await server.close();
}
