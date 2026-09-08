#!/usr/bin/env python3
"""Independent rational oracle: round every specified operation to binary64."""
from fractions import Fraction
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def rounded(a, b, operation):
    a, b = Fraction(a), Fraction(b)
    return float({'add': lambda: a+b, 'sub': lambda: a-b,
                  'mul': lambda: a*b}[operation]())


def indices(phase, n):
    f = rounded(phase, math.floor(phase), 'sub')
    if f == 0 or f == 1:
        f = 0.0
    x = rounded(f, n, 'mul')
    if x == n:
        x = 0.0
    i = math.floor(x)
    return {'f': f, 'x': x, 'i': i, 't': rounded(x, i, 'sub'),
            'j': 0 if i+1 == n else i+1}


def sample(colors, phase):
    v = indices(phase, len(colors))
    result = 0
    for shift in (16, 8, 0):
        a, b = ((colors[index] >> shift) & 255 for index in (v['i'], v['j']))
        product = rounded(v['t'], b-a, 'mul')
        channel = math.floor(rounded(rounded(a, product, 'add'), .5, 'add'))
        result += channel << shift
    return result


def main():
    op = json.loads((ROOT/'catalog/operations/cyclic-palette.json').read_text())
    assert (op['id'], op['version']) == ('color.cyclic-palette', '0.1.0')
    phases = [0., -0., -5e-324, 5e-324, -.25, .25, .5, .75, 1.,
              math.nextafter(1., 0.), math.nextafter(.25, 0.),
              math.nextafter(.25, 1.), 1.25, -1.25, 4503599627370495.5,
              -4503599627370495.5, 1e300, -1e300,
              float.fromhex('0x1.fffffffffffffp+1023')]
    cases = []
    palettes = [('black-white', [0, 16777215]),
                ('red-blue', [16711680, 255]),
                ('one-step-channels', [0, 65793]),
                ('duplicates', [0, 0, 16777215, 16777215]),
                ('single', [1193046]),
                ('source-pelines', [0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7])]
    for name, colors in palettes:
        cases.append({'id': name, 'input': {'colors': colors},
                      'serialized': {'colors': colors},
                      'queries': [{'input': p, 'output': sample(colors, p)} for p in phases]})
    cases.append({'id': 'integral-floats', 'input': {'colors': [-0., 1.]},
                  'serialized': {'colors': [0, 1]},
                  'queries': [{'input': .25, 'output': 1}]})
    bad = [None, [], {}, {'colors': []}, {'colors': 'red'}, {'colors': [True]},
           {'colors': [-1]}, {'colors': [16777216]}, {'colors': [1.5]},
           {'colors': [None]}, {'colors': [0], 'alpha': 1}]
    cases.extend({'id': f'invalid-constructor-{i}', 'input': value, 'error': 'INVALID_INPUT'}
                 for i, value in enumerate(bad))
    fixture = {'operation': op['id'], 'version': op['version'],
               'oracle': 'tools/build_palette_fixtures.py; independent Fraction arithmetic, no native evaluator',
               'cases': cases,
               'query_cases': [{'id': f'invalid-query-{i}', 'input': p, 'error': 'INVALID_QUERY'}
                               for i, p in enumerate([None, True, '0.5', [], {}, [.5], 10**400, -10**400])],
               'index_vectors': [{'phase': p, 'length': n, 'output': indices(p, n)}
                                 for n in (1, 2, 3, 2147483647)
                                 for p in (0., -0., -5e-324, -.25, math.nextafter(1., 0.), 1e300)],
               'native_only': ['NaN and infinities rejected for queries and entries',
                               'input mutation and serialized mutation do not affect sampling',
                               'invalid phase rejected even for single palette',
                               'unsupported native numbers rejected before lossy conversion',
                               'outputs and canonical serialized zeros are positive zero',
                               'query order and interleaving do not affect results']}
    (ROOT/op['fixtures']).write_text(json.dumps(fixture, indent=2, allow_nan=False)+'\n')


if __name__ == '__main__':
    main()
