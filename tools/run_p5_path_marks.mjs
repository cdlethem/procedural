/** Prepare or execute the bounded browser PathMarks validation suite. */
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, ".work/environments/p5js");
const output = path.join(root, ".work/reproductions/p5js-path-marks");
const attemptPath = path.join(output, "attempt.json");
const evidencePath = path.join(root, "evidence/conformance/p5js-path-marks.json");
const rendering = process.argv.includes("--render");
const TOTAL_HOST_TIMEOUT_MS = 180000;
const renderBudget = {
  policy: "One bounded initial browser execution. Every control callback that composes a frame is registered below; no corrective or repeat route is registered by this executor.",
  compositions: [
    { ordinal: 1, state: "base-marks", trigger: "initial setup", visualArtifact: "base-marks" },
    { ordinal: 2, state: "base-trace", trigger: "M", visualArtifact: "base-trace" },
    { ordinal: 3, state: "base-marks-restored", trigger: "M" },
    { ordinal: 4, state: "long-marks", trigger: "L", visualArtifact: "long-marks" },
    { ordinal: 5, state: "recolour", trigger: "C" },
    { ordinal: 6, state: "long-marks-restored-palette", trigger: "C" },
    { ordinal: 7, state: "count-2001", trigger: "N" },
    { ordinal: 8, state: "count-2000-restored", trigger: "N" },
    { ordinal: 9, state: "distance-08", trigger: "D" },
    { ordinal: 10, state: "base-long-restored", trigger: "D" },
  ],
  visualArtifacts: ["base-marks", "base-trace", "long-marks"],
  totalNativeCompositions: 10,
  cachedSaveCaptures: 1,
  totalHostTimeoutMs: TOTAL_HOST_TIMEOUT_MS,
};
const sourceNames = [
  "tools/run_p5_path_marks.mjs", "tests/native/path-marks-browser.mjs",
  "packages/javascript/examples/path-marks/index.html", "packages/javascript/examples/path-marks/sketch.js", "packages/javascript/examples/path-marks/path-marks.js",
  "packages/javascript/src/index.js", "packages/javascript/src/regular-grid.js", "packages/javascript/src/gradient-noise-2d-01.js",
  "packages/javascript/src/gradient-path.js", "packages/javascript/src/cyclic-palette.js", "packages/javascript/src/internal/noise-hash.js",
  "packages/javascript/src/internal/p5-frame.js", "packages/javascript/src/internal/drawing.js", "packages/javascript/src/internal/drawing-state.js",
  "catalog/operations/gradient-path.json", "fixtures/operations/gradient-path.json", "design/capabilities/cp2-public-example.md",
  ".work/environments/p5js/package-lock.json", ".work/environments/p5js/node_modules/p5/package.json", ".work/environments/p5js/node_modules/p5/lib/p5.min.js",
  ".work/environments/p5js/node_modules/playwright/package.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const errorText = (error) => String(error?.stack ?? error);
const hashFile = async (name) => digest(await fs.readFile(path.join(root, name)));
const requireValue = (value, message) => { if (!value) throw new Error(message); };

function deadlineController() {
  const deadline = Date.now() + TOTAL_HOST_TIMEOUT_MS;
  const remaining = (label) => {
    const milliseconds = deadline - Date.now();
    if (milliseconds <= 0) throw new Error(`PathMarks total host timeout before ${label}`);
    return milliseconds;
  };
  const bounded = async (operation, label) => {
    const milliseconds = remaining(label);
    let timeout;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`PathMarks total host timeout during ${label}`)), milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  return { deadline, remaining, bounded };
}

function recordFailure(report, phase, error) {
  const failure = `${phase}: ${errorText(error)}`;
  if (report.failure === undefined) report.failure = failure;
  else (report.cleanup_failures ??= []).push(failure);
  report.status = "failed";
}

async function closeSafely(report, deadline, resource, label) {
  if (resource === undefined) return;
  try {
    await deadline.bounded(resource.close(), `${label} cleanup`);
  } catch (error) {
    recordFailure(report, `${label} cleanup`, error);
  }
}

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourceNames.map(async (name) => [name, await hashFile(name)])));
}

