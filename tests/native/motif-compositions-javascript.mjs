#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startCoverageStudiesServer } from "../../tools/serve_survey_coverage_studies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(process.argv[2]);
const packageRoot = path.resolve(process.env.PROCEDURALS_PACKAGE_ROOT || path.join(root, "packages/javascript"));
const sourceRoot = path.join(packageRoot, "src");
const p5Bundle = path.join(root, ".work/environments/p5js/node_modules/p5/lib/p5.min.js");
const slugs = ["ornament-poster", "geometric-panel", "orbital-brush"];
assert.ok(out.startsWith(path.join(root, ".work") + path.sep), "output must be under .work");
await fs.mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".work/toolchains/playwright");
const { chromium } = await import(path.join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));

const sha = (value) => createHash("sha256").update(value).digest("hex");

function importedFiles(source, from) {
  const imports = source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g);
  return [...imports]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith("."))
    .map((specifier) => path.resolve(path.dirname(from), specifier));
}

/** Resolve every local source dependency under the package core, once. */
async function coreDependencyFiles(entry) {
  const discovered = new Set();
  const visit = async (file) => {
    if (discovered.has(file)) return;
    discovered.add(file);
    const source = await fs.readFile(file, "utf8");
    for (const imported of importedFiles(source, file)) {
      const resolved = path.extname(imported) ? imported : `${imported}.js`;
      if (resolved.startsWith(sourceRoot + path.sep)) await visit(resolved);
    }
  };
  await visit(entry);
  return [...discovered].sort();
}

const helper = path.join(packageRoot, "examples/motif-compositions/compositions.js");
const fieldHelper = path.join(packageRoot, "examples/motif-compositions/field-records.js");
const orbitalHelper = path.join(packageRoot, "examples/motif-compositions/orbital-records.js");
const sourceFiles = [
  fileURLToPath(import.meta.url),
  path.join(root, "tools/serve_survey_coverage_studies.mjs"),
  p5Bundle,
  ...await coreDependencyFiles(helper),
  ...await coreDependencyFiles(fieldHelper),
  ...await coreDependencyFiles(orbitalHelper),
  ...slugs.flatMap((slug) => [
    path.join(packageRoot, "examples", slug, "index.html"),
    path.join(packageRoot, "examples", slug, "sketch.js"),
  ]),
];

const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [
  path.relative(root, file),
  sha(await fs.readFile(file)),
])));

