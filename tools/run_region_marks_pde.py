#!/usr/bin/env python3
"""Build or execute the single registered RegionMarks PDE native attempt."""
from __future__ import annotations

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
from tools.run_grid_conformance import java_home, run


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def require_plan(plan: dict) -> None:
    if (plan.get('attempt_budget'), plan.get('composition_budget'), plan.get('key_event_budget')) != (1, 11, 11):
        raise RuntimeError('unexpected CP4 native attempt registration')
    if (plan.get('seeded_replacement_budget'), plan.get('authored_grid_actions')) != (700, 2):
        raise RuntimeError('unexpected CP4 geometry-work registration')
    states = plan.get('states')
    expected = ['base', 'grid', 'grid-reset', 'palette', 'count-200', 'count-reset',
                'full-selection', 'fraction-reset', 'seed-43', 'seed-43-grid', 'authored-grid']
    if not isinstance(states, list) or [state.get('id') for state in states] != expected:
        raise RuntimeError('unexpected CP4 registered state sequence')
    if [state.get('expected_cells') for state in states] != [301, 301, 301, 301, 601, 301, 301, 301, 301, 301, 11]:
        raise RuntimeError('unexpected CP4 retained cell expectations')
    if plan.get('key_sequence') != ['m', 'm', 'c', 'n', 'n', 'g', 'g', 'r', 'm', 'x', 's']:
        raise RuntimeError('unexpected CP4 key sequence')
    if plan.get('captured_images') != ['base.png', 'grid.png', 'authored-grid.png']:
        raise RuntimeError('unexpected CP4 capture registration')
    if plan.get('visual_images') != ['base.png', 'grid.png', 'authored-grid.png']:
        raise RuntimeError('unexpected CP4 visual-image registration')
    if plan.get('timeout_seconds') != 180:
        raise RuntimeError('unexpected CP4 timeout')


