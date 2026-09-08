/** Registered browser UI acceptance for the editable Field Marks example. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { startFieldMarksServer } from "../../tools/serve_field_marks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = path.join(root, ".work/environments/p5js");
const output = path.join(root, ".work/reproductions/p5js-ui");
const corrective=process.argv.includes("--corrective");
const attemptPath = path.join(output, corrective?"corrective-attempt.json":"attempt.json");
const evidencePath = path.join(root, "evidence/conformance/p5js-ui.json");
const sourceNames = [
  "tests/native/check-field-marks-ui.mjs", "tools/serve_field_marks.mjs",
  "packages/javascript/examples/field-marks/index.html",
  "packages/javascript/examples/field-marks/sketch.js",
  "packages/javascript/examples/field-marks/mark-field.js",
  "packages/javascript/src/internal/p5-frame.js",
  "packages/javascript/src/internal/drawing-state.js",
  "packages/javascript/src/internal/drawing.js",
  "packages/javascript/src/index.js", "packages/javascript/src/regular-grid.js",
  "packages/javascript/src/gradient-noise-2d-01.js", "packages/javascript/src/cyclic-palette.js",
  "design/p5js-ui-validation.md",
  "evidence/conformance/p5js-adapter-cp1.json",
  ".work/environments/p5js/package-lock.json",
  ".work/environments/p5js/node_modules/p5/lib/p5.min.js",
  ".work/environments/p5js/node_modules/playwright/package.json",
];
if(corrective)sourceNames.push("design/p5js-ui-density-repair.md");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = async (name) => digest(await fs.readFile(path.join(root, name)));
const requireValue = (value, message) => { if (!value) throw new Error(message); };
const errorText = (error) => String(error?.stack ?? error);

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourceNames.map(async (name) => [name, await hashFile(name)])));
}
async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function runUi(browser, origin, expected, errors) {
  const context = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });
  try {
    await context.route("**/*", (route) =>
      route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`pageerror: ${errorText(error)}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    await page.goto(`${origin}/packages/javascript/examples/field-marks/index.html`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#art")?.dataset.revision === "1");

    async function canvasState() {
      return page.evaluate(async () => {
        const visible = [...document.querySelectorAll("canvas")].filter((canvas) => {
          const style = getComputedStyle(canvas), rect = canvas.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
        const canvas = document.querySelector("#art canvas");
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Field Marks canvas unavailable");
        const context2d = canvas.getContext("2d");
        if (context2d === null) throw new Error("Field Marks Canvas2D unavailable");
        const rgba = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
        const rgba_sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", rgba.buffer))]
          .map((value) => value.toString(16).padStart(2, "0")).join("");
        return {
          canvasCount: visible.length, width: canvas.width, height: canvas.height, rgba_sha256,
          status: document.querySelector("#status")?.textContent,
          revision: document.querySelector("#art")?.dataset.revision,
        };
      });
    }
    async function assertCase(id, revision) {
      await page.waitForFunction((wanted) => document.querySelector("#art")?.dataset.revision === String(wanted), revision);
      const state = await canvasState();
      requireValue(state.canvasCount === 1, `${id}: expected one visible canvas`);
      requireValue(state.width === 640 && state.height === 640, `${id}: unexpected canvas dimensions`);
      requireValue(state.status === "25,600 marks · seed 42", `${id}: unexpected status`);
      requireValue(state.revision === String(revision), `${id}: unexpected revision`);
      requireValue(state.rgba_sha256 === expected.get(id), `${id}: RGBA hash differs from CP1 evidence`);
      return { id, ...state };
    }
    async function selectOne(target, selected, revision) {
      await page.evaluate(({ targetId, values }) => {
        for (const [id, value] of Object.entries(values)) {
          const select = document.querySelector(`#${id}`);
          if (!(select instanceof HTMLSelectElement)) throw new Error(`Missing select ${id}`);
          select.value = value;
        }
        const changed = document.querySelector(`#${targetId}`);
        if (!(changed instanceof HTMLSelectElement)) throw new Error(`Missing select ${targetId}`);
        changed.dispatchEvent(new Event("change", { bubbles: true }));
      }, { targetId: target, values: selected });
      return assertCase(target === "mark" ? "bar" : target, revision);
    }

    const renders = [];
    renders.push(await assertCase("base", 1));
    renders.push(await selectOne("length", { length: "32", palette: "original", mark: "line" }, 2));
    renders.push(await selectOne("palette", { length: "16", palette: "neon", mark: "line" }, 3));
    renders.push(await selectOne("mark", { length: "16", palette: "original", mark: "bar" }, 4));

    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#save").click()]);
    const stream = await download.createReadStream();
    requireValue(stream !== null, "Save PNG did not provide a stream");
    const png = await readStream(stream);
    await fs.writeFile(path.join(output,"field-marks.png"),png);
    const decoded = await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context2d = canvas.getContext("2d");
      if (context2d === null) throw new Error("Offscreen Canvas2D unavailable");
      context2d.drawImage(bitmap, 0, 0);
      const rgba = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgba_sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", rgba.buffer))]
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      bitmap.close();
      return { width: canvas.width, height: canvas.height, rgba_sha256 };
    }, png.toString("base64"));
    const current = renders.at(-1);
    requireValue(decoded.width === current.width && decoded.height === current.height, "Saved PNG dimensions differ");
    requireValue(decoded.rgba_sha256 === current.rgba_sha256, "Saved PNG pixels differ from current canvas");
    return {
      passed: errors.length === 0,
      scope: "actual editable Field Marks page, four registered UI renders and Save PNG download; no new renderer or corpus claim",
      renders,
      save_png: {
        path: ".work/reproductions/p5js-ui/field-marks.png", png_sha256: digest(png),
        suggested_filename: download.suggestedFilename(), bytes: png.length,
        decoded_rgba_sha256: decoded.rgba_sha256, matches_current_canvas: decoded.rgba_sha256 === current.rgba_sha256,
      },
      visible_canvas_count: current.canvasCount, status: current.status, revision: current.revision, errors: [...errors],
    };
  } catch (error) {
    return {
      passed: false,
      scope: "actual editable Field Marks page, four registered UI renders and Save PNG download; no new renderer or corpus claim",
      errors: [...errors],
      failure: errorText(error),
    };
  } finally {
    await context.close();
  }
}

