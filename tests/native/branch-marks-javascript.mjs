#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createBranchComposition } from "../../packages/javascript/examples/branch-marks/branch-marks.js";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../.."), args=process.argv.slice(2), output=resolve(args[args.indexOf("--output")+1]);
const source=join(ROOT,"packages/javascript/examples/branch-marks/branch-marks.js"), core=join(ROOT,"packages/javascript/src/branch-tree.js"), fixture=join(ROOT,"fixtures/operations/seeded-endpoint-branches.json"), catalog=join(ROOT,"catalog/operations/seeded-endpoint-branches.json"), javaHome=process.env.JAVA_HOME||join(ROOT,".work/toolchains/jdk-17.0.20.1+1");
const hash=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
if(!output.startsWith(join(ROOT,".work")+sep)||existsSync(output))throw new Error("output must be fresh under .work");
if(!existsSync(core))throw new Error("missing prospective branch-tree core");
const javaTree=join(ROOT,"packages/java/src/main/java/org/procedurals/topology/BranchTree2D.java"), javaCircle=join(ROOT,"packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java"), javaExample=join(ROOT,"packages/java/examples/BranchMarks/BranchComposition.java"), helper=join(ROOT,"tools/generate_branch_tree_fixtures.py"), contract=join(ROOT,"design/operations/branch-tree-contract-review.md"), design=join(ROOT,"design/port-batch-04.md");
const bound=[source,core,join(ROOT,"packages/javascript/src/circle-placements.js"),fixture,catalog,fileURLToPath(import.meta.url),helper,javaTree,javaCircle,javaExample,contract,design], before=Object.fromEntries(bound.map(file=>[file.slice(ROOT.length+1),hash(file)]));
const configs=[["baseline",42,false,false,false,false,false],["extended",42,true,false,false,false,false],["narrowing",42,false,true,false,false,false],["wider",42,false,false,false,true,false],["binary",42,false,false,true,false,false],["forest",42,false,false,false,false,true],["forestextended",42,true,false,false,false,true],["forestseed",43,false,false,false,false,true]];
function modelValues(comp){return Array.from({length:comp.size},(_,i)=>comp.treeAt(i).toValues());}
const js=configs.map(([,seed,more,narrow,binary,wider,forest])=>modelValues(createBranchComposition(seed,more,narrow,binary,wider,forest)));
const build=output+".build";if(existsSync(build))throw new Error("occupied build directory");mkdirSync(build,{recursive:true});const probe=join(build,"BranchModelProbe.java");writeFileSync(probe,`import org.procedurals.examples.branchmarks.BranchComposition;import org.procedurals.topology.BranchTree2D;public class BranchModelProbe{static void p(String s){System.out.print(s);}static void d(double v){p(Double.toString(v));}static void a(double[]x){p("[");for(int i=0;i<x.length;i++){if(i>0)p(",");d(x[i]);}p("]");}static void t(BranchTree2D x){p("{\\"segments\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");a(x.segmentAt(i));}p("],\\"headings\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");d(x.headingAt(i));}p("],\\"lengths\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");d(x.lengthAt(i));}p("],\\"parents\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.parentAt(i));}p("],\\"generations\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.generationAt(i));}p("],\\"childCounts\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.childCountAt(i));}p("]}");}public static void main(String[]z){int[][]c={{42,0,0,0,0,0},{42,1,0,0,0,0},{42,0,1,0,0,0},{42,0,0,0,1,0},{42,0,0,1,0,0},{42,0,0,0,0,1},{42,1,0,0,0,1},{43,0,0,0,0,1}};p("[");for(int k=0;k<c.length;k++){if(k>0)p(",");BranchComposition b=BranchComposition.create(c[k][0],c[k][1]>0,c[k][2]>0,c[k][3]>0,c[k][4]>0,c[k][5]>0);p("[");for(int i=0;i<b.size();i++){if(i>0)p(",");t(b.treeAt(i));}p("]");}p("]");}}`);
const javaSources=[join(ROOT,"packages/java/src/main/java/org/procedurals/topology/BranchTree2D.java"),join(ROOT,"packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java"),join(ROOT,"packages/java/examples/BranchMarks/BranchComposition.java"),probe];let run=spawnSync(join(javaHome,"bin/javac"),["--release","8","-d",build,...javaSources],{cwd:ROOT,encoding:"utf8",timeout:60000,maxBuffer:16*1024*1024});if(run.status!==0)throw new Error(run.stdout+run.stderr);run=spawnSync(join(javaHome,"bin/java"),["-cp",build,"BranchModelProbe"],{cwd:ROOT,encoding:"utf8",timeout:60000,maxBuffer:16*1024*1024});if(run.status!==0)throw new Error(run.stdout+run.stderr);const java=JSON.parse(run.stdout);
const py=spawnSync("python3",["-c","import json,sys;from tools.generate_branch_tree_fixtures import coordinate_comparison;print(json.dumps([[coordinate_comparison(tree) for tree in config] for config in json.load(sys.stdin)]))"],{cwd:ROOT,input:JSON.stringify(java),encoding:"utf8",timeout:60000,maxBuffer:16*1024*1024});if(py.status!==0)throw new Error(py.stdout+py.stderr);const tolerances=JSON.parse(py.stdout);const bits=v=>{const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,v);return d.getBigUint64(0).toString(16);};
function topology(tree) {
  const count=tree.segments.length, children=new Array(count).fill(0);
  for(const key of ["headings","lengths","parents","generations","childCounts"])assert.equal(tree[key].length,count);
  for(let i=0;i<count;i++) {
    assert.equal(tree.segments[i].length,4);
    if(i===0){assert.equal(tree.parents[i],-1);assert.equal(tree.generations[i],0);}
    else {const parent=tree.parents[i];assert.ok(Number.isInteger(parent)&&parent>=0&&parent<i);children[parent]++;
      assert.equal(tree.generations[i],tree.generations[parent]+1);
      assert.equal(bits(tree.segments[i][0]),bits(tree.segments[parent][2]));
      assert.equal(bits(tree.segments[i][1]),bits(tree.segments[parent][3]));}
  }
  assert.deepEqual(tree.childCounts,children);
}
function compare(a,b,t){
  topology(a);topology(b);assert.equal(a.segments.length,b.segments.length);
  for(const key of ["parents","generations","childCounts"])assert.deepEqual(a[key],b[key]);
  for(const key of ["headings","lengths"])assert.deepEqual(a[key].map(bits),b[key].map(bits));
  assert.ok(t.mode==="bounded-trig"||t.mode==="binary64-exact");
  for(let i=0;i<a.segments.length;i++)for(let j=0;j<4;j++){
    const allowance=t.mode==="bounded-trig"?t.segments_abs[i][j]:0;
    if(allowance===0)assert.equal(bits(a.segments[i][j]),bits(b.segments[i][j]));
    else assert.ok(Math.abs(a.segments[i][j]-b.segments[i][j])<=allowance,`segment ${i}/${j}`);
  }
}
assert.equal(js.length,java.length);assert.equal(java.length,configs.length);
for(let c=0;c<js.length;c++){assert.equal(js[c].length,java[c].length);assert.ok(js[c].length>0);for(let tree=0;tree<js[c].length;tree++)compare(js[c][tree],java[c][tree],tolerances[c][tree]);}
function prefix(shorter,longer){
  assert.equal(shorter.length,longer.length);let grew=false;
  for(let tree=0;tree<shorter.length;tree++){
    const a=shorter[tree],b=longer[tree];assert.ok(a.segments.length<=b.segments.length);grew ||= a.segments.length<b.segments.length;
    for(const key of ["segments","headings","lengths","parents","generations"]){
      const convert=v=>Array.isArray(v)?v.map(bits):bits(v);
      assert.deepEqual(a[key].map(convert),b[key].slice(0,a[key].length).map(convert));
    }
  }
  assert.ok(grew,"extension must grow at least one tree");
}
prefix(js[0],js[1]);prefix(js[5],js[6]);
const after=Object.fromEntries(bound.map(file=>[file.slice(ROOT.length+1),hash(file)]));assert.deepEqual(after,before);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({status:"passed",runtime:{node:process.version,java_home:javaHome},operation:"topology.seeded-endpoint-branches-2d",scope:"BranchMarks JavaScript model parity against actual Java BranchComposition; exact topology/attributes, fixture-derived per-case trig allowances, same-runtime prefixes; no renderer or support claim.",configurations:configs.map(x=>x[0]),java_tree_counts:java.map(x=>x.map(v=>v.segments.length)),coordinate_allowances:"tools/generate_branch_tree_fixtures.py coordinate_comparison",source_sha256_before:before,source_sha256_after:after},null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({status:"passed",output,configurations:configs.length}));