function sameSegment(left, right) {
  return left.kind === right.kind && left.rgb === right.rgb && left.opacity8 === right.opacity8 &&
    left.width === right.width && left.cap === right.cap &&
    left.from.length === right.from.length && left.to.length === right.to.length &&
    left.from.every((value, index) => Object.is(value, right.from[index])) &&
    left.to.every((value, index) => Object.is(value, right.to[index]));
}

function intersectsPaddedCanvas(command) {
  const [fromX, fromY] = command.from;
  const [toX, toY] = command.to;
  return !(Math.max(fromX, toX) < -1 || Math.min(fromX, toX) > 641 ||
    Math.max(fromY, toY) < -1 || Math.min(fromY, toY) > 641);
}

/**
 * Verify the example-only canvas view without a renderer. This covers every
 * registered UI state before a native attempt, while keeping the raw public
 * command stream as the source of truth.
 */
async function pureDrawingChecks() {
  const example = await import(pathToFileURL(path.join(root, "packages/javascript/examples/path-marks/path-marks.js")).href);
  const { normalizeCommand } = await import(pathToFileURL(path.join(root, "packages/javascript/src/internal/drawing.js")).href);
  const states = [
    { id: "base-marks", trace: false, markLength: 12, alternate: false, steps: 2000, distance: 0.4 },
    { id: "base-trace", trace: true, markLength: 12, alternate: false, steps: 2000, distance: 0.4 },
    { id: "base-marks-restored", trace: false, markLength: 12, alternate: false, steps: 2000, distance: 0.4 },
    { id: "long-marks", trace: false, markLength: 24, alternate: false, steps: 2000, distance: 0.4 },
    { id: "recolour", trace: false, markLength: 24, alternate: true, steps: 2000, distance: 0.4 },
    { id: "long-marks-restored-palette", trace: false, markLength: 24, alternate: false, steps: 2000, distance: 0.4 },
    { id: "count-2001", trace: false, markLength: 24, alternate: false, steps: 2001, distance: 0.4 },
    { id: "count-2000-restored", trace: false, markLength: 24, alternate: false, steps: 2000, distance: 0.4 },
    { id: "distance-08", trace: false, markLength: 24, alternate: false, steps: 2000, distance: 0.8 },
    { id: "base-long-restored", trace: false, markLength: 24, alternate: false, steps: 2000, distance: 0.4 },
  ];
  const movements = new Map();
  const records = [];
  for (const state of states) {
    const movementKey = `${state.steps}/${state.distance}`;
    let movement = movements.get(movementKey);
    if (movement === undefined) {
      movement = example.createPathMarks(42, state.steps, state.distance);
      movements.set(movementKey, movement);
    }
    const colors = state.alternate ? example.ALTERNATE_PALETTE : example.BASE_PALETTE;
    const visible = example.visiblePathMarkCommands(movement, state.trace, state.markLength, colors);
    let nextVisible = visible.next();
    let rawCommandCount = 0;
    let submittedCommandCount = 0;
    let omittedCommandCount = 0;
    let batchSize = 0;
    let maximumBatchSize = 0;
    for (const raw of example.pathMarkCommands(movement, state.trace, state.markLength, colors)) {
      rawCommandCount += 1;
      if (!intersectsPaddedCanvas(raw)) {
        omittedCommandCount += 1;
        requireValue(Math.max(raw.from[0], raw.to[0]) < -1 || Math.min(raw.from[0], raw.to[0]) > 641 ||
          Math.max(raw.from[1], raw.to[1]) < -1 || Math.min(raw.from[1], raw.to[1]) > 641,
        `${state.id}: omitted command intersects padded canvas`);
        continue;
      }
      requireValue(!nextVisible.done && sameSegment(raw, nextVisible.value), `${state.id}: visible stream changed raw order/value`);
      normalizeCommand(nextVisible.value, { width: 640, height: 640, density: 1, background: 0xece7da });
      submittedCommandCount += 1;
      batchSize += 1;
      maximumBatchSize = Math.max(maximumBatchSize, batchSize);
      if (batchSize === 4096) batchSize = 0;
      nextVisible = visible.next();
    }
    requireValue(nextVisible.done, `${state.id}: visible stream has commands not sourced by raw stream`);
    requireValue(rawCommandCount === example.commandCount(movement, state.trace), `${state.id}: raw command count`);
    requireValue(maximumBatchSize <= 4096, `${state.id}: batch limit`);
    records.push({ id: state.id, rawCommandCount, submittedCommandCount, omittedCommandCount, maximumBatchSize });
  }
  return { scope: "Pure example-only canvas culling and internal drawing normalization; no renderer.", states: records };
}

