#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raymarchImplicitRays3D as query, RaymarchImplicitRays3DError } from '../../packages/javascript/src/raymarch-implicit-rays-3d.js';
import { startExternalExpansionServer } from '../../tools/serve_external_expansion_studies.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? join(root, 'packages/javascript'));
const sha = value => createHash('sha256').update(value).digest('hex');
const relativePath = path => relative(root, path).split(sep).join('/');
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);

function pure() {
  const fixture = JSON.parse(readFileSync(join(root, 'fixtures/operations/raymarch-implicit-rays-3d.json')));
  for (const vector of fixture.cases) {
    if (vector.error) assert.throws(() => query(vector.input), error => error instanceof RaymarchImplicitRays3DError && error.code === vector.error, vector.id);
    else assert.deepStrictEqual(query(vector.input), vector.output, vector.id);
  }
  const oracle = JSON.parse(readFileSync(join(root, 'tests/native/fixtures/implicit-ray-oracles.json')));
  for (const vector of oracle.cases) {
    const actual = query(vector.input), expected = vector.expected;
    const tolerance = vector.id === 'off_axis_sphere_central_difference' ? { path: ['results', 0, 'normal'], value: 1e-12 } :
      { path: ['results', 0, 'fieldValue'], value: 2e-16 };
    const extract = (object, path) => path.reduce((value, key) => value[key], object);
    const actualNumber = extract(actual, tolerance.path), expectedNumber = extract(expected, tolerance.path);
    if (Array.isArray(actualNumber)) for (let i = 0; i < actualNumber.length; i++)
      assert.ok(Math.abs(actualNumber[i] - expectedNumber[i]) <= tolerance.value, `${vector.id}/${i}`);
    else assert.ok(Math.abs(actualNumber - expectedNumber) <= tolerance.value, vector.id);
    const clone = structuredClone(actual), copy = structuredClone(expected);
    let a = clone, b = copy;
    for (const key of tolerance.path.slice(0, -1)) { a = a[key]; b = b[key]; }
    a[tolerance.path.at(-1)] = null; b[tolerance.path.at(-1)] = null;
    assert.deepStrictEqual(clone, copy, `${vector.id} structure`);
  }
  const base = structuredClone(fixture.cases[0].input);
  const bad = (mutation, code = 'INVALID_INPUT') => {
    const value = structuredClone(base); mutation(value);
    assert.throws(() => query(value), error => error.code === code);
  };
  bad(value => { value.maxDistance = Infinity; value.maxWork = 0; });
  bad(value => { value.rays[0].direction[1] = NaN; });
  bad(value => { value.rays[0].direction = [0, 0, 0]; });
  bad(value => { value.scene.center = [, 0, 0]; });
  bad(value => { value.scene.center.extra = 1; });
  bad(value => { value.rays[0].extra = 1; });
  bad(value => { value.scene.radius = -1; value.maxWork = 0; });
  let accessorCalls = 0;
  const accessor = structuredClone(base);
  Object.defineProperty(accessor.scene, 'radius', { get() { accessorCalls++; throw Error('must not read'); } });
  assert.throws(() => query(accessor), error => error.code === 'INVALID_INPUT');
  assert.equal(accessorCalls, 0);
  const cycle = structuredClone(base); cycle.scene = { kind: 'translateUniform', translation: [0, 0, 0], scale: 1 }; cycle.scene.child = cycle.scene;
  assert.throws(() => query(cycle), error => error.code === 'INVALID_INPUT');
  const shared = structuredClone(base), leaf = shared.scene;
  shared.scene = { kind: 'union', left: leaf, right: leaf };
  assert.throws(() => query(shared), error => error.code === 'INVALID_INPUT');
  const sharedArray = structuredClone(base), center = [0, 0, 0];
  sharedArray.scene = { kind: 'union', left: { kind: 'sphere', center, radius: 1 }, right: { kind: 'sphere', center, radius: 1 } };
  assert.throws(() => query(sharedArray), error => error.code === 'INVALID_INPUT');
  const before = structuredClone(base), output = query(base);
  output.results[0].position[0] = 99; output.results[0].normal[0] = 99;
  assert.deepStrictEqual(base, before);
  assert.deepStrictEqual(query(base), fixture.cases[0].output, 'detached replay');
  return fixture.cases.length + oracle.cases.length + 12;
}

