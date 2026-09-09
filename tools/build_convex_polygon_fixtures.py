#!/usr/bin/env python3
"""CP20 exact expectations using independent Fraction separating-axis projections."""
from fractions import Fraction as F
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'catalog/operations/ordered-convex-polygon-filter-2d.json'

def intersects(a, b):
    a, b = [[[F(float(x)), F(float(y))] for x, y in p] for p in (a, b)]
    # Convex closed regions are disjoint iff an edge normal strictly separates them.
    for polygon in (a, b):
        for i, (x, y) in enumerate(polygon):
            nx, ny = polygon[(i + 1) % len(polygon)]
            axis = (y - ny, nx - x)
            pa = [u * axis[0] + v * axis[1] for u, v in a]
            pb = [u * axis[0] + v * axis[1] for u, v in b]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return False
    return True

def expected(polygons):
    kept = []
    for i, polygon in enumerate(polygons):
        if not any(intersects(polygon, polygons[j]) for j in kept):
            kept.append(i)
    return {'attempts':len(polygons), 'polygons':[
        [[0 if float(v)==0 else float(v) for v in point] for point in polygons[i]] for i in kept],
        'sourceIndices':kept}

def rectangle(x, y, w, h):
    return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]

def main():
    catalog=json.loads(CATALOG.read_text()); cases=[]
    def good(name, polygons, indices):
        output=expected(polygons)
        assert output['sourceIndices']==indices, name
        cases.append({'id':name,'input':{'polygons':polygons},'output':output})
    def bad(name, value, error='INVALID_INPUT', index=-1):
        cases.append({'id':name,'input':value,'error':error,'candidateIndex':index})
    a=rectangle(0,0,2,2); big=rectangle(-1,-1,4,4); separate=rectangle(5,0,2,2)
    good('empty',[],[])
    good('one',[a],[0])
    good('separated-collinear-edges',[a,separate],[0,1])
    good('small-inside-big',[big,a],[0])
    good('big-around-small',[a,big],[0])
    good('duplicate',[a,a],[0])
    good('opposite-winding-duplicate',[a,list(reversed(a))],[0])
    good('preserve-winding-start',[list(reversed(a[1:]+a[:1])),separate],[0,1])
    good('edge-touch',[a,rectangle(2,0,2,2)],[0])
    good('vertex-touch',[a,rectangle(2,2,2,2)],[0])
    good('thin-crossing-no-contained-vertex',[rectangle(0,0,10,.125),rectangle(4,-1,1,3)],[0])
    chain=[rectangle(0,0,2,2),rectangle(1,0,2,2),rectangle(2.5,0,2,2)]
    good('greedy-source-indices',chain,[0,2])
    good('greedy-reordered',[chain[1],chain[0],chain[2]],[0])
    good('prefix',chain[:2],[0])
    good('negative-zero',[[[-0.0,-0.0],[1,-0.0],[-0.0,1]]],[0])
    tiny=math.ulp(0.0); huge=float.fromhex('0x1.fffffffffffffp1023')
    good('subnormal-contact',[[[0,0],[tiny,0],[0,tiny]],[[tiny,0],[tiny,tiny],[0,tiny]]],[0])
    good('subnormal-separated',[[[0,0],[tiny,0],[0,tiny]],[[3*tiny,0],[4*tiny,0],[3*tiny,tiny]]],[0,1])
    good('overflowing-difference-containment',[[[-huge,0],[huge,0],[0,huge]],[[0,1],[1,1],[0,2]]],[0])
    n=4503599627370496
    good('near-collinear-unit-determinant',[[[0,0],[n,n-1],[n+1,n]]],[0])
    bad('not-object',[]);bad('missing',{});bad('extra',{'polygons':[],'seed':42});bad('null',{'polygons':None})
    bad('polygon-null',{'polygons':[None]},index=0)
    bad('too-few-vertices',{'polygons':[[[0,0],[1,0]]]},index=0)
    bad('wrong-vertex-length',{'polygons':[[[0,0,1],[1,0],[0,1]]]},index=0)
    bad('boolean-coordinate',{'polygons':[[[True,0],[1,0],[0,1]]]},index=0)
    bad('string-coordinate',{'polygons':[[['0',0],[1,0],[0,1]]]},index=0)
    for name, polygon in [
        ('collinear',[[0,0],[1,0],[2,0]]),
        ('repeated-closing',a+[a[0]]),
        ('repeated-nonclosing',[[0,0],[1,0],[0,0],[0,1]]),
        ('concave',[[0,0],[3,0],[1,1],[0,3]]),
        ('bowtie',[[0,0],[2,2],[0,2],[2,0]]),
        ('consistent-turn-star',[[0,3],[1.76,-2.43],[-2.85,.93],[2.85,.93],[-1.76,-2.43]]),
    ]:bad(name,{'polygons':[polygon]},'INVALID_POLYGON',0)
    bad('late-invalid-even-if-contained',{'polygons':[big,[[0,0],[1,0],[2,0]]]},'INVALID_POLYGON',1)
    bad('shape-before-geometry',{'polygons':[[[0,0],[0,0],[None,1]]]},index=0)
    result={'operation':catalog['id'],'version':catalog['version'],'fixture_format':'exact-json-output','fixture_status':'reviewed','comparison':'exact','catalog_sha256':hashlib.sha256(CATALOG.read_bytes()).hexdigest(),'oracle':'tools/build_convex_polygon_fixtures.py: exact binary64 Fraction projections/separating axes, plus independently authored expected survivor indices and validation cases; no Java import.','cases':cases}
    (ROOT/catalog['fixtures']).write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')

if __name__=='__main__':main()
