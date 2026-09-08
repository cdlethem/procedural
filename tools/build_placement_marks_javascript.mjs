#!/usr/bin/env node
/** Build the local CP3 JavaScript package and an installable PlacementMarks starter. */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = join(ROOT, "packages/javascript");
const PLACEMENT = join(PACKAGE, "examples/placement-marks");
const OUTPUT_ROOT = join(ROOT, ".work/dist/cp3");
const VERSION = "0.3.0";
const NAME = "@procedurals/javascript";
const NOTICES = [join(ROOT, "LICENSE"), join(ROOT, "THIRD_PARTY_NOTICES.md")];
const BASE = join(ROOT, "fixtures/operations/seeded-circle-placement.json");
const ORDERED = join(ROOT, "fixtures/operations/ordered-circle-filter.json");

function hash(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function display(path) { return relative(ROOT, path).split(sep).join("/"); }
function files(root) { const out=[]; for (const e of readdirSync(root,{withFileTypes:true})) { const p=join(root,e.name); if(e.isDirectory())out.push(...files(p)); else if(e.isFile())out.push(p); } return out.sort(); }
function manifest(root, prefix=root) { return files(root).map(path=>({path:relative(prefix,path).split(sep).join("/"),sha256:hash(path)})); }
function write(path, value) { mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,value); }
function copy(source,target) { mkdirSync(dirname(target),{recursive:true}); cpSync(source,target); }
function required(path) { if(!existsSync(path)) throw new Error("Missing CP3 input: "+display(path)); return path; }
function run(command,args,options={}) { const result=spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout:options.timeout??300000,...options}); if(result.error)throw result.error; if(result.status!==0)throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stdout}${result.stderr}`); return result; }
function json(stdout,label) { const text=stdout.trim(); if(!text)throw new Error("Expected JSON from "+label); return JSON.parse(text); }
function stable(inputs) { for(const [path,value] of Object.entries(inputs))if(hash(join(ROOT,path))!==value)throw new Error("Source changed during build: "+path); }
function sourceHashes(paths) { return Object.fromEntries(paths.map(path=>[display(path),hash(path)])); }

function packageMetadata() {
  const source=JSON.parse(readFileSync(join(PACKAGE,"package.json"),"utf8"));
  if(source.name!==NAME||source.version!=="0.1.0")throw new Error("Unexpected source package metadata");
  return { source, staged:{...source,version:VERSION}, transformation:{kind:"staged_package_metadata_version",path:"packages/javascript/package.json",from:source.version,to:VERSION} };
}
function server() { return `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
const root=resolve('.'); const port=Number.parseInt(process.env.PORT??'8765',10);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be an integer from 0 through 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
function target(value){if(value==='/')return join(root,'index.html');if(value==='/p5.js')return join(root,'node_modules/p5/lib/p5.min.js');if(value.startsWith('/node_modules/@procedurals/javascript/'))return join(root,value.slice(1));if(/^\\/[a-z0-9-]+\\.(html|js)$/i.test(value))return join(root,value.slice(1));return null;}
const server=createServer(async(request,response)=>{const path=target(new URL(request.url,'http://localhost').pathname);if(!path||!normalize(path).startsWith(root)){response.writeHead(404);response.end();return;}try{const body=await readFile(path);response.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});response.end(body);}catch{response.writeHead(404);response.end();}});server.listen(port,'127.0.0.1',()=>{const address=server.address();console.log(JSON.stringify({event:'ready',url:'http://127.0.0.1:'+(typeof address==='object'&&address?address.port:port)}));});
`; }
function starterPackage(tarball) { return JSON.stringify({name:"procedurals-placement-marks-starter",private:true,version:VERSION,type:"module",scripts:{start:"node server.mjs"},dependencies:{[NAME]:`file:vendor/${tarball}`,p5:"2.3.2"}},null,2)+"\n"; }
function transformSources(starter) {
  const index=readFileSync(join(PLACEMENT,"index.html"),"utf8");
  const model=readFileSync(join(PLACEMENT,"placement-marks.js"),"utf8");
  const sketch=readFileSync(join(PLACEMENT,"sketch.js"),"utf8");
  const importMap=`<script type="importmap">{"imports":{"${NAME}":"/node_modules/${NAME}/src/index.js","${NAME}/":"/node_modules/${NAME}/"}}</script>`;
  if(model.split('"../../src/circle-placements.js"').length!==2||index.split("</head>").length!==2)throw new Error("Unexpected PlacementMarks import template");
  const generatedIndex=index.replace("</head>",`${importMap}</head>`);
  const generatedModel=model.replace('"../../src/circle-placements.js"',`"${NAME}"`);
  if(generatedModel!==model.replace('"../../src/circle-placements.js"',`"${NAME}"`)||sketch!==readFileSync(join(PLACEMENT,"sketch.js"),"utf8"))throw new Error("Unexpected starter rewrite");
  write(join(starter,"index.html"),generatedIndex); write(join(starter,"placement-marks.js"),generatedModel); write(join(starter,"sketch.js"),sketch);
  return {originals:{index,model,sketch},generated:{index:generatedIndex,model:generatedModel,sketch},rewrites:{"index.html":{inserted:importMap},"placement-marks.js":{from:"../../src/circle-placements.js",to:NAME},"sketch.js":{byte_identical:true}}};
}
function consumerSmoke(starter, installed) {
  const script=join(starter,".consumer-smoke.mjs");
  write(script,`import { regularGrid, gradientNoise2D01, cyclicPalette, gradientPath2D } from '${NAME}';
