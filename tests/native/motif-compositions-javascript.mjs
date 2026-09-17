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
const sourceFiles = [
  fileURLToPath(import.meta.url),
  path.join(root, "tools/serve_survey_coverage_studies.mjs"),
  p5Bundle,
  ...await coreDependencyFiles(helper),
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
    const motif = await action("m", "motif");
    let transfer = null;
    if (slug === "ornament-poster") transfer = await action("m", "emblem-transfer");
    const palette = await action("c", "palette");
    assert.equal(motif.geometry, baseline.geometry, `${slug}: motif substitution preserves full geometry`);
    assert.equal(motif.anchors, baseline.anchors, `${slug}: motif substitution preserves every anchor`);
    assert.equal(palette.geometry, baseline.geometry, `${slug}: palette substitution preserves full geometry`);
    assert.equal(palette.anchors, baseline.anchors, `${slug}: palette substitution preserves every anchor`);
    assert.notEqual(motif.sha256, baseline.sha256, `${slug}: motif redraw changes pixels`);
    assert.notEqual(palette.sha256, motif.sha256, `${slug}: palette redraw changes pixels`);
    if (transfer) {
      assert.equal(transfer.geometry, baseline.geometry, "ornament: emblem transfer preserves full geometry");
      assert.equal(transfer.anchors, baseline.anchors, "ornament: emblem transfer preserves anchors");
      assert.notEqual(transfer.sha256, motif.sha256, "ornament: emblem transfer changes pixels");
    }

    let hierarchy = null;
    let crop = null;
    if (slug === "ornament-poster") {
      hierarchy = await action("h", "uniform-scale");
      assert.equal(hierarchy.anchors, baseline.anchors, "ornament: scale edit preserves anchors");
      assert.notEqual(hierarchy.geometry, baseline.geometry, "ornament: scale edit changes full geometry");
      crop = await action("x", "full-field");
      assert.equal(crop.anchors, baseline.anchors, "ornament: crop edit preserves anchors");
      assert.notEqual(crop.geometry, hierarchy.geometry, "ornament: crop edit changes full geometry");
    }

    const structural = await action("d", "structural");
    assert.notEqual(structural.geometry, baseline.geometry, `${slug}: structural edit rebuilds full geometry`);
    assert.notEqual(structural.anchors, baseline.anchors, `${slug}: structural edit rebuilds anchors`);
    const reset = await action("0", "reset");
    assert.equal(reset.sha256, baseline.sha256, `${slug}: reset returns baseline`);
    await page.reload();
    await ready();
    const reload = await capture("reload");
    assert.equal(reload.sha256, baseline.sha256, `${slug}: reload deterministic`);

    const revision = await page.locator("#art").getAttribute("data-revision");
    const download = page.waitForEvent("download");
    await page.keyboard.press("s");
    await (await download).saveAs(path.join(out, `${slug}-saved.png`));
    assert.equal(await page.locator("#art").getAttribute("data-revision"), revision);
    assert.equal(sha(await fs.readFile(path.join(out, `${slug}-saved.png`))), baseline.sha256, `${slug}: save preserves displayed baseline`);
    assert.deepEqual(errors, []);
    await page.close();
    results.push({ slug, baseline, motif, transfer, palette, hierarchy, crop, structural, reset, reload });
  }

  const after = await hashes();
  assert.deepEqual(after, before, "source files remain stable");
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify({
    status: "passed",
    scope: "Actual p5 2.3.2 Canvas2D motifs: full unrounded retained-record comparison, anchor comparison, motif/palette substitutions, ornament transfer/scale/crop edits, structural edit, reset, reload, save and deterministic replay.",
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
