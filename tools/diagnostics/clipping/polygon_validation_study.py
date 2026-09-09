#!/usr/bin/env python3
"""Private exact simple-polygon validation study. No public input contract."""
from fractions import Fraction as F
import json
from pathlib import Path
try:
    from tools.diagnostics.clipping.exact_clip_study import sub, cross
except ModuleNotFoundError:
    from exact_clip_study import sub, cross


def on(a, b, p):
    return cross(sub(b, a), sub(p, a)) == 0 and all(
        min(a[k], b[k]) <= p[k] <= max(a[k], b[k]) for k in (0, 1))


def meet(a, b, c, d):
    signs = [cross(sub(b, a), sub(p, a)) for p in (c, d)]
    other = [cross(sub(d, c), sub(p, c)) for p in (a, b)]
    return (any(on(a, b, p) for p in (c, d)) or
            any(on(c, d, p) for p in (a, b)) or
            signs[0] * signs[1] < 0 and other[0] * other[1] < 0)


def valid(raw):
    p = [tuple(map(F, point)) for point in raw]
    n = len(p)
    if n < 3 or len(set(p)) != n:
        return False
    if sum(cross(p[i], p[(i+1) % n]) for i in range(n)) == 0:
        return False
    for i in range(n):
        a, b, c = p[i-1], p[i], p[(i+1) % n]
        if cross(sub(b, a), sub(c, b)) == 0:
            u, v = sub(b, a), sub(c, b)
            if u[0]*v[0] + u[1]*v[1] <= 0:
                return False  # Adjacent backtracking overlaps; straight continuation is valid.
        for j in range(i+1, n):
            if j == i+1 or (i == 0 and j == n-1):
                continue
            if meet(p[i], p[(i+1) % n], p[j], p[(j+1) % n]):
                return False
    return True


def main():
    cases = [
        ('square', [[0,0],[4,0],[4,4],[0,4]], True),
        ('concave', [[0,0],[6,0],[6,6],[4,6],[4,2],[2,2],[2,6],[0,6]], True),
        ('straight_vertex', [[0,0],[2,0],[4,0],[4,4],[0,4]], True),
        ('repeated_closure', [[0,0],[4,0],[4,4],[0,4],[0,0]], False),
        ('duplicate_vertex', [[0,0],[4,0],[4,4],[4,0],[0,4]], False),
        ('bow_tie', [[0,0],[4,4],[0,4],[4,0]], False),
        ('nonzero_area_crossing', [[0,0],[5,4],[0,4],[4,0]], False),
        ('edge_touch', [[0,0],[4,0],[4,4],[2,0],[0,4]], False),
        ('backtrack', [[0,0],[4,0],[2,0],[4,4],[0,4]], False),
        ('collinear', [[0,0],[1,0],[2,0]], False),
        ('too_short', [[0,0],[1,0]], False),
    ]
    for name, polygon, expected in cases:
        assert valid(polygon) == expected, name
        assert valid(polygon[::-1]) == expected, name
    result = dict(status='passed-private-validation-study', cases=[
        dict(id=n, polygon=p, valid=e, reversed_winding=True) for n,p,e in cases],
        scope='Exact rational topology for supplied finite points; carrier validation and public contract pending.')
    out = Path('.work/vector-clipping-study/polygon-validation.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n')
    print(f'{len(cases)} polygon cases and winding reversals passed')


if __name__ == '__main__':
    main()