function server() {
  return http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      let relative;
      if (pathname === "/") { response.writeHead(302, { Location: "/packages/javascript/examples/path-marks/index.html" }); response.end(); return; }
      if (pathname === "/p5.js") relative = ".work/environments/p5js/node_modules/p5/lib/p5.min.js";
      else if (pathname === "/tests/native/path-marks-browser.mjs" ||
        /^\/packages\/javascript\/(src\/(internal\/)?[a-z0-9-]+\.js|examples\/path-marks\/(index\.html|sketch\.js|path-marks\.js))$/.test(pathname)) relative = pathname.slice(1);
      else { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", relative.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8");
      response.end(await fs.readFile(path.join(root, relative)));
    } catch {
      response.writeHead(500); response.end("PathMarks source unavailable");
    }
  });
}

async function canvasState(page) {
  return page.evaluate(async () => {
    const visible = [...document.querySelectorAll("canvas")].filter((canvas) => {
      const style = getComputedStyle(canvas), rect = canvas.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const canvas = document.querySelector("#art canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("PathMarks canvas unavailable");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("PathMarks Canvas2D unavailable");
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const rgba_sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", rgba.buffer))]
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    let opaque = true, nonbackground = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index + 3] !== 255) opaque = false;
      if (rgba[index] !== 236 || rgba[index + 1] !== 231 || rgba[index + 2] !== 218) nonbackground += 1;
    }
    return { canvasCount: visible.length, width: canvas.width, height: canvas.height, rgba_sha256, opaque, nonbackground,
      status: document.querySelector("#status")?.textContent, revision: document.querySelector("#art")?.dataset.revision,
      rawCommandCount: Number(document.querySelector("#art")?.dataset.rawCommandCount),
      submittedCommandCount: Number(document.querySelector("#art")?.dataset.submittedCommandCount),
      png: canvas.toDataURL("image/png") };
  });
}