import { createSeededPlacementMarks, createRadialPlacementMarks } from './placement-marks.js';
const base=createSeededPlacementMarks(42,5000,4,64,1).placements;
const extended=createSeededPlacementMarks(42,10000,4,64,1).placements;
if(base.size!==424||extended.size!==517||extended.attempts!==10000)throw new Error('seeded counts');
for(let i=0;i<base.size;i++){const a=base.pointAt(i),b=extended.pointAt(i);if(!Object.is(a[0],b[0])||!Object.is(a[1],b[1])||!Object.is(base.radiusAt(i),extended.radiusAt(i))||base.sourceIndexAt(i)!==extended.sourceIndexAt(i))throw new Error('accepted prefix '+i);}
const authored=createRadialPlacementMarks(1).placements;if(authored.attempts!==160)throw new Error('radial proposals');
for(const value of [regularGrid,gradientNoise2D01,cyclicPalette,gradientPath2D])if(typeof value!=='function')throw new Error('previous export missing');
const resolved=await import.meta.resolve('${NAME}');if(resolved!==new URL('./node_modules/@procedurals/javascript/src/index.js',import.meta.url).href)throw new Error('public package resolved outside starter');
const p5=JSON.parse(await (await import('node:fs/promises')).readFile('./node_modules/p5/package.json','utf8'));if(p5.version!=='2.3.2')throw new Error('unexpected p5 '+p5.version);
console.log(JSON.stringify({baseline:base.size,extended:extended.size,accepted_prefix:true,radial_proposals:authored.attempts,previous_exports:true,resolved,p5_version:p5.version}));`);
  const result=json(run("node",[".consumer-smoke.mjs"],{cwd:starter,timeout:180000}).stdout,"installed PlacementMarks consumer");
  rmSync(script,{force:true});
  return result;
}

async function main() {
  let output=join(OUTPUT_ROOT,"javascript"); const args=process.argv.slice(2); for(let i=0;i<args.length;i++){if(args[i]==="--output")output=resolve(args[++i]??"");else throw new Error("Unknown argument: "+args[i]);}
  output=resolve(output); if(!(output===OUTPUT_ROOT||output.startsWith(OUTPUT_ROOT+sep)))throw new Error("output must stay under .work/dist/cp3"); if(existsSync(output))throw new Error("Refusing occupied CP3 output: "+display(output));
  const metadata=packageMetadata(); const inputs=[join(PACKAGE,"package.json"),...files(join(PACKAGE,"src")),...files(join(PACKAGE,"examples")),...NOTICES,BASE,ORDERED,fileURLToPath(import.meta.url)].map(required); const hashes=sourceHashes(inputs);
  mkdirSync(output,{recursive:true}); const build=join(output,"build"); mkdirSync(build); const cache=join(output,".npm-cache"); mkdirSync(cache); const env={...process.env,npm_config_cache:cache};
  const staged=join(build,"package"); cpSync(join(PACKAGE,"src"),join(staged,"src"),{recursive:true}); cpSync(join(PACKAGE,"examples"),join(staged,"examples"),{recursive:true}); for(const notice of NOTICES)copy(notice,join(staged,basename(notice))); write(join(staged,"package.json"),JSON.stringify(metadata.staged,null,2)+"\n"); write(join(staged,"README.md"),`# Procedurals JavaScript ${VERSION}\n\nLocal JavaScript package with field, path, placement and supporting operations.\n`);
  const stagedManifest=manifest(staged);
  const packed=json(run("npm",["pack","--json"],{cwd:staged,env,timeout:180000}).stdout,"npm pack")[0]; if(!packed?.filename)throw new Error("npm pack produced no filename"); const tarball=join(output,packed.filename); copy(join(staged,packed.filename),tarball);
  const unpacked=join(build,"unpacked");mkdirSync(unpacked);run("tar",["-xzf",tarball,"-C",unpacked]); for(const p of ["package/src/index.js","package/src/circle-placements.js","package/examples/field-marks/index.html","package/examples/path-marks/index.html","package/examples/placement-marks/index.html","package/LICENSE","package/THIRD_PARTY_NOTICES.md"])if(!existsSync(join(unpacked,p)))throw new Error("Tarball omitted "+p);
  const unpackedManifest=manifest(join(unpacked,"package")); if(JSON.stringify(stagedManifest)!==JSON.stringify(unpackedManifest))throw new Error("npm tarball bytes differ from staged package");
  const starter=join(build,"procedurals-placement-marks-browser");mkdirSync(starter); const source=transformSources(starter); copy(tarball,join(starter,"vendor",packed.filename)); for(const notice of NOTICES)copy(notice,join(starter,basename(notice))); write(join(starter,"package.json"),starterPackage(packed.filename)); write(join(starter,"README.md"),`# PlacementMarks browser starter\n\nRun npm install, then npm start and open the printed URL. This installs the adjacent ${packed.filename} and pinned p5 2.3.2. Edit placement-marks.js for the operation composition.\n`); write(join(starter,"server.mjs"),server()); for(const p of ["index.html","placement-marks.js","sketch.js","server.mjs"])if(p.endsWith(".js"))run("node",["--check",join(starter,p)]);
  if(source.generated.sketch!==source.originals.sketch||source.generated.model.includes("../../src/")||source.generated.index.includes("../../src/"))throw new Error("starter source transformation failed");
  run("npm",["install","--ignore-scripts","--no-audit","--no-fund"],{cwd:starter,env,timeout:180000}); const lock=JSON.parse(readFileSync(join(starter,"package-lock.json"),"utf8")); if(!lock.packages?.["node_modules/p5"]?.integrity||lock.packages?.["node_modules/@procedurals/javascript"]?.resolved!==`file:vendor/${packed.filename}`)throw new Error("starter package is not pinned/local");
  const consumer=consumerSmoke(starter,join(starter,"node_modules/@procedurals/javascript"));
  rmSync(join(starter,"node_modules"),{recursive:true,force:true});
  if(existsSync(join(starter,"node_modules")))throw new Error("starter archive retained node_modules");
  const starterManifest=manifest(starter,build); const zip=join(output,`procedurals-placement-marks-browser-${VERSION}.zip`); run("zip",["-q","-r",zip,basename(starter)],{cwd:build,timeout:180000});
  const archiveRoot=join(build,"archive-consumer"); mkdirSync(archiveRoot); run("unzip",["-q",zip,"-d",archiveRoot],{timeout:180000}); const extracted=join(archiveRoot,basename(starter));
  run("npm",["ci","--ignore-scripts","--no-audit","--no-fund"],{cwd:extracted,env,timeout:180000}); const archiveConsumer=consumerSmoke(extracted,join(extracted,"node_modules/@procedurals/javascript")); rmSync(join(extracted,"node_modules"),{recursive:true,force:true});
  stable(hashes); const report={status:"passed",scope:"CP3 JavaScript 0.3.0 local package and installed PlacementMarks starter checks only; no browser launch, render, registry publication, or target acceptance.",package_version:VERSION,input_sha256:hashes,artifacts:{npm_tarball:{path:display(tarball),sha256:hash(tarball),entries:unpackedManifest},browser_starter_zip:{path:display(zip),sha256:hash(zip),entries:starterManifest}},installed_consumer:{placement_marks:consumer,extracted_archive:archiveConsumer,p5_version:"2.3.2",package_lock_sha256:hash(join(starter,"package-lock.json")),starter_rewrites:source.rewrites},included_file_manifest:{staged_package:stagedManifest,starter:starterManifest},environment:{node:process.version,npm:run("npm",["--version"],{env,timeout:30000}).stdout.trim()}};
  write(join(output,"build-result.json"),JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({status:report.status,tarball:display(tarball),starter_zip:display(zip)}));
}
main().catch(error=>{console.error(error?.stack??error);process.exitCode=1;});
