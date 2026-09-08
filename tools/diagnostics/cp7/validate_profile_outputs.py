#!/usr/bin/env python3
"""Independent private validator for CP7 draft plain observed outputs."""
from __future__ import annotations
import argparse,copy,hashlib,json,math,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; CASES=ROOT/'.work/cp7-contract/fixture-cases.json'; ALLOW=ROOT/'.work/cp7-contract/fixture-allowances.json'; REVIEW=ROOT/'design/operations/cp7-profile-fixture-policy.md'; DEFAULT=ROOT/'.work/cp7-contract/validator-review.json'
def bits(x):return struct.pack('>d',float(x)).hex()
def fail(message):raise AssertionError(message)
def finite_float(x,label):
 if type(x) not in (int,float):fail(label)
 try:value=float(x)
 except (OverflowError,ValueError):fail(label)
 if not math.isfinite(value):fail(label)
 return value
def scalar(observed,expected,allowance,label):
 value=finite_float(observed,label); target=float(expected['value'])
 if value==0.0 and bits(value)!='0000000000000000':fail(label+' canonical +0')
 if allowance<0:fail(label+' negative allowance')
 if allowance==0.0:
  if bits(value)!=expected['bits_hex']:fail(label+' exact bits')
 elif abs(value-target)>allowance:fail(label+' allowance')
def shape_list(value,length,label):
 if not isinstance(value,list) or len(value)!=length:fail(label+' shape')
def validate_success(observed,expected,allowance):
 keys={'positions','triangles','normals','faceKinds','bands','cells'}
 if not isinstance(observed,dict) or set(observed)!=keys:fail('success keys')
 if set(expected)!=keys:fail('draft expected keys')
 positions,normals=observed['positions'],observed['normals']; ep,en=expected['positions'],expected['normals']
 shape_list(positions,len(ep),'positions');shape_list(normals,len(en),'normals');shape_list(observed['triangles'],len(expected['triangles']),'triangles');shape_list(observed['faceKinds'],len(expected['faceKinds']),'kinds');shape_list(observed['bands'],len(expected['bands']),'bands');shape_list(observed['cells'],len(expected['cells']),'cells')
 if not isinstance(allowance,dict) or allowance.get('status')!='bounded':fail('missing allowances')
 shape_list(allowance.get('positions_abs'),len(ep),'position allowance rows')
 shape_list(allowance.get('normals_abs'),len(en),'normal allowance rows')
 for i,(row,target,row_allow) in enumerate(zip(positions,ep,allowance['positions_abs'])):
  shape_list(row,3,'position triple');shape_list(row_allow,3,'position allowance')
  for axis in range(3):scalar(row[axis],target[axis],finite_float(row_allow[axis],'position allowance'),f'position {i}/{axis}')
 for i,(row,target,row_allow) in enumerate(zip(normals,en,allowance['normals_abs'])):
  shape_list(row,3,'normal triple');shape_list(row_allow,3,'normal allowance')
  for axis in range(3):scalar(row[axis],target[axis],finite_float(row_allow[axis],'normal allowance'),f'normal {i}/{axis}')
 for i,(row,target) in enumerate(zip(observed['triangles'],expected['triangles'])):
  shape_list(row,3,'triangle triple')
  if any(type(v) is not int for v in row) or row!=target:fail('triangle exact '+str(i))
 for name in ('faceKinds','bands','cells'):
  for i,(value,target) in enumerate(zip(observed[name],expected[name])):
   if type(value) is bool or type(value) is not type(target) or value!=target:fail(name+' exact '+str(i))
def validate_error(observed,expected):
 keys={'error'}|({'error_detail'} if 'error_detail'in expected else set())
 if not isinstance(observed,dict) or set(observed)!=keys:fail('error keys')
 if observed.get('error')!=expected['error'] or not isinstance(observed['error'],str):fail('error code')
 if 'error_detail'in expected:
  detail=observed['error_detail']
  if type(detail) is not dict or set(detail)!={'faceIndex','stage'}:fail('error detail keys')
  if type(detail['faceIndex']) is not int or type(detail['stage']) is not str:fail('error detail types')
  if observed['error_detail']!=expected['error_detail']:fail('error detail')
def unwrap(output):
 return {'positions':[[x['value'] for x in row] for row in output['positions']],'triangles':copy.deepcopy(output['triangles']),'normals':[[x['value'] for x in row] for row in output['normals']],'faceKinds':copy.deepcopy(output['faceKinds']),'bands':copy.deepcopy(output['bands']),'cells':copy.deepcopy(output['cells'])}
def validate(observed,expected,allowance=None):
 if 'output'in expected:validate_success(observed,expected['output'],allowance)
 else:validate_error(observed,expected)