async function runBrowser(inputs, firstPathFixture, pureDrawing) {
  // This begins before module, server, and browser startup so the registered host
  // budget applies to the complete attempt rather than only page interactions.
  const deadline = deadlineController();
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
  const report = { status: "failed", scope: "p5 2.3.2/Chromium actual PathMarks controls, cached Save PNG, and three declared images only; no CP1 rerun or cross-host pixel identity claim.",
    input_sha256: inputs, render_budget: renderBudget, errors: [] };
  const renders = [];
  report.native = { pure_drawing: pureDrawing, render_states: renders };
  let browser; let context; let localServer;
  try {
    const { chromium } = await deadline.bounded(import(path.join(runtime, "node_modules/playwright/index.mjs")), "Playwright module startup");
    localServer = server();
    const serverStartup = new AbortController();
    try {
      await deadline.bounded(new Promise((resolve, reject) => {
        const fail = (error) => { localServer.off("error", fail); reject(error); };
        localServer.once("error", fail);
        localServer.listen({ port: 0, host: "127.0.0.1", signal: serverStartup.signal }, () => {
          localServer.off("error", fail); resolve();
        });
      }), "local server startup");
    } catch (error) {
      serverStartup.abort();
      throw error;
    }
    const origin = `http://127.0.0.1:${localServer.address().port}`;
    const launchTimeout = Math.max(1, deadline.remaining("Chromium launch") - 500);
    browser = await deadline.bounded(chromium.launch({ timeout: launchTimeout }), "Chromium launch");
    report.browser = browser.version();
    requireValue(report.browser.startsWith("153."), `Expected Chromium 153, got ${report.browser}`);
    report.browser_executable_sha256 = digest(await deadline.bounded(fs.readFile(chromium.executablePath()), "Chromium executable hash"));
    context = await deadline.bounded(browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 }), "browser context startup");
    {
      await deadline.bounded(context.route("**/*", (route) => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort()), "browser route setup");
      const page = await deadline.bounded(context.newPage(), "browser page startup");
      page.on("pageerror", (error) => report.errors.push(`pageerror: ${errorText(error)}`));
      page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
      await deadline.bounded(page.goto(`${origin}/packages/javascript/examples/path-marks/index.html`, { waitUntil: "load", timeout: deadline.remaining("page load") }), "page load");
      await deadline.bounded(page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1", null, { timeout: deadline.remaining("initial composition") }), "initial composition");
      const model = await deadline.bounded(page.evaluate(async (fixture) => (await import("/tests/native/path-marks-browser.mjs")).runPathMarksModel(fixture), firstPathFixture), "browser model checks");
      requireValue(model.passed, "browser model checks failed");
      report.native.model = model;
      report.native.live_observation = [await deadline.bounded(page.evaluate(async () => (await import("/tests/native/path-marks-browser.mjs")).beginLivePathMarksObservation()), "initial live observation")];

      async function capture(id, revision, status, preserveVisual = false) {
        await deadline.bounded(page.waitForFunction((value) => document.querySelector("#art")?.dataset.revision === String(value), revision, { timeout: deadline.remaining(id) }), id);
        const state = await deadline.bounded(canvasState(page), `${id} canvas capture`);
        requireValue(state.canvasCount === 1 && state.width === 640 && state.height === 640, `${id}: canvas profile`);
        requireValue(state.opaque && state.nonbackground > 0, `${id}: empty/nonopaque canvas`);
        requireValue(state.status === status, `${id}: unexpected status ${state.status}`);
        const expectedCounts = pureDrawing.states.find((record) => record.id === id);
        requireValue(expectedCounts !== undefined, `${id}: missing registered pure state`);
        requireValue(state.rawCommandCount === expectedCounts.rawCommandCount &&
          state.submittedCommandCount === expectedCounts.submittedCommandCount,
        `${id}: source/submitted command counts`);
        const captured = { id, ...state };
        if (preserveVisual) {
          const image = Buffer.from(state.png.split(",")[1], "base64");
          await deadline.bounded(fs.writeFile(path.join(output, `${id}.png`), image), `${id} image write`);
          captured.png_sha256 = digest(image);
        }
        delete captured.png;
        renders.push(captured);
        return captured;
      }
      async function click(action) {
        await deadline.bounded(page.locator(`button[data-action="${action}"]`).click({ timeout: deadline.remaining(`control ${action}`) }), `control ${action}`);
      }
      async function observe(action, settings) {
        const result = await deadline.bounded(page.evaluate(async ({ action, settings }) =>
          (await import("/tests/native/path-marks-browser.mjs")).observeLivePathMarksAction(action, settings), { action, settings }), `${action} live observation`);
        report.native.live_observation.push(result);
      }

      const base = await capture("base-marks", 1, "12,000 perpendicular marks · seed 42", true);
      await click("m"); const trace = await capture("base-trace", 2, "48,000 movement segments · seed 42", true);
      await observe("m", { seed: 42, steps: 2000, distance: 0.4, markLength: 12, trace: true, alternate: false });
      await click("m"); const restoredMarks = await capture("base-marks-restored", 3, "12,000 perpendicular marks · seed 42");
      await observe("m", { seed: 42, steps: 2000, distance: 0.4, markLength: 12, trace: false, alternate: false });
      requireValue(restoredMarks.rgba_sha256 === base.rgba_sha256, "movement toggle did not restore base marks");
      await click("l"); const longMarks = await capture("long-marks", 4, "12,000 perpendicular marks · seed 42", true);
      await observe("l", { seed: 42, steps: 2000, distance: 0.4, markLength: 24, trace: false, alternate: false });
      requireValue(longMarks.rgba_sha256 !== base.rgba_sha256 && trace.rgba_sha256 !== base.rgba_sha256, "visible edit did not change pixels");
      await click("c"); const recolour = await capture("recolour", 5, "12,000 perpendicular marks · seed 42");
      await observe("c", { seed: 42, steps: 2000, distance: 0.4, markLength: 24, trace: false, alternate: true });
      requireValue(recolour.rgba_sha256 !== longMarks.rgba_sha256, "palette click did not change pixels");
      await click("c"); const restoredPalette = await capture("long-marks-restored-palette", 6, "12,000 perpendicular marks · seed 42");
      await observe("c", { seed: 42, steps: 2000, distance: 0.4, markLength: 24, trace: false, alternate: false });
      requireValue(restoredPalette.rgba_sha256 === longMarks.rgba_sha256, "palette toggle did not restore long marks");
      await click("n"); await capture("count-2001", 7, "12,024 perpendicular marks · seed 42");
      await observe("n", { seed: 42, steps: 2001, distance: 0.4, markLength: 24, trace: false, alternate: false });
      await click("n"); const restoredCount = await capture("count-2000-restored", 8, "12,000 perpendicular marks · seed 42");
      await observe("n", { seed: 42, steps: 2000, distance: 0.4, markLength: 24, trace: false, alternate: false });
      requireValue(restoredCount.rgba_sha256 === longMarks.rgba_sha256, "count toggle did not restore long marks");
      await click("d"); await capture("distance-08", 9, "12,000 perpendicular marks · seed 42");
      await observe("d", { seed: 42, steps: 2000, distance: 0.8, markLength: 24, trace: false, alternate: false });
      await click("d"); const restoredDistance = await capture("base-long-restored", 10, "12,000 perpendicular marks · seed 42");
      await observe("d", { seed: 42, steps: 2000, distance: 0.4, markLength: 24, trace: false, alternate: false });
      requireValue(restoredDistance.rgba_sha256 === longMarks.rgba_sha256, "distance toggle did not restore base distance");

      const [download] = await deadline.bounded(Promise.all([page.waitForEvent("download", { timeout: deadline.remaining("Save PNG") }), click("s")]), "Save PNG");
      const savePath = path.join(output, "path-marks-saved.png");
      await deadline.bounded(download.saveAs(savePath), "Save PNG write");
      const saved = await deadline.bounded(fs.readFile(savePath), "Save PNG read");
      const savedRgbaSha256 = await deadline.bounded(page.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const context2d = canvas.getContext("2d");
        if (context2d === null) throw new Error("Offscreen Canvas2D unavailable");
        context2d.drawImage(bitmap, 0, 0); const rgba = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
        bitmap.close(); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", rgba.buffer))].map((value) => value.toString(16).padStart(2, "0")).join("");
      }, saved.toString("base64")), "Save PNG decode");
      requireValue(savedRgbaSha256 === restoredDistance.rgba_sha256, "Save PNG differs from displayed canvas");
      const quietStarted = Date.now();
      await deadline.bounded(page.waitForTimeout(Math.min(350, deadline.remaining("post-save quiet observation"))), "post-save quiet observation");
      const quiet = await deadline.bounded(canvasState(page), "post-save canvas capture");
      requireValue(quiet.revision === "10" && quiet.rgba_sha256 === restoredDistance.rgba_sha256, "Save PNG changed the displayed composition");
      requireValue(Date.now() - quietStarted >= 300, "post-save quiet observation was shorter than 300ms");
      report.native.live_observation.push(await deadline.bounded(page.evaluate(async () => (await import("/tests/native/path-marks-browser.mjs")).observeLivePathMarksQuiet()), "post-save live observation"));
      for (const [name, hash] of Object.entries(inputs)) requireValue(await deadline.bounded(hashFile(name), `source recheck ${name}`) === hash, `input changed during execution: ${name}`);
      report.status = report.errors.length === 0 ? "passed" : "failed";
      report.native.save_png = { path: ".work/reproductions/p5js-path-marks/path-marks-saved.png", bytes: saved.length,
        png_sha256: digest(saved), decoded_rgba_sha256: savedRgbaSha256, matches_current_canvas: true };
      if (report.errors.length) throw new Error("page errors observed");
    }
  } catch (error) {
    recordFailure(report, "execution", error);
  } finally {
    await closeSafely(report, deadline, context, "browser context");
    await closeSafely(report, deadline, browser, "browser");
    if (localServer?.listening) {
      try {
        await deadline.bounded(new Promise((resolve, reject) => localServer.close((error) => error === undefined ? resolve() : reject(error))), "local server cleanup");
      } catch (error) {
        recordFailure(report, "local server cleanup", error);
      }
    }
  }
  return report;
}

