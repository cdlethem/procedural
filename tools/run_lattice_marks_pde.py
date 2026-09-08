#!/usr/bin/env python3
"""Run a registered, source-bound LatticeMarks native attempt under the render lock."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_profile_marks_pde import sha, rel, write, png, equal, classes
from tools.check_processing_runtime import CORE_SHA256
HOME = ROOT / '.work/toolchains/jdk-17.0.20.1+1'
CORE = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
STAGE = ROOT / '.work/examples/cp11-candidate2'
BUILD = STAGE / 'build'
LIBRARY = STAGE / 'LatticeMarks/code/procedurals.jar'
PROBE_BUILD = ROOT / '.work/build/cp11-probe-root1'
PROBE = ROOT / 'tools/diagnostics/cp11/LatticeMarksProbe.java'
KEYS = 'cm0w0l0n0r0s'
IDS = ['baseline', 'palette', 'dots', 'reset-mode', 'wide', 'reset-width',
       'longer', 'reset-length', 'more-starts', 'reset-count', 'new-seed', 'final-reset']


def bindings():
    report = json.loads((STAGE / 'result.json').read_text())
    if report['status'] != 'passed' or report['inputs_before'] != report['inputs_after']:
        raise RuntimeError('Stable candidate staging required')
    bound = {**report['inputs_after'], **report['artifacts_sha256']}
    for name, expected in bound.items():
        if sha(ROOT / name) != expected:
            raise RuntimeError('Changed staging input/output: ' + name)
    if sha(CORE) != CORE_SHA256:
        raise RuntimeError('Processing runtime differs')
    for path in [PROBE, Path(__file__), STAGE / 'result.json', HOME / 'bin/java',
                 HOME / 'release', HOME / 'lib/modules', HOME / 'lib/server/libjvm.so',
                 ROOT / 'tools/run_profile_marks_pde.py',
                 ROOT / 'design/capabilities/cp11-lattice-marks-acceptance.md']:
        bound[rel(path)] = sha(path)
    bound.update(classes(BUILD))
    bound.update(classes(PROBE_BUILD))
    if set(classes(PROBE_BUILD)) != {rel(PROBE_BUILD / 'LatticeMarksProbe.class')}:
        raise RuntimeError('Probe build must contain only the root probe class')
    return bound


def command(output):
    return ['xvfb-run', '-a', str(HOME / 'bin/java'), '-Xmx512m',
            '-Duser.home=' + str(output / 'home'), '-Djava.io.tmpdir=' + str(output / 'tmp'),
            '-cp', os.pathsep.join(map(str, [BUILD, PROBE_BUILD, CORE, LIBRARY])),
            'LatticeMarksProbe', str(output), str(LIBRARY)]


def validate_plan(path):
    plan = json.loads(path.read_text())
    for key, value in {'status': 'ready', 'owner': 'root', 'keys': KEYS,
                       'frame_ids': IDS, 'expected_frames': 12, 'timeout_seconds': 180}.items():
        if plan.get(key) != value:
            raise RuntimeError('Plan differs: ' + key)
    output, result = (ROOT / plan['output']).resolve(), (ROOT / plan['result']).resolve()
    output.relative_to(ROOT / '.work')
    result.relative_to(ROOT / 'evidence/reproductions')
    bound = bindings()
    if plan['command'] != command(output) or plan['source_sha256'] != bound:
        raise RuntimeError('Registered command/input bindings differ')
    bound[rel(path)] = sha(path)
    return plan, output, result, bound


def validate_native(output):
    native = json.loads((output / 'native.json').read_text())
    for key, value in {'status': 'passed', 'frames': 12, 'key_events': 12, 'keys': KEYS,
                       'renderer_class': 'processing.awt.PGraphicsJava2D'}.items():
        if native.get(key) != value:
            raise RuntimeError('Native report differs: ' + key)
    if [r['id'] for r in native['states']] != IDS:
        raise RuntimeError('State coverage differs')
    for i, r in enumerate(native['states']):
        if r['retained'] != (i in (1, 2, 4)):
            raise RuntimeError('Retained state differs: ' + r['id'])
    if Path(native['core_code_source']).resolve() != LIBRARY or Path(native['composition_code_source']).resolve() != BUILD:
        raise RuntimeError('Wrong native code source')
    if native['save_quiet_ms'] < 300:
        raise RuntimeError('Missing save quiet interval')
    images = {name: png(output / (name + '.png')) for name in IDS}
    for name in IDS:
        if ('reset' in name) and not equal(output / 'baseline.png', output / (name + '.png')):
            raise RuntimeError('Reset pixels differ: ' + name)
    saved = list(output.glob('lattice-marks-*.png'))
    if len(saved) != 1 or not equal(saved[0], output / 'final-reset.png'):
        raise RuntimeError('Saved image differs')
    if set(output.glob('*.png')) != {output / (n + '.png') for n in IDS} | set(saved):
        raise RuntimeError('Unexpected images')
    return {'native': native, 'images': images, 'saved_image': png(saved[0]),
            'reset_pixels_equal': True, 'save_pixels_equal': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    plan_path = args.plan.resolve()
    plan_path.relative_to(ROOT)
    plan, output, result, bound = validate_plan(plan_path)
    if not args.render:
        print(json.dumps({'status': 'validated', 'bound_inputs': len(bound)}))
        return
    if output.exists() or result.exists():
        raise RuntimeError('Preserve existing attempt; no rerender')
    with (ROOT / '.work/processing-render.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if validate_plan(plan_path)[3] != bound:
            raise RuntimeError('Inputs changed before reservation')
        processes = subprocess.run(['ps', '-eo', 'pid=,comm='], capture_output=True, text=True, check=True).stdout.splitlines()
        if any(line.split()[-1] in ('java', 'Xvfb') for line in processes if line.split()):
            raise RuntimeError('Another Java/Xvfb process is active; inspect before rendering')
        output.mkdir(parents=True)
        attempt = output / 'attempt.json'
        write(attempt, {'status': 'reserved', 'attempt_budget': 1, 'input_sha256': bound})
        report = {'status': 'failed', 'scope': plan['scope'], 'input_sha256': bound,
                  'visual_review': 'pending', 'command': command(output)}
        process = None
        try:
            for name in ('tmp', 'home'):
                (output / name).mkdir()
            with (output / 'stdout.log').open('x') as stdout, (output / 'stderr.log').open('x') as stderr:
                process = subprocess.Popen(command(output), cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
                write(attempt, {'status': 'running', 'pid': process.pid, 'attempt_budget': 1, 'input_sha256': bound})
                try:
                    exit_code = process.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError('LatticeMarks timed out')
            report['exit_code'] = exit_code
            report['stderr'] = (output / 'stderr.log').read_text()
            if exit_code != 0 or report['stderr']:
                raise RuntimeError('Probe failed or emitted stderr')
            report.update(validate_native(output))
            after = {name: sha(ROOT / name) for name in bound}
            if after != bound:
                raise RuntimeError('Inputs changed during attempt')
            report.update(status='passed', input_sha256_after=after)
        except Exception as error:
            report['error'] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            for channel in ('stdout', 'stderr'):
                if (output / (channel + '.log')).exists():
                    report[channel] = (output / (channel + '.log')).read_text()
            write(result, report)
            write(attempt, {'status': report['status'], 'attempt_budget': 1, 'input_sha256': bound})
        print(json.dumps({'status': report['status'], 'error': report.get('error')}))
        if report['status'] != 'passed':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
