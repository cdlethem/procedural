import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {drawPaths,pathsDefinitions} from "../lib/adapters/paths";
import {drawSystems,systemsDefinitions} from "../lib/adapters/systems";
import {drawMaterials,materialsDefinitions} from "../lib/adapters/materials";
import {tenfoldStudies} from "../content/tenfold-studies.mjs";
import {createDocument,createLayer,validateDocument} from "../lib/studio";
import {createDocumentV3,validateStudioDocument} from "../lib/studio-document";
import legacy from "../lib/legacy-v3-expansion.json";

for(const [defs,draw] of [[pathsDefinitions,drawPaths],[systemsDefinitions,drawSystems],[materialsDefinitions,drawMaterials]] as const){
 for(const def of defs)test(`${def.id}: actual shared drawing, parameter envelope, edits and replay`,()=>{
  const layer=createLayer(def.id),before=structuredClone(layer);
  assert.deepEqual(Object.keys(layer.params).sort(),def.parameters.map(p=>p.key).sort());
  function commands(input:typeof layer){
   const hash=createHash('sha256');let marks=0;
   const p=new Proxy({CLOSE:'close',CORNER:'corner',CENTER:'center',ROUND:'round'} as Record<string,any>,{get(target,name:string){if(name in target)return target[name];return (...args:any[])=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name} must be finite`);if(['vertex','line','circle','rect','triangle','square'].includes(name))marks++;hash.update(JSON.stringify([name,...args]));};}});
   draw(p,input);return {hash:hash.digest('hex'),marks};
  }
  const baseline=commands(layer);assert.ok(baseline.marks>0);assert.deepEqual(commands(layer),baseline);assert.deepEqual(layer,before);
  assert.notEqual(commands({...layer,palette:[0x13579b,0xfedcba,0x654321,0xabcdef,0x2f1029]}).hash,baseline.hash);
  const study=tenfoldStudies.find(s=>s.slug===def.id)!;assert.ok(study);
  const control=def.parameters.find(p=>p.label===study.structuralControl.label);assert.ok(control,'manifest edit label must name a real control');
  const edited={...layer,params:{...layer.params,[control.key]:study.structuralControl.value as number}};
  assert.notEqual(commands(edited).hash,baseline.hash,'structural edit must alter drawing');
  for(const extreme of ['min','max'] as const){const params={...layer.params};for(const parameter of def.parameters)if(parameter.type==='number')params[parameter.key]=parameter[extreme]!;commands({...layer,params});}
 });
}

test('published 30-study documents migrate with exact predecessor membership',()=>{
 for(const entry of legacy.techniques){
  const doc=createDocument(entry.technique);const saved={...doc,catalogSha256:legacy.catalogSha256};assert.deepEqual(validateDocument(saved),doc);
 }
 const doc=createDocument('rounded-panels');assert.throws(()=>validateDocument({...doc,catalogSha256:legacy.catalogSha256}),/not available/);
 const mixed=createDocumentV3();const {id,visible,opacity,...content}=createLayer('cell-mosaic');mixed.layers[0].content=content;
 assert.deepEqual(validateStudioDocument({...mixed,catalogSha256:legacy.catalogSha256}),mixed);
 const forged=createDocument('field-marks');assert.throws(()=>validateDocument({...forged,catalogSha256:'0'.repeat(64)}),/catalogSha256/);
});
