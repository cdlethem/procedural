#!/usr/bin/env python3
"""Validate or run one root-registered, source-bound SpringMarks native attempt."""
from __future__ import annotations

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
STAGE = ROOT / '.work/examples/cp10-candidate1'
BUILD = STAGE / 'build'
LIBRARY = STAGE / 'SpringMarks/code/procedurals.jar'
PROBE = ROOT / 'tools/diagnostics/cp10/SpringMarksProbe.java'
ACCEPTANCE = ROOT / 'design/capabilities/cp10-spring-marks-acceptance.md'
TIMEOUT = 180


def command(output: Path, probe_build: Path) -> list[str]:
    return ['xvfb-run', '-a', str(HOME / 'bin/java'), '-Xmx512m',
            '-Duser.home=' + str(output / 'home'), '-Djava.io.tmpdir=' + str(output / 'tmp'),
            '-cp', os.pathsep.join(map(str, [BUILD, probe_build, CORE, LIBRARY])),
            'SpringMarksProbe', str(output), str(LIBRARY)]


def describe(probe_build: Path) -> dict:
    cp = os.pathsep.join(map(str, [probe_build, BUILD, LIBRARY, CORE]))
    result = subprocess.run([str(HOME / 'bin/java'), '-cp', cp, 'SpringMarksProbe', '--describe'],
                            cwd=ROOT, text=True, capture_output=True, timeout=30)
    if result.returncode or result.stderr:
        raise RuntimeError('SpringMarksProbe --describe failed: ' + result.stdout + result.stderr)
    value = json.loads(result.stdout)
    if set(value) != {'frame_ids', 'key_events'} or not isinstance(value['frame_ids'], list) or not isinstance(value['key_events'], list):
        raise RuntimeError('Probe description schema differs')
    ids = [x.get('id') for x in value['frame_ids'] if isinstance(x, dict)]
    if len(ids) != len(value['frame_ids']) or len(ids) != len(set(ids)) or not ids:
        raise RuntimeError('Probe frame IDs are not a nonempty unique sequence')
    for frame in value['frame_ids']:
        if set(frame) != {'id', 'tick', 'png', 'series'} or not isinstance(frame['tick'], int) or not isinstance(frame['png'], bool):
            raise RuntimeError('Probe frame description differs')
    if value['key_events'].count('.') < 2 or 's' not in value['key_events'] or 'space' not in value['key_events']:
        raise RuntimeError('Probe schedule omits Period/save/Space')
    return value


