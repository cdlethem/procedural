#!/usr/bin/env python3
"""Independent exhaustive convex-polygon tie-policy check; no triangulator implementation."""
from functools import lru_cache
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
# Counterclockwise integer sites on x*x+y*y=25. Their canonical IDs are x/y sorted.
CIRCLE = ((5, 0), (4, 3), (3, 4), (0, 5), (-3, 4), (-4, 3),
          (-5, 0), (-4, -3), (-3, -4), (0, -5), (3, -4), (4, -3))


@lru_cache(None)
def triangulations(polygon):
    if len(polygon) < 3:
        return ((),)
    first, last = polygon[0], polygon[-1]
    results = []
    for split in range(1, len(polygon) - 1):
        for left in triangulations(polygon[:split + 1]):
            for right in triangulations(polygon[split:]):
                results.append(left + right + ((first, polygon[split], last),))
    return tuple(results)


def edges(faces):
    incidence = {}
    for a, b, c in faces:
        for u, v, opposite in ((a, b, c), (b, c, a), (c, a, b)):
            incidence.setdefault(tuple(sorted((u, v))), []).append(opposite)
    return incidence


def check(count):
    points = CIRCLE[:count]
    assert all(x*x+y*y == 25 for x, y in points)
    ids = {point: i for i, point in enumerate(sorted(points))}
    polygon = tuple(ids[p] for p in points)
    position = polygon.index(0)
    rotated = polygon[position:] + polygon[:position]
    fan = {(0, v) for v in rotated[2:-1]}
    terminals = set()
    flips = 0
    seen = set()
    for faces in triangulations(polygon):
        incidence = edges(faces)
        internal = tuple(sorted(e for e, neighbours in incidence.items() if len(neighbours) == 2))
        assert len(internal) == count - 3
        assert internal not in seen
        seen.add(internal)
        improving = []
        for edge, neighbours in incidence.items():
            assert len(neighbours) in (1, 2)
            if len(neighbours) != 2:
                continue
            replacement = tuple(sorted(neighbours))
            assert replacement not in incidence
            if replacement < edge:
                improving.append((edge, replacement))
                changed = tuple(sorted((set(internal) - {edge}) | {replacement}))
                assert changed < internal, 'tie flip must strictly decrease edge vector'
                flips += 1
        if not improving:
            terminals.add(internal)
            assert set(internal) == fan, 'non-fan local minimum'
    assert terminals == {tuple(sorted(fan))}
    return {'sites': count, 'triangulations': len(seen), 'improving_flips_checked': flips,
            'terminal_triangulations': len(terminals), 'terminal_is_minimum_site_fan': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / '.work')
    if output.exists():
        raise RuntimeError('Preserve existing experiment output')
    records = [check(n) for n in (4, 5, 6, 8, 10, 12)]
    report = {'status': 'passed', 'scope': 'Exact convex cocircular polygon tie flips only; not a general Delaunay implementation or performance test.',
              'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'cases': records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
