#!/usr/bin/env python3
"""Root's private CP3 ordered-acceptance cross-check; no rendering or public API."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[3]
STREAM = Path(__file__).with_name('stream_oracle.py')
spec = importlib.util.spec_from_file_location('cp3_stream', STREAM)
stream = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stream)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def accepted(config, scale):
    rng = stream.Xoshiro128StarStar11(config['seed'])
    kept = []
    comparisons = 0
    for index in range(config['attempts']):
        x, y, radius = stream.proposal(rng, config)
        rejected = False
        for _, old_x, old_y, old_radius in kept:
            dx, dy = x - old_x, y - old_y
            distance_squared = dx * dx + dy * dy
            threshold = (radius + old_radius) * scale
            comparisons += 1
            if distance_squared < threshold * threshold:
                rejected = True
                break
        if not rejected:
            kept.append((index, x, y, radius))
    digest = hashlib.sha256(b'cp3-retained-circles-v1\0')
    digest.update(struct.pack('>i', len(kept)))
    for item in kept:
        digest.update(struct.pack('>iddd', *item))
    return kept, {'accepted_count': len(kept), 'comparisons': comparisons,
                  'accepted_sha256': digest.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--numeric', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    numeric_path = args.numeric.resolve()
    output = args.output.resolve()
    if not numeric_path.is_relative_to(ROOT) or not output.is_relative_to(ROOT):
        raise ValueError('All work must remain in repository')
    java = json.loads(numeric_path.read_text())
    # Accept either raw numeric output or executor cache wrapper.
    java = java.get('native', java)
    assert java['status'] == 'passed' and java['experiment'] == 'cp3-placement'
    records = {}
    baseline_kept = None
    for name, maximum, scale in [('base-rings', 64.0, 1.0),
                                 ('more-separation', 64.0, 1.2),
                                 ('smaller-forms', 32.0, 1.0)]:
        config = {**stream.BASELINE, 'radius_max': maximum}
        kept, record = accepted(config, scale)
        for key, value in record.items():
            if java['profiles'][name][key] != value:
                raise AssertionError(f'{name}: Java differs on {key}')
        if name == 'base-rings':
            baseline_kept = kept
        records[name] = record
    extended, extension = accepted({**stream.BASELINE, 'attempts': 10000}, 1.0)
    assert extended[:len(baseline_kept)] == baseline_kept
    assert len(extended) == java['numeric_prefix']['accepted_10000']
    paths = [Path(__file__).resolve(), STREAM, numeric_path,
             Path(__file__).with_name('SpacingChoice.java'),
             ROOT / 'evidence/parameter-experiments/cp3-placement/experiment.json']
    report = {
        'status': 'passed', 'owner': 'root',
        'scope': 'Independent Python ordered-acceptance arithmetic using separately checked Python proposal oracle. Three seeded profiles and 5000-to-10000 accepted prefix; no radial, render or public port claim.',
        'input_sha256': {str(p.relative_to(ROOT)): sha(p) for p in paths},
        'profiles': records, 'extended_baseline': extension,
        'accepted_prefix_matches': True,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
