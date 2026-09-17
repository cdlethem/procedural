/** Actual p5 2.3.2 lifecycle evidence. Always run through the shared native lease. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startCoverageStudiesServer } from '../../tools/serve_survey_coverage_studies.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const packageRoot=path.resolve(process.env.PROCEDURALS_PACKAGE_ROOT??path.join(root,'packages/javascript'));
const out=path.resolve(process.argv[2]??path.join(root,'.work/expansion-first/proximity/native'));
assert.ok(out.startsWith(path.join(root,'.work')+path.sep));
await fs.mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
async function sourceFiles(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);result.push(...(e.isDirectory()?await sourceFiles(f):[f]));}return result;}
const inputs=[fileURLToPath(import.meta.url),path.join(root,'tools/serve_survey_coverage_studies.mjs'),
  ...await sourceFiles(path.join(packageRoot,'src')),
  ...await sourceFiles(path.join(packageRoot,'examples/contact-network')),
  ...await sourceFiles(path.join(packageRoot,'examples/agent-trails')),
  path.join(root,'.work/environments/p5js/node_modules/p5/lib/p5.min.js'),
  path.join(root,'catalog/operations/radius-pairs-2d.json'),path.join(root,'catalog/operations/pair-force-step-2d.json')];
const hashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async f=>[path.relative(root,f),hash(await fs.readFile(f))])));
const before=await hashes(),server=await startCoverageStudiesServer(0,{packageRoot});
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
let browser;
const report={status:'running',scope:'Original p5 Canvas2D interaction studies; full-state replay, current query graph, edit controls, fixed-edge design transfer and browser operation timings. No artist recreation or contact-history claim.',runtime:'p5 2.3.2, Canvas2D, density1,720x720',package_root:path.relative(root,packageRoot),input_sha256_before:before,studies:[],errors:[]};
const geometry=s=>({points:s.points,velocities:s.velocities,forces:s.forces,pairs:s.pairs,history:s.history,groups:s.groups,tick:s.tick});
try {
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']});
  report.browser=browser.version();
  for(const slug of ['contact-network','agent-trails']) {
    const directory=path.join(out,slug);await fs.mkdir(directory,{recursive:true});
    const page=await browser.newPage({acceptDownloads:true,viewport:{width:1180,height:1100}});
    page.on('pageerror',error=>report.errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const ready=async(revision=0)=>{
      await page.waitForFunction(n=>{const a=document.querySelector('#art');return a?.dataset.renderStatus==='error'||Number(a?.dataset.revision)>n;},revision);
      assert.equal(await page.locator('#art').getAttribute('data-render-status'),'ready',await page.locator('#status').textContent());
    };
    await page.goto(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/${slug}/index.html`);await ready();
    const study={slug,frames:[],checks:[],native_transfer:'pending'};report.studies.push(study);
    const observe=()=>page.evaluate(()=>window.proximityStudy.snapshot());
    async function capture(label) {
      const state=await observe(),data=await page.locator('#art canvas').evaluate(c=>({png:c.toDataURL(),width:c.width,height:c.height}));
      assert.equal(data.width,720);assert.equal(data.height,720);
      const png=Buffer.from(data.png.split(',')[1],'base64'),serialized=JSON.stringify(state);
      await fs.writeFile(path.join(directory,`${label}.png`),png);
      await fs.writeFile(path.join(directory,`${label}.json`),serialized+'\n');
      const frame={label,tick:state.tick,point_count:state.points.length,pair_count:state.pairs.length,history_count:state.history.length,png_sha256:hash(png),state_sha256:hash(serialized),path:path.relative(root,path.join(directory,`${label}.png`)),bounds:[Math.min(...state.points.map(p=>p[0])),Math.min(...state.points.map(p=>p[1])),Math.max(...state.points.map(p=>p[0])),Math.max(...state.points.map(p=>p[1]))]};
      study.frames.push(frame);return{state,frame};
    }
    async function action(key){const revision=Number(await page.locator('#art').getAttribute('data-revision'));await page.locator(`button[data-action="${key}"]`).click();await ready(revision);return observe();}
    async function currentGraph(){const expected=await page.evaluate(async()=>{const {radiusPairs2D}=await import('/packages/javascript/src/index.js');const s=window.proximityStudy.snapshot();return radiusPairs2D({points:s.points,radius:s.settings.wide?86:54,maxWork:20000}).pairs;});assert.deepEqual((await observe()).pairs,expected);}
    const startup=await capture('startup');assert.equal(startup.state.tick,0);await currentGraph();
    await action('n');const tick60=await capture('tick-060');assert.equal(tick60.state.tick,60);await currentGraph();
    await action('n');const tick120=await capture('tick-120');assert.equal(tick120.state.tick,120);await currentGraph();
    await action('n');await action('n');const tick240=await capture('tick-240');assert.equal(tick240.state.tick,240);assert.equal(tick240.state.history.length,241);await currentGraph();
    assert.notEqual(tick60.frame.png_sha256,startup.frame.png_sha256);assert.notEqual(tick120.frame.png_sha256,tick60.frame.png_sha256);
    assert.deepEqual(geometry(await action('n')),geometry(tick240.state));
    study.checks.push('startup,60,120,240 ticks; post-step relationship graph; bounded241-sample history; no step beyond240');
    await action('c');const palette=await capture('palette');assert.deepEqual(geometry(palette.state),geometry(tick240.state));assert.notEqual(palette.frame.png_sha256,tick240.frame.png_sha256);
    await action('m');const marks=await capture('marks');assert.deepEqual(geometry(marks.state),geometry(tick240.state));assert.notEqual(marks.frame.png_sha256,palette.frame.png_sha256);
    study.checks.push('palette and marks preserve complete points,velocities,forces,pairs,history,groups,tick');
    await action('0');assert.deepEqual(await observe(),startup.state);
    await action('r');await action('n');const radius=await capture('radius-edit-tick-060');assert.notDeepEqual(radius.state.points,tick60.state.points);await currentGraph();
    await action('0');await action('f');await action('n');const force=await capture('avoidance-edit-tick-060');assert.notDeepEqual(force.state.points,tick60.state.points);
    study.checks.push('radius and avoidance separately change subsequent state from the same initial conditions');
    await action('0');await action('n');const replay=await capture('replay-tick-060');assert.deepEqual(replay.state,tick60.state);assert.equal(replay.frame.png_sha256,tick60.frame.png_sha256);
    await action('0');assert.equal((await capture('reset')).frame.png_sha256,startup.frame.png_sha256);
    await page.reload();await ready();const reload=await capture('reload');assert.deepEqual(reload.state,startup.state);assert.equal(reload.frame.png_sha256,startup.frame.png_sha256);
    const revision=await page.locator('#art').getAttribute('data-revision'),downloadPromise=page.waitForEvent('download');await page.locator('[data-action="s"]').click();const download=await downloadPromise;await download.saveAs(path.join(directory,'saved.png'));
    assert.equal(await page.locator('#art').getAttribute('data-revision'),revision);assert.deepEqual(await observe(),startup.state);assert.equal(hash(await fs.readFile(path.join(directory,'saved.png'))),startup.frame.png_sha256);
    study.checks.push('full-state and PNG replay; reset/reload exact; downloaded PNG exactly equals displayed canvas with no tick/redraw');
    // Exercise actual continuous play separately from exact stopped-tick captures.
    await action('space');await page.waitForFunction(()=>Number(document.querySelector('#art').dataset.tick)>=3);await action('space');const paused=await observe();assert.equal(paused.settings.running,false);await page.waitForTimeout(150);assert.deepEqual(await observe(),paused);
    study.checks.push('actual animation advances; pause retains complete state');
    await action('0');await action('g');const transfer0=await capture('open-chain-tick-000');assert.equal(transfer0.state.points.length,75);assert.equal(transfer0.state.pairs.length,72);
    await action('n');const transfer60=await capture('open-chain-tick-060');await action('n');const transfer120=await capture('open-chain-tick-120');
    assert.deepEqual(transfer60.state.pairs,transfer0.state.pairs);assert.deepEqual(transfer120.state.pairs,transfer0.state.pairs);assert.notDeepEqual(transfer120.state.points,transfer0.state.points);
    const beforeRadius=await observe();await action('r');assert.deepEqual(geometry(await observe()),geometry(beforeRadius));
    await action('0');await action('g');await action('n');await action('n');const transferReplay=await capture('open-chain-replay');assert.deepEqual(transferReplay.state,transfer120.state);assert.equal(transferReplay.frame.png_sha256,transfer120.frame.png_sha256);
    study.native_transfer='Fixed75-point72-edge open-chain graph replaces query; unchanged public step; exact replay to120; visual review recorded separately.';
    study.checks.push('fixed-edge transfer preserves edges as positions change; radius edit has no graph effect; exact state and PNG replay');
    await page.screenshot({path:path.join(directory,'interface.png'),fullPage:true});
    if(slug==='contact-network'){
      report.performance=await page.evaluate(async({studyPoints,studyVelocities})=>{
        const {radiusPairs2D,pairForceStep2D}=await import('/packages/javascript/src/index.js');
        const results=[];
        for(const [name,count,vertical] of [['tiny',2,false],['study',126,false],['stress',512,false],['vertical-worst-case',512,true]]) {
          const points=name==='study'?studyPoints:Array.from({length:count},(_,i)=>vertical?[0,i*100]:[(i%32)*12,Math.floor(i/32)*12]);
          const velocities=name==='study'?studyVelocities:points.map(()=>[0,0]),radius=54,maxWork=count+count*(count-1)/2;
          let pairs;
          const query=()=>{pairs=radiusPairs2D({points,radius,maxWork}).pairs;};
          query();
          const step=()=>pairForceStep2D({points,velocities,pairs,attraction:.0011,repulsion:.22,repulsionRadius:42,damping:.94,dt:1,maxSpeed:2.1,maxWork});
          const batchCalls=name==='tiny'?200:name==='study'?20:5;
          const measure=fn=>{fn();fn();const samples=[];for(let i=0;i<5;i++){const start=performance.now();for(let j=0;j<batchCalls;j++)fn();samples.push((performance.now()-start)/batchCalls);}const sorted=[...samples].sort((a,b)=>a-b);return{batch_calls:batchCalls,per_call_samples_ms:samples,median_per_call_ms:sorted[2]};};
          const queryTiming=measure(query),stepTiming=measure(step);
          const output=JSON.stringify({pairs,...step()}),bytes=new TextEncoder().encode(output);
          const digest=await crypto.subtle.digest('SHA-256',bytes);
          const outputSha256=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
          results.push({name,count,pairs:pairs.length,maxWork,query:queryTiming,step:stepTiming,output_sha256:outputSha256,
            retained_output:{pair_index_slots:pairs.length*2,state_scalar_slots:count*6,json_bytes:bytes.length,scope:'Output payload size, not heap allocation or peak-memory measurement.'}});
        }
        return{scope:'Public browser calls including static validation and allocation; excludes point construction, p5 drawing, canvas readback and PNG encoding. Study case uses exact Contact Network initial positions/velocities. Timings are observations, not realtime guarantees. Five measured batches after two warmup calls per operation; per-call timings divide total batch time.',cases:results};
      },{studyPoints:startup.state.points,studyVelocities:startup.state.velocities});
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
  report.input_sha256_after=await hashes();assert.deepEqual(report.input_sha256_after,before);
  report.status='passed';
} catch(error) {report.status='failed';report.failure=String(error.stack??error);throw error;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,out,studies:report.studies.length,frames:report.studies.reduce((n,s)=>n+s.frames.length,0)}));
