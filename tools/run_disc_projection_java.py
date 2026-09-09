#!/usr/bin/env python3
import argparse,json,subprocess,hashlib,tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1];C=R/'packages/java/src/main/java/org/procedurals/geometry/DiscProjection2D.java';N=R/'tests/native/DiscProjectionNative.java';F=R/'fixtures/operations/sequential-disc-projection-2d.json';K=R/'catalog/operations/sequential-disc-projection-2d.json';J=R/'.work/toolchains/jdk-17.0.20.1+1';O=R/'.work/conformance/disc-projection-java.json'
parser=argparse.ArgumentParser(description='Run shared projection vectors and native ownership/error checks.');parser.add_argument('--output',type=Path,default=O);O=parser.parse_args().output

def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cv(v):
 if isinstance(v,list):return 'l('+','.join(cv(x) for x in v)+')'
 if isinstance(v,dict):return 'm('+','.join(json.dumps(k)+','+cv(x) for k,x in v.items())+')'
 if isinstance(v,float):return repr(v)+'d'
 return str(v)+'d'
fx=json.loads(F.read_text());assert fx['catalog_sha256']==h(K)
body=[]
for i,c in enumerate(fx['cases']):
 call='DiscProjection2D.project('+cv(c['input'])+')'
 if 'error' in c: body.append('try{%s;throw new AssertionError("%s");}catch(DiscProjection2D.DiscProjectionException e){ok("%s".equals(e.code));}'%(call,c['id'],c['error']))
 else:
  p=c['input']; pts=','.join(str(x)+'d' for q in p['points'] for x in q); ds=','.join(str(x)+'d' for q in p['discs'] for x in q); exp=','.join(str(x)+'d' for q in c['output']['points'] for x in q); typed='DiscProjection2D.project(new double[]{%s},new double[]{%s},%sd,%sL)'%(pts,ds,p['strength'],p['maxTests']);body.append('eq(new double[]{%s},%s.points());eq(new double[]{%s},%s.points());'%(exp,call,exp,typed))
src='''package org.procedurals.geometry;import java.util.*;public class V{static int n;static void ok(boolean x){n++;if(!x)throw new AssertionError();}static void eq(double[]a,double[]b){ok(a.length==b.length);for(int i=0;i<a.length;i++)ok(Double.doubleToRawLongBits(a[i])==Double.doubleToRawLongBits(b[i]));}static List<Object>l(Object...x){return new ArrayList<Object>(Arrays.asList(x));}static Map<String,Object>m(Object...x){Map<String,Object>r=new LinkedHashMap<String,Object>();for(int i=0;i<x.length;i+=2)r.put((String)x[i],x[i+1]);return r;}public static void main(String[]x){%s System.out.println("{\\"status\\":\\"passed\\",\\"cases\\":%d,\\"assertions\\":"+n+"}");}}'''%(''.join(body),len(fx['cases']))
b=Path(tempfile.mkdtemp(dir=R/'.work/build'));v=b/'V.java';v.write_text(src);before={str(x.relative_to(R)):h(x) for x in(C,N,F,K,Path(__file__),J/'bin/java',J/'bin/javac',J/'release',J/'lib/modules')};subprocess.run([J/'bin/javac','--release','8','-d',b,C,N,v],check=True,timeout=120);vectors=json.loads(subprocess.run([J/'bin/java','-cp',b,'org.procedurals.geometry.V'],capture_output=True,text=True,check=True,timeout=120).stdout);native=json.loads(subprocess.run([J/'bin/java','-cp',b,'org.procedurals.geometry.DiscProjectionNative'],capture_output=True,text=True,check=True,timeout=120).stdout);after={str(x.relative_to(R)):h(x) for x in(C,N,F,K,Path(__file__),J/'bin/java',J/'bin/javac',J/'release',J/'lib/modules')};assert before==after;O.write_text(json.dumps({'status':'passed','fixture_cases':len(fx['cases']),'scope':'Java8 core compiled and run on pinned JDK; all shared object fixtures and successful typed vectors plus focused native checks. No renderer acceptance.','vectors':vectors,'native':native,'source_sha256_before':before,'source_sha256_after':after},indent=2)+'\n');print(O)
