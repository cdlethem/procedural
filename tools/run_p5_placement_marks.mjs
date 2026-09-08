/** Prepare or execute the bounded browser PlacementMarks validation suite. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Machine-shared runtime locations (ignored resources), explicitly reused per the
// porting handoff; they are not part of this checkout. Override only with an
// equivalent prepared location, never with a checkout-local substitute.
const machineWork = process.env.PROCEDURALS_MACHINE_WORK || "/home/colin/dev/procedural/.work";
const runtime = path.join(machineWork, "environments/p5js");
const output = path.join(root, ".work/reproductions/p5js-placement-marks");
const attemptPath = path.join(output, "attempt.json");
const evidencePath = path.join(root, "evidence/conformance/p5js-placement-marks.json");
const rendering = process.argv.includes("--render");
const RADIAL_STATUS = /^(\d[\d,]*) accepted of 160 proposals · radial$/;
const JAVA_RADIAL_COUNT = 111; // accepted CP3 Java evidence; radial host trig is outside core semantics
const TOTAL_HOST_TIMEOUT_MS = 900000;

const renderBudget = {
  policy: "One bounded initial browser execution. Every control callback that composes a frame is registered below; no corrective or repeat route is registered by this executor.",
  compositions: [
    { ordinal: 1, state: "baseline", trigger: "initial setup", visualArtifact: "baseline" },
    { ordinal: 2, state: "diamond", trigger: "M click", visualArtifact: "diamond" },
    { ordinal: 3, state: "rings-restored", trigger: "M click" },
    { ordinal: 4, state: "palette", trigger: "keyboard c", visualArtifact: "palette" },
    { ordinal: 5, state: "palette-restored", trigger: "C click" },
    { ordinal: 6, state: "spacing", trigger: "G click", visualArtifact: "spacing" },
    { ordinal: 7, state: "spacing-restored", trigger: "G click" },
    { ordinal: 8, state: "size-min", trigger: "I click", visualArtifact: "size-min" },
    { ordinal: 9, state: "size-min-restored", trigger: "I click" },
    { ordinal: 10, state: "size-max", trigger: "O click", visualArtifact: "size-max" },
    { ordinal: 11, state: "size-max-restored", trigger: "O click" },
    { ordinal: 12, state: "count-extended", trigger: "N click", visualArtifact: "count" },
    { ordinal: 13, state: "count-restored", trigger: "N click" },
    { ordinal: 14, state: "seed-43", trigger: "R click", visualArtifact: "seed" },
    { ordinal: 15, state: "radial", trigger: "X click", visualArtifact: "radial" },
    { ordinal: 16, state: "radial-ignored-r", trigger: "R click" },
    { ordinal: 17, state: "radial-ignored-n", trigger: "N click" },
    { ordinal: 18, state: "radial-ignored-i", trigger: "I click" },
    { ordinal: 19, state: "radial-ignored-o", trigger: "O click" },
    { ordinal: 20, state: "radial-spacing", trigger: "G click", visualArtifact: "radial-spacing" },
    { ordinal: 21, state: "radial-spacing-restored", trigger: "G click" },
    { ordinal: 22, state: "save-quiet", trigger: "S click" },
  ],
  frameComposing: 17,
  ignoredObservations: 4,
  cachedSaveCaptures: 1,
  totalHostTimeoutMs: TOTAL_HOST_TIMEOUT_MS,
};
const sourceNames = [
  "tools/run_p5_placement_marks.mjs", "tests/native/placement-marks-browser.mjs",
  "packages/javascript/examples/placement-marks/index.html",
  "packages/javascript/examples/placement-marks/sketch.js",
  "packages/javascript/examples/placement-marks/placement-marks.js",
  "packages/javascript/examples/placement-marks/README.md",
  "packages/javascript/src/index.js", "packages/javascript/src/circle-placements.js",
  "packages/java/examples/PlacementMarks/PlacementComposition.java",
  "catalog/operations/ordered-circle-filter.json", "catalog/operations/seeded-circle-placement.json",
  "fixtures/operations/ordered-circle-filter.json", "fixtures/operations/seeded-circle-placement.json",
  "design/capabilities/placement-marks-p5-acceptance.md",
  "evidence/reproductions/cp3-java2d/pde-result.json",
];
const machineNames = [
  "environments/p5js/package-lock.json", "environments/p5js/node_modules/p5/package.json",
  "environments/p5js/node_modules/p5/lib/p5.min.js", "environments/p5js/node_modules/playwright/package.json",
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const errorText = (error) => String(error?.stack ?? error);
const hashFile = async (name) => digest(await fs.readFile(path.join(root, name)));
const hashMachine = async (name) => digest(await fs.readFile(path.join(machineWork, name)));
const requireValue = (value, message) => { if (!value) throw new Error(message); };

function deadlineController() {
  const deadline = Date.now() + TOTAL_HOST_TIMEOUT_MS;
  const remaining = (label) => {
    const milliseconds = deadline - Date.now();
    if (milliseconds <= 0) throw new Error(`PlacementMarks total host timeout before ${label}`);
    return milliseconds;
  };
  const bounded = async (operation, label) => {
    const milliseconds = remaining(label);
    let timeout;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`PlacementMarks total host timeout during ${label}`)), milliseconds);
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

async function inputHashes() {
  const [sources, machine] = await Promise.all([
    Object.fromEntries(await Promise.all(sourceNames.map(async (name) => [name, await hashFile(name)]))),
    Object.fromEntries(await Promise.all(machineNames.map(async (name) => [
      path.join(machineWork, name).split(path.sep).join("/"), await hashMachine(name)]))),
  ]);
  return { ...sources, ...machine };
}

/** Verify the delivered example composition in Node before any renderer is started. */
async function pureCompositionChecks() {
  const example = await import(pathToFileURL(path.join(root, "packages/javascript/examples/placement-marks/placement-marks.js")).href);
  const baseline = example.createSeededPlacementMarks(42, 5000, 4, 64, 1);
  const extended = example.createSeededPlacementMarks(42, 10000, 4, 64, 1);
  requireValue(baseline.placements.size === 424, "Node baseline count 424");
  requireValue(extended.placements.size === 517, "Node extended count 517");
  requireValue(example.createSeededPlacementMarks(43, 5000, 4, 64, 1).placements.size === 432, "Node seed 43 count 432");
  requireValue(example.createSeededPlacementMarks(42, 5000, 4, 64, 1.2).placements.size === 353, "Node spacing count 353");
  requireValue(example.createSeededPlacementMarks(42, 5000, 8, 64, 1).placements.size === 239, "Node minimum count 239");
  requireValue(example.createSeededPlacementMarks(42, 5000, 4, 32, 1).placements.size === 613, "Node maximum count 613");
  requireValue(example.createRadialPlacementMarks(1).placements.attempts === 160, "Node radial attempts 160");
  return {
    scope: "Node-side pure composition checks for the delivered example module; no renderer.",
    counts: { baseline: 424, extended: 517, seed43: 432, spacing: 353, sizeMin: 239, sizeMax: 613 },
  };
}

