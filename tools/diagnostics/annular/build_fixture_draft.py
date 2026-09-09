#!/usr/bin/env python3
"""Private annular golden comparison; reuses established profile numeric enclosures."""
import argparse
import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INTERVALS = ROOT / 'tools/diagnostics/cp7/profile_intervals.py'
spec = importlib.util.spec_from_file_location('annular_intervals', INTERVALS)
i = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = i
spec.loader.exec_module(i)


def value(x):
    x = 0.0 if x == 0 else x
    return {'value': x, 'bits_hex': struct.pack('>d', x).hex()}


def case(name, outer, inner, bottom, top, slices):
    vertices, boxes = [], []
    for radius, z in [(outer, bottom), (outer, top), (inner, bottom), (inner, top)]:
        for cell in range(slices):
            c, s, ci, si = i.trig(cell, slices)
            vertices.append((radius*c, radius*s, z))
            boxes.append((i.mul(i.point(radius), ci), i.mul(i.point(radius), si), i.point(z)))
    triangles, kinds, cells = [], [], []
    for cell in range(slices):
        nxt = (cell + 1) % slices
        ob, ot, ib, it = (ring*slices + cell for ring in range(4))
        obn, otn, ibn, itn = (ring*slices + nxt for ring in range(4))
        quads = [(ob, obn, otn, ot), (ib, it, itn, ibn),
                 (ot, otn, itn, it), (ob, ib, ibn, obn)]
        for kind, (a, b, c, d) in zip(['outer-wall', 'inner-wall', 'top-annulus', 'bottom-annulus'], quads):
            triangles.extend([(a,b,c),(a,c,d)])
            kinds.extend([kind,kind]); cells.extend([cell,cell])
    normals, allowances = [], []
    for tri in triangles:
        normal = i.raw_normal(*(vertices[n] for n in tri))
        bounds = i.interval_normal(*(boxes[n] for n in tri))
        normals.append([value(x) for x in normal])
        allowances.append([i.allowance(x,b) for x,b in zip(normal,bounds)])
    # Independent combinatorial checks, not a visual or native acceptance claim.
    edges = {}
    for a,b,c in triangles:
        for u,v in [(a,b),(b,c),(c,a)]:
            edges[(u,v)] = edges.get((u,v),0)+1
    assert all(n == 1 and edges.get((v,u)) == 1 for (u,v),n in edges.items())
    assert len(vertices)-len(edges)//2+len(triangles) == 0
    return {'id':name,'input':{'outerRadius':outer,'innerRadius':inner,'bottomZ':bottom,
        'topZ':top,'slices':slices,'maxFaces':8*slices},
        'output':{'positions':[[value(x) for x in p] for p in vertices],
            'triangles':triangles,'normals':normals,'faceKinds':kinds,'cells':cells},
        'comparison':{'positions_abs':[[i.allowance(x,b) for x,b in zip(p,box)]
            for p,box in zip(vertices,boxes)],'normals_abs':allowances}}


def validate(config):
    keys = ('outerRadius', 'innerRadius', 'bottomZ', 'topZ', 'slices', 'maxFaces')
    if type(config) is not dict or set(config) != set(keys):
        return 'INVALID_INPUT'
    values = {}
    for key in keys:
        x = config[key]
        if type(x) not in (int, float):
            return 'INVALID_INPUT'
        try:
            x = float(x)
        except OverflowError:
            return 'INVALID_INPUT'
        if not math.isfinite(x):
            return 'INVALID_INPUT'
        values[key] = x
        if key == 'outerRadius' and x <= 0:
            return 'INVALID_INPUT'
        if key == 'innerRadius' and not 0 < x < values['outerRadius']:
            return 'INVALID_INPUT'
        if key == 'topZ' and not values['bottomZ'] < x:
            return 'INVALID_INPUT'
        if key == 'slices' and (not x.is_integer() or not 3 <= x <= 89478485):
            return 'INVALID_INPUT'
        if key == 'maxFaces' and (not x.is_integer() or not 1 <= x <= 715827881):
            return 'INVALID_INPUT'
    if 8 * int(values['slices']) > int(values['maxFaces']):
        return 'FACE_LIMIT_EXCEEDED'
    return None


