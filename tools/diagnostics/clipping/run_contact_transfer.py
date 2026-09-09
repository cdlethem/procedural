#!/usr/bin/env python3
"""Run Java contact queries in the private web/connector view; exact-oracle comparison."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from tools.run_segment_clip_java import literal
from closed_contact_study import nearest
from fractions import Fraction as F


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);a=ap.parse_args();out=a.output.resolve()
    if not out.is_relative_to(ROOT/'.work') or out.exists():raise ValueError('fresh .work required')
    out.mkdir(parents=True);classes=out/'classes';classes.mkdir()
    jdk=ROOT/'.work/toolchains/jdk-17.0.20.1+1';core=ROOT/'.work/toolchains/processing-4.5.6/core-4.5.6.jar'
    sources=[ROOT/'packages/java/src/main/java/org/procedurals/geometry'/name for name in ['NearestSegmentContact2D.java','ExactRational.java']]
    view=ROOT/'tools/diagnostics/clipping/NearestHitView.java'
    inputs=[*sources,view,Path(__file__).resolve(),ROOT/'tools/run_segment_clip_java.py',Path(__file__).with_name('closed_contact_study.py'),Path(__file__).with_name('nearest_hit_study.py'),core,jdk/'bin/java',jdk/'bin/javac',jdk/'lib/modules',ROOT/'tools/with_native_render_lock.py']
    hashes=lambda:{str(p.relative_to(ROOT)):sha(p) for p in inputs}
    report={'status':'failed','scope':'Production Java contact query transfer rendered by private native view, not packaged workflow or source reproduction','inputs_before':hashes(),'commands':[]}
    source='''import java.util.*;import org.procedurals.geometry.NearestSegmentContact2D;
public class ContactTransfer {
static List<Object> list(Object...a){return new ArrayList<Object>(Arrays.asList(a));}
static Map<String,Object> map(Object...a){Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<a.length;i+=2)m.put((String)a[i],a[i+1]);return m;}
static void same(double a,double b){if(Double.doubleToRawLongBits(a)!=Double.doubleToRawLongBits(b))throw new AssertionError("bits");}
static void line(int panel,String kind,double a,double b,double c,double d){System.out.println(panel+"\\t"+kind+"\\t"+a+"\\t"+b+"\\t"+c+"\\t"+d);}
public static void main(String[]args){boolean shifted=args[0].equals("shifted");
'''
    counts={}
    for name,shift in [('baseline',0),('shifted',35)]:
        source+='if(shifted=='+str(bool(shift)).lower()+'){\n';total=0
        origins=[(85,90),(245+shift,70),(395,130),(100,300),(270,265),(380,385)]
        rays=[(group,[x,y,x+dx*400,y+dy*400]) for group,(x,y) in enumerate(origins) for dx,dy in [(1,1),(-1,1),(-1,-1),(1,-1)]]
        cases=[(0,q,[o for g,o in rays if g!=group]) for group,q in rays]
        polygon=[(190+shift,110),(360,170),(320,365),(140,320)]
        obstacles=[list(v)+list(polygon[(i+1)%4]) for i,v in enumerate(polygon)]
        for edge in obstacles:source+='line(1,"obstacle",'+','.join(str(x)+'d' for x in edge)+');\n'
        cases += [(1,[x,y,250,240],obstacles) for x,y in [(50,60),(150,40),(290,40),(440,80),(460,230),(430,430),(290,460),(130,440),(40,300),(40,170)]]
        for panel,q,blockers in cases:
            config={'queries':[q],'obstacles':blockers,'maxWork':len(blockers)}
            source+='{NearestSegmentContact2D.Contact h=NearestSegmentContact2D.find('+literal(config)+').hitAt(0);\n'
            source+='line('+str(panel)+',"original",'+','.join(str(x)+'d' for x in q)+');\n'
            hit=nearest(q,blockers)
            if hit is None:source+='if(h!=null)throw new AssertionError("miss");\n'
            else:
                t,index,_=hit;point=[float(F(q[i])+t*(F(q[i+2])-F(q[i]))) for i in range(2)];total+=1
                source+='if(h==null||h.obstacleIndex!='+str(index)+')throw new AssertionError("identity");\n'
                source+='same(h.t,'+literal(float(t))+');same(h.x,'+literal(point[0])+');same(h.y,'+literal(point[1])+');\n'
                source+='line('+str(panel)+',"trimmed",'+str(q[0])+'d,'+str(q[1])+'d,h.x,h.y);line('+str(panel)+',"hit",h.x,h.y,h.x,h.y);\n'
            source+='}\n'
        counts[name]={'queries':len(cases),'hits':total};source+='}\n'
    source+='}}\n';generated=out/'ContactTransfer.java';generated.write_text(source)
    def run(cmd):
        r=subprocess.run(list(map(str,cmd)),capture_output=True,text=True);report['commands'].append({'command':list(map(str,cmd)),'returncode':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
        if r.returncode:raise RuntimeError(r.stderr)
        return r
    try:
        run([jdk/'bin/javac','--release','8','-cp',core,'-d',classes,*sources,view,generated])
        for name in counts:
            r=run([jdk/'bin/java','-cp',classes,'ContactTransfer',name]);(out/(name+'.tsv')).write_text(r.stdout)
            run(['python3',ROOT/'tools/with_native_render_lock.py','--timeout','60','--','xvfb-run','-a',jdk/'bin/java','-cp',str(classes)+':'+str(core),'NearestHitView',out/(name+'.tsv'),out/(name+'.png')])
        after=hashes();assert after==report['inputs_before']
        report.update(status='passed-java-transfer-study',inputs_after=after,counts=counts,artifacts={str(p.relative_to(ROOT)):sha(p) for p in [generated,*classes.rglob('*.class'),*out.glob('*.png'),*out.glob('*.tsv')]})
    finally:(out/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'output':str(out)}))

if __name__=='__main__':main()
