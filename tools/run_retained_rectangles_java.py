#!/usr/bin/env python3
"""Execute retained rectangle creation and command fixtures against actual Java."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_convex_polygon_java import jcarrier, typed_number, digest
CORE=ROOT/'packages/java/src/main/java/org/procedurals/layout/RetainedRectangles2D.java'
FIXTURE=ROOT/'fixtures/operations/retained-rectangle-cuts-2d.json'

def command(c):
    if c['op']=='cut':
        return 'm.cut(%dL,%s,%s)'%(c['id'],json.dumps(c['axis']),typed_number(c['coordinate']))
    if c['op']=='remove':return 'm.remove(%dL)'%c['id']
    raise ValueError('unknown command')

def generate(f):
    bodies=[]
    for case in f['cases']:
        create='RetainedRectangles2D.create(%s)'%jcarrier(case['input'])
        body=('error(()->{%s;},%s);'%(create,json.dumps(case['error']))) if 'error'in case else 'eq(%s.toValues(),%s);'%(create,jcarrier(case['output']))
        bodies.append('{'+body+'}')
    for case in f['command_cases']:
        body='RetainedRectangles2D m=RetainedRectangles2D.create(%s);'%jcarrier(case['input'])
        for i,c in enumerate(case['commands']):
            call=command(c)
            if 'error'in case and i==len(case['commands'])-1:body+='error(()->{%s;},%s);'%(call,json.dumps(case['error']))
            else:body+=call+';'
        body+='eq(m.toValues(),%s);'%jcarrier(case.get('after_error',case.get('output')))
        if 'recovery'in case:
            r=case['recovery'];body+='long[] recovered=%s;eq(Arrays.asList(recovered[0],recovered[1]),%s);eq(m.toValues(),%s);'%(command(r['command']),jcarrier(r['returns']),jcarrier(r['output']))
        bodies.append('{'+body+'}')
    return '''import java.util.*;
import org.procedurals.layout.RetainedRectangles2D;
public final class RectVectors {
 static Object list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 static Object map(Object...v){Map<Object,Object>m=new LinkedHashMap<>();for(int i=0;i<v.length;i+=2)m.put(v[i],v[i+1]);return m;}
 static void error(Runnable action,String code){try{action.run();throw new AssertionError("missing "+code);}catch(RetainedRectangles2D.EditException e){if(!e.code.equals(code))throw new AssertionError(e.code+" != "+code);}}
 static void eq(Object a,Object b){
  if(a instanceof Number&&b instanceof Number){if(Double.doubleToLongBits(((Number)a).doubleValue())!=Double.doubleToLongBits(((Number)b).doubleValue()))throw new AssertionError(a+" != "+b);return;}
  if(a instanceof Map&&b instanceof Map){Map x=(Map)a,y=(Map)b;if(!x.keySet().equals(y.keySet()))throw new AssertionError("keys");for(Object k:x.keySet())eq(x.get(k),y.get(k));return;}
  if(a instanceof List&&b instanceof List){List x=(List)a,y=(List)b;if(x.size()!=y.size())throw new AssertionError("size");for(int i=0;i<x.size();i++)eq(x.get(i),y.get(i));return;}
  if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);
 }
 public static void main(String[]args){
'''+'\n'.join(bodies)+'\nSystem.out.println("creation and command fixtures passed");}}\n'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);a=ap.parse_args()
    output=a.output.resolve();jdk=ROOT/'.work/toolchains/jdk-17.0.20.1+1'
    if not output.is_relative_to(ROOT/'.work') or output.exists():raise ValueError('fresh .work output required')
    inputs=[CORE,FIXTURE,ROOT/'catalog/operations/retained-rectangle-cuts-2d.json',ROOT/'design/operations/retained-rectangle-cuts-contract.md',Path(__file__),ROOT/'tools/run_convex_polygon_java.py',ROOT/'tools/run_noise3d_java.py',ROOT/'tests/native/RetainedRectanglesNative.java',*[jdk/p for p in ['bin/java','bin/javac','lib/modules','release']]]
    before={str(p.relative_to(ROOT)):digest(p) for p in inputs};f=json.loads(FIXTURE.read_text());output.mkdir(parents=True)
    generated=output/'RectVectors.java';generated.write_text(generate(f));before_generated=digest(generated)
    report={'status':'failed','inputs_before':before,'creation_cases':len(f['cases']),'command_cases':len(f['command_cases']),'commands':[]}
    try:
        classes=output/'classes';classes.mkdir()
        cmds=[[jdk/'bin/javac','--release','8','-d',classes,CORE,generated,ROOT/'tests/native/RetainedRectanglesNative.java'],[jdk/'bin/java','-cp',classes,'RectVectors'],[jdk/'bin/java','-cp',classes,'RetainedRectanglesNative']]
        compiled=None
        for i,cmd in enumerate(cmds):
            result=subprocess.run(list(map(str,cmd)),text=True,capture_output=True,timeout=60)
            report['commands'].append({'argv':list(map(str,cmd)),'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
            if result.returncode:raise RuntimeError(result.stderr)
            if i==0:compiled={str(p.relative_to(output)):digest(p) for p in classes.rglob('*.class')}
        after={str(p.relative_to(ROOT)):digest(p) for p in inputs};assert before==after
        assert before_generated==digest(generated)
        assert compiled=={str(p.relative_to(output)):digest(p) for p in classes.rglob('*.class')}
        report.update(status='passed',inputs_after=after,generated_sha256=before_generated,compiled_sha256=compiled)
    finally:(output/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'report':str(output/'report.json')}))
if __name__=='__main__':main()
