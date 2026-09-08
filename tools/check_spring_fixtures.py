"""Validate CP10 state fixtures using separately rounded exact rational intermediates."""
from __future__ import annotations
import math,struct
from fractions import Fraction
from jsonschema import Draft202012Validator

ID='motion.target-springs-2d'
BOUND=357913941

def number(value):
 if isinstance(value,bool) or not isinstance(value,(int,float)):return False
 try:return math.isfinite(float(value))
 except (OverflowError,ValueError):return False

def pair(value):return isinstance(value,list) and len(value)==2 and all(number(x) for x in value)
def static_valid(value):
 if not isinstance(value,dict) or set(value)!={'state','targets'}:return False
 state=value['state']
 if not isinstance(state,dict) or set(state)!={'bodies'}:return False
 bodies=state['bodies']
 if not isinstance(bodies,list) or len(bodies)>BOUND:return False
 for body in bodies:
  if not isinstance(body,dict) or set(body)!={'position','velocity','strength','retention'}:return False
  if not pair(body['position']) or not pair(body['velocity']):return False
  if not number(body['strength']) or body['strength']<0:return False
  if not number(body['retention']) or not 0<=body['retention']<=1:return False
 targets=value['targets']
 return isinstance(targets,list) and len(targets)==len(bodies) and all(pair(t) for t in targets)

def canonical(value):return 0.0 if value==0 else float(value)
def rounded(value):
 try:return float(value)
 except OverflowError:return math.inf if value>0 else -math.inf

def reference(value):
 """Reference uses rationals between each rounding; does not import native/generator code."""
 if not static_valid(value):return {'error':'INVALID_INPUT'}
 output=[]
 for index,(body,target) in enumerate(zip(value['state']['bodies'],value['targets'])):
  k,r=canonical(body['strength']),canonical(body['retention'])
  positions=[];velocities=[]
  for axis in range(2):
   p,v,t=map(canonical,[body['position'][axis],body['velocity'][axis],target[axis]])
   values={}
   for stage in ('delta','force','advanced','position','velocity'):
    if stage=='delta':exact=Fraction(t)-Fraction(p)
    elif stage=='force':exact=Fraction(values['delta'])*Fraction(k)
    elif stage=='advanced':exact=Fraction(v)+Fraction(values['force'])
    elif stage=='position':exact=Fraction(p)+Fraction(values['advanced'])
    else:exact=Fraction(values['advanced'])*Fraction(r)
    result=rounded(exact)
    if not math.isfinite(result):return {'error':'SPRING_ARITHMETIC_INVALID','error_details':{'bodyIndex':index,'axis':'xy'[axis],'stage':stage}}
    values[stage]=result
   positions.append(canonical(values['position']));velocities.append(canonical(values['velocity']))
  output.append({'position':positions,'velocity':velocities,'strength':k,'retention':r})
 return {'output':{'bodies':output}}

def identical(expected,actual):
 if isinstance(expected,dict):return isinstance(actual,dict) and set(expected)==set(actual) and all(identical(v,actual[k]) for k,v in expected.items())
 if isinstance(expected,list):return isinstance(actual,list) and len(expected)==len(actual) and all(identical(a,b) for a,b in zip(expected,actual))
 if isinstance(expected,(int,float)) and not isinstance(expected,bool):
  return number(actual) and struct.pack('>d',float(expected))==struct.pack('>d',float(actual))
 return type(expected)==type(actual) and expected==actual

def validate(root,prefix,op,fixture):
 errors=[]
 if op.get('id')!=ID:return [prefix+': target-spring-state-output requires '+ID]
 if fixture.get('comparison')!='exact-binary64':errors.append(prefix+': comparison must be exact-binary64')
 if not isinstance(op.get('output_invariants'),str) or not op['output_invariants'].strip():errors.append(prefix+': missing state invariants')
 cases=fixture.get('cases',[]);sequences={}
 vin=Draft202012Validator(op['input_schema']);vout=Draft202012Validator(op['output_schema'])
 for case in cases:
  label=prefix+'/'+str(case.get('id')) if isinstance(case,dict) else prefix
  if not isinstance(case,dict):errors.append(label+': invalid case');continue
  value=case.get('input');expected=reference(value)
  actual={k:case[k] for k in ('output','error','error_details') if k in case}
  if not identical(expected,actual):errors.append(label+': differs from independently rounded reference state/error')
  if 'output' in expected:
   if not vin.is_valid(value) or not vout.is_valid(case.get('output')):errors.append(label+': schema-invalid successful case')
  elif expected['error']=='SPRING_ARITHMETIC_INVALID' and not vin.is_valid(value):errors.append(label+': arithmetic witness must have schema-valid finite input')
  if 'sequence_id' in case or 'sequence_index' in case:
   name,index=case.get('sequence_id'),case.get('sequence_index')
   if not isinstance(name,str) or not name or type(index)!=int or index<0 or 'output' not in expected:errors.append(label+': invalid sequence declaration')
   else:sequences.setdefault(name,[]).append(case)
 by_id={c.get('id'):c for c in cases if isinstance(c,dict)}
 restores=[c for c in cases if isinstance(c,dict) and 'restores_case' in c]
 if not restores:errors.append(prefix+': missing mid-sequence restore fixture')
 for c in restores:
  original=by_id.get(c['restores_case'])
  if original is None or not identical(c.get('input'),original.get('input')) or not identical(c.get('output'),original.get('output')):
   errors.append(prefix+': restored state fixture must repeat an identified sequence transition')
 if not sequences:errors.append(prefix+': missing consecutive-state sequence')
 for name,sequence in sequences.items():
  sequence.sort(key=lambda c:c['sequence_index'])
  if len(sequence)<12 or [c['sequence_index'] for c in sequence]!=list(range(len(sequence))):errors.append(prefix+': sequence must contain at least twelve consecutive unique indices: '+name)
  for before,after in zip(sequence,sequence[1:]):
   if not identical(before['output'],after['input']['state']):errors.append(prefix+': sequence state is not chained: '+name)
 return errors
