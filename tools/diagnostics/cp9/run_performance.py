#!/usr/bin/env python3
"""Run the registered CP9 Java workloads in a new, preserved attempt directory."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CORE = ROOT / 'packages/java/src/main/java/org/procedurals/topology/Delaunay2D.java'
PROBE = ROOT / 'tools/diagnostics/cp9/DelaunayPerformance.java'
PLAN = ROOT / 'design/operations/cp9-performance-plan.md'
JDK = ROOT / '.work/toolchains/jdk-17.0.20.1+1'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='new repository .work attempt directory')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to((ROOT / '.work').resolve()):
        parser.error('output must remain inside repository .work')
    output.mkdir(parents=True, exist_ok=False)
    classes = output / 'classes'
    classes.mkdir()
    sources = [CORE, PROBE, PLAN, Path(__file__).resolve(),
               ROOT / 'catalog/operations/delaunay-2d.json',
               ROOT / 'fixtures/operations/delaunay-2d.json']
    result: dict = {'status': 'running', 'source_sha256': {str(p.relative_to(ROOT)): sha(p) for p in sources},
                    'java_home': str(JDK.relative_to(ROOT)), 'jvm_options': ['-Xms64m', '-Xmx512m'],
                    'runtime_timeout_seconds': 180, 'scope': 'Native desktop core performance only; root acceptance is separate.'}
    destination = output / 'result.json'
    destination.write_text(json.dumps(result, indent=2) + '\n')
    began = time.monotonic()
    try:
        for name in ('java', 'javac'):
            result[name + '_executable_sha256'] = sha(JDK / 'bin' / name)
        with (output / 'compile.stdout').open('w') as stdout, (output / 'compile.stderr').open('w') as stderr:
            subprocess.run([str(JDK / 'bin/javac'), '-implicit:none', '-sourcepath', '', '-d', str(classes),
                            str(CORE), str(PROBE)], cwd=ROOT, stdout=stdout, stderr=stderr, check=True, timeout=60)
        with (output / 'runtime.jsonl').open('w') as stdout, (output / 'runtime.stderr').open('w') as stderr:
            subprocess.run([str(JDK / 'bin/java'), *result['jvm_options'], '-cp', str(classes), 'DelaunayPerformance'],
                           cwd=ROOT, stdout=stdout, stderr=stderr, check=True, timeout=180)
        rows = [json.loads(line) for line in (output / 'runtime.jsonl').read_text().splitlines()]
        if len(rows) != 10 or rows[-1] != {'kind': 'complete', 'workloads': 8, 'status': 'passed'}:
            raise ValueError('missing complete eight-workload report')
        if (output / 'runtime.stderr').read_text():
            raise ValueError('unexpected runtime stderr')
        after = {str(p.relative_to(ROOT)): sha(p) for p in sources}
        if after != result['source_sha256']:
            raise ValueError('a bound source changed during the run')
        result['status'] = 'passed'
        result['environment'] = rows[0]
        result['workloads'] = rows[1:-1]
        result['runtime_jsonl_sha256'] = sha(output / 'runtime.jsonl')
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        result['status'] = 'failed'
        result['error'] = str(error)
    finally:
        result['elapsed_seconds'] = time.monotonic() - began
        destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'result': str(destination.relative_to(ROOT))}))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
