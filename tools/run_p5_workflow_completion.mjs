#!/usr/bin/env node
/**
 * Bounded native check for the thirteen Java workflows added after the reviewed p5 backlog.
 * Run only through tools/with_native_render_lock.py with a fresh directory under .work.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_DIRECTORY");
const output = path.resolve(args[1]);
if (!output.startsWith(path.join(root, ".work") + path.sep)) throw new Error("Output must stay under .work");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);

const runtime = path.join(root, ".work/environments/p5js");
const workflows = [
  ["body", [".", "m", "w"]],
  ["city", ["c", "h", "r"]],
  ["clip", ["h", "n", "t", "c", "m", "o"]],
  ["contact", ["n", "c"]],
  ["glyph", ["n", "d", "g", "m", "c", "v", "f", "r"]],
  ["image-field", ["m", "i", "c"]],
  ["landscape", ["c", "p", "r"]],
  ["layer", ["m"]],
  ["mask", ["m", "v"]],
  ["masked-partition", ["m", "n"]],
  ["placement-image", ["f", "c", "a", "m"]],
  ["pointer", [".", "m", "t"]],
  ["relief", ["c", "h", "r"]],
];

async function directFiles(directory) {
  return (await fs.readdir(directory, { withFileTypes: true })).flatMap(entry => entry.isFile() ? [path.join(directory, entry.name)] : []);
}

const inputs = [
  fileURLToPath(import.meta.url),
  path.join(runtime, "package-lock.json"),
  path.join(runtime, "node_modules/p5/lib/p5.min.js"),
  ...await directFiles(path.join(root, "packages/javascript/src")),
  ...await directFiles(path.join(root, "packages/javascript/src/internal")),
];
for (const [name] of workflows) {
  inputs.push(
    ...await directFiles(path.join(root, `packages/javascript/examples/${name}-marks`)),
    path.join(root, `tools/serve_${name.replaceAll("-", "_")}_marks.mjs`),
  );
  const assets = path.join(root, `packages/javascript/examples/${name}-marks/assets`);
  try { inputs.push(...await directFiles(assets)); } catch (error) { if (error.code !== "ENOENT") throw error; }
}
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async file => [path.relative(root, file), digest(await fs.readFile(file))])));
const report = {
  status: "failed",
  scope: "p5.js 2.3.2 Chromium check of the thirteen post-backlog editable workflows; no Java pixel-parity or corpus-technique claim.",
  input_sha256_before: await hashes(),
  workflows: [],
};
await fs.writeFile(path.join(output, "attempt.json"), JSON.stringify(report, null, 2) + "\n");

process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
const { chromium } = await import(path.join(runtime, "node_modules/playwright/index.mjs"));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  report.browser = browser.version();
  for (const [name, keys] of workflows) {
    const serverModule = await import(`./serve_${name.replaceAll("-", "_")}_marks.mjs`);
    const server = await Object.values(serverModule)[0](0);
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 900, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    const directory = path.join(output, name);
    await fs.mkdir(directory);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => Number(document.querySelector("#art")?.dataset.revision) >= 1);
      const revision = () => page.locator("#art").getAttribute("data-revision");
      const canvas = page.locator("#art canvas");
      await canvas.waitFor();
      const frames = [];
      async function capture(label) {
        const pixels = await page.evaluate(() => document.querySelector("#art canvas").toDataURL("image/png"));
        assert.ok(pixels.length > 100, `${name} ${label} has canvas pixels`);
        await canvas.screenshot({ path: path.join(directory, `${label}.png`) });
        frames.push({ label, sha256: digest(pixels) });
        return pixels;
      }
      async function edit(key, label) {
        const before = Number(await revision());
        await page.keyboard.press(key);
        await page.waitForFunction(value => Number(document.querySelector("#art")?.dataset.revision) > value, before);
        return capture(label);
      }

      const baseline = await capture("baseline");
      for (const [index, key] of keys.entries()) await edit(key, `edit-${index}-${key}`);
      const resetButton = page.locator('button[data-action="0"]');
      if (await resetButton.count()) {
        assert.equal(await edit("0", "reset"), baseline, `${name} reset identity`);
      } else {
        await page.reload();
        await page.waitForFunction(() => Number(document.querySelector("#art")?.dataset.revision) >= 1);
        assert.equal(await capture("reload"), baseline, `${name} fresh-load identity`);
      }
      const editButton = page.locator('button[data-action]:not([data-action="s"]):not([data-action=" "])').first();
      const beforeButton = Number(await revision());
      await editButton.click();
      await page.waitForFunction(value => Number(document.querySelector("#art")?.dataset.revision) > value, beforeButton);
      await capture("button");
      const beforeSave = await revision();
      const beforeSavePixels = await page.evaluate(() => document.querySelector("#art canvas").toDataURL("image/png"));
      const downloadEvent = page.waitForEvent("download");
      await page.keyboard.press("s");
      await (await downloadEvent).saveAs(path.join(directory, "saved.png"));
      await page.waitForTimeout(100);
      assert.equal(await revision(), beforeSave, `${name} save leaves revision unchanged`);
      assert.equal(await page.evaluate(() => document.querySelector("#art canvas").toDataURL("image/png")), beforeSavePixels, `${name} save leaves pixels unchanged`);
      assert.deepEqual(errors, [], `${name} browser errors`);
      report.workflows.push({ name, status: "passed", frames, reset: await resetButton.count() ? "exact" : "fresh-load exact", save: "downloaded without redraw", errors });
      console.log(`${name}: passed`);
    } finally {
      await page.close();
      await new Promise(resolve => server.close(resolve));
    }
  }
  report.input_sha256_after = await hashes();
  assert.deepEqual(report.input_sha256_after, report.input_sha256_before, "inputs changed during native check");
  report.status = "passed";
} catch (error) {
  report.failure = String(error.stack ?? error);
} finally {
  await browser?.close();
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ status: report.status, output, failure: report.failure }));
if (report.status !== "passed") process.exitCode = 1;