export async function runFieldMarksUi() {
  const inputs = await sourceHashes();
  const cp1 = JSON.parse(await fs.readFile(path.join(root, "evidence/conformance/p5js-adapter-cp1.json"), "utf8"));
  requireValue(cp1.status === "passed" && cp1.native?.passed === true, "CP1 p5 evidence is not passed");
  const expected = new Map(cp1.native.cases.map((entry) => [entry.id, entry.rgba_sha256]));
  for (const id of ["base", "length", "palette", "bar"]) requireValue(typeof expected.get(id) === "string", `Missing CP1 hash ${id}`);
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
  const { chromium } = await import(path.join(runtime, "node_modules/playwright/index.mjs"));
  const errors = [];
  let browser, server, native = null;
  try {
    server = await startFieldMarksServer(0);
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
    const report = {
      input_sha256: inputs, node: process.version, platform: process.platform, architecture: process.arch,
      browser: browser.version(), browser_executable_sha256: digest(await fs.readFile(chromium.executablePath())),
      native: native = await runUi(browser, origin, expected, errors),
    };
    requireValue(report.native.passed, "Page errors occurred during UI assertions");
    for (const name of sourceNames) requireValue(await hashFile(name) === inputs[name], `Input changed during execution: ${name}`);
    return { status: "passed", ...report };
  } catch (error) {
    return {
      status: "failed", input_sha256: inputs, node: process.version, platform: process.platform,
      architecture: process.arch, errors, native, failure: errorText(error),
    };
  } finally {
    if (browser !== undefined) await browser.close();
    if (server !== undefined) await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const inputs = await sourceHashes();
  if (!process.argv.includes("--render")) {
    process.stdout.write(`${JSON.stringify({ prepared: true, part: "field-marks-ui", input_sha256: inputs }, null, 2)}\n`);
    return;
  }
  await fs.mkdir(output, { recursive: true });
  if(corrective) {
    const initial=JSON.parse(await fs.readFile(path.join(output,"attempt.json"),"utf8"));
    requireValue(initial.status==="failed","Corrective UI run requires initial failure");
    await fs.copyFile(evidencePath,path.join(root,"evidence/conformance/p5js-ui-initial.json"),fs.constants.COPYFILE_EXCL);
  }
  await fs.writeFile(attemptPath, JSON.stringify({
    status: "started", reserved_suite_part: "field-marks-ui", input_sha256: inputs,
  }, null, 2) + "\n", { flag: "wx" });
  let report;
  try {
    report = await runFieldMarksUi();
  } catch (error) {
    report = { status: "failed", input_sha256: inputs, errors: [], failure: errorText(error) };
  }
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(attemptPath, JSON.stringify({
    status: report.status, reserved_suite_part: "field-marks-ui", input_sha256: inputs,
  }, null, 2) + "\n");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") process.exitCode = 1;
}
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
