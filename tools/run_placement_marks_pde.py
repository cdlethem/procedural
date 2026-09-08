#!/usr/bin/env python3
"""Build or execute the single registered PlacementMarks PDE native attempt."""
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
    if plan.get('attempt_budget') != 1 or plan.get('composition_budget') != 14:
        raise RuntimeError('unexpected native attempt/composition registration')
    if plan.get('seeded_proposal_budget') != 55000 or plan.get('radial_filter_candidate_budget') != 160:
        raise RuntimeError('unexpected bounded geometry-work registration')
    states = plan.get('states')
    if not isinstance(states, list) or len(states) != 14:
        raise RuntimeError('expected exactly 14 registered compositions')
    expected = ['base', 'motif', 'motif-replay', 'palette', 'separation', 'separation-reset',
                'minimum', 'minimum-reset', 'maximum', 'maximum-reset', 'budget', 'budget-reset',
                'seed', 'radial']
    if [state.get('id') for state in states] != expected:
        raise RuntimeError('unexpected registered state sequence')
    if plan.get('captured_images') != [state + '.png' for state in expected]:
        raise RuntimeError('every registered composition must have one declared captured image')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true', help='consume the one registered native attempt')
    parser.add_argument('--java-home')
    parser.add_argument('--library-jar', type=Path,
                        help='run against a hash-bound installed Procedurals core JAR')
    parser.add_argument('--distribution-report', type=Path,
                        help='passed distribution evidence that binds --library-jar')
    parser.add_argument('--plan', type=Path,
                        default=ROOT / 'evidence/reproductions/cp3-java2d/pde-plan.json')
    args = parser.parse_args()
    home = java_home(args.java_home)
    plan_path = args.plan.resolve()
    plan_path.relative_to(ROOT)
    plan = json.loads(plan_path.read_text(encoding='utf-8'))
    require_plan(plan)
    output = ROOT / plan['output']
    output.relative_to(ROOT)
    attempt = output / 'attempt.json'
    if args.render:
        if attempt.exists():
            raise RuntimeError('attempt already reserved; inspect its terminal or live result')
        names = [*plan['captured_images'], 'displayed-final.png', 'native.json', 'progress.json']
        stale = [output / name for name in names if (output / name).exists()]
        stale += list(output.glob('placement-marks-*.png'))
        if stale:
            raise RuntimeError('pre-existing native output; preserve and inspect before a new attempt')
    build_report_path = ROOT / plan.get('build_report', 'evidence/reproductions/cp3-java2d/pde-build.json')
    check_command = [sys.executable, ROOT / 'tools/check_placement_marks_pde.py', '--java-home', home,
                     '--output', build_report_path]
    if (args.library_jar is None) != (args.distribution_report is None):
        raise RuntimeError('--library-jar and --distribution-report must be supplied together')
    if args.library_jar:
        check_command += ['--library-jar', args.library_jar, '--distribution-report', args.distribution_report]
    run(check_command)
    core = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
    probe = ROOT / 'tests/native/PlacementMarksPdeProbe.java'
    build_report = json.loads(build_report_path.read_text(encoding='utf-8'))
    if build_report.get('status') != 'passed':
        raise RuntimeError('PlacementMarks PDE build report did not pass')
    build = ROOT / build_report['build']
    installed = build_report.get('installed_library')
    if args.library_jar:
        library = args.library_jar.resolve()
        if not isinstance(installed, dict) or installed.get('sha256') != digest(library):
            raise RuntimeError('PDE build did not bind the requested installed JAR')
    else:
        if installed is not None:
            raise RuntimeError('unexpected installed library in source-core build')
        library = None
    probe_classpath = f'{build}:{core}' + ('' if library is None else f':{library}')
    run([home / 'bin/javac', '--release', '17', '-cp', probe_classpath, '-d', build, probe])
    pure_path = ROOT / 'evidence/conformance/circle-placement-java.json'
    pure = json.loads(pure_path.read_text(encoding='utf-8'))
    if pure.get('vectors', {}).get('status') != 'passed' or pure.get('native', {}).get('status') != 'passed':
        raise RuntimeError('current Java circle-placement pure conformance is not passed')
    before = pure.get('source_sha256_before')
    after = pure.get('source_sha256_after')
    if not isinstance(before, dict) or before != after:
        raise RuntimeError('circle-placement pure conformance source bindings are incomplete')
    for relative, expected in before.items():
        if not isinstance(relative, str) or not isinstance(expected, str) or digest(ROOT / relative) != expected:
            raise RuntimeError(f'stale Java circle-placement pure conformance: {relative}')
    brief = ROOT / plan['brief']
    if not brief.is_file():
        raise RuntimeError(f'missing bound PlacementMarks brief: {brief}')
    bindings = dict(build_report['input_sha256'])
    for path in [plan_path, probe, Path(__file__).resolve(), build_report_path, pure_path,
                 ROOT / 'tools/run_grid_conformance.py', brief]:
        bindings[str(path.relative_to(ROOT))] = digest(path)
    expected_counts = [state['accepted_count'] if state.get('accepted_count') is not None else -1
                       for state in plan['states']]
    if expected_counts != [424, 424, 424, 424, 353, 424, 239, 424, 613, 424, 517, 424, -1, 111]:
        raise RuntimeError('unexpected registered accepted-count checks')
    if not args.render:
        print(json.dumps({'status': 'built', 'scope': 'actual official-preprocessed PDE and core configuration only; no native render attempted',
                          'build_report': str(build_report_path.relative_to(ROOT))}))
        return

    output.mkdir(parents=True, exist_ok=True)
    result_path = ROOT / plan.get('result', 'evidence/reproductions/cp3-java2d/pde-result.json')
    lock_path = ROOT / '.work/processing-render.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('a', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with attempt.open('x', encoding='utf-8') as file:
            json.dump({'status': 'reserved', 'composition_budget': 14,
                       'seeded_proposal_budget': 55000, 'radial_filter_candidate_budget': 160,
                       'input_sha256': bindings}, file, indent=2)
        report = {'status': 'failed', 'scope': plan['scope'], 'input_sha256': bindings,
                  'visual_review': 'pending'}
        process = None
        stdout = output / 'stdout.log'
        stderr = output / 'stderr.log'
        try:
            with stdout.open('w', encoding='utf-8') as out, stderr.open('w', encoding='utf-8') as err:
                process = subprocess.Popen([
                    'xvfb-run', '-a', str(home / 'bin/java'), f'-Duser.home={build / "home"}',
                    '-cp', probe_classpath, 'PlacementMarksPdeProbe', str(output),
                    *[str(value) for value in expected_counts],
                ], cwd=ROOT, stdout=out, stderr=err, start_new_session=True)
                write(attempt, {'status': 'running', 'pid': process.pid, 'composition_budget': 14,
                                'seeded_proposal_budget': 55000, 'radial_filter_candidate_budget': 160,
                                'input_sha256': bindings})
                try:
                    exit_code = process.wait(timeout=plan['timeout_seconds'])
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError('PlacementMarks PDE attempt timed out')
            report.update(exit_code=exit_code, stdout=stdout.read_text(encoding='utf-8'),
                          stderr=stderr.read_text(encoding='utf-8'))
            if exit_code != 0:
                raise RuntimeError('PlacementMarks PDE attempt failed')
            native = json.loads((output / 'native.json').read_text(encoding='utf-8'))
            expected_native = {'status': 'passed', 'compositions': 14, 'key_events': 14,
                               'retained_style_edits': True, 'baseline_replay_pixels': True,
                               'palette_reuses_geometry': True, 'budget_prefix': True,
                               'radial_transfer': True}
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
            require_equal = equal('base.png', 'motif-replay.png')
            if not require_equal:
                raise RuntimeError('motif replay did not restore baseline pixels')
            for changed in ('motif.png', 'palette.png', 'radial.png'):
                if equal('base.png', changed):
                    raise RuntimeError(f'visible edit did not alter pixels: {changed}')
            saved = list(output.glob('placement-marks-*.png'))
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
            write(attempt, {'status': report['status'], 'composition_budget': 14,
                            'seeded_proposal_budget': 55000, 'radial_filter_candidate_budget': 160,
                            'input_sha256': bindings})
        print(json.dumps({'status': report['status'], 'error': report.get('error'),
                          'visual_review': report['visual_review']}))
        if report['status'] != 'passed':
            raise SystemExit(1)


if __name__ == '__main__':
    main()
