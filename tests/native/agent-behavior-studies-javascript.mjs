#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SELF = fileURLToPath(import.meta.url);
const packageRoot = resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? join(ROOT, "packages/javascript"));
const output = resolve(process.argv[2] ?? join(ROOT, ".work/agent-behavior-native/report.json"));
if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
const outputDirectory = dirname(output), sha = value => createHash("sha256").update(value).digest("hex"), pathName = value => relative(ROOT, value).split(sep).join("/");
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]); }
const sourceFiles = [SELF, join(ROOT, "tools/serve_external_expansion_studies.mjs"), join(packageRoot, "src/contact-history-2d.js"), join(packageRoot, "src/sensor-motor-step-2d.js"), join(packageRoot, "src/flock-steer-2d.js"), join(packageRoot, "src/internal/agent-behavior-utils.js"), join(packageRoot, "src/radius-pairs-2d.js"), join(packageRoot, "src/internal/fdlibm-hypot.js"), join(packageRoot, "src/fdlibm-trig.js"), ...["lingering-links", "sensing-trails", "flocking-marks"].flatMap(slug => files(join(packageRoot, "examples", slug))), join(ROOT, ".work/environments/p5js/node_modules/p5/lib/p5.min.js")];
const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [pathName(file), sha(readFileSync(file))]));
const before = sourceHashes();
const { chromium } = await import(join(ROOT, ".work/environments/p5js/node_modules/playwright/index.mjs"));
process.env.PLAYWRIGHT_BROWSERS_PATH = join(ROOT, ".work/toolchains/playwright");
const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
const report = { status: "running", packageRoot, runtime: "p5 2.3.2 Canvas2D density1", scope: "Three original editable p5 studies. Baseline/early/late frames, one-tick behavior, edit transfer, reset/reload/save and source stability. No recreation or support acceptance claim.", input_sha256_before: before, studies: [] };
try {
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] }); report.browser = browser.version();
  for (const study of [
    { slug: "lingering-links", global: "lingeringLinks", edit: "r", transfer: (early, changed) => { assert.notEqual(changed.radius, early.radius, "radius transfer"); assert.deepEqual(changed.agents, early.agents, "radius edit retains state"); return "radius changes only the caller-supplied next contact graph"; } },
    { slug: "sensing-trails", global: "sensingTrails", edit: "f", transfer: (early, changed) => { assert.notDeepEqual(changed.field.values, early.field.values, "field substitution"); assert.deepEqual(changed.agents, early.agents, "field edit retains old agent state"); return "explicit scalar field substitution changes the next paired-probe input"; } },
    { slug: "flocking-marks", global: "flockingMarks", edit: "g", transfer: (early, changed) => { assert.notDeepEqual(changed.pairs, early.pairs, "graph transfer"); assert.deepEqual(changed.bodies, early.bodies, "graph edit retains bodies"); return "fixed supplied graph changes without an implicit neighbor query"; } },
  ]) {
    const directory = join(outputDirectory, study.slug); mkdirSync(directory, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 980, height: 900 }, acceptDownloads: true }); const errors = [];
    page.on("pageerror", error => errors.push(String(error))); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${server.baseURL}/examples/${study.slug}/index.html`); await page.waitForSelector("#art canvas"); await page.waitForFunction(key => Boolean(window[key]?.snapshot), study.global);
    const observe = () => page.evaluate(key => window[key].snapshot(), study.global);
    async function capture(label) {
      const state = await observe(); const dataUrl = await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png")); const png = Buffer.from(dataUrl.split(",")[1], "base64");
      writeFileSync(join(directory, `${label}.png`), png); writeFileSync(join(directory, `${label}.json`), JSON.stringify(state, null, 2) + "\n");
      const pixelFingerprint = await page.locator("#art canvas").evaluate(canvas => { const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data; let hash = 2166136261; for (let i = 0; i < data.length; i += 1) hash = Math.imul(hash ^ data[i], 16777619); return `${canvas.width}x${canvas.height}:${hash >>> 0}`; });
      return { label, tick: state.tick, state_sha256: sha(JSON.stringify(state)), pixel_fingerprint: pixelFingerprint, png_sha256: sha(png), png_bytes: png.length, png_path: pathName(join(directory, `${label}.png`)), state_path: pathName(join(directory, `${label}.json`)), state };
    }
    async function action(key) { await page.locator(`button[data-action="${key}"]`).click(); await page.waitForTimeout(50); return observe(); }
    const frames = []; const baseline = await capture("baseline"); frames.push(baseline); assert.equal(baseline.tick, 0, "baseline logical tick");
    await action("."); const early = await capture("early-tick-001"); frames.push(early); assert.equal(early.tick, 1, "one explicit logical tick"); assert.notEqual(early.png_sha256, baseline.png_sha256, "early frame changes");
    for (let index = 0; index < 29; index += 1) await action("."); const late = await capture("late-tick-030"); frames.push(late); assert.equal(late.tick, 30, "late logical tick"); assert.notEqual(late.png_sha256, early.png_sha256, "late frame changes");
    const edited = await action(study.edit); assert.equal(edited.tick, late.tick, "edit has no implicit tick"); const transfer = study.transfer(late.state, edited); const editFrame = await capture("edited-without-tick"); frames.push(editFrame);
    await action("."); const transferred = await capture("transfer-next-tick"); frames.push(transferred); assert.equal(transferred.tick, 31, "transferred input advances once"); assert.notDeepEqual(transferred.state, late.state, "transfer evolves a new state");
    await action("0"); const reset = await capture("reset"); frames.push(reset); assert.deepEqual(reset.state, baseline.state, "exact reset state"); assert.ok(reset.png_bytes > 0, "reset canvas captured");
    await page.reload(); await page.waitForSelector("#art canvas"); await page.waitForFunction(key => Boolean(window[key]?.snapshot), study.global); const reload = await capture("reload"); frames.push(reload); assert.deepEqual(reload.state, baseline.state, "exact reload state"); assert.ok(reload.png_bytes > 0, "reload canvas captured");
    const beforeSave = await observe(); const visible = Buffer.from((await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"))).split(",")[1], "base64"); const downloadPromise = page.waitForEvent("download"); await page.locator('button[data-action="s"]').click(); const download = await downloadPromise; const savedPath = join(directory, "saved.png"); await download.saveAs(savedPath); assert.deepEqual(await observe(), beforeSave, "save preserves state"); assert.equal(sha(readFileSync(savedPath)), sha(visible), "saved PNG equals displayed canvas");
    assert.deepEqual(errors, [], `${study.slug} browser errors`); report.studies.push({ slug: study.slug, frames: frames.map(({ state, ...frame }) => frame), transfer, saved_png: { path: pathName(savedPath), sha256: sha(readFileSync(savedPath)), bytes: readFileSync(savedPath).length }, checks: ["baseline", "early and late logical ticks", "edit without implicit tick", "input transfer", "exact reset and reload state", "reset/reload canvas captures", "save equals displayed canvas"] }); await page.close();
  }
  report.input_sha256_after = sourceHashes(); assert.deepEqual(report.input_sha256_after, before, "study source stability"); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = String(error.stack ?? error); throw error; }
finally { await browser?.close(); await server.close(); mkdirSync(outputDirectory, { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify({ status: report.status, output, studies: report.studies.length }));