function terminalAttempt(report, inputs) {
  return { status: report.status, suite: "p5js-path-marks", render_budget: renderBudget, input_sha256: inputs };
}

async function persistTerminal(report, inputs) {
  const writeEvidence = async () => fs.writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
  const writeAttempt = async () => fs.writeFile(attemptPath, `${JSON.stringify(terminalAttempt(report, inputs), null, 2)}\n`);
  let evidenceWritten = false;
  let attemptWritten = false;
  try {
    await fs.mkdir(path.dirname(evidencePath), { recursive: true });
    await writeEvidence();
    evidenceWritten = true;
  } catch (error) {
    recordFailure(report, "evidence persistence", error);
  }
  try {
    await writeAttempt();
    attemptWritten = true;
  } catch (error) {
    recordFailure(report, "attempt persistence", error);
  }
  // A later persistence error can turn a previously written passed report into a
  // failure. Rewrite either terminal record that was written, without allowing a
  // second write failure to escape and hide the primary result.
  if (report.status === "failed") {
    if (evidenceWritten) {
      try {
        await writeEvidence();
      } catch (error) {
        recordFailure(report, "evidence terminal rewrite", error);
      }
    }
    if (attemptWritten) {
      try {
        await writeAttempt();
      } catch (error) {
        recordFailure(report, "attempt terminal rewrite", error);
      }
    }
  }
}

