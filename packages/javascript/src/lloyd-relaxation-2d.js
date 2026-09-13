import { voronoiCells2D } from "./voronoi-cells-2d.js";
import { array, at, computed, finite, integer, record, work } from "./internal/geometry-b-utils.js";
class LloydRelaxationError extends Error { constructor(code) { super(code); this.name="LloydRelaxationError"; this.code=code; } }
const E=LloydRelaxationError;
export function lloydRelaxation2D(input) {
  record(E,input,["sites","bounds","iterations","strength","maxWork"]); const raw=array(E,at(E,input,"sites")), rb=array(E,at(E,input,"bounds"),4), bounds=[0,1,2,3].map(i=>finite(E,at(E,rb,i)));
  const iterations=integer(E,at(E,input,"iterations"),0,4294967295), strength=finite(E,at(E,input,"strength")), maxWork=integer(E,at(E,input,"maxWork"),0,Number.MAX_SAFE_INTEGER); if(!(bounds[0]<bounds[2]&&bounds[1]<bounds[3]&&strength>=0&&strength<=1)) throw new E("INVALID_INPUT");
  const sites=raw.map((r)=>{array(E,r,2);return [finite(E,at(E,r,0)),finite(E,at(E,r,1))];}), n=sites.length; if(!Number.isSafeInteger(n+iterations)) throw new E("WORK_LIMIT"); work(E,n+iterations,maxWork); if(iterations===0||n===0)return {sites:sites.map(p=>p.slice())};
  const passBudget=Math.floor((maxWork-n-iterations)/iterations), child=Math.floor(passBudget/2), centroid=passBudget-child; let current=sites;
  for(let pass=0;pass<iterations;pass+=1){ let cells; try { cells=voronoiCells2D({sites:current.map(p=>p.slice()),bounds:bounds.slice(),maxWork:child}).cells; } catch(error){ if(error && error.code==="WORK_LIMIT") throw new E("WORK_LIMIT"); if(error && error.code==="NUMERIC_OVERFLOW") throw new E("NUMERIC_OVERFLOW"); throw new E("INVALID_INPUT"); } let used=0, next=new Array(n);
    for(let i=0;i<n;i+=1){ const polygon=cells[i]; for(const p of polygon) { used=work(E,used+1,centroid); } used=work(E,used+1,centroid); if(polygon.length===0){next[i]=current[i].slice();continue;} let sum=0,cx=0,cy=0; for(let j=0;j<polygon.length;j+=1){const a=polygon[j],b=polygon[(j+1)%polygon.length],cross=computed(E,computed(E,a[0]*b[1])-computed(E,a[1]*b[0]));sum=computed(E,sum+cross);cx=computed(E,cx+computed(E,(a[0]+b[0])*cross));cy=computed(E,cy+computed(E,(a[1]+b[1])*cross));} if(sum===0){next[i]=current[i].slice();continue;} const x=computed(E,cx/computed(E,3*sum)),y=computed(E,cy/computed(E,3*sum));next[i]=[computed(E,current[i][0]+computed(E,strength*computed(E,x-current[i][0]))),computed(E,current[i][1]+computed(E,strength*computed(E,y-current[i][1])))]; }
    current=next;
  } return {sites:current.map(p=>p.slice())};
}