function server(requested) {
  return http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      requested.add(pathname);
      let relative;
      if (pathname === "/") { response.writeHead(302, { Location: "/packages/javascript/examples/placement-marks/index.html" }); response.end(); return; }
      if (pathname === "/p5.js") {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(await fs.readFile(path.join(machineWork, "environments/p5js/node_modules/p5/lib/p5.min.js")));
        return;
      }
      if (pathname === "/tests/native/placement-marks-browser.mjs" ||
        /^\/packages\/javascript\/(src\/[a-z0-9-]+\.js|examples\/placement-marks\/(index\.html|sketch\.js|placement-marks\.js))$/.test(pathname)) {
        relative = pathname.slice(1);
      } else { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", relative.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8");
      response.end(await fs.readFile(path.join(root, relative)));
    } catch {
      response.writeHead(500); response.end("PlacementMarks source unavailable");
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
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("PlacementMarks canvas unavailable");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("PlacementMarks Canvas2D unavailable");
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
      accepted: Number(document.querySelector("#art")?.dataset.accepted),
      attempts: Number(document.querySelector("#art")?.dataset.attempts),
      png: canvas.toDataURL("image/png") };
  });
}

const seededStatus = (accepted, attempts) =>
  `${accepted.toLocaleString("en-US")} accepted of ${attempts.toLocaleString("en-US")} proposals · seeded`;

