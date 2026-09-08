#!/usr/bin/env python3
"""Private revision: common-edge versus independently scaled-edge unit normals."""
from __future__ import annotations
import hashlib,json,math,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DUMP=ROOT/'.work/cp7-profile-choices/mesh-dump.json'; MEMO=ROOT/'design/operations/cp7-mesh-numeric-cases.md'; OUT=ROOT/'evidence/investigations/cp7-normal-numeric-cases-v2.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bits(x):return struct.pack('>d',x).hex()
def scalar(x):return {'value':x,'bits_hex':bits(x)} if math.isfinite(x) else {'nonfinite':'NaN' if math.isnan(x) else ('+Infinity' if x>0 else '-Infinity'),'bits_hex':bits(x)}
def vec(v):return [scalar(x) for x in v]
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def cross(u,v):return (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
def ordered_norm(v):return math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2])
def unit_direct(u,v):
 n=cross(u,v); q=ordered_norm(n)
 return {'cross':vec(n),'length':scalar(q),'unit':vec(tuple(x/q for x in n)) if math.isfinite(q) and q else None}
def unit_common(u,v):
 scale=max(abs(x) for x in u+v)
 if not math.isfinite(scale) or scale==0:return {'reject':'nonfinite-or-zero-edge-scale','scale':scalar(scale)}
 return normalize_cross(cross(tuple(x/scale for x in u),tuple(x/scale for x in v)))|{'scale':scalar(scale)}
def normalize_cross(n):
 maximum=max(abs(x) for x in n)
 if not math.isfinite(maximum) or maximum==0:return {'reject':'zero-or-nonfinite-rounded-cross','cross':vec(n),'cross_max':scalar(maximum)}
 scaled=tuple(x/maximum for x in n); length=ordered_norm(scaled)
 if not math.isfinite(length) or length==0:return {'reject':'scaled-cross-norm','cross':vec(n),'cross_max':scalar(maximum)}
 return {'cross':vec(n),'cross_max':scalar(maximum),'rescaled_length':scalar(length),'unit':vec(tuple(x/length for x in scaled))}
def unit_per_edge(u,v):
 su=max(abs(x) for x in u); sv=max(abs(x) for x in v)
 if not math.isfinite(su) or not math.isfinite(sv) or su==0 or sv==0:return {'reject':'nonfinite-or-zero-edge','u_scale':scalar(su),'v_scale':scalar(sv)}
 result=normalize_cross(cross(tuple(x/su for x in u),tuple(x/sv for x in v)));result['u_scale']=scalar(su);result['v_scale']=scalar(sv);return result
def case(identifier,u,v):return {'id':identifier,'u':vec(u),'v':vec(v),'direct_cross_sqrt':unit_direct(u,v),'common_edge_scale':unit_common(u,v),'independent_edge_scale':unit_per_edge(u,v)}
def case_points(identifier,a,b,c):
 u,v=sub(b,a),sub(c,a); result=case(identifier,u,v); result['finite_triangle_inputs']=[vec(p) for p in (a,b,c)]; return result
def mesh_comparison():
 raw=json.loads(DUMP.read_text());records=[];all_delta=[];all_norm=[]
 for mesh in raw['meshes']:
  positions=[tuple(float(x) for x in p) for p in mesh['positions']]
  maximum=0.;minimum=math.inf;count=0
  for face in mesh['faces']:
   a,b,c=(positions[i] for i in face['indices']);u,v=sub(b,a),sub(c,a);direct=unit_direct(u,v);per=unit_per_edge(u,v)
   if direct['unit'] is None or per.get('unit') is None:raise AssertionError('moderate mesh normal rejected '+mesh['id'])
   d=max(abs(x['value']-y['value']) for x,y in zip(direct['unit'],per['unit']));maximum=max(maximum,d);all_delta.append(d)
   n=ordered_norm(cross(u,v));minimum=min(minimum,n);all_norm.append(n);count+=1
  records.append({'id':mesh['id'],'faces':count,'max_unit_component_abs':maximum,'min_direct_cross_norm':minimum})
 return records,max(all_delta),min(all_norm)
def main():
 cases=[
  case('ordinary',(1.,0.,0.),(0.,1.,1.)),
  case('large-cross-overflow',(1e200,0.,0.),(0.,1e200,0.)),
  case('high-aspect-common-scale-loses-v',(1e200,0.,0.),(0.,1e-200,0.)),
  case_points('finite-endpoint-subtraction-overflow',(-1e308,0.,0.),(1e308,0.,0.),(-1e308,1.,0.)),
  case('subnormal-cross-direct-norm-underflow',(1.,1e-320,0.),(1.,0.,0.)),
  case('nearparallel-peredge-component-lost',(1e200,1e-200,0.),(1e200,0.,0.)),
  case('zero-edge',(0.,0.,0.),(1.,0.,0.)),
 ]
 meshes,max_delta,min_norm=mesh_comparison()
 report={'status':'observational','scope':'Private CP7 numerical comparison only; no public contract, validation precedence, parameter bound, renderer, or cross-target claim.','source_bindings':{str(DUMP.relative_to(ROOT)):sha(DUMP),str(MEMO.relative_to(ROOT)):sha(MEMO),str(Path(__file__).relative_to(ROOT)):sha(Path(__file__))},'cases':cases,'dumped_mesh_comparison':{'meshes':meshes,'maximum_unit_component_abs':max_delta,'minimum_direct_cross_norm':min_norm},'limitations':'Per-edge scaling preserves some high-aspect and subnormal directions but cannot repair nonfinite input edges or a zero rounded cross. It can discard a perpendicular component when its ratio to an edge maximum underflows during that edge normalization. Observations use this Python binary64 host only.','runtime':sys.version}
 OUT.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'cases':len(cases),'mesh_max_deviation':max_delta,'report':str(OUT)}))
if __name__=='__main__':main()
