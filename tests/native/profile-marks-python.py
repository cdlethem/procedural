#!/usr/bin/env python3
"""Compare the actual Python example to the existing CP7 interval reference."""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT), str(ROOT / 'packages/python'), str(ROOT / 'packages/python/examples/profile_marks')]
from profile_composition import create_profile_composition
from tools.diagnostics.cp7 import profile_intervals as reference

STATES = ((32, True, True), (8, True, True), (8, False, True), (8, False, False))
COUNTS = (((546,1088),(546,1088),(514,1024)), ((138,272),(138,272),(130,256)),
          ((137,264),(137,264),(129,248)), ((136,256),(136,256),(129,248)))
FILES = ('tests/native/profile-marks-python.py', 'packages/python/examples/profile_marks/profile_composition.py',
         'packages/python/procedurals/radial_profile.py', 'tools/diagnostics/cp7/profile_intervals.py',
         'catalog/operations/radial-profile-surface.json', 'fixtures/operations/radial-profile-surface.json',
         'design/operations/cp7-profile-fixture-policy.md', 'packages/java/examples/ProfileMarks/ProfileComposition.java')

def hashes():
    return {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in FILES}

def bits(x):
    return struct.pack('>d', x)

def within(value, expected, interval):
    allowance = reference.allowance(expected, interval)
    assert math.isfinite(value) and math.isfinite(expected)
    assert math.isfinite(allowance) and allowance >= 0
    if value == 0:
        assert bits(value) == bits(0.0)
    expected = 0.0 if expected == 0 else expected
    assert bits(value) == bits(expected) if allowance == 0 else abs(value-expected) <= allowance

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
output = args.output.resolve()
assert output.is_relative_to(ROOT/'.work') and not output.exists()
before = hashes()
for state, expected_counts in zip(STATES, COUNTS):
    composition = create_profile_composition(*state)
    for shape, counts in enumerate(expected_counts):
        mesh = composition.mesh_at(shape)
        assert mesh is composition.mesh_at(shape)
        assert (mesh.vertex_count(), mesh.face_count()) == counts
        profile = []
        for point in range(17):
            radius = 60.0
            if shape == 1:
                radius -= 36.0 * math.cos((point/16.0 - .5) * math.pi)
            if shape == 2:
                radius *= 1.0 - point/16.0
            profile.append((-160.0 + point*20.0, radius))
        vertices, triangles = reference.mesh(profile, *state)
        actual = mesh.to_values()
        assert set(actual) == {'positions','triangles','normals','faceKinds','bands','cells'}
        assert len(vertices) == len(actual['positions'])
        for value, vertex in zip(actual['positions'], vertices):
            assert len(value) == 3
            for axis in range(3):
                within(value[axis], vertex.exact[axis], vertex.interval[axis])
        for key in ('triangles','normals','faceKinds','bands','cells'):
            assert len(actual[key]) == len(triangles)
        for face, triangle in enumerate(triangles):
            assert actual['triangles'][face] == list(triangle.indices)
            assert actual['faceKinds'][face] == triangle.kind
            assert actual['bands'][face] == triangle.band
            assert actual['cells'][face] == triangle.cell
            exact = reference.raw_normal(*(vertices[i].exact for i in triangle.indices))
            bounds = reference.interval_normal(*(vertices[i].interval for i in triangle.indices))
            assert len(actual['normals'][face]) == 3
            for axis in range(3):
                within(actual['normals'][face][axis], exact[axis], bounds[axis])
assert create_profile_composition(16, True, False).mesh_at(0).face_count() == 528
assert create_profile_composition(8, False, True).mesh_at(2).to_values() == create_profile_composition(8, False, False).mesh_at(2).to_values()
after = hashes()
assert before == after
report = {'status':'passed', 'scope':'Four Python ProfileMarks settings, all three full meshes against existing CP7 interval/topology reference;16-slice editability and ignored pole cap. No py5 execution.',
          'settings':STATES, 'meshes':12, 'source_sha256_before':before, 'source_sha256_after':after}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'status':'passed','meshes':12,'output':str(output)}))
