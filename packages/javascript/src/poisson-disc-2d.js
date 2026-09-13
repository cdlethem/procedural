import { array, at, computed, finite, integer, record, work } from "./internal/geometry-b-utils.js";
class PoissonDiscError extends Error { constructor(code) { super(code); this.name = "PoissonDiscError"; this.code = code; } }
const E = PoissonDiscError;
export function poissonDisc2D(input) {
  record(E, input, ["bounds", "radius", "attemptsPerActive", "maxPoints", "rngState", "maxWork"]);
  const rawBounds = array(E, at(E,input,"bounds"),4), bounds = [0,1,2,3].map(i=>finite(E,at(E,rawBounds,i)));
  const radius = finite(E,at(E,input,"radius")), attempts = integer(E,at(E,input,"attemptsPerActive"),1,4294967295), maxPoints = integer(E,at(E,input,"maxPoints"),0,4294967295), initial = integer(E,at(E,input,"rngState"),0,4294967295), maxWork = integer(E,at(E,input,"maxWork"),0,Number.MAX_SAFE_INTEGER);
  if (!(bounds[0] < bounds[2] && bounds[1] < bounds[3] && radius > 0)) throw new E("INVALID_INPUT");
  if (maxPoints === 0) return { points: [], rngState: initial, exhausted: false };
  const width = computed(E,bounds[2]-bounds[0]), height = computed(E,bounds[3]-bounds[1]), cell = computed(E,radius / Math.sqrt(2)); if (!(cell > 0)) throw new E("NUMERIC_OVERFLOW");
  let state=initial, spent=0; const draw=()=>{ spent=work(E,spent+1,maxWork); state=(Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
  const cellOf=(x,y)=>{ const cx=Math.floor((x-bounds[0])/cell),cy=Math.floor((y-bounds[1])/cell); if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cy)) throw new E("NUMERIC_OVERFLOW"); return [cx,cy]; };
  const points=[], active=[], grid=new Map(); const insert=(x,y)=>{ if (!Number.isFinite(x)||!Number.isFinite(y)) throw new E("NUMERIC_OVERFLOW"); const c=cellOf(x,y), k=`${c[0]},${c[1]}`; const index=points.length; points.push([x===0?0:x,y===0?0:y]); active.push(index); let bucket=grid.get(k); if(!bucket){bucket=[];grid.set(k,bucket);} bucket.push(index); };
  insert(computed(E,bounds[0]+computed(E,draw()*width)),computed(E,bounds[1]+computed(E,draw()*height)));
  while(active.length && points.length < maxPoints) { const activeSlot=Math.floor(draw()*active.length), base=points[active[activeSlot]]; let accepted=false;
    for(let i=0;i<attempts;i+=1) { spent=work(E,spent+1,maxWork); const rho=computed(E,radius*Math.sqrt(computed(E,1+computed(E,3*draw())))), angle=computed(E,2*Math.PI*draw()), x=computed(E,base[0]+computed(E,rho*Math.cos(angle))), y=computed(E,base[1]+computed(E,rho*Math.sin(angle)));
      if(x<bounds[0]||x>bounds[2]||y<bounds[1]||y>bounds[3]) continue; const [cx,cy]=cellOf(x,y); let valid=true;
      for(let dy=-2;dy<=2&&valid;dy+=1) for(let dx=-2;dx<=2&&valid;dx+=1) { const bucket=grid.get(`${cx+dx},${cy+dy}`); if(bucket) for(const index of bucket) { spent=work(E,spent+1,maxWork); if(computed(E,Math.hypot(x-points[index][0],y-points[index][1]))<radius){valid=false;break;} } }
      if(valid){insert(x,y);accepted=true;break;}
    }
    if(!accepted){ active[activeSlot]=active[active.length-1]; active.pop(); }
  }
  return { points: points.map(p=>p.slice()), rngState:state, exhausted:active.length===0 };
}
