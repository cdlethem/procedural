#!/usr/bin/env python3
"""Generate exact geometry investigation vectors; not an approved drawing contract.

Fraction arithmetic is an independent oracle, not the required runtime algorithm.
No renderer safety, adapter conformance or public parameter range is inferred.
"""
from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
from itertools import permutations, product
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'fixtures/drawing/geometry-investigation.json'


def orient(a, b, c):
    ax, ay = map(Fraction, a)
    bx, by = map(Fraction, b)
    cx, cy = map(Fraction, c)
    return (bx-ax)*(cy-ay) - (by-ay)*(cx-ax)


def convex(vertices):
    turns = [orient(vertices[i], vertices[(i+1) % 4], vertices[(i+2) % 4])
             for i in range(4)]
    return all(t > 0 for t in turns) or all(t < 0 for t in turns)


def f32(x):
    value = Fraction(x)
    if not value:
        return 0.0
    sign = -1 if value < 0 else 1
    value = abs(value)
    exponent = value.numerator.bit_length() - value.denominator.bit_length()
    power = lambda e: Fraction(2**e) if e >= 0 else Fraction(1, 2**-e)
    if value < power(exponent):
        exponent -= 1
    step = power(max(-149, exponent-23))
    scaled = value / step
    whole, remainder = divmod(scaled.numerator, scaled.denominator)
    twice = remainder * 2
    if twice > scaled.denominator or (twice == scaled.denominator and whole % 2):
        whole += 1
    rounded = whole * step
    if rounded >= power(128):
        raise OverflowError('binary32 overflow')
    result = float(sign * rounded) if rounded else 0.0
    # Native conversion is a cross-check, not the oracle selecting the answer.
    native = struct.unpack('>f', struct.pack('>f', x))[0]
    assert result == native
    return result


def fraction_record(value):
    return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}


def build():
    checked = 0
    for vertices in permutations(list(product(range(-1, 2), repeat=2)), 4):
        # Independent characterization: the two other vertices lie strictly on
        # the same side of every boundary edge. Exhaustive small-grid oracle check.
        sides = []
        for i in range(4):
            turns = [orient(vertices[i], vertices[(i+1)%4], vertices[j])
                     for j in range(4) if j not in (i, (i+1)%4)]
            sides.append(turns[0]*turns[1] > 0)
        assert convex(vertices) == all(sides)
        checked += 1
    # Exact integers below 2**53 avoid JSON parser ambiguity; binary fractions are
    # written as exactly representable JSON numbers. No decimal-real oracle semantics.
    n = 2**27
    cases = [
        ('rectangle', [[0,0],[4,0],[4,2],[0,2]]),
        ('reverse_winding', [[0,2],[4,2],[4,0],[0,0]]),
        ('negative_off_canvas', [[-20,-8],[-4,-7],[-3,6],[-21,4]]),
        ('bow_tie', [[0,0],[4,2],[0,2],[4,0]]),
        ('concave', [[0,0],[4,0],[1,1],[0,4]]),
        ('collinear_triple', [[0,0],[2,0],[4,0],[0,4]]),
        ('duplicate_vertex', [[0,0],[4,0],[4,0],[0,2]]),
        ('signed_zero_duplicate', [[0.0,0.0],[-0.0,0.0],[2,2],[0,2]]),
        ('float32_collapsed_edge', [[1,0],[1+2**-25,0],[1+2**-25,1],[1,1]]),
        ('float32_thin_survives', [[1,0],[1+2**-23,0],[1+2**-23,1],[1,1]]),
        ('float32_collinear_distinct', [[0,0],[1,1-2**-25],[2,2],[0,3]]),
        ('binary64_cancellation', [[0,0],[n+1,n],[2*n+1,2*n-1],[n,n-1]]),
        ('subnormal_rectangle', [[0,0],[2**-149,0],[2**-149,2**-149],[0,2**-149]]),
        ('float32_underflow_quad', [[0,0],[2**-151,0],[2**-151,2**-151],[0,2**-151]]),
        ('binary64_subnormal_rectangle', [[0,0],[2**-1074,0],[2**-1074,2**-1074],[0,2**-1074]]),
    ]
    quads = []
    for name, vertices in cases:
        converted = [[f32(x), f32(y)] for x,y in vertices]
        turns = [orient(vertices[i],vertices[(i+1)%4],vertices[(i+2)%4]) for i in range(4)]
        valid = convex(vertices)
        after = convex(converted)
        # Metamorphic cross-checks of the oracle, independent of native adapters.
        assert valid == convex(list(reversed(vertices)))
        assert valid == convex(vertices[1:]+vertices[:1])
        quads.append({'id':name, 'vertices':vertices,
                      'exact_turns':[fraction_record(t) for t in turns],
                      'canonical_strictly_convex':valid,
                      'binary32_vertices':converted, 'binary32_strictly_convex':after,
                      'geometry_outcome':'valid' if valid and after else 'INVALID_COMMAND'})
    # A deliberately wrong ordinary-float predicate must be distinguished.
    a,b,c = [0.,0.], [float(n+1),float(n)], [float(n),float(n-1)]
    naive = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    assert naive == 0 and orient(a,b,c) == -1
    conversion = []
    for name,value in [('tie_even_down',1+2**-24), ('tie_even_up',1+3*2**-24),
                       ('negative_tie',-1-2**-24), ('zero',-0.0),
                       ('smallest_subnormal',2**-149), ('underflow_tie',2**-150)]:
        rounded=f32(value)
        conversion.append({'id':name,'input':value,'output':rounded,
                           'output_bits_hex':struct.pack('>f',rounded).hex()})
    return {'status':'investigation; not approved contract or native conformance',
            'generator':'tools/build_drawing_geometry_fixtures.py',
            'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'scope':'Exact topology and binary32 conversion only; no renderer-safe domain asserted.',
            'exhaustive_grid_crosscheck_count':checked,
            'quads':quads, 'conversion':conversion,
            'cancellation_counterexample':{'a':a,'b':b,'c':c,'naive_binary64':naive,
                                           'exact':fraction_record(orient(a,b,c))}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    expected=json.dumps(build(),indent=2,allow_nan=False)+'\n'
    if args.check:
        if not DESTINATION.exists() or DESTINATION.read_text()!=expected:
            raise SystemExit('Drawing geometry investigation vectors are missing or stale')
    else:
        DESTINATION.parent.mkdir(parents=True,exist_ok=True)
        DESTINATION.write_text(expected)
    print('15 exact quad cases and 6 conversion cases verified; no adapter claim')


if __name__=='__main__':
    main()
