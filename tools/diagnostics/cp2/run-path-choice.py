#!/usr/bin/env python3
"""Compile/check the CP2 design probe, or execute exactly one registered image."""
import argparse
import fcntl
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from tools.check_processing_runtime import CORE_SHA256, VERSION
from tools.run_grid_conformance import java_home


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)



def validate_pure(pure, plan):
    if pure.get('status') != 'passed' or pure.get('experiment') != plan['id'] or pure.get('steps') != 2000 or pure.get('path_count') != 24:
        raise RuntimeError('Unexpected pure check identity/counts')
    checks = ['shared_retained_movement', 'recolour_zero_field_queries', 'prefix_2000_of_2001', 'step_distance_changes_query', 'angle_scale_zero_constant', 'finite', 'field_unchanged']
    if any(pure.get('pure_checks', {}).get(key) is not True for key in checks):
        raise RuntimeError('Missing or failed pure check')
    config = pure['configuration']
    for key in ('starts', 'steps', 'step_distance', 'coordinate_scale', 'coordinate_offset', 'angle_base', 'angle_scale'):
        if config['movement'][key] != plan['movement'][key]:
            raise RuntimeError('Probe configuration differs from plan: ' + key)
    if config['field'] != {'id': plan['environment']['field'], 'version': plan['environment']['version'], 'seed': plan['environment']['seed']}:
        raise RuntimeError('Wrong probe field')
    for key, value in config['render'].items():
        if value != plan['environment'][key]:
            raise RuntimeError('Wrong render configuration: ' + key)
    for key in ('trace', 'marks', 'long_marks', 'finer_field'):
        item = pure['hashes'][key]
        if item['command_count'] != (48000 if key == 'trace' else 12000):
            raise RuntimeError('Wrong pure command count')
        for name in ('model_sha256', 'movement_sha256', 'geometry_sha256', 'colour_sha256'):
            if not isinstance(item.get(name), str) or re.fullmatch('[0-9a-f]{64}', item[name]) is None:
                raise RuntimeError('Missing pure hash: ' + name)
    if len({pure['hashes'][key]['movement_sha256'] for key in ('trace', 'marks', 'long_marks')}) != 1:
        raise RuntimeError('Mark cases do not share movement')


