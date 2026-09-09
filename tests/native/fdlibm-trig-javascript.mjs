#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { fdlibmSin, fdlibmCos, fdlibmAtan, fdlibmAtan2 } from "../../packages/javascript/src/fdlibm-trig.js";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args=process.argv.slice(2);
assert.equal(args[0],"--output");
assert.ok(args.length===2 || (args.length===4 && args[2]==="--java-home"));
const output=resolve(args[1]);
assert.ok(output.startsWith(join(ROOT,".work")+sep) && !existsSync(output));
const jdk=resolve(args[3] || join(ROOT,".work/toolchains/jdk-17.0.20.1+1"));
const classes=output+".classes";assert.ok(!existsSync(classes));
mkdirSync(classes,{recursive:true});
const files=["packages/javascript/src/fdlibm-trig.js","tests/native/fdlibm-trig-javascript.mjs","tests/native/TrigOracle.java"].map(p=>join(ROOT,p));
files.push(...["bin/java","bin/javac","release","lib/modules"].map(p=>join(jdk,p)));
const digest=p=>createHash("sha256").update(readFileSync(p)).digest("hex");
const hashes=()=>Object.fromEntries(files.map(p=>[relative(ROOT,p),digest(p)]));
const before=hashes();
function run(exe,args,input){const r=spawnSync(exe,args,{input,encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;}
const view=new DataView(new ArrayBuffer(8));
const bits=x=>{view.setFloat64(0,x);return view.getBigUint64(0).toString(16).padStart(16,"0");};
const value=x=>{view.setBigUint64(0,BigInt("0x"+x));return view.getFloat64(0);};
const BOUNDARIES = [0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Math.PI/4,Math.PI/2,Math.PI,1e20,Number.MAX_VALUE].flatMap(x=>[0,-0,1,-1,Number.MIN_VALUE,Number.MAX_VALUE].map(y=>[bits(x),bits(y)]));
let state=0x9e3779b97f4a7c15n;
function word(){state=BigInt.asUintN(64,state^(state<<13n));state^=state>>7n;state=BigInt.asUintN(64,state^(state<<17n));return state;}
function finiteBits(exponent){const w=word();return ((w&0x800fffffffffffffn)|(BigInt(exponent)<<52n)).toString(16).padStart(16,"0");}
const pairs=BOUNDARIES.map(([x,y])=>[x,y]);
for(let i=0;i<512;i++)pairs.push([finiteBits(Number(word()%2047n)),finiteBits(Number(word()%2047n))]);
for(let i=0;i<512;i++){const e=Number(word()%2047n);pairs.push([finiteBits(e),finiteBits(e)]);}
run(join(jdk,"bin/javac"),["--release","8","-d",classes,join(ROOT,"tests/native/TrigOracle.java")]);
const expected=run(join(jdk,"bin/java"),["-cp",classes,"TrigOracle"],pairs.map(p=>p.join(" ")).join("\n")+"\n").trim().split(/\r?\n/);
assert.equal(expected.length,pairs.length);
for(let i=0;i<pairs.length;i++){const [x,y]=pairs[i].map(value);const actual=[fdlibmSin(x),fdlibmCos(x),fdlibmAtan(x),fdlibmAtan2(x,y)].map(bits).join(" ");assert.equal(actual,expected[i],`pair ${i}: ${pairs[i]}`);}
const after=hashes();assert.deepEqual(after,before);
writeFileSync(output,JSON.stringify({status:"passed",scope:"Fresh Java StrictMath sin/cos/atan/atan2 runtime oracle, exact binary64 comparisons for finite inputs; no implementation-source copy.",input_sha256_before:before,input_sha256_after:after,scenarios:{finite_scaling_boundaries:BOUNDARIES.length,deterministic_full_range:512,same_exponent:512,total:pairs.length},java_release:readFileSync(join(jdk,"release"),"utf8"),oracle_input_sha256:createHash("sha256").update(JSON.stringify(pairs)).digest("hex")},null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({status:"passed",pairs:pairs.length,output}));
