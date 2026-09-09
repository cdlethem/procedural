/** Focused integration checks for the twelve backlog workflows; run under the shared native lease. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
const out=path.resolve(process.argv[2]);
assert.ok(out.startsWith(path.join(root,'.work')+path.sep));await fs.mkdir(out);
const specs=[
 ['lattice',['c','m','w','l','n','r']],['facet',['m','m','c','p','n','x','r']],
 ['spring',['d','.','k','v','m','m','h','t','c']],['panel',['a','a','p','c','m']],
 ['cut',['x','y','Delete','a','d','h']],['depth',['z','c','m']],
 ['polygon',['a','m','c','r']],['pull',['r','p','c','m']],
 ['projection',['m','o','c']],['annular',['w','d','f','c','m']],
 ['blur',['m','m','m','b']],['path-clip',['n','c','o']],
];
async function files(dir){return (await fs.readdir(dir,{withFileTypes:true})).flatMap(e=>e.isDirectory()?[]:[path.join(dir,e.name)]);}
const inputs=[fileURLToPath(import.meta.url),...(await files(path.join(root,'packages/javascript/src'))),...(await files(path.join(root,'packages/javascript/src/internal')))];
for(const [name] of specs)inputs.push(...await files(path.join(root,`packages/javascript/examples/${name}-marks`)),path.join(root,`tools/serve_${name.replaceAll('-','_')}_marks.mjs`));
const hash=b=>createHash('sha256').update(b).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async f=>[path.relative(root,f),hash(await fs.readFile(f))])));
const before=await hashes();const results=[];
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']});
 for(const [name,keys] of specs){
  const module=await import(`./serve_${name.replaceAll('-','_')}_marks.mjs`);
  const server=await Object.values(module)[0](0);
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:900,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const directory=path.join(out,name);await fs.mkdir(directory);
  try{
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.waitForFunction(()=>Number(document.querySelector('#art').dataset.revision)>=1);
   const revision=()=>page.locator('#art').getAttribute('data-revision');
   const frames=[];
   async function capture(label){
    const png=await page.locator('#art canvas').screenshot();await fs.writeFile(path.join(directory,label+'.png'),png);
    const pixels=await page.evaluate(()=>document.querySelector('#art canvas').toDataURL());
    const digest=hash(pixels);frames.push({name:label,sha256:digest});return digest;
   }
   const baseline=await capture('baseline');
   async function edit(key,label){
    const previous=Number(await revision());await page.keyboard.press(key);
    await page.waitForFunction(n=>Number(document.querySelector('#art').dataset.revision)>n,previous);
    return capture(label);
   }
   for(const [i,key] of keys.entries())await edit(key,`edit-${i}-${key}`);
   if(name==='spring'){
    const tick=Number(await page.locator('#art').getAttribute('data-tick'));
    await page.keyboard.press('Space');
    await page.waitForFunction(n=>Number(document.querySelector('#art').dataset.tick)>=n+130,tick);
    await page.keyboard.press('Space');await page.waitForTimeout(100);
    const paused=await page.locator('#art').getAttribute('data-tick');await page.waitForTimeout(100);
    assert.equal(await page.locator('#art').getAttribute('data-tick'),paused,'pause freezes simulation');
    await capture('animated-paused');
   }
   const hasReset=await page.locator('button[data-action="0"]').count();
   if(hasReset)assert.equal(await edit('0','reset'),baseline,name+' reset identity');
   else {await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#art').dataset.revision)>=1);assert.equal(await capture('reload'),baseline,name+' fresh identity');}
   // Exercise a visible button independently of the keyboard route.
   const button=page.locator('button[data-action]').filter({hasNotText:/save/i}).first();
   const previous=Number(await revision());await button.click();
   await page.waitForFunction(n=>Number(document.querySelector('#art').dataset.revision)>n,previous);
   if(name==='spring'){
    // The first button is the run toggle; pause before asserting save stability.
    const running=await page.locator('#status').textContent();
    if(running.includes('running')){await page.keyboard.press('Space');await page.waitForTimeout(100);}
   }
   if(name==='cut'){
    const canvas=page.locator('#art canvas');await canvas.click({position:{x:100,y:100}});
    await capture('mouse-selection');
   }
   const beforeSave=await revision();
   const pixelsBefore=await page.evaluate(()=>document.querySelector('#art canvas').toDataURL());
   const download=page.waitForEvent('download');await page.keyboard.press('s');await(await download).saveAs(path.join(directory,'saved.png'));
   await page.waitForTimeout(100);assert.equal(await revision(),beforeSave,name+' save leaves revision unchanged');
   assert.equal(await page.evaluate(()=>document.querySelector('#art canvas').toDataURL()),pixelsBefore,name+' save leaves pixels unchanged');
   assert.deepEqual(errors,[]);
   results.push({workflow:name,status:'passed',frames,reset:hasReset?'exact':'not provided; fresh reload exact',save:'no redraw or pixel change',errors});
   console.log(name+': passed');
  }finally{await page.close();await new Promise(r=>server.close(r));}
 }
 const after=await hashes();assert.deepEqual(after,before,'inputs changed during native review');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',scope:'p5.js 2.3.2 Chromium workflow integration; no Java raster parity or corpus technique claim.',browser:browser.version(),input_sha256_before:before,input_sha256_after:after,results},null,2)+'\n');
}finally{await browser?.close();}
