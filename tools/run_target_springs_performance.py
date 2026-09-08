#!/usr/bin/env python3
"""Record CP10 native setup/step/traversal measurements; no renderer or support claim."""
from __future__ import annotations
import argparse
import hashlib
import json
import platform
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'packages/java/src/main/java/org/procedurals/motion/TargetSprings2D.java'
HARNESS = ROOT / 'tests/native/TargetSpringsPerformance.java'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jdk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / '.work')
    if output.exists():
        raise SystemExit('Refusing to overwrite an existing measurement directory')
    jdk = args.jdk.resolve()
    bindings = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in (CORE, HARNESS, Path(__file__).resolve(),
                          ROOT/'catalog/operations/target-springs-2d.json',
                          ROOT/'fixtures/operations/target-springs-2d.json')}
    output.mkdir(parents=True)
    classes = output/'classes'
    classes.mkdir()
    result = {'status': 'running', 'scope': 'Native Java performance observations only',
              'bindings': bindings, 'commands': [],
              'host': {'platform': platform.platform(), 'machine': platform.machine(),
                       'processor': platform.processor()},
              'limitations': ['Desktop JDK only; no Android or renderer estimate',
                              'Setup excludes caller input construction',
                              'Thread allocation measures bytes allocated, not retained heap',
                              'No universal latency guarantee or artistic parameter range']}
    result_path = output/'result.json'

    def save():
        result_path.write_text(json.dumps(result, indent=2)+'\n')

    def run(label, command):
        result['commands'].append([str(c) for c in command])
        save()
        proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=180)
        (output/(label+'.stdout')).write_text(proc.stdout)
        (output/(label+'.stderr')).write_text(proc.stderr)
        if proc.returncode:
            raise RuntimeError(f'{label} exited {proc.returncode}')
        return proc

    save()
    try:
        runtime = run('runtime', [str(jdk/'bin/java'), '-version'])
        result['runtime'] = runtime.stdout+runtime.stderr
        # The instrumentation uses the JDK allocation extension; the library core is
        # separately compiled against Java8 by the semantic conformance runner.
        run('compile', [str(jdk/'bin/javac'), '-d', str(classes), str(CORE), str(HARNESS)])
        proc = run('measure', [str(jdk/'bin/java'), '-Xms128m', '-Xmx512m', '-cp', str(classes),
                               'org.procedurals.motion.TargetSpringsPerformance'])
        result['measurement'] = json.loads(proc.stdout)
        result['packed_steps_zero_allocated_bytes'] = all(
            w['step_allocated_bytes'] == 0 for w in result['measurement']['workloads'])
        result['status'] = 'measured'
    except Exception as error:
        result['status'] = 'failed'
        result['failure'] = str(error)
        raise
    finally:
        save()
    print(result_path)


if __name__ == '__main__':
    main()
