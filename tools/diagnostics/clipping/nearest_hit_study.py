"""Private exact-rational boundary study, independently authored; not a public API.

Distinguishes nearest contact with supplied blockers from suffix-only web construction.
No tolerance, rounded-output contract, performance claim or copied upstream code.
"""
from fractions import Fraction as F
import json


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def contact(ray, blocker):
    a, b = tuple(map(F, ray[:2])), tuple(map(F, ray[2:]))
    c, d = tuple(map(F, blocker[:2])), tuple(map(F, blocker[2:]))
    r, s = tuple(b[i]-a[i] for i in range(2)), tuple(d[i]-c[i] for i in range(2))
    delta = tuple(c[i]-a[i] for i in range(2))
    den = cross(r, s)
    if not den:
        return {'kind': 'collinear-or-degenerate' if cross(delta, r) == 0 else 'parallel'}
    t, u = cross(delta, s)/den, cross(delta, r)/den
    if 0 < t <= 1 and 0 <= u <= 1:
        return {'kind': 'point', 't': t, 'u': u}
    return {'kind': 'no-positive-hit'}


def nearest(ray, blockers):
    hits = [(hit['t'], index, hit['u']) for index, blocker in enumerate(blockers)
            if (hit := contact(ray, blocker))['kind'] == 'point']
    return min(hits) if hits else None


def main():
    ray = [0, 0, 10, 0]
    assert nearest(ray, [[7,-2,7,2], [3,-2,3,2]]) == (F(3,10),1,F(1,2))
    assert nearest(ray, [[0,-2,0,2], [10,0,10,2]]) == (F(1),1,F(0))
    assert nearest(ray, [[3,-2,3,2], [3,-4,3,4]]) == (F(3,10),0,F(1,2))
    assert nearest(ray, [[11,-2,11,2]]) is None
    # Deliberately diagonal witness: does not depend on the source's axis-alignment bug.
    lines = [[0,0,10,10], [0,10,10,0]]
    all_hits = [nearest(line, [other for j,other in enumerate(lines) if i!=j]) for i,line in enumerate(lines)]
    suffix_hits = [nearest(line, lines[i+1:]) for i,line in enumerate(lines)]
    assert all(hit is not None for hit in all_hits)
    assert suffix_hits[0] is not None and suffix_hits[1] is None
    # Origin-overlapping collinear geometry has no least strictly positive contact.
    overlap = contact(ray, [0,0,5,0])
    assert overlap['kind'] == 'collinear-or-degenerate'
    print(json.dumps({'status':'passed-private-study','scope':'Exact rational witnesses only; no public implementation or source reproduction',
        'witnesses':{'nearest_unsorted_blockers':nearest(ray, [[7,-2,7,2],[3,-2,3,2]]),
        'origin_ignored_far_endpoint_included':nearest(ray, [[0,-2,0,2],[10,0,10,2]]),
        'stable_equal_hit':nearest(ray, [[3,-2,3,2],[3,-4,3,4]]),
        'all_other_rays':all_hits,'later_only_rays':suffix_hits,'origin_overlap':overlap},
        'unresolved':'Collinear overlap needs explicit policy; skipping all collinear pairs is not nearest contact.'},default=str,indent=2))

if __name__ == '__main__':
    main()
