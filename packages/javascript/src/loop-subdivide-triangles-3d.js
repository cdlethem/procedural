import { arr, calc, charge, fail, get, integer, points, rec, work } from "./internal/mesh-study-utils.js";
const KEYS = ["positions", "indices", "levels", "maxWork"];
const edgeKey = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;

function topology(vertexCount, faces) {
  const edges = new Map(), neighbors = Array.from({length: vertexCount}, () => new Set());
  const links = Array.from({length: vertexCount}, () => new Map()), signatures = new Set();
  for (const face of faces) {
    if (new Set(face).size !== 3) fail("INVALID_TOPOLOGY");
    const signature = [...face].sort((a,b) => a-b).join(",");
    if (signatures.has(signature)) fail("INVALID_TOPOLOGY");
    signatures.add(signature);
    for (let i=0; i<3; i++) {
      const a=face[i], b=face[(i+1)%3], c=face[(i+2)%3], key=edgeKey(a,b);
      const entries=edges.get(key) ?? []; entries.push([a,b,c]); edges.set(key,entries);
      neighbors[a].add(b); neighbors[b].add(a);
      const link=links[a];
      if (!link.has(b)) link.set(b,new Set());
      if (!link.has(c)) link.set(c,new Set());
      link.get(b).add(c); link.get(c).add(b);
    }
  }
  const boundary = Array.from({length:vertexCount}, () => []);
  for (const entries of edges.values()) {
    if (entries.length>2 || (entries.length===2 && entries[0][0]===entries[1][0])) fail("INVALID_TOPOLOGY");
    if (entries.length===1) { const [a,b]=entries[0]; boundary[a].push(b); boundary[b].push(a); }
  }
  for (let v=0; v<vertexCount; v++) {
    const link=links[v], ends=[...link.values()].filter(n => n.size===1).length;
    if (!link.size || [...link.values()].some(n => n.size<1 || n.size>2)) fail("INVALID_TOPOLOGY");
    if (boundary[v].length===0 ? ends!==0 : boundary[v].length!==2 || ends!==2) fail("INVALID_TOPOLOGY");
    const seen=new Set(), stack=[link.keys().next().value];
    while (stack.length) { const current=stack.pop(); if (seen.has(current)) continue; seen.add(current); for (const next of link.get(current)) stack.push(next); }
    if (seen.size!==link.size) fail("INVALID_TOPOLOGY");
    boundary[v].sort((a,b)=>a-b);
  }
  return {edges,neighbors,boundary};
}

/** Refine an oriented triangle manifold using Loop vertex and edge masks. */
export function loopSubdivideTriangles3D(input) {
  rec(input,KEYS);
  let positions=points(get(input,"positions"),undefined,3);
  const raw=get(input,"indices"); arr(raw);
  let indices=raw.map((_,i)=>{const face=get(raw,String(i));arr(face,3);return [0,1,2].map(j=>integer(get(face,String(j)),0,positions.length-1));});
  const levels=integer(get(input,"levels"),0,30), maxWork=work(get(input,"maxWork"));
  if (positions.length<3 || indices.length<1) fail("INVALID_INPUT");
  let vertices=positions.length, faces=indices.length, budget=0;
  for(let i=0;i<levels;i++) {
    budget+=2*vertices+10*faces; vertices+=3*faces; faces*=4;
    if (!Number.isSafeInteger(budget) || !Number.isSafeInteger(vertices) || !Number.isSafeInteger(faces) || vertices>4294967295 || faces>4294967295) fail("WORK_LIMIT");
  }
  charge(budget+vertices+3*faces,maxWork);
  let graph=topology(positions.length,indices);
  for(let level=0;level<levels;level++) {
    const {edges,neighbors,boundary}=graph;
    const ordered=[...edges.keys()].map(key=>key.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const edgeIds=new Map(ordered.map(([a,b],i)=>[edgeKey(a,b),positions.length+i]));
    const next=positions.map((point,i)=>{
      if(boundary[i].length===2) {
        const [a,b]=boundary[i];
        return point.map((value,j)=>calc(calc(.75*value)+calc(.125*calc(positions[a][j]+positions[b][j]))));
      }
      const adjacent=[...neighbors[i]].sort((a,b)=>a-b), n=adjacent.length;
      const beta=n===3?3/16:(1/n)*(5/8-(3/8+.25*Math.cos(2*Math.PI/n))**2);
      return point.map((value,j)=>{let sum=0;for(const k of adjacent)sum=calc(sum+positions[k][j]);return calc(calc((1-n*beta)*value)+calc(beta*sum));});
    });
    for(const [a,b] of ordered) {
      const entries=edges.get(edgeKey(a,b));
      next.push(positions[a].map((value,j)=>{
        const ends=calc(value+positions[b][j]);
        if(entries.length===1)return calc(ends/2);
        const opposite=calc(positions[entries[0][2]][j]+positions[entries[1][2]][j]);
        return calc(calc(.375*ends)+calc(.125*opposite));
      }));
    }
    const refined=[];
    for(const [a,b,c] of indices) {
      const ab=edgeIds.get(edgeKey(a,b)),bc=edgeIds.get(edgeKey(b,c)),ca=edgeIds.get(edgeKey(c,a));
      refined.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    positions=next; indices=refined; graph=topology(positions.length,indices);
  }
  return {positions,indices};
}
