#!/usr/bin/env python3
"""Compare eight Python BranchMarks compositions to actual Java output."""
import argparse, json, subprocess, sys, struct, platform
from hashlib import sha256
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; MODEL=ROOT/"packages/python/examples/branch_marks/branch_composition.py"; CORE=ROOT/"packages/python/procedurals/branch_tree.py"; PLACE=ROOT/"packages/python/procedurals/placements.py"; JAVA_MODEL=ROOT/"packages/java/examples/BranchMarks/BranchComposition.java"; JAVA_TREE=ROOT/"packages/java/src/main/java/org/procedurals/topology/BranchTree2D.java"; JAVA_CIRCLE=ROOT/"packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java"; HELPER=ROOT/"tools/generate_branch_tree_fixtures.py"; sys.path[:0]=[str(ROOT/"packages/python/examples/branch_marks"),str(ROOT/"packages/python")]
from branch_composition import create_branch_composition  # noqa
CASES=(("baseline",42,False,False,False,False,False),("extended",42,True,False,False,False,False),("narrowing",42,False,True,False,False,False),("wider",42,False,False,False,True,False),("binary",42,False,False,True,False,False),("forest",42,False,False,False,False,True),("forestextended",42,True,False,False,False,True),("forestseed",43,False,False,False,False,True))
PROBE='''import org.procedurals.examples.branchmarks.BranchComposition;import org.procedurals.topology.BranchTree2D;public class P{static void p(String x){System.out.print(x);}static void d(double x){p(Double.toString(x));}static void t(BranchTree2D x){p("{\\"segments\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");double[]a=x.segmentAt(i);p("[");for(int j=0;j<4;j++){if(j>0)p(",");d(a[j]);}p("]");}p("],\\"headings\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");d(x.headingAt(i));}p("],\\"lengths\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");d(x.lengthAt(i));}p("],\\"parents\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.parentAt(i));}p("],\\"generations\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.generationAt(i));}p("],\\"childCounts\\":[");for(int i=0;i<x.size();i++){if(i>0)p(",");p(""+x.childCountAt(i));}p("]}");}public static void main(String[]z){int[][]c={{42,0,0,0,0,0},{42,1,0,0,0,0},{42,0,1,0,0,0},{42,0,0,0,1,0},{42,0,0,1,0,0},{42,0,0,0,0,1},{42,1,0,0,0,1},{43,0,0,0,0,1}};p("[");for(int k=0;k<c.length;k++){if(k>0)p(",");BranchComposition b=BranchComposition.create(c[k][0],c[k][1]>0,c[k][2]>0,c[k][3]>0,c[k][4]>0,c[k][5]>0);p("[");for(int i=0;i<b.size();i++){if(i>0)p(",");t(b.treeAt(i));}p("]");}p("]");}}'''
def h(p):return sha256(p.read_bytes()).hexdigest()
def bits(x):return struct.pack(">d",x).hex()
def values(c):return [c.tree_at(i).to_values() for i in range(c.size)]
def check(a,b,t):
 assert len(a["segments"])==len(b["segments"])
 for k in ("parents","generations","childCounts"):assert a[k]==b[k]
 for k in ("headings","lengths"):assert [bits(x) for x in a[k]]==[bits(x) for x in b[k]]
 for i,row in enumerate(a["segments"]):
  assert len(row)==4
  for j,x in enumerate(row):
   allowance=t["segments_abs"][i][j] if t["mode"]=="bounded-trig" else 0
   assert abs(x-b["segments"][i][j])<=allowance
 children=[0]*len(a["segments"])
 for i in range(1,len(children)):
  p=a["parents"][i];children[p]+=1;assert bits(a["segments"][i][0])==bits(a["segments"][p][2]);assert bits(a["segments"][i][1])==bits(a["segments"][p][3])
 assert children==a["childCounts"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--java-home",type=Path,required=True);ap.add_argument("--output",type=Path,required=True);a=ap.parse_args();java_home=a.java_home.resolve();out=a.output.resolve();assert out.is_relative_to((ROOT/".work").resolve()) and not out.exists(); files=(Path(__file__).resolve(),MODEL,CORE,PLACE,JAVA_MODEL,JAVA_TREE,JAVA_CIRCLE,HELPER,java_home/"release",java_home/"lib/modules",java_home/"bin/java",java_home/"bin/javac");before={str(x.relative_to(ROOT)):h(x) for x in files};out.mkdir(parents=True);probe=out/"P.java";probe.write_text(PROBE);subprocess.run([java_home/"bin/javac","--release","8","-d",out,JAVA_MODEL,JAVA_TREE,JAVA_CIRCLE,probe],check=True,capture_output=True,text=True,timeout=60);java=json.loads(subprocess.run([java_home/"bin/java","-cp",out,"P"],check=True,capture_output=True,text=True,timeout=60).stdout);py=[values(create_branch_composition(*c[1:])) for c in CASES];tolerances=json.loads(subprocess.run([sys.executable,"-c","import json,sys;from tools.generate_branch_tree_fixtures import coordinate_comparison;print(json.dumps([[coordinate_comparison(t) for t in c] for c in json.load(sys.stdin)]))"],input=json.dumps(java),text=True,capture_output=True,check=True,cwd=ROOT,timeout=60).stdout)
 for ci in range(8):
  assert len(py[ci])==len(java[ci])
  for ti in range(len(py[ci])):check(py[ci][ti],java[ci][ti],tolerances[ci][ti])
 for short,long in ((0,1),(5,6)):
  assert len(py[short])==len(py[long])
  assert sum(len(t["segments"]) for t in py[long])>sum(len(t["segments"]) for t in py[short])
  for a_,b_ in zip(py[short],py[long]):
   for k in ("segments","headings","lengths","parents","generations"):assert a_[k]==b_[k][:len(a_[k])]
 after={str(x.relative_to(ROOT)):h(x) for x in files};assert before==after; (out/"result.json").write_text(json.dumps({"status":"passed","runtime":{"python":sys.version,"implementation":platform.python_implementation()},"configurations":[x[0] for x in CASES],"java_tree_counts":[[len(t["segments"]) for t in c] for c in java],"coordinate_allowances":"tools/generate_branch_tree_fixtures.py coordinate_comparison","input_sha256_before":before,"input_sha256_after":after},indent=2)+"\n");print(json.dumps({"status":"passed","output":str(out.relative_to(ROOT)),"configurations":8}))
if __name__=="__main__":main()
