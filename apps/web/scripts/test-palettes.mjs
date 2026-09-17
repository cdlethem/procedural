#!/usr/bin/env node
/** Run under tools/with_native_render_lock.py. Palette storage and browser rendering are live. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defaultPalettes } from '../../../packages/javascript/src/default-palettes.js';
const base = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3010';
const out = resolve('.work/palettes/browser'); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage(), errors = [], ids = new Set(), scenarios = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('response', async response => { if (response.url().endsWith('/harness/palettes') && response.request().method() === 'POST' && response.ok()) { const body = await response.json(); ids.add(body.palette.id); } });
const name = 'Coastal verification ' + Date.now();
const colors = ['#113355', '#7a9e9f', '#d9c7a9', '#d98a7e'];
const builtIn = defaultPalettes[0];
const representativeDefaults = [defaultPalettes[0], defaultPalettes[1], defaultPalettes[2]];
const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('procedurals-studio-v1')));
const ready = async () => { await page.locator('[data-render-status="ready"]').waitFor({ timeout: 45000 }); if (await page.locator('.studio-workspace').count()) await page.locator('.studio-workspace[data-hydrated="true"]').waitFor(); };
const save = async () => { const response = page.waitForResponse(r => r.url().endsWith('/harness/palettes') && ['POST', 'PUT'].includes(r.request().method())); await page.getByRole('button', { name: 'Save palette', exact: true }).click(); assert.ok((await response).ok()); await page.getByRole('heading', { name: 'Your palettes', exact: true }).waitFor(); };
const choose = async (paletteName, action = 'Apply to layer') => { await page.getByRole('dialog', { name: 'Saved palettes', exact: true }).getByRole('article', { name: paletteName, exact: true }).getByRole('button', { name: action, exact: true }).click(); };
const capture = async name => page.screenshot({ path: resolve(out, name + '.png') });
try {
  // Defaults are source data, so they remain useful while the optional saved-palette
  // service is unavailable and never create a record until the user saves a draft.
  await page.route('**/harness/palettes', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, json: { error: 'Palette service unavailable for offline check' } })
    : route.continue());
  await page.goto(base + '/palettes');
  const defaultCard = page.getByRole('article', { name: builtIn.name, exact: true });
  await defaultCard.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Default palettes', exact: true }).count(), 1);
  assert.equal(await defaultCard.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
  assert.equal(await defaultCard.getByRole('button', { name: 'Delete', exact: true }).count(), 0);
  await page.getByLabel('Search palettes', { exact: true }).fill(builtIn.tags[0]);
  assert.equal(await defaultCard.count(), 1);
  await defaultCard.getByRole('button', { name: 'Customize', exact: true }).click();
  assert.equal(await page.getByLabel('Palette name', { exact: true }).inputValue(), builtIn.name);
  for (let i = 0; i < builtIn.colors.length; i++) assert.equal(await page.getByLabel(`Library color ${i + 1} hex`, { exact: true }).inputValue(), builtIn.colors[i]);
  await page.getByLabel('Library color 1 hex', { exact: true }).fill('#000000');
  assert.deepEqual(builtIn.colors, defaultPalettes[0].colors);
  assert.equal(ids.size, 0, 'customizing a built-in does not write to the palette store');
  await page.getByRole('button', { name: 'Back to library', exact: true }).click();
  await page.unroute('**/harness/palettes');
  scenarios.push('Built-in defaults stay available when the saved service fails; tag search and Customize use detached unsaved copies without store writes');

  await page.goto(base + '/palettes');
  await page.getByRole('button', { name: 'Create palette', exact: true }).click();
  await page.getByLabel('Palette name', { exact: true }).fill(name);
  for (let i = 0; i < colors.length; i++) await page.getByLabel(`Library color ${i + 1} hex`, { exact: true }).fill(colors[i]);
  await page.getByRole('button', { name: 'Move color 1 later', exact: true }).click();
  await page.getByRole('button', { name: 'Move color 2 earlier', exact: true }).click();
  await page.getByLabel('Library color 1 hex', { exact: true }).fill('#bad');
  assert.equal(await page.getByRole('button', { name: 'Save palette', exact: true }).isDisabled(), true);
  await page.getByLabel('Library color 1 hex', { exact: true }).fill(colors[0]);
  await capture('manual-editor'); await save();
  await page.reload(); await page.getByRole('article', { name, exact: true }).waitFor();
  scenarios.push('Manual hex/picker editor, ordering, invalid color guard, save and reload');
  await page.getByRole('article', { name, exact: true }).getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByLabel('Palette name', { exact: true }).fill(name + ' copy'); await save();
  const card = page.getByRole('article', { name: name + ' copy', exact: true });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Palette name', { exact: true }).fill(name + ' renamed'); await save();
  await capture('library');
  const renamed = page.getByRole('article', { name: name + ' renamed', exact: true });
  await renamed.getByRole('button', { name: 'Delete', exact: true }).click();
  await renamed.getByRole('button', { name: 'Delete palette', exact: true }).click();
  await renamed.waitFor({ state: 'detached' });
  scenarios.push('Duplicate, rename, and delete through real collection storage');

  await page.goto(base + '/studio?technique=field-marks'); await ready();
  const before = await doc();
  const beforePixels = await page.locator('canvas').first().evaluate(canvas => canvas.toDataURL());
  await page.getByRole('tab', { name: 'Style', exact: true }).click();
  await page.getByRole('button', { name: 'Saved palettes', exact: true }).click(); await choose(name);
  await page.waitForFunction(colors => JSON.stringify(JSON.parse(localStorage.getItem('procedurals-studio-v1')).layers[0].content.palette) === JSON.stringify(colors), colors.map(color => parseInt(color.slice(1), 16)));
  const applied = await doc();
  assert.deepEqual({ ...applied.layers[0].content, palette: before.layers[0].content.palette }, before.layers[0].content);
  await page.waitForFunction(pixels => document.querySelector('canvas').toDataURL() !== pixels, beforePixels);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForFunction(document => JSON.stringify(JSON.parse(localStorage.getItem('procedurals-studio-v1')).layers[0].content.palette) === JSON.stringify(document.layers[0].content.palette), before); assert.deepEqual(await doc(), before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await page.waitForFunction(document => JSON.stringify(JSON.parse(localStorage.getItem('procedurals-studio-v1')).layers[0].content.palette) === JSON.stringify(document.layers[0].content.palette), applied); assert.deepEqual(await doc(), applied);
  await page.goto(base + "/studio"); await ready(); assert.deepEqual(await doc(), applied);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const exportPath = resolve(out, 'palette-export.json'); await (await download).saveAs(exportPath); assert.deepEqual(JSON.parse(await readFile(exportPath)), applied); await page.keyboard.press('Escape');
  scenarios.push('Saved palette changes actual workflow pixels; geometry unchanged; undo/redo, recovery and JSON export preserve exact colors');

  await page.getByRole('tab', { name: 'Style', exact: true }).click();
  await page.getByRole('button', { name: 'Saved palettes', exact: true }).click(); await choose(builtIn.name);
  const builtinNumbers = builtIn.colors.map(color => parseInt(color.slice(1), 16));
  await page.waitForFunction(colors => JSON.stringify(JSON.parse(localStorage.getItem('procedurals-studio-v1')).layers[0].content.palette) === JSON.stringify(colors), builtinNumbers);
  const builtinApplied = await doc();
  assert.deepEqual({ ...builtinApplied.layers[0].content, palette: applied.layers[0].content.palette }, applied.layers[0].content);
  await page.getByLabel('Palette color 1 hex', { exact: true }).fill('#000000');
  assert.deepEqual(builtIn.colors, defaultPalettes[0].colors);
  scenarios.push('A built-in palette applies as detached colors to a Studio layer; later layer edits leave immutable default data unchanged');

  await page.getByRole('tab', { name: 'Style', exact: true }).click();
  await page.getByRole('button', { name: 'Saved palettes', exact: true }).click();
  await page.getByRole('button', { name: 'Save current layer colors', exact: true }).click();
  const currentLayerColors = ['#000000', ...builtIn.colors.slice(1)];
  for (let i = 0; i < currentLayerColors.length; i++) assert.equal(await page.getByLabel(`Library color ${i + 1} hex`, { exact: true }).inputValue(), currentLayerColors[i]);
  await page.setViewportSize({ width: 390, height: 844 }); await capture('mobile-editor');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (let i = currentLayerColors.length; i < 12; i++) await page.getByRole('button', { name: 'Add palette color', exact: true }).click();
  await page.getByLabel('Library color 12 hex', { exact: true }).fill('#ff8844');
  await page.getByLabel('Library color 12 hex', { exact: true }).scrollIntoViewIfNeeded();
  const last = await page.getByLabel('Library color 12 hex', { exact: true }).boundingBox(); assert.ok(last.y + last.height <= 844);
  const close = await page.getByRole('button', { name: 'Close saved palettes' }).boundingBox(); assert.ok(close.y >= 0 && close.y + close.height < 844);
  await page.keyboard.press('Escape');
  await capture('mobile-studio');
  scenarios.push('Save current layer colors; twelve-color modal scroll stays bounded on mobile and Escape closes it');
  await page.setViewportSize({ width: 1440, height: 900 });

  const generated = { name: 'Coastal prompt draft', colors: ['#1b3a57', '#7a9e9f', '#d4e5e2', '#d9c7a9', '#d98a7e'] };
  await page.goto(base + '/palettes');
  await page.getByRole('button', { name: 'Create palette', exact: true }).click();
  await page.getByLabel('Palette prompt', { exact: true }).fill('Muted coastal colors with sand and coral');
  await page.route('**/harness/palettes/generate', route => route.fulfill({ json: { palette: generated } }));
  await page.getByRole('button', { name: 'Generate colors', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Colors ready' }).waitFor();
  assert.equal(await page.getByLabel('Palette name', { exact: true }).inputValue(), generated.name);
  for (let i = 0; i < 5; i++) assert.equal(await page.getByLabel(`Library color ${i + 1} hex`, { exact: true }).inputValue(), generated.colors[i]);
  await capture('prompt-editor');
  await page.unroute('**/harness/palettes/generate');
  await page.route('**/harness/palettes/generate', route => route.fulfill({ status: 422, json: { error: 'Model unavailable for failure check' } }));
  await page.getByRole('button', { name: 'Generate colors', exact: true }).click(); await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Library color 1 hex', { exact: true }).inputValue(), generated.colors[0]);
  const collection = await (await page.request.get(base + '/harness/palettes')).json(); assert.equal(collection.palettes.some(p => p.name === generated.name), false);
  scenarios.push('Prompt response populates editable unsaved draft; model failure preserves it');

  await page.goto(base + '/techniques/cell-mosaic'); await ready();
  await page.getByRole('button', { name: 'Saved palettes', exact: true }).click(); await choose(name);
  assert.equal(await page.getByLabel('Palette color 1 hex', { exact: true }).inputValue(), colors[0]);
  scenarios.push('Same saved palette applies in standalone gallery study controls');

  for (const [index, study] of ['cell-mosaic', 'flow-needles', 'rounded-panels'].entries()) {
    const palette = representativeDefaults[index];
    await page.goto(base + `/techniques/${study}`); await ready();
    const beforePixels = await page.locator('canvas').first().evaluate(canvas => canvas.toDataURL());
    await page.getByRole('button', { name: 'Saved palettes', exact: true }).click(); await choose(palette.name);
    for (let color = 0; color < palette.colors.length; color++) assert.equal(await page.getByLabel(`Palette color ${color + 1} hex`, { exact: true }).inputValue(), palette.colors[color]);
    await page.waitForFunction(before => document.querySelector('canvas')?.toDataURL() !== before, beforePixels);
    await capture(`default-${study}`);
  }
  scenarios.push('Three representative gallery studies render after applying three distinct built-in defaults');

  await page.goto(base + '/palettes');
  await page.setViewportSize({ width: 390, height: 844 });
  const defaultCards = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Customize', exact: true }) });
  assert.equal(await defaultCards.count(), defaultPalettes.length);
  await capture('mobile-defaults');
  await defaultCards.last().scrollIntoViewIfNeeded();
  const finalDefault = await defaultCards.last().boundingBox(); assert.ok(finalDefault && finalDefault.y >= 0 && finalDefault.y < 844);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture('mobile-defaults-last');
  await page.setViewportSize({ width: 1440, height: 900 });
  scenarios.push('All built-in default cards remain reachable without horizontal overflow on a 390px viewport');

  let captured;
  await page.route('**/harness/tool', route => route.fulfill({ json: { ok: true, documentHandle: 'palette-browser-context' } }));
  await page.route('**/harness/run', route => { captured = route.request().postDataJSON(); return route.fulfill({ json: { ok: false, error: { message: 'Prompt payload captured for UI test' } } }); });
  await page.goto(base + '/studio'); await ready();
  if (process.env.PALETTE_SOURCE_DOCUMENT) {
    const source = JSON.parse(await readFile(process.env.PALETTE_SOURCE_DOCUMENT, 'utf8'));
    await page.evaluate(document => localStorage.setItem('procedurals-studio-v1', JSON.stringify(document)), source);
    await page.reload(); await ready();
    const sourceBefore = await doc();
    await page.getByRole('button', { name: 'Revise with a palette', exact: true }).click(); await choose(name, 'Prepare palette revision');
    await page.waitForFunction(() => document.querySelector('#prompt-scope')?.value === 'edit-layer');
    assert.equal(await page.getByLabel('Scope', { exact: true }).inputValue(), 'edit-layer');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Prompt payload captured' }).waitFor();
    assert.equal(captured.scope, 'edit-layer'); assert.equal(captured.selectedLayerId, sourceBefore.layers[0].id);
    for (const color of colors) assert.ok(captured.prompt.includes(color));
    assert.deepEqual(await doc(), sourceBefore); await capture('source-palette-revision');
    scenarios.push('Generated-layer palette shortcut prepares edit scope with exact colors; request leaves committed source intact');
  }
  await page.goto(base + '/explorations');
  await page.getByLabel('Exploration prompt').fill('Coastal circles');
  await page.getByRole('button', { name: 'Choose a palette', exact: true }).click(); await choose(name, 'Use in prompt');
  await page.getByRole('button', { name: 'Start new sketch', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Prompt payload captured' }).waitFor();
  for (const color of colors) assert.ok(captured.prompt.includes(color)); assert.match(captured.prompt, /Coastal circles/);
  scenarios.push('Explorations includes exact saved colors alongside artist request');
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ status: 'passed', scenarios, errors, limits: 'Palette generation UI replays a validated response. Prompt request checks use a mocked document-context response and intercepted run request; palette storage, workflow drawing and export are live.' }, null, 2));
  console.log(JSON.stringify({ status: 'passed', scenarios }, null, 2));
} catch (error) { await capture('failure'); throw error; }
finally {
  for (const id of ids) { const response = await context.request.get(base + '/harness/palettes'); const value = (await response.json()).palettes?.find(p => p.id === id); if (value) { assert.ok(value.name.startsWith(name)); await context.request.delete(base + '/harness/palettes', { data: { id, revision: value.revision } }); } }
  await browser.close();
}
