#!/usr/bin/env python3
"""Compile/preflight CP4 privately; --render consumes its single five-image attempt."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
PLAN = ROOT / 'evidence/parameter-experiments/cp4-regions/experiment.json'
REPORT = PLAN.with_name('result.json')
SOURCE = ROOT / 'tools/diagnostics/cp4/RegionChoice.java'
BUILD = ROOT / '.work/build/cp4-regions-executor'
OUTPUT = ROOT / '.work/experiments/cp4-regions'
CORE = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
JAVA = ROOT / '.work/toolchains/jdk-17.0.20.1+1/bin'
CASES = ['100half', '200half', '100full', 'same100half-contentgrid', 'explicit-grid-refinement-transfer']


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    temporary = p.with_suffix(p.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(p)


def run(command, timeout):
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        out, err = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        out, err = process.communicate()
        return {'exit_code': process.returncode, 'stdout': out, 'stderr': err, 'timed_out': True}
    return {'exit_code': process.returncode, 'stdout': out, 'stderr': err, 'timed_out': False}


def checked(command, timeout):
    result = run(command, timeout)
    if result['exit_code'] or result['timed_out']:
        raise RuntimeError(json.dumps(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    # Preserve every terminal or interrupted attempt, including its compiled classes.
    if REPORT.exists() or (OUTPUT.exists() and any(OUTPUT.iterdir())):
        raise RuntimeError('CP4 output/attempt already exists; no retry or overwrite')
    plan = json.loads(PLAN.read_text())
    assert plan['id'] == 'cp4-regions' and plan['render_budget'] == 5 and plan['attempt_budget'] == 1
    assert [v['id'] for v in plan['variants']] == CASES
    assert sha(CORE) == '88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4'
    for relative, expected in plan['source_sha256'].items():
        path = (ROOT / relative).resolve()
        assert path.is_relative_to(ROOT) and sha(path) == expected, relative
    paths = {PLAN, SOURCE, Path(__file__).resolve(), CORE, JAVA / 'java', JAVA / 'javac'}
    paths.update((ROOT / p).resolve() for p in plan['source_sha256'])
    before = {str(p.relative_to(ROOT)): sha(p) for p in sorted(paths)}
    BUILD.mkdir(parents=True, exist_ok=True)
    compiled = checked([str(JAVA / 'javac'), '--release', '8', '-cp', str(CORE), '-d', str(BUILD), str(SOURCE)], 30)
    native_command = [str(JAVA / 'java'), '-cp', str(BUILD) + os.pathsep + str(CORE), 'RegionChoice']
    numeric_run = checked(native_command + ['--numeric'], plan['numeric_timeout_seconds'])
    numeric = json.loads(numeric_run['stdout'])
    assert numeric['status'] == 'passed' and all(numeric['checks'].values())
    assert set(numeric['profiles']) == set(CASES)
    classes = {str(p.relative_to(ROOT)): sha(p) for p in sorted(BUILD.glob('RegionChoice*.class'))}
    assert classes
    if not args.render:
        print(json.dumps({'status': 'preflight-passed', 'numeric': numeric, 'compiled': compiled}))
        return
    from PIL import Image, ImageChops, ImageStat
    lock_path = ROOT / '.work/processing-render.lock'
    with lock_path.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        OUTPUT.mkdir(parents=True, exist_ok=True)
        assert not any(OUTPUT.iterdir()) and not REPORT.exists()
        for relative, expected in {**before, **classes}.items():
            assert sha(ROOT / relative) == expected, relative
        started = time.monotonic()
        write(OUTPUT / 'attempt.json', {'status': 'running', 'pid': os.getpid(), 'plan_sha256': sha(PLAN), 'attempt': 1})
        result = {'status': 'running', 'scope': 'Private CP4 technique/edit investigation; no operation conformance or source-pixel reproduction.',
                  'input_sha256_before': before, 'class_sha256': classes, 'numeric': numeric,
                  'compilation': compiled, 'cases': [], 'visual_review': 'pending'}
        write(REPORT, result)
        try:
            for case in CASES:
                remaining = plan['attempt_timeout_seconds'] - (time.monotonic() - started)
                if remaining <= 0:
                    raise RuntimeError('registered batch deadline exhausted')
                destination = OUTPUT / (case + '.png')
                observed = run(['xvfb-run', '-a'] + native_command + [case, str(destination)], remaining)
                item = {'id': case, **observed}
                result['cases'].append(item)
                write(OUTPUT / (case + '-process.json'), observed)
                if observed['exit_code'] or observed['timed_out']:
                    raise RuntimeError('render failed: ' + case)
                native = json.loads(observed['stdout'])
                assert native['status'] == 'rendered' and native['case'] == case
                assert native['geometry_sha256'] == numeric['profiles'][case]['geometry_sha256']
                with Image.open(destination) as raw:
                    assert raw.size == (640, 640)
                    if 'A' in raw.getbands():
                        assert raw.getchannel('A').getextrema() == (255, 255)
                    rgb = raw.convert('RGB')
                    assert any(lo != hi for lo, hi in rgb.getextrema()), 'blank image'
                    difference = None
                    if case in CASES[1:4]:
                        with Image.open(OUTPUT / '100half.png') as base:
                            diff = ImageChops.difference(rgb, base.convert('RGB'))
                        changed = sum(1 for pixel in diff.getdata() if any(pixel))
                        difference = {'mean_rgb_normalized': sum(ImageStat.Stat(diff).mean) / (3 * 255),
                                      'changed_fraction': changed / (640 * 640)}
                item.update({'status': 'passed', 'native': native, 'image': {'path': str(destination.relative_to(ROOT)), 'sha256': sha(destination)}, 'diff_from_baseline': difference})
                write(REPORT, result)
            result['input_sha256_after'] = {relative: sha(ROOT / relative) for relative in before}
            assert result['input_sha256_after'] == before
            assert all(sha(ROOT / relative) == expected for relative, expected in classes.items())
            result['status'] = 'passed'
        except Exception as error:
            result['status'] = 'failed'
            result['error'] = str(error)
        finally:
            result['elapsed_seconds'] = time.monotonic() - started
            write(REPORT, result)
            write(OUTPUT / 'attempt.json', {'status': result['status'], 'pid': os.getpid(), 'attempt': 1, 'result': str(REPORT.relative_to(ROOT))})
        print(json.dumps({'status': result['status'], 'cases': len(result['cases']), 'error': result.get('error')}))
        if result['status'] != 'passed':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