async function main() {
  const inputs = await sourceHashes();
  const p5 = JSON.parse(await fs.readFile(path.join(runtime, "node_modules/p5/package.json"), "utf8"));
  const playwright = JSON.parse(await fs.readFile(path.join(runtime, "node_modules/playwright/package.json"), "utf8"));
  requireValue(p5.version === "2.3.2", `Expected p5 2.3.2, got ${p5.version}`);
  requireValue(playwright.version === "1.63.0", `Expected Playwright 1.63.0, got ${playwright.version}`);
  const runtimeBinding = { p5: p5.version, playwright: playwright.version, chromiumRequiredMajor: 153 };
  const fixture = JSON.parse(await fs.readFile(path.join(root, "fixtures/operations/gradient-path.json"), "utf8"));
  const firstPathFixture = fixture.cases.find((testCase) => testCase.id === "evolving-field");
  requireValue(firstPathFixture !== undefined, "missing named first-path fixture");
  const pureDrawing = await pureDrawingChecks();
  if (!rendering) {
    process.stdout.write(`${JSON.stringify({ prepared: true, suite: "p5js-path-marks", runtime: runtimeBinding, render_budget: renderBudget, pure_drawing: pureDrawing, input_sha256: inputs }, null, 2)}\n`);
    return;
  }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(attemptPath, `${JSON.stringify({ status: "started", suite: "p5js-path-marks", render_budget: renderBudget, input_sha256: inputs }, null, 2)}\n`, { flag: "wx" });
  let report;
  try {
    report = await runBrowser(inputs, firstPathFixture, pureDrawing);
  } catch (error) {
    report = { status: "failed", scope: "p5 2.3.2/Chromium actual PathMarks controls, cached Save PNG, and three declared images only; no CP1 rerun or cross-host pixel identity claim.",
      input_sha256: inputs, render_budget: renderBudget, errors: [], native: { pure_drawing: pureDrawing, render_states: [] } };
    recordFailure(report, "uncontained execution", error);
  }
  await persistTerminal(report, inputs);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
