#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, sep, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SANDBOX = resolve(ROOT, "tools/harness/sandbox");
const MAX_DIAGNOSTICS = 20;
const MAX_DIAGNOSTIC_CHARS = 400;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isoNow = () => new Date().toISOString();
const bounded = (items) => items.map((x) => String(x).replace(/\s+/g, " ").trim().slice(0, MAX_DIAGNOSTIC_CHARS)).filter(Boolean).slice(-MAX_DIAGNOSTICS);
const inside = (path, parent) => { const r = relative(resolve(parent), resolve(path)); return r === "" || (!r.startsWith(`..${sep}`) && r !== ".." && !r.startsWith(sep)); };

function atomicJson(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  return writeFile(temp, `${JSON.stringify(value)}\n`, "utf8").then(() => import("node:fs/promises")).then(({rename}) => rename(temp, path));
}
async function readSpec(path) { return JSON.parse(await readFile(path, "utf8")); }
async function fileDigest(path) { const bytes = await readFile(path); return {bytes, sha256: sha256(bytes)}; }
async function stopBrowser(context, profile) {
  if (!context) return;
  let closed = false;
  const closePromise = context.close().then(() => { closed = true; }).catch(() => { closed = true; });
  await Promise.race([closePromise, new Promise((resolveClose) => setTimeout(resolveClose, 1500))]);
  if (closed) return;
  try {
    const {readdir, readFile: readProc} = await import("node:fs/promises");
    for (const name of await readdir("/proc")) {
      if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
      try {
        const cmdline = (await readProc(`/proc/${name}/cmdline`)).toString();
        if (cmdline.includes(`--user-data-dir=${profile}`)) process.kill(Number(name), "SIGKILL");
      } catch {}
    }
  } catch {}
}

const argv = process.argv.slice(2);
const jobArg = argv[argv.indexOf("--job") + 1];
let spec;
let resultPath;
let startedAt = isoNow();
let diagnostics = [];
let deniedRequests = [];
let wroteResult = false;
function resultBase(status, stage, code, message) {
  return {status, stage, code, message: String(message).slice(0, 400), diagnostics: bounded(diagnostics), deniedRequests: [...new Set(deniedRequests)].slice(0, 100), startedAt, finishedAt: isoNow()};
}
async function finish(result) {
  if (wroteResult || !resultPath) return;
  wroteResult = true;
  await atomicJson(resultPath, result);
}
function addDiagnostic(value) { diagnostics.push(String(value)); diagnostics = diagnostics.slice(-MAX_DIAGNOSTICS); }

