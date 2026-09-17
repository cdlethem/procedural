/** Candidate native p5 mesh-control review. Run through the shared native render lease. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = resolve(".");
const out = resolve(process.argv[2] ?? ".work/gallery-quality/native-mesh-modern");
assert.ok(out.startsWith(join(root, ".work") + "/"));
await mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const cases = [
  ["extruded-seals", "footprint", "stepped", "facets"],
  ["stepped-blocks", "footprint", "beveled", "bands"],
  ["transported-ribbons", "endWidth", "8", "facets"],
  ["twisting-streamers", "verticalCycles", "0.5", "bands"],
  ["rounded-polyhedra", "axisY", "0.6", "facets"],
  ["subdivided-shells", "base", "tetra", "bands"],
];
const report = { scope: "candidate editable native p5 mesh controls and transparent PNG; no shared acceptance", browser: browser.version(), studies: [] };
try {
  for (const [slug, sourceKey, sourceValue, faceMode] of cases) {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1150, height: 1200 } });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${server.baseURL}/examples/${slug}/index.html`);
    const ready = async before => {
      await page.waitForFunction(previous => {
        const art = document.querySelector("#art");
        return art?.dataset.renderStatus === "error" || Number(art?.dataset.revision) > previous;
      }, before);
      assert.equal(await page.locator("#art").getAttribute("data-render-status"), "ready", await page.locator("#status").textContent());
    };
    await ready(0);
    const snapshot = () => page.evaluate(() => window.meshStudy.snapshot());
    const png = async () => Buffer.from((await page.locator("#art canvas").evaluate(canvas => canvas.toDataURL("image/png"))).split(",")[1], "base64");
    const capture = async name => {
      const bytes = await png(), file = join(out, `${slug}-${name}.png`);
      await writeFile(file, bytes);
      return { name, file, sha256: sha(bytes), state: await snapshot() };
    };
    const defaultFrame = await capture("default");
    assert.equal(await page.locator("#art canvas").evaluate(canvas => canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]), 0,
      `${slug}: clear canvas corner has alpha zero`);
    const change = async (key, value) => {
      const before = (await snapshot()).revision;
      const input = page.locator(`[name="${key}"]`);
      if (await input.evaluate(element => element.tagName === "SELECT")) await input.selectOption(value);
      else { await input.fill(value); await input.press("Tab"); }
      await ready(before);
    };
    await change(sourceKey, sourceValue);
    const source = await capture("source");
    assert.notEqual(source.sha256, defaultFrame.sha256, `${slug}: source edit changes pixels`);
    await change("pitch", String(Number(source.state.params.pitch) + .2));
    const view = await capture("pitch");
    assert.notEqual(view.sha256, source.sha256, `${slug}: camera pitch changes pixels`);
    await change("faceMode", faceMode);
    const surface = await capture("surface");
    assert.notEqual(surface.sha256, view.sha256, `${slug}: surface treatment changes pixels`);
    await change("weight", "0");
    const noEdges = await capture("no-edges");
    assert.notEqual(noEdges.sha256, surface.sha256, `${slug}: zero outline weight changes pixels`);
    const beforePalette = (await snapshot()).revision;
    await page.locator('[data-action="c"]').click(); await ready(beforePalette);
    const alternate = await capture("palette");
    assert.notEqual(alternate.sha256, noEdges.sha256, `${slug}: palette changes pixels`);
    if (slug === "stepped-blocks") {
      const prior = await snapshot(), priorPNG = sha(await png());
      await page.locator('[name="inset"]').fill("150");
      await page.locator('[name="inset"]').press("Tab");
      assert.deepEqual(await snapshot(), prior, "invalid footprint retains applied state");
      assert.equal(sha(await png()), priorPNG, "invalid footprint retains prior canvas");
    }
    const beforeReset = (await snapshot()).revision;
    await page.locator('[data-action="0"]').click(); await ready(beforeReset);
    const reset = await capture("reset");
    assert.equal(reset.sha256, defaultFrame.sha256, `${slug}: reset restores exact PNG`);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="s"]').click();
    const download = await downloadPromise;
    const saved = join(out, `${slug}-saved.png`);
    await download.saveAs(saved);
    assert.equal(sha(await readFile(saved)), reset.sha256, `${slug}: transparent saved PNG equals canvas`);
    assert.deepEqual(errors, [], `${slug}: no page errors`);
    const frames = [defaultFrame, source, view, surface, noEdges, alternate, reset];
    if (slug === "rounded-polyhedra") {
      await change("base", "patch");
      await change("zoom", "1.4");
      await change("cornerLift", "85");
      const patch = await capture("open-patch");
      assert.notEqual(patch.sha256, defaultFrame.sha256, "open patch is a distinct mesh input");
      frames.push(patch);
    }
    report.studies.push({ slug, frames, saved, errors });
    await page.close();
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`native mesh controls passed ${report.studies.length} studies`);
} finally {
  await browser.close();
  await server.close();
}
