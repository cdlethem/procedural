/** Run through tools/with_native_render_lock.py with pinned p5 2.3.2. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root = resolve(".");
const out = resolve(process.argv[2] ?? ".work/gallery-quality/native-material-relief");
assert.ok(out.startsWith(join(root, ".work") + "/"));
await mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, ".work/toolchains/playwright");
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-accelerated-2d-canvas"] });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = { scope: "candidate editable p5 relief studies; no shared acceptance", browser: browser.version(), studies: [] };

try {
  for (const study of [
    { slug: "embossed-field", global: "embossedFieldStudy", source: "cutout", treatment: "tiles", numeric: "gain", numericValue: "3" },
    { slug: "signed-edge-print", global: "signedEdgePrintStudy", source: "mounds", treatment: "tiles", numeric: "cutoff", numericValue: "0.5" },
  ]) {
    const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1120, height: 1180 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${server.baseURL}/examples/${study.slug}/index.html`);
    await page.waitForFunction((name) => window[name]?.snapshot().renderStatus === "ready", study.global);
    const snapshot = () => page.evaluate((name) => window[name].snapshot(), study.global);
    const png = async () => Buffer.from((await page.locator("#art canvas").evaluate((canvas) => canvas.toDataURL("image/png"))).split(",")[1], "base64");
    const capture = async (name) => {
      const file = join(out, `${study.slug}-${name}.png`);
      const bytes = await png();
      await writeFile(file, bytes);
      return { name, file, sha256: sha(bytes), state: await snapshot() };
    };
    const captures = [await capture("default")];
    const baseline = captures[0];
    const cornerAlpha = await page.locator("#art canvas").evaluate((canvas) =>
      canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]);
    assert.equal(cornerAlpha, 0, `${study.slug}: exported layer leaves the margin transparent`);
    const choose = async (name, value) => {
      const before = (await snapshot()).revision;
      await page.locator(`[name="${name}"]`).selectOption(value);
      await page.waitForFunction(({ global, before }) => window[global].snapshot().revision > before, { global: study.global, before });
    };
    const enter = async (name, value) => {
      const before = (await snapshot()).revision;
      await page.locator(`[name="${name}"]`).fill(value);
      await page.waitForFunction(({ global, before }) => window[global].snapshot().revision > before, { global: study.global, before });
    };
    const edits = [
      ["source", study.source, "source"],
      ["axis", study.slug === "embossed-field" ? "vertical" : "horizontal", "axis"],
      ["treatment", study.treatment, "treatment"],
      ["scale", "18", "pixel-size"],
      [study.numeric, study.numericValue, "response-strength"],
      ["seed", "71", "seed"],
      ["palette", "1", "palette"],
    ];
    for (const [name, value, label] of edits) {
      const before = sha(await png());
      if (["source", "axis", "treatment", "palette"].includes(name)) await choose(name, value);
      else await enter(name, value);
      const after = sha(await png());
      assert.notEqual(after, before, `${study.slug}: ${label} changes the visible canvas`);
      assert.equal((await snapshot()).renderStatus, "ready");
      if (["source", "treatment", "palette"].includes(name)) captures.push(await capture(label));
    }
    const beforeInvalid = await snapshot(), beforeInvalidPNG = sha(await png());
    await page.locator('[name="scale"]').fill("2");
    assert.deepEqual(await snapshot(), beforeInvalid, `${study.slug}: invalid pixel size does not mutate applied state`);
    assert.equal(sha(await png()), beforeInvalidPNG);
    assert.match(await page.locator("#status").textContent(), /outside its accepted range|Use pixel size/);
    await page.locator('[data-action="reset"]').click();
    await page.waitForFunction(({ global, before }) => window[global].snapshot().revision > before, { global: study.global, before: beforeInvalid.revision });
    const reset = await capture("reset");
    captures.push(reset);
    assert.equal(reset.sha256, baseline.sha256, `${study.slug}: reset restores exact canvas`);
    assert.deepEqual({ ...reset.state, revision: baseline.state.revision }, baseline.state);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="save"]').click();
    const download = await downloadPromise;
    const saved = join(out, `${study.slug}-saved.png`);
    await download.saveAs(saved);
    assert.equal(sha(await readFile(saved)), reset.sha256, `${study.slug}: saved PNG matches displayed canvas`);
    assert.deepEqual(errors, [], `${study.slug}: no page errors`);
    report.studies.push({ slug: study.slug, captures, saved, errors });
    await page.close();
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`native relief controls passed ${report.studies.length} studies`);
} finally {
  await browser.close();
  await server.close();
}
