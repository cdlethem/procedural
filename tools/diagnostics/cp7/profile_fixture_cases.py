#!/usr/bin/env python3
"""Private draft CP7 fixture oracle; no catalog or shared fixture writes."""
from __future__ import annotations
import hashlib,json,math,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'.work/cp7-contract/fixture-cases.json'; DECISIONS=ROOT/'design/operations/cp7-profile-contract-decisions.md'
MAX=715827881
def bits(x):return struct.pack('>d',x).hex()
def zero(x):return 0.0 if x==0 else x
def record(v):return {'value':v,'bits_hex':bits(v)}
def fail(code,detail=None): raise ValueError((code,detail))
def number(value):
 if type(value) not in (int,float):fail('INVALID_INPUT')
 try:value=float(value)
 except OverflowError:fail('INVALID_INPUT')
 if not math.isfinite(value):fail('INVALID_INPUT')
 return zero(value)
def normal(a,b,c,index):
 u=[];v=[]
 for x,y in zip(b,a):
  q=x-y
  if not math.isfinite(q):fail('MESH_ARITHMETIC_INVALID',{'faceIndex':index,'stage':'edge'})
  u.append(q)
 for x,y in zip(c,a):
  q=x-y
  if not math.isfinite(q):fail('MESH_ARITHMETIC_INVALID',{'faceIndex':index,'stage':'edge'})
  v.append(q)
 su=max(abs(x) for x in u);sv=max(abs(x) for x in v)
 if su==0 or sv==0:fail('MESH_ARITHMETIC_INVALID',{'faceIndex':index,'stage':'edge_scale'})
 u=[x/su for x in u];v=[x/sv for x in v]
 n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];sn=max(abs(x) for x in n)
 if sn==0:fail('MESH_ARITHMETIC_INVALID',{'faceIndex':index,'stage':'cross_scale'})
 q=[x/sn for x in n];length=math.sqrt((q[0]*q[0]+q[1]*q[1])+q[2]*q[2]);return [zero(x/length) for x in q]
def validate(x):
 if type(x) is not dict or set(x)!={'profile','slices','capStart','capEnd','maxFaces'}:fail('INVALID_INPUT')
 p=x['profile'];s=x['slices']
 if type(p) is not list or not 2<=len(p)<=2147483647:fail('INVALID_INPUT')
 rings=[];poles=0
 for i,row in enumerate(p):
  if type(row) is not list or len(row)!=2:fail('INVALID_INPUT')
  z=number(row[0]);r=number(row[1])
  if i and not rings[-1][0]<z:fail('INVALID_INPUT')
  if r<0 or (0<i<len(p)-1 and r<=0):fail('INVALID_INPUT')
  if r==0:poles+=1
  rings.append((z,r))
 if poles==2 and len(p)==2:fail('INVALID_INPUT')
 s=number(s)
 if not s.is_integer() or not 3<=s<=MAX:fail('INVALID_INPUT')
 s=int(s)
 if type(x['capStart']) is not bool or type(x['capEnd']) is not bool:fail('INVALID_INPUT')
 budget=number(x['maxFaces'])
 if not budget.is_integer() or not 1<=budget<=MAX:fail('INVALID_INPUT')
 zcount=(rings[0][1]==0)+(rings[-1][1]==0);c=(x['capStart'] and rings[0][1]>0)+(x['capEnd'] and rings[-1][1]>0);f=s*(2*(len(rings)-1)-zcount+c)
 if f>budget:fail('FACE_LIMIT_EXCEEDED')
 return rings,s,bool(x['capStart']),bool(x['capEnd'])
def run(x):
 rings,s,start,end=validate(x);verts=[];ref=[];faces=[]
 for z,r in rings:
  if r==0:ref.append(len(verts));verts.append((0.,0.,z))
  else:
   ids=[]
   for cell in range(s):
    t=(6.283185307179586*cell)/s;ids.append(len(verts));verts.append((zero(r*math.cos(t)),zero(r*math.sin(t)),z))
   ref.append(ids)
 for band in range(len(rings)-1):
  low,high=ref[band],ref[band+1]
  for cell in range(s):
   nxt=(cell+1)%s
   if isinstance(low,list) and isinstance(high,list):faces += [(low[cell],low[nxt],high[nxt],'side',band,cell),(low[cell],high[nxt],high[cell],'side',band,cell)]
   elif not isinstance(low,list):faces.append((low,high[nxt],high[cell],'side',band,cell))
   else:faces.append((low[cell],low[nxt],high,'side',band,cell))
 if start and isinstance(ref[0],list):
  center=len(verts);verts.append((0.,0.,rings[0][0]));faces += [(center,ref[0][(c+1)%s],ref[0][c],'start-cap',-1,c) for c in range(s)]
 if end and isinstance(ref[-1],list):
  center=len(verts);verts.append((0.,0.,rings[-1][0]));faces += [(center,ref[-1][c],ref[-1][(c+1)%s],'end-cap',-1,c) for c in range(s)]
 normals=[]
 for i,(a,b,c,kind,band,cell) in enumerate(faces):normals.append(normal(verts[a],verts[b],verts[c],i))
 return {'positions':[[record(q) for q in p] for p in verts],'triangles':[[a,b,c] for a,b,c,_,_,_ in faces],'normals':[[record(q) for q in n] for n in normals],'faceKinds':[k for *_,k,_,_ in faces],'bands':[b for *_,b,_ in faces],'cells':[c for *_,c in faces]}
