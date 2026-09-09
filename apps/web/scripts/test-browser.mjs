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
try {
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
    assert.equal(await page.locator('[data-render-status="error"]').count(), 0);
    assert.ok(
      (await artwork()).painted > 300,
      `${id} detail canvas has visible artwork`,
    );
    await page.locator(".source-panel summary").click();
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
  await screenshot("technique");
  scenarios.push(
    "24 shared detail renderers, inline source, numeric and palette pixel changes",
  );
  if (!process.argv.includes("--gallery-only")) {
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
    }
    scenarios.push(
      "24 studio technique renderers mount without browser errors",
    );
    await page.goto(base + "/studio?technique=field-marks");
    await rendered();
    const baseline = await pixels();
    await page.locator(".canvas-wrap canvas").evaluate((c) => {
      window.__fullPixels = Array.from(
        c.getContext("2d").getImageData(0, 0, 640, 640).data,
      );
    });
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
    assert.equal((await doc()).layers[0].opacity, 0.5);
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
    await page.keyboard.press("r");
    await page.keyboard.press("]");
    await page.waitForTimeout(150);
    assert.equal(
      JSON.stringify(await doc()),
      beforeKeys,
      "studio has no global keyboard shortcuts",
    );
    const beforeStudioPalette = await pixels();
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
    await edit(() =>
      page.getByLabel("Add layer", { exact: true }).selectOption("path-marks"),
    );
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
    assert.equal((await doc()).layers[0].visible, false);
    assert.equal((await doc()).layers[1].visible, true);
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
      "no global shortcuts, custom palette, targeted visibility, duplicate, undo/redo and delete",
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
    await page.getByRole("button", { name: "Export PNG", exact: true }).click();
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
  await page.goto(base + "/api-reference");
  await page.locator(".api-list a").first().waitFor();
  assert.equal(await page.locator(".api-list a").count(), 31, "31 API entries");
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
  await screenshot("technique-mobile");
  if (!process.argv.includes("--gallery-only")) {
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
