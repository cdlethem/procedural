#!/usr/bin/env python3
"""Small analytic CP19 vectors; no Java evaluator or general warp oracle imported."""
import hashlib
import json
from decimal import Decimal, localcontext
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def rounded(v): return float(v)
def sub(a,b): return rounded(F(a)-F(b))
def mul(a,b): return rounded(F(a)*F(b))
def add(a,b): return rounded(F(a)+F(b))
def div(a,b): return rounded(F(a)/F(b))
def analytic(point, center, radius, distance, square_root=False, exponent=None):
    # Distances are independently known cardinal or 3-4-5 triangle values, not
    # recomputed by a copy of the runtime hypot algorithm. Power is 2, 1/2, or the separately checked 1.3 primitive.
    t=div(distance,radius)
    if exponent is not None:
        with localcontext() as context:
            context.prec=100
            factor=float(Decimal.from_float(t) ** Decimal.from_float(exponent))
    elif square_root:
        with localcontext() as context:
            context.prec=100
            factor=float(Decimal.from_float(t).sqrt())
    else:
        factor=mul(t,t)  # fdlibm pow(x,2) specified square special case.
    amount=mul(radius,sub(1.,factor))
    return [add(point[i],mul(div(sub(center[i],point[i]),distance),amount)) for i in range(2)]

def main():
    path=ROOT/'catalog/operations/radial-pull-2d.json';catalog=json.loads(path.read_text())
    cases=[]
    def case(name, influences, queries):
        config={'influences':influences}
        cases.append({'id':name,'input':config,'serialized':config,'queries':[{'input':a,'output':b} for a,b in queries]})
    case('empty',[],[([0,0],[0,0]),([-3,4],[-3,4]),([-0.0,-0.0],[0,0])])
    cases.append({'id':'negative-zero-descriptor','input':{'influences':[[-0.0,-0.0,1,1]]},'serialized':{'influences':[[0,0,1,1]]},'queries':[{'input':[-0.0,-0.0],'output':[0,0]}]})
    case('cardinal-center-rim',[[200,240,120,2]],[([200,240],[200,240]),([320,240],[320,240]),([321,240],[321,240]),([260,240],[170,240]),([200,180],[200,270])])
    case('negative-off-axis',[[0,0,10,2]],[([-3,-4],analytic([-3.,-4.],[0.,0.],10.,5.)),([3,4],analytic([3.,4.],[0.,0.],10.,5.))])
    case('fractional-power',[[0,0,10,0.5]],[([5,0],analytic([5.,0.],[0.,0.],10.,5.,True))])
    # Independently checked primitive pow(0.5, binary64(1.3)) equals
    # 0x1.9fdf8bcce533dp-2 under pinned StrictMath and 100-digit Decimal.
    case('general-power',[[0,0,10,1.3]],[([5,0],analytic([5.,0.],[0.,0.],10.,5.,exponent=1.3))])
    case('summed-overlap',[[0,0,10,2],[10,0,10,2]],[([5,0],[5,0]),([0,0],[0,0])])
    case('duplicates',[[0,0,10,2],[0,0,10,2]],[([5,0],[-10,0])])
    # At query0, large signed pulls cancel before adding1. A reordered sum
    # rounds the added1 up to2; accumulation must remain in supplied order.
    a=mul(1e16,sub(1.,div(1.,1e16)))
    case('ordered-cancellation',[[1,0,1e16,1],[-1,0,1e16,1],[1,0,2,1]],[([0,0],[add(add(a,-a),1.),0])])
    case('ordered-cancellation-reversed',[[1,0,1e16,1],[1,0,2,1],[-1,0,1e16,1]],[([0,0],[add(add(a,1.),-a),0])])
    # Each influence contributes exactly1, which would be lost if added to
    # query1e16 individually. Sum first produces the next representable x.
    small=mul(3.,sub(1.,div(2.,3.)))
    case('add-query-once',[[10000000000000002,0,3,1],[10000000000000002,0,3,1]],[([10000000000000000,0],[add(1e16,add(small,small)),0])])
    case('infinite-separation-outside',[[1.7976931348623157e308,0,1,2]],[([-1.7976931348623157e308,0],[-1.7976931348623157e308,0])])
    for name,value in [('missing',{}),('extra',{'influences':[],'seed':42}),('shape',[]),('null-list',{'influences':None}),('short-row',{'influences':[[0,0,1]]}),('long-row',{'influences':[[0,0,1,2,3]]}),('zero-radius',{'influences':[[0,0,0,2]]}),('negative-power',{'influences':[[0,0,1,-1]]}),('zero-power',{'influences':[[0,0,1,0]]}),('bool',{'influences':[[False,0,1,2]]})]:
        cases.append({'id':name,'input':value,'error':'INVALID_INPUT'})
    query_cases=[{'id':name,'input':value,'error':'INVALID_QUERY'} for name,value in [('short',[0]),('long',[0,0,0]),('bool',[True,0]),('null',[0,None]),('shape',{}),('string',['0',0])]]
    result={'operation':catalog['id'],'version':catalog['version'],'catalog_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'oracle':'tools/build_radial_pull_fixtures.py; analytic cardinal/3-4-5 distances, Fraction-rounded primitives and independently rounded Decimal sqrt and checked general pow primitive. No native evaluator imported.','cases':cases,'query_cases':query_cases}
    (ROOT/'fixtures/operations/radial-pull-2d.json').write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()