async function main() {
  if (!jobArg) throw new Error("--job is required");
  const jobPath = resolve(jobArg);
  spec = await readSpec(jobPath);
  resultPath = resolve(spec.resultPath);
  if (!inside(resultPath, resolve(ROOT, ".work/harness/jobs"))) throw new Error("result path outside harness jobs");
  if (spec.jobSpecVersion !== 1) throw new Error("unsupported jobSpecVersion");
  const sourceRoot = resolve(spec.sourceDirectory);
  const workDir = resolve(spec.workDirectory);
  if (!inside(sourceRoot, resolve(ROOT, ".work/harness/artifacts")) || !inside(workDir, resolve(ROOT, ".work/harness/jobs"))) throw new Error("job paths outside harness storage");
  await mkdir(workDir, {recursive: true});
  const sourceRecords = [];
  for (const record of spec.sourceFiles || []) {
    if (!record || typeof record.path !== "string" || resolve(sourceRoot, record.path) !== resolve(sourceRoot, record.path.replaceAll("\\", "/")) || record.path.startsWith("/") || record.path.split(/[\\/]/).includes("..")) throw new Error("invalid source file path");
    const path = resolve(sourceRoot, record.path);
    if (!inside(path, sourceRoot)) throw new Error("source file escapes source directory");
    try { if (!inside(await realpath(path), sourceRoot)) throw new Error("source asset escapes source directory"); } catch (error) { if (/escapes/.test(String(error))) throw error; throw new Error(`missing source file: ${record.path}`); }
    let digest;
    try { digest = await fileDigest(path); } catch { throw new Error(`missing source file: ${record.path}`); }
    if (digest.sha256 !== record.sha256 || (record.bytes !== undefined && digest.bytes.length !== record.bytes)) throw new Error(`source asset changed: ${record.path}`);
    sourceRecords.push({record, path, bytes: digest.bytes});
  }
  const entry = sourceRecords.find((x) => x.record.path === spec.entrypoint);
  if (!entry) throw new Error("entrypoint is not a verified source file");
  const p5Path = resolve(ROOT, "apps/web/node_modules/p5/lib/p5.min.js");
  const packageRoot = resolve(ROOT, "packages/javascript/src");
  const p5 = await fileDigest(p5Path);
  const packageFiles = [];
  async function walk(dir) {
    const {readdir} = await import("node:fs/promises");
    const entries = await readdir(dir, {withFileTypes: true});
    for (const item of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile() && item.name.endsWith(".js")) { const d = await fileDigest(path); packageFiles.push({path: relative(ROOT, path).split(sep).join("/"), sha256: d.sha256, bytes: d.bytes.length}); }
    }
  }
  await walk(packageRoot);
  const hostBytes = await readFile(resolve(SANDBOX, "host.mjs"));
  const indexBytes = await readFile(resolve(SANDBOX, "index.html"));
  const runtimeInputs = {runnerProfile: spec.runnerProfile, p5: sha256(p5.bytes), packageFiles, host: sha256(hostBytes), index: sha256(indexBytes), sourceFiles: sourceRecords.map((x) => ({path: x.record.path, sha256: x.record.sha256}))};
  const runtimeHash = sha256(Buffer.from(JSON.stringify(runtimeInputs)));
  const controls = {entrypoint: spec.entrypoint, controls: spec.controls || {}, tick: spec.tick, width: 640, height: 640, pixelDensity: 1, randomSeed: spec.randomSeed, noiseSeed: spec.noiseSeed};
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const headers = {"Content-Security-Policy": "default-src 'none'; script-src 'self' 'sha256-Phxi3VRxEujAWorXynHKGKTWMPy5FW5VrvMoWkFdER8='; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff"};
    let body = null; let type = "text/plain; charset=utf-8";
    try {
      if (url.pathname === "/") { body = await readFile(resolve(SANDBOX, "index.html")); type = "text/html; charset=utf-8"; }
      else if (url.pathname === "/host.mjs") { body = hostBytes; type = "text/javascript; charset=utf-8"; }
      else if (url.pathname === "/p5.min.js") { body = p5.bytes; type = "text/javascript; charset=utf-8"; }
      else if (url.pathname.startsWith("/layer/")) { const rel = decodeURIComponent(url.pathname.slice(7)); const found = sourceRecords.find((x) => x.record.path === rel); if (found) { body = found.bytes; type = "text/javascript; charset=utf-8"; } }
      else if (url.pathname.startsWith("/pkg/") && url.pathname.endsWith(".js")) { const rel = decodeURIComponent(url.pathname.slice(5)); const path = resolve(packageRoot, rel); if (inside(path, packageRoot) && path.endsWith(".js")) { body = await readFile(path); type = "text/javascript; charset=utf-8"; } }
    } catch { body = null; }
    if (!body) { res.writeHead(404, headers); res.end("Not found"); return; }
    res.writeHead(200, {...headers, "Content-Type": type, "Cache-Control": "no-store"}); res.end(body);
  });
  await new Promise((resolvePromise, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolvePromise); });
  const port = server.address().port;
  let browser = null; let context = null; let profile = null;
  try {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve(ROOT, ".work/toolchains/playwright");
    const {chromium} = await import(pathToFileURL(resolve(ROOT, "apps/web/node_modules/playwright/index.mjs")).href);
    profile = resolve(workDir, "browser-profile"); await mkdir(profile, {recursive: true});
    context = await chromium.launchPersistentContext(profile, {headless: true, viewport: {width: 640, height: 640}, deviceScaleFactor: 1, args: ["--disable-gpu", "--no-sandbox"]});
    browser = context.browser();
    const page = context.pages()[0] || await context.newPage();
    const origin = `http://127.0.0.1:${port}`;
    page.on("request", (request) => { try { if (new URL(request.url()).origin !== origin) deniedRequests.push(request.url()); } catch { deniedRequests.push(request.url()); } });
    await page.route("**/*", async (route) => { try { if (new URL(route.request().url()).origin !== origin) await route.abort(); else await route.continue(); } catch { await route.abort().catch(() => {}); } });
    page.on("console", (message) => { if (message.type() === "error") addDiagnostic(message.text()); });
    page.on("pageerror", (error) => addDiagnostic(error.stack || error.message));
    const timeoutMs = Math.max(1, Number(spec.limits.renderSeconds) * 1000);
    const config = encodeURIComponent(JSON.stringify(controls));
    let timedOut = false;
    const resultPromise = (async () => {
      await page.goto(`${origin}/?c=${config}`, {waitUntil: "load", timeout: timeoutMs});
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) { const value = await page.evaluate(() => window.__harnessResult || null).catch(() => null); if (value) return value; await new Promise((r) => setTimeout(r, 20)); }
      throw new Error("render deadline exceeded");
    })();
    let message;
    try { message = await Promise.race([resultPromise, new Promise((_, reject) => setTimeout(() => {timedOut = true; reject(new Error("render deadline exceeded"));}, timeoutMs))]); }
    catch (error) {
      if (timedOut || /deadline exceeded|Timeout/i.test(String(error))) { addDiagnostic(String(error)); await finish({...resultBase("failed", "render", "RESOURCE_EXHAUSTED", "render time limit exceeded")}); return; }
      addDiagnostic(error.stack || error.message || error); await finish({...resultBase("failed", "render", "RUNTIME_FAILURE", "layer execution failed")}); return;
    }
    try { deniedRequests.push(...await page.evaluate(() => window.__harnessDeniedRequests || [])); } catch {}
    if (!message || !message.ok) { await finish({...resultBase("failed", "render", "RUNTIME_FAILURE", "layer execution failed")}); return; }
    let png;
    try { png = Buffer.from(message.png, "base64"); } catch { png = Buffer.alloc(0); }
    if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || png.readUInt32BE(16) !== 640 || png.readUInt32BE(20) !== 640 || png.length > Number(spec.limits.outputBytes)) { addDiagnostic(`PNG check bytes=${png.length} ihdrWidth=${png.length >= 20 ? png.readUInt32BE(16) : -1} ihdrHeight=${png.length >= 24 ? png.readUInt32BE(20) : -1}`); await finish({...resultBase("failed", "render", "RUNTIME_FAILURE", "invalid PNG output")}); return; }
    const minAlpha = Number(message.minAlpha); if (!Number.isInteger(minAlpha) || minAlpha < 0 || minAlpha > 255) { await finish({...resultBase("failed", "render", "RUNTIME_FAILURE", "invalid alpha measurement")}); return; }
    const outputPath = resolve(spec.outputPath); if (!inside(outputPath, workDir)) throw new Error("output path outside work directory"); await mkdir(dirname(outputPath), {recursive: true}); await writeFile(outputPath, png);
    const outputDigest = sha256(png);
    await finish({...resultBase("succeeded", "render", undefined, "render completed"), imagePath: outputPath, imageSha256: outputDigest, imageBytes: png.length, minAlpha, runtimeHash, dependencyHashes: [{path: "p5.min.js", sha256: p5.sha256, bytes: p5.bytes.length}, ...packageFiles]});
  } finally {
    await stopBrowser(context, profile);
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}
main().then(() => {
  process.exit(0);
}).catch(async (error) => {
  addDiagnostic(error.stack || error.message || error);
  await finish(resultBase("failed", "render", /missing|changed|asset/i.test(String(error)) ? "MISSING_ASSET" : "RUNTIME_FAILURE", String(error))).catch(() => {});
  process.exit(1);
});
