#!/usr/bin/env python3
"""Run CP13 Java object/typed fixtures, native checks, and bounded typed timings."""
from __future__ import annotations
import argparse, hashlib, json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CORE=ROOT/'packages/java/src/main/java/org/procedurals/raster/RasterRemap2D.java'
NATIVE=ROOT/'tests/native/RasterRemapNative.java'
CAT=ROOT/'catalog/operations/bilinear-raster-remap.json'
FIX=ROOT/'fixtures/operations/bilinear-raster-remap.json'
def digest(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def carrier(v):
 if isinstance(v,bool):return 'Boolean.'+str(v).upper()
 if isinstance(v,(int,float)):return 'Double.valueOf('+json.dumps(str(v))+')'
 if isinstance(v,list):return 'list('+','.join(carrier(x) for x in v)+')'
 if isinstance(v,dict):return 'map('+','.join(carrier(x) for pair in v.items() for x in pair)+')'
 return json.dumps(v)
def typed(case):
 data=case['input'];src=data['source'];pixels=','.join('(int)'+str(v)+'L' for v in src['pixels']);xy=','.join(str(v) for pair in data['sourceCoordinates'] for v in pair)
 return 'RasterRemap2D.remap(%s,%s,new int[]{%s},%s,%s,new double[]{%s})'%(src['width'],src['height'],pixels,data['outputWidth'],data['outputHeight'],xy)
def vector_source(fixture):
 bodies=[];calls=[]
 for i,case in enumerate(fixture['cases']):
  invoke='RasterRemap2D.remap('+carrier(case['input'])+')'
  if 'output' in case: body='exact(%s,%s.toValues(),%s);exact(%s,%s.toValues(),%s);'%(carrier(case['output']),invoke,json.dumps(case['id']+' object'),carrier(case['output']),typed(case),json.dumps(case['id']+' typed'))
  else: body='try{%s;throw new AssertionError(%s);}catch(RasterRemap2D.RasterRemapException e){ok(%s.equals(e.code),%s);}'%(invoke,json.dumps(case['id']),json.dumps(case['error']),json.dumps(case['id']))
  bodies.append('static void c%d(){%s}'%(i,body));calls.append('c%d();'%i)
 return '''package org.procedurals.raster;import java.util.*;public class V{static int n;static void ok(boolean x,String m){n++;if(!x)throw new AssertionError(m);}static List<Object>list(Object...x){return new ArrayList<Object>(Arrays.asList(x));}static Map<String,Object>map(Object...x){Map<String,Object>m=new LinkedHashMap<>();for(int i=0;i<x.length;i+=2)m.put((String)x[i],x[i+1]);return m;}static void exact(Object e,Object a,String m){if(e instanceof Number){ok(a instanceof Number&&Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){List<?>x=(List<?>)e,y=(List<?>)a;ok(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;ok(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}ok(e.equals(a),m);}'''+''.join(bodies)+'public static void main(String[]x){'+''.join(calls)+'System.out.println("{\\"status\\":\\"passed\\",\\"cases\\":'+str(len(fixture['cases']))+',\\"assertions\\":"+n+"}");}}'
def execute(cmd,timeout=180):return subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,check=True,timeout=timeout)
def main():
 p=argparse.ArgumentParser();p.add_argument('--java-home',type=Path,default=ROOT/'.work/toolchains/jdk-17.0.20.1+1');p.add_argument('--output',type=Path,default=ROOT/'.work/conformance/bilinear-raster-remap-java-final.json');a=p.parse_args();fixture=json.loads(FIX.read_text())
 if fixture.get('catalog_sha256')!=digest(CAT):raise RuntimeError('fixture/catalog binding mismatch')
 java=a.java_home/'bin/java';javac=a.java_home/'bin/javac';modules=a.java_home/'lib/modules';release=a.java_home/'release'
 for item in (java,javac,modules,release):
  if not item.exists():raise RuntimeError('missing JDK runtime input: '+str(item))
 bound=[CAT,FIX,CORE,NATIVE,Path(__file__),java,javac,modules,release];before={str(x.relative_to(ROOT)):digest(x) for x in bound};(ROOT/'.work/build').mkdir(parents=True,exist_ok=True);build=Path(tempfile.mkdtemp(prefix='raster-remap-',dir=ROOT/'.work/build'));vectors=build/'V.java';vectors.write_text(vector_source(fixture))
 try:
  execute([str(javac),'--release','8','-d',str(build),str(CORE),str(NATIVE),str(vectors)]);vector_result=json.loads(execute([str(java),'-cp',str(build),'org.procedurals.raster.V']).stdout);native=json.loads(execute([str(java),'-cp',str(build),'org.procedurals.raster.RasterRemapNative']).stdout)
 except (subprocess.CalledProcessError,subprocess.TimeoutExpired) as error:raise RuntimeError('CP13 Java check failed: '+str(error)) from error
 bench=build/'B.java';bench.write_text('package org.procedurals.raster;public class B{public static void main(String[]a){int[]E={8,640,1024},R={200,4,2};for(int k=0;k<3;k++){int e=E[k],n=e*e;int[]p=new int[n];double[]q=new double[n*2];for(int i=0;i<n;i++){p[i]=0xff000000|((i*1103515245)&0xffffff);q[2*i]=i%e+.25;q[2*i+1]=i/e+.5;}for(int w=0;w<2;w++)RasterRemap2D.remap(e,e,p,e,e,q);long t=System.nanoTime(),sum=0;for(int r=0;r<R[k];r++){int[]o=RasterRemap2D.remap(e,e,p,e,e,q).pixels();for(int z:o)sum=sum*31+(z&0xffffffffL);}System.out.println(e+","+R[k]+","+(System.nanoTime()-t)+","+Long.toUnsignedString(sum));}}}');execute([str(javac),'--release','8','-cp',str(build),'-d',str(build),str(bench)]);timings=[]
 for line in execute([str(java),'-cp',str(build),'org.procedurals.raster.B']).stdout.splitlines():
  edge,reps,elapsed,checksum=line.split(',');n=int(edge)**2;timings.append({'edge':int(edge),'repetitions':int(reps),'warmups':2,'elapsed_ns_remap_plus_export_checksum':int(elapsed),'checksum_unsigned64':checksum,'static_buffer_bytes_estimate':{'source':n*4,'coordinates':n*16,'output':n*4,'export_clone':n*4}})
 after={str(x.relative_to(ROOT)):digest(x) for x in bound}
 if before!=after:raise RuntimeError('bound input changed during check')
 runtime=execute([str(java),'-version']).stderr.strip()
 report={'status':'passed','operation':'raster.bilinear-remap-2d','fixture_cases':len(fixture['cases']),'valid_cases_both_entrypoints':sum('output' in case for case in fixture['cases']),'vectors':vector_result,'native':native,'source_sha256_before':before,'source_sha256_after':after,'runtime':runtime,'javac_release':'8','benchmark_timing_scope':'typed remap plus pixels export/checksum; static bytes are estimates, not allocation measurement','benchmarks':timings,'scope':'Java core exact vectors/native evidence only; no renderer or support claim.'}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'passed','report':str(a.output)}))
if __name__=='__main__':main()
