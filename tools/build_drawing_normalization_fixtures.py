#!/usr/bin/env python3
"""Exact drawing normalization oracle; not a production validator or native test."""
from __future__ import annotations
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from jsonschema import Draft202012Validator
from tools.build_drawing_geometry_fixtures import convex, f32

PROFILE=ROOT/'catalog/drawing/fresh-raster-2d.json'
INPUT=ROOT/'fixtures/drawing/fresh-raster-semantics.json'
OUTPUT=ROOT/'fixtures/drawing/fresh-raster-normalized.json'


def alpha64(byte):
    """Round the exact ratio once using integer quotient/remainder, ties to even."""
    if byte==0:return 0.0
    value=Fraction(byte,255)
    exponent=value.numerator.bit_length()-value.denominator.bit_length()
    power=lambda e: Fraction(2**e) if e>=0 else Fraction(1,2**-e)
    if value<power(exponent):exponent-=1
    quantum=power(exponent-52)
    scaled=value/quantum
    q,r=divmod(scaled.numerator,scaled.denominator)
    if 2*r>scaled.denominator or (2*r==scaled.denominator and q%2):q+=1
    return float(q*quantum)


def normalize(command,environment,profile):
    if not Draft202012Validator(profile['command_schema']).is_valid(command):
        return {'outcome':'INVALID_COMMAND'}
    kind=command['kind']
    points=command['vertices'] if kind=='quad2' else [command['from'],command['to']]
    canonical=[[float(x),float(y)] for x,y in points]
    if (kind=='quad2' and not convex(canonical)) or (kind=='segment2' and canonical[0]==canonical[1]):
        return {'outcome':'INVALID_COMMAND'}
    try:
        converted=[[f32(x),f32(y)] for x,y in canonical]
        width=f32(command['width']) if kind=='segment2' else None
    except OverflowError:
        return {'outcome':'INVALID_COMMAND'}
    limits=profile['limits']
    # This oracle implements the reviewed rule vocabulary. Unknown rule shapes fail
    # rather than silently continuing after a contract revision.
    assert limits['coordinate_margin']=={'basis':'max_surface_axis','multiplier':1}
    assert limits['max_converted_width']=={'basis':'max_surface_axis','multiplier':1}
    assert limits['converted_x']=={'minimum':{'basis':'margin','multiplier':-1},'maximum':{'sum':['surface_width','margin']},'inclusive':True}
    assert limits['converted_y']=={'minimum':{'basis':'margin','multiplier':-1},'maximum':{'sum':['surface_height','margin']},'inclusive':True}
    w,h=environment['width'],environment['height'];m=max(w,h)
    if any(not (-m<=x<=w+m and -m<=y<=h+m) for x,y in converted):
        return {'outcome':'INVALID_COMMAND'}
    if width is not None and not limits['min_converted_width']<=width<=m:
        return {'outcome':'INVALID_COMMAND'}
    if kind=='quad2' and not convex(converted):
        return {'outcome':'INVALID_COMMAND'}
    outcome='noop' if kind=='segment2' and converted[0]==converted[1] else 'emit'
    alpha=alpha64(command['opacity8']);rgb=command['rgb']
    result={'outcome':outcome,'kind':kind,'points':converted,
            'point_bits_hex':[[struct.pack('>f',n).hex() for n in p] for p in converted],
            'rgb':rgb,'channels':[(rgb>>16)&255,(rgb>>8)&255,rgb&255],
            'opacity8':command['opacity8'],'alpha64':alpha,'alpha64_bits_hex':struct.pack('>d',alpha).hex()}
    if width is not None:
        result.update(width=width,width_bits_hex=struct.pack('>f',width).hex(),cap='round')
    return result


def build():
    profile=json.loads(PROFILE.read_text());inputs=json.loads(INPUT.read_text())
    cases=[]
    for case in inputs['cases']:
        env=case.get('environment',inputs['environment'])
        assert Draft202012Validator(profile['environment_schema']).is_valid(env)
        expected=normalize(case['command'],env,profile)
        assert expected['outcome']==case['expected'],case['id']
        cases.append({'id':case['id'],'environment':env,'command':case['command'],'expected':expected})
    sources=[PROFILE,INPUT,Path(__file__).resolve(),ROOT/'tools/build_drawing_geometry_fixtures.py']
    return {'profile':profile['id'],'version':profile['version'],
            'scope':'Exact independent normalization oracle; not production or native conformance.',
            'input_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
            'cases':cases}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true')
    args=parser.parse_args();result=build();text=json.dumps(result,indent=2,allow_nan=False)+'\n'
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text()!=text:raise SystemExit('Normalized drawing fixtures missing or stale')
    else:OUTPUT.write_text(text)
    print(f'{len(result["cases"])} exact normalized cases verified; no runtime conformance claim')


if __name__=='__main__':main()