def validate_native(native, pure, case_id):
    if native.get('status') != 'rendered' or native.get('experiment') != 'cp2-path-choice' or native.get('case_id') != case_id or native.get('steps') != 2000 or native.get('path_count') != 24:
        raise RuntimeError('Unexpected rendered case identity/counts')
    if native.get('configuration') != pure['configuration']:
        raise RuntimeError('Rendered registration differs from checked configuration')
    expected = {'coordinate_scale': [0.01, 0.01] if case_id == 'finer-field' else [0.002, 0.002],
                'mark_length': 0 if case_id == 'trace' else (24 if case_id == 'long-marks' else 12),
                'mark_stride': 1 if case_id == 'trace' else 4}
    if native.get('actual_case') != expected:
        raise RuntimeError('Unexpected actual render settings')
    if native.get('hashes') != pure['hashes'][case_id.replace('-', '_')]:
        raise RuntimeError('Rendered model/command evidence differs from pure checks')
    if native.get('pre_draw_hashes') != native['hashes'] or native.get('post_draw_hashes') != native['hashes']:
        raise RuntimeError('Drawing changed retained geometry/commands')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case', choices=['trace', 'marks', 'long-marks', 'finer-field'])
    parser.add_argument('--java-home')
    args = parser.parse_args()
    plan_path = ROOT / 'evidence/parameter-experiments/cp2-path-choice/experiment.json'
    plan = json.loads(plan_path.read_text())
    case_ids = [case['id'] for case in plan['cases']]
    if case_ids != ['trace', 'marks', 'long-marks', 'finer-field'] or len(set(case_ids)) != len(case_ids) or plan['render_budget'] != len(case_ids):
        raise RuntimeError('Unexpected case registration or render budget')
    home = java_home(args.java_home)
    core = ROOT / '.work/dist/java/procedurals-core-0.1.0.jar'
    processing = ROOT / f'.work/toolchains/processing-{VERSION}/core-{VERSION}.jar'
    source = Path(__file__).with_name('PathChoice.java')
    distribution = ROOT / 'evidence/distribution/java-artifacts.json'
    distribution_data = json.loads(distribution.read_text())
    # Check recorded source bindings before claiming the artifact reflects this checkout.
    bindings = distribution_data.get('input_sha256', {})
    if not bindings:
        raise RuntimeError('Java artifact report has no source bindings')
    for name, digest in bindings.items():
        path = ROOT / name
        if sha(path) != digest:
            raise RuntimeError('Stale Java artifact source binding: ' + name)
    if sha(processing) != CORE_SHA256:
        raise RuntimeError('Processing runtime does not match pinned checksum')
    # The consumed JAR itself must be in its generated artifact report.
    if sha(core) != distribution_data['artifacts']['core_jar']['sha256']:
        raise RuntimeError('Core JAR hash absent from artifact report')
    output = (ROOT / plan['output']).resolve()
    if not output.is_relative_to(ROOT / '.work'):
        raise RuntimeError('Experiment output must remain in ignored .work')
    output.mkdir(parents=True, exist_ok=True)
    build = ROOT / '.work/build/cp2-path-choice'
    build.mkdir(parents=True, exist_ok=True)
    paths = [plan_path, source, Path(__file__).resolve(), core, processing, distribution, ROOT / 'catalog/operations/gradient-noise-2d-01.json', ROOT / 'design/capabilities/cp2-architecture-decision.md']
    inputs = {str(p.relative_to(ROOT)): sha(p) for p in paths}
    (output / 'home').mkdir(exist_ok=True)
    (output / 'tmp').mkdir(exist_ok=True)
    command = [str(home / 'bin/java'), '-Duser.home=' + str(output / 'home'), '-cp', os.pathsep.join([str(build), str(core), str(processing)]), 'PathChoice']
    cached_path = build / 'pure.json'
    cached = json.loads(cached_path.read_text()) if cached_path.exists() else {}
    classes = {str(p.relative_to(build)): sha(p) for p in build.glob('PathChoice*.class')}
    if cached.get('input_sha256') == inputs and classes and cached.get('class_sha256') == classes:
        pure = cached['native']
    else:
        compiled = subprocess.run([str(home / 'bin/javac'), '--release', '8', '-cp', os.pathsep.join([str(core), str(processing)]), '-d', str(build), str(source)], text=True, capture_output=True, timeout=60, check=True)
        checked = subprocess.run(command + ['--check'], text=True, capture_output=True, timeout=90, check=True)
        pure = json.loads(checked.stdout)
        classes = {str(p.relative_to(build)): sha(p) for p in build.glob('PathChoice*.class')}
        write(cached_path, {'input_sha256': inputs, 'class_sha256': classes, 'native': pure, 'stderr': checked.stderr, 'compiler_stderr': compiled.stderr})
    validate_pure(pure, plan)
    if args.case is None:
        print(json.dumps({'status': 'checked', 'pure': pure}))
        return
    # Root owns native execution. Each invocation is one pausable scheduling unit.
    lock_path = ROOT / '.work/processing-render.lock'
    with lock_path.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        case_ids = [case['id'] for case in plan['cases']]
        attempts = sorted(output.glob('attempt-*.json'))
        expected = case_ids[len(attempts)] if len(attempts) < len(case_ids) else None
        if args.case != expected or len(attempts) >= plan['render_budget']:
            raise RuntimeError('Case is not the next unconsumed attempt; no automatic retry')
        for previous in attempts:
            old = json.loads(previous.read_text())
            if old['status'] != 'rendered' or old['input_sha256'] != inputs:
                raise RuntimeError('Prior attempt failed, is live/unresolved, or has different inputs; inspect before proceeding')
        attempt_path = output / f'attempt-{len(attempts):02d}.json'
        attempt = {'case': args.case, 'status': 'reserved', 'input_sha256': inputs, 'executor_pid': os.getpid()}
        with attempt_path.open('x') as stream:
            json.dump(attempt, stream, indent=2)
        destination = output / (args.case + '.png')
        process = None
        try:
            process = subprocess.Popen(['xvfb-run', '-a', *command, args.case, str(destination)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True, env={**os.environ, 'TMPDIR': str(output / 'tmp')})
            attempt.update(status='running', process_pid=process.pid)
            write(attempt_path, attempt)
            try:
                stdout, stderr = process.communicate(timeout=plan['attempt_timeout_seconds'])
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate()
                raise RuntimeError('Registered render timed out; attempt consumed')
            if process.returncode:
                raise RuntimeError(f'Render exited {process.returncode}: {stderr}')
            native = json.loads(stdout)
            validate_native(native, pure, args.case)
            from PIL import Image
            with Image.open(destination) as image:
                if list(image.size) != plan['environment']['dimensions']:
                    raise RuntimeError('Unexpected image dimensions')
                rgba = image.convert('RGBA').tobytes()
            if any(rgba[i] != 255 for i in range(3, len(rgba), 4)):
                raise RuntimeError('Nonopaque image')
            if inputs != {str(p.relative_to(ROOT)): sha(p) for p in paths}:
                raise RuntimeError('Inputs changed during render')
            attempt.update(status='rendered', native=native, stderr=stderr, pure=pure,
                           image={'path': str(destination.relative_to(ROOT)), 'sha256': sha(destination), 'rgba_sha256': hashlib.sha256(rgba).hexdigest()})
        except BaseException as error:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            attempt.update(status='failed', error=str(error))
            raise
        finally:
            write(attempt_path, attempt)
            current = [json.loads(p.read_text()) for p in sorted(output.glob('attempt-*.json'))]
            report = {'scope': plan['scope'], 'status': 'rendering_complete' if len(current) == len(case_ids) and all(a['status'] == 'rendered' for a in current) else 'incomplete', 'visual_review': 'pending', 'attempts': current}
            if report['status'] == 'rendering_complete':
                from PIL import Image, ImageChops
                images = {}
                for item in current:
                    path = ROOT / item['image']['path']
                    if sha(path) != item['image']['sha256']:
                        raise RuntimeError('Previously rendered image changed')
                    with Image.open(path) as image:
                        images[item['case']] = image.convert('RGB')
                metrics = []
                for i, first in enumerate(case_ids):
                    for second in case_ids[i + 1:]:
                        difference = ImageChops.difference(images[first], images[second]).tobytes()
                        changed = sum(any(difference[j:j+3]) for j in range(0, len(difference), 3))
                        metrics.append({'first': first, 'second': second,
                                        'mean_absolute_rgb_difference_01': sum(difference) / (255 * len(difference)),
                                        'changed_pixels': changed, 'changed_fraction': changed / (len(difference) / 3)})
                report['pairwise_rgb_differences'] = metrics
            write(ROOT / 'evidence/parameter-experiments/cp2-path-choice/result.json', report)
        print(json.dumps({'status': attempt['status'], 'case': args.case, 'image': attempt['image']}))


if __name__ == '__main__':
    main()
