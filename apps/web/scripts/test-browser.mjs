#!/usr/bin/env node
/** Real browser app integration; run under the repository machine render lease. */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const app = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  root = resolve(app, "../..");
const legacy = join(
  root,
  ".work/environments/p5js/node_modules/playwright/index.mjs",
);
if (existsSync(legacy))
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(
    root,
    ".work/toolchains/playwright",
  );
const { chromium } = await import(existsSync(legacy) ? legacy : "playwright");
const out = join(root, ".work/web-app-review/integration");
await mkdir(out, { recursive: true });
const base = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-accelerated-2d-canvas",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const scenarios = [];
const gallery = JSON.parse(
  await readFile(join(app, "lib/generated-gallery.json"), "utf8"),
);
const techniqueIds = gallery.techniques.map((technique) => technique.slug);
const techniqueTitle = new Map(
  gallery.techniques.map((technique) => [technique.slug, technique.title]),
);
const interactionsOnly = process.argv.includes("--interactions-only");
const transformsOnly = process.argv.includes("--transforms-only");
const galleryOnly = process.argv.includes("--gallery-only");
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function screenshot(name) {
  const file = join(out, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
async function rendered() {
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector("[data-render-revision]")?.dataset
          .renderRevision,
      ) > 0 &&
      document.querySelector("[data-render-revision]")?.dataset.renderStatus ===
        "ready",
    {},
    { timeout: 45000 },
  );
}
const revision = () =>
  page.locator("[data-render-revision]").getAttribute("data-render-revision");
async function edit(action) {
  const before = await revision();
  await action();
  await page.waitForFunction(
    (before) =>
      document.querySelector("[data-render-revision]")?.dataset
        .renderRevision !== before,
    before,
    { timeout: 30000 },
  );
}
const pixels = () =>
  page.locator(".canvas-wrap canvas").evaluate((c) => c.toDataURL());
const artwork = () =>
  page.locator(".canvas-wrap canvas").evaluate((canvas) => {
    const data = canvas.getContext("2d").getImageData(0, 0, 640, 640).data;
    const counts = new Map();
    for (let index = 0; index < data.length; index += 4) {
      const key =
        (data[index] << 24) |
        (data[index + 1] << 16) |
        (data[index + 2] << 8) |
        data[index + 3];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const largest = Math.max(...counts.values());
    return { png: canvas.toDataURL(), painted: data.length / 4 - largest };
  });
async function setReactInput(locator, value) {
  await locator.evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(element, next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
const doc = () =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith("procedurals-studio-v"),
    );
    if (!key) throw new Error("studio local document is missing");
    return JSON.parse(localStorage.getItem(key));
  });
/** Keeps export comparisons on the raw persisted envelope while making workflow assertions
 * work for both legacy layers and harness-v1 `{ kind, content }` workflow layers. */
