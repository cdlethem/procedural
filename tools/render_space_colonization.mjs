#!/usr/bin/env node
/** Render the space-colonization study across its construction controls under the shared lease.
 * Run with: python3 tools/with_native_render_lock.py -- node tools/render_space_colonization.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startExternalExpansionServer } from "./serve_external_expansion_studies.mjs";

const root = resolve(".");
const out = join(root, ".work/expansion-full/sc-review");
await mkdir(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, ".work/toolchains/playwright");
const { chromium } = await import(join(root, ".work/environments/p5js/node_modules/playwright/index.mjs"));
const server = await startExternalExpansionServer();
const browser = await chromium.launch({ headless: true });

const statusText = page => page.locator("#status").textContent();
const shot = async (page, name) => {
  await page.locator("#art canvas").screenshot({ path: join(out, name) });
  return (await statusText(page)).trim();
};
const parse = status => {
  const branch = /(\d+)-way/.exec(status);
  const spread = /spread ([\d.]+)/.exec(status);
  return { branch: branch ? Number(branch[1]) : null, spread: spread ? Number(spread[1]) : null };
};

const page = await (await browser.newContext({ viewport: { width: 900, height: 760 } })).newPage();
const problems = [];
try {
  await page.goto(server.baseURL + "/examples/space-colonization/", { waitUntil: "networkidle" });
  await page.waitForSelector("#art canvas");
  const report = { study: "space-colonization", stages: {} };

  // Set a schedule by cycling the Branches/Spread buttons until the status matches.
  const setSchedule = async (branch, spread) => {
    for (const [key, want] of [["b", branch], ["a", spread]]) {
      for (let i = 0; i < 8; i++) {
        const cur = parse((await statusText(page)).trim());
        if ((key === "b" ? cur.branch : cur.spread) === want) break;
        await page.click(`button[data-action="${key}"]`);
      }
    }
  };
  const growFull = async () => {
    for (let guard = 0; guard < 400; guard++) {
      const status = (await statusText(page)).trim();
      if (status.includes("144/144") || /· 0 tips ·/.test(status)) break;
      await page.click('button[data-action="."]');
    }
  };

  report.stages.default = await shot(page, "sc-default.png");
  await setSchedule(3, 0.6);
  report.stages.branches3 = await shot(page, "sc-branches3.png");
  await setSchedule(4, 0.6);
  report.stages.branches4 = await shot(page, "sc-branches4.png");
  await setSchedule(1, 0.6);
  report.stages.branches1 = await shot(page, "sc-branches1.png");
  await setSchedule(2, 0.9);
  report.stages.spread09 = await shot(page, "sc-spread09.png");
  await setSchedule(2, 0.3);
  report.stages.spread03 = await shot(page, "sc-spread03.png");
  await setSchedule(2, 0.6);
  await page.click('button[data-action="y"]');
  await growFull();
  report.stages.full = await shot(page, "sc-full.png");

  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.stages.full.includes("144/144")) problems.push("full did not reach 144/144: " + report.stages.full);
} catch (error) {
  problems.push(String(error));
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
