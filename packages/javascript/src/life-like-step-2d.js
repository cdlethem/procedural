import { array, charge, fail, get, integer, product, record, scalarArray, work } from "./internal/systems-a-utils.js";
const KEYS=["cells","columns","rows","birth","survival","boundary","maxWork"];
export function lifeLikeStep2D(input) {
  record(input,KEYS); const columns=integer(get(input,"columns"),1,4294967295),rows=integer(get(input,"rows"),1,4294967295), size=product(columns,rows), cells=scalarArray(get(input,"cells"),size), max=work(get(input,"maxWork")), boundary=get(input,"boundary");
  if(boundary!=="DEAD"&&boundary!=="WRAP") fail("INVALID_INPUT"); for(const c of cells) if(c!==0&&c!==1) fail("INVALID_INPUT");
  const rules=(key)=>{ const raw=get(input,key); array(raw); const out=[]; let previous=-1; for(let i=0;i<raw.length;i++){const n=integer(get(raw,String(i)),0,8);if(n<=previous)fail("INVALID_INPUT");previous=n;out.push(n);} return out;}; const birth=rules("birth"),survival=rules("survival"); charge(9*size,max);
  const out=new Array(size); for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(dx===0&&dy===0)continue;let xx=x+dx,yy=y+dy;if(boundary==="WRAP"){xx=(xx+columns)%columns;yy=(yy+rows)%rows;n+=cells[yy*columns+xx];}else if(xx>=0&&xx<columns&&yy>=0&&yy<rows)n+=cells[yy*columns+xx];}out[y*columns+x]=(cells[y*columns+x]?survival:birth).includes(n)?1:0;} return {cells:out};
}
