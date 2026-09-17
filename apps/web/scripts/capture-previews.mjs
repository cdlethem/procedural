#!/usr/bin/env node
/** Capture the running app's studio adapters, not standalone native examples. */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const base = (process.env.WEB_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
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
const landingOnly = process.argv.includes("--landing");
const variant = landingOnly ? "landing" : "";
const out = join(root, ".work/web-app-review/previews", variant);
const previewDir = join(app, "public/previews", variant);
await mkdir(out, { recursive: true });
await mkdir(previewDir, { recursive: true });
const gallery = JSON.parse(
  await readFile(join(app, "lib/generated-gallery.json"), "utf8"),
);

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-accelerated-2d-canvas",
    ],
  });
} catch (error) {
  throw new Error(
    `Could not launch preview browser for ${base}: ${String(error)}`,
  );
}
const results = [];
try {
  if (landingOnly) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    try {
      const response = await page.goto(base, { waitUntil: "networkidle", timeout: 45000 });
      if (!response?.ok()) throw new Error(`Landing page returned HTTP ${response?.status()}`);
      await page.locator('[data-render-status="ready"]').waitFor({ timeout: 45000 });
      await page.getByRole("button", { name: "Pause rotation", exact: true }).click();
      const choices = page.getByRole("group", { name: "Choose a live study", exact: true }).getByRole("button");
      const count = await choices.count();
      if (!count) throw new Error("Landing carousel has no studies");
      for (let index = 0; index < count; index += 1) {
        await choices.nth(index).click();
        await page.locator('[data-active-study] [data-ready="true"]').waitFor({ timeout: 45000 });
        const slug = await page.locator("[data-active-study]").getAttribute("data-active-study");
        const encoded = await page.locator('[data-render-status="ready"] canvas').evaluate((canvas) => {
          if (canvas.width !== 640 || canvas.height !== 640) throw new Error("Expected native 640px canvas");
          return canvas.toDataURL("image/png");
        });
        if (errors.length) throw new Error(errors.join("\n"));
        const image = Buffer.from(encoded.slice(encoded.indexOf(",") + 1), "base64");
        await writeFile(join(out, `${slug}.png`), image);
        await writeFile(join(previewDir, `${slug}.png`), image);
        results.push({
          slug, status: "passed",
          sha256: createHash("sha256").update(image).digest("hex"),
          image: `.work/web-app-review/previews/landing/${slug}.png`,
        });
        console.log(`${slug}: rendered with landing palette`);
      }
    } finally {
      await page.close();
    }
  } else {
  for (const technique of gallery.techniques) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 1100 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    try {
      const response = await page.goto(`${base}/techniques/${technique.slug}`, {
        waitUntil: "networkidle",
        timeout: 45000,
      });
      if (!response?.ok())
        throw new Error(
          `Technique page returned HTTP ${response?.status() ?? "no response"}`,
        );
      await page
        .locator('[data-render-status="ready"]')
        .waitFor({ timeout: 45000 });
      if (await page.locator('[data-render-status="error"]').count())
        throw new Error("Studio adapter reported a render error");
      if (errors.length) throw new Error(errors.join("\n"));
      const encoded = await page
        .locator(".canvas-wrap canvas")
        .evaluate((canvas) => {
          if (canvas.width !== 640 || canvas.height !== 640)
            throw new Error(
              `Expected native 640 canvas, got ${canvas.width}x${canvas.height}`,
            );
          return canvas.toDataURL("image/png");
        });
      const image = Buffer.from(
        encoded.slice(encoded.indexOf(",") + 1),
        "base64",
      );
      await writeFile(join(out, `${technique.slug}.png`), image);
      await writeFile(
        join(previewDir, `${technique.slug}.png`),
        image,
      );
      results.push({
        slug: technique.slug,
        status: "passed",
        sha256: createHash("sha256").update(image).digest("hex"),
        image: `.work/web-app-review/previews/${technique.slug}.png`,
      });
      console.log(`${technique.slug}: rendered by app adapter`);
    } catch (error) {
      results.push({
        slug: technique.slug,
        status: "failed",
        error: String(error),
        errors,
      });
      console.error(`${technique.slug}: ${error}`);
    } finally {
      await page.close();
    }
  }
  }
} finally {
  await browser.close();
}
await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    {
      scope:
        landingOnly
          ? "Default landing studies with their curated palettes, captured from the real 640px renderer; not corpus acceptance."
          : "Default app-adapter renders captured from running technique pages as native 640px canvas PNGs; this is preview evidence, not native-example or corpus acceptance.",
      browser: "Chromium",
      sourceBinding: {
        version: gallery.studioBinding.version,
        catalogSha256: gallery.studioBinding.catalogSha256,
        ...(landingOnly ? { landingSourceSha256: createHash("sha256").update(await readFile(join(app, "components/LandingStudy.tsx"))).digest("hex") } : {}),
      },
      results,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(previewDir, "manifest.json"),
  JSON.stringify(
    {
      sourceBinding: {
        version: gallery.studioBinding.version,
        catalogSha256: gallery.studioBinding.catalogSha256,
      },
      results,
    },
    null,
  ) + "\n",
);
if (results.some((result) => result.status === "failed")) process.exitCode = 1;
