#!/usr/bin/env python3
"""Run exact NoiseBandPath Java fixture vectors and bounded native checks."""
from __future__ import annotations
import argparse,hashlib,json,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];CORE=ROOT/'packages/java/src/main/java';SOURCE=CORE/'org/procedurals/paths/NoiseBandPath2D.java';FIELD=CORE/'org/procedurals/fields/GradientNoise2D01.java';NATIVE=ROOT/'tests/native/NoiseBandPathNative.java';CATALOG=ROOT/'catalog/operations/noise-band-path.json';FIXTURE=ROOT/'fixtures/operations/noise-band-path.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def j(v):
 if v is None:return 'null'
 if isinstance(v,bool):return 'Boolean.'+('TRUE' if v else 'FALSE')
 if isinstance(v,str):return json.dumps(v)
 if isinstance(v,(int,float)):return 'Double.valueOf('+json.dumps(str(v))+')'
 if isinstance(v,list):return 'list('+','.join(j(x) for x in v)+')'
 if isinstance(v,dict):return 'map('+','.join(j(x) for kv in v.items() for x in kv)+')'
 raise TypeError(v)
def vectors(f):
 methods=[];calls=[]
 for i,c in enumerate(f['cases']):
  call='NoiseBandPath2D.trace('+j(c['input'])+')';
  if 'output' in c: body='exact('+j(c['output'])+','+call+'.toValues(),'+json.dumps(c['id'])+');'
  else:
   body='Throwable t=null;try{'+call+';}catch(Throwable x){t=x;}check(t!=null&&code(t).equals('+json.dumps(c['error'])+'),'+json.dumps(c['id'])+');'
   detail=c.get('error_detail',{})
   if detail:
    body+='exact('+j(detail)+',detail(t),'+json.dumps(c['id']+' error detail')+');'
   else:
    body+='check(!(t instanceof NoiseBandPath2D.TraceException)&&!(t instanceof NoiseBandPath2D.VertexLimitException),"static error has no dynamic detail");'

  methods.append('static void c%d(){%s}'%(i,body));calls.append('c%d();'%i)
 case_count=str(len(f["cases"]))
 return r'''package org.procedurals.paths; import java.util.*; public final class NoiseBandPathVectors { static int assertions; static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);} static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));} static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;} static String code(Throwable t){return t instanceof NoiseBandPath2D.PathException?((NoiseBandPath2D.PathException)t).code:"?";} static Map<String,Object> detail(Throwable t){if(t instanceof NoiseBandPath2D.TraceException){NoiseBandPath2D.TraceException e=(NoiseBandPath2D.TraceException)t;return map("attemptIndex",e.attemptIndex,"stage",e.stage);}if(t instanceof NoiseBandPath2D.VertexLimitException){NoiseBandPath2D.VertexLimitException e=(NoiseBandPath2D.VertexLimitException)t;return map("attemptIndex",e.attemptIndex,"stage",e.stage);}throw new AssertionError("missing dynamic detail");} static void exact(Object e,Object a,String m){if(e instanceof Number){check(a instanceof Number&&Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){check(a instanceof List,m);List<?>x=(List<?>)e,y=(List<?>)a;check(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){check(a instanceof Map,m);Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;check(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}check(e==null?a==null:e.equals(a),m);} '''+' '.join(methods)+' public static void main(String[]x){'+' '.join(calls)+'System.out.println("{\\"status\\":\\"passed\\",\\"cases\\":'+case_count+',\\"assertions\\":"+assertions+"}");}}'
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home', type=Path, default=ROOT/'.work/toolchains/jdk-17.0.20.1+1')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output, jdk = args.output.resolve(), args.java_home.resolve()
    if output.exists() or ROOT/'.work' not in output.parents:
        raise RuntimeError('output must be fresh under .work')
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get('catalog_sha256') != sha(CATALOG):
        raise RuntimeError('fixture/catalog binding mismatch')
    bound = [SOURCE, FIELD, NATIVE, CATALOG, FIXTURE, Path(__file__).resolve(),
             *[jdk/name for name in ('bin/java', 'bin/javac', 'release', 'lib/modules')]]
    def label(path):
        return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
    before = {label(path): sha(path) for path in bound}
    parent = ROOT/'.work/build'
    parent.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix='noise-band-', dir=parent))
    vector = build/'NoiseBandPathVectors.java'
    vector.write_text(vectors(fixture))
    commands = []
    def run(command):
        command = [str(x) for x in command]
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=180)
        commands.append({'argv':command,'returncode':result.returncode,
                         'stdout':result.stdout,'stderr':result.stderr})
        if result.returncode:
            raise RuntimeError('Command failed: '+result.stdout+result.stderr)
        return result.stdout
    run([jdk/'bin/javac', '--release', '8', '-d', build, SOURCE, FIELD, NATIVE, vector])
    artifacts = [vector, *sorted(build.rglob('*.class'))]
    compiled_before = {label(path):sha(path) for path in artifacts}
    vector_result = json.loads(run([jdk/'bin/java','-Xmx512m','-cp',build,
                                   'org.procedurals.paths.NoiseBandPathVectors']))
    native_result = json.loads(run([jdk/'bin/java','-Xmx512m','-cp',build,
                                   'org.procedurals.paths.NoiseBandPathNative']))
    after = {label(path): sha(path) for path in bound}
    compiled_after = {label(path):sha(path) for path in artifacts}
    if before != after or compiled_before != compiled_after:
        raise RuntimeError('bound input or compiled artifact changed')
    if vector_result.get('status') != 'passed' or native_result.get('status') != 'passed':
        raise RuntimeError('checks failed')
    expected = [(1,4),(96,2048),(1000,10000)]
    for measured, (paths, attempts) in zip(native_result['measurements'], expected):
        if (measured['paths'], measured['attempts_per_path'], measured['attempts_executed']) != (paths,attempts,paths*attempts):
            raise RuntimeError('incomplete workload')
    if len(native_result['measurements']) != len(expected):
        raise RuntimeError('missing workload measurement')
    report = {'status':'passed','operation':'path.noise-band-trace-2d',
              'scope':'Java core fixtures, focused ownership/errors and bounded workload; no renderer/package/port acceptance',
              'source_sha256_before':before,'source_sha256_after':after,
              'artifact_sha256_before':compiled_before,'artifact_sha256_after':compiled_after,
              'fixture_cases_executed':vector_result['cases'],'vectors':vector_result,
              'native':native_result,'commands':commands,'javac_release':'8',
              'jdk_home':str(jdk),'max_heap':'512m',
              'measurement_limits':'One measured traversal per size after16x256 warmup; payload excludes headers/spare capacity; no cross-device guarantee.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'passed','report':str(output)}))

if __name__ == '__main__':
    main()
