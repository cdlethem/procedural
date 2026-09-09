import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startWarpMarksServer} from './serve_warp_marks.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH=new URL('../.work/toolchains/playwright',import.meta.url).pathname;
const {chromium}=await import('../.work/environments/p5js/node_modules/playwright/index.mjs');
const server=await startWarpMarksServer(0);let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/src/occupied-lattice-paths.js`);
 const fixture=JSON.parse(await fs.readFile('fixtures/operations/occupied-lattice-paths-2d.json'));
 const results=await page.evaluate(async cases=>{const {occupiedLatticePaths2D}=await import('/packages/javascript/src/occupied-lattice-paths.js');return cases.map(c=>{try{return {id:c.id,output:occupiedLatticePaths2D(c.input).toValues()};}catch(e){return {id:c.id,error:e.code,details:{bodyIndex:e.bodyIndex,axis:e.axis,stage:e.stage}};}});},fixture.cases);
 for(let i=0;i<results.length;i++){const c=fixture.cases[i],r=results[i];assert.equal(r.error,c.error,c.id);if(c.error_details)assert.deepEqual(r.details,c.error_details,c.id);if(!c.error)assert.deepEqual(r.output,c.output,c.id);}
 await fs.writeFile(process.argv[2] || '.work/port-lattice-browser.json',JSON.stringify({status:'passed',browser:browser.version(),cases:results.length,scope:'Actual Chromium core fixtures only; no LatticeMarks rendering/workflow acceptance.'},null,2),{flag:'wx'});
}finally{await browser?.close();await new Promise(r=>server.close(r));}
