#!/usr/bin/env python3
"""Private deterministic perturbation checks for the CP7 draft trig intervals."""
from __future__ import annotations
import hashlib, importlib.util, json, math, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
CASES=ROOT/'.work/cp7-contract/fixture-cases.json'; INTERVALS=ROOT/'tools/diagnostics/cp7/profile_intervals.py'; OUT=ROOT/'.work/cp7-contract/enclosure-perturbations.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load():
 spec=importlib.util.spec_from_file_location('cp7_intervals_enclosure',INTERVALS); module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module);return module
def perturb_positions(module, profile, slices, start, end, pattern):
 values=[]
 for z,r in profile:
  if r==0.0:values.append((0.0,0.0,z));continue
  for cell in range(slices):
   cosine,sine,ci,si=module.trig(cell,slices)
   if pattern=='lower':cx,sy=ci.lo,si.lo
   elif pattern=='upper':cx,sy=ci.hi,si.hi
   elif pattern=='mixed':cx,sy=ci.lo,si.hi
   elif pattern=='mixed-reverse':cx,sy=ci.hi,si.lo
   else:
    cx=ci.lo if cell%2==0 else ci.hi; sy=si.hi if cell%2==0 else si.lo
   values.append((0.0 if r*cx==0 else r*cx,0.0 if r*sy==0 else r*sy,z))
 if start and profile[0][1]>0:values.append((0.0,0.0,profile[0][0]))
 if end and profile[-1][1]>0:values.append((0.0,0.0,profile[-1][0]))
 return values
def inside(value, interval):return interval.lo<=value<=interval.hi
def main():
 m=load(); data=json.loads(CASES.read_text()); records=[]; failures=[]; patterns=('lower','upper','mixed','mixed-reverse','alternating')
 for case in data['cases']:
  if 'output' not in case:continue
  inp=case['input']; profile=[(float(z),float(r)) for z,r in inp['profile']];slices=int(inp['slices']);start=inp['capStart'];end=inp['capEnd']
  vertices,triangles=m.mesh(profile,slices,start,end); output=case['output']
  expected_triangles=[list(t.indices) for t in triangles];expected_kinds=[t.kind for t in triangles];expected_bands=[t.band for t in triangles];expected_cells=[t.cell for t in triangles]
  topology_ok=(output['triangles']==expected_triangles and output['faceKinds']==expected_kinds and output['bands']==expected_bands and output['cells']==expected_cells)
  if not topology_ok:failures.append({'id':case['id'],'pattern':'reference','failure':'topology correspondence'})
  stats=[]
  for pattern in patterns:
   positions=perturb_positions(m,profile,slices,start,end,pattern); bad=[];normal_bad=[]
   if len(positions)!=len(vertices):bad.append('vertex count')
   for vi,(point,vertex) in enumerate(zip(positions,vertices)):
    for axis,(value,interval) in enumerate(zip(point,vertex.interval)):
     if not inside(value,interval):bad.append('position %d/%d'%(vi,axis))
   for fi,triangle in enumerate(triangles):
    try:
     seen=m.raw_normal(*(positions[index] for index in triangle.indices)); enclosure=m.interval_normal(*(vertices[index].interval for index in triangle.indices))
     for axis,(value,interval) in enumerate(zip(seen,enclosure)):
      if not inside(value,interval):normal_bad.append('normal %d/%d'%(fi,axis))
    except (ArithmeticError,ValueError,OverflowError) as error:normal_bad.append('normal %d exception %s'%(fi,error))
   status='bounded' if topology_ok and not bad and not normal_bad else 'failed'
   row={'pattern':pattern,'status':status,'position_failures':bad[:8],'normal_failures':normal_bad[:8],'position_failure_count':len(bad),'normal_failure_count':len(normal_bad)}
   stats.append(row)
   if status!='bounded':failures.append({'id':case['id'],**row})
  records.append({'id':case['id'],'vertices':len(vertices),'faces':len(triangles),'topology_exact':topology_ok,'patterns':stats})
 report={'status':'passed' if not failures else 'failed','scope':'Private deterministic perturbation exercise of the draft two-adjacent-reference trig interval enclosure; no universal host-trig, portable conformance, or tolerance-expansion claim.','source_bindings':{str(CASES.relative_to(ROOT)):sha(CASES),str(INTERVALS.relative_to(ROOT)):sha(INTERVALS),str(Path(__file__).relative_to(ROOT)):sha(Path(__file__))},'patterns':'lower/upper apply both trig components; mixed and mixed-reverse apply opposite cosine/sine endpoints; alternating flips lower/upper by cell and component. Each perturbed position is recomputed directly from that selected trig endpoint and radius; no math monkeypatching.','records':records,'failure_count':len(failures),'failures':failures,'limitations':'This finite set exercises declared local reference envelopes only. It does not establish target sine/cosine inclusion, interval-method completeness, a general tolerance, or behavior for arithmetic-rejected cases.'}
 if not records:
  report['status']='failed';report['failures'].append({'failure':'no successful input cases'});report['failure_count']+=1
 OUT.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'status':report['status'],'cases':len(records),'failures':report['failure_count'],'report':str(OUT)}))
 if report['status']!='passed':raise SystemExit(1)
if __name__=='__main__':main()
