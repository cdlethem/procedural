import { passiveRecord, passiveArray, valueAt, number, positiveDimension, workLimit, checkedProduct, checkedWork } from "./internal/raster-study-utils.js";
const KEYS = ["values", "columns", "rows", "order", "maxWork"];
export class BayerDitherError extends Error { constructor(code) { super(code); this.name = "BayerDitherError"; this.code = code; } }
export function bayerDither(input) {
  const E = BayerDitherError; passiveRecord(input, KEYS, E);
  const columns = positiveDimension(valueAt(input,"columns",E),E), rows = positiveDimension(valueAt(input,"rows",E),E), order = number(valueAt(input,"order",E),E), maxWork = workLimit(valueAt(input,"maxWork",E),E);
  if (!Number.isSafeInteger(order) || order < 1 || order > 26) throw new E("INVALID_INPUT");
  const raw = passiveArray(valueAt(input,"values",E),E), cells = checkedProduct([columns,rows],E,"INVALID_INPUT"); if(raw.length !== cells) throw new E("INVALID_INPUT");
  const values = new Array(cells); for(let i=0;i<cells;i+=1){const n=number(Object.getOwnPropertyDescriptor(raw,String(i)).value,E);if(n<0||n>1)throw new E("INVALID_INPUT");values[i]=n;}
  const screen = 2 ** order, screenCells = checkedProduct([screen,screen],E); const work = checkedProduct([cells,order],E); checkedWork(work,maxWork,E);
  const bits = new Array(cells); const q = [0,2,3,1];
  for(let y=0;y<rows;y+=1) for(let x=0;x<columns;x+=1){let b=0; const xx=x%screen, yy=y%screen; for(let j=0;j<order;j+=1) b += (4 ** (order-1-j))*q[((yy>>j)&1)*2+((xx>>j)&1)]; bits[y*columns+x]=values[y*columns+x] >= (b+.5)/screenCells ? 1:0;}
  return { bits };
}