const workflow = (document, index = 0) => {
  const layer = document.layers[index];
  if (layer?.kind === "workflow") return { ...layer, ...layer.content };
  return layer;
};
async function focusedCanvas() {
  const target = page.locator(".interactive-canvas").first();
  await target.focus();
  return target;
}
async function selectLiveCutRegion() {
  await page.locator('.cut-region-overlay').scrollIntoViewIfNeeded();
  const point = await page.locator('.cut-region-overlay').evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    for (const region of svg.querySelectorAll('rect')) {
      const local = region.getBBox(), matrix = region.getScreenCTM();
      if (!matrix) continue;
      const center = new DOMPoint(local.x + local.width / 2, local.y + local.height / 2).matrixTransform(matrix);
      if (center.x > box.left + 2 && center.x < box.right - 2 && center.y > box.top + 2 && center.y < box.bottom - 2)
        return {x:center.x, y:center.y};
    }
    return null;
  });
  assert.ok(point, 'at least one cut region has a visible center');
  await page.mouse.click(point.x, point.y);
}
async function addLayerFromPicker(id) {
  const title = techniqueTitle.get(id);
  assert.ok(title, `gallery title exists for ${id}`);
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  const picker = page.locator('dialog[aria-labelledby="layer-picker-title"]');
  await picker.waitFor();
  const search = picker.getByLabel("Search techniques", { exact: true });
  await search.fill(title);
  const card = picker.getByRole("button", {
    name: `Add ${title} layer`,
    exact: true,
  });
  assert.equal(await card.count(), 1, `${id} has one matching picker card`);
  await edit(() => card.click());
}
async function selectInspectorTab(name) {
  await page.getByRole("tab", { name, exact: true }).click();
}
async function assertControlsAccessible() {
  const result = await page
    .locator(".playground-controls")
    .evaluate((panel) => {
      const style = getComputedStyle(panel);
      const bounds = panel.getBoundingClientRect();
      const inputs = [...panel.querySelectorAll("input, select")];
      return {
        clipped: [style.overflow, style.overflowX, style.overflowY].some(
          (value) => value !== "visible",
        ),
        inputs: inputs.map((input) => {
          const rect = input.getBoundingClientRect();
          return {
            labelled: Boolean(
              input.getAttribute("aria-label") || input.labels?.length,
            ),
            clipped:
              rect.left < bounds.left ||
              rect.right > bounds.right ||
              rect.top < bounds.top ||
              rect.bottom > bounds.bottom,
          };
        }),
      };
    });
  assert.equal(
    result.clipped,
    false,
    "controls have no nested scrolling or clipped overflow",
  );
  assert.ok(result.inputs.length > 0);
  assert.ok(
    result.inputs.every((input) => input.labelled && !input.clipped),
    "every visible control input is labelled and within its panel",
  );
}
async function interactionChecks() {
  await page.goto(base + "/techniques/cut-marks");
  await rendered();
  await selectLiveCutRegion();
  const galleryBefore = await pixels();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("x")));
  assert.notEqual(
    await pixels(),
    galleryBefore,
    "gallery CutMarks keyboard X changes geometry",
  );
  await edit(() =>
    focusedCanvas().then(() => page.keyboard.press("Control+z")),
  );
  assert.equal(
    await pixels(),
    galleryBefore,
    "gallery Ctrl Z restores exact cut pixels",
  );

  await page.goto(base + "/studio?technique=field-marks");
  await rendered();
  const initialDocument = JSON.stringify(await doc());
  await page.keyboard.press("r");
  await page.waitForTimeout(100);
  assert.equal(
    JSON.stringify(await doc()),
    initialDocument,
    "R is ignored without canvas focus",
  );
  const initialPixels = await pixels();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("r")));
  const reseeded = await doc();
  assert.notEqual(
    workflow(reseeded).seed,
    workflow(JSON.parse(initialDocument)).seed,
    "focused R reseeds a seeded selected layer",
  );
  assert.notEqual(
    await pixels(),
    initialPixels,
    "reseed changes seeded artwork pixels",
  );
  const afterReseed = JSON.stringify(reseeded);
  const textInput = page.getByLabel("Project title", { exact: true });
  await textInput.focus();
  await page.keyboard.press("r");
  await page.locator("[data-render-status]").evaluate((node) => {
    node.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", ctrlKey: true, bubbles: true }),
    );
    node.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", repeat: true, bubbles: true }),
    );
  });
  await page.waitForTimeout(100);
  assert.equal(
    JSON.stringify(await doc()),
    afterReseed,
    "form, modified, and repeat R keys are ignored",
  );
  await page.goto(base + "/studio?technique=ramp-marks");
  await rendered();
  const fixed = JSON.stringify(await doc());
  await focusedCanvas();
  await page.keyboard.press("r");
  await page.waitForTimeout(100);
  assert.equal(
    JSON.stringify(await doc()),
    fixed,
    "R is ignored for fixed techniques",
  );

  await page.goto(base + "/studio?technique=cut-marks");
  await rendered();
  await selectLiveCutRegion();
  const baseline = await pixels();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("x")));
  assert.ok(
    workflow(await doc()).cutEdits?.length > 0,
    "Cut X persists a selected-region edit",
  );
  assert.notEqual(await pixels(), baseline, "Cut X changes geometry pixels");
  await selectLiveCutRegion();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("y")));
  const cutPixels = await pixels();
  assert.ok(
    workflow(await doc()).cutEdits?.length > 1,
    "Cut Y persists a second edit",
  );
  await selectLiveCutRegion();
  await edit(() =>
    page.getByRole("button", { name: "Remove region", exact: true }).click(),
  );
  const removed = await pixels();
  assert.notEqual(removed, cutPixels, "region removal changes pixels");
  const removedDocument = await doc();
  await edit(() =>
    focusedCanvas().then(() => page.keyboard.press("Control+z")),
  );
  assert.equal(await pixels(), cutPixels, "undo restores exact Cut Y pixels");
  await edit(() =>
    page.getByRole("button", { name: "Redo", exact: true }).click(),
  );
  assert.equal(
    await pixels(),
    removed,
    "redo restores exact region-removal pixels",
  );
  await edit(() =>
    page.getByRole("button", { name: "Undo", exact: true }).click(),
  );
  assert.equal(
    await pixels(),
    cutPixels,
    "Undo button also restores exact Cut Y pixels",
  );
  await edit(() =>
    page.getByRole("button", { name: "Redo", exact: true }).click(),
  );
  const beforePalette = JSON.stringify(workflow(await doc()).cutEdits);
  await selectInspectorTab("Style");
  await edit(() =>
    setReactInput(
      page.getByLabel("Palette color 1", { exact: true }),
      "#00e0ff",
    ),
  );
  assert.equal(
    JSON.stringify(workflow(await doc()).cutEdits),
    beforePalette,
    "palette edits preserve cut history",
  );
  const editsPixels = await pixels();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("r")));
  assert.deepEqual(
    workflow(await doc()).cutEdits,
    [],
    "R clears selected CutMarks edits",
  );
  await edit(() =>
    page.getByRole("button", { name: "Undo", exact: true }).click(),
  );
  assert.equal(
    await pixels(),
    editsPixels,
    "undo restores reseed-cleared edits exactly",
  );
  const editsBeforeNumericSeed = JSON.stringify(workflow(await doc()).cutEdits);
  await selectInspectorTab("Technique");
  await edit(() =>
    setReactInput(page.getByLabel("Seed", { exact: true }), "17"),
  );
  assert.deepEqual(
    workflow(await doc()).cutEdits,
    [],
    "numeric seed change clears CutMarks edits",
  );
  await edit(() =>
    focusedCanvas().then(() => page.keyboard.press("Control+z")),
  );
  assert.equal(
    JSON.stringify(workflow(await doc()).cutEdits),
    editsBeforeNumericSeed,
    "Ctrl Z restores numeric-seed-cleared edits",
  );
  assert.equal(
    await pixels(),
    editsPixels,
    "Ctrl Z restores exact numeric-seed-cleared pixels",
  );
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exportPath = join(out, "cutmarks-roundtrip.json");
  await (await exported).saveAs(exportPath);
  assert.deepEqual(
    JSON.parse(await readFile(exportPath, "utf8")),
    await doc(),
    "JSON preserves cut edits",
  );
  const recoveredDocument = await doc();
  const recoveredPixels = await pixels();
  await page.goto(base + "/studio");
  await rendered();
  assert.deepEqual(
    await doc(),
    recoveredDocument,
    "local storage preserves cut edits",
  );
  assert.equal(
    await pixels(),
    recoveredPixels,
    "local recovery restores exact edited pixels",
  );
  await edit(() =>
    page.getByRole("button", { name: "Delete", exact: true }).click(),
  );
  assert.equal((await doc()).layers.length, 0, "last layer can be removed");
  assert.equal(
    await page.locator(".interactive-canvas").count(),
    1,
    "empty studio retains a focusable canvas for undo",
  );
  assert.equal(
    await page.getByRole("button", { name: "New seed", exact: true }).count(),
    0,
    "empty studio has no reseed action",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Remove region", exact: true })
      .count(),
    0,
    "empty studio has no region action",
  );
  await edit(() =>
    focusedCanvas().then(() => page.keyboard.press("Control+z")),
  );
  assert.deepEqual(await doc(), recoveredDocument, "empty-canvas Ctrl Z restores removed layer");
  assert.equal(await pixels(), recoveredPixels, "empty-canvas Ctrl Z restores exact pixels");
  assert.ok(workflow(removedDocument).cutEdits?.length > 0);
  scenarios.push(
    "focused reseed boundaries and CutMarks edit/undo/export/storage interactions",
  );
}
async function transformChecks() {
  await page.goto(base + "/studio?technique=field-marks");
  await rendered();
  const identityPixels = await pixels();
  const setTransform = async (label, value) => {
    await selectInspectorTab("Placement");
    await edit(() =>
      setReactInput(
        page.getByLabel(
          `Exact ${label === "Scale" ? "Scale %" : label === "Rotation" ? "Rotation °" : label}`,
          { exact: true },
        ),
        String(label === "Scale" ? value * 100 : value),
      ),
    );
  };
  for (const [label, key, value] of [
    ["Position X", "x", 420],
    ["Position Y", "y", 245],
    ["Scale", "scale", 1.35],
    ["Rotation", "rotation", 31],
  ]) {
    const before = await pixels();
    await setTransform(label, value);
    assert.equal(
      workflow(await doc()).transform[key],
      value,
      `${label} is stored exactly`,
    );
    assert.notEqual(await pixels(), before, `${label} changes composite pixels`);
  }
  const transformed = await doc();
  const transformedPixels = await pixels();
  await edit(() =>
    page.getByRole("button", { name: "Reset placement", exact: true }).click(),
  );
  assert.deepEqual(workflow(await doc()).transform, {
    x: 320,
    y: 320,
    scale: 1,
    rotation: 0,
  });
  assert.equal(await pixels(), identityPixels, "identity reset restores exact pixels");

  const canvas = page.locator(".interactive-canvas canvas");
  const beforeDrag = await doc();
  const beforeDragPixels = await pixels();
  const box = await canvas.boundingBox();
  assert.ok(box, "canvas has a drag target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const previewRevision = await revision();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 - 30, {
    steps: 4,
  });
  await page.waitForFunction(before => document.querySelector('[data-render-revision]')?.dataset.renderRevision !== before, previewRevision);
  assert.notEqual(await pixels(), beforeDragPixels, "drag previews the moved layer live");
  const dragRevision = await revision();
  await page.mouse.up();
  await page.waitForFunction(
    (before) =>
      document.querySelector("[data-render-revision]")?.dataset.renderRevision !==
      before,
    dragRevision,
    { timeout: 30000 },
  );
  assert.notDeepEqual(
    workflow(await doc()).transform,
    workflow(beforeDrag).transform,
    "one drag commits one changed center",
  );
  await edit(() => page.getByRole("button", { name: "Undo", exact: true }).click());
  assert.deepEqual(
    workflow(await doc()).transform,
    workflow(beforeDrag).transform,
    "one undo restores the drag center",
  );
  assert.equal(await pixels(), beforeDragPixels, "one undo restores drag pixels");

  const clickDocument = await doc();
  const clickPixels = await pixels();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  assert.deepEqual(await doc(), clickDocument, "click without movement adds no history entry");
  assert.equal(await pixels(), clickPixels, "click without movement preserves pixels");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, {
    steps: 3,
  });
  await page.waitForTimeout(100);
  assert.notEqual(await pixels(), clickPixels, "escape test has a live drag preview");
  await focusedCanvas();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.deepEqual(await doc(), clickDocument, "Escape cancels drag without a history entry");
  assert.equal(await pixels(), clickPixels, "Escape restores exact pre-drag pixels");

  await page.goto(base + "/studio?technique=cut-marks");
  await rendered();
  await setTransform("Scale", 1.2);
  await setTransform("Rotation", 27);
  await selectLiveCutRegion();
  const cutBaseline = await pixels();
  await edit(() => focusedCanvas().then(() => page.keyboard.press("x")));
  assert.equal(workflow(await doc()).cutEdits.length, 1, "transformed region accepts X cut");
  assert.notEqual(await pixels(), cutBaseline, "transformed X cut changes pixels");
  const cutDocument = await doc();
  const cutPixels = await pixels();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exportPath = join(out, "transform-cut-roundtrip.json");
  await (await exported).saveAs(exportPath);
  assert.deepEqual(JSON.parse(await readFile(exportPath, "utf8")), cutDocument);
  await page.goto(base + "/studio");
  await rendered();
  assert.deepEqual(await doc(), cutDocument, "local recovery retains transforms and cuts");
  assert.equal(await pixels(), cutPixels, "local recovery restores transformed cut pixels");

  for (const id of ["profile-marks", "blur-marks"]) {
    await page.goto(base + "/studio?technique=" + id);
    await rendered();
    const before = await pixels();
    await setTransform("Position X", 430);
    assert.notEqual(await pixels(), before, `${id} transform changes compositor pixels`);
  }
  assert.notDeepEqual(workflow(transformed).transform, workflow(beforeDrag).transform);
  scenarios.push(
    "layer transform controls, live drag/undo, transformed CutMarks, persistence, WebGL and raster compositing",
  );
}
try {
  if (transformsOnly) {
    await transformChecks();
  } else if (interactionsOnly) {
    await interactionChecks();
  } else {
    await page.goto(base);
    await page.locator(".study-card").first().waitFor();
    assert.equal(await page.locator(".study-card").count(), 24);
    await page.getByPlaceholder("Search studies").fill("lattice");
    assert.equal(await page.locator(".study-card").count(), 1);
    await page.getByPlaceholder("Search studies").fill("");
    await screenshot("gallery");
    scenarios.push("gallery search and 24 study navigation");
    for (const id of techniqueIds) {
      await page.goto(base + "/techniques/" + id);
      await rendered();
      assert.equal(await page.locator(".canvas-wrap canvas").count(), 1);
      assert.equal(
        await page.locator('[data-render-status="error"]').count(),
        0,
      );
      assert.ok(
        (await artwork()).painted > 300,
        `${id} detail canvas has visible artwork`,
      );
      assert.equal(
        await page
          .locator(".source-panel details")
          .evaluate((details) => details.open),
        true,
        `${id} opens source details by default`,
      );
      await page.locator(".source-panel pre code").waitFor();
      assert.ok(
        (await page.locator(".source-panel pre code").textContent()).trim()
          .length > 20,
        `${id} exposes inline source`,
      );
      const ranges = page.locator(".technique-playground input[type=range]");
      assert.ok(
        (await ranges.count()) > 1,
        `${id} exposes a numeric technique control`,
      );
      await assertControlsAccessible();
      const beforeNumeric = await pixels();
      await edit(() =>
        ranges.nth(1).evaluate((element) => {
          const input = element;
          const next = input.value === input.max ? input.min : input.max;
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set;
          setter.call(input, next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }),
      );
      assert.notEqual(
        await pixels(),
        beforeNumeric,
        `${id} numeric control changes pixels`,
      );
      const beforePalette = await pixels();
      const paletteLength = await page
        .locator(".technique-playground .palette-control input[type=color]")
        .count();
      for (let index = 1; index <= paletteLength; index++)
        await edit(() =>
          setReactInput(
            page.getByLabel(`Palette color ${index}`, { exact: true }),
            "#ff00aa",
          ),
        );
      assert.notEqual(
        await pixels(),
        beforePalette,
        `${id} palette changes pixels`,
      );
    }
    await page.goto(base + "/techniques/field-marks");
    await rendered();
    await page.locator(".source-panel summary").click();
    assert.equal(
      await page
        .locator(".source-panel details")
        .evaluate((details) => details.open),
      false,
      "source details can close",
    );
    await page.locator(".source-panel summary").click();
    await page.locator(".source-panel pre code").waitFor();
    await screenshot("technique");
    scenarios.push(
      "24 shared detail renderers, inline source, numeric and palette pixel changes",
    );
    if (!galleryOnly) {
      for (const id of techniqueIds) {
        await page.goto(base + "/studio?technique=" + id);
        await rendered();
        assert.equal(
          await page.locator(".canvas-wrap canvas").count(),
          1,
          "one p5 instance",
        );
        assert.equal(
          await page.locator('[data-render-status="error"]').count(),
          0,
        );
        assert.ok(
          (await artwork()).painted > 300,
          `${id} visible studio artwork`,
        );
        const canvas = await page
          .locator(".canvas-wrap canvas")
          .evaluate((node) => ({
            width: node.width,
            height: node.height,
            png: node.toDataURL("image/png"),
          }));
        assert.deepEqual(
          [canvas.width, canvas.height],
          [640, 640],
          `${id} native canvas dimensions`,
        );
        await writeFile(
          join(out, `canvas-${id}.png`),
          Buffer.from(canvas.png.slice(canvas.png.indexOf(",") + 1), "base64"),
        );
        await screenshot("studio-" + id);
        await addLayerFromPicker(id);
        assert.equal(
          (await doc()).layers.length,
          2,
          `${id} picker card adds a studio layer`,
        );
        await edit(() =>
          page.getByRole("button", { name: "Delete", exact: true }).click(),
        );
        assert.equal(
          (await doc()).layers.length,
          1,
          `${id} picker-added layer can be removed`,
        );
      }
      scenarios.push(
        "24 studio technique renderers mount and each picker card adds a layer without browser errors",
      );
      await page.goto(base + "/studio?technique=field-marks");
      await rendered();
      const baseline = await pixels();
      await page.locator(".canvas-wrap canvas").evaluate((c) => {
        window.__fullPixels = Array.from(
          c.getContext("2d").getImageData(0, 0, 640, 640).data,
        );
      });
      await selectInspectorTab("Style");
      await edit(() =>
        page.getByLabel(/Opacity/).evaluate((el) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(el, "0.5");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }),
      );
      assert.equal(workflow(await doc()).opacity, 0.5);
      const background = (await doc()).background;
      const alphaError = await page
        .locator(".canvas-wrap canvas")
        .evaluate((c, backgroundHex) => {
          const pixels = c.getContext("2d").getImageData(0, 0, 640, 640).data,
            background = [
              Number.parseInt(backgroundHex.slice(1, 3), 16),
              Number.parseInt(backgroundHex.slice(3, 5), 16),
              Number.parseInt(backgroundHex.slice(5, 7), 16),
            ];
          let max = 0;
          for (let i = 0; i < pixels.length; i++) {
            if (i % 4 === 3) continue;
            const expected =
              background[i % 4] +
              ((window.__fullPixels[i] - background[i % 4]) * 128) / 255;
            max = Math.max(max, Math.abs(pixels[i] - expected));
          }
          delete window.__fullPixels;
          return max;
        }, background);
      assert.ok(alphaError <= 2, `group opacity pixel error ${alphaError}`);
      await edit(() =>
        page.getByRole("button", { name: "Undo", exact: true }).click(),
      );
      assert.equal(await pixels(), baseline);
      scenarios.push(
        "group opacity applies to completed layer, with exact undo pixels",
      );
      const beforeKeys = JSON.stringify(await doc());
      await page.locator(".canvas-wrap canvas").click();
      await page.keyboard.press("]");
      await page.waitForTimeout(150);
      assert.equal(
        JSON.stringify(await doc()),
        beforeKeys,
        "studio ignores parameter-toggle keyboard shortcuts",
      );
      const beforeStudioPalette = await pixels();
      await selectInspectorTab("Style");
      await edit(() =>
        setReactInput(
          page.getByLabel("Palette color 1", { exact: true }),
          "#00e0ff",
        ),
      );
      assert.notEqual(
        await pixels(),
        beforeStudioPalette,
        "studio palette changes pixels",
      );
      await addLayerFromPicker("path-marks");
      assert.equal((await doc()).layers.length, 2);
      const orderedIds = (await doc()).layers.map((l) => l.id);
      const orderedPixels = await pixels();
      await edit(() =>
        page.getByRole("button", { name: "Move up", exact: true }).click(),
      );
      assert.deepEqual(
        (await doc()).layers.map((l) => l.id),
        [...orderedIds].reverse(),
      );
      assert.notEqual(
        await pixels(),
        orderedPixels,
        "layer order changes overlapping pixels",
      );
      await edit(() =>
        page.getByRole("button", { name: "Move down", exact: true }).click(),
      );
      assert.deepEqual(
        (await doc()).layers.map((l) => l.id),
        orderedIds,
      );
      assert.equal(
        await pixels(),
        orderedPixels,
        "restored layer order reproduces pixels",
      );
      await edit(() =>
        page
          .getByRole("button", { name: "Hide field-marks", exact: true })
          .click(),
      );
      assert.equal(workflow(await doc()).visible, false);
      assert.equal(workflow(await doc(), 1).visible, true);
      await edit(() =>
        page.getByRole("button", { name: "Duplicate", exact: true }).click(),
      );
      assert.equal((await doc()).layers.length, 3);
      await edit(() =>
        page.getByRole("button", { name: "Undo", exact: true }).click(),
      );
      assert.equal((await doc()).layers.length, 2);
      await edit(() =>
        page.getByRole("button", { name: "Redo", exact: true }).click(),
      );
      assert.equal((await doc()).layers.length, 3);
      await edit(() =>
        page.getByRole("button", { name: "Delete", exact: true }).click(),
      );
      assert.equal((await doc()).layers.length, 2);
      scenarios.push(
        "no parameter-toggle shortcuts, custom palette, targeted visibility, duplicate, undo/redo and delete",
      );
      const exported = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export JSON", exact: true })
        .click();
      const download = await exported;
      const exportPath = join(out, "roundtrip.json");
      await download.saveAs(exportPath);
      const exportedDoc = JSON.parse(await readFile(exportPath, "utf8"));
      assert.deepEqual(exportedDoc, await doc());
      const beforeBad = JSON.stringify(await doc());
      await page.locator("input[type=file]").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"schemaVersion":99}'),
      });
      await page
        .getByRole("alert")
        .filter({ hasText: "Import rejected" })
        .waitFor();
      assert.equal(JSON.stringify(await doc()), beforeBad);
      await edit(() =>
        page.locator("input[type=file]").setInputFiles(exportPath),
      );
      assert.deepEqual(await doc(), exportedDoc);
      const pngDownload = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export PNG", exact: true })
        .click();
      await (await pngDownload).saveAs(join(out, "export.png"));
      assert.ok((await readFile(join(out, "export.png"))).length > 1000);
      scenarios.push(
        "JSON roundtrip, rejected import preserves state, PNG export",
      );
      // Save a named test project and remove only that project after verification.
      const title = "Browser verification " + Date.now();
      await page.getByLabel("Project title", { exact: true }).fill(title);
      const saved = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/projects") && r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Save project", exact: true })
        .click();
      const response = await saved;
      assert.equal(response.status(), 201);
      const record = await response.json();
      try {
        await edit(() =>
          page.getByRole("button", { name: "Delete", exact: true }).click(),
        );
        await page.locator("summary").filter({ hasText: "Saved projects" }).click();
        await edit(() =>
          page.getByRole("button", { name: new RegExp(title) }).click(),
        );
        assert.deepEqual(await doc(), record.document);
      } finally {
        await context.request.delete(base + "/api/projects/" + record.id);
      }
      await page.goto(base + "/studio");
      await rendered();
      assert.deepEqual(
        await doc(),
        exportedDoc,
        "local recovery after navigation",
      );
      scenarios.push(
        "Go save/load through Next proxy and local browser recovery",
      );
      await edit(() =>
        page
          .getByRole("button", { name: "Show field-marks", exact: true })
          .click(),
      );
      await selectInspectorTab("Style");
      await edit(() =>
        page.getByLabel(/Opacity/).evaluate((el) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(el, "0.35");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }),
      );
      await screenshot("studio-composition");
      await page.route("**/api/projects", (route) => route.abort());
      await page.goto(base + "/studio");
      await rendered();
      await page
        .getByRole("alert")
        .filter({ hasText: "Project service unavailable" })
        .waitFor();
      const offlinePixels = await pixels();
      await edit(() =>
        page.getByRole("button", { name: "New seed", exact: true }).click(),
      );
      assert.notEqual(
        await pixels(),
        offlinePixels,
        "local editing works without project service",
      );
      await page.unroute("**/api/projects");
      scenarios.push(
        "local rendering and editing remain available when Go service is offline",
      );
    }
    if (!galleryOnly) {
      await interactionChecks();
      await transformChecks();
    }
    await page.goto(base + "/api-reference");
    await page.locator(".api-list a").first().waitFor();
    assert.equal(
      await page.locator(".api-list a").count(),
      31,
      "31 API entries",
    );
    const operationLinks = await page
      .locator(".api-list a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const href of operationLinks) {
      await page.goto(base + href);
      await page.locator(".api-reference h1").waitFor();
      assert.ok(
        (await page.locator(".api-section").count()) >= 5,
        `${href} renders operation detail sections`,
      );
      assert.equal(
        await page
          .locator(
            'a[href^="catalog/"], a[href^="survey/"], a[href^="packages/"]',
          )
          .count(),
        0,
        `${href} has no raw repository links`,
      );
    }
    scenarios.push(
      "31 API index entries and rendered operation details without raw repository links",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator(".study-card").first().waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "mobile gallery no horizontal overflow",
    );
    await screenshot("gallery-mobile");
    await page.goto(base + "/techniques/field-marks");
    await rendered();
    assert.ok(
      await page
        .locator(".technique-playground canvas")
        .evaluate((c) => c.getBoundingClientRect().right <= innerWidth + 1),
      "mobile detail canvas fits frame",
    );
    await assertControlsAccessible();
    await screenshot("technique-mobile");
    if (!galleryOnly) {
      await page.goto(base + "/studio");
      await rendered();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "mobile studio no horizontal overflow",
      );
      await screenshot("studio-mobile");
    }
    scenarios.push(
      "responsive gallery, embedded example, and studio at 390px width",
    );
  }
  assert.deepEqual(errors, [], "browser runtime errors");
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(
      {
        status: "passed",
        scope:
          "Web app integration, not portable recipe or expanded catalog support.",
        scenarios,
        browser: browser.version(),
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status: "passed", scenarios }, null, 2));
} catch (error) {
  await screenshot("failure");
  await writeFile(
    join(out, "failure.txt"),
    String(error) + "\n" + errors.join("\n"),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
