/** Run through tools/with_native_render_lock.py: real p5 Canvas2D study controls and alpha. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, ".work/gallery-quality/materials-a-native");
await fs.mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
const { chromium } = await import(path.join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
let browser;
const cases = [
  { slug: "quantized-stripes", edit: async page => {
    await page.getByLabel("Exact Band coverage").fill("0.45");
    await page.getByLabel("Exact Band coverage").press("Tab");
  }, extra: [["Stripes", "40"], ["Colors", "7"]], zero: true },
  { slug: "perceptual-bands", edit: async page => {
    await page.getByLabel("Exact Band coverage").fill("0.45");
    await page.getByLabel("Exact Band coverage").press("Tab");
  }, extra: [["Bands", "27"], ["Edge phase", "1.4"]], zero: true },
  { slug: "reduced-mosaic", edit: async page => {
    await page.getByLabel("Show source values").selectOption("high");
  }, extra: [["Source cutoff", "0.72"], ["Cell size", "14"], ["Colors", "10"]] },
  { slug: "nearest-feature-mosaic", edit: async page => {
    await page.getByLabel("Region display").selectOption("boundaries");
    await page.getByLabel("Show sites").check();
  }, extra: [["Boundary width", "4"], ["Site size", "9"], ["Features", "18"], ["Cell size", "11"]] },
];
const summary = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1180, height: 1100 } });
  const errors = []; page.on("pageerror", error => errors.push(String(error)));
  const png = () => page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"));
  const alpha = () => page.locator("#art canvas").evaluate(canvas => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, opaque = 0, partial = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) clear++; else if (data[i] === 255) opaque++; else partial++;
    }
    return { clear, opaque, partial };
  });
  const capture = async (slug, suffix) => {
    const data = await png();
    await fs.writeFile(path.join(out, `${slug}-${suffix}.png`), Buffer.from(data.split(",")[1], "base64"));
    return data;
  };
  for (const item of cases) {
    await page.goto(`${server.baseURL}/examples/${item.slug}/`);
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready", { timeout: 30000 });
    const baseline = await capture(item.slug, "default");
    const prior = await page.locator("#art").getAttribute("data-revision");
    await item.edit(page);
    await page.waitForFunction(old => {
      const art = document.querySelector("#art");
      return art?.dataset.revision !== old && art?.dataset.renderStatus === "ready";
    }, prior, { timeout: 30000 });
    const edited = await capture(item.slug, "masked");
    assert.ok(edited !== baseline, `${item.slug} controls change pixels`);
    const counts = await alpha();
    assert.ok(counts.clear > 1000, `${item.slug} has real transparent space`);
    assert.ok(counts.opaque + counts.partial > 1000, `${item.slug} retains visible marks`);
    if (item.zero) {
      const input = page.getByLabel("Exact Band coverage");
      await input.fill("0"); await input.press("Tab");
      assert.deepEqual(await alpha(), { clear: 640 * 640, opaque: 0, partial: 0 }, `${item.slug} zero coverage leaves no pixels`);
      await input.fill("0.45"); await input.press("Tab");
      assert.equal(await png(), edited, `${item.slug} restores the same edited image`);
    }
    let last = edited;
    for (const [label, value] of item.extra) {
      const input = page.getByLabel(`Exact ${label}`);
      await input.fill(value); await input.press("Tab");
      const next = await png();
      assert.ok(next !== last, `${item.slug} ${label} changes pixels`);
      last = next;
    }
    const wanted = last;
    const download = page.waitForEvent("download");
    await page.locator('button[data-action="s"]').click();
    const file = path.join(out, `${item.slug}-export.png`);
    await (await download).saveAs(file);
    const saved = await fs.readFile(file);
    assert.ok(saved.length > 1000, `${item.slug} exports PNG`);
    // p5 saveCanvas and toDataURL may use different encoders; compare decoded pixels below.
    const savedData = `data:image/png;base64,${saved.toString("base64")}`;
    const samePixels = await page.evaluate(async ({ savedData, wanted }) => {
      const decode = async source => {
        const image = await createImageBitmap(await (await fetch(source)).blob());
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const a = await decode(savedData), b = await decode(wanted);
      return a.length === b.length && a.every((value, index) => value === b[index]);
    }, { savedData, wanted });
    assert.ok(samePixels, `${item.slug} PNG export preserves canvas pixels and alpha`);
    await page.locator('button[data-action="0"]').click();
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.renderStatus === "ready");
    assert.equal(await png(), baseline, `${item.slug} reset restores exact defaults`);
    summary.push({ slug: item.slug, ...counts, output: path.relative(root, file) });
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({ status: "passed", cases: summary }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
} finally { if (browser) await browser.close(); await server.close(); }
