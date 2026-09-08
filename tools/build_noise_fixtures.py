#!/usr/bin/env python3
"""Build reviewed noise vectors using exact-rational operations rounded at each binary64 step.

This independent oracle is not imported by any native implementation. It intentionally
uses Fraction for every arithmetic operation, rather than sharing the port's evaluator.
"""
from fractions import Fraction
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASK = 2**32-1
GRAD = [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]


def add(a,b): return float(Fraction(a)+Fraction(b))
def sub(a,b): return float(Fraction(a)-Fraction(b))
def mul(a,b): return float(Fraction(a)*Fraction(b))
def mix(n):
    n=(n^(n>>16))*0x7feb352d & MASK
    n=(n^(n>>15))*0x846ca68b & MASK
    return n^(n>>16)
def corner(seed,i,j): return mix(mix(seed^(i&MASK)^0x9e3779b9)^(j&MASK)^0x85ebca6b)
def fade(t): return mul(mul(mul(t,t),t),add(mul(t,sub(mul(6.,t),15.)),10.))
def lerp(a,b,t): return add(a,mul(t,sub(b,a)))
def sample(seed,x,y):
    i,j=math.floor(x),math.floor(y); u,v=sub(x,float(i)),sub(y,float(j))
    values=[]
    for di,dj in [(0,0),(1,0),(0,1),(1,1)]:
        gx,gy=GRAD[corner(seed,i+di,j+dj)&7]
        values.append(add(mul(float(gx),sub(u,float(di))),mul(float(gy),sub(v,float(dj)))))
    a,b,c,d=values
    raw=lerp(lerp(a,b,fade(u)),lerp(c,d,fade(u)),fade(v))
    value=max(0.,min(1.,add(.5,mul(.5,raw))))
    return 0. if value==0 else value


def main():
    contract=json.loads((ROOT/'catalog/operations/gradient-noise-2d-01.json').read_text())
    if (contract['id'],contract['version']) != ('field.gradient-noise-2d-01','0.1.0'):
        raise RuntimeError('This reviewed oracle supports gradient-noise-2d-01 0.1.0 only')
    coords=[[0.,0.],[.25,.75],[-.25,.75],[.25,-.75],[-.25,-.75],
            [.1,.2],[.2,.1],[-1.0000000000000002,2.9999999999999996],
            [-5e-324,5e-324],[4294967296.25,-4294967295.25],
            [-9007199254740991.,9007199254740990.],[.25,.75],[.75,.25]]
    cases=[]
    for seed in [0,1,42,2147483648,4294967295]:
        queries=[{'input':xy,'output':sample(seed,*xy)} for xy in coords]
        cases.append({'id':f'seed-{seed}','input':{'seed':seed},'serialized':{'seed':seed},'queries':queries})
    cases.append({'id':'integral-and-negative-zero-seed','input':{'seed':-0.0},'serialized':{'seed':0},'queries':[{'input':[-0.0,-0.0],'output':.5}]})
    # Search exact attaining patterns for seed42, then retain the independently checked cell centres.
    endpoints={}
    for i in range(-64,64):
        for j in range(-64,64):
            value=sample(42,i+.5,j+.5)
            if value in (0.,1.) and value not in endpoints: endpoints[value]=[i+.5,j+.5]
        if len(endpoints)==2: break
    assert len(endpoints)==2
    cases.append({'id':'attaining-endpoints','input':{'seed':42},'serialized':{'seed':42},'queries':[{'input':xy,'output':v} for v,xy in sorted(endpoints.items())]})
    for id,value in [('missing',{}),('extra',{'seed':42,'frequency':.01}),('bool',{'seed':True}),('fractional',{'seed':1.5}),('negative',{'seed':-1}),('too-large',{'seed':4294967296}),('string',{'seed':'42'}),('wrong-shape',[])]:
        cases.append({'id':id,'input':value,'error':'INVALID_INPUT'})
    query_cases=[{'id':id,'input':value,'error':'INVALID_QUERY'} for id,value in [
        ('upper-excluded',[9007199254740991,0]),('below-lower',[-9007199254740992,0]),
        ('y-upper-excluded',[0,9007199254740991]),('y-below-lower',[0,-9007199254740992]),
        ('wrong-length',[0]),('extra-coordinate',[0,0,0]),('bool-coordinate',[True,0]),('wrong-shape',{'x':0,'y':0})]]
    data={'operation':contract['id'],'version':contract['version'],'oracle':'tools/build_noise_fixtures.py; Fraction arithmetic rounds after each operation; no native evaluator imported',
          'cases':cases,'query_cases':query_cases,
          'mix_vectors':[{'input':v,'output':mix(v)} for v in [0,1,42,2147483648,4294967295,0x9e3779b9,0x85ebca6b]],
          'corner_vectors':[{'seed':s,'i':i,'j':j,'output':corner(s,i,j)} for s,i,j in [(0,0,0),(42,-1,0),(42,0,-1),(4294967295,4294967296,-4294967297),(1,-9007199254740991,9007199254740991)]]}
    output=ROOT/contract['fixtures']
    output.write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
    print(f'Wrote {len(cases)} constructor cases and {len(query_cases)} query errors; endpoint coordinates {endpoints}')

if __name__=='__main__': main()
