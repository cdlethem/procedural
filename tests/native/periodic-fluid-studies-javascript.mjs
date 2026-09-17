/** Run under tools/with_native_render_lock.py. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startExternalExpansionServer } from '../../tools/serve_external_expansion_studies.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = path.resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? path.join(root, 'packages/javascript'));
const out = path.resolve(process.argv[2] ?? '.work/expansion-full/fluid/native');
assert.ok(out.startsWith(path.join(root, '.work') + path.sep)); await fs.mkdir(out, { recursive: true });
const hash = x => createHash('sha256').update(x).digest('hex');
const paths = ['examples/dye-currents/index.html', 'examples/dye-currents/sketch.js', 'examples/dye-currents/study.js', 'src/project-periodic-velocity-2d.js', 'src/advect-periodic-scalar-2d.js', 'src/diffuse-periodic-scalar-2d.js', 'src/internal/periodic-grid.js', 'src/marching-squares-2d.js', 'src/internal/systems-a-utils.js', 'src/default-palettes.js'];
const inputs = [...paths.map(p => path.join(packageRoot, p)), fileURLToPath(import.meta.url), path.join(root, 'tools/serve_external_expansion_studies.mjs'), path.join(root, '.work/environments/p5js/node_modules/p5/lib/p5.min.js')];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async p => [path.relative(root, p), hash(await fs.readFile(p))])));
const before = await hashes();
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.work/toolchains/playwright');
const { chromium } = await import(path.join(root, '.work/environments/p5js/node_modules/playwright/index.mjs'));
const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
const report = { status: 'running', scope: 'Original p5 Canvas2D periodic dye and texture study; no original artist recreation or GPU solver claim.', packageRoot, input_sha256_before: before, captures: [], checks: [], errors: [] };
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
  report.browser = browser.version();
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1180, height: 1100 } });
  page.on('pageerror', e => report.errors.push(String(e)));
  await page.goto(server.baseURL + '/examples/dye-currents/'); await page.waitForFunction(() => window.__study?.ready);
  assert.equal(await page.evaluate(() => p5.VERSION), '2.3.2');
  const snapshot = () => page.evaluate(() => window.__study.snapshot());
  const action = async name => { await page.evaluate(name => window.__study.action(name), name); await page.evaluate(() => new Promise(requestAnimationFrame)); };
  const capture = async name => {
    const state = await snapshot(); const file = path.join(out, `${name}.png`);
    await page.locator('canvas').screenshot({ path: file });
    report.captures.push({ name, image: path.relative(root, file), png_sha256: hash(await fs.readFile(file)), state_sha256: hash(JSON.stringify(state)), tick: state.tick, residualBefore: state.residualBefore, residualAfter: state.residualAfter });
    return state;
  };
  const baseline = await capture('startup');
  await action('step'); const thirty = await capture('flow-30'); assert.equal(thirty.tick, 30); assert.ok(thirty.residualAfter < thirty.residualBefore);
  for (let i = 0; i < 3; i++) await action('step'); const later = await capture('flow-120'); assert.equal(later.tick, 120);
  assert.notDeepEqual(later.dyes, baseline.dyes);
  await action('contours'); assert.deepEqual(await capture('soft-120'), later);
  await action('contours');
  await action('palette'); assert.deepEqual(await capture('midnight-120'), later);
  await action('save'); // next save checks a completed download below, first proves no state change.
  assert.deepEqual(await snapshot(), later);
  const displayed = Buffer.from((await page.locator('canvas').evaluate(c => c.toDataURL('image/png'))).split(',')[1], 'base64');
  const downloadPromise = page.waitForEvent('download'); await page.click('[data-action="save"]');
  const download = await downloadPromise; const saved = path.join(out, 'saved.png'); await download.saveAs(saved);
  const png = await fs.readFile(saved); assert.equal(hash(png), hash(displayed), 'saved PNG equals displayed canvas'); assert.deepEqual(await snapshot(), later); assert.equal(png.readUInt32BE(16), 720); assert.equal(png.readUInt32BE(20), 720);
  await action('reset'); assert.deepEqual(await snapshot(), baseline);
  await action('viscosity'); await action('step'); const viscous = await capture('viscous-30'); assert.notDeepEqual(viscous.u, thirty.u);
  await action('reset'); await action('injection'); await action('step'); const strong = await capture('strong-30'); assert.notDeepEqual(strong.u, thirty.u);
  await action('reset'); await action('projection'); await action('step'); const bypass = await capture('unprojected-30');
  assert.equal(bypass.residualBefore, bypass.residualAfter); assert.ok(bypass.residualAfter > thirty.residualAfter);
  await action('reset'); await action('texture'); const transferStart = await snapshot(); assert.deepEqual(transferStart.u, baseline.u); assert.notDeepEqual(transferStart.dyes, baseline.dyes);
  await action('step'); const transfer = await capture('striped-30'); assert.deepEqual(transfer.u, thirty.u); assert.deepEqual(transfer.v, thirty.v);
  await page.reload(); await page.waitForFunction(() => window.__study?.ready); assert.deepEqual(await snapshot(), baseline);
  await action('step'); assert.deepEqual(await snapshot(), thirty);
  report.checks = ['startup/30/120 state and residual', 'appearance preserves complete numerical state', 'injection and viscosity alter future flow', 'projection bypass retains divergence', 'texture substitution preserves velocity', 'reset/reload/exact replay', 'completed 720px PNG equals displayed canvas'];
  report.input_sha256_after = await hashes(); assert.deepEqual(report.input_sha256_after, before); assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack ?? error); throw error; }
finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server.close(); }
console.log(JSON.stringify({ status: report.status, out, captures: report.captures.length }));
