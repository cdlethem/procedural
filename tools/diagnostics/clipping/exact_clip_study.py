#!/usr/bin/env python3
"""Private exact-rational clipping oracle; not a public operation or admission.

Independently specified from vector-clipping-investigation.md. Assumes supplied
simple polygons: this diagnostic deliberately does not validate polygon topology.
"""
from fractions import Fraction as F
import json
from pathlib import Path


def sub(a, b):
    return a[0] - b[0], a[1] - b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def point(a, d, t):
    return a[0] + d[0] * t, a[1] + d[1] * t


def contains(polygon, p):
    inside = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if cross(sub(b, a), sub(p, a)) == 0 and all(
            min(a[k], b[k]) <= p[k] <= max(a[k], b[k]) for k in (0, 1)
        ):
            return True
        if (a[1] > p[1]) != (b[1] > p[1]):
            x = a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if p[0] < x:
                inside = not inside
    return inside


def clip(polygon, segment):
    polygon = [tuple(map(F, p)) for p in polygon]
    a, b = [tuple(map(F, p)) for p in segment]
    d = sub(b, a)
    if d == (0, 0):
        return []
    cuts = {F(0), F(1)}
    for c, e in zip(polygon, polygon[1:] + polygon[:1]):
        edge, offset = sub(e, c), sub(c, a)
        denominator = cross(d, edge)
        if denominator:
            t, u = cross(offset, edge) / denominator, cross(offset, d) / denominator
            if 0 <= t <= 1 and 0 <= u <= 1:
                cuts.add(t)
        elif cross(offset, d) == 0:
            axis = 0 if d[0] else 1
            for p in (c, e):
                t = (p[axis] - a[axis]) / d[axis]
                if 0 <= t <= 1:
                    cuts.add(t)
    cuts = sorted(cuts)
    intervals = []
    for lo, hi in zip(cuts, cuts[1:]):
        if contains(polygon, point(a, d, (lo + hi) / 2)):
            if intervals and intervals[-1][1] == lo:
                intervals[-1][1] = hi
            else:
                intervals.append([lo, hi])
    return intervals


def main():
    square = [[0, 0], [4, 0], [4, 4], [0, 4]]
    notch = [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]
    cases = [
        ('horizontal', square, [[-1, 2], [5, 2]], [['1/6', '5/6']]),
        ('vertical', square, [[2, -1], [2, 5]], [['1/6', '5/6']]),
        ('inside', square, [[1, 1], [3, 3]], [['0', '1']]),
        ('outside', square, [[5, 1], [5, 3]], []),
        ('boundary', square, [[-1, 0], [5, 0]], [['1/6', '5/6']]),
        ('vertex_tangent', square, [[-1, 1], [1, -1]], []),
        ('diagonal_vertices', square, [[-1, -1], [5, 5]], [['1/6', '5/6']]),
        ('zero_length_inside', square, [[2, 2], [2, 2]], []),
        ('concave_notch', notch, [[-1, 4], [7, 4]], [['1/8', '3/8'], ['5/8', '7/8']]),
        ('notch_floor', notch, [[-1, 2], [7, 2]], [['1/8', '7/8']]),
    ]
    results = []
    for name, polygon, segment, expected in cases:
        actual = clip(polygon, segment)
        assert [[str(x) for x in row] for row in actual] == expected, name
        assert clip(list(reversed(polygon)), segment) == actual, name
        assert clip(polygon, list(reversed(segment))) == [
            [1 - hi, 1 - lo] for lo, hi in reversed(actual)
        ], name
        results.append(dict(id=name, polygon=polygon, segment=segment,
                            intervals=expected, reversed_winding=True,
                            reversed_segment=True))
    output = Path('.work/vector-clipping-study/exact.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dict(status='passed-private-study', cases=results,
        limitations=['Assumes simple polygons; no topology validation.',
                     'Exact rational oracle is not a performance implementation.']), indent=2) + '\n')
    print(f'{len(cases)} hand-specified cases and winding/direction checks passed: {output}')


if __name__ == '__main__':
    main()
