#!/usr/bin/env python3
"""CP18 exact rational-rounding oracle; reuses established scalar arithmetic helpers."""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.build_noise_fixtures import add, sub, mul, mix, corner, fade, lerp, MASK

GRAD = [(1,1,0),(-1,1,0),(1,-1,0),(-1,-1,0),(1,0,1),(-1,0,1),
        (1,0,-1),(-1,0,-1),(0,1,1),(0,-1,1),(0,1,-1),(0,-1,-1)]


def sample(seed, point):
    base = [math.floor(q) for q in point]
    fractions = [sub(q, float(i)) for q, i in zip(point, base)]
    values = []
    for dz in (0, 1):
        for dy in (0, 1):
            for dx in (0, 1):
                h = mix(corner(seed, base[0]+dx, base[1]+dy)
                        ^ ((base[2]+dz) & MASK) ^ 0xc2b2ae35)
                g = GRAD[h % 12]
                terms = [mul(float(a), sub(t, float(d)))
                         for a,t,d in zip(g, fractions, (dx,dy,dz))]
                values.append(add(add(terms[0], terms[1]), terms[2]))
    for t in map(fade, fractions):
        values = [lerp(values[i], values[i+1], t) for i in range(0,len(values),2)]
    return max(0.0, min(1.0, add(.5, mul(.5, values[0]))))


def main():
    catalog = ROOT/'catalog/operations/gradient-noise-3d-01.json'
    c = json.loads(catalog.read_text())
    assert (c['id'],c['version']) == ('field.gradient-noise-3d-01','0.1.0')
    points = [[0.,0.,0.],[.25,.5,.75],[-.25,1.5,-2.75],[.1,.2,.3],
              [.3,.1,.2],[-5e-324,5e-324,-5e-324],
              [-1.0000000000000002,2.9999999999999996,.7],
              [4294967296.25,.5,4294967296.75],
              [-9007199254740991.,9007199254740990.,.5],
              [.5,-9007199254740991.,9007199254740990.],
              [.25,.5,.75]]
    cases = [{'id':f'seed-{seed}','input':{'seed':seed},'serialized':{'seed':seed},
              'queries':[{'input':p,'output':sample(seed,p)} for p in points]}
             for seed in [0,1,42,2147483648,4294967295]]
    cases.append({'id':'negative-zero-seed','input':{'seed':-0.0},'serialized':{'seed':0},
                  'queries':[{'input':[-0.0,0.0,-0.0],'output':.5}]})
    for name,value in [('missing',{}),('extra',{'seed':42,'detail':1}),('bool',{'seed':True}),
                       ('fractional',{'seed':1.5}),('negative',{'seed':-1}),
                       ('large',{'seed':4294967296}),('string',{'seed':'42'}),('shape',[])]:
        cases.append({'id':name,'input':value,'error':'INVALID_INPUT'})
    errors=[]
    for axis in range(3):
        for name,q in [('upper',9007199254740991),('lower',-9007199254740992)]:
            p=[0,0,0];p[axis]=q
            errors.append({'id':f'{axis}-{name}','input':p,'error':'INVALID_QUERY'})
    for name,p in [('short',[0,0]),('long',[0,0,0,0]),('bool',[0,0,True]),
                   ('shape',{}),('null',[0,None,0]),('string',['0',0,0])]:
        errors.append({'id':name,'input':p,'error':'INVALID_QUERY'})
    result={'operation':c['id'],'version':c['version'],
            'catalog_sha256':hashlib.sha256(catalog.read_bytes()).hexdigest(),
            'oracle':'tools/build_noise3d_fixtures.py; Fraction rounds each primitive; no native evaluator imported',
            'cases':cases,'query_cases':errors}
    (ROOT/c['fixtures']).write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print('Wrote14 constructor cases,56 scalar samples and12 query errors')

if __name__ == '__main__':
    main()
