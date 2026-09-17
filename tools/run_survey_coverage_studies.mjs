/** Bounded browser integration, run through tools/with_native_render_lock.py. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {startCoverageStudiesServer} from './serve_survey_coverage_studies.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]),slug=process.argv[3]||'pixel-grain';
assert.ok(out.startsWith(path.join(root,'.work')+path.sep));await fs.mkdir(out);
assert.ok(['pixel-grain','field-displacement','octave-noise'].includes(slug));
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function sourceFiles(dir){let result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);result.push(...(e.isDirectory()?await sourceFiles(f):[f]));}return result;}
const inputs=[fileURLToPath(import.meta.url),path.join(root,'tools/serve_survey_coverage_studies.mjs'),...await sourceFiles(path.join(root,'packages/javascript/src')),...await sourceFiles(path.join(root,'packages/javascript/examples',slug)),path.join(root,'.work/environments/p5js/node_modules/p5/lib/p5.min.js')];
const hashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async f=>[path.relative(root,f),hash(await fs.readFile(f))])));
const before=await hashes(),server=await startCoverageStudiesServer();let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1000,height:1250}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const ready=async(n=0)=>{await page.waitForFunction(n=>{const a=document.querySelector('#art');return a?.dataset.renderStatus==='error'||Number(a?.dataset.revision)>n;},n);assert.equal(await page.locator('#art').getAttribute('data-render-status'),'ready',await page.locator('#status').textContent());};
 await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${slug}/index.html`);await ready();
 const frames=[];
 async function capture(label){const info=await page.evaluate(()=>{const c=document.querySelector('#art canvas'),a=document.querySelector('#art'),rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sum=0,squares=0;for(let i=0;i<rgba.length;i+=4){sum+=rgba[i];squares+=rgba[i]*rgba[i];}const n=c.width*c.height;return{data:c.toDataURL(),width:c.width,height:c.height,geometry:a.dataset.geometry,rngState:a.dataset.rngState,sourceCount:a.dataset.sourceCount,redMean:sum/n,redVariance:squares/n-(sum/n)**2};});const png=Buffer.from(info.data.split(',')[1],'base64');await fs.writeFile(path.join(out,label+'.png'),png);delete info.data;if(info.geometry?.length>200)info.geometry=hash(info.geometry);const result={label,sha256:hash(png),...info};frames.push(result);return result;}
 async function action(key,label){const n=Number(await page.locator('#art').getAttribute('data-revision'));await page.locator(`button[data-action="${key}"]`).click();await ready(n);return capture(label);}
 async function value(selector,value,label){const n=Number(await page.locator('#art').getAttribute('data-revision'));await page.locator(selector).fill(value);await page.locator(selector).dispatchEvent('change');await ready(n);return capture(label);}
 const baseline=await capture('baseline'),edit=await action('t','strength-edit');assert.notEqual(edit.sha256,baseline.sha256);if(slug==='pixel-grain')assert.equal(edit.geometry,baseline.geometry);
 if(slug==='field-displacement'){assert.equal(edit.sourceCount,baseline.sourceCount);assert.notEqual(edit.geometry,baseline.geometry);const cartesian=await action('m','cartesian');const dots=await action('c','dots');assert.notEqual(dots.sha256,cartesian.sha256);assert.equal(dots.geometry,cartesian.geometry);}
 if(slug==='octave-noise'){assert.equal(edit.geometry,baseline.geometry);const persistence=await action('p','persistence');assert.notEqual(persistence.sha256,edit.sha256);const raw=await action('n','raw-sum');assert.notEqual(raw.sha256,persistence.sha256);assert.equal(raw.geometry,baseline.geometry);}
 if(slug==='pixel-grain'){
  const zero=await value('#strength','0','zero-grain');assert.notEqual(zero.sha256,baseline.sha256);assert.equal(zero.geometry,baseline.geometry);
  const alpha=await action('m','alpha-04'),one=await value('#exponent','1','alpha-1'),two=await value('#exponent','2','alpha-2');
  assert.ok(alpha.redMean>one.redMean&&one.redMean>two.redMean,'larger exponent reduces alpha-weighted brightness');
 }
 assert.equal((await action('0','reset')).sha256,baseline.sha256);
 await page.reload();await ready();assert.equal((await capture('reload')).sha256,baseline.sha256);
 const revision=await page.locator('#art').getAttribute('data-revision'),download=page.waitForEvent('download');await page.keyboard.press('s');await(await download).saveAs(path.join(out,'saved.png'));
 assert.equal(await page.locator('#art').getAttribute('data-revision'),revision);assert.equal((await capture('after-save')).sha256,baseline.sha256);assert.equal(hash(await fs.readFile(path.join(out,'saved.png'))),baseline.sha256);assert.deepEqual(errors,[]);
 const after=await hashes();assert.deepEqual(after,before);
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',scope:'Actual p5 2.3.2 Canvas2D study; edit, reset, reload, save and selected parameter states; corpus benchmark separate.',slug,browser:browser.version(),input_sha256_before:before,input_sha256_after:after,frames,errors},null,2)+'\n');console.log(JSON.stringify({status:'passed',out,frames:frames.length}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