const before = await hashes();
const server = await startCoverageStudiesServer(0, { packageRoot });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"],
  });
  const results = [];

  for (const slug of slugs) {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1000, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort());
    const ready = async (previous = -1) => {
      await page.waitForFunction((revision) => Number(document.querySelector("#art")?.dataset.revision) > revision, previous);
      assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready");
    };

    await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${slug}/index.html`);
    await ready();
    const capture = async (label) => {
      const info = await page.evaluate(() => {
        const canvas = document.querySelector("#art canvas");
        return {
          data: canvas.toDataURL(),
          anchors: document.querySelector("#art").dataset.anchors,
          geometry: document.querySelector("#art").dataset.geometry,
          revision: document.querySelector("#art").dataset.revision,
          status: document.querySelector("#status").textContent,
        };
      });
      const png = Buffer.from(info.data.split(",")[1], "base64");
      await fs.writeFile(path.join(out, `${slug}-${label}.png`), png);
      delete info.data;
      return { label, sha256: sha(png), ...info };
    };
    const action = async (name, label) => {
      const old = Number(await page.locator("#art").getAttribute("data-revision"));
      await page.locator(`button[data-action="${name}"]`).click();
      await ready(old);
      return capture(label);
    };

    const baseline = await capture("baseline");
    if (slug !== "orbital-brush") {
      const edit = async (key, value, label) => {
        const old = Number(await page.locator("#art").getAttribute("data-revision"));
        const input = page.locator(`[data-key="${key}"]`);
        if (typeof value === "boolean") value ? await input.check() : await input.uncheck();
        else if (await input.evaluate((node) => node.tagName === "SELECT")) await input.selectOption(String(value));
        else { await input.fill(String(value)); await input.press("Tab"); }
        await ready(old);
        return capture(label);
      };
      const unchanged = (value, expected, label) => assert.equal(value, expected, `${slug}: ${label}`);
      const alpha = await page.locator("#art canvas").evaluate((canvas) => canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]);
      assert.equal(alpha, 0, `${slug}: saved artwork remains transparent`);
      const palette = await edit("paletteId", "orchid-chalk", "palette");
      unchanged(palette.geometry, baseline.geometry, "palette edit retains mark geometry");
      unchanged(palette.anchors, baseline.anchors, "palette edit retains anchors");
      assert.notEqual(palette.sha256, baseline.sha256, `${slug}: palette changes pixels`);

      const shapeKey = slug === "ornament-poster" ? "petalWeight" : "wedgeWeight";
      const shape = await edit(shapeKey, 0, "shape-mix");
      unchanged(shape.anchors, baseline.anchors, "shape weights retain anchors");
      assert.notEqual(shape.geometry, baseline.geometry, `${slug}: shape weights change selected families`);
      const turned = await edit("angle", 83.5, "turned");
      unchanged(turned.anchors, baseline.anchors, "angle retains anchors");
      assert.notEqual(turned.geometry, shape.geometry, `${slug}: angle changes local mark orientation`);
      const shifted = await edit("offsetX", 76.25, "shifted");
      assert.notEqual(shifted.anchors, baseline.anchors, `${slug}: x offset moves anchors`);
      const beforePoints = JSON.parse(turned.anchors), afterPoints = JSON.parse(shifted.anchors);
      assert.ok(afterPoints.every((point, index) => point.at(-1) === beforePoints[index].at(-1) &&
        point.at(-2) === beforePoints[index].at(-2) + 76.25), `${slug}: x offset changes only x`);

      const structural = slug === "ornament-poster"
        ? await edit("layout", "grid", "ordered-grid")
        : await edit("columns", 11, "eleven-columns");
      assert.notEqual(structural.anchors, shifted.anchors, `${slug}: layout structure changes anchors`);
      let transfer;
      if (slug === "ornament-poster") {
        await edit("emblemWeight", 10, "some-emblems");
        transfer = await edit("leafWeight", 0, "emblem-transfer");
        assert.ok(JSON.parse(transfer.geometry).every((mark) => mark.kind === "emblems"), "ornament: emblem-only transfer");
      } else {
        await edit("rows", 4, "four-rows");
        await edit("barWeight", 1, "few-bars");
        transfer = await edit("arcWeight", 3, "arc-transfer");
        const marks = JSON.parse(transfer.geometry);
        assert.ok(marks.some((mark) => mark.kind === "arcs") && marks.every((mark) =>
          mark.kind === "bars" || mark.kind === "arcs"), "panel: asymmetric bar/arc transfer");
      }
      assert.notEqual(transfer.sha256, baseline.sha256, `${slug}: transfer changes full image`);

      const reset = await action("reset", "reset");
      unchanged(reset.sha256, baseline.sha256, "reset restores initial image");
      await page.reload();
      await ready();
      const reload = await capture("reload");
      unchanged(reload.sha256, baseline.sha256, "reload deterministic");
      const revision = await page.locator("#art").getAttribute("data-revision");
      const download = page.waitForEvent("download");
      await page.locator('button[data-action="save"]').click();
      await (await download).saveAs(path.join(out, `${slug}-saved.png`));
      unchanged(await page.locator("#art").getAttribute("data-revision"), revision, "save does not repaint");
      unchanged(sha(await fs.readFile(path.join(out, `${slug}-saved.png`))), baseline.sha256, "save matches displayed image");
      assert.deepEqual(errors, []);
      await page.close();
      results.push({ slug, baseline, palette, shape, turned, shifted, structural, transfer, reset, reload, alpha });
      continue;
    }
    const edit = async (key, value, label) => {
      const old = Number(await page.locator("#art").getAttribute("data-revision"));
      const input = page.locator(`[data-key="${key}"]`);
      if (typeof value === "boolean") value ? await input.check() : await input.uncheck();
      else if (await input.evaluate((node) => node.tagName === "SELECT")) await input.selectOption(String(value));
      else { await input.fill(String(value)); await input.press("Tab"); }
      await ready(old);
      return capture(label);
    };
    const alpha = await page.locator("#art canvas").evaluate((canvas) => canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]);
    assert.equal(alpha, 0, "orbital: transparent canvas corner");
    const palette = await edit("paletteId", "electric-citrus", "palette");
    assert.equal(palette.geometry, baseline.geometry, "orbital: palette retains sampled path geometry");
    assert.notEqual(palette.sha256, baseline.sha256, "orbital: palette changes pixels");
    const ribbons = await edit("marks", "ribbons", "ribbons");
    assert.equal(ribbons.geometry, baseline.geometry, "orbital: ribbon brush retains sampled paths");
    assert.notEqual(ribbons.sha256, palette.sha256, "orbital: ribbon treatment changes pixels");
    const wide = await edit("markSize", 5, "wide-ribbons");
    assert.equal(wide.geometry, baseline.geometry, "orbital: mark size retains sampled paths");
    assert.notEqual(wide.sha256, ribbons.sha256, "orbital: mark size changes pixels");
    const shifted = await edit("centerX", 410, "shifted");
    assert.notEqual(shifted.geometry, wide.geometry, "orbital: moving centre changes sampled paths");
    const beforePoints = JSON.parse(wide.anchors), afterPoints = JSON.parse(shifted.anchors);
    assert.ok(afterPoints.every((path, pathIndex) => path.every((point, index) =>
      Math.abs(point[0] - beforePoints[pathIndex][index][0] - 50) < 1e-9 &&
      Math.abs(point[1] - beforePoints[pathIndex][index][1]) < 1e-9)),
      "orbital: moving centre X translates every sampled point only horizontally");
    const ellipse = await edit("source", "ellipse", "ellipses");
    assert.notEqual(ellipse.geometry, shifted.geometry, "orbital: source shape changes sampled paths");
    await edit("source", "wave", "waves");
    await edit("lobes", 11, "eleven-lobes");
    await edit("depth", -0.38, "negative-depth");
    await edit("marks", "dashes", "dashes");
    const transfer = await edit("markSpacing", 0, "every-sample-dashes");
    assert.notEqual(transfer.geometry, ellipse.geometry, "orbital: wave transfer changes retained paths");
    assert.notEqual(transfer.sha256, ellipse.sha256, "orbital: transfer changes image");
    const beforeInvalid = Number(await page.locator("#art").getAttribute("data-revision"));
    await page.locator('[data-key="paths"]').fill("2048");
    await page.locator('[data-key="paths"]').press("Tab");
    assert.equal(Number(await page.locator("#art").getAttribute("data-revision")), beforeInvalid,
      "orbital: combined work overflow does not repaint");
    assert.match(await page.locator("#status").textContent(), /64000-point/);
    const reset = await action("reset", "reset");
    assert.equal(reset.sha256, baseline.sha256, "orbital: reset returns baseline");
    await page.reload();
    await ready();
    const reload = await capture("reload");
    assert.equal(reload.sha256, baseline.sha256, "orbital: reload deterministic");

    const revision = await page.locator("#art").getAttribute("data-revision");
    const download = page.waitForEvent("download");
    await page.locator('button[data-action="save"]').click();
    await (await download).saveAs(path.join(out, `${slug}-saved.png`));
    assert.equal(await page.locator("#art").getAttribute("data-revision"), revision);
    assert.equal(sha(await fs.readFile(path.join(out, `${slug}-saved.png`))), baseline.sha256, "orbital: save preserves displayed baseline");
    assert.deepEqual(errors, []);
    await page.close();
    results.push({ slug, baseline, palette, ribbons, wide, shifted, ellipse, transfer, reset, reload, alpha });
  }

  const after = await hashes();
  assert.deepEqual(after, before, "source files remain stable");
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({
    status: "passed",
    scope: "Actual p5 2.3.2 Canvas2D motifs: field/matrix weights and structural transfer; orbital source paths, resampled geometry, mark substitution, center translation, work-budget rejection; transparent canvases, reset/reload/save.",
    package_root: packageRoot,
    browser: browser.version(),
    input_sha256_before: before,
    input_sha256_after: after,
    results,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "passed", out, studies: slugs }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
