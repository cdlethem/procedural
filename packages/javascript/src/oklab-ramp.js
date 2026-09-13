import { passiveRecord, passiveArray, valueAt, number, workLimit, checkedProduct, checkedWork } from "./internal/raster-study-utils.js";

const KEYS = ["stops", "count", "maxWork"];
class OklabRampError extends Error { constructor(code) { super(code); this.name = "OklabRampError"; this.code = code; } }
const checked = (E, value) => { if (!Number.isFinite(value)) throw new E("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; };
const row = (E, a, x, b, y, c, z) => {
  const ax=checked(E,a*x),by=checked(E,b*y),cz=checked(E,c*z);
  return checked(E,checked(E,ax+by)+cz);
};
const cube = (E, x) => checked(E,checked(E,x*x)*x);
const decode = (E, c) => checked(E, c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const encode = (E, c) => checked(E, c <= .0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - .055);
function oklab(E, rgb) {
  const r = decode(E, rgb[0]), g = decode(E, rgb[1]), b = decode(E, rgb[2]);
  const l = checked(E,Math.cbrt(row(E,.4122214708,r,.5363325363,g,.0514459929,b))), m = checked(E,Math.cbrt(row(E,.2119034982,r,.6806995451,g,.1073969566,b))), s = checked(E,Math.cbrt(row(E,.0883024619,r,.2817188376,g,.6299787005,b)));
  return [row(E,.2104542553,l,.7936177850,m,-.0040720468,s),row(E,1.9779984951,l,-2.4285922050,m,.4505937099,s),row(E,.0259040371,l,.7827717662,m,-.8086757660,s)];
}
function rgb(E, lab) {
  const l = row(E,1,lab[0],.3963377774,lab[1],.2158037573,lab[2]), m = row(E,1,lab[0],-.1055613458,lab[1],-.0638541728,lab[2]), s = row(E,1,lab[0],-.0894841775,lab[1],-1.2914855480,lab[2]);
  const ll=cube(E,l),mm=cube(E,m),ss=cube(E,s);
  const linear=[row(E,4.0767416621,ll,-3.3077115913,mm,.2309699292,ss),row(E,-1.2684380046,ll,2.6097574011,mm,-.3413193965,ss),row(E,-.0041960863,ll,-.7034186147,mm,1.7076147010,ss)];
  return linear.map(c=>encode(E,Math.max(0,Math.min(1,c))));
}

/** Build an encoded-sRGB ramp by interpolating Oklab stops. */
export function oklabRamp(input) {
  const E=OklabRampError;passiveRecord(input,KEYS,E);const raw=passiveArray(valueAt(input,"stops",E),E),count=number(valueAt(input,"count",E),E),maxWork=workLimit(valueAt(input,"maxWork",E),E);
  if(!Number.isSafeInteger(count)||count<2||count>4294967295||raw.length<2)throw new E("INVALID_INPUT");const stops=new Array(raw.length);for(let i=0;i<raw.length;i+=1){const triplet=passiveArray(Object.getOwnPropertyDescriptor(raw,String(i)).value,E,3),copy=new Array(3);for(let j=0;j<3;j+=1){const n=number(Object.getOwnPropertyDescriptor(triplet,String(j)).value,E);if(n<0||n>1)throw new E("INVALID_INPUT");copy[j]=n;}stops[i]=copy;}
  const work=raw.length+count;if(!Number.isSafeInteger(work))throw new E("WORK_LIMIT");checkedWork(work,maxWork,E);const labs=stops.map(stop=>oklab(E,stop)),colors=new Array(count),spanCount=stops.length-1;
  for(let k=0;k<count;k+=1){if(k===0){colors[k]=stops[0].slice();continue;}if(k===count-1){colors[k]=stops[spanCount].slice();continue;}const u=k/(count-1),span=Math.min(Math.floor(u*spanCount),spanCount-1),t=u*spanCount-span,a=labs[span],b=labs[span+1];const lerp=i=>checked(E,a[i]+checked(E,t*checked(E,b[i]-a[i])));colors[k]=rgb(E,[lerp(0),lerp(1),lerp(2)]);}
  return {colors};
}