def cfg(profile,s=3,a=False,b=False,m=1000):return {'profile':profile,'slices':s,'capStart':a,'capEnd':b,'maxFaces':m}
def build_cases():
 successes=[('cylinder-open',cfg([[0,2],[3,2]],3)),('cylinder-start',cfg([[0,2],[3,2]],3,True)),('cylinder-end',cfg([[0,2],[3,2]],3,False,True)),('cylinder-both',cfg([[0,2],[3,2]],3,True,True)),('waist',cfg([[0,2],[1,.75],[3,2]],4,True,True)),('frustum',cfg([[0,1],[3,2]],3,True,True)),('start-pole-flags-ignored',cfg([[0,0],[3,2]],4,True,True)),('end-pole-flags-ignored',cfg([[0,2],[3,0]],3,True,True)),('both-poles',cfg([[0,0],[1,2],[3,0]],3,True,True)),('large-scale',cfg([[0,1e200],[1e200,1e200]],3)),('small-scale',cfg([[0,1e-200],[1e-200,1e-200]],3)),('cap-closed-frustum',cfg([[0,3],[2,1]],4,True,False))]
 errors=[('malformed',{'profile':[],'slices':3,'capStart':False,'capEnd':False,'maxFaces':1}),('disordered',cfg([[1,1],[0,1]])),('negative-radius',cfg([[0,-1],[1,1]])),('interior-zero',cfg([[0,1],[1,0],[2,1]])),('two-poles',cfg([[0,0],[1,0]])),('boolean-slices',cfg([[0,1],[1,1]],True)),('maxfaces-invalid',cfg([[0,1],[1,1]],3,False,False,-1)),('face-limit-before-edge',cfg([[-1e308,1],[1e308,1]],3,False,False,1)),('edge-overflow',cfg([[-1e308,1],[1e308,1]],3)),('edge-scale-min-radius',cfg([[0,math.nextafter(0.,1.)],[1,math.nextafter(0.,1.)]],16)),('cross-scale-thin-z',cfg([[0,1e200],[math.nextafter(0.,1.),1e200]],4))]
 minimum=math.nextafter(0.,1.)
 successes.extend([
  ('subnormal-direct-division',cfg([[0,minimum],[minimum,minimum]],4)),
  ('negative-zero-and-integral-floats',cfg([[-0.,2.], [3.,2.]],3.0,False,False,6.0)),
  ('exact-capacity',cfg([[0,2],[3,2]],3,True,True,12)),
  ('start-pole-open',cfg([[0,0],[3,2]],4,False,False)),
  ('end-pole-open',cfg([[0,2],[3,0]],4,False,False)),
  ('start-pole-ignored-only',cfg([[0,0],[3,2]],4,True,False)),
  ('start-pole-positive-cap-only',cfg([[0,0],[3,2]],4,False,True)),
  ('end-pole-positive-cap-only',cfg([[0,2],[3,0]],3,True,False)),
  ('end-pole-ignored-only',cfg([[0,2],[3,0]],3,False,True)),
  ('both-poles-no-flags',cfg([[0,0],[1,2],[3,0]],3,False,False)),
  ('both-poles-start-flag',cfg([[0,0],[1,2],[3,0]],3,True,False)),
  ('both-poles-end-flag',cfg([[0,0],[1,2],[3,0]],3,False,True)),
 ])
 errors.extend([
  ('zero-budget-static',cfg([[0,1],[1,1]],3,False,False,0)),
  ('fractional-slices',cfg([[0,1],[1,1]],3.5)),
  ('slice-ceiling',cfg([[0,1],[1,1]],MAX+1)),
  ('face-ceiling',cfg([[0,1],[1,1]],3,False,False,MAX+1)),
  ('numeric-cap',cfg([[0,1],[1,1]],3,1,False)),
  ('duplicate-z',cfg([[0,1],[0,1]])),
  ('static-before-capacity',cfg([[0,1],[1,-1]],3,False,False,1)),
  ('one-below-capacity',cfg([[0,2],[3,2]],3,True,True,11)),
 ])
 expected_dynamic={'edge-overflow':'edge','edge-scale-min-radius':'edge_scale','cross-scale-thin-z':'cross_scale'}
 expected_capacity={'face-limit-before-edge','one-below-capacity'}
 cases=[]
 for ident,x in successes:
  try:cases.append({'id':ident,'input':x,'output':run(x)})
  except ValueError as e:cases.append({'id':ident,'input':x,'unexpected_error':e.args[0]})
 for ident,x in errors:
  try:cases.append({'id':ident,'input':x,'unexpected_output':run(x)})
  except ValueError as e:
   code,detail=e.args[0];entry={'id':ident,'input':x,'error':code}
   if detail is not None:entry['error_detail']=detail
   cases.append(entry)
 for case in cases:
  if 'unexpected_error' in case or 'unexpected_output' in case:
   raise AssertionError(('unexpected outcome',case['id']))
  if 'error' in case:
   ident=case['id']
   expected='MESH_ARITHMETIC_INVALID' if ident in expected_dynamic else ('FACE_LIMIT_EXCEEDED' if ident in expected_capacity else 'INVALID_INPUT')
   assert case['error']==expected,(ident,case['error'],expected)
   if ident in expected_dynamic:
    assert case.get('error_detail')=={'faceIndex':0,'stage':expected_dynamic[ident]}
   else:assert 'error_detail' not in case
 return cases

def main():
 cases=build_cases()
 out={'status':'draft-oracle-observation','scope':'Private candidate fixture output only; no catalog/shared fixture/portable implementation claim.','source_bindings':{str(DECISIONS.relative_to(ROOT)):hashlib.sha256(DECISIONS.read_bytes()).hexdigest(),str(Path(__file__).relative_to(ROOT)):hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},'cases':cases}
 OUT.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n');print(json.dumps({'successes':sum('output' in c for c in cases),'errors':sum('error' in c for c in cases),'report':str(OUT)}))
if __name__=='__main__':main()
