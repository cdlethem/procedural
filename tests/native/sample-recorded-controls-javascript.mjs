#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleRecordedControls, SampleRecordedControlsError } from '../../packages/javascript/src/sample-recorded-controls.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = ['catalog/operations/sample-recorded-controls.json', 'fixtures/operations/sample-recorded-controls.json', 'packages/javascript/src/sample-recorded-controls.js', 'tests/native/sample-recorded-controls-javascript.mjs'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(files.map(name => [name, sha(readFileSync(join(root, name)))]));
const fixture = JSON.parse(readFileSync(join(root, files[1])));
assert.equal(fixture.catalog_sha256, sha(readFileSync(join(root, files[0]))));
const before = hashes();
let passed = 0;
const error = (fn, code) => assert.throws(fn, e => e instanceof SampleRecordedControlsError && e.code === code);
for (const item of fixture.cases) {
  if (item.error) error(() => sampleRecordedControls(item.input), item.error);
  else {
    const source = JSON.stringify(item.input);
    assert.deepEqual(sampleRecordedControls(item.input), item.output, item.id);
    assert.equal(JSON.stringify(item.input), source, item.id);
  }
  passed++;
}
const base = fixture.cases[0].input;
let getterCalls = 0;
const accessor = value => Object.defineProperty({...base}, 'time', {get(){getterCalls++;return value;}});
const bad = [accessor(1), Object.assign({...base},{extra:1}), Object.assign({...base},{[Symbol('x')]:1}), Object.assign(new (class Input {})(), base), {...base,times:[0,,4]}, {...base,channels:Object.assign([...base.channels],{extra:1})}, {...base,samples:[...base.samples.slice(0,2),Object.assign([0,1],{extra:1})]}, {...base,mappings:[{...base.mappings[0],range:[0,,2]}]}, {...base,mappings:[Object.assign({...base.mappings[0]},{[Symbol('x')]:1})]}];
for (const value of bad) error(() => sampleRecordedControls(value), 'INVALID_INPUT');
assert.equal(getterCalls, 0, 'no accessor invoked');
assert.deepEqual(sampleRecordedControls(Object.assign(Object.create(null), base)), fixture.cases[0].output);
const detached = sampleRecordedControls(base); detached.values[0] = 999;
assert.deepEqual(sampleRecordedControls(base), fixture.cases[0].output, 'no retained output state');
// A held endpoint still performs every mapping arithmetic primitive.
error(() => sampleRecordedControls({...base,time:0,mappings:[{...base.mappings[0],domain:[-1e308,1e308]}]}), 'NUMERIC_OVERFLOW');
error(() => sampleRecordedControls({...base,maxWork:0,time:1,maxGap:.01}), 'WORK_LIMIT');
assert.equal(Object.is(sampleRecordedControls({...base,time:0,mappings:[{...base.mappings[0],range:[-0,-0]}]}).values[0], -0), false);
const output = process.argv[2] === '--output' ? resolve(process.argv[3] ?? '') : null;
assert.ok(output && output.startsWith(join(root,'.work')+sep) && !existsSync(output), 'fresh .work report required');
assert.deepEqual(hashes(), before, 'inputs stable');
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output, JSON.stringify({status:'passed',scope:'frozen analytical fixtures and passive input/numeric/ownership checks; not native workflow acceptance',fixtures:passed,checks:['passive exact carriers, no getter calls','null-prototype input','detached output','numeric/work precedence','positive zero'],input_sha256:before},null,2)+'\n');
console.log(`sampleRecordedControls: ${passed} analytical fixtures and focused checks passed`);
