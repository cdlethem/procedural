/** Run under tools/with_native_render_lock.py. Native p5 2.3.2 WEBGL evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startExternalExpansionServer } from '../../tools/serve_external_expansion_studies.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const packageRoot=path.resolve(process.env.PROCEDURALS_PACKAGE_ROOT ?? path.join(root,'packages/javascript'));
const out=path.resolve(process.argv[2] ?? '.work/expansion-full/feedback/native');
assert.ok(out.startsWith(path.join(root,'.work')+path.sep)); await fs.mkdir(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const paths=['src/p5-feedback-surface.js','examples/feedback-print/index.html','examples/feedback-print/sketch.js','examples/feedback-print/study.js'];
const inputs=[...paths.map(name=>path.join(packageRoot,name)),fileURLToPath(import.meta.url),path.join(root,'tools/serve_external_expansion_studies.mjs'),path.join(root,'.work/environments/p5js/node_modules/p5/lib/p5.js'),path.join(root,'.work/environments/p5js/node_modules/p5/lib/p5.min.js')];
const hashes=async()=>Object.fromEntries(await Promise.all(inputs.map(async f=>[path.relative(root,f),sha(await fs.readFile(f))])));
const before=await hashes();
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,'.work/toolchains/playwright');
const {chromium}=await import(path.join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
const server=await startExternalExpansionServer(0,{packageRoot});let browser;
const report={status:'running',scope:'p5 2.3.2 software WebGL retained-feedback host adapter; native profile only, no shared target acceptance',packageRoot,input_sha256_before:before,checks:[],captures:[],errors:[]};
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']});
  report.browser=browser.version();const page=await browser.newPage({acceptDownloads:true,viewport:{width:1200,height:1080}});
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.goto(server.baseURL+'/examples/feedback-print/');await page.waitForFunction(()=>window.__feedbackPrint?.ready,{timeout:30000});
  const run=fn=>page.evaluate(fn);
  report.gl=await run(()=>{const p=window.__feedbackPrint.host,g=p._renderer.GL;return {p5:p.constructor.VERSION,renderer:g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION),attributes:g.getContextAttributes(),maxTextureSize:g.getParameter(g.MAX_TEXTURE_SIZE)};});
  assert.equal(report.gl.p5,'2.3.2');
  const result=await run(async()=>{
    const {createP5FeedbackSurface,P5FeedbackSurfaceError}=await import('/src/p5-feedback-surface.js');
    const p=window.__feedbackPrint.host,g=p._renderer.GL,id=[1,0,0,1,0,0],step=(s,source,decay=1,opacity=1,transform=id)=>s.step({decay,transform,source,sourceOpacity:opacity});
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const code=(fn,expected)=>{try{fn();throw Error('expected '+expected);}catch(error){if(error.code!==expected)throw error;}};
    const close=(actual,expected,tol=2)=>expected.every((v,i)=>Math.abs(actual[i]-v)<=tol);
    const bytes=s=>{const f=s.frame,w=f.width*f.density,h=f.height*f.density,prior=g.getParameter(g.FRAMEBUFFER_BINDING);g.bindFramebuffer(g.FRAMEBUFFER,f.framebuffer);const result=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,result);g.bindFramebuffer(g.FRAMEBUFFER,prior);return {w,h,data:[...result]};};
    const at=(image,x,y)=>image.data.slice((y*image.w+x)*4,(y*image.w+x)*4+4);
    const source=(w,h,d=1)=>{const q=p.createGraphics(w,h,p.P2D);q.pixelDensity(d);q.clear();return q;};
    const groups=[];
    // Analytical premultiplied source-over and transparent RGB.
    const s=createP5FeedbackSurface(p,{width:8,height:6,density:1}),red=source(8,6),blue=source(8,6);
    red.noStroke();red.fill(255,0,0,128);red.rect(0,0,8,6);blue.noStroke();blue.fill(0,0,255,128);blue.rect(0,0,8,6);
    step(s,red);check(close(at(bytes(s),3,2),[128,0,0,128]),'red premultiplied');
    const first=s.frame;step(s,null,.5);check(first!==s.frame,'ping-pong identity');check(close(at(bytes(s),3,2),[64,0,0,64]),'half alpha');
    step(s,blue);check(close(at(bytes(s),3,2),[32,0,128,160]),'source over faded history');
    s.reset();step(s,red);step(s,blue);check(close(at(bytes(s),3,2),[64,0,128,192]),'source over unfaded history');
    const transparent=source(8,6);transparent.fill(255,0,0,0);transparent.rect(0,0,8,6);s.reset();step(s,transparent);check(close(at(bytes(s),3,2),[0,0,0,0]),'transparent RGB');groups.push('premultiplied alpha and ping-pong');
    // Strict passive data: no getters run, no partial framebuffer write.
    let touched=0;const getterOptions={width:8,height:6};Object.defineProperty(getterOptions,'density',{enumerable:true,get(){touched++;throw Error('option getter');}});
    code(()=>createP5FeedbackSurface(p,getterOptions),'INVALID_INPUT');check(touched===0,'factory getter untouched');
    const beforeBad=bytes(s).data,badTick=s.tick,badFrame=s.frame;
    const candidate={decay:1,transform:id,source:null,sourceOpacity:0};
    const badCases=[new (class {constructor(){Object.assign(this,candidate);}})(),{...candidate,extra:1},{...candidate,transform:[1,0,,1,0,0]},{...candidate,transform:Object.assign([...id],{extra:1})},{...candidate,transform:[...id,7]},Object.assign({...candidate},{[Symbol('extra')]:1})];
    const getterStep={transform:id,source:null,sourceOpacity:0};Object.defineProperty(getterStep,'decay',{enumerable:true,get(){touched++;throw Error('step getter');}});badCases.push(getterStep);
    const getterTransform=[...id];Object.defineProperty(getterTransform,'0',{get(){touched++;throw Error('transform getter');}});badCases.push({...candidate,transform:getterTransform});
    for(const bad of badCases)code(()=>s.step(bad),'INVALID_INPUT');
    check(touched===0 && s.tick===badTick && s.frame===badFrame && JSON.stringify(bytes(s).data)===JSON.stringify(beforeBad),'malformed input passive');
    groups.push('strict passive records and dense transform');
    // Asymmetric source in Image and Canvas2D graphics, including unequal corner mark.
    const q=source(8,6);q.noStroke();q.fill(255,0,0);q.rect(0,0,4,3);q.fill(0,255,0);q.rect(4,0,4,3);q.fill(0,0,255);q.rect(0,3,4,3);q.fill(255,255,0);q.rect(4,3,4,3);q.fill(255,0,255);q.rect(0,0,1,1);
    const im=p.createImage(8,6);im.copy(q,0,0,8,6,0,0,8,6);s.reset();step(s,im);let b=bytes(s);check(close(at(b,0,0),[255,0,255,255]),'image top left '+at(b,0,0)+' bottom '+at(b,0,5));check(close(at(b,7,5),[255,255,0,255]),'image bottom right');
    const displayed=image=>{
      p.push();p.resetMatrix();p.imageMode(p.CORNER);p.noTint();p.blendMode(p.REPLACE);p.background(0);p.image(image,-p.width/2,-p.height/2,p.width,p.height);p.pop();
      const picks=[];for(const [x,y] of [[20,20],[p.width-20,20],[20,p.height-20],[p.width-20,p.height-20]]){
        const px=new Uint8Array(4);g.readPixels(x,p.height-1-y,1,1,g.RGBA,g.UNSIGNED_BYTE,px);picks.push([...px]);
      }return picks;
    };
    const directDisplay=displayed(im),feedbackDisplay=displayed(s.frame);
    check(JSON.stringify(directDisplay)===JSON.stringify(feedbackDisplay),'p.image displayed orientation '+JSON.stringify({directDisplay,feedbackDisplay}));
    step(s,null);step(s,null);b=bytes(s);check(close(at(b,0,0),[255,0,255,255]),'history top left');s.reset();step(s,q);b=bytes(s);check(close(at(b,0,0),[255,0,255,255]),'graphics top left');
    step(s,null,1,1,[1,0,0,1,1/8,0]);b=bytes(s);check(close(at(b,0,0),[255,0,0,255]),'translation left');check(close(at(b,7,2),[0,0,0,0]),'right domain');groups.push('orientation, source classes, affine translation');
    // Domain on all sides, half-texel clamping and source opacity/decay.
    s.reset();step(s,q);step(s,null,1,1,[1,0,0,1,-1/8,0]);check(close(at(bytes(s),0,2),[0,0,0,0]),'left domain');
    s.reset();step(s,q);step(s,null,1,1,[1,0,0,1,0,-1/6]);check(close(at(bytes(s),2,0),[0,0,0,0]),'top domain');
    s.reset();step(s,q);step(s,null,1,1,[1,0,0,1,0,1/6]);check(close(at(bytes(s),2,5),[0,0,0,0]),'bottom domain');
    const stripe=source(8,6);stripe.background(0);stripe.noStroke();stripe.fill(255);stripe.rect(4,0,4,6);
    s.reset();step(s,stripe);p.textureWrap(p.REPEAT);step(s,null,1,1,[1,0,0,1,.5/8,0]);
    check(close(at(bytes(s),3,2),[128,128,128,255],3),'half-pixel linear interpolation');
    s.reset();step(s,q);const old=bytes(s).data;step(s,blue,1,0);check(JSON.stringify(old)===JSON.stringify(bytes(s).data),'opacity zero equals null');step(s,red,0);check(close(at(bytes(s),3,2),[128,0,0,128]),'decay zero');groups.push('domain and independent decay/opacity');
    // Density and stretch, source mutation, replacement and interleaving.
    const dense=createP5FeedbackSurface(p,{width:8,height:6,density:2}),qd=source(8,6,2);qd.background(255,0,0);qd.fill(0,255,0);qd.rect(4,0,4,6);step(dense,qd);check(bytes(dense).w===16 && close(at(bytes(dense),14,2),[0,255,0,255]),'density2');step(dense,null);step(dense,null);check(close(at(bytes(dense),14,2),[0,255,0,255]),'density2 identity history');step(dense,null,1,1,[1,0,0,1,1/8,0]);check(close(at(bytes(dense),14,2),[0,0,0,0]) && close(at(bytes(dense),12,2),[0,255,0,255]),'density2 logical-pixel translation');
    const stretch=createP5FeedbackSurface(p,{width:12,height:4,density:1});step(stretch,q);check(at(bytes(stretch),0,0)[0]>240 && at(bytes(stretch),0,0)[2]>150 && close(at(bytes(stretch),0,3),[0,0,255,255]),'non-square stretch');
    qd.background(0,0,255);step(dense,qd,0);check(close(at(bytes(dense),4,4),[0,0,255,255]),'live graphics upload');
    step(dense,red,0);step(stretch,blue,0);check(close(at(bytes(dense),4,4),[128,0,0,128]),'surface uniforms isolated');check(close(at(bytes(stretch),4,2),[0,0,128,128]),'second surface source');
    code(()=>step(s,s.frame),'INVALID_INPUT');groups.push('density, stretch, live source, replacement and interleaving');
    // Reset and replacement lifecycle.
    s.reset();check(s.tick===0 && bytes(s).data.every(v=>v===0),'reset full transparent');step(s,red);const saved=bytes(s).data;
    const prior=s.frame;code(()=>s.resize(999999,8),'UNSUPPORTED');check(s.frame===prior && JSON.stringify(bytes(s).data)===JSON.stringify(saved),'invalid resize transaction');
    s.resize(5,7);check(s.tick===0 && s.frame!==prior && bytes(s).w===5 && bytes(s).h===7 && bytes(s).data.every(v=>v===0),'replacement resize');
    p.resizeCanvas(620,620);check(bytes(s).w===5 && bytes(s).h===7,'canvas resize independent');p.resizeCanvas(600,600);groups.push('reset and replacement resize');
    // Passive input and lifetime rules.
    const held=bytes(dense).data,denseTick=dense.tick;
    code(()=>dense.step({decay:1,transform:id,source:qd}),'INVALID_INPUT');check(dense.tick===denseTick&&JSON.stringify(bytes(dense).data)===JSON.stringify(held),'invalid input passive');
    const count=p._renderer.framebuffers.size;dense.dispose();dense.dispose();check(p._renderer.framebuffers.size===count-2,'exactly two framebuffers removed');code(()=>dense.frame,'DISPOSED');code(()=>dense.tick,'DISPOSED');code(()=>dense.reset(),'DISPOSED');qd.background(6,7,8);check(qd.canvas.width===16,'borrowed source alive');groups.push('input, disposal and borrowed lifetime');
    // Host-state preservation, active external framebuffer and exception balance.
    const state=()=>({target:p._renderer.activeFramebuffer(),erase:p._renderer._isErasing,blend:p._renderer.states.curBlendMode,model:[...p._renderer.states.uModelMatrix.mat4],view:[...p._renderer.states.uViewMatrix.mat4],fill:p._renderer.states.curFillColor?.slice(),shader:p._renderer.states.userFillShader,camera:p._renderer.states.curCamera,imageMode:p._renderer.states.imageMode,tint:String(p._renderer.states.tint)});
    const external=p.createFramebuffer({width:16,height:16,density:1,format:p.UNSIGNED_BYTE,channels:p.RGBA,depth:false,stencil:false,antialias:false});
    external.begin();p.translate(2,3);p.rotate(.17);p.imageMode(p.CENTER);p.tint(80,120,150,190);p.blendMode(p.ADD);p.noFill();p.stroke(13,20,30);const callerShader=p.createShader('precision highp float; attribute vec3 aPosition; void main(){gl_Position=vec4(aPosition,1.0);}','precision highp float; void main(){gl_FragColor=vec4(1.0);}');p.shader(callerShader);p.erase();
    const beforeState=state();step(s,red);const afterState=state();
    check(beforeState.target===afterState.target && beforeState.erase===afterState.erase && beforeState.blend===afterState.blend && JSON.stringify(beforeState.model)===JSON.stringify(afterState.model) && JSON.stringify(beforeState.view)===JSON.stringify(afterState.view) && JSON.stringify(beforeState.fill)===JSON.stringify(afterState.fill) && beforeState.shader===afterState.shader && beforeState.camera===afterState.camera && beforeState.imageMode===afterState.imageMode && beforeState.tint===afterState.tint,'caller state preserved');
    const nestedBegin=p.beginShape;
    p.beginShape=function(...args){code(()=>stretch.step({decay:1,transform:id,source:null,sourceOpacity:0}),'INVALID_STATE');code(()=>createP5FeedbackSurface(p,{width:3,height:3,density:1}),'INVALID_STATE');return nestedBegin.apply(this,args);};
    try{step(s,red);}finally{p.beginShape=nestedBegin;}
    const beforeFailure=bytes(s).data, priorFrame=s.frame, priorTick=s.tick;
    const originalBegin=p.beginShape;p.beginShape=()=>{throw Error('injected pass failure');};
    try { try {step(s,blue);throw Error('pass should fail');} catch(error){check(error.message==='injected pass failure','host exception preserved');} }
    finally {p.beginShape=originalBegin;}
    check(s.frame===priorFrame && s.tick===priorTick && p._renderer.activeFramebuffer()===external && JSON.stringify(bytes(s).data)===JSON.stringify(beforeFailure),'failed pass balanced and passive');
    step(s,blue);check(s.tick===priorTick+1,'retry succeeds');
    external.end();external.remove();
    const own=s.frame;own.begin();code(()=>s.step({decay:1,transform:id,source:null,sourceOpacity:0}),'INVALID_STATE');own.end();
    p.noErase();p.push();p.beginClip();p.rect(-2,-2,4,4);
    code(()=>s.reset(),'INVALID_STATE');p.endClip();code(()=>s.reset(),'INVALID_STATE');p.pop();
    s.reset();step(s,red);step(s,null,.7);const replay=bytes(s).data;
    s.reset();step(s,red);step(s,null,.7);check(JSON.stringify(replay)===JSON.stringify(bytes(s).data),'reset exact replay');
    const registry=p._renderer.framebuffers.size,originalCreate=p.createFramebuffer;let made=0;
    p.createFramebuffer=function(...args){if(++made===2)throw Error('injected allocation failure');return originalCreate.apply(this,args);};
    try {try{createP5FeedbackSurface(p,{width:7,height:5,density:1});throw Error('factory should fail');}catch(error){check(error.message==='injected allocation failure','factory cause');}}
    finally{p.createFramebuffer=originalCreate;}
    check(p._renderer.framebuffers.size===registry,'factory removes returned partial buffer');
    const beforeResize=s.frame,resizeBytes=bytes(s).data;made=0;
    p.createFramebuffer=function(...args){if(++made===2)throw Error('injected replacement failure');return originalCreate.apply(this,args);};
    try {try{s.resize(6,9);throw Error('resize should fail');}catch(error){check(error.message==='injected replacement failure','resize cause');}}
    finally{p.createFramebuffer=originalCreate;}
    check(s.frame===beforeResize && JSON.stringify(bytes(s).data)===JSON.stringify(resizeBytes) && p._renderer.framebuffers.size===registry,'replacement failure keeps old pair');
    groups.push('caller state, external target, clipping, pass failure, allocation failure and replay');
    const extra=[s,stretch];for(const x of extra)x.dispose();red.remove();blue.remove();transparent.remove();q.remove();qd.remove();stripe.remove();
    return {groups};
  });
  report.checks.push(...result.groups);const adapterSource=await fs.readFile(path.join(packageRoot,'src/p5-feedback-surface.js'),'utf8');const shaderParts=[...adapterSource.matchAll(/const P5_FEEDBACK_(?:VERTEX|FRAGMENT)_SOURCE = `([\s\S]*?)`;/g)].map(match=>match[1]);assert.equal(shaderParts.length,2);report.shaderSourceSha256=sha(shaderParts.join('\n'));report.framebufferProfile={rgba8Linear:true,physicalDestinations:[[8,6],[16,12],[12,4],[10,14]],sourceCases:[{kind:'p5.Image',physical:[8,6],density:1},{kind:'p5.Graphics Canvas2D',physical:[8,6],density:1},{kind:'p5.Graphics Canvas2D',physical:[16,12],density:2}]};
  const capture=async(name)=>{const image=path.join(out,name+'.png');await page.locator('#art canvas').screenshot({path:image});report.captures.push({name,image:path.relative(root,image),sha256:sha(await fs.readFile(image)),state:await run(()=>window.__feedbackPrint.snapshot())});};
  await capture('startup');await run(()=>window.__feedbackPrint.action('step'));await capture('step-1');await run(()=>window.__feedbackPrint.action('many'));await capture('step-25');
  await run(()=>window.__feedbackPrint.action('warp'));await run(()=>window.__feedbackPrint.action('step'));await capture('warp-26');
  await run(()=>window.__feedbackPrint.action('decay'));await run(()=>window.__feedbackPrint.action('motif'));await run(()=>window.__feedbackPrint.action('step'));await capture('edited-27');
  const displayed=Buffer.from((await page.locator('#art canvas').evaluate(c=>c.toDataURL('image/png'))).split(',')[1],'base64'), saveState=await run(()=>window.__feedbackPrint.snapshot());
  const downloadPromise=page.waitForEvent('download');await page.click('[data-action="save"]');const download=await downloadPromise;await download.saveAs(path.join(out,'saved.png'));
  assert.equal(sha(await fs.readFile(path.join(out,'saved.png'))),sha(displayed),'saved PNG equals displayed canvas');assert.deepEqual(await run(()=>window.__feedbackPrint.snapshot()),saveState);
  await run(()=>window.__feedbackPrint.action('reset'));await capture('reset');assert.equal((await run(()=>window.__feedbackPrint.snapshot())).tick,0);
  report.studyReplay=await run(async()=>{
    const study=window.__feedbackPrint,p=study.host,g=p._renderer.GL;
    const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const frameBytes=()=>{const old=g.getParameter(g.FRAMEBUFFER_BINDING),frame=study.surface.frame,pixels=new Uint8Array(600*600*4);g.bindFramebuffer(g.FRAMEBUFFER,frame.framebuffer);g.readPixels(0,0,600,600,g.RGBA,g.UNSIGNED_BYTE,pixels);g.bindFramebuffer(g.FRAMEBUFFER,old);return pixels;};
    const once=async()=>{for(let i=0;i<3;i++)study.action('step');return {source:await digest(study.source.drawingContext.getImageData(0,0,600,600).data),history:await digest(frameBytes())};};
    const first=await once();study.action('reset');const second=await once();if(first.source!==second.source||first.history!==second.history)throw Error('study complete source/history replay differs');study.action('reset');return {ticks:3,sourceBytes:600*600*4,historyBytes:600*600*4,sourceSha256:first.source,historySha256:first.history};
  });
  await page.reload();await page.waitForFunction(()=>window.__feedbackPrint?.ready);assert.equal((await run(()=>window.__feedbackPrint.snapshot())).tick,0);
  report.checks.push('editable study startup/steps/controls/reset/reload/save');
  report.transfer=await run(async()=>{
    const {createP5FeedbackSurface}=await import('/src/p5-feedback-surface.js');
    const p=window.__feedbackPrint.host,g=p._renderer.GL,source=p.createGraphics(32,24,p.P2D);
    source.pixelDensity(1);source.clear();source.noFill();source.stroke(34,77,133,210);source.strokeWeight(3);
    source.beginShape();source.vertex(4,4);source.vertex(4,20);source.vertex(19,20);source.vertex(19,6);source.vertex(28,6);source.endShape();
    source.noStroke();source.fill(223,79,30,180);source.circle(27,19,4);
    const surface=createP5FeedbackSurface(p,{width:32,height:24,density:1});
    const affine=[.94,.03,-.08,.83,.06,.09];
    const capture=()=>{const frame=surface.frame,old=g.getParameter(g.FRAMEBUFFER_BINDING),pixels=new Uint8Array(32*24*4);g.bindFramebuffer(g.FRAMEBUFFER,frame.framebuffer);g.readPixels(0,0,32,24,g.RGBA,g.UNSIGNED_BYTE,pixels);g.bindFramebuffer(g.FRAMEBUFFER,old);return [...pixels];};
    const execute=()=>{for(let i=0;i<7;i++)surface.step({decay:.88,transform:affine,source:i<3?source:null,sourceOpacity:.62});return capture();};
    const first=execute();surface.reset();const second=execute();
    if(JSON.stringify(first)!==JSON.stringify(second))throw Error('withheld glyph full-byte replay differs');
    if(!first.some(v=>v!==0))throw Error('withheld glyph transfer blank');
    p.push();p.background('#eee8d7');p.imageMode(p.CORNER);p.noTint();p.image(source,-240,-72,192,144);p.image(surface.frame,48,-72,192,144);p.pop();
    const png=p.canvas.toDataURL('image/png').split(',')[1];
    surface.dispose();source.remove();return {size:[32,24],ticks:7,equalBytes:first.length,nonzeroBytes:first.filter(v=>v!==0).length,png};
  });
  const transferPng=Buffer.from(report.transfer.png,'base64');delete report.transfer.png;
  const transferFile=path.join(out,'withheld-open-glyph.png');await fs.writeFile(transferFile,transferPng);report.captures.push({name:'withheld-open-glyph',image:path.relative(root,transferFile),sha256:sha(transferPng)});
  report.checks.push('withheld open glyph and anisotropic affine full-byte replay','study full source/history replay');
  report.performance=await run(async()=>{
    const {createP5FeedbackSurface}=await import('/src/p5-feedback-surface.js');
    const p=window.__feedbackPrint.host,g=p._renderer.GL,items=[];
    for(const size of [16,256,768]){
      const surface=createP5FeedbackSurface(p,{width:size,height:size,density:1});
      const started=performance.now();for(let i=0;i<3;i++)surface.step({decay:.9,transform:[1,0,0,1,0,0],source:null,sourceOpacity:0});g.finish();
      items.push({physical:[size,size],attachmentBytes:2*size*size*4,steps:3,elapsedMs:performance.now()-started});surface.dispose();
    }
    return items;
  });
  report.input_sha256_after=await hashes();assert.deepEqual(report.input_sha256_after,before);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error.stack??error);throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
console.log(JSON.stringify({status:report.status,out,checks:report.checks}));
