import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startCutBranchMarksServer} from './serve_cut_branch_marks.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
const server=await startCutBranchMarksServer(0);let browser;
const out=path.resolve(process.argv[2] || '.work/port-cut-branch-native');
assert.ok(out.startsWith(path.join(root,'.work')+path.sep));await fs.mkdir(out);
const sources=['packages/javascript/src/internal/drawing.js','packages/javascript/src/gradient-noise-2d-01.js','packages/javascript/src/internal/noise-hash.js','packages/javascript/src/internal/drawing-state.js','packages/javascript/src/cyclic-palette.js','packages/javascript/src/fdlibm-trig.js','packages/javascript/src/internal/p5-frame.js','packages/javascript/src/line-pool.js','packages/javascript/examples/cut-branch-marks/sketch.js','packages/javascript/examples/cut-branch-marks/cut-branch-marks.js','packages/javascript/examples/cut-branch-marks/index.html','tools/serve_cut_branch_marks.mjs','tools/run_p5_cut_branch_marks.mjs'];
const hashInputs=async()=>Object.fromEntries(await Promise.all(sources.map(async f=>[f,createHash('sha256').update(await fs.readFile(path.join(root,f))).digest('hex')])));
const before=await hashInputs();
try {
 browser=await chromium.launch({headless:true});const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>document.querySelector('#art').dataset.revision==='1');
 const frames=[];
 async function capture(name){const bytes=await page.locator('#art canvas').screenshot();await fs.writeFile(`${out}/${name}.png`,bytes);const pixels=await page.evaluate(()=>document.querySelector('#art canvas').toDataURL());const hash=createHash('sha256').update(pixels).digest('hex');frames.push({name,hash});return hash;}
 const base=await capture('baseline');let rev=1;
 for(const key of ['c', 'a', 'w', 't', 'r', '0']){await page.keyboard.press(key);await page.waitForFunction(n=>Number(document.querySelector('#art').dataset.revision)===n,++rev);const hash=await capture(key==='0'?'reset':key);if(key==='0')assert.equal(hash,base);else assert.notEqual(hash,base);}
 const download=page.waitForEvent('download');await page.keyboard.press('s');await(await download).saveAs(`${out}/saved.png`);
 await page.waitForTimeout(300);assert.equal(await page.locator('#art').getAttribute('data-revision'),String(rev));assert.deepEqual(errors,[]);
 const after=await hashInputs();assert.deepEqual(after,before);
 await fs.writeFile(`${out}/report.json`,JSON.stringify({input_sha256_before:before,input_sha256_after:after,status:'passed',browser:browser.version(),frames,errors,scope:'Actual p5 edits, reset identity, download and cached revision. No Java pixel parity claim.'},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
