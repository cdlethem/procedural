#!/usr/bin/env python3
"""Independent octave goldens; reuse existing Fraction-rounded scalar noise oracles."""
import copy
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.build_noise_fixtures import sample as sample2, add, mul
from tools.build_noise3d_fixtures import sample as sample3

def evaluate(a):
    frequencies=[];weights=[];f=a['frequency'];w=a['amplitude'];total=0.
    for k in range(a['octaves']):
        frequencies.append(f);weights.append(w);total=add(total,w)
        if k+1<a['octaves']:f=mul(f,a['lacunarity']);w=mul(w,a['persistence'])
    values=[]
    for point in a['points']:
        s=0.
        for f,w in zip(frequencies,weights):
            q=[mul(v,f) for v in point]
            sample=sample2(a['seed'],*q) if a['dimension']==2 else sample3(a['seed'],q)
            s=add(s,mul(w,sample))
        if a['normalization']=='WEIGHT_SUM':s=float(Fraction(s)/Fraction(total))
        values.append(s)
    return {'values':values,'amplitudeSum':total}

def main():
    catalog=ROOT/'catalog/operations/octave-gradient-noise.json';c=json.loads(catalog.read_text())
    base={'dimension':2,'points':[[.25,.75],[-.25,.75],[.1,.2],[0,0]],'seed':42,'octaves':4,'frequency':1.,'lacunarity':2.,'amplitude':.5,'persistence':.45,'normalization':'NONE','maxWork':20}
    cases=[]
    def case(id,edits,error=None):
        a=copy.deepcopy(base);a.update(edits);cases.append({'id':id,'input':a,**({'error':error} if error else {'output':evaluate(a)})})
    case('two-dimensional-raw',{});case('two-dimensional-normalized',{'normalization':'WEIGHT_SUM'})
    case('three-dimensional',{'dimension':3,'points':[[.25,.5,.75],[-.25,1.5,-2.75],[.1,.2,.3],[0,0,0]]})
    case('single-octave-identity',{'octaves':1,'amplitude':1,'lacunarity':1e308,'persistence':1e308})
    case('zero-persistence',{'persistence':0});case('zero-amplitude-raw',{'amplitude':0})
    case('empty-but-computed-schedule',{'points':[],'maxWork':4})
    case('weight-underflow',{'amplitude':5e-324,'persistence':.5,'normalization':'WEIGHT_SUM'})
    case('fractional-frequency-progression',{'frequency':.3,'lacunarity':1.7,'persistence':1.2})
    case('large-weight-ordered-sum',{'amplitude':1e15,'persistence':.2,'octaves':8,'points':[[.1,.2]],'maxWork':16})
    case('sensitive-frequency-not-coordinate-progression',{'points':[[1e12+.25,-1e12+.75]],'frequency':.3,'lacunarity':1.7})
    case('frequency-underflow',{'frequency':5e-324,'lacunarity':.5})
    case('zero-frequency',{'frequency':0})
    for seed in [0,1,2147483648,4294967295]:case('seed-'+str(seed),{'seed':seed})
    for id,edit,err in [
        ('budget',{'maxWork':19},'WORK_LIMIT'),('empty-budget',{'points':[],'maxWork':3},'WORK_LIMIT'),
        ('work-product-overflow',{'octaves':2147483647,'maxWork':0},'WORK_LIMIT'),
        ('weight-sum-overflow',{'amplitude':1e308,'persistence':1},'NUMERIC_OVERFLOW'),
        ('frequency-overflow',{'frequency':1e308,'lacunarity':1e308},'NUMERIC_OVERFLOW'),
        ('budget-before-schedule',{'frequency':1e308,'lacunarity':1e308,'maxWork':0},'WORK_LIMIT'),
        ('query-upper-exclusive',{'points':[[9007199254740991,0]],'octaves':1},'QUERY_OUT_OF_RANGE'),
        ('query-below-lower',{'points':[[-9007199254740992,0]],'octaves':1},'QUERY_OUT_OF_RANGE'),
        ('query-3d-z-outside',{'dimension':3,'points':[[0,0,9007199254740991]],'octaves':1},'QUERY_OUT_OF_RANGE'),
        ('zero-weight-query-still-evaluated',{'points':[[9007199254740991,0]],'octaves':1,'amplitude':0},'QUERY_OUT_OF_RANGE'),
        ('query-product-overflow',{'points':[[1e308,0]],'frequency':1e308,'octaves':1},'NUMERIC_OVERFLOW'),
        ('zero-normalized-weight',{'amplitude':0,'normalization':'WEIGHT_SUM'},'INVALID_INPUT'),
        ('wrong-dimension',{'dimension':4},'INVALID_INPUT'),('wrong-tuple',{'points':[[1,2,3]]},'INVALID_INPUT'),
        ('late-invalid-before-work',{'points':[[1,2],[3,'bad']],'maxWork':0},'INVALID_INPUT'),
        ('zero-octaves',{'octaves':0},'INVALID_INPUT'),('negative-persistence',{'persistence':-.5},'INVALID_INPUT')]:case(id,edit,err)
    result={'operation':c['id'],'version':c['version'],'fixture_format':'exact-json-output','comparison':'exact','catalog_sha256':hashlib.sha256(catalog.read_bytes()).hexdigest(),'oracle':'tools/build_octave_gradient_noise_fixtures.py; Fraction-rounded octave arithmetic and existing independent 2D/3D Fraction noise oracles; no JS evaluator imported.','cases':cases}
    (ROOT/c['fixtures']).write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(f'Wrote {len(cases)} octave cases')
if __name__=='__main__':main()
