export class SystemsAError extends Error { constructor(code) { super(code); this.name = "SystemsAError"; this.code = code; } }
export const fail = (code) => { throw new SystemsAError(code); };
export function finite(value) { return typeof value === "number" && Number.isFinite(value); }
export function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
export function computed(value) { if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
export function record(value, keys) { if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT"); const proto = Object.getPrototypeOf(value); if (proto !== Object.prototype && proto !== null || Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT"); for (const key of keys) if (!Object.getOwnPropertyDescriptor(value, key) || !("value" in Object.getOwnPropertyDescriptor(value, key))) fail("INVALID_INPUT"); }
export function get(value, key) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !("value" in d)) fail("INVALID_INPUT"); return d.value; }
export function array(value, length) { if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) fail("INVALID_INPUT"); for (let i=0;i<value.length;i++) get(value,String(i)); }
export function integer(value, lo, hi) { const n=number(value); if (!Number.isSafeInteger(n)||n<lo||n>hi) fail("INVALID_INPUT"); return n; }
export function work(value) { return integer(value,0,Number.MAX_SAFE_INTEGER); }
export function product(a,b, code="INVALID_INPUT") { const n=a*b; if(!Number.isSafeInteger(n)||n>4294967295) fail(code); return n; }
export function charge(value, max) { if (!Number.isSafeInteger(value) || value > max) fail("WORK_LIMIT"); }
export function scalarArray(value, length) { array(value,length); const out=new Array(value.length); for(let i=0;i<out.length;i++) out[i]=number(get(value,String(i))); return out; }
export function pair(value, positive=false) { array(value,2); const out=[number(get(value,"0")),number(get(value,"1"))]; if(positive && (out[0]<=0||out[1]<=0)) fail("INVALID_INPUT"); return out; }
