#!/usr/bin/env python3
"""Independent exact expected intervals and coordinates for the private Java kernel."""
from fractions import Fraction as F
from pathlib import Path
import hashlib
import json
import struct
import subprocess
from exact_clip_study import clip

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'.work/vector-clipping-study/exact-java'
JDK=ROOT/'.work/toolchains/jdk-17.0.20.1+1/bin'


def java_matrix(rows):
    return 'new double[][]{'+','.join('{'+','.join(float(v).hex() for v in row)+'}' for row in rows)+'}'


def bits(x):
    return struct.unpack('>Q',struct.pack('>d',x))[0] if x else 0


def main():
    subprocess.run(['python3',str(Path(__file__).with_name('exact_clip_study.py'))],cwd=ROOT,check=True)
    subprocess.run(['python3',str(Path(__file__).with_name('polygon_validation_study.py'))],cwd=ROOT,check=True)
    base=json.loads((OUT.parent/'exact.json').read_text())['cases']
    cases=[]
    for case in base:
        for mode in ('original','winding','direction'):
            p=case['polygon'][::-1] if mode=='winding' else case['polygon']
            s=case['segment'][::-1] if mode=='direction' else case['segment']
            cases.append((case['id']+'/'+mode,p,s))
    # Scaling preserves exact topology, while overflowing or underflowing naive products.
    for exponent in (-1000,900):
        scale=F(2)**exponent
        for case in base[:2]:
            p=[[float(F(v)*scale) for v in row] for row in case['polygon']]
            s=[[float(F(v)*scale) for v in row] for row in case['segment']]
            cases.append((case['id']+'/scale'+str(exponent),p,s))
    cases.append(('signed_zero', [[0,0],[4,0],[4,4],[0,4]], [[-0.0,-0.0],[4,0]]))
    calls=[];expected=[]
    for name,p,s in cases:
        intervals=clip(p,s);a=list(map(F,s[0]));d=[F(s[1][i])-a[i] for i in (0,1)]
        rows=[]
        for lo,hi in intervals:
            rows.append([0]+[bits(float(x)) for x in [lo,hi,a[0]+d[0]*lo,a[1]+d[1]*lo,a[0]+d[0]*hi,a[1]+d[1]*hi]])
        expected.append((name,rows))
        calls.append('emit('+java_matrix(p)+','+java_matrix([[v for point in s for v in point]])+');')
    validity=json.loads((OUT.parent/'polygon-validation.json').read_text())['cases']
    extra=[];extra_expected=[]
    for case in validity:
        for polygon in (case['polygon'],case['polygon'][::-1]):
            extra.append('valid('+java_matrix(polygon)+');')
            extra_expected.append(case['valid'])
    extra.append('collapse();');extra_expected.append(True)
    extra.append('gap();');extra_expected.append(True)
    extra.append('endpoints();');extra_expected.append(True)
    source='''public class ExactClipProbe {
static void endpoints(){try{double m=Double.MIN_VALUE;
ExactSegmentClipStudy.clip(new double[][]{{0,0},{m,0},{0,m}},new double[][]{{0,0,m,m}});
System.out.println(false);}catch(IllegalArgumentException e){System.out.println(e.getMessage().contains("endpoint representation"));}}
static void gap(){try{double m=Double.MIN_VALUE;
ExactSegmentClipStudy.clip(new double[][]{{-1,-1},{1,-1},{1,1},{m,1},{m,0},{0,0},{0,1},{-1,1}},new double[][]{{-1,0.5,1,0.5}});
System.out.println(false);}catch(IllegalArgumentException e){System.out.println(e.getMessage().contains("gap representation"));}}
static void valid(double[][] p){try{ExactSegmentClipStudy.clip(p,new double[0][]);System.out.println(true);}
catch(IllegalArgumentException e){System.out.println(false);}}
static void collapse(){try{double m=Double.MIN_VALUE;
ExactSegmentClipStudy.clip(new double[][]{{0,0},{m,0},{m,1},{0,1}},new double[][]{{-1,0.5,1,0.5}});
System.out.println(false);}catch(IllegalArgumentException e){System.out.println(e.getMessage().contains("parameter representation"));}}

static void emit(double[][] p,double[][] s){
java.util.List<ExactSegmentClipStudy.Interval> rows=ExactSegmentClipStudy.clip(p,s);
StringBuilder out=new StringBuilder("[");for(int i=0;i<rows.size();i++){
if(i>0)out.append(',');ExactSegmentClipStudy.Interval r=rows.get(i);
out.append('[').append(r.sourceIndex);
for(double v:new double[]{r.t0.doubleValue(),r.t1.doubleValue(),r.ax,r.ay,r.bx,r.by})
out.append(',').append(Long.toUnsignedString(Double.doubleToRawLongBits(v)));
out.append(']');}System.out.println(out.append(']'));}
public static void main(String[]args){'''+''.join(calls)+''.join(extra)+'}}'
    OUT.mkdir(parents=True,exist_ok=True);probe=OUT/'ExactClipProbe.java';probe.write_text(source)
    sources=[ROOT/'tools/diagnostics/clipping'/f for f in ['RationalStudy.java','ExactSegmentClipStudy.java']]
    before={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    subprocess.run([str(JDK/'javac'),'--release','8','-d',str(OUT),*[str(p) for p in sources],str(probe)],check=True)
    run=subprocess.run([str(JDK/'java'),'-cp',str(OUT),'ExactClipProbe'],capture_output=True,text=True,check=True)
    actual=[json.loads(line) for line in run.stdout.splitlines()]
    assert len(actual)==len(expected)+len(extra_expected)
    assert actual[len(expected):]==extra_expected
    for (name,want),got in zip(expected,actual):assert want==got,(name,want,got)
    assert before=={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    report=dict(status='passed-private-exact-comparison',cases=len(cases),polygon_reversal_checks=22,collapse_checks=3,source_sha256=before,
                scope='Exact binary64 interval and endpoint bits against Fraction oracle, including scaled horizontal/vertical cases. Includes 22 polygon validity/reversal checks and subnormal interval- and exterior-gap-collapse witnesses. Does not prove the full input domain.')
    (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'{len(cases)} exact interval and endpoint comparisons passed')


if __name__=='__main__':main()
