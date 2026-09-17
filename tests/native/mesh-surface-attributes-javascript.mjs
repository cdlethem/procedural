#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSurfaceAttributes3D as prepare } from "../../packages/javascript/src/prepare-surface-attributes-3d.js";
import { startExternalExpansionServer } from "../../tools/serve_external_expansion_studies.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const packageRoot=resolve(process.env.PROCEDURALS_PACKAGE_ROOT??join(root,"packages/javascript"));
const sha=(value)=>createHash("sha256").update(value).digest("hex");
const relativePath=(path)=>relative(root,path).split(sep).join("/");
function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>entry.isDirectory()?files(join(directory,entry.name)):[join(directory,entry.name)]);}

function pure(){
  const fixture=JSON.parse(readFileSync(join(root,"fixtures/operations/prepare-surface-attributes-3d.json")));
  for(const vector of fixture.cases){
    if(vector.error)assert.throws(()=>prepare(vector.input),(error)=>error.code===vector.error,vector.id);
    else assert.deepStrictEqual(prepare(vector.input),vector.output,vector.id);
  }
  const oracle=JSON.parse(readFileSync(join(root,"tests/native/fixtures/mesh-attribute-oracles.json")));
  for(const vector of oracle.cases){
    const output=prepare(vector.input);
    for(const key of ["positions","triangles","uvs","sourceVertexIndices"])assert.deepStrictEqual(output[key],vector.output[key],`${vector.id}/${key}`);
    for(let i=0;i<output.normals.length;i++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(output.normals[i][axis]-vector.output.normals[i][axis])<=1e-12,`${vector.id}/${i}/${axis}`);
  }
  const input={positions:[[0,-0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],normalMode:"smooth",smoothingGroups:[0],cornerUVs:[[[0,-0],[1,0],[0,1]]],maxVertices:3,maxWork:30};
  const result=prepare(input);
  for(const rows of [result.positions,result.normals,result.uvs])for(const row of rows)for(const component of row)assert.equal(Object.is(component,-0),false,"canonical zero");
  result.positions[0][0]=9;result.normals[0][2]=9;result.uvs[0][0]=9;result.triangles[0][0]=9;result.sourceVertexIndices[0]=9;
  assert.equal(input.positions[0][0],0);assert.deepStrictEqual(prepare(input).positions[0],[0,0,0],"detached replay");
  assert.deepStrictEqual(Reflect.ownKeys(prepare(input)),["positions","triangles","normals","uvs","sourceVertexIndices"]);
  const bad=(mutation,code="INVALID_INPUT")=>{const next=structuredClone(input);mutation(next);assert.throws(()=>prepare(next),(error)=>error.code===code);};
  bad((x)=>{x.positions[0][1]=NaN;});bad((x)=>{x.triangles[0][0]=0.5;},"INVALID_TOPOLOGY");
  const getter={...input};Object.defineProperty(getter,"maxWork",{get(){throw Error("read getter");}});assert.throws(()=>prepare(getter),(error)=>error.code==="INVALID_INPUT");
  const symbol={...input,[Symbol("extra")]:true};assert.throws(()=>prepare(symbol),(error)=>error.code==="INVALID_INPUT");
  const sparse={...input,positions:[[,0,0],...input.positions.slice(1)]};assert.throws(()=>prepare(sparse),(error)=>error.code==="INVALID_INPUT");
  return fixture.cases.length+oracle.cases.length+8;
}

async function native(pureCases){
  process.env.PLAYWRIGHT_BROWSERS_PATH=join(root,".work/toolchains/playwright");
  const {chromium}=await import(join(root,".work/environments/p5js/node_modules/playwright/index.mjs"));
  const sources=[...new Set([fileURLToPath(import.meta.url),join(root,"tools/serve_external_expansion_studies.mjs"),...files(join(packageRoot,"examples/surface-attribute-vessel")),...files(join(packageRoot,"src/internal")).filter((path)=>/exact-rational|fdlibm-hypot|geometry-b-utils/.test(path)),join(packageRoot,"src/prepare-surface-attributes-3d.js"),join(root,"catalog/operations/prepare-surface-attributes-3d.json"),join(root,"fixtures/operations/prepare-surface-attributes-3d.json"),join(root,"tests/native/fixtures/mesh-attribute-oracles.json"),join(root,".work/environments/p5js/node_modules/p5/lib/p5.min.js")])];
  const hashes=()=>Object.fromEntries(sources.map((path)=>[relativePath(path),sha(readFileSync(path))]));
  const before=hashes();
  const output=process.argv[2]==="--output"?resolve(process.argv[3]):null;
  if(output&&(!output.startsWith(join(root,".work")+sep)||existsSync(output)))throw Error("Output must be fresh under .work");
  const directory=output?dirname(output):await mkdtemp(join(root,".work/mesh-surface-native-"));mkdirSync(directory,{recursive:true});
  const server=await startExternalExpansionServer(0,{packageRoot});let browser;
  const report={status:"running",scope:"Pure triangle attributes and one p5 WebGL vessel with independently supplied ribbon transfer; context loss requires reload. No target acceptance claim.",package_root:packageRoot,runtime:"p5 2.3.2 WebGL",pure_cases:pureCases,input_sha256_before:before,frames:[],checks:[]};
  try{
    browser=await chromium.launch({headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});report.browser=browser.version();
    const page=await browser.newPage({viewport:{width:1150,height:850},acceptDownloads:true});
    const errors=[];report.browser_errors=errors;page.on("pageerror",(error)=>errors.push(String(error.stack??error)));page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto(`${server.baseURL}/examples/surface-attribute-vessel/index.html`);
    await page.waitForFunction(()=>document.querySelector("#art")?.dataset.renderStatus==="ready"&&Boolean(window.surfaceAttributeStudy?.snapshot),null,{timeout:10000});
    const observe=()=>page.evaluate(()=>window.surfaceAttributeStudy.snapshot());
    async function capture(label){
      const state=await observe(),encoded=await page.locator("#art canvas").evaluate((canvas)=>canvas.toDataURL("image/png"));
      const png=Buffer.from(encoded.split(",")[1],"base64");const image=join(directory,`${label}.png`),stateFile=join(directory,`${label}.json`);
      writeFileSync(image,png);writeFileSync(stateFile,JSON.stringify(state,null,2)+"\n");
      const row={label,state_sha256:sha(JSON.stringify(state)),png_sha256:sha(png),png_bytes:png.length,png_path:relativePath(image),state_path:relativePath(stateFile)};report.frames.push(row);
      const pixels=await page.locator("#art canvas").evaluate((canvas)=>{const copy=document.createElement("canvas");copy.width=128;copy.height=96;const context=copy.getContext("2d");context.drawImage(canvas,0,0,128,96);return [...context.getImageData(0,0,128,96).data];});
      return {state,pixels,...row};
    }
    function visuallyEqual(a,b,label){let total=0,max=0;for(let i=0;i<a.pixels.length;i++){const difference=Math.abs(a.pixels[i]-b.pixels[i]);total+=difference;max=Math.max(max,difference);}const mean=total/a.pixels.length;report.checks.push(`${label} raster comparison: mean channel difference ${mean.toFixed(4)}, maximum ${max}`);assert.ok(mean<0.15&&max<=3,`${label} visual replay`);}
    async function action(key){const old=Number(await page.locator("#art").getAttribute("data-revision"));await page.locator(`button[data-action="${key}"]`).click();await page.waitForFunction((value)=>Number(document.querySelector("#art")?.dataset.revision)>value,old);}
    const baseline=await capture("baseline");
    assert.equal(baseline.state.styleRestored,true,"p5 texture mode restored after draw");
    const orientation=await page.locator("#art canvas").evaluate((canvas)=>{const copy=document.createElement("canvas");copy.width=canvas.width;copy.height=canvas.height;const context=copy.getContext("2d");context.drawImage(canvas,0,0);const pixel=(x,y)=>[...context.getImageData(x,y,1,1).data].slice(0,3);return {topLeft:pixel(360,250),topRight:pixel(420,250),bottomLeft:pixel(360,350),bottomRight:pixel(440,350)};});
    report.orientation_pixels=orientation;
    assert.ok(orientation.topLeft[0]>orientation.topLeft[1]*1.8&&orientation.topLeft[0]>orientation.topLeft[2]*2,"top-left red field");
    assert.ok(orientation.topRight[0]>orientation.topRight[2]*1.7&&orientation.topRight[1]>orientation.topRight[2]*1.5,"top-right gold field");
    assert.ok(orientation.bottomLeft[2]>orientation.bottomLeft[0]*1.5&&orientation.bottomLeft[1]>orientation.bottomLeft[0]*1.5,"bottom-left teal field");
    assert.ok(orientation.bottomRight[2]>orientation.bottomRight[0],"bottom-right blue field");
    assert.ok(baseline.state.model.uvs.length>baseline.state.model.sourceVertexIndices.filter((value,index,values)=>values.indexOf(value)===index).length,"seam/group duplication");
    assert.ok(baseline.state.model.normals.some((normal)=>normal[1]===-1),"top cap upward normal");
    await action("g");const shape=await capture("reshaped");assert.notDeepStrictEqual(shape.state.model.positions,baseline.state.model.positions);assert.deepStrictEqual(shape.state.model.uvs,baseline.state.model.uvs);assert.notEqual(shape.png_sha256,baseline.png_sha256);
    await action("0");await action("n");const flat=await capture("flat");assert.equal(flat.state.model.positions.length,3*flat.state.model.triangles.length);assert.notDeepStrictEqual(flat.state.model.normals,baseline.state.model.normals);
    await action("0");await action("u");const image=await capture("alternate-image");assert.deepStrictEqual(image.state.model,baseline.state.model);assert.notEqual(image.png_sha256,baseline.png_sha256);
    await action("0");await action("t");const transfer=await capture("ribbon-transfer");assert.notDeepStrictEqual(transfer.state.model.triangles,baseline.state.model.triangles);assert.notEqual(transfer.png_sha256,baseline.png_sha256);
    await action("0");const reset=await capture("reset");assert.deepStrictEqual(reset.state.settings,baseline.state.settings);assert.deepStrictEqual(reset.state.model,baseline.state.model);visuallyEqual(reset,baseline,"reset");assert.equal(reset.state.allocations-reset.state.frees,1,"old geometry released");
    await page.reload();await page.waitForFunction(()=>document.querySelector("#art")?.dataset.renderStatus==="ready"&&Boolean(window.surfaceAttributeStudy?.snapshot));const reload=await capture("reload");assert.deepStrictEqual(reload.state,baseline.state);visuallyEqual(reload,baseline,"reload");
    const saveState=await observe(),visible=Buffer.from((await page.locator("#art canvas").evaluate((canvas)=>canvas.toDataURL("image/png"))).split(",")[1],"base64");const download=page.waitForEvent("download");await page.locator('button[data-action="s"]').click();const saved=join(directory,"saved.png");await(await download).saveAs(saved);assert.deepStrictEqual(await observe(),saveState);assert.equal(sha(readFileSync(saved)),sha(visible));report.saved_png={path:relativePath(saved),sha256:sha(readFileSync(saved))};
    report.performance=await page.evaluate(async()=>{const {prepareSurfaceAttributes3D:f}=await import("/src/prepare-surface-attributes-3d.js");const rows=[];for(const n of [64,256,1024]){const positions=[[0,0,1]],triangles=[],groups=[],uvs=[];for(let i=0;i<=n;i++){const a=2*Math.PI*i/n;positions.push([Math.cos(a),Math.sin(a),0]);}for(let i=1;i<=n;i++){triangles.push([0,i,i+1]);groups.push(0);uvs.push([[0.5,0.5],[(i-1)/n,0],[i/n,1]]);}const input={positions,triangles,normalMode:"smooth",smoothingGroups:groups,cornerUVs:uvs,maxVertices:3*n,maxWork:positions.length+27*n};const times=[];let checksum=0;for(let rep=-1;rep<3;rep++){const begin=performance.now(),output=f(input),ms=performance.now()-begin;checksum=output.positions.length;if(rep>=0)times.push(ms);}times.sort((a,b)=>a-b);rows.push({faces:n,warmup:1,repetitions:3,median_ms:times[1],output_vertices:checksum,heap_bytes:performance.memory?.usedJSHeapSize??null});}return rows;});
    assert.deepStrictEqual(errors,[],"browser errors");
    report.checks.push(...["28 exact fixtures, 2 independent normal oracles, passive/ownership cases","WebGL structure: top cap, UV seam and smooth/flat vertex counts","vessel shape, image, normal, independent ribbon transfer","geometry cache release on revisions","full reset/reload state and tolerant raster, PNG save parity","small/study/stress browser timings","context loss explicitly requires reload"]);
    report.input_sha256_after=hashes();assert.deepStrictEqual(report.input_sha256_after,before,"source stability");report.status="passed";await page.close();
  }catch(error){report.status="failed";report.failure=String(error.stack??error);throw error;}
  finally{await browser?.close();await server.close();writeFileSync(output??join(directory,"report.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx"});}
  return {directory,output:output??join(directory,"report.json"),status:report.status,pure_cases:pureCases};
}

const pureCases=pure();
if(process.argv[2]==="--pure")console.log(JSON.stringify({status:"passed",pure_cases:pureCases}));
else console.log(JSON.stringify(await native(pureCases)));