def require_core_conformance(path: Path) -> dict:
    if not path.is_file():
        raise RuntimeError('quadrant-partition Java conformance report is missing')
    report = json.loads(path.read_text(encoding='utf-8'))
    if (report.get('status') != 'passed'
            and not (isinstance(report.get('vectors'), dict) and report['vectors'].get('status') == 'passed'
                     and isinstance(report.get('native'), dict) and report['native'].get('status') == 'passed')):
        raise RuntimeError('quadrant-partition Java conformance report is not passed')
    bindings = report.get('source_sha256_before')
    if not isinstance(bindings, dict):
        bindings = report.get('source_sha256')
    if not isinstance(bindings, dict) or not bindings:
        raise RuntimeError('quadrant-partition Java conformance source bindings are incomplete')
    after = report.get('source_sha256_after')
    if after is not None and after != bindings:
        raise RuntimeError('quadrant-partition Java conformance changed its bound sources')
    for relative, expected in bindings.items():
        if not isinstance(relative, str) or not isinstance(expected, str) or digest(ROOT / relative) != expected:
            raise RuntimeError(f'stale quadrant-partition Java conformance: {relative}')
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true', help='consume the one registered native attempt')
    parser.add_argument('--java-home')
    parser.add_argument('--library-jar', type=Path,
                        help='run against a hash-bound installed Procedurals core JAR')
    parser.add_argument('--distribution-report', type=Path,
                        help='passed distribution report that binds --library-jar')
    parser.add_argument('--plan', type=Path,
                        default=ROOT / 'evidence/reproductions/cp4-java2d/pde-plan.json')
    args = parser.parse_args()
    home = java_home(args.java_home)
    plan_path = args.plan.resolve()
    plan_path.relative_to(ROOT)
    plan = json.loads(plan_path.read_text(encoding='utf-8'))
    require_plan(plan)
    if (args.library_jar is None) != (args.distribution_report is None):
        raise RuntimeError('--library-jar and --distribution-report must be supplied together')
    output = ROOT / plan['output']
    output.relative_to(ROOT)
    attempt = output / 'attempt.json'
    if args.render:
        if attempt.exists():
            raise RuntimeError('attempt already reserved; inspect its terminal or live result')
        names = [*plan['captured_images'], 'displayed-final.png', 'native.json', 'progress.json']
        stale = [output / name for name in names if (output / name).exists()]
        stale += list(output.glob('region-marks-*.png'))
        if stale:
            raise RuntimeError('pre-existing native output; preserve and inspect before a new attempt')

    build_report_path = ROOT / plan['build_report']
    check_command = [sys.executable, ROOT / 'tools/check_region_marks_pde.py', '--java-home', home,
                     '--output', build_report_path, '--core-conformance', ROOT / plan['core_conformance']]
    if args.library_jar:
        check_command += ['--library-jar', args.library_jar, '--distribution-report', args.distribution_report]
    run(check_command)
    build_report = json.loads(build_report_path.read_text(encoding='utf-8'))
    if build_report.get('status') != 'passed':
        raise RuntimeError('RegionMarks PDE build report did not pass')
    build = ROOT / build_report['build']
    core = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
    probe = ROOT / 'tests/native/RegionMarksPdeProbe.java'
    installed = build_report.get('installed_library')
    if args.library_jar:
        library = args.library_jar.resolve()
        if not isinstance(installed, dict) or installed.get('sha256') != digest(library):
            raise RuntimeError('PDE build did not bind requested installed JAR')
    else:
        if installed is not None:
            raise RuntimeError('unexpected installed library in source-core build')
        library = None
    probe_classpath = str(build) + os.pathsep + str(core) + ('' if library is None else os.pathsep + str(library))
    run([home / 'bin/javac', '--release', '17', '-cp', probe_classpath, '-d', build, probe])
    bindings = dict(build_report['input_sha256'])
    for path in (plan_path, probe, Path(__file__).resolve(), build_report_path,
                 ROOT / 'tools/run_grid_conformance.py'):
        bindings[str(path.relative_to(ROOT))] = digest(path)
    conformance_path = ROOT / plan['core_conformance']
    if args.render:
        require_core_conformance(conformance_path)
        bindings[str(conformance_path.relative_to(ROOT))] = digest(conformance_path)
    if not args.render:
        print(json.dumps({
            'status': 'built',
            'scope': 'actual official-preprocessed RegionMarks PDE and configuration/probe compilation only; no native render attempted',
            'build_report': str(build_report_path.relative_to(ROOT)),
            'core_conformance_bound': conformance_path.is_file(),
        }))
        return

    output.mkdir(parents=True, exist_ok=True)
    result_path = ROOT / plan['result']
    lock_path = ROOT / '.work/processing-render.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('a', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with attempt.open('x', encoding='utf-8') as file:
            json.dump({'status': 'reserved', 'composition_budget': 11, 'key_event_budget': 11,
                       'seeded_replacement_budget': 700, 'authored_grid_actions': 2,
                       'input_sha256': bindings}, file, indent=2)
        report = {'status': 'failed', 'scope': plan['scope'], 'input_sha256': bindings,
                  'visual_review': 'pending'}
        process = None
        stdout, stderr = output / 'stdout.log', output / 'stderr.log'
        try:
            with stdout.open('w', encoding='utf-8') as out, stderr.open('w', encoding='utf-8') as err:
                process = subprocess.Popen([
                    'xvfb-run', '-a', str(home / 'bin/java'), f'-Duser.home={build / "home"}',
                    '-cp', probe_classpath, 'RegionMarksPdeProbe', str(output),
                ], cwd=ROOT, stdout=out, stderr=err, start_new_session=True)
                write(attempt, {'status': 'running', 'pid': process.pid, 'composition_budget': 11,
                                'key_event_budget': 11, 'seeded_replacement_budget': 700,
                                'authored_grid_actions': 2, 'input_sha256': bindings})
                try:
                    exit_code = process.wait(timeout=plan['timeout_seconds'])
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError('RegionMarks PDE attempt timed out')
            report.update(exit_code=exit_code, stdout=stdout.read_text(encoding='utf-8'),
                          stderr=stderr.read_text(encoding='utf-8'))
            if exit_code != 0:
                raise RuntimeError('RegionMarks PDE attempt failed')
            native = json.loads((output / 'native.json').read_text(encoding='utf-8'))
            expected_native = {
                'status': 'passed', 'compositions': 11, 'key_events': 11,
                'retained_style_edits': True, 'reset_pixel_replay': True,
                'count_final_not_prefix': True, 'seed_and_fraction_change_geometry': True,
                'authored_grid_transfer': True,
            }
            for key, value in expected_native.items():
                if native.get(key) != value:
                    raise RuntimeError(f'native check missing or false: {key}')
            if native.get('save_quiet_ms', 0) < 300:
                raise RuntimeError('save quiet observation incomplete')
            from PIL import Image, ImageChops
            images = {}
            for name in [*plan['captured_images'], 'displayed-final.png']:
                path = output / name
                with Image.open(path) as image:
                    rgba = image.convert('RGBA')
                    if rgba.size != (640, 640) or rgba.getchannel('A').getextrema() != (255, 255):
                        raise RuntimeError(f'invalid native image: {name}')
                    if len(rgba.convert('RGB').getcolors(640 * 640) or []) < 2:
                        raise RuntimeError(f'blank native image: {name}')
                images[name] = {'path': str(path.relative_to(ROOT)), 'sha256': digest(path)}
            def equal(left: str, right: str) -> bool:
                with Image.open(output / left) as a, Image.open(output / right) as b:
                    return a.size == b.size and ImageChops.difference(a.convert('RGB'), b.convert('RGB')).getbbox() is None
            if equal('base.png', 'grid.png'):
                raise RuntimeError('grid motif did not visibly change pixels')
            if equal('base.png', 'authored-grid.png'):
                raise RuntimeError('authored-cell transfer did not visibly change pixels')
            saved = list(output.glob('region-marks-*.png'))
            if len(saved) != 1 or not equal(saved[0].name, 'displayed-final.png'):
                raise RuntimeError('actual S-key save is missing or differs from displayed final canvas')
            for relative, expected in bindings.items():
                if digest(ROOT / relative) != expected:
                    raise RuntimeError(f'input changed during native attempt: {relative}')
            report.update(status='passed', native=native, images=images,
                          save={'path': str(saved[0].relative_to(ROOT)), 'sha256': digest(saved[0]),
                                'pixels_equal_displayed': True})
        except Exception as error:
            report['error'] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            write(result_path, report)
            write(attempt, {'status': report['status'], 'composition_budget': 11,
                            'key_event_budget': 11, 'seeded_replacement_budget': 700,
                            'authored_grid_actions': 2, 'input_sha256': bindings})
        print(json.dumps({'status': report['status'], 'error': report.get('error'),
                          'visual_review': report['visual_review']}))
        if report['status'] != 'passed':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
