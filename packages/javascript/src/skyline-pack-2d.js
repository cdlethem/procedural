import { array, at, computed, finite, integer, record, work } from "./internal/geometry-b-utils.js";
class SkylinePackError extends Error { constructor(code) { super(code); this.name="SkylinePackError"; this.code=code; } }
const E=SkylinePackError;
export function skylinePack2D(input) {
  record(E,input,["width","height","rectangles","maxWork"]); const width=finite(E,at(E,input,"width")),height=finite(E,at(E,input,"height")),raw=array(E,at(E,input,"rectangles")),maxWork=integer(E,at(E,input,"maxWork"),0,Number.MAX_SAFE_INTEGER); if(!(width>0&&height>0))throw new E("INVALID_INPUT");
  const rectangles=raw.map(r=>{record(E,r,["width","height"]);const rw=finite(E,at(E,r,"width")),rh=finite(E,at(E,r,"height"));if(!(rw>0&&rh>0))throw new E("INVALID_INPUT");return [rw,rh];}),n=rectangles.length,preflight=8*n*n*n+n;work(E,preflight,maxWork);
  let skyline=[[0,width,0]];const placements=[],unplaced=[];
  for(let index=0;index<n;index+=1){const [rw,rh]=rectangles[index];let best=null;for(const [x] of skyline){const right=computed(E,x+rw);if(right>width)continue;let y=0;for(const [left,end,level] of skyline)if(left<right&&end>x&&level>y)y=level;const top=computed(E,y+rh);if(top>height)continue;if(!best||top<best.top||(top===best.top&&x<best.x))best={x,right,y,top};}
    if(!best){unplaced.push(index);continue;} const next=[];for(const [left,right,level] of skyline){if(right<=best.x||left>=best.right){next.push([left,right,level]);continue;}if(left<best.x)next.push([left,best.x,level]);if(right>best.right)next.push([best.right,right,level]);} next.push([best.x,best.right,best.top]);next.sort((a,b)=>a[0]-b[0]);skyline=[];for(const span of next){const prev=skyline[skyline.length-1];if(prev&&prev[1]===span[0]&&prev[2]===span[2])prev[1]=span[1];else skyline.push(span);}placements.push({index,x:best.x,y:best.y,width:rw,height:rh});
  } return {placements,unplaced};
}
