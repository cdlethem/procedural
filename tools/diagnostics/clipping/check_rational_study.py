#!/usr/bin/env python3
"""Check private Java exact rounding against Python Fraction conversion."""
from fractions import Fraction as F
from pathlib import Path
import hashlib
import json
import struct
import subprocess

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'.work/vector-clipping-study/rational'
JDK=ROOT/'.work/toolchains/jdk-17.0.20.1+1/bin'


def bits(x):
    return struct.unpack('>Q',struct.pack('>d',x))[0] if x else 0


def main():
    encodings=[0,1,2,3,0xfffffffffffff,0x10000000000000,0x10000000000001,
               0x3fefffffffffffff,0x3ff0000000000000,0x3ff0000000000001,
               0x4000000000000000,0x7feffffffffffffe,0x7fefffffffffffff]
    values=[struct.unpack('>d',struct.pack('>Q',b))[0] for b in encodings]
    cases=[]
    for value in values:
        exact=F(value)
        cases += [exact,-exact,exact/3]
    for a,b in zip(encodings,encodings[1:]):
        if b==a+1:
            x,y=[F(struct.unpack('>d',struct.pack('>Q',z))[0]) for z in (a,b)]
            midpoint=(x+y)/2
            cases += [midpoint,midpoint+(y-x)/8,midpoint-(y-x)/8,-midpoint]
    lines=[]
    for q in cases:
        lines.append('emit(new RationalStudy(new java.math.BigInteger("%s"),new java.math.BigInteger("%s")));'%(q.numerator,q.denominator))
    source='''public class RationalProbe {
static void emit(RationalStudy r){System.out.println(Long.toUnsignedString(Double.doubleToRawLongBits(r.doubleValue())));}
public static void main(String[] args){'''+''.join(lines)+'}}'
    OUT.mkdir(parents=True,exist_ok=True);probe=OUT/'RationalProbe.java';probe.write_text(source)
    src=ROOT/'tools/diagnostics/clipping/RationalStudy.java'
    subprocess.run([str(JDK/'javac'),'--release','8','-d',str(OUT),str(src),str(probe)],check=True)
    r=subprocess.run([str(JDK/'java'),'-cp',str(OUT),'RationalProbe'],capture_output=True,text=True,check=True)
    actual=list(map(int,r.stdout.splitlines()));expected=[bits(float(q)) for q in cases]
    assert actual==expected,[(i,a,e) for i,(a,e) in enumerate(zip(actual,expected)) if a!=e]
    report=dict(status='passed-private-rounding-check',cases=len(cases),source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),
                scope='Exact source values, subnormal/normal boundary, maximum finite, thirds and adjacent-float ties; canonical positive zero. Not all rationals or performance acceptance.')
    (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'{len(cases)} rational conversions match exact Fraction rounding')


if __name__=='__main__':main()
