#!/usr/bin/env python3
"""Compile and check the Java CP3 circle-placement core against frozen shared vectors.

This is pure Java-core evidence only: it deliberately makes no renderer or Android claim.
"""
from __future__ import annotations
import argparse, hashlib, json, math, shutil, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ORDERED=ROOT/'catalog/operations/ordered-circle-filter.json'
SEEDED=ROOT/'catalog/operations/seeded-circle-placement.json'
ORDERED_FIXTURE=ROOT/'fixtures/operations/ordered-circle-filter.json'
SEEDED_FIXTURE=ROOT/'fixtures/operations/seeded-circle-placement.json'
CORE=ROOT/'packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java'
NATIVE=ROOT/'tests/native/CirclePlacementsNative.java'
MAX_SAFE=9007199254740991

def sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()
def run(command,timeout=300):
    try:return subprocess.run([str(x) for x in command],cwd=ROOT,text=True,capture_output=True,check=True,timeout=timeout)
    except subprocess.CalledProcessError as e:raise RuntimeError('command failed: '+str(command)+'\nstdout:\n'+e.stdout+'\nstderr:\n'+e.stderr) from e

def java_home(value:str|None)->Path:
    if value:return Path(value)
    candidates=sorted((ROOT/'.work/toolchains').glob('jdk-17*'))
    if len(candidates)==1:return candidates[0]
    raise RuntimeError('pass --java-home; expected exactly one .work/toolchains/jdk-17*')

def jv(value):
    if value is None:return 'null'
    if value is True:return 'Boolean.TRUE'
    if value is False:return 'Boolean.FALSE'
    if isinstance(value,str):return json.dumps(value)
    if isinstance(value,(int,float)):return 'Double.valueOf('+json.dumps(str(value))+')'
    if isinstance(value,list):return 'list('+','.join(jv(x) for x in value)+')'
    if isinstance(value,dict):return 'map('+','.join(jv(x) for pair in value.items() for x in pair)+')'
    raise TypeError(type(value))

def case_methods(fixture, method_prefix, operation):
    methods=[]; calls=[]
    for index, case in enumerate(fixture['cases']):
        name=method_prefix+str(index); lines=['Object config='+jv(case['input'])+';']
        invocation='CirclePlacements2D.'+operation+'(config)'
        if 'error' in case:
            lines.append('try { '+invocation+'; throw new AssertionError("expected '+case['error']+'"); }')
            detail=case.get('error_detail')
            if detail:
                lines.append('catch(CirclePlacements2D.PlacementArithmeticException e) { check("'+case['error']+'".equals(e.code)); check(e.candidateIndex=='+str(detail['candidateIndex'])+'); check("'+detail['stage']+'".equals(e.stage)); }')
            else:lines.append('catch(CirclePlacements2D.PlacementException e) { check("'+case['error']+'".equals(e.code)); }')
        else:
            lines += ['CirclePlacements2D result='+invocation+';', 'results.put('+jv(case['id'])+',result);', 'check(result.attempts()=='+str(int(case['output']['attempts']))+');', 'check(result.size()=='+str(len(case['output']['radii']))+');']
            for i,(centre,radius,source) in enumerate(zip(case['output']['centres'],case['output']['radii'],case['output']['sourceIndices'])):
                lines.append('bits(result.pointAt('+str(i)+'L)[0],'+repr(centre[0])+'); bits(result.pointAt('+str(i)+'L)[1],'+repr(centre[1])+'); bits(result.radiusAt('+str(i)+'L),'+repr(radius)+'); check(result.sourceIndexAt('+str(i)+'L)=='+str(source)+');')
                lines.append('positive(result.pointAt('+str(i)+'L)[0]); positive(result.pointAt('+str(i)+'L)[1]);')
        methods.append('static void '+name+'() { '+' '.join(lines)+' }');calls.append(name+'();')
    return methods,calls

