#!/usr/bin/env python3
"""Run portable gradient-path cores in isolated native builds; no renderer claim."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, java_value, run


def run_java(home, fixture):
    build=ROOT/'.work/build/gradient-path-conformance-java'
    build.mkdir(parents=True,exist_ok=True)
    methods=[]
    for ordinal,c in enumerate(fixture['cases']+fixture['long_cases']):
        lines=['Object config='+java_value(c['input'])+';']
        if 'error' in c:
            lines.append('try { GradientPath2D.trace(config); throw new AssertionError("expected error"); }')
            if 'error_detail' in c:
                d=c['error_detail']
                lines.append('catch(GradientPath2D.TraceException e) { check(e.code.equals('+java_value(c['error'])+')); check(e.stepIndex=='+str(d['stepIndex'])+'); check(e.stage.equals('+java_value(d['stage'])+')); }')
            else:
                lines.append('catch(GradientPath2D.PathException e) { check(e.code.equals('+java_value(c['error'])+')); }')
        else:
            lines.append('GradientPath2D p=GradientPath2D.trace(config); paths.put('+java_value(c['id'])+',p);')
            lines.append('check(p.steps()=='+str(int(c['input']['steps']))+');')
            selected=c.get('selected')
            if selected is None:
                selected=[dict(pointIndex=i,position=v) for i,v in enumerate(c['output']['positions'])]
                for i,h in enumerate(c['output']['headings']):
                    lines.append('near(p.headingAt('+str(i)+'L),'+repr(h)+','+repr(c['comparison']['headings_abs'])+');')
            for r in selected:
                for axis in (0,1):
                    lines.append('near(p.pointAt('+str(r['pointIndex'])+'L)['+str(axis)+'],'+repr(r['position'][axis])+','+repr(c['comparison']['positions_abs'])+');')
                if 'heading' in r:
                    lines.append('near(p.headingAt('+str(r['headingIndex'])+'L),'+repr(r['heading'])+','+repr(c['comparison']['headings_abs'])+');')
            lines.append('GradientPath2D replay=GradientPath2D.trace(p.serialize());')
            lines.append('for(int i=0;i<=p.steps();i++) { double[] a=p.pointAt((long)i),b=replay.pointAt((long)i); bits(a[0],b[0]); bits(a[1],b[1]); positive(a[0]); positive(a[1]); if(i<p.steps()) { bits(p.headingAt((long)i),replay.headingAt((long)i)); positive(p.headingAt((long)i)); } }')
        methods.append('static void case'+str(ordinal)+'() {\n'+'\n'.join(lines)+'\n}')
    calls='\n'.join('case'+str(i)+'();' for i in range(len(methods)))
    for c in fixture['cross_case_checks']:
        calls+='\n{ GradientPath2D a=paths.get('+java_value(c['prefix_case'])+'), b=paths.get('+java_value(c['extended_case'])+'); for(int i=0;i<=a.steps();i++) { bits(a.pointAt((long)i)[0],b.pointAt((long)i)[0]); bits(a.pointAt((long)i)[1],b.pointAt((long)i)[1]); if(i<a.steps()) bits(a.headingAt((long)i),b.headingAt((long)i)); } }'
    source='''import java.util.*;
import org.procedurals.paths.GradientPath2D;
public class GradientPathVectors {
static Map<String,GradientPath2D> paths=new HashMap<String,GradientPath2D>();
static Map<String,Object> map(Object... kv) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<kv.length;i+=2) m.put((String)kv[i],kv[i+1]); return m; }
static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
static void check(boolean value) { if(!value) throw new AssertionError(); }
static void near(double a,double b,double t) { check(Double.isFinite(a) && Math.abs(a-b)<=t); }
static void bits(double a,double b) { check(Double.doubleToRawLongBits(a)==Double.doubleToRawLongBits(b)); }
static void positive(double a) { if(a==0) check(Double.doubleToRawLongBits(a)==0); }
'''+ '\n'.join(methods)+'\npublic static void main(String[] args) {\n'+calls+'\nSystem.out.println("{\\"passed\\":true}");\n}\n}\n'
    path=build/'GradientPathVectors.java';path.write_text(source)
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac','--release','8','-d',build,*sources,path])
    result=json.loads(run([home/'bin/java','-cp',build,'GradientPathVectors']).stdout)
    native_source=ROOT/'tests/native/GradientPathNative.java'
    run([home/'bin/javac','--release','17','-cp',build,'-d',build,native_source])
    native=json.loads(run([home/'bin/java','-cp',build,'GradientPathNative'],timeout=60).stdout)
    resource=json.loads(run([home/'bin/java','-Xms32m','-Xmx32m','-cp',build,'GradientPathNative','--resource'],timeout=60).stdout)
    if native.get('status')!='passed' or resource.get('status')!='passed': raise RuntimeError('Java native checks failed')
    result.update(cases=len(methods),native=native,resource=resource,scope='shared vectors, exact replay/prefix, positive zero, native ownership/access/resource and scoped performance; no renderer or Android claim',runtime=run([home/'bin/java','-version']).stderr.strip())
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home')
    parser.add_argument('--target',choices=['all','java','javascript','python'],default='all')
    parser.add_argument('--output',type=Path,default=ROOT/'.work/conformance/gradient-path.json')
    args=parser.parse_args()
    catalog=ROOT/'catalog/operations/gradient-path.json'; contract=json.loads(catalog.read_text())
    fixture_path=ROOT/contract['fixtures'];fixture=json.loads(fixture_path.read_text())
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    if fixture['catalog_sha256']!=sha(catalog): raise RuntimeError('stale fixture catalog binding')
    long_source=ROOT/fixture['long_cases_source']['path']
    if sha(long_source)!=fixture['long_cases_source']['sha256']: raise RuntimeError('stale long-case source')
    sources=[Path(__file__).resolve(),ROOT/'tools/run_grid_conformance.py',catalog,fixture_path,long_source]
    sources+=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    sources+=sorted((ROOT/'packages/javascript/src').rglob('*.js'))
    sources+=sorted((ROOT/'packages/python/procedurals').rglob('*.py'))
    sources+=[ROOT/'tests/native/gradient-path-javascript.mjs',ROOT/'tests/native/gradient-path-python.py',ROOT/'tests/native/GradientPathNative.java']
    bindings={str(p.relative_to(ROOT)):sha(p) for p in sources}
    results={}
    if args.target in ('all','java'): results['java']=run_java(java_home(args.java_home),fixture)
    if args.target in ('all','javascript'):
        results['javascript']=json.loads(run(['node',ROOT/'tests/native/gradient-path-javascript.mjs'],timeout=120).stdout)
    if args.target in ('all','python'):
        results['python']=json.loads(run([sys.executable,ROOT/'tests/native/gradient-path-python.py'],timeout=120).stdout)
    for target,result in results.items():
        if result.get('failures') or result.get('passed') is False: raise RuntimeError(target+' failed')
    if bindings!={str(p.relative_to(ROOT)):sha(p) for p in sources}: raise RuntimeError('source changed during execution; no evidence published')
    report={'operation':contract['id'],'scope':'Java/JavaScript/Python portable core conformance and scoped workload observations; no native renderer or Android claim',
            'contract_sha256':sha(catalog),'fixture_sha256':sha(fixture_path),'results':results,'source_sha256':bindings}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':list(results),'report':str(args.output),'scope':report['scope']}))

if __name__=='__main__': main()