def errors():
    base = dict(outerRadius=2., innerRadius=1., bottomZ=-1., topZ=1., slices=3, maxFaces=24)
    variants = [
        ('zero-hole', {'innerRadius': 0}, 'INVALID_INPUT'),
        ('equal-radii', {'innerRadius': 2}, 'INVALID_INPUT'),
        ('reversed-radii', {'innerRadius': 3}, 'INVALID_INPUT'),
        ('collapsed-depth', {'topZ': -1}, 'INVALID_INPUT'),
        ('reversed-depth', {'topZ': -2}, 'INVALID_INPUT'),
        ('two-slices', {'slices': 2}, 'INVALID_INPUT'),
        ('fractional-slices', {'slices': 3.5}, 'INVALID_INPUT'),
        ('boolean-radius', {'outerRadius': True}, 'INVALID_INPUT'),
        ('string-radius', {'outerRadius': '2'}, 'INVALID_INPUT'),
        ('slice-storage-limit', {'slices': 89478486}, 'INVALID_INPUT'),
        ('zero-budget', {'maxFaces': 0}, 'INVALID_INPUT'),
        ('face-storage-limit', {'maxFaces': 715827882}, 'INVALID_INPUT'),
        ('budget-one-short', {'maxFaces': 23}, 'FACE_LIMIT_EXCEEDED'),
        ('max-slices-budget-preflight', {'slices': 89478485, 'maxFaces': 1}, 'FACE_LIMIT_EXCEEDED'),
        ('later-invalid-before-budget', {'slices': 89478485, 'maxFaces': False}, 'INVALID_INPUT')]
    result = []
    for name, edits, expected in variants:
        config = dict(base, **edits)
        assert validate(config) == expected, name
        result.append({'id': name, 'input': config, 'error': expected})
    for name, config in [('missing-key', {k:v for k,v in base.items() if k != 'maxFaces'}),
                         ('extra-key', dict(base, cap=True)), ('null-input', None)]:
        assert validate(config) == 'INVALID_INPUT'
        result.append({'id':name,'input':config,'error':'INVALID_INPUT'})
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT/".work/annular-study/fixture-draft.json")
    args = parser.parse_args()
    cases = [case('minimum-three',2.,1.,-1.,1.,3),
             case('four-slices',2.,1.,0.,2.,4),
             case('study-baseline',150.,110.,-15.,15.,48),
             case('study-wide',150.,60.,-15.,15.,48),
             case('study-deep',150.,110.,-45.,45.,48),
             case('study-facets',150.,110.,-15.,15.,12)]
    for c in cases:
        assert validate(c['input']) is None
    cases.extend(errors())
    # Stable first-face witnesses for the unchanged scaled-normal algorithm.
    oracle_path = ROOT / 'tools/diagnostics/cp7/profile_fixture_cases.py'
    oracle_spec = importlib.util.spec_from_file_location('annular_normal_oracle', oracle_path)
    oracle = importlib.util.module_from_spec(oracle_spec)
    oracle_spec.loader.exec_module(oracle)
    for name, radius, inner, bottom, top, stage in [
        ('axial-edge-overflow', 2., 1., -1.7976931348623157e308, 1.7976931348623157e308, 'edge'),
        ('rounded-cross-collapse', 1e308, 5e307, 0., 5e-324, 'cross_scale')]:
        config = dict(outerRadius=radius, innerRadius=inner, bottomZ=bottom, topZ=top, slices=3, maxFaces=24)
        assert validate(config) is None
        c, sine, _, _ = i.trig(1, 3)
        a = (radius, 0., bottom)
        b = (radius*c, radius*sine, bottom)
        end = (b[0], b[1], top)
        expected = ('MESH_ARITHMETIC_INVALID', {'faceIndex':0, 'stage':stage})
        try:
            oracle.normal(a, b, end, 0)
        except ValueError as failure:
            assert failure.args[0] == expected
        else:
            raise AssertionError('dynamic witness did not fail: ' + name)
        cases.append({'id':name, 'input':config, 'error':expected[0], 'error_detail':expected[1]})

    result = {'operation':'mesh.annular-solid-3d','version':'0.1.0','fixture_status':('reviewed' if json.loads((ROOT/'catalog/operations/annular-solid-3d.json').read_text())['status']=='reviewed' else 'review_pending'),
        'fixture_format':'annular-solid-3d-output',
        'catalog_sha256':hashlib.sha256((ROOT/'catalog/operations/annular-solid-3d.json').read_bytes()).hexdigest(),
        'scope':'Success geometry, static/budget and dynamic errors; indexed-access obligations remain separately pending.',
        'source_bindings':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in [Path(__file__).resolve(),INTERVALS,oracle_path]},'cases':cases}
    out = args.output
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'status':'draft-generated','cases':len(cases),'path':str(out)}))

if __name__ == '__main__':
    main()