def vector_source(ordered,seeding):
    methods,calls=case_methods(ordered,'filterCase','filter')
    add,calls2=case_methods(seeding,'seededCase','seeded'); methods+=add;calls+=calls2
    for item in seeding['cross_case_checks']:
        if item['kind']=='accepted-binary64-prefix':
            calls.append('prefix('+jv(item['prefix_case'])+','+jv(item['extended_case'])+');')
    # The cross-fixture equivalence compares the frozen materialized seeded proposal case.
    for item in seeding['cross_case_checks']:
        if item['kind']=='independently-materialized-proposals-share-filter-output':
            calls.append('equalResults(results.get('+jv(item['seeded_case'])+'),results.get('+jv(item['filter_case'])+'));')
    rng=[]
    for sample in seeding['seed_vectors']:
        rng.append('rng('+str(sample['seed'])+'L,new long[]{'+','.join(str(x)+'L' for x in sample['initial_state'])+'},new long[]{'+','.join(str(x['output_u32'])+'L' for x in sample['first_10'])+'},new long[][]{'+','.join('new long[]{'+','.join(str(v)+'L' for v in x['post_state'])+'}' for x in sample['first_10'])+'});')
    maps=[]
    for sample in seeding['mapping_vectors']:
        c=sample['mapped']['centre'];maps.append('mapping('+jv(sample['config'])+',new double[]{'+','.join(repr(x) for x in sample['units'])+'},'+repr(c[0])+','+repr(c[1])+','+repr(sample['mapped']['radius'])+');')
    return '''package org.procedurals.sampling;
import java.util.*;
public final class CirclePlacementsVectors {
 static final Map<String,CirclePlacements2D> results=new HashMap<String,CirclePlacements2D>();
 static Map<String,Object> map(Object... kv){Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<kv.length;i+=2)m.put((String)kv[i],kv[i+1]);return m;}
 static List<Object> list(Object... v){return new ArrayList<Object>(Arrays.asList(v));}
 static void check(boolean x){if(!x)throw new AssertionError();}
 static void bits(double a,double b){check(Double.doubleToRawLongBits(a)==Double.doubleToRawLongBits(b));}
 static void positive(double x){if(x==0.0)check(Double.doubleToRawLongBits(x)==0L);}
 static void equalResults(CirclePlacements2D a,CirclePlacements2D b){check(a.size()==b.size());check(a.attempts()==b.attempts());for(int i=0;i<a.size();i++){bits(a.pointAt((long)i)[0],b.pointAt((long)i)[0]);bits(a.pointAt((long)i)[1],b.pointAt((long)i)[1]);bits(a.radiusAt((long)i),b.radiusAt((long)i));check(a.sourceIndexAt((long)i)==b.sourceIndexAt((long)i));}}
 static void prefix(String prefix,String extended){CirclePlacements2D a=results.get(prefix),b=results.get(extended);check(a.size()<=b.size());for(int i=0;i<a.size();i++){bits(a.pointAt((long)i)[0],b.pointAt((long)i)[0]);bits(a.pointAt((long)i)[1],b.pointAt((long)i)[1]);bits(a.radiusAt((long)i),b.radiusAt((long)i));check(a.sourceIndexAt((long)i)==b.sourceIndexAt((long)i));}}
 static void rng(long seed,long[] initial,long[] outputs,long[][] after){CirclePlacements2D.Xoshiro128StarStar11 x=new CirclePlacements2D.Xoshiro128StarStar11(seed);int[] start=x.stateForTest();for(int i=0;i<4;i++)check(Integer.toUnsignedLong(start[i])==initial[i]);for(int i=0;i<outputs.length;i++){check(Integer.toUnsignedLong(x.nextU32())==outputs[i]);int[] state=x.stateForTest();for(int j=0;j<4;j++)check(Integer.toUnsignedLong(state[j])==after[i][j]);}}
 static void mapping(Object config,double[] u,double x,double y,double r){CirclePlacements2D.Candidate c=CirclePlacements2D.mapForTest(u[0],u[1],u[2],u[3],config);bits(c.x,x);bits(c.y,y);bits(c.radius,r);positive(c.x);positive(c.y);}
 '''+'\n'.join(methods)+'''\n public static void main(String[] args){'''+''.join(calls)+''.join(rng)+''.join(maps)+'''System.out.println("{\\"status\\":\\"passed\\",\\"fixture_cases\\":'''+str(len(ordered['cases'])+len(seeding['cases']))+''' }");}
}
'''

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--java-home');ap.add_argument('--output',type=Path,default=ROOT/'.work/conformance/cp3-java.json');args=ap.parse_args()
    home=java_home(args.java_home)
    ordered=json.loads(ORDERED_FIXTURE.read_text());seeded=json.loads(SEEDED_FIXTURE.read_text())
    # Frozen fixture-to-contract bindings are an input precondition, not a post hoc claim.
    if ordered.get('catalog_sha256')!=sha(ORDERED):raise RuntimeError('ordered fixture catalog binding is stale')
    if seeded.get('catalog_sha256')!=sha(SEEDED):raise RuntimeError('seeded fixture catalog binding is stale')
    bound=[ORDERED,SEEDED,ORDERED_FIXTURE,SEEDED_FIXTURE,CORE,NATIVE,Path(__file__).resolve()]
    source_before={str(p.relative_to(ROOT)):sha(p) for p in bound}
    build=ROOT/'.work/build/cp3-java';shutil.rmtree(build,ignore_errors=True);build.mkdir(parents=True)
    generated=build/'CirclePlacementsVectors.java';generated.write_text(vector_source(ordered,seeded))
    run([home/'bin/javac','--release','8','-d',build,CORE,generated])
    vectors=json.loads(run([home/'bin/java','-cp',build,'org.procedurals.sampling.CirclePlacementsVectors'],timeout=180).stdout)
    run([home/'bin/javac','--release','17','-cp',build,'-d',build,NATIVE])
    native=json.loads(run([home/'bin/java','-cp',build,'org.procedurals.sampling.CirclePlacementsNative'],timeout=300).stdout)
    if vectors.get('status')!='passed' or native.get('status')!='passed':raise RuntimeError('native Java validation failed')
    # Re-read before publishing so a concurrent contract/fixture change cannot be attributed to this run.
    source_after={str(p.relative_to(ROOT)):sha(p) for p in bound}
    if source_before!=source_after:raise RuntimeError('inputs changed during conformance')
    report={'operations':['sampling.ordered-circle-filter-2d','sampling.seeded-circle-placement-2d'],'scope':'Java core pure conformance, ownership/access and bounded workload observations only; no renderer, Android, JavaScript or Python claim.','contract_sha256':{str(ORDERED.relative_to(ROOT)):sha(ORDERED),str(SEEDED.relative_to(ROOT)):sha(SEEDED)},'fixture_sha256':{str(ORDERED_FIXTURE.relative_to(ROOT)):sha(ORDERED_FIXTURE),str(SEEDED_FIXTURE.relative_to(ROOT)):sha(SEEDED_FIXTURE)},'source_sha256_before':source_before,'source_sha256_after':source_after,'vectors':vectors,'native':native,'runtime':run([home/'bin/java','-version']).stderr.strip()}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':True,'report':str(args.output),'cases':vectors['fixture_cases']}))
if __name__=='__main__':main()
