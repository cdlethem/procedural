#!/usr/bin/env python3
"""Independent ordered-error evaluator for the draft clipping descriptor."""
from fractions import Fraction as F
from pathlib import Path
import json
import math
import sys
from jsonschema import Draft202012Validator
try:
    from tools.diagnostics.clipping.exact_clip_study import clip
    from tools.diagnostics.clipping.polygon_validation_study import valid
except ModuleNotFoundError:
    from exact_clip_study import clip
    from polygon_validation_study import valid

ROOT=Path(__file__).resolve().parents[3]


def evaluate(value,schema):
    if not Draft202012Validator(schema).is_valid(value):return 'INVALID_INPUT',None
    def finite(v):
        if isinstance(v,list):return all(finite(x) for x in v)
        return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
    if not finite(value['polygon']) or not finite(value['segments']):return 'INVALID_INPUT',None
    p,s=value['polygon'],value['segments'];v=len(p)
    cost=v*v+len(s)*(8*v*v+16*v+8)
    if cost>value['maxWork']:return 'WORK_LIMIT_EXCEEDED',None
    if not valid(p):return 'INVALID_POLYGON',None
    emitted=0
    for source,raw in enumerate(s):
        previous=None
        for ordinal,(lo,hi) in enumerate(clip(p,[raw[:2],raw[2:]])):
            detail=dict(sourceIndex=source,intervalIndex=ordinal)
            if emitted>=value['maxOutputSegments']:return 'OUTPUT_LIMIT_EXCEEDED',detail
            stage=None
            if float(lo)>=float(hi):stage='parameter'
            else:
                a=list(map(F,raw[:2]));d=[F(raw[i+2])-a[i] for i in (0,1)]
                start=[float(a[i]+d[i]*lo) for i in (0,1)]
                end=[float(a[i]+d[i]*hi) for i in (0,1)]
                if start==end:stage='endpoints'
                elif previous is not None and float(previous)>=float(lo):stage='gap'
            if stage:return 'REPRESENTATION_COLLAPSE',dict(detail,stage=stage)
            previous=hi;emitted+=1
    return None,None


def main():
    catalog=ROOT/'catalog/operations/clip-segments-simple-polygon-2d.json'
    fixture=ROOT/'fixtures/operations/clip-segments-simple-polygon-2d.json'
    schema=json.loads(catalog.read_text())['input_schema']
    cases=json.loads(fixture.read_text())['cases']
    for row in cases:
        actual=evaluate(row['input'],schema)
        expected=(row.get('error'),row.get('error_detail'))
        if actual!=expected:raise AssertionError((row['id'],expected,actual))
    print(f'{len(cases)} ordered success/error expectations verified with independent evaluator')


if __name__=='__main__':main()
