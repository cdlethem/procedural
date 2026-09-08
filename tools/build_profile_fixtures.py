#!/usr/bin/env python3
"""Generate CP7 shared contract fixtures; native validation remains separate."""
from __future__ import annotations
import argparse,hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ORACLE=ROOT/'tools/diagnostics/cp7/profile_fixture_cases.py'; INTERVALS=ROOT/'tools/diagnostics/cp7/profile_intervals.py'; POLICY=ROOT/'design/operations/cp7-profile-fixture-policy.md'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);return module
def main():
 p=argparse.ArgumentParser();p.add_argument('--catalog',type=Path,default=ROOT/'catalog/operations/radial-profile-surface.json');p.add_argument('--output',type=Path,default=ROOT/'fixtures/operations/radial-profile-surface.json');a=p.parse_args()
 if not a.catalog.is_file():raise RuntimeError('catalog missing: '+str(a.catalog))
 oracle=load('cp7_fixture_oracle',ORACLE); intervals=load('cp7_fixture_intervals',INTERVALS); cases=oracle.build_cases()
 # Do not treat the draft allowance JSON as authority: derive each selected allowance now.
 output=[]
 for case in cases:
  entry={'id':case['id'],'input':case['input']}
  if 'output' not in case:
   entry['error']=case['error'];
   if 'error_detail'in case:entry['error_detail']=case['error_detail']
  else:
   inp=case['input'];profile=[(float(z),float(r)) for z,r in inp['profile']];vertices,triangles=intervals.mesh(profile,int(float(inp['slices'])),inp['capStart'],inp['capEnd'])
   positions=[];normals=[]
   if len(vertices)!=len(case['output']['positions']) or len(triangles)!=len(case['output']['normals']):raise AssertionError('oracle/interval shape mismatch '+case['id'])
   if [list(t.indices) for t in triangles]!=case['output']['triangles']:raise AssertionError('oracle/interval topology mismatch '+case['id'])
   for vertex,row in zip(vertices,case['output']['positions']):
    if list(vertex.exact)!=[v['value'] for v in row]:raise AssertionError('oracle/interval position mismatch '+case['id'])
    positions.append([intervals.allowance(v['value'],box) for v,box in zip(row,vertex.interval)])
   for triangle,row in zip(triangles,case['output']['normals']):
    a0,b0,c0=(vertices[i] for i in triangle.indices);reference=intervals.raw_normal(a0.exact,b0.exact,c0.exact);box=intervals.interval_normal(a0.interval,b0.interval,c0.interval)
    if list(reference)!=[v['value'] for v in row]:raise AssertionError('oracle/interval normal mismatch '+case['id'])
    normals.append([intervals.allowance(v['value'],q) for v,q in zip(row,box)])
   if len(positions)!=len(case['output']['positions']) or len(normals)!=len(case['output']['normals']):raise AssertionError('oracle/interval shape mismatch '+case['id'])
   entry['output']=case['output'];entry['comparison']={'positions_abs':positions,'normals_abs':normals}
  output.append(entry)
 # Declarative relations compare recorded outputs, without regenerating geometry.
 by_id={case['id']:case for case in output}
 equal_pairs=[('start-pole-open','start-pole-ignored-only'),
              ('start-pole-flags-ignored','start-pole-positive-cap-only'),
              ('end-pole-flags-ignored','end-pole-positive-cap-only'),
              ('both-poles','both-poles-no-flags'),
              ('both-poles','both-poles-start-flag'),
              ('both-poles','both-poles-end-flag')]
 for left,right in equal_pairs:
  if by_id[left]['output']!=by_id[right]['output']:raise AssertionError('ignored pole flag changed geometry: '+left+'/'+right)
 base=by_id['cylinder-open']['output'];side_count=len(base['triangles'])
 for name in ('cylinder-start','cylinder-end','cylinder-both'):
  closed=by_id[name]['output']
  if closed['positions'][:len(base['positions'])]!=base['positions']:raise AssertionError('cap altered side positions')
  for field in ('triangles','normals','faceKinds','bands','cells'):
   if closed[field][:side_count]!=base[field]:raise AssertionError('cap altered side '+field)
 envelope={'operation':'mesh.radial-profile-surface-3d','version':'0.1.0','fixture_format':'radial-profile-surface-output','fixture_status':'reviewed' if json.loads(a.catalog.read_text()).get('status')=='reviewed' else 'review_pending','catalog_sha256':sha(a.catalog),'source_bindings':{str(ORACLE.relative_to(ROOT)):sha(ORACLE),str(INTERVALS.relative_to(ROOT)):sha(INTERVALS),str(POLICY.relative_to(ROOT)):sha(POLICY),str(Path(__file__).relative_to(ROOT)):sha(Path(__file__))},'cases':output}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(envelope,indent=2,sort_keys=True)+'\n');print(json.dumps({'cases':len(output),'successes':sum('output'in c for c in output),'errors':sum('error'in c for c in output),'output':str(a.output)}))
if __name__=='__main__':main()
