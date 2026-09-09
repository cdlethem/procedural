#!/usr/bin/env python3
"""Record bounded SegmentClip2D allocation/timing measurements with source/runtime hashes."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--java-home', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if (ROOT / '.work').resolve() not in output.parents or output.exists():
        raise ValueError('Output must be fresh below .work')
    jdk = args.java_home.resolve()
    sources = [ROOT / 'packages/java/src/main/java/org/procedurals/geometry/SegmentClip2D.java',
               ROOT / 'tools/diagnostics/clipping/SegmentClipPerformance.java']
    inputs = [*sources, Path(__file__).resolve(), jdk / 'bin/java', jdk / 'bin/javac',
              jdk / 'release', jdk / 'lib/modules']
    before = {str(p): sha(p) for p in inputs}
    output.mkdir(parents=True)
    subprocess.run([str(jdk / 'bin/javac'), '--release', '8', '-d', str(output),
                    *map(str, sources)], check=True, capture_output=True, text=True, timeout=60)
    result = subprocess.run([str(jdk / 'bin/java'), '-cp', str(output), 'SegmentClipPerformance'],
                            check=True, capture_output=True, text=True, timeout=60)
    measurements = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    after = {str(p): sha(p) for p in inputs}
    if before != after:
        raise RuntimeError('Measurement inputs changed')
    report = {'status': 'measured', 'inputs_before': before, 'inputs_after': after,
              'measurements': measurements, 'stderr': result.stderr,
              'class_sha256': {str(p.relative_to(output)): sha(p) for p in output.rglob('*.class')},
              'scope': 'Bounded diagnostic; no universal latency or allocation guarantee.'}
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': 'measured', 'report': str(output / 'result.json')}))


if __name__ == '__main__':
    main()
