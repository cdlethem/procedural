#!/usr/bin/env node
// Run under tools/with_native_render_lock.py. Captures actual examples, never synthetic thumbnails.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
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
let server;
if (!process.env.WEB_BASE_URL) {
  server = createServer(async (req, res) => {
    try {
      const publicRoot = join(app, "public"),
        file = resolve(
          publicRoot,
          "." +
            decodeURIComponent(new URL(req.url, "http://localhost").pathname),
        );
      if (!file.startsWith(publicRoot + "/")) throw Error("path");
      const body = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
}
const base =
  process.env.WEB_BASE_URL ?? `http://127.0.0.1:${server.address().port}`;
const out = join(root, ".work/web-app-review/previews");
await mkdir(out, { recursive: true });
await mkdir(join(app, "public/previews"), { recursive: true });
const gallery = JSON.parse(
  await readFile(join(app, "lib/generated-gallery.json"), "utf8"),
);
const browser = await chromium
  .launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-accelerated-2d-canvas",
    ],
  })
  .catch((error) => {
    server?.close();
    throw error;
  });
const results = [];
try {
  for (const t of gallery.techniques) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 1100 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      await page.goto(base + t.exampleUrl);
      await page.waitForFunction(
        () => Number(document.querySelector("#art")?.dataset.revision) >= 1,
        {},
        { timeout: 45000 },
      );
      const canvas = page.locator("#art canvas").first();
      const pixels = await canvas.screenshot();
      await writeFile(join(out, t.slug + ".png"), pixels);
      await writeFile(join(app, "public/previews", t.slug + ".png"), pixels);
      const status = await page.locator("#status").textContent();
      if (errors.length) throw Error(errors.join("\n"));
      results.push({
        slug: t.slug,
        status: "passed",
        message: status,
        sha256: createHash("sha256").update(pixels).digest("hex"),
        image: `.work/web-app-review/previews/${t.slug}.png`,
      });
      console.log(`${t.slug}: rendered`);
    } catch (e) {
      results.push({
        slug: t.slug,
        status: "failed",
        error: String(e),
        errors,
      });
      console.error(`${t.slug}: ${e}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((r) => (server ? server.close(r) : r()));
}
await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    {
      scope:
        "Actual p5 2.3.2 gallery example mounting and initial rendering; not all controls or corpus reproduction.",
      browser: "Chromium",
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => r.status === "failed")) process.exitCode = 1;
