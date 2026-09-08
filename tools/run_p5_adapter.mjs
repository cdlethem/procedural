/** Registered native browser probes. Run with --part pixels|failures; --render consumes that part once. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import http from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2),part=argv[argv.indexOf('--part')+1];
if(!['pixels','failures','cp1','transfer'].includes(part))throw new Error('Pass --part pixels|failures|cp1|transfer');
const rendering=argv.includes('--render');
const corrective=argv.includes('--corrective');
const runtime=path.join(root,'.work/environments/p5js');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(runtime,'node_modules/playwright/index.mjs'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async name=>digest(await fs.readFile(path.join(root,name)));
const moduleName=`tests/native/p5-frame-${part}.js`;
const names=[moduleName,'tools/run_p5_adapter.mjs','packages/javascript/src/internal/p5-frame.js',
  'packages/javascript/src/internal/drawing-state.js','packages/javascript/src/internal/drawing.js',
  'catalog/drawing/fresh-raster-2d.json','design/p5js-adapter-validation.md',
  '.work/environments/p5js/package-lock.json','.work/environments/p5js/node_modules/p5/lib/p5.min.js',
  '.work/environments/p5js/node_modules/playwright/package.json'];
let cp1Inputs=null;
if(part==='transfer')names.push('design/p5js-transfer-supplement.md');
if(part==='cp1') {
  names.push('packages/javascript/examples/field-marks/mark-field.js','packages/javascript/src/index.js',
    'packages/javascript/src/regular-grid.js','packages/javascript/src/gradient-noise-2d-01.js',
    'packages/javascript/src/cyclic-palette.js','evidence/reproductions/cp1-java2d/plan.json',
    'evidence/reproductions/cp1-java2d/result.json');
  cp1Inputs={plan:JSON.parse(await fs.readFile(path.join(root,'evidence/reproductions/cp1-java2d/plan.json'),'utf8')),
    expected:JSON.parse(await fs.readFile(path.join(root,'evidence/reproductions/cp1-java2d/result.json'),'utf8')).native.cases};
}
const inputs=Object.fromEntries(await Promise.all(names.map(async name=>[name,await hashFile(name)])));
if(!rendering) { console.log(JSON.stringify({prepared:true,part,input_sha256:inputs}));process.exit(0); }
const output=path.join(root,'.work/reproductions/p5js-adapter');
await fs.mkdir(output,{recursive:true});
if(corrective) {
  if(part==='cp1'||part==='transfer')throw new Error('Correction requires a registered diagnosis first');
  const initial=JSON.parse(await fs.readFile(path.join(output,`${part}-attempt.json`),'utf8'));
  if(!['failed','passed'].includes(initial.status))throw new Error('Initial run is not terminal');
  if(part==='pixels'&&initial.status!=='failed')throw new Error('Pixel correction requires recorded failure');
  await fs.access(path.join(root,part==='pixels'?'design/p5js-pixel-startup-repair.md':'design/p5js-error-phase-repair.md'));
  await fs.copyFile(path.join(root,`evidence/conformance/p5js-adapter-${part}.json`),
    path.join(root,`evidence/conformance/p5js-adapter-${part}-initial.json`),fs.constants.COPYFILE_EXCL);
}
const attempt=path.join(output,`${part}${corrective?'-corrective':''}-attempt.json`);
await fs.writeFile(attempt,JSON.stringify({status:'started',reserved_suite_part:part,input_sha256:inputs},null,2)+'\n',{flag:'wx'});
const report={part,status:'failed',scope:'p5.js 2.3.2 Canvas2D Chromium; selected registered suite part only',
  input_sha256:inputs,node:process.version,platform:process.platform,architecture:process.arch,errors:[]};
let browser,server;
try {
  server=http.createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      let relative;
      if(pathname==='/') {
        res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><script src="/p5.js"></script></body></html>');return;
      }
      if(pathname==='/p5.js')relative='.work/environments/p5js/node_modules/p5/lib/p5.min.js';
      else if(pathname===`/${moduleName}`||pathname==='/packages/javascript/examples/field-marks/mark-field.js'||/^\/packages\/javascript\/src\/(internal\/)?[a-z0-9-]+\.js$/.test(pathname))relative=pathname.slice(1);
      else {res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await fs.readFile(path.join(root,relative)));
    } catch(error) {res.writeHead(500);res.end('Test source unavailable');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch();report.browser=browser.version();
  report.browser_executable_sha256=digest(await fs.readFile(chromium.executablePath()));
  const context=await browser.newContext({viewport:{width:800,height:800},deviceScaleFactor:2});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.goto(origin,{waitUntil:'load'});
  const result=await page.evaluate(async({moduleName,part,cp1Inputs})=>{
    const p=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('p5 setup timeout')),20000);
      new window.p5(instance=>{instance.setup=()=>{
        instance.createCanvas(32,32,instance.P2D);instance.noLoop();clearTimeout(timer);resolve(instance);
      };});
    });
    try {
      const module=await import('/'+moduleName);
      return await (part==='pixels'?module.runPixels(p):part==='failures'?module.runFailures(p):part==='transfer'?module.runTransfer(p):module.runCP1(p,cp1Inputs.plan,cp1Inputs.expected));
    } finally {p.remove();}
  },{moduleName,part,cp1Inputs});
  report.images={};
  for(const image of result.images??[]) {
    if(!/^[a-z0-9-]+$/.test(image.name)||!image.png.startsWith('data:image/png;base64,'))throw new Error('Unexpected image output');
    const bytes=Buffer.from(image.png.split(',')[1],'base64');
    const destination=path.join(output,image.name+'.png');await fs.writeFile(destination,bytes);
    report.images[path.relative(root,destination)]=digest(bytes);
  }
  delete result.images;report.native=result;
  if(!result.passed||report.errors.length)throw new Error('Native assertions failed');
  for(const name of names)if(await hashFile(name)!==inputs[name])throw new Error('Inputs changed during execution: '+name);
  report.status='passed';
} catch(error) {
  report.failure=String(error.stack||error);process.exitCode=1;
} finally {
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  await fs.mkdir(path.join(root,'evidence/conformance'),{recursive:true});
  const destination=path.join(root,`evidence/conformance/p5js-adapter-${part}.json`);
  await fs.writeFile(destination,JSON.stringify(report,null,2)+'\n');
  await fs.writeFile(attempt,JSON.stringify({status:report.status,reserved_suite_part:part,input_sha256:inputs},null,2)+'\n');
  console.log(path.relative(root,destination)+': '+report.status);
}
