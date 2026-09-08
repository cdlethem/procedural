import { observeBranchMarks } from "/packages/javascript/examples/branch-marks/sketch.js";
let previous, baselineGeometry;
function prefix(shorter,longer){
  if(shorter.size!==longer.size)throw new Error('prefix root count differs');
  let grew=false;
  for(let t=0;t<shorter.size;t++){
    const a=shorter.treeAt(t).toValues(),b=longer.treeAt(t).toValues();
    if(a.segments.length>b.segments.length)throw new Error('extension shrank');
    grew ||= a.segments.length<b.segments.length;
    for(const k of ['segments','headings','lengths','parents','generations'])
      if(JSON.stringify(a[k])!==JSON.stringify(b[k].slice(0,a[k].length)))throw new Error('prefix '+k+' changed');
  }
  if(!grew)throw new Error('extension did not grow');
}
export function observe(expected){
  const c=observeBranchMarks(),trees=[];let tips=0,total=0;
  for(let t=0;t<c.composition.size;t++){
    const tree=c.composition.treeAt(t);trees.push(tree.toValues());total+=tree.size;
    for(let i=0;i<tree.size;i++)if(tree.childCountAt(i)===0)tips++;
  }
  const values=JSON.stringify(trees);
  if(c.revision!==expected.revision||c.composition.size!==expected.trees||total!==expected.segments||
      c.composition.totalSegments!==total||c.drawnSegments!==total||c.drawnTips!==expected.tips||
      c.drawnTips!==(c.settings.taper?tips:0))throw new Error('revision/tree/line/tip count differs');
  for(const [key,value] of Object.entries(expected.settings))if(c.settings[key]!==value)throw new Error('setting '+key+' differs');
  if(!previous)baselineGeometry=values;
  else {
    const same=c.composition===previous.composition;
    if(same!==expected.retained)throw new Error('retention differs');
    if(same&&values!==previous.values)throw new Error('retained geometry changed');
    if(!same&&!expected.sameGeometry&&values===previous.values)throw new Error('geometry edit unchanged');
    if(expected.prefixPrevious)prefix(previous.composition,c.composition);
  }
  if(expected.sameGeometry&&values!==baselineGeometry)throw new Error('reset geometry differs');
  previous={composition:c.composition,values};
  return {revision:c.revision,trees:c.composition.size,segments:total,drawnSegments:c.drawnSegments,
    drawnTips:c.drawnTips,settings:c.settings,retained:expected.retained,sameGeometryAsBaseline:values===baselineGeometry};
}