def compile_probe(build: Path) -> dict:
    build = build.resolve()
    build.relative_to(ROOT / '.work')
    if build.exists():
        raise RuntimeError('fresh probe build directory required: ' + str(build))
    build.mkdir(parents=True)
    cp = os.pathsep.join(map(str, [BUILD, LIBRARY, CORE]))
    result = subprocess.run([str(HOME / 'bin/javac'), '--release', '17', '-cp', cp, '-d', str(build), str(PROBE)],
                            cwd=ROOT, text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('Probe compile failed: ' + result.stdout + result.stderr)
    if set(classes(build)) != {rel(build / 'SpringMarksProbe.class'),
                               rel(build / 'SpringMarksProbe$Plan.class'), rel(build / 'SpringMarksProbe$Snapshot.class'),
                               rel(build / 'SpringMarksProbe$1.class'), rel(build / 'SpringMarksProbe$2.class')}:
        raise RuntimeError('Unexpected probe class output')
    return describe(build)


def bindings(probe_build: Path) -> dict[str, str]:
    report = json.loads((STAGE / 'result.json').read_text())
    if report.get('status') != 'passed' or report.get('inputs_before') != report.get('inputs_after'):
        raise RuntimeError('Stable CP10 candidate staging required')
    bound = {**report['inputs_after'], **report['artifacts_sha256']}
    for name, expected in bound.items():
        if sha(ROOT / name) != expected:
            raise RuntimeError('Changed staging input/output: ' + name)
    if sha(CORE) != CORE_SHA256:
        raise RuntimeError('Processing runtime differs')
    for path in [PROBE, Path(__file__).resolve(), ACCEPTANCE, HOME / 'bin/java', HOME / 'bin/javac', HOME / 'release',
                 HOME / 'lib/modules', HOME / 'lib/server/libjvm.so', ROOT / 'tools/run_profile_marks_pde.py']:
        bound[rel(path)] = sha(path)
    bound.update(classes(BUILD)); bound.update(classes(probe_build))
    return bound


def registered(plan_path: Path) -> tuple[dict, Path, Path, Path, dict, dict]:
    plan = json.loads(plan_path.read_text())
    if plan.get('status') != 'ready' or plan.get('owner') != 'root' or plan.get('timeout_seconds') != TIMEOUT:
        raise RuntimeError('A root-ready SpringMarks plan is required')
    output = (ROOT / plan.get('output', '')).resolve(); result = (ROOT / plan.get('result', '')).resolve()
    probe_build = (ROOT / plan.get('probe_build', '')).resolve()
    output.relative_to(ROOT / '.work'); result.relative_to(ROOT / 'evidence/reproductions'); probe_build.relative_to(ROOT / '.work')
    schedule = describe(probe_build)
    if plan.get('schedule') != schedule:
        raise RuntimeError('Registered schedule differs from probe --describe')
    captures = [frame['id'] + '.png' for frame in schedule['frame_ids'] if frame['png']]
    if plan.get('captured_images') != captures or len(captures) < 40:
        raise RuntimeError('Registered capture set differs or is unexpectedly small')
    bound = bindings(probe_build)
    if plan.get('command') != command(output, probe_build) or plan.get('source_sha256') != bound:
        raise RuntimeError('Registered command/input bindings differ')
    return plan, output, result, probe_build, bound, schedule


def validate_native(output: Path, schedule: dict) -> dict:
    native = json.loads((output / 'native.json').read_text())
    if native.get('status') != 'passed' or native.get('renderer_class') != 'processing.awt.PGraphicsJava2D':
        raise RuntimeError('Native status or renderer differs')
    if Path(native.get('core_code_source', '')).resolve() != LIBRARY.resolve() or Path(native.get('composition_code_source', '')).resolve() != BUILD.resolve():
        raise RuntimeError('Native code origins differ')
    frames = schedule['frame_ids']
    states = native.get('states')
    if not isinstance(states, list) or [x.get('id') for x in states if isinstance(x, dict)] != [x['id'] for x in frames]:
        raise RuntimeError('Native state IDs differ')
    for wanted, observed in zip(frames, states):
        if observed.get('tick') != wanted['tick'] or not all(isinstance(observed.get(k), str) and len(observed[k]) == 64
                for k in ('state_sha256', 'targets_sha256', 'history_sha256')):
            raise RuntimeError('Native state tick/hash differs: ' + wanted['id'])
    images = {name: png(output / name) for name in [x['id'] + '.png' for x in frames if x['png']]}
    expected = set(images)
    saved_name = native.get('saved_filename')
    if not isinstance(saved_name, str) or not saved_name.startswith('spring-marks-') or saved_name in expected:
        raise RuntimeError('Saved filename differs')
    saved = output / saved_name
    if not saved.is_file() or not equal(saved, output / 'primary-030.png'):
        raise RuntimeError('Cached save pixels differ from completed running tick30')
    actual = {path.name for path in output.glob('*.png')}
    if actual != expected | {saved_name}:
        raise RuntimeError('Unexpected or missing PNG output')
    for suffix in ('001', '010', '030', '060', '120'):
        left = 'period-001.png' if suffix == '001' else 'primary-' + suffix + '.png'
        right = 'replay-' + suffix + '.png'
        if not equal(output / left, output / right):
            raise RuntimeError('Primary/replay pixels differ: ' + suffix)
    return {'native': native, 'images': images, 'saved_image': png(saved), 'save_pixels_equal': True,
            'primary_replay_pixels_equal': True}


def write_draft(path: Path, probe_build: Path) -> None:
    path = path.resolve(); path.relative_to(ROOT / '.work')
    if path.exists(): raise RuntimeError('Preserve existing draft plan')
    schedule = describe(probe_build); bound = bindings(probe_build)
    output = ROOT / '.work/reproductions/cp10-spring-marks-root1'
    result = ROOT / 'evidence/reproductions/cp10-java2d/result.json'
    value = {'status': 'draft', 'owner': 'terra', 'scope': 'One registered CP10 SpringMarks JAVA2D native attempt; visual review remains root-owned.',
             'timeout_seconds': TIMEOUT, 'probe_build': rel(probe_build), 'output': rel(output), 'result': rel(result),
             'schedule': schedule, 'captured_images': [frame['id'] + '.png' for frame in schedule['frame_ids'] if frame['png']],
             'command': command(output, probe_build), 'source_sha256': bound}
    write(path, value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compile-build', type=Path)
    parser.add_argument('--write-draft-plan', type=Path)
    parser.add_argument('--probe-build', type=Path)
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    if args.compile_build is not None:
        if args.plan is not None or args.render or args.write_draft_plan is not None:
            raise RuntimeError('--compile-build is separate from plan execution')
        schedule = compile_probe(args.compile_build)
        print(json.dumps({'status': 'compiled', 'probe_build': rel(args.compile_build.resolve()), 'schedule': schedule}))
        return 0
    if args.write_draft_plan is not None:
        if args.plan is not None or args.render or args.probe_build is None:
            raise RuntimeError('--write-draft-plan requires only --probe-build')
        write_draft(args.write_draft_plan, args.probe_build.resolve())
        print(json.dumps({'status': 'draft', 'plan': rel(args.write_draft_plan.resolve())}))
        return 0
    if args.plan is None:
        raise RuntimeError('--plan is required unless compiling a fresh probe')
    plan_path = args.plan.resolve(); plan_path.relative_to(ROOT)
    plan, output, result, probe_build, bound, schedule = registered(plan_path)
    if not args.render:
        print(json.dumps({'status': 'validated', 'bound_inputs': len(bound), 'frames': len(schedule['frame_ids']),
                          'captures': len(plan['captured_images'])}))
        return 0
    if output.exists() or result.exists():
        raise RuntimeError('Preserve existing attempt; fresh output/result required')
    lock_path = ROOT / '.work/processing-render.lock'; lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if bindings(probe_build) != bound or describe(probe_build) != schedule:
            raise RuntimeError('Inputs or schedule changed before reservation')
        processes = subprocess.run(['ps', '-eo', 'pid=,comm='], capture_output=True, text=True, check=True).stdout.splitlines()
        if any(line.split()[-1] in ('java', 'Xvfb') for line in processes if line.split()):
            raise RuntimeError('Another Java/Xvfb process is active; inspect before rendering')
        bound[rel(plan_path)] = sha(plan_path)
        output.mkdir(parents=True); (output / 'tmp').mkdir(); (output / 'home').mkdir()
        attempt = output / 'attempt.json'; write(attempt, {'status': 'reserved', 'attempt_budget': 1, 'input_sha256': bound})
        report = {'status': 'failed', 'scope': plan.get('scope'), 'input_sha256': bound, 'visual_review': 'pending',
                  'command': command(output, probe_build)}
        process = None
        try:
            with (output / 'stdout.log').open('x') as stdout, (output / 'stderr.log').open('x') as stderr:
                process = subprocess.Popen(command(output, probe_build), cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
                write(attempt, {'status': 'running', 'pid': process.pid, 'attempt_budget': 1, 'input_sha256': bound})
                try: exit_code = process.wait(timeout=TIMEOUT)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL); process.wait(); raise RuntimeError('SpringMarks timed out')
            report['exit_code'] = exit_code; report['stderr'] = (output / 'stderr.log').read_text()
            if exit_code != 0 or report['stderr']:
                raise RuntimeError('Probe failed or emitted stderr')
            report.update(validate_native(output, schedule))
            after = {name: sha(ROOT / name) for name in bound}
            if after != bound: raise RuntimeError('Inputs changed during attempt')
            report.update(status='passed', input_sha256_after=after)
        except Exception as error:
            report['error'] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL); process.wait()
            for channel in ('stdout', 'stderr'):
                if (output / (channel + '.log')).exists(): report[channel] = (output / (channel + '.log')).read_text()
            write(result, report); write(attempt, {'status': report['status'], 'attempt_budget': 1, 'input_sha256': bound})
        print(json.dumps({'status': report['status'], 'error': report.get('error')}))
        if report['status'] != 'passed': raise SystemExit(1)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
