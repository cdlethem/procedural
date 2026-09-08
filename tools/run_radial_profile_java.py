#!/usr/bin/env python3
"""Compile and run CP7 Java shared vectors and native checks without a renderer."""
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
if __package__ in {None, ''}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.check_profile_fixtures import validate

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'catalog/operations/radial-profile-surface.json'
FIXTURE = ROOT / 'fixtures/operations/radial-profile-surface.json'
CORE = ROOT / 'packages/java/src/main/java/org/procedurals/mesh/RadialProfile3D.java'
NATIVE = ROOT / 'tests/native/RadialProfileNative.java'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def jvalue(v):
    if v is None: return 'null'
    if v is True: return 'Boolean.TRUE'
    if v is False: return 'Boolean.FALSE'
    if isinstance(v, str): return json.dumps(v)
    if isinstance(v, (int, float)): return 'Double.valueOf(' + json.dumps(str(v)) + ')'
    if isinstance(v, list): return 'list(' + ','.join(map(jvalue, v)) + ')'
    if isinstance(v, dict): return 'map(' + ','.join(jvalue(x) for pair in v.items() for x in pair) + ')'
    raise TypeError(v)


def vectors_source(fixture):
    methods = []
    for n, case in enumerate(fixture['cases']):
        body = ['Object input=' + jvalue(case['input']) + ';']
        if 'error' in case:
            body += ['try { RadialProfile3D.generate(input); throw new AssertionError("expected failure"); }',
                     'catch (RuntimeException e) {',
                     'equal(' + jvalue(case['error']) + ', e.getClass().getField("code").get(e), "error code");']
            for key, val in case.get('error_detail', {}).items():
                if isinstance(val, int):
                    body.append('check(((Number)e.getClass().getField("'+key+'").get(e)).longValue()=='+str(val)+'L,"'+key+'");')
                else:
                    body.append('equal('+jvalue(val)+',e.getClass().getField("'+key+'").get(e),"'+key+'");')
            body.append('}')
        else:
            out = case['output']
            body += ['RadialProfile3D r=RadialProfile3D.generate(input);',
                     f'check(r.vertexCount()=={len(out["positions"])},"vertex count");',
                     f'check(r.faceCount()=={len(out["triangles"])},"face count");']
            for field, accessor in [('positions', 'vertexAt'), ('normals', 'normalAt')]:
                for i, row in enumerate(out[field]):
                    name = field + str(i)
                    body.append(f'double[] {name}=r.{accessor}({i}L); check({name}.length==3,"triple");')
                    for axis, val in enumerate(row):
                        allowance = case['comparison'][field+'_abs'][i][axis]
                        body.append(f'within({name}[{axis}],"{val["bits_hex"]}",{jvalue(allowance)},"{case["id"]}/{field}/{i}/{axis}");')
            for i, row in enumerate(out['triangles']):
                body.append(f'int[] t{i}=r.triangleAt({i}L); check(Arrays.equals(t{i},new int[]{{'+','.join(map(str,row))+'}),"triangle");')
            for field, accessor in [('faceKinds','faceKindAt'),('bands','bandAt'),('cells','cellAt')]:
                for i, val in enumerate(out[field]):
                    if isinstance(val, str): body.append(f'equal({jvalue(val)},r.{accessor}({i}L),"{field}");')
                    else: body.append(f'check(r.{accessor}({i}L)=={val},"{field}");')
        methods.append(f'static void case{n}() throws Exception {{\n'+'\n'.join(body)+'\n}')
    return '''package org.procedurals.mesh;
import java.util.*;
public final class RadialProfileVectors {
static int assertions;
static void check(boolean c,String label) { assertions++; if(!c)throw new AssertionError(label); }
static void equal(Object e,Object a,String label) { check(e.equals(a),label); }
static void within(double a,String bits,double tolerance,String label) {
 long expected=Long.parseUnsignedLong(bits,16); double value=Double.longBitsToDouble(expected);
 check(Double.isFinite(a),label+" finite");
 if(a==0.0)check(Double.doubleToRawLongBits(a)==0L,label+" canonical zero");
 if(tolerance==0.0)check(Double.doubleToRawLongBits(a)==expected,label+" exact");
 else check(Math.abs(a-value)<=tolerance,label+" allowance");
}
static List<Object> list(Object... v) { return new ArrayList<Object>(Arrays.asList(v)); }
static Map<String,Object> map(Object... v) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m; }
'''+'\n'.join(methods)+'\npublic static void main(String[] args) throws Exception {\n'+''.join(f'case{n}();' for n in range(len(methods)))+'\nSystem.out.println("{\\"status\\":\\"passed\\",\\"fixture_cases\\":'+str(len(methods))+',\\"assertions\\":"+assertions+"}"); }}\n'


def invoke(args, timeout=120):
    result = subprocess.run([str(x) for x in args],cwd=ROOT,text=True,capture_output=True,timeout=timeout)
    if result.returncode: raise RuntimeError(result.stdout+'\n'+result.stderr)
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--java-home',type=Path,default=ROOT/'.work/toolchains/jdk-17.0.20.1+1')
    p.add_argument('--output',type=Path,default=ROOT/'evidence/conformance/radial-profile-surface-processing-java.json')
    a=p.parse_args();fixture=json.loads(FIXTURE.read_text());op=json.loads(CATALOG.read_text())
    if errors:=validate(ROOT,'profile',op,fixture):raise RuntimeError('\n'.join(errors))
    frozen=json.loads((ROOT/'evidence/investigations/cp7-contract-review.json').read_text())['bindings']
    for path in (CATALOG,FIXTURE):
        if sha(path)!=frozen[str(path.relative_to(ROOT))]:raise RuntimeError('frozen contract/fixture changed')
    bound=[CATALOG,FIXTURE,CORE,NATIVE,Path(__file__),ROOT/'tools/check_profile_fixtures.py']
    before={str(x.relative_to(ROOT)):sha(x) for x in bound}
    build=ROOT/'.work/cp7-java/native';build.mkdir(parents=True,exist_ok=True)
    source=build/'RadialProfileVectors.java';source.write_text(vectors_source(fixture))
    invoke([a.java_home/'bin/javac','--release','8','-d',build,CORE,source,NATIVE])
    results={}
    for name in ('RadialProfileVectors','RadialProfileNative'):
        r=invoke([a.java_home/'bin/java','-cp',build,'org.procedurals.mesh.'+name])
        if r.stderr.strip():raise RuntimeError('unexpected native stderr: '+r.stderr)
        results[name]=json.loads(r.stdout)
        if results[name].get('status')!='passed':raise RuntimeError('native check did not pass')
    after={str(x.relative_to(ROOT)):sha(x) for x in bound}
    if before!=after:raise RuntimeError('bound inputs changed during run')
    report={'operation':op['id'],'status':'passed','scope':'Java core vectors and native access/workloads only; no installed package, P3D or other-target claim.','source_sha256_before':before,'source_sha256_after':after,'generated_vectors_sha256':sha(source),'runtime':invoke([a.java_home/'bin/java','-version']).stderr.strip(),'results':results}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'status':'passed','cases':len(fixture['cases']),'report':str(a.output)}))

if __name__=='__main__':main()
