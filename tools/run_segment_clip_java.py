#!/usr/bin/env python3
"""Compile and compare all reviewed clipping fixtures against production Java."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.check_segment_clipping_fixtures import validate


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def literal(v):
    if v is None:return 'null'
    if isinstance(v,bool):return 'Boolean.'+str(v).upper()
    if isinstance(v,str):return json.dumps(v)
    if isinstance(v,int):return str(v)+'L'
    if isinstance(v,float):return 'Double.valueOf('+v.hex()+')'
    if isinstance(v,list):return 'list('+','.join(literal(x) for x in v)+')'
    if isinstance(v,dict):return 'map('+','.join(literal(x) for pair in v.items() for x in pair)+')'
    raise TypeError(v)


def generate(f):
    methods=[]
    for i,row in enumerate(f['cases']):
        code=['static void case%d(){'%i,'Object input='+literal(row['input'])+';']
        if 'error' in row:
            code+=['try{SegmentClip2D.clip(input);throw new AssertionError("missing error");}',
                   'catch(SegmentClip2D.SegmentClipException e){ require(e.code.equals('+literal(row['error'])+'),"error code");']
            detail=row.get('error_detail',{})
            for key in ('sourceIndex','intervalIndex'):
                code+=['require(e.'+key+'=='+str(detail.get(key,-1))+',"'+key+'");']
            code+=['require(java.util.Objects.equals(e.stage,'+literal(detail.get('stage'))+'),"stage");}']
        else:
            o=row['output'];code+=['SegmentClip2D r=SegmentClip2D.clip(input);require(r.size()==%d,"count");'%len(o['segments'])]
            for j,source in enumerate(o['sourceIndices']):
                code+=['require(r.sourceIndexAt(%d)==%d,"source identity");'%(j,source)]
                for field,access in [('segments','segmentAt'),('intervals','intervalAt')]:
                    for k,hexbit in enumerate(row['output_bits'][field][j]):
                        code+=['require(Double.doubleToRawLongBits(r.%s(%d)[%d])==0x%sL,"%s bits");'%(access,j,k,hexbit,field)]
        code+=['}'];methods.append('\n'.join(code))
    return '''import org.procedurals.geometry.SegmentClip2D;
import java.util.*;
public final class SegmentClipFixtureVectors {
static void require(boolean b,String s){if(!b)throw new AssertionError(s);}
static List<Object> list(Object...x){return new ArrayList<Object>(Arrays.asList(x));}
static Map<String,Object> map(Object...x){Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<x.length;i+=2)m.put((String)x[i],x[i+1]);return m;}
'''+ '\n'.join(methods)+'\npublic static void main(String[]args){'+''.join('case%d();'%i for i in range(len(methods)))+'System.out.println("All '+str(len(methods))+' shared fixtures passed with exact bits and error details");}}\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--java-home',type=Path,default=ROOT/'.work/toolchains/jdk-17.0.20.1+1')
    args=parser.parse_args();out=args.output.resolve();jdk=args.java_home.resolve()
    if out.exists() or not out.is_relative_to(ROOT/'.work'):raise ValueError('fresh .work output required')
    catalog=ROOT/'catalog/operations/clip-segments-simple-polygon-2d.json';fixture=ROOT/'fixtures/operations/clip-segments-simple-polygon-2d.json'
    op=json.loads(catalog.read_text());data=json.loads(fixture.read_text());errors=validate(ROOT,'clipping',op,data)
    if errors:raise ValueError(errors)
    core=ROOT/'packages/java/src/main/java/org/procedurals/geometry/SegmentClip2D.java'
    exact=ROOT/'packages/java/src/main/java/org/procedurals/geometry/ExactRational.java'
    test=ROOT/'tests/native/SegmentClipNative.java'
    dependencies=[catalog,fixture,core,exact,test,Path(__file__).resolve(),ROOT/'tools/check_segment_clipping_fixtures.py']
    dependencies += [ROOT/p for p in data['source_bindings']]
    dependencies += [ROOT/'tools/diagnostics/clipping'/p for p in ('check_error_draft.py','polygon_validation_study.py')]
    dependencies += [jdk/p for p in ('bin/java','bin/javac','release','lib/modules')]
    before={str(p.relative_to(ROOT)):sha(p) for p in dependencies}
    out.mkdir(parents=True);src=out/'SegmentClipFixtureVectors.java';src.write_text(generate(data));classes=out/'classes';classes.mkdir()
    report=dict(status='failed',input_sha256_before=before,commands=[])
    try:
        commands=[[jdk/'bin/javac','--release','8','-d',classes,exact,core,test,src],
                  [jdk/'bin/java','-cp',classes,'SegmentClipFixtureVectors'],
                  [jdk/'bin/java','-cp',classes,'org.procedurals.geometry.SegmentClipNative']]
        for cmd in commands:
            result=subprocess.run(list(map(str,cmd)),cwd=ROOT,capture_output=True,text=True,timeout=90)
            report['commands'].append(dict(argv=list(map(str,cmd)),exit_code=result.returncode,stdout=result.stdout,stderr=result.stderr))
            if result.returncode:raise RuntimeError(result.stdout+result.stderr)
        after={str(p.relative_to(ROOT)):sha(p) for p in dependencies}
        if before!=after:raise RuntimeError('inputs changed during validation')
        report.update(status='passed',fixtures=len(data['cases']),input_sha256_after=after,
                      generated_sha256=sha(src),class_sha256={str(p.relative_to(out)):sha(p) for p in classes.rglob('*.class')})
    finally:(out/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(status='passed',fixtures=len(data['cases']),output=str(out))))


if __name__=='__main__':main()