async function runBrowser(inputs, pureComposition) {
  const deadline = deadlineController();
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(machineWork, "toolchains/playwright");
  const report = {
    status: "failed",
    scope: "p5 2.3.2/Chromium actual PlacementMarks controls, retained-result identity, extended accepted prefix, radial transfer, cached Save PNG, and ten declared images; no cross-host pixel identity claim.",
    input_sha256: inputs, render_budget: renderBudget, errors: [],
  };
  const renders = [];
  report.native = { pure_composition: pureComposition, render_states: renders };
  const requested = new Set();
  let browser; let context; let localServer;
  try {
    const { chromium } = await deadline.bounded(import(path.join(runtime, "node_modules/playwright/index.mjs")), "Playwright module startup");
    localServer = server(requested);
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
      await deadline.bounded(page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) {
          if (type === "2d") {
            return original.call(this, type, { ...(options || {}), willReadFrequently: true });
          }
          return original.call(this, type, options);
        };
      }), "browser readback init script");
      page.on("pageerror", (error) => report.errors.push(`pageerror: ${errorText(error)}`));
      page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
      await deadline.bounded(page.goto(`${origin}/packages/javascript/examples/placement-marks/index.html`, { waitUntil: "load", timeout: deadline.remaining("page load") }), "page load");
      await deadline.bounded(page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1", null, { timeout: deadline.remaining("initial composition") }), "initial composition");
      const model = await deadline.bounded(page.evaluate(async () => (await import("/tests/native/placement-marks-browser.mjs")).runPlacementMarksModel()), "browser model checks");
      requireValue(model.passed, "browser model checks failed");
      report.native.model = model;
      report.native.live_observation = [await deadline.bounded(page.evaluate(async () => (await import("/tests/native/placement-marks-browser.mjs")).beginLivePlacementMarksObservation()), "initial live observation")];

      async function capture(id, revision, statusSpec, preserveVisual = false, expectHash = undefined) {
        await deadline.bounded(page.waitForFunction((value) => document.querySelector("#art")?.dataset.revision === String(value), revision, { timeout: deadline.remaining(id) }), id);
        const state = await deadline.bounded(canvasState(page), `${id} canvas capture`);
        requireValue(state.canvasCount === 1 && state.width === 640 && state.height === 640, `${id}: canvas profile`);
        requireValue(state.opaque && state.nonbackground > 0, `${id}: empty/nonopaque canvas`);
        if (typeof statusSpec === "string") {
          requireValue(state.status === statusSpec, `${id}: unexpected status ${state.status}`);
        } else {
          const match = statusSpec.exec(state.status);
          requireValue(match !== null, `${id}: unexpected radial status ${state.status}`);
          requireValue(state.accepted === Number(match[1].replace(/,/g, "")), `${id}: status count mismatch`);
        }
        if (expectHash !== undefined) requireValue(state.rgba_sha256 === expectHash, `${id}: pixels changed without a registered composition`);
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
      async function key(action) {
        await deadline.bounded(page.keyboard.press(action, { timeout: deadline.remaining(`key ${action}`) }), `key ${action}`);
      }
      async function observe(action, expected) {
        const result = await deadline.bounded(page.evaluate(async ({ action, expected }) =>
          (await import("/tests/native/placement-marks-browser.mjs")).observeLivePlacementMarksAction(action, expected), { action, expected }), `${action} live observation`);
        report.native.live_observation.push(result);
      }

      const base = { seed: 42, attempts: 5000, minimum: 4, maximum: 64, separation: 1, radial: false, diamonds: false, alternate: false };
      const s1 = await capture("baseline", 1, seededStatus(424, 5000), true);
      requireValue(s1.accepted === 424 && s1.attempts === 5000, "baseline dataset counts");
      await click("m"); const s2 = await capture("diamond", 2, seededStatus(424, 5000), true);
      await observe("m", { settings: { ...base, diamonds: true }, revisionDelta: 1, rebuilt: false, accepted: 424, source: "seeded" });
      requireValue(s2.rgba_sha256 !== s1.rgba_sha256, "motif edit did not change pixels");
      await click("m"); const s3 = await capture("rings-restored", 3, seededStatus(424, 5000), false, s1.rgba_sha256);
      await observe("m", { settings: base, revisionDelta: 1, rebuilt: false, accepted: 424, source: "seeded" });
      await key("c"); const s4 = await capture("palette", 4, seededStatus(424, 5000), true);
      await observe("c", { settings: { ...base, alternate: true }, revisionDelta: 1, rebuilt: false, accepted: 424, source: "seeded" });
      requireValue(s4.rgba_sha256 !== s3.rgba_sha256, "palette edit did not change pixels");
      await click("c"); const s5 = await capture("palette-restored", 5, seededStatus(424, 5000), false, s3.rgba_sha256);
      await observe("c", { settings: base, revisionDelta: 1, rebuilt: false, accepted: 424, source: "seeded" });
      await click("g"); const s6 = await capture("spacing", 6, seededStatus(353, 5000), true);
      await observe("g", { settings: { ...base, separation: 1.2 }, revisionDelta: 1, rebuilt: true, accepted: 353, source: "seeded" });
      requireValue(s6.rgba_sha256 !== s5.rgba_sha256, "spacing edit did not change pixels");
      await click("g"); const s7 = await capture("spacing-restored", 7, seededStatus(424, 5000), false, s5.rgba_sha256);
      await observe("g", { settings: base, revisionDelta: 1, rebuilt: true, accepted: 424, source: "seeded" });
      await click("i"); const s8 = await capture("size-min", 8, seededStatus(239, 5000), true);
      await observe("i", { settings: { ...base, minimum: 8 }, revisionDelta: 1, rebuilt: true, accepted: 239, source: "seeded" });
      requireValue(s8.rgba_sha256 !== s7.rgba_sha256, "minimum edit did not change pixels");
      await click("i"); const s9 = await capture("size-min-restored", 9, seededStatus(424, 5000), false, s7.rgba_sha256);
      await observe("i", { settings: base, revisionDelta: 1, rebuilt: true, accepted: 424, source: "seeded" });
      await click("o"); const s10 = await capture("size-max", 10, seededStatus(613, 5000), true);
      await observe("o", { settings: { ...base, maximum: 32 }, revisionDelta: 1, rebuilt: true, accepted: 613, source: "seeded" });
      requireValue(s10.rgba_sha256 !== s9.rgba_sha256, "maximum edit did not change pixels");
      await click("o"); const s11 = await capture("size-max-restored", 11, seededStatus(424, 5000), false, s9.rgba_sha256);
      await observe("o", { settings: base, revisionDelta: 1, rebuilt: true, accepted: 424, source: "seeded" });
      await click("n"); const s12 = await capture("count-extended", 12, seededStatus(517, 10000), true);
      await observe("n", { settings: { ...base, attempts: 10000 }, revisionDelta: 1, rebuilt: true, accepted: 517, source: "seeded" });
      requireValue(s12.rgba_sha256 !== s11.rgba_sha256, "budget edit did not change pixels");
      await click("n"); const s13 = await capture("count-restored", 13, seededStatus(424, 5000), false, s11.rgba_sha256);
      await observe("n", { settings: base, revisionDelta: 1, rebuilt: true, accepted: 424, source: "seeded" });
      await click("r"); const s14 = await capture("seed", 14, seededStatus(432, 5000), true);
      await observe("r", { settings: { ...base, seed: 43 }, revisionDelta: 1, rebuilt: true, accepted: 432, source: "seeded" });
      requireValue(s14.rgba_sha256 !== s13.rgba_sha256, "seed edit did not change pixels");
      await click("x"); const s15 = await capture("radial", 15, RADIAL_STATUS, true);
      await observe("x", { settings: { ...base, seed: 43, radial: true }, revisionDelta: 1, rebuilt: true, source: "radial" });
      report.native.radial_transfer = {
        attempts: 160, accepted: s15.accepted, java_accepted: JAVA_RADIAL_COUNT,
        matches_java_count: s15.accepted === JAVA_RADIAL_COUNT,
        note: "Radial proposal trigonometry is host composition, outside exact core semantics; the count is recorded, not asserted.",
      };
      for (const action of ["r", "n", "i", "o"]) {
        await click(action);
        await capture(`radial-ignored-${action}`, 15, RADIAL_STATUS, false, s15.rgba_sha256);
        await observe(action, { settings: { ...base, seed: 43, radial: true }, revisionDelta: 0, rebuilt: false, source: "radial" });
      }
      await click("g"); const s20 = await capture("radial-spacing", 16, RADIAL_STATUS, true);
      await observe("g", { settings: { ...base, seed: 43, radial: true, separation: 1.2 }, revisionDelta: 1, rebuilt: true, source: "radial" });
      requireValue(s20.rgba_sha256 !== s15.rgba_sha256, "radial spacing edit did not change pixels");
      await click("g"); const s21 = await capture("radial-spacing-restored", 17, RADIAL_STATUS, false, s15.rgba_sha256);
      await observe("g", { settings: { ...base, seed: 43, radial: true }, revisionDelta: 1, rebuilt: true, source: "radial" });

      const [download] = await deadline.bounded(Promise.all([page.waitForEvent("download", { timeout: deadline.remaining("Save PNG") }), click("s")]), "Save PNG");
      const savePath = path.join(output, "placement-marks-saved.png");
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
      requireValue(savedRgbaSha256 === s21.rgba_sha256, "Save PNG differs from displayed canvas");
      const quietStarted = Date.now();
      await deadline.bounded(page.waitForTimeout(Math.min(350, deadline.remaining("post-save quiet observation"))), "post-save quiet observation");
      const quiet = await deadline.bounded(canvasState(page), "post-save canvas capture");
      requireValue(quiet.revision === "17" && quiet.rgba_sha256 === s21.rgba_sha256, "Save PNG changed the displayed composition");
      requireValue(Date.now() - quietStarted >= 300, "post-save quiet observation was shorter than 300ms");
      report.native.live_observation.push(await deadline.bounded(page.evaluate(async () => (await import("/tests/native/placement-marks-browser.mjs")).observeLivePlacementMarksQuiet()), "post-save live observation"));
      for (const name of [
        "/packages/javascript/examples/placement-marks/index.html",
        "/packages/javascript/examples/placement-marks/sketch.js",
        "/packages/javascript/examples/placement-marks/placement-marks.js",
        "/packages/javascript/src/circle-placements.js",
        "/tests/native/placement-marks-browser.mjs", "/p5.js",
      ]) requireValue(requested.has(name), `delivered module not loaded: ${name}`);
      report.native.delivered_modules = [...requested].sort();
      report.native.keyboard_edit = { key: "c", composition: "palette", revision: 4,
        note: "Keyboard-triggered palette edit; all other edits used actual button clicks." };
      for (const [name, hash] of Object.entries(inputs)) requireValue(await deadline.bounded(name.startsWith("/") ? hashMachine(name.slice(machineWork.length + 1)) : hashFile(name), `source recheck ${name}`) === hash, `input changed during execution: ${name}`);
      report.status = report.errors.length === 0 ? "passed" : "failed";
      report.native.save_png = { path: ".work/reproductions/p5js-placement-marks/placement-marks-saved.png", bytes: saved.length,
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
  return { status: report.status, suite: "p5js-placement-marks", render_budget: renderBudget, input_sha256: inputs };
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
  if (report.status === "failed") {
    if (evidenceWritten) {
      try { await writeEvidence(); } catch (error) { recordFailure(report, "evidence terminal rewrite", error); }
    }
    if (attemptWritten) {
      try { await writeAttempt(); } catch (error) { recordFailure(report, "attempt terminal rewrite", error); }
    }
  }
}

async function main() {
  const inputs = await inputHashes();
  const p5 = JSON.parse(await fs.readFile(path.join(runtime, "node_modules/p5/package.json"), "utf8"));
  const playwright = JSON.parse(await fs.readFile(path.join(runtime, "node_modules/playwright/package.json"), "utf8"));
  requireValue(p5.version === "2.3.2", `Expected p5 2.3.2, got ${p5.version}`);
  requireValue(playwright.version === "1.63.0", `Expected Playwright 1.63.0, got ${playwright.version}`);
  const runtimeBinding = {
    p5: p5.version, playwright: playwright.version, chromiumRequiredMajor: 153,
    machine_work: machineWork,
  };
  const pureComposition = await pureCompositionChecks();
  if (!rendering) {
    process.stdout.write(`${JSON.stringify({ prepared: true, suite: "p5js-placement-marks", runtime: runtimeBinding, render_budget: renderBudget, pure_composition: pureComposition, input_sha256: inputs }, null, 2)}\n`);
    return;
  }
  await fs.mkdir(output, { recursive: true });
  try {
    await fs.access(attemptPath);
    const preserved = `${output}-failed-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await fs.rename(output, preserved);
    await fs.mkdir(output, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.writeFile(attemptPath, `${JSON.stringify({ status: "started", suite: "p5js-placement-marks", render_budget: renderBudget, input_sha256: inputs }, null, 2)}\n`, { flag: "wx" });
  let report;
  try {
    report = await runBrowser(inputs, pureComposition);
  } catch (error) {
    report = { status: "failed", scope: "p5 2.3.2/Chromium actual PlacementMarks controls, retained-result identity, extended accepted prefix, radial transfer, cached Save PNG, and ten declared images; no cross-host pixel identity claim.",
      input_sha256: inputs, render_budget: renderBudget, errors: [], native: { pure_composition: pureComposition, render_states: [] } };
    recordFailure(report, "uncontained execution", error);
  }
  await persistTerminal(report, inputs);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
