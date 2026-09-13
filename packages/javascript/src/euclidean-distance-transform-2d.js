import { passiveRecord, passiveArray, valueAt, positiveDimension, workLimit, checkedProduct, checkedWork } from "./internal/raster-study-utils.js";
const KEYS=["mask","columns","rows","maxWork"];
export class EuclideanDistanceTransform2DError extends Error { constructor(code) { super(code); this.name="EuclideanDistanceTransform2DError"; this.code=code; } }
function floorDiv(n,d) { let q=n/d; if(n<0n&&n%d!==0n)q-=1n; return q; }
export function euclideanDistanceTransform2D(input) {
 const E=EuclideanDistanceTransform2DError; passiveRecord(input,KEYS,E);const columns=positiveDimension(valueAt(input,"columns",E),E),rows=positiveDimension(valueAt(input,"rows",E),E),maxWork=workLimit(valueAt(input,"maxWork",E),E),cells=checkedProduct([columns,rows],E,"INVALID_INPUT"),raw=passiveArray(valueAt(input,"mask",E),E);if(raw.length!==cells)throw new E("INVALID_INPUT"); const mask=new Array(cells);let any=false;for(let i=0;i<cells;i+=1){const v=Object.getOwnPropertyDescriptor(raw,String(i)).value;if(typeof v!=="boolean")throw new E("INVALID_INPUT");mask[i]=v;any ||=v;}checkedWork(checkedProduct([6,cells],E),maxWork,E);if(!any)return {distances:new Array(cells).fill(null),nearestIndices:new Array(cells).fill(null)};
 const rowDistance=new Array(cells),rowFeature=new Array(cells);
 for(let y=0;y<rows;y+=1){const base=y*columns;let last=-1;for(let x=0;x<columns;x+=1){if(mask[base+x])last=x;if(last<0){rowDistance[base+x]=null;rowFeature[base+x]=null;}else{const dx=BigInt(x-last);rowDistance[base+x]=dx*dx;rowFeature[base+x]=base+last;}}last=-1;for(let x=columns-1;x>=0;x-=1){if(mask[base+x])last=x;if(last>=0){const dx=BigInt(x-last),d=dx*dx,i=base+x;if(rowDistance[i]===null||d<rowDistance[i]){rowDistance[i]=d;rowFeature[i]=base+last;}}}
 }
 const distances=new Array(cells),nearestIndices=new Array(cells);
 for(let x=0;x<columns;x+=1){const candidates=[],starts=[];for(let q=0;q<rows;q+=1){const fi=rowDistance[q*columns+x];if(fi===null)continue;let start=0n;while(candidates.length){const v=candidates[candidates.length-1],fv=rowDistance[v*columns+x],bq=BigInt(q),bv=BigInt(v),num=(fi+bq*bq)-(fv+bv*bv),den=2n*(bq-bv);start=floorDiv(num,den)+1n;if(start<=starts[starts.length-1]){candidates.pop();starts.pop();}else break;}if(!candidates.length)start=0n;if(start<BigInt(rows)){candidates.push(q);starts.push(start);}}
 let ci=0;for(let y=0;y<rows;y+=1){while(ci+1<candidates.length&&BigInt(y)>=starts[ci+1])ci+=1;const q=candidates[ci],dx2=rowDistance[q*columns+x],dy=BigInt(y-q),square=dx2+dy*dy;const index=y*columns+x,n=Number(square);if(!Number.isFinite(n))throw new E("NUMERIC_OVERFLOW");const d=Math.sqrt(n);if(!Number.isFinite(d))throw new E("NUMERIC_OVERFLOW");distances[index]=d===0?0:d;nearestIndices[index]=rowFeature[q*columns+x];}}
 return {distances,nearestIndices};
}
