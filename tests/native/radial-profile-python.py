#!/usr/bin/env python3
"""Run frozen CP7 vectors plus retained Python access/ownership checks."""
from array import array
from hashlib import sha256
import argparse,json,math,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'packages/python'))
from procedurals.radial_profile import RadialProfile3D,RadialProfileError
SOURCE=ROOT/'packages/python/procedurals/radial_profile.py';FIXTURE=ROOT/'fixtures/operations/radial-profile-surface.json';CATALOG=ROOT/'catalog/operations/radial-profile-surface.json'
def digest(p):return sha256(p.read_bytes()).hexdigest()
def bits(x):return struct.pack('>d',float(x)).hex()
def caught(f):
 try:f()
 except RadialProfileError as e:return e
 except Exception as e:return type('E',(),{'code':'UNEXPECTED:'+type(e).__name__})()
def check(case,m):
 a=m.to_values();o=case['output'];assert set(a)=={'positions','triangles','normals','faceKinds','bands','cells'}
 for k in ('triangles','faceKinds','bands','cells'):assert a[k]==o[k],(case['id'],k)
 for k in ('positions','normals'):
  assert len(a[k])==len(o[k])
  for i,row in enumerate(a[k]):
   assert len(row)==3
   for j,v in enumerate(row):
    want=o[k][i][j];tol=case['comparison'][k+'_abs'][i][j];assert math.isfinite(v) and (v!=0 or bits(v)=='0000000000000000')
    if tol==0:assert bits(v)==want['bits_hex'],(case['id'],k,i,j)
    else:assert abs(v-want['value'])<=tol,(case['id'],k,i,j)
def valid():return {'profile':[[0,2],[1,.75],[3,2]],'slices':4,'capStart':True,'capEnd':True,'maxFaces':1000}
def native():
 m=RadialProfile3D.generate(valid());base=m.to_values();c=valid();m2=RadialProfile3D.generate(c);c['profile'][0][0]=99;c['profile'].clear();assert m2.to_values()==base
 assert not any(hasattr(m,name) for name in ('p','t','n','b','c'))
 assert m.vertex_at(0) is not m.vertex_at(0);x=m.vertex_at(0);x[0]=9;v=m.to_values();v['positions'][0][0]=9;assert m.to_values()==base
 for method,size in ((m.vertex_at,m.vertex_count()),(m.triangle_at,m.face_count()),(m.normal_at,m.face_count()),(m.face_kind_at,m.face_count()),(m.band_at,m.face_count()),(m.cell_at,m.face_count())):
  for x in (-1,True,.5,math.nan,math.inf,'0'):assert caught(lambda method=method,x=x:method(x)).code=='INVALID_INDEX'
  assert caught(lambda method=method,size=size:method(size)).code=='INDEX_OUT_OF_RANGE'
 for method,out in ((m.vertex_into,array('d',[9]*6)),(m.normal_into,[9.]*6),(m.triangle_into,[9]*6)):
  before=list(out);assert method(0,out,2)is None;assert list(out)[2:5]==(m.vertex_at(0) if method==m.vertex_into else m.normal_at(0) if method==m.normal_into else m.triangle_at(0));assert list(out)[:2]+list(out)[5:]==before[:2]+before[5:]
 for method in (m.vertex_into,m.normal_into,m.triangle_into):
  out=[9,9,9,9];before=out.copy();assert caught(lambda:method(-1,out,-1)).code=='INVALID_INDEX';assert out==before;assert caught(lambda:method(0,None,0)).code=='INVALID_OUTPUT';assert out==before
  for out in ((9,9,9),array('f',[9,9,9]),array('i',[9,9,9]) if method!=m.triangle_into else array('d',[9,9,9]),[9]):assert caught(lambda out=out:method(0,out,0)).code=='INVALID_OUTPUT'
 for x in (math.nan,math.inf,-math.inf,True,'0',complex(0)):
  q=valid();q['slices']=x;assert caught(lambda q=q:RadialProfile3D.generate(q)).code=='INVALID_INPUT'
 z=RadialProfile3D.generate({'profile':[[-0.,-0.],[1,1]],'slices':3,'capStart':True,'capEnd':False,'maxFaces':100});assert all(not (v==0 and math.copysign(1,v)<0) for row in z.to_values()['positions']+z.to_values()['normals'] for v in row)
def additional_access_checks():
 m=RadialProfile3D.generate(valid())
 class CustomList(list):pass
 class CustomDict(dict):pass
 for config in (CustomDict(valid()), {**valid(),'profile':CustomList(valid()['profile'])}, {**valid(),'profile':[CustomList([0,1]),[1,1]]}):
  assert caught(lambda config=config:RadialProfile3D.generate(config)).code=='INVALID_INPUT'
 for method in (m.vertex_into,m.normal_into,m.triangle_into):
  for out in (array('i',[9,9,9]),CustomList([9,9,9])):
   before=list(out);assert caught(lambda:method(0,out,0)).code=='INVALID_OUTPUT';assert list(out)==before
  out=[9,9,9]
  size=m.vertex_count() if method==m.vertex_into else m.face_count()
  assert caught(lambda:method(size,None,-1)).code=='INDEX_OUT_OF_RANGE'
  assert caught(lambda:method(9007199254740992,out,0)).code=='INVALID_INDEX';assert out==[9,9,9]
  for offset in (True,-1,.5,float('inf'),9007199254740992):
   assert caught(lambda:method(0,out,offset)).code=='INVALID_OUTPUT';assert out==[9,9,9]
 for method,key in ((m.vertex_at,'positions'),(m.triangle_at,'triangles'),(m.normal_at,'normals'),(m.face_kind_at,'faceKinds'),(m.band_at,'bands'),(m.cell_at,'cells')):
  expected=m.to_values()[key]
  assert [method(float(i)) for i in range(len(expected))]==expected

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();out=a.output.resolve();assert out.is_relative_to((ROOT/'.work').resolve()) and not out.exists()
 f=json.loads(FIXTURE.read_text());assert f['catalog_sha256']==digest(CATALOG);inputs=(SOURCE,Path(__file__).resolve(),FIXTURE,CATALOG);before={str(x.relative_to(ROOT)):digest(x) for x in inputs}
 for case in f['cases']:
  if 'error'in case:
   e=caught(lambda case=case:RadialProfile3D.generate(case['input']));assert e.code==case['error'],case['id']
   if 'error_detail'in case:assert {'faceIndex':e.face_index,'stage':e.stage}==case['error_detail'],case['id']
  else:
   m=RadialProfile3D.generate(case['input']);check(case,m);r=RadialProfile3D.generate(case['input']);assert [[bits(x) for x in q] for q in m.to_values()['positions']+m.to_values()['normals']]==[[bits(x) for x in q] for q in r.to_values()['positions']+r.to_values()['normals']]
 native();additional_access_checks();after={str(x.relative_to(ROOT)):digest(x) for x in inputs};assert before==after;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'status':'passed','fixture_cases':len(f['cases']),'source_sha256_before':before,'source_sha256_after':after},indent=2)+'\n');print(json.dumps({'status':'passed','fixture_cases':len(f['cases']),'output':str(out)}))
if __name__=='__main__':main()
