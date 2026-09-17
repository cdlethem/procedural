#!/usr/bin/env node
/** Rebuild the two supplied word outlines using the native study's verified font-loading path.
 * Run under tools/with_native_render_lock.py. `--check` compares the checked-in JSON bytewise.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startExternalExpansionServer } from "../../../tools/serve_external_expansion_studies.mjs";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const app = resolve(root, "apps/web");
const output = resolve(app, "assets/word-echo-contours.json");
const packageRoot = resolve(root, "packages/javascript");
const p5Root = resolve(root, ".work/environments/p5js/node_modules/p5/lib");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = async (path) => hash(await readFile(path));
const fontPath = resolve(packageRoot, "examples/glyph-marks/assets/GlyphMarks.ttf");
const licensePath = resolve(packageRoot, "examples/glyph-marks/assets/FONT-LICENSE.txt");
const fontSha256 = await hashFile(fontPath);
assert.equal(fontSha256, "b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c");
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(root, ".work/toolchains/playwright");
const { chromium } = await import(resolve(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer(0, { packageRoot });
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
  const page = await browser.newPage();
  const errors = [];
  let fontRequests = 0;
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => { if (request.url().endsWith("/examples/glyph-marks/assets/GlyphMarks.ttf")) fontRequests += 1; });
  await page.goto(server.baseURL + "/examples/word-echo/");
  await page.waitForFunction(() => window.__wordEcho?.ready || document.querySelector("#art")?.dataset.error, { timeout: 30000 });
  const status = await page.evaluate(() => ({ error: document.querySelector("#art").dataset.error ?? null, version: window.__wordEcho?.host?.constructor?.VERSION, fontData: !!window.__wordEcho?.font?.data }));
  assert.deepEqual(status, { error: null, version: "2.3.2", fontData: true });
  const contoursFor = () => page.evaluate(() => window.__wordEcho.contours.map((contour) => contour.map(({ x, y }) => [x, y])));
  const echo = await contoursFor();
  await page.evaluate(() => window.__wordEcho.action("word"));
  assert.equal(await page.evaluate(() => window.__wordEcho.snapshot().word), "OPEN");
  const open = await contoursFor();
  assert.ok(echo.length >= 4 && open.length >= 4);
  assert.ok(echo.reduce((sum, contour) => sum + contour.length, 0) > 100);
  assert.ok(open.reduce((sum, contour) => sum + contour.length, 0) > 100);
  assert.notDeepEqual(open, echo);
  assert.equal(fontRequests, 1, "the study loads the checked font response once");
  assert.deepEqual(errors, []);
  const asset = {
    schemaVersion: 1,
    source: "Pinned p5 2.3.2 Font.textToContours from the native word-echo study",
    font: { path: "packages/javascript/examples/glyph-marks/assets/GlyphMarks.ttf", sha256: fontSha256,
      licensePath: "packages/javascript/examples/glyph-marks/assets/FONT-LICENSE.txt", licenseSha256: await hashFile(licensePath) },
    p5: { version: "2.3.2", browserVersion: browser.version(), sourceSha256: await hashFile(resolve(p5Root, "p5.js")), servedSha256: await hashFile(resolve(p5Root, "p5.min.js")) },
    sourceStudy: { path: "packages/javascript/examples/word-echo/study.js", sha256: await hashFile(resolve(packageRoot, "examples/word-echo/study.js")) },
    extraction: { words: ["ECHO", "OPEN"], x: 60, baselineY: 330, textSize: 158, align: "LEFT/BASELINE", sampleFactor: 0.17 },
    contours: { ECHO: echo, OPEN: open },
  };
  const json = JSON.stringify(asset) + "\n";
  if (process.argv.includes("--check")) assert.equal(await readFile(output, "utf8"), json, "the supplied word outlines are stale");
  else { await mkdir(resolve(app, "assets"), { recursive: true }); await writeFile(output, json); }
  console.log(JSON.stringify({ output, sha256: hash(json), contourCount: { ECHO: echo.length, OPEN: open.length }, points: { ECHO: echo.reduce((n, c) => n + c.length, 0), OPEN: open.reduce((n, c) => n + c.length, 0) }, browser: browser.version() }));
} finally {
  if (browser) await browser.close();
  await server.close();
}
