#!/usr/bin/env node
/** Selected p5 study evidence. Run through with_native_render_lock.py. */
import {tenfoldStudies} from "../apps/web/content/tenfold-studies.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]??'');
assert.ok(out.startsWith(path.join(root,'.work')+path.sep),'fresh ignored output required');
await mkdir(out,{recursive:false});
const base=process.env.WEB_BASE_URL??'http://localhost:3103';
const selected=process.env.STUDY_SLUGS?.split(',');
const studies=tenfoldStudies.filter(s=>!selected||selected.includes(s.slug)).map(s=>[s.slug,s.structuralControl.label,s.structuralControl.value]);
assert.ok(studies.length>0);
const digest=v=>createHash('sha256').update(v).digest('hex');
async function files(dir){return (await readdir(path.join(root,dir),{withFileTypes:true})).flatMap(e=>e.isFile()?[`${dir}/${e.name}`]:[]);}
const inputs=[fileURLToPath(import.meta.url),...await files('packages/javascript/src'),...await files('packages/javascript/src/internal'),...studies.flatMap(([s])=>[`packages/javascript/examples/${s}/README.md`,`packages/javascript/examples/${s}/index.html`,`packages/javascript/examples/${s}/sketch.js`]),...await files('apps/web/lib/adapters'),...await files('packages/javascript/examples'),...await files('apps/web/content')];
for(const [s] of studies)for(const f of await files(`packages/javascript/examples/${s}`))if(!inputs.includes(f))inputs.push(f);
const hashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async f=>[path.isAbsolute(f)?path.relative(root,f):f,digest(await readFile(path.resolve(root,f)))])));
const report={status:'failed',scope:'Selected original p5 Canvas2D studies. Actual gallery, Studio and standalone example rendering; structural/palette edits, reset/reload/save. No corpus recreation or other-target claim.',input_sha256_before:await hashes(),studioBinding:JSON.parse(await readFile(path.join(root,'apps/web/lib/generated-gallery.json'),'utf8')).studioBinding,studies:[]};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const rel=p==='/p5.js'?'apps/web/node_modules/p5/lib/p5.min.js':p.slice(1);if(!(p==='/p5.js'||/^packages\/javascript\/(src|examples)\/[a-zA-Z0-9_./-]+$/.test(rel))||rel.includes('..')){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',rel.endsWith('.html')?'text/html':rel.endsWith('.js')?'text/javascript':'text/plain');res.end(await readFile(path.join(root,rel)));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']});report.browser=browser.version();
 for(const [slug,label,value] of studies){
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const dir=path.join(out,slug);await mkdir(dir);const frames=[];
  const pixels=()=>page.locator('canvas').first().evaluate(c=>c.toDataURL('image/png'));
  async function capture(label){const png=await pixels();const bytes=Buffer.from(png.split(',')[1],'base64');await writeFile(path.join(dir,`${label}.png`),bytes);frames.push({label,path:path.relative(root,path.join(dir,`${label}.png`)),sha256:digest(bytes)});return png;}
  async function changed(before){await page.waitForFunction(old=>{const c=document.querySelector('canvas');return c&&c.toDataURL('image/png')!==old},before);}
  try{
   const response=await page.goto(`${base}/techniques/${slug}`,{waitUntil:'networkidle'});assert.ok(response.ok());await page.locator('[data-render-status="ready"], [data-render-status="error"]').waitFor();assert.equal(await page.locator('[data-render-status]').first().getAttribute('data-render-status'),'ready',await page.locator('[data-render-status]').first().textContent());
   const baseline=await capture('gallery-baseline');
   const painted=await page.locator('canvas').first().evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]!==d[0]||d[i+1]!==d[1]||d[i+2]!==d[2])n++;return n;});assert.ok(painted>500,`${slug} nonblank`);
   await page.getByLabel(`Exact ${label}`,{exact:true}).fill(String(value));await changed(baseline);const edited=await capture('gallery-structural-edit');
   const color=page.getByLabel('Palette color 1 hex',{exact:true});await color.fill('#7e267b');await color.blur();await changed(edited);await capture('gallery-palette-transfer');
   await page.reload({waitUntil:'networkidle'});await page.locator('[data-render-status="ready"], [data-render-status="error"]').waitFor();assert.equal(await page.locator('[data-render-status]').first().getAttribute('data-render-status'),'ready',await page.locator('[data-render-status]').first().textContent());assert.equal(digest(await pixels()),digest(baseline),'gallery reload resets exactly');
   await mkdir(path.join(root,'apps/web/public/previews'),{recursive:true});await writeFile(path.join(root,`apps/web/public/previews/${slug}.png`),Buffer.from(baseline.split(',')[1],'base64'));
   await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${slug}/index.html`);await page.waitForFunction(()=>Number(document.querySelector('#art')?.dataset.revision)>=1||document.querySelector('#art')?.dataset.renderStatus==='error');
   assert.equal(await page.locator('#art').getAttribute('data-render-status'),'ready');
   const native=await capture('native-baseline');
   assert.equal(digest(native),digest(baseline),'shared native and gallery source produce exact pixels');
   async function edit(action,name){const before=await pixels();await page.locator(`button[data-action="${action}"]`).click();await changed(before);return capture(name);}
   await edit('t','native-structural-edit');await edit('c','native-palette-transfer');await edit('0','native-reset');assert.equal(digest(await pixels()),digest(native),'native reset exact');
   const rev=await page.locator('#art').getAttribute('data-revision');const download=page.waitForEvent('download');await page.locator('button[data-action="s"]').click();await(await download).saveAs(path.join(dir,'saved.png'));assert.equal(digest(await pixels()),digest(native));assert.equal(await page.locator('#art').getAttribute('data-revision'),rev);
   await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#art')?.dataset.revision)>=1||document.querySelector('#art')?.dataset.renderStatus==='error');assert.equal(digest(await pixels()),digest(native),'native reload exact');assert.deepEqual(errors,[]);
   await page.goto(`${base}/studio?technique=${slug}`,{waitUntil:'networkidle'});
   await page.locator('[data-render-status="ready"], [data-render-status="error"]').waitFor();
   assert.equal(await page.locator('[data-render-status]').first().getAttribute('data-render-status'),'ready');
   assert.equal(digest(await capture('studio-baseline')),digest(baseline),'Studio and gallery baseline pixels match');
   assert.deepEqual(errors,[]);
   report.studies.push({slug,status:'passed',structuralControl:{label,value},paintedPixels:painted,frames,reset:'exact',reload:'exact',save:'downloaded without redraw'});console.log(`${slug}: passed`);
  }catch(error){report.studies.push({slug,status:'failed',error:String(error),errors,frames});console.error(slug,String(error));}finally{await page.close();}
 }
 report.input_sha256_after=await hashes();assert.deepEqual(report.input_sha256_after,report.input_sha256_before);assert.ok(report.studies.every(s=>s.status==='passed'),'All selected studies must pass');report.status='passed';
}catch(e){report.failure=String(e);console.error(e);}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
if(report.status!=='passed')process.exitCode=1;
