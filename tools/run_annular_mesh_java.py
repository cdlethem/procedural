#!/usr/bin/env python3
"""Run reviewed annular shared vectors and focused Java ownership checks without rendering."""
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
if __package__ in {None, ''}: sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.check_annular_fixtures import validate
ROOT=Path(__file__).resolve().parents[1]; CATALOG=ROOT/'catalog/operations/annular-solid-3d.json'; FIXTURE=ROOT/'fixtures/operations/annular-solid-3d.json'; CORE=ROOT/'packages/java/src/main/java/org/procedurals/mesh/AnnularMesh3D.java'; NATIVE=ROOT/'tests/native/AnnularMeshNative.java'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def jvalue(v):
 if v is None: return 'null'
 if isinstance(v,bool): return 'Boolean.'+str(v).upper()
 if isinstance(v,(int,float)): return 'Double.valueOf('+json.dumps(str(v))+')'
 if isinstance(v,str): return json.dumps(v)
 if isinstance(v,dict): return 'map('+','.join(jvalue(x) for pair in v.items() for x in pair)+')'
 raise TypeError(v)
def source(fixture):
 methods=[]
 for n,c in enumerate(fixture['cases']):
  b=['Object input='+jvalue(c['input'])+';']
  if 'error' in c:
   b+=['try { AnnularMesh3D.generate(input); throw new AssertionError("missing error"); } catch(Throwable e) { equal('+jvalue(c['error'])+',e.getClass().getField("code").get(e),"error");']
   for k,v in c.get('error_detail',{}).items(): b+=['check(((Number)e.getClass().getField("'+k+'").get(e)).longValue()=='+str(v)+'L,"detail");'] if isinstance(v,int) else ['equal('+jvalue(v)+',e.getClass().getField("'+k+'").get(e),"detail");']
   b+=['}']
  else:
   o=c['output']; b+=['AnnularMesh3D m=AnnularMesh3D.generate(input);check(m.vertexCount()=='+str(len(o['positions']))+',"V");check(m.faceCount()=='+str(len(o['triangles']))+',"F");']
   for field,method in [('positions','vertexAt'),('normals','normalAt')]:
    for i,row in enumerate(o[field]):
     b+=['double[] q'+field+str(i)+'=m.'+method+'('+str(i)+'L);']
     for j,val in enumerate(row): b+=['within(q'+field+str(i)+'['+str(j)+'],"'+val['bits_hex']+'",'+repr(c['comparison'][field+'_abs'][i][j])+',"'+field+'");']
   for i,t in enumerate(o['triangles']): b+=['check(Arrays.equals(m.triangleAt('+str(i)+'L),new int[]{'+','.join(map(str,t))+'}),"tri");']
   for i,k in enumerate(o['faceKinds']): b+=['equal('+jvalue(k)+',m.faceKindAt('+str(i)+'L),"kind");check(m.cellAt('+str(i)+'L)=='+str(o['cells'][i])+',"cell");']
  methods.append('static void c'+str(n)+'() throws Exception {'+' '.join(b)+'}')
 return '''package org.procedurals.mesh; import java.util.*; public final class AnnularMeshVectors { static int assertions; static void check(boolean x,String s){assertions++;if(!x)throw new AssertionError(s);} static void equal(Object a,Object b,String s){check(a.equals(b),s);} static void within(double a,String h,double t,String s){double e=Double.longBitsToDouble(Long.parseUnsignedLong(h,16));check(Double.isFinite(a),s);if(a==0)check(Double.doubleToRawLongBits(a)==0,s);if(t==0)check(Double.doubleToRawLongBits(a)==Double.doubleToRawLongBits(e),s);else check(Math.abs(a-e)<=t,s);} static Map<String,Object> map(Object... v){Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;} '''+' '.join(methods)+' public static void main(String[] x) throws Exception {'+''.join('c'+str(i)+'();' for i in range(len(methods)))+'System.out.println("{\\"status\\":\\"passed\\",\\"cases\\":'+str(len(methods))+',\\"assertions\\":"+assertions+"}");}}'
def run(args, allow_stderr=False):
 r=subprocess.run([str(x) for x in args],cwd=ROOT,text=True,capture_output=True,timeout=120)
 if r.returncode or (r.stderr and not allow_stderr): raise RuntimeError(r.stdout+'\n'+r.stderr)
 return r
def main():
 p=argparse.ArgumentParser();p.add_argument('--java-home',type=Path,default=ROOT/'.work/toolchains/jdk-17.0.20.1+1');p.add_argument('--output',type=Path,default=ROOT/'.work/annular-study/java-conformance.json');a=p.parse_args()
 op=json.loads(CATALOG.read_text()); fixture=json.loads(FIXTURE.read_text()); errors=validate(ROOT,'annular',op,fixture)
 if errors: raise RuntimeError('\n'.join(errors))
 bound=[CATALOG,FIXTURE,CORE,NATIVE,Path(__file__),ROOT/'tools/check_annular_fixtures.py',a.java_home/'bin/java',a.java_home/'bin/javac',a.java_home/'lib/modules']; before={str(x.relative_to(ROOT)):sha(x) for x in bound}; build=ROOT/'.work/annular-study/java';build.mkdir(parents=True,exist_ok=True); vectors=build/'AnnularMeshVectors.java';vectors.write_text(source(fixture));compile_command=[a.java_home/'bin/javac','--release','8','-d',build,CORE,NATIVE,vectors];compile_result=run(compile_command,True); results={}
 for name in ('AnnularMeshVectors','AnnularMeshNative'):
  command=[a.java_home/'bin/java','-cp',build,'org.procedurals.mesh.'+name];r=run(command);results[name]={'command':[str(x) for x in command],'stdout':r.stdout,'value':json.loads(r.stdout)};assert results[name]['value']['status']=='passed'
 after={str(x.relative_to(ROOT)):sha(x) for x in bound}
 if before!=after: raise RuntimeError('bound input changed during run')
 artifacts={str(path.relative_to(ROOT)):sha(path) for path in sorted(build.glob('*.class'))};report={'operation':op['id'],'status':'passed','scope':'Java core vectors and native access/workload checks only; no renderer or target-support claim.','source_sha256_before':before,'source_sha256_after':after,'compile':{'command':[str(x) for x in compile_command],'stderr':compile_result.stderr},'generated_vectors_sha256':sha(vectors),'class_sha256':artifacts,'results':results};a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'status':'passed','cases':len(fixture['cases']),'report':str(a.output)}))
if __name__=='__main__': main()
