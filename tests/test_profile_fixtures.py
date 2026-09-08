from __future__ import annotations

import copy
import json
from pathlib import Path
import unittest

from tools.check_profile_fixtures import validate

ROOT = Path(__file__).resolve().parents[1]


class ProfileFixtureTests(unittest.TestCase):
    def setUp(self):
        self.op = json.loads((ROOT / 'catalog/operations/radial-profile-surface.json').read_text())
        self.fixture = json.loads((ROOT / 'fixtures/operations/radial-profile-surface.json').read_text())

    def test_canonical(self):
        self.assertEqual([], validate(ROOT, 'profile', self.op, self.fixture))

    def test_corruptions(self):
        def first(f):
            return next(c for c in f['cases'] if 'output' in c)

        def dynamic(f):
            return next(c for c in f['cases'] if 'error_detail' in c)

        changes = {
            'catalog hash': lambda f: f.update(catalog_sha256='0' * 64),
            'source hash': lambda f: f['source_bindings'].update({'tools/build_profile_fixtures.py': '0' * 64}),
            'empty cases': lambda f: f.update(cases=[]),
            'duplicate id': lambda f: f['cases'].append(copy.deepcopy(f['cases'][0])),
            'bits': lambda f: first(f)['output']['positions'][0][0].update(bits_hex='0' * 16),
            'negative zero': lambda f: first(f)['output']['positions'][0][1].update(value=-0., bits_hex='8000000000000000'),
            'short allowances': lambda f: first(f)['comparison'].update(normals_abs=[]),
            'negative allowance': lambda f: first(f)['comparison']['positions_abs'][0].__setitem__(0, -1),
            'boolean index': lambda f: first(f)['output']['triangles'][0].__setitem__(0, False),
            'large index': lambda f: first(f)['output']['triangles'][0].__setitem__(0, 999),
            'wrong band': lambda f: first(f)['output']['bands'].__setitem__(0, 999),
            'boolean error face': lambda f: dynamic(f)['error_detail'].update(faceIndex=False),
            'unknown stage': lambda f: dynamic(f)['error_detail'].update(stage='unknown'),
            'partial failure': lambda f: dynamic(f).update(output={}),
            'empty success profile': lambda f: first(f)['input'].update(profile=[]),
            'huge count mismatch': lambda f: first(f)['input'].update(slices=715827881),
            'unhashable stage': lambda f: dynamic(f)['error_detail'].update(stage=[]),
            'unhashable status': lambda f: f.update(fixture_status=[]),
            'budget before geometry': lambda f: dynamic(f)['input'].update(maxFaces=1),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                fixture = copy.deepcopy(self.fixture)
                change(fixture)
                self.assertTrue(validate(ROOT, 'profile', self.op, fixture))


if __name__ == '__main__':
    unittest.main()