def rejected(name,action):
 try:action()
 except AssertionError as error:return {'id':name,'rejected':True,'reason':str(error)}
 raise AssertionError(name+' accepted')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=DEFAULT);args=parser.parse_args();draft=json.loads(CASES.read_text());allowances={x['id']:x for x in json.loads(ALLOW.read_text())['cases']};success=[c for c in draft['cases'] if 'output'in c];errors=[c for c in draft['cases'] if 'error'in c]
 for case in success:validate(unwrap(case['output']),case,allowances[case['id']])
 for case in errors:validate({'error':case['error'],**({'error_detail':copy.deepcopy(case['error_detail'])} if 'error_detail'in case else {})},case)
 base=success[0];observed=unwrap(base['output']);mutations=[]
 mutations.append(rejected('short-positions',lambda:validate({**observed,'positions':observed['positions'][:-1]},base,allowances[base['id']])))
 mutations.append(rejected('short-triangle',lambda:validate({**observed,'triangles':observed['triangles'][:-1]},base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['positions'][0]=bad['positions'][0][:2];mutations.append(rejected('short-position-triple',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['normals'][0]=bad['normals'][0][:2];mutations.append(rejected('short-normal-triple',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['triangles'][0][1]=(bad['triangles'][0][1]+1)%len(bad['positions']);mutations.append(rejected('in-range-index',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['triangles'][0][1],bad['triangles'][0][2]=bad['triangles'][0][2],bad['triangles'][0][1];mutations.append(rejected('winding',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['triangles'][0],bad['triangles'][1]=bad['triangles'][1],bad['triangles'][0];mutations.append(rejected('reordered-faces',lambda:validate(bad,base,allowances[base['id']])))
 for field,value in [('bands',99),('cells',99),('faceKinds','bad')]:
  bad=copy.deepcopy(observed);bad[field][0]=value;mutations.append(rejected('wrong-'+field,lambda b=bad:validate(b,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['normals'][0][0]=1e99;mutations.append(rejected('normal-outside-allowance',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['normals'][0][0]=float('nan');mutations.append(rejected('normal-nan',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['positions'][0][1]=-0.0;mutations.append(rejected('negative-zero',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);del bad['cells'];mutations.append(rejected('missing-key',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['extra']=1;mutations.append(rejected('extra-key',lambda:validate(bad,base,allowances[base['id']])))
 dynamic=next(c for c in errors if 'error_detail'in c);wrong={'error':dynamic['error'],'error_detail':{**dynamic['error_detail'],'stage':'edge_scale'}};mutations.append(rejected('wrong-error-stage',lambda:validate(wrong,dynamic)))
 wrong={'error':dynamic['error'],'error_detail':{**dynamic['error_detail'],'faceIndex':1}};mutations.append(rejected('wrong-error-index',lambda:validate(wrong,dynamic)))
 wrong={'error':dynamic['error'],'error_detail':{**dynamic['error_detail'],'faceIndex':False}};mutations.append(rejected('boolean-error-index',lambda:validate(wrong,dynamic)))
 bad_allow=copy.deepcopy(allowances[base['id']]);bad_allow['normals_abs']=[];mutations.append(rejected('short-allowance-rows',lambda:validate(observed,base,bad_allow)))
 bad_allow=copy.deepcopy(allowances[base['id']]);bad_allow['positions_abs'][0][0]=-1;mutations.append(rejected('negative-allowance',lambda:validate(observed,base,bad_allow)))
 bad=copy.deepcopy(observed);bad['triangles'][0][0]=False;mutations.append(rejected('boolean-triangle-index',lambda:validate(bad,base,allowances[base['id']])))
 bad=copy.deepcopy(observed);bad['positions'][0][0]=10**1000;mutations.append(rejected('overflowing-number',lambda:validate(bad,base,allowances[base['id']])))
 report={'status':'passed','scope':'Private draft output comparison/mutation review; no shared fixture/catalog/public-target claim.','source_bindings':{str(CASES.relative_to(ROOT)):sha(CASES),str(ALLOW.relative_to(ROOT)):sha(ALLOW),str(REVIEW.relative_to(ROOT)):sha(REVIEW),str(Path(__file__).relative_to(ROOT)):sha(Path(__file__))},'self_checked_successes':len(success),'self_checked_errors':len(errors),'mutations':mutations,'uncovered_semantic_issues':'This serialized-output validator cannot establish generator ownership, allocation behavior, static access ordering, or target trig inclusion.'}
 args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n');print(json.dumps({'passed':True,'successes':len(success),'errors':len(errors),'mutations':len(mutations),'report':str(args.output)}))
if __name__=='__main__':main()
