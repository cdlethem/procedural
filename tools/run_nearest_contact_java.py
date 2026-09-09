#!/usr/bin/env python3
"""Compile candidate contact core and compare reviewed fixtures as exact binary64 bits."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_segment_clip_java import literal


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def generate(fixture):
    methods=[]
    for i,case in enumerate(fixture['cases']):
        body=['static void case%d(){'%i,'Object input='+literal(case['input'])+';']
        if 'error' in case:
            body+=['try{NearestSegmentContact2D.find(input);throw new AssertionError("missing failure");}',
                   'catch(NearestSegmentContact2D.ContactException e){require(e.code.equals('+literal(case['error'])+'),"code");']
            detail=case.get('error_details',{})
            body+=['require(e.queryIndex=='+str(detail.get('queryIndex',-1))+',"queryIndex");',
                   'require(java.util.Objects.equals(e.stage,'+literal(detail.get('stage'))+'),"stage");}']
        else:
            body+=['NearestSegmentContact2D result=NearestSegmentContact2D.find(input);',
                   'Object expected='+literal(case['output'])+';',
                   'same(result.toValues(),expected);',
                   'require(result.size()=='+str(len(case['output']['hits']))+',"size");']
            for j,hit in enumerate(case['output']['hits']):
                if hit is None:body+=['require(result.hitAt('+str(j)+')==null,"miss");']
                else:
                    body+=['{NearestSegmentContact2D.Contact h=result.hitAt('+str(j)+');require(h!=null,"hit");',
                           'require(h.obstacleIndex=='+str(hit['obstacleIndex'])+',"ordinal");',
                           'same(h.t,'+literal(hit['t'])+');same(h.x,'+literal(hit['point'][0])+');same(h.y,'+literal(hit['point'][1])+');}']
        methods.append('\n'.join(body+['}']))
    prefix='''import java.util.*;
import org.procedurals.geometry.NearestSegmentContact2D;
public final class NearestContactFixtures {
static void require(boolean b,String s){if(!b)throw new AssertionError(s);}
static List<Object> list(Object...x){return new ArrayList<Object>(Arrays.asList(x));}
static Map<String,Object> map(Object...x){Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<x.length;i+=2)m.put((String)x[i],x[i+1]);return m;}
static void same(Object a,Object b){
 if(a==null||b==null){require(a==b,"null");return;}
 if(a instanceof Number&&b instanceof Number){require(Double.doubleToRawLongBits(((Number)a).doubleValue())==Double.doubleToRawLongBits(((Number)b).doubleValue()),"numeric bits "+a+" / "+b);return;}
 if(a instanceof Map&&b instanceof Map){Map<?,?> x=(Map<?,?>)a,y=(Map<?,?>)b;require(x.keySet().equals(y.keySet()),"keys");for(Object k:y.keySet())same(x.get(k),y.get(k));return;}
 if(a instanceof List&&b instanceof List){List<?> x=(List<?>)a,y=(List<?>)b;require(x.size()==y.size(),"length");for(int i=0;i<x.size();i++)same(x.get(i),y.get(i));return;}
 require(a.equals(b),"value");}
'''
    return prefix+'\n'.join(methods)+'\npublic static void main(String[]args){' + ''.join('case%d();'%i for i in range(len(methods)))+'System.out.println("passed '+str(len(methods))+' shared contact fixtures");}}\n'


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--java-home',type=Path,default=ROOT/'.work/toolchains/jdk-17.0.20.1+1');a=ap.parse_args()
    out=a.output.resolve();jdk=a.java_home.resolve()
    if not out.is_relative_to(ROOT/'.work') or out.exists():raise ValueError('fresh .work output required')
    fixture_path=ROOT/'fixtures/operations/nearest-segment-contact-2d.json';fixture=json.loads(fixture_path.read_text())
    catalog=ROOT/'catalog/operations/nearest-segment-contact-2d.json'
    if sha(catalog)!=fixture['catalog_sha256']:raise ValueError('stale fixture catalog')
    for name,digest in fixture['source_bindings'].items():
        if sha(ROOT/name)!=digest:raise ValueError('stale fixture source '+name)
    sources=[ROOT/'packages/java/src/main/java/org/procedurals/geometry'/name for name in ['NearestSegmentContact2D.java','ExactRational.java']]
    focused=ROOT/'tests/native/NearestContactNative.java'
    inputs=[focused,*sources,fixture_path,catalog,Path(__file__).resolve(),ROOT/'tools/run_segment_clip_java.py',jdk/'bin/java',jdk/'bin/javac',jdk/'lib/modules']
    before={str(p.relative_to(ROOT)):sha(p) for p in inputs};out.mkdir(parents=True);generated=out/'NearestContactFixtures.java';generated.write_text(generate(fixture).replace("list(null)", "list((Object)null)"));classes=out/'classes';classes.mkdir()
    report={'status':'failed','input_sha256_before':before,'commands':[]}
    try:
        for cmd in [[str(jdk/'bin/javac'),'--release','8','-d',str(classes),*map(str,sources),str(generated),str(focused)],[str(jdk/'bin/java'),'-cp',str(classes),'NearestContactFixtures'],[str(jdk/'bin/java'),'-cp',str(classes),'NearestContactNative']]:
            result=subprocess.run(cmd,text=True,capture_output=True);report['commands'].append({'command':cmd,'returncode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
            if result.returncode:raise RuntimeError(result.stderr)
        after={str(p.relative_to(ROOT)):sha(p) for p in inputs}
        if before!=after:raise ValueError('source changed during run')
        report.update(status='passed',input_sha256_after=after,fixture_count=len(fixture['cases']),artifact_sha256={str(p.relative_to(ROOT)):sha(p) for p in [generated,*classes.rglob('*.class')]})
    finally:(out/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'passed','fixtures':len(fixture['cases']),'output':str(out)}))

if __name__=='__main__':main()
