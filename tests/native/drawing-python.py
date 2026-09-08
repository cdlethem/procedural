"""Exercise the real Python drawing validator, never the fixture oracle."""
import copy
import json
from pathlib import Path
import struct
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/python'))
from procedurals._drawing import DrawingError, normalize_command, validate_environment, _convex, _f32

fixture=json.loads((ROOT/'fixtures/drawing/fresh-raster-normalized.json').read_text())
for case in fixture['cases']:
    original=copy.deepcopy(case['command'])
    environment=validate_environment(case['environment'])
    try:
        actual=normalize_command(case['command'],environment)
        actual['point_bits_hex']=[[struct.pack('>f',v).hex() for v in p] for p in actual['points']]
        actual['alpha64_bits_hex']=struct.pack('>d',actual['alpha64']).hex()
        if 'width' in actual:actual['width_bits_hex']=struct.pack('>f',actual['width']).hex()
    except DrawingError as error:actual={'outcome':error.code}
    assert actual==case['expected'],(case['id'],actual,case['expected'])
    assert case['command']==original

geometry=json.loads((ROOT/'fixtures/drawing/geometry-investigation.json').read_text())
for case in geometry['quads']:
    # Exercise the runtime exact predicate separately from profile bounds, which
    # intentionally exclude some adversarial numerical investigation values.
    assert _convex([[float(x),float(y)] for x,y in case['vertices']])==case['canonical_strictly_convex'],case['id']
    assert _convex(case['binary32_vertices'])==case['binary32_strictly_convex'],case['id']
for case in geometry['conversion']:
    assert struct.pack('>f',_f32(case['input'])).hex()==case['output_bits_hex'],case['id']

source={'kind':'segment2','from':[0,0],'to':[1,2],'rgb':1193046,'opacity8':128,'width':1,'cap':'round'}
environment=validate_environment({'width':640,'height':320,'density':1,'background':0})
environment_source=dict(environment)
detached_environment=validate_environment(environment_source)
environment_source['width']=1
assert detached_environment['width']==640
output=normalize_command(source,environment)
output['points'][0][0]=99
output['channels'][0]=99
assert source['from']==[0,0] and source['rgb']==1193046
assert normalize_command(source,environment)['points'][0]==[0,0]
for value in (True,'1',float('nan'),float('inf'),10**400):
    bad=dict(source,width=value)
    try:normalize_command(bad,environment)
    except DrawingError as error:assert error.code=='INVALID_COMMAND'
    else:raise AssertionError(('accepted invalid width',value))
for value in (True,0,2049,'640',float('nan'),10**400):
    try:validate_environment(dict(environment,width=value))
    except DrawingError as error:assert error.code=='INVALID_ENVIRONMENT'
    else:raise AssertionError(('accepted invalid environment',value))
print(json.dumps({'language':'python','normalized_cases':len(fixture['cases']),
                  'exact_topology_cases':len(geometry['quads']),
                  'conversion_cases':len(geometry['conversion']),
                  'ownership_and_native_invalid_inputs':True,
                  'scope':'pure validator only; no lifecycle or native adapter claim'}))
