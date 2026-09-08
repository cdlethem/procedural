#!/usr/bin/env python3
"""Private CP7 binary64 triangle-normal arithmetic observations; no mesh API claim."""
from __future__ import annotations
import hashlib, json, math, struct, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DIRECTION=ROOT/'design/capabilities/cp7-profile-selection.md'
OUT=ROOT/'evidence/investigations/cp7-normal-numeric-cases.json'

def bits(x): return struct.pack('>d',x).hex()
def scalar(x):
    return {'value':x,'bits_hex':bits(x)} if math.isfinite(x) else {'nonfinite':'NaN' if math.isnan(x) else ('+Infinity' if x>0 else '-Infinity'),'bits_hex':bits(x)}
def vec_record(v): return [scalar(x) for x in v]
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def cross(u,v): return (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
def direct(a,b,c):
    u,v=sub(b,a),sub(c,a); n=cross(u,v); q=n[0]*n[0]+n[1]*n[1]+n[2]*n[2]
    length=math.sqrt(q)
    return {'edges':vec_record(u)+vec_record(v),'cross':vec_record(n),'norm_square':scalar(q),'length':scalar(length),'unit':vec_record(tuple(x/length for x in n)) if math.isfinite(length) and length else None}
def scaled(a,b,c):
    u,v=sub(b,a),sub(c,a); scale=max(abs(x) for x in u+v)
    if not math.isfinite(scale) or scale==0: return {'scale':scalar(scale),'unit':None,'failure':'edge subtraction nonfinite or collapsed'}
    n=cross(tuple(x/scale for x in u),tuple(x/scale for x in v)); length=math.hypot(*n)
    return {'scale':scalar(scale),'scaled_cross':vec_record(n),'scaled_length':{'value':length,'bits_hex':bits(length)},'unit':vec_record(tuple(x/length for x in n)) if math.isfinite(length) and length else None}
def finite_values(obj):
    if isinstance(obj,dict): return all(finite_values(x) for x in obj.values())
    if isinstance(obj,list): return all(finite_values(x) for x in obj)
    return not isinstance(obj,float) or math.isfinite(obj)
def point_collapse():
    r=math.nextafter(0.0,1.0); points=[]
    for j in range(16):
        t=2*math.pi*j/16; points.append((r*math.cos(t),r*math.sin(t),0.0))
    duplicates=[]
    for i in range(len(points)):
        for j in range(i):
            if points[i]==points[j]: duplicates.append([j,i])
    return {'radius':scalar(r),'slices':16,'positions':[vec_record(p) for p in points],'duplicate_index_pairs':duplicates}
def main():
    m=math.nextafter(0.0,1.0)
    cases=[
      ('ordinary',(0.,0.,0.),(1.,0.,0.),(0.,1.,1.)),
      ('large-cross-overflow',(0.,0.,0.),(1e200,0.,0.),(0.,1e200,0.)),
      ('edge-subtraction-overflow',(-1e308,0.,0.),(1e308,0.,0.),(0.,1.,0.)),
      ('cross-underflow',(0.,0.,0.),(1e-200,0.,0.),(0.,1e-200,0.)),
      ('norm-square-overflow',(0.,0.,0.),(1e154,0.,0.),(0.,1e154,0.)),
      ('subnormal-profile-triangle',(m,0.,0.),(0.,m,0.),(0.,0.,m)),
      ('thin-finite-height',(0.,0.,0.),(1.,0.,0.),(0.,1.,m)),
      ('opposite-axial-extremes',(1.,0.,-1e308),(0.,1.,1e308),(-1.,0.,0.)),
    ]
    rows=[]
    for ident,a,b,c in cases:
        try: raw=direct(a,b,c)
        except (OverflowError,ValueError,ZeroDivisionError) as error: raw={'exception':type(error).__name__}
        try: robust=scaled(a,b,c)
        except (OverflowError,ValueError,ZeroDivisionError) as error: robust={'exception':type(error).__name__}
        rows.append({'id':ident,'triangle':[vec_record(p) for p in (a,b,c)],'ordinary_edge_cross_sqrt':raw,'scaled_edges_hypot_normalization':robust})
    collapse=point_collapse()
    report={'status':'observational','scope':'Private Python binary64 arithmetic witnesses only; no proposed public validation policy, bounds, signature, target-port, or renderer claim.','source_bindings':{str(DIRECTION.relative_to(ROOT)):hashlib.sha256(DIRECTION.read_bytes()).hexdigest(),str(Path(__file__).relative_to(ROOT)):hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},'point_generation_collapse':collapse,'cases':rows,'runtime':sys.version,'limitations':'Python float/math.hypot observations on this host. They expose concrete finite-intermediate failures and do not prove a complete all-finite normal algorithm or cross-target equivalence.'}
    OUT.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'cases':len(rows),'collapse_pairs':collapse['duplicate_index_pairs'],'report':str(OUT)}))
if __name__=='__main__':main()
