#!/usr/bin/env python3
"""Root-owned draft fixtures from independent rational clipping, not Java output."""
from pathlib import Path
from fractions import Fraction as F
import copy
import hashlib
import json
import struct
from exact_clip_study import clip

ROOT=Path(__file__).resolve().parents[3]
CATALOG=ROOT/'catalog/operations/clip-segments-simple-polygon-2d.json'


def charge(v,s):return v*v+s*(8*v*v+16*v+8)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bits(v):return struct.pack('>d',v if v else 0.0).hex()


def output(polygon,segments):
    result=dict(segments=[],sourceIndices=[],intervals=[])
    for index,raw in enumerate(segments):
        a=[F(v) for v in raw[:2]];d=[F(raw[i+2])-a[i] for i in (0,1)]
        for lo,hi in clip(polygon,[raw[:2],raw[2:]]):
            result['segments'].append([float(a[i]+d[i]*t) for t in (lo,hi) for i in (0,1)])
            result['sourceIndices'].append(index);result['intervals'].append([float(lo),float(hi)])
    return result


def build():
    square=[[0,0],[4,0],[4,4],[0,4]]
    notch=[[0,0],[6,0],[6,6],[4,6],[4,2],[2,2],[2,6],[0,6]]
    cases=[]
    def success(name,p,s,limit=16):
        value=dict(polygon=p,segments=s,maxWork=charge(len(p),len(s)),maxOutputSegments=limit)
        out=output(p,s)
        cases.append(dict(id=name,input=value,output=out,output_bits={k:[[bits(x) for x in row] for row in out[k]] for k in ('segments','intervals')}))
    success('horizontal',square,[[-1,2,5,2]])
    success('vertical',square,[[2,-1,2,5]])
    success('boundary',square,[[-1,0,5,0]])
    success('vertex-diagonal',square,[[-1,-1,5,5]])
    success('point-tangent',square,[[-1,1,1,-1]],0)
    success('zero-length',square,[[2,2,2,2]],0)
    success('empty-sources',square,[],0)
    success('inside',square,[[1,1,3,3]],1)
    success('concave-split',notch,[[-1,4,7,4]],2)
    success('reversed-winding',notch[::-1],[[-1,4,7,4]],2)
    success('reversed-source',notch,[[7,4,-1,4]],2)
    success('collinear-floor',notch,[[-1,2,7,2]],1)
    success('source-identity',notch,[[8,8,9,9],[-1,4,7,4],[1,1,1,1],[1,1,5,1]],3)
    success('straight-vertex',[[0,0],[2,0],[4,0],[4,4],[0,4]],[[-1,2,5,2]])
    for exponent in (-1000,900):
        factor=F(2)**exponent
        success('scale-'+str(exponent),[[float(F(x)*factor) for x in p] for p in square],[[float(F(x)*factor) for x in [-1,2,5,2]]])
    def error(name,value,code,detail=None):
        row=dict(id=name,input=value,error=code)
        if detail is not None:row['error_detail']=detail
        cases.append(row)
    base=copy.deepcopy(cases[0]['input'])
    x=copy.deepcopy(base);x['maxWork']-=1;error('work-minus-one',x,'WORK_LIMIT_EXCEEDED')
    x=copy.deepcopy(base);x['maxOutputSegments']=0;error('output-zero',x,'OUTPUT_LIMIT_EXCEEDED',dict(sourceIndex=0,intervalIndex=0))
    x=copy.deepcopy(cases[8]['input']);x['maxOutputSegments']=1;error('split-output-one',x,'OUTPUT_LIMIT_EXCEEDED',dict(sourceIndex=0,intervalIndex=1))
    for name,p in [('bow-tie',[[0,0],[4,4],[0,4],[4,0]]),('nonzero-crossing',[[0,0],[5,4],[0,4],[4,0]]),('edge-touch',[[0,0],[4,0],[4,4],[2,0],[0,4]]),('backtrack',[[0,0],[4,0],[2,0],[4,4],[0,4]]),('repeated-closure',square+[square[0]])]:
        error(name,dict(polygon=p,segments=[],maxWork=charge(len(p),0),maxOutputSegments=0),'INVALID_POLYGON')
    x=copy.deepcopy(base);x['maxWork']=0;x['segments'].append([0,0,True,1]);error('late-invalid-before-work',x,'INVALID_INPUT')
    x=copy.deepcopy(base);x['extra']=1;error('extra-key',x,'INVALID_INPUT')
    x=copy.deepcopy(base);del x['maxWork'];error('missing-work',x,'INVALID_INPUT')
    x=copy.deepcopy(base);x['maxOutputSegments']=False;error('boolean-limit',x,'INVALID_INPUT')
    tiny=float.fromhex('0x0.0000000000001p-1022')
    for name,p,stage in [('interval-collapse',[[0,0],[tiny,0],[tiny,1],[0,1]],'parameter'),('gap-collapse',[[-1,-1],[1,-1],[1,1],[tiny,1],[tiny,0],[0,0],[0,1],[-1,1]],'gap')]:
        error(name,dict(polygon=p,segments=[[-1,.5,1,.5]],maxWork=charge(len(p),1),maxOutputSegments=2),'REPRESENTATION_COLLAPSE',dict(sourceIndex=0,intervalIndex=0 if stage=='parameter' else 1,stage=stage))
    triangle=[[0,0],[tiny,0],[0,tiny]]
    collapse=dict(polygon=triangle,segments=[[0,0,tiny,tiny]],maxWork=charge(3,1),maxOutputSegments=1)
    error('endpoint-collapse',collapse,'REPRESENTATION_COLLAPSE',dict(sourceIndex=0,intervalIndex=0,stage='endpoints'))
    x=copy.deepcopy(collapse);x['maxOutputSegments']=0
    error('output-before-endpoint-collapse',x,'OUTPUT_LIMIT_EXCEEDED',dict(sourceIndex=0,intervalIndex=0))
    x=dict(polygon=[[0,0],[4,4],[0,4],[4,0]],segments=[],maxWork=0,maxOutputSegments=0)
    error('work-before-invalid-polygon',x,'WORK_LIMIT_EXCEEDED')
    x=copy.deepcopy(base);x['maxWork']=0;x['maxOutputSegments']=-1
    error('invalid-limit-before-work',x,'INVALID_INPUT')
    return dict(operation='geometry.clip-segments-simple-polygon-2d',version='0.1.0',fixture_status=json.loads(CATALOG.read_text())['status'],fixture_format='segment-clipping-output',catalog_sha256=digest(CATALOG),source_bindings={str(p.relative_to(ROOT)):digest(p) for p in [Path(__file__).resolve(),Path(__file__).with_name('exact_clip_study.py').resolve()]},cases=cases)


if __name__=='__main__':
    path=ROOT/'fixtures/operations/clip-segments-simple-polygon-2d.json'
    path.write_text(json.dumps(build(),indent=2,allow_nan=False)+'\n')
    print(f'Wrote {len(build()["cases"])} draft clipping fixtures')