async function native(pureCases) {
  const output = process.argv[2] === '--output' ? resolve(process.argv[3]) : null;
  if (output && (!output.startsWith(join(root, '.work') + sep) || existsSync(output))) throw Error('Fresh .work output required');
  const directory = output ? dirname(output) : join(root, '.work/implicit-rays-native'); mkdirSync(directory, { recursive: true });
  const sources = [fileURLToPath(import.meta.url), join(root, 'tools/serve_external_expansion_studies.mjs'),
    join(packageRoot, 'src/raymarch-implicit-rays-3d.js'), join(packageRoot, 'src/internal/fdlibm-hypot.js'),
    ...files(join(packageRoot, 'examples/implicit-volumes')),
    join(root, 'catalog/operations/raymarch-implicit-rays-3d.json'),
    join(root, 'fixtures/operations/raymarch-implicit-rays-3d.json'),
    join(root, 'tests/native/fixtures/implicit-ray-oracles.json'),
    join(root, '.work/environments/p5js/node_modules/p5/lib/p5.min.js')];
  const hashes = () => Object.fromEntries(sources.map(path => [relativePath(path), sha(readFileSync(path))]));
  const before = hashes();
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, '.work/toolchains/playwright');
  const { chromium } = await import(join(root, '.work/environments/p5js/node_modules/playwright/index.mjs'));
  const server = await startExternalExpansionServer(0, { packageRoot }); let browser;
  const report = { status: 'running', scope: 'Pure CPU hit records and editable p5 raster study with independently supplied perforated-shell scene; no target acceptance.',
    runtime: 'p5 2.3.2 Canvas2D density1', package_root: packageRoot, pure_cases: pureCases, input_sha256_before: before, frames: [] };
  try {
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 800, height: 850 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(String(error.stack ?? error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${server.baseURL}/examples/implicit-volumes/index.html`);
    await page.waitForFunction(() => document.querySelector('#art')?.dataset.renderStatus === 'ready' && Boolean(window.implicitVolumes?.snapshot), null, { timeout: 30000 });
    const observe = () => page.evaluate(() => window.implicitVolumes.snapshot());
    async function capture(label) {
      const state = await observe(), dataUrl = await page.locator('#art canvas').evaluate(canvas => canvas.toDataURL('image/png'));
      const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
      const path = join(directory, `${label}.png`); writeFileSync(path, bytes);
      writeFileSync(join(directory, `${label}.json`), JSON.stringify(state, null, 2) + '\n');
      const frame = { label, state, png_sha256: sha(bytes), png_path: relativePath(path), png_bytes: bytes.length,
        query_ms: await page.evaluate(() => window.implicitVolumes.lastQueryMs()) };
      report.frames.push({ label, png_sha256: frame.png_sha256, png_path: frame.png_path, png_bytes: frame.png_bytes,
        state_sha256: sha(JSON.stringify(state)), query_ms: frame.query_ms }); return frame;
    }
    async function action(key) {
      const old = Number(await page.locator('#art').getAttribute('data-revision'));
      await page.locator(`button[data-action="${key}"]`).click();
      if (key !== 's') await page.waitForFunction(value => Number(document.querySelector('#art')?.dataset.revision) > value, old, { timeout: 30000 });
    }
    const baseline = await capture('baseline');
    const baselineDepths = await page.evaluate(() => window.implicitVolumes.records().map(row => row.distance));
    const structure = await page.evaluate(() => {
      const rows = window.implicitVolumes.records(), width = 192, height = 168;
      const mask = rows.map(row => row.distance !== null ? 1 : 0);
      const occupied = mask.reduce((sum, value) => sum + value, 0);
      const columns = Array.from({ length: width }, (_, x) => {
        let hits = 0; for (let y = 0; y < height; y++) hits += mask[y * width + x]; return hits;
      });
      const centerDepth = rows[Math.floor(height / 2) * width + Math.floor(width / 2)].distance;
      return { total: rows.length, occupied, columns, centerDepth,
        statuses: [...new Set(rows.map(row => row.kind))], normals: rows.filter(row => row.normal !== null).length };
    });
    report.structure = { total: structure.total, occupied: structure.occupied, centerDepth: structure.centerDepth,
      statuses: structure.statuses, normals: structure.normals, nonemptyColumns: structure.columns.filter(value => value > 0).length };
    assert.equal(structure.total, 192 * 168);
    assert.ok(structure.occupied > 1000 && structure.occupied < structure.total * 0.8, 'bounded silhouette occupancy');
    assert.ok(structure.columns.filter(value => value > 0).length > 50, 'wide anisotropic silhouette');
    assert.ok(structure.normals > 1000, 'surface normals evaluated');
    assert.equal(baseline.state.stats.counts.hit_epsilon + baseline.state.stats.counts.inside_start, structure.occupied);
    await action('b'); const hard = await capture('hard-union');
    assert.notEqual(hard.png_sha256, baseline.png_sha256); assert.notDeepEqual(hard.state.stats, baseline.state.stats);
    await action('0'); await action('c'); const uncut = await capture('uncut-vessel');
    assert.notEqual(uncut.png_sha256, baseline.png_sha256);
    const uncutDepths = await page.evaluate(() => window.implicitVolumes.records().map(row => row.distance));
    const changedDepths = uncutDepths.filter((value, index) => value !== baselineDepths[index]).length;
    assert.ok(changedDepths > 150, 'cut changes visible primary depth records');
    report.cut_changed_depths = changedDepths;
    await action('0'); await action('a'); const rotated = await capture('rotated-view');
    assert.notEqual(rotated.png_sha256, baseline.png_sha256);
    await action('0'); await action('v'); const builtInTransfer = await capture('perforated-shell');
    assert.notEqual(builtInTransfer.png_sha256, baseline.png_sha256);
    await action('0');
    const independentScene = { kind: 'difference',
      left: { kind: 'sphere', center: [0, 0, 0], radius: 1.26 },
      right: { kind: 'union',
        left: { kind: 'axisBox', center: [-0.32, 0.04, 0.97], halfExtents: [0.15, 1.04, 0.62] },
        right: { kind: 'sphere', center: [0.55, -0.29, 1.01], radius: 0.41 } } };
    await page.evaluate(scene => window.implicitVolumes.setScene(scene), independentScene);
    const supplied = await capture('supplied-scene-transfer');
    assert.deepStrictEqual(supplied.state.suppliedScene, independentScene);
    assert.notEqual(supplied.png_sha256, baseline.png_sha256);
    const transferCheck = await page.evaluate(() => {
      const rows = window.implicitVolumes.records();
      return { hits: rows.filter(row => row.distance !== null).length,
        depth: rows.filter(row => row.distance !== null).map(row => row.distance).sort((a,b) => a-b),
        central: rows[84 * 192 + 96] };
    });
    assert.equal(transferCheck.hits, supplied.state.stats.counts.hit_epsilon + supplied.state.stats.counts.inside_start);
    assert.ok(transferCheck.hits > 1000 && transferCheck.hits !== structure.occupied);
    assert.ok(transferCheck.depth[0] < transferCheck.depth.at(-1), 'depth variation');
    report.transfer_structure = { hits: transferCheck.hits, depth_min: transferCheck.depth[0],
      depth_max: transferCheck.depth.at(-1), central_kind: transferCheck.central.kind };
    await action('0'); const reset = await capture('reset');
    assert.deepStrictEqual(reset.state, baseline.state); assert.equal(reset.png_sha256, baseline.png_sha256);
    await page.reload(); await page.waitForFunction(() => document.querySelector('#art')?.dataset.renderStatus === 'ready' && Boolean(window.implicitVolumes?.snapshot), null, { timeout: 30000 });
    const reload = await capture('reload'); assert.deepStrictEqual(reload.state, baseline.state); assert.equal(reload.png_sha256, baseline.png_sha256);
    const beforeSave = await observe(); const visible = Buffer.from((await page.locator('#art canvas').evaluate(canvas => canvas.toDataURL('image/png'))).split(',')[1], 'base64');
    const download = page.waitForEvent('download'); await action('s');
    const saved = join(directory, 'saved.png'); await (await download).saveAs(saved);
    assert.deepStrictEqual(await observe(), beforeSave); assert.equal(sha(readFileSync(saved)), sha(visible));
    report.saved_png_sha256 = sha(readFileSync(saved));
    assert.deepStrictEqual(errors, []); report.browser_errors = errors;
    report.input_sha256_after = hashes(); assert.deepStrictEqual(report.input_sha256_after, before);
    report.status = 'passed'; await page.close();
  } catch (error) { report.status = 'failed'; report.failure = String(error.stack ?? error); throw error; }
  finally { await browser?.close(); await server.close(); writeFileSync(output ?? join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
  return { status: report.status, report: output ?? join(directory, 'report.json'), frames: report.frames.length };
}

const count = pure();
if (process.argv[2] === '--pure') console.log(JSON.stringify({ status: 'passed', pure_cases: count }));
else console.log(JSON.stringify(await native(count)));
