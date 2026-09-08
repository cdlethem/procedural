#!/usr/bin/env python3
"""Validate or execute one source-bound GlyphMarks native attempt."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_profile_marks_pde import sha, rel, write, safe, png, equal, classes
from tools.check_processing_runtime import CORE_SHA256

HOME = ROOT / '.work/toolchains/jdk-17.0.20.1+1'
CORE = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
SKETCH = ROOT / '.work/examples/cp8-first/GlyphMarks'
LIBRARY = SKETCH / 'code/procedurals.jar'
BUILD = ROOT / '.work/build/cp8-pde-staged'
PROBE_BUILD = ROOT / '.work/build/cp8-probe-reviewed'
PROBE = ROOT / 'tools/diagnostics/cp8/GlyphMarksProbe.java'
KEYS = 'n0d0g0m0c0v0f0r0s'
IDS = ['baseline', 'short', 'reset-short', 'sparse', 'reset-sparse', 'letters',
       'reset-letters', 'dots', 'reset-dots', 'colour', 'reset-colour', 'distance',
       'reset-distance', 'field-scale', 'reset-field-scale', 'new-seed', 'reset-seed']


def bindings():
    report = json.loads((BUILD / 'result.json').read_text())
    if report['status'] != 'passed' or report['inputs_before'] != report['inputs_after']:
        raise RuntimeError('Staged PDE compile/check must pass with stable inputs')
    if report['sketch_dir'] != str(SKETCH) or report['core_jar'] != str(LIBRARY):
        raise RuntimeError('PDE compile did not use the staged sketch and core')
    bound = {}
    for name, value in report['inputs_after'].items():
        path = Path(name)
        if sha(path) != value:
            raise RuntimeError('Changed compile input: ' + name)
        bound[rel(path)] = value
    stage = json.loads((SKETCH / 'staging.json').read_text())
    for name, value in stage['staged_sha256'].items():
        path = safe(SKETCH, name)
        if path is None or sha(path) != value:
            raise RuntimeError('Staged asset changed: ' + name)
        bound[rel(path)] = value
    if sha(CORE) != CORE_SHA256:
        raise RuntimeError('Processing runtime differs')
    for path in [PROBE, Path(__file__).resolve(), BUILD / 'result.json',
                 SKETCH / 'staging.json', HOME / 'release', HOME / 'bin/java',
                 HOME / 'lib/modules', HOME / 'lib/server/libjvm.so',
                 ROOT / 'tools/run_profile_marks_pde.py',
                 ROOT / 'design/capabilities/cp8-native-acceptance.md']:
        bound[rel(path)] = sha(path)
    bound.update(classes(BUILD))
    bound.update(classes(PROBE_BUILD))
    return bound


def command(output):
    return ['xvfb-run', '-a', str(HOME / 'bin/java'),
            '-Duser.home=' + str(output / 'home'), '-Djava.io.tmpdir=' + str(output / 'tmp'),
            '-cp', os.pathsep.join(map(str, [BUILD, PROBE_BUILD, CORE, LIBRARY])),
            'GlyphMarksProbe', str(output), str(LIBRARY)]


def validate_plan(path):
    plan = json.loads(path.read_text())
    if plan.get('status') != 'ready' or plan.get('owner') != 'root':
        raise RuntimeError('Root-reviewed ready plan required')
    for key, value in {'keys': KEYS, 'frame_ids': IDS, 'expected_frames': 17,
                       'expected_stamp_calls': 120960, 'timeout_seconds': 180}.items():
        if plan.get(key) != value:
            raise RuntimeError('Plan differs: ' + key)
    output, result = safe(ROOT, plan.get('output')), safe(ROOT, plan.get('result'))
    if output is None or result is None or not output.is_relative_to(ROOT / '.work'):
        raise RuntimeError('Unsafe output/result path')
    if plan.get('command') != command(output):
        raise RuntimeError('Registered command differs')
    bound = bindings()
    if plan.get('source_sha256') != bound:
        raise RuntimeError('Registered source bindings differ')
    bound[rel(path)] = sha(path)
    return plan, output, result, bound


def validate_native(output):
    native = json.loads((output / 'native.json').read_text())
    for key, value in {'status': 'passed', 'frames': 17, 'key_events': 17, 'keys': KEYS,
                       'total_text_calls': 113280, 'total_ellipse_calls': 7680,
                       'total_fill_calls': 120960,
                       'renderer_class': 'processing.awt.PGraphicsJava2D'}.items():
        if native.get(key) != value:
            raise RuntimeError('Native proof differs: ' + key)
    if [r['id'] for r in native['states']] != IDS:
        raise RuntimeError('Frame sequence differs')
    for index, record in enumerate(native['states']):
        count = 3840 if index == 1 else 1920 if index == 3 else 7680
        if record['stamps'] != count or record['fill_calls'] != count:
            raise RuntimeError('Actual per-state stamp count differs')
        if record['ellipse_calls'] != (count if index == 7 else 0):
            raise RuntimeError('Actual dot count differs')
        if record['text_calls'] != (0 if index == 7 else count):
            raise RuntimeError('Actual glyph count differs')
    if Path(native['core_code_source']).resolve() != LIBRARY:
        raise RuntimeError('Core did not load from staged JAR')
    if Path(native['composition_code_source']).resolve() != BUILD or Path(native['font_loader_code_source']).resolve() != BUILD:
        raise RuntimeError('Helper did not load from staged compilation')
    if Path(native['palette_code_source']).resolve() != LIBRARY:
        raise RuntimeError('Palette did not load from staged JAR')
    if native['save_quiet_ms'] < 300:
        raise RuntimeError('Save quiet interval missing')
    font = native['font']
    if font['sha256'] != sha(SKETCH / 'data/GlyphMarks.ttf') or font['postscript_name'] != 'DejaVuSans':
        raise RuntimeError('Native font identity differs')
    if font['required_glyphs'] != '0123456789ABCDEFGHIJ' or Path(font['path']).resolve() != output / 'data/GlyphMarks.ttf':
        raise RuntimeError('Native font location/coverage declaration differs')
    images = {name: png(output / (name + '.png')) for name in IDS}
    for name in IDS:
        if name.startswith('reset-') and not equal(output / 'baseline.png', output / (name + '.png')):
            raise RuntimeError('Reset pixels differ: ' + name)
    saved = list(output.glob('glyph-marks-*.png'))
    if len(saved) != 1 or not equal(saved[0], output / 'reset-seed.png'):
        raise RuntimeError('S-key image differs from displayed final reset')
    if set(output.glob('*.png')) != {output / (n + '.png') for n in IDS} | set(saved):
        raise RuntimeError('Unexpected PNG outputs')
    for name in ('GlyphMarks.ttf', 'FONT-LICENSE.txt'):
        if sha(output / 'data' / name) != sha(SKETCH / 'data' / name):
            raise RuntimeError('Runtime font/license differs')
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
        # Check actual live runtimes in addition to the cooperative render lock.
        processes = subprocess.run(['ps', '-eo', 'pid=,comm='], capture_output=True,
                                   text=True, check=True).stdout.splitlines()
        if any(line.split()[-1] in ('java', 'Xvfb') for line in processes if line.split()):
            raise RuntimeError('Another Java/Xvfb process is active; inspect it before rendering')
        output.mkdir(parents=True)
        attempt = output / 'attempt.json'
        write(attempt, {'status': 'reserved', 'attempt_budget': 1, 'input_sha256': bound})
        report = {'status': 'failed', 'scope': plan['scope'], 'input_sha256': bound,
                  'visual_review': 'pending', 'command': command(output)}
        process = None
        try:
            for name in ('tmp', 'home', 'data'):
                (output / name).mkdir()
            for name in ('GlyphMarks.ttf', 'FONT-LICENSE.txt'):
                (output / 'data' / name).write_bytes((SKETCH / 'data' / name).read_bytes())
            with (output / 'stdout.log').open('x') as stdout, (output / 'stderr.log').open('x') as stderr:
                process = subprocess.Popen(command(output), cwd=ROOT, stdout=stdout,
                                           stderr=stderr, start_new_session=True)
                write(attempt, {'status': 'running', 'pid': process.pid, 'attempt_budget': 1,
                                'input_sha256': bound})
                try:
                    exit_code = process.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError('GlyphMarks timed out')
            report['exit_code'] = exit_code
            report['stdout'] = (output / 'stdout.log').read_text()
            report['stderr'] = (output / 'stderr.log').read_text()
            if exit_code != 0 or report['stderr']:
                raise RuntimeError('Probe failed or emitted unexpected stderr')
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
            write(attempt, {'status': report['status'], 'attempt_budget': 1,
                            'input_sha256': bound})
        print(json.dumps({'status': report['status'], 'error': report.get('error')}))
        if report['status'] != 'passed':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
