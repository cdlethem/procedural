import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {externalDynamicsDefinitions,externalDynamicsPalette} from '../lib/adapters/external-dynamics';
import {externalDynamicsStudies} from '../content/external-dynamics-studies.mjs';
import type {Layer} from '../lib/studio-types';
import {drawDynamics as draw} from './helpers/draw-recorder';
function layerFor(id:string):Layer{
  const definition=externalDynamicsDefinitions.find(item=>item.id===id)!;
  return {id:`layer-${id}`,technique:id,visible:true,opacity:1,seed:42,palette:externalDynamicsPalette(id)!,cutEdits:[],transform:{x:320,y:320,scale:1,rotation:0},params:{...definition.defaults}};
}
const edits:Record<string,Record<string,number|string|boolean>>={
  'lingering-links':{ticks:30,radius:118,linger:3,dotMarks:true},
  'sensing-trails':{ticks:45,field:'lower-left',gain:-.05,dotMarks:true},
  'flocking-marks':{ticks:45,chain:true,separation:.6,dotMarks:true},
  'guarded-bands':{wide:true,clearance:32,transfer:true,showRejected:false},
  'hatched-islands':{spacing:8,cross:80,twist:0,rotation:71,region:'island-b',outline:false},
  'bridge-web':{ticks:26,strain:60,slant:-31,stride:2,candidate:false},
  'neighborhood-growth':{ticks:9,chain:true,minLength:50,step:1,insert:3,minNeighbors:0,maxNeighbors:7},
  'elastic-loops':{ticks:13,growth:0,curl:-.15,windX:2,range:0,strength:24,structure:true},
  'dye-currents':{ticks:60,injection:.2,viscosity:.08,projection:false,texture:true,contours:false},
};
test('nine new definitions and content records are complete and distinct',()=>{
  assert.equal(externalDynamicsDefinitions.length,9);assert.equal(externalDynamicsStudies.length,9);
  assert.deepEqual(externalDynamicsDefinitions.map(x=>x.id),externalDynamicsStudies.map(x=>x.slug));
  for(const definition of externalDynamicsDefinitions){assert.deepEqual(Object.keys(definition.defaults).sort(),definition.parameters.map(p=>p.key).sort());
    const content=readFileSync(new URL(`../content/${definition.id}.md`,import.meta.url),'utf8');assert.ok(content.includes('| Control | Canvas effect |'),definition.id);}
});
for(const definition of externalDynamicsDefinitions)test(`${definition.id}: real operation replay, independent palette, and meaningful controls`,()=>{
  const layer=layerFor(definition.id),before=structuredClone(layer),baseline=draw(layer);assert.ok(baseline.marks>0);
  assert.deepEqual(draw(layer),baseline,'deterministic cached replay');assert.deepEqual(layer,before,'caller layer unchanged');
  const colors=externalDynamicsPalette(definition.id)!;assert.deepEqual(colors,layer.palette);colors[0]^=0xffffff;assert.notDeepEqual(colors,externalDynamicsPalette(definition.id),'palette helper copies');
  const recolored=draw({...layer,palette:[0x123456,0xabcdef,0x654321,0xffcc00,0x111111,0xf2eee2]});
  assert.equal(recolored.geometry,baseline.geometry,'palette retains computed geometry');assert.notEqual(recolored.styled,baseline.styled,'palette changes drawing');
  for(const [key,value] of Object.entries(edits[definition.id])){
    const changed=draw({...layer,params:{...layer.params,[key]:value}});
    assert.notEqual(changed.styled,baseline.styled,`${key} changes actual drawing`);
    if(!['dotMarks','showRejected','outline','candidate','largeMarks','structure','contours'].includes(key))
      assert.notEqual(changed.geometry,baseline.geometry,`${key} changes computed geometry`);
  }
});
test('exposed combined upper bounds remain runnable within each declared replay cap',()=>{
  for(const definition of externalDynamicsDefinitions){const layer=layerFor(definition.id),params={...layer.params};
    for(const control of definition.parameters){if(control.type==='number')params[control.key]=control.max!;
      else if(control.type==='boolean')params[control.key]=true;
      else params[control.key]=control.options![1].value;}
    assert.ok(draw({...layer,params}).marks>0,definition.id);
  }
});
test('dynamics layers keep clear space and dye carries concentration in alpha',()=>{
  for(const definition of externalDynamicsDefinitions){
    const drawing=draw(layerFor(definition.id));
    assert.equal(drawing.backgrounds,0,`${definition.id} must not cover lower layers with paper`);
  }
  const dye=draw(layerFor('dye-currents')).imageAlpha;
  assert.ok(dye,'dye image is drawn');
  assert.ok(dye.transparent>0,'zero dye leaves transparent pixels');
  assert.ok(dye.partial>0,'dye pixels retain partial alpha');
  assert.equal(dye.opaque,0,'dye image contains no opaque paper pixels');
});
