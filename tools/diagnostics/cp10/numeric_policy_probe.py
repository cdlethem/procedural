#!/usr/bin/env python3
"""Check proposed CP10 arithmetic witnesses against independently rounded exact rationals."""
import argparse,json,math,struct,hashlib
from fractions import Fraction as F
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
MAX=float.fromhex('0x1.fffffffffffffp+1023')
MIN=float.fromhex('0x0.0000000000001p-1022')
STAGES=['delta','force','advanced','position','velocity']

def rounded(x):
 try:return float(x)
 except OverflowError:return math.copysign(math.inf,1 if x>0 else -1)
def bits(x):return struct.pack('>d',x).hex()
def evaluate(values,exact):
 p,t,v,k,r=[0.0 if x==0 else float(x) for x in values];out=[]
 def binary(a,b,op):
  if exact:
   a,b=F(a),F(b);return rounded(a-b if op=='-' else a*b if op=='*' else a+b)
  return a-b if op=='-' else a*b if op=='*' else a+b
 for stage in STAGES:
  if stage=='delta':value=binary(t,p,'-')
  elif stage=='force':value=binary(out[0],k,'*')
  elif stage=='advanced':value=binary(v,out[1],'+')
  elif stage=='position':value=binary(p,out[2],'+')
  else:value=binary(out[2],r,'*')
  if not math.isfinite(value):return dict(error=stage)
  out.append(value)
 return dict(values=out,output=[0.0 if x==0 else x for x in out[-2:]])

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 out=args.output.resolve();out.relative_to(ROOT/'.work')
 if out.exists():raise RuntimeError('Preserve existing numeric investigations')
 cases=[('equilibrium',[0,0,0,.025,.7],[0,0]),('first-step',[0,100,0,.025,.7],[2.5,1.75]),('second-step',[2.5,100,1.75,.025,.7],[6.6875,2.93125]),('no-strength',[5,-10,3,0,.5],[8,1.5]),('no-retention',[0,1,0,1,0],[1,0]),('negative-zero-input-normalized',[1,0,-0.0,0,1],[1,0]),('negative-zero-product-normalized',[1,0,-1,0,0],[0,0]),('subnormal-preserved',[0,MIN,0,1,1],[MIN,MIN]),('subnormal-underflow',[0,MIN,0,.5,1],[0,0]),('no-fma',[0,1e16,-1e16,1.0000000000000002,1],[2,2]),('delta-overflow',[-MAX,MAX,0,0,0],'delta'),('force-overflow',[0,MAX,0,2,0],'force'),('advanced-overflow',[0,MAX,MAX,1,0],'advanced'),('position-overflow',[MAX,MAX,MAX,0,0],'position')]
 records=[]
 for name,values,expected in cases:
  native=evaluate(values,False);exact=evaluate(values,True)
  assert native.get('error')==exact.get('error'),name
  if isinstance(expected,str):assert native==dict(error=expected),name
  else:
   assert [bits(x) for x in native['output']]==[bits(x) for x in expected],name
   assert [bits(x) for x in native['output']]==[bits(x) for x in exact['output']],name
   for a,b in zip(native['values'],exact['values']):assert a==b,name
  records.append(dict(id=name,input=values,result=native))
 # Fused alternative rounds only once; it must differ from the specified path.
 fused=rounded(F(-1e16)+F(1e16)*F(1.0000000000000002));assert fused!=2.0
 assert bits(evaluate([1,0,-0.0,0,1],False)['values'][2])=='0000000000000000'
 assert bits(evaluate([1,0,-1,0,0],False)['values'][-1])=='8000000000000000'
 # Twelve changing-target ticks from nonzero state, checked twice independently.
 state=[3.0,-2.0];sequence=[]
 for tick in range(12):
  target=[10.0,-4.0,3.0][tick%3];inp=[state[0],target,state[1],.125,.75]
  n=evaluate(inp,False);e=evaluate(inp,True);assert list(map(bits,n['output']))==list(map(bits,e['output']))
  state=n['output'];sequence.append(dict(tick=tick,target=target,output=state))
 out.parent.mkdir(parents=True,exist_ok=True)
 out.write_text(json.dumps(dict(status='passed',scope='Private numeric policy witnesses only; no catalog fixture or implementation claim.',tool_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),cases=records,no_fma_alternative=fused,changing_target_sequence=sequence,correction='Input negative zero is canonicalized before arithmetic; -0 initial velocity therefore cannot establish a raw -0 advanced velocity. A distinct negative advanced value times zero retention establishes canonicalization of a completed negative-zero output.'),indent=2)+'\n')
 print(json.dumps(dict(status='passed',cases=len(records),sequence_ticks=len(sequence),report=str(out))))
if __name__=='__main__':main()
