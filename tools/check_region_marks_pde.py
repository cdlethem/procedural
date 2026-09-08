#!/usr/bin/env python3
"""Preprocess and compile the actual RegionMarks PDE with pinned Processing; no renders."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.run_grid_conformance import java_home, run


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def installed_library(library: Path | None, report: Path | None) -> tuple[Path | None, Path | None]:
    if (library is None) != (report is None):
        raise RuntimeError('--library-jar and --distribution-report must be supplied together')
    if library is None:
        return None, None
    jar, evidence = library.resolve(), report.resolve()
    jar.relative_to(ROOT)
    evidence.relative_to(ROOT)
    if not jar.is_file() or not evidence.is_file():
        raise RuntimeError('installed library JAR or distribution report is missing')
    payload = json.loads(evidence.read_text(encoding='utf-8'))
    if payload.get('status') != 'passed':
        raise RuntimeError('distribution report is not passed')
    jar_hash = digest(jar)
    def contains_hash(value: object) -> bool:
        if isinstance(value, dict):
            return value.get('sha256') == jar_hash or any(contains_hash(item) for item in value.values())
        if isinstance(value, list):
            return any(contains_hash(item) for item in value)
        return False
    if not contains_hash(payload.get('artifacts', {})):
        raise RuntimeError('distribution report does not bind supplied installed JAR hash')
    return jar, evidence


def installed_examples(jar: Path | None, report: Path | None, root_pde: Path,
                       root_composition: Path) -> tuple[Path, Path]:
    if jar is None:
        return root_pde, root_composition
    extracted = jar.parent.parent / 'examples' / 'RegionMarks'
    pde, composition = extracted / 'RegionMarks.pde', extracted / 'RegionComposition.java'
    if not pde.is_file() or not composition.is_file():
        raise RuntimeError('installed library layout lacks editable RegionMarks tabs')
    payload = json.loads(report.read_text(encoding='utf-8'))
    before, after = payload.get('input_sha256_before'), payload.get('input_sha256_after')
    if not isinstance(before, dict) or before != after:
        raise RuntimeError('distribution source bindings are incomplete')
    entries = payload.get('artifacts', {}).get('starter', {}).get('entries')
    if not isinstance(entries, list):
        raise RuntimeError('distribution report lacks starter entries')
    entry_hashes = {entry.get('path'): entry.get('sha256') for entry in entries if isinstance(entry, dict)}
    checks = ((pde, root_pde, 'procedurals/examples/RegionMarks/RegionMarks.pde'),
              (composition, root_composition, 'procedurals/examples/RegionMarks/RegionComposition.java'))
    for extracted_path, root_path, archive_path in checks:
        expected = before.get(str(root_path.relative_to(ROOT)))
        if not isinstance(expected, str) or entry_hashes.get(archive_path) != expected:
            raise RuntimeError(f'distribution report does not bind {archive_path} to root source')
        if digest(root_path) != expected or digest(extracted_path) != expected:
            raise RuntimeError(f'installed tab differs from recorded/root source: {archive_path}')
    return pde, composition


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home')
    parser.add_argument('--output', type=Path,
                        default=ROOT / 'evidence/reproductions/cp4-java2d/pde-build.json')
    parser.add_argument('--library-jar', type=Path,
                        help='use a hash-bound installed Procedurals core JAR instead of compiling core sources')
    parser.add_argument('--distribution-report', type=Path,
                        help='passed distribution report that binds --library-jar')
    parser.add_argument('--core-conformance', type=Path,
                        default=ROOT / 'evidence/conformance/quadrant-partition-java.json',
                        help='optional passed pure-core report to bind when it is available')
    args = parser.parse_args()
    home = java_home(args.java_home)
    library_jar, distribution_report = installed_library(args.library_jar, args.distribution_report)
    runtime = ROOT / '.work/toolchains/processing-4.5.6'
    core = runtime / 'core-4.5.6.jar'
    if not core.is_file() or digest(core) != CORE_SHA256:
        raise RuntimeError('unexpected Processing 4.5.6 core')
    libraries = [runtime / 'preprocessor' / name for name in NAMES]
    for library in libraries:
        if not library.is_file():
            raise RuntimeError(f'missing pinned preprocessor library: {library}')

    build = ROOT / ('.work/build/region-marks-pde-installed' if library_jar else '.work/build/region-marks-pde')
    build.mkdir(parents=True, exist_ok=True)
    (build / 'home').mkdir(exist_ok=True)
    root_pde = ROOT / 'packages/java-processing/examples/RegionMarks/RegionMarks.pde'
    root_composition = ROOT / 'packages/java/examples/RegionMarks/RegionComposition.java'
    example_pde, composition = installed_examples(library_jar, distribution_report, root_pde, root_composition)
    bridge = ROOT / 'tests/native/PreprocessSketch.java'
    configuration = ROOT / 'tests/native/RegionMarksPdeConfiguration.java'
    core_sources = sorted((ROOT / 'packages/java/src/main/java').rglob('*.java'))
    sources = [composition] if library_jar else [*core_sources, composition]
    inputs = [*sources, configuration, bridge, example_pde, root_pde, root_composition, core,
              *libraries, ROOT / 'tools/run_grid_conformance.py', Path(__file__).resolve()]
    if library_jar:
        inputs += [library_jar, distribution_report]
    core_conformance = args.core_conformance.resolve()
    core_conformance.relative_to(ROOT)
    if core_conformance.is_file():
        inputs.append(core_conformance)
    for item in inputs:
        if not item.is_file():
            raise RuntimeError(f'missing RegionMarks build input: {item}')
    before = {str(item.relative_to(ROOT)): digest(item) for item in inputs}
    classpath = os.pathsep.join(str(item) for item in [core, *libraries])
    run([home / 'bin/javac', '-cp', classpath, '-d', build, bridge])
    environment = os.environ.copy()
    for key in ('XDG_CONFIG_HOME', 'SNAP_USER_COMMON', 'APPDATA'):
        environment.pop(key, None)
    generated = build / 'RegionMarks.java'
    run([home / 'bin/java', f'-Duser.home={build / "home"}', '-cp', str(build) + os.pathsep + classpath,
         'PreprocessSketch', example_pde, generated, 'RegionMarks'], env=environment)
    compile_classpath = os.pathsep.join(str(path) for path in ([core, library_jar] if library_jar else [core]))
    run([home / 'bin/javac', '--release', '17', '-cp', compile_classpath, '-d', build,
         *sources, generated, configuration])
    configuration_command = [home / 'bin/java', '-cp', str(build) + os.pathsep + compile_classpath,
                             'RegionMarksPdeConfiguration']
    if library_jar:
        configuration_command.append(str(library_jar))
    run(configuration_command)
    after = {str(item.relative_to(ROOT)): digest(item) for item in inputs}
    if before != after:
        raise RuntimeError('RegionMarks sources changed during preprocessing/compilation')
    report = {
        'status': 'passed',
        'scope': 'Official Processing 4.5.6 RegionMarks PDE preprocessing and core-count/configuration only; no GUI lifecycle or render was run.',
        'input_sha256': before,
        'generated_java_sha256': digest(generated),
        'class_sha256': digest(build / 'RegionMarks.class'),
        'runtime': run([home / 'bin/java', '-version']).stderr.strip(),
        'build': str(build.relative_to(ROOT)),
        'core_conformance': (None if not core_conformance.is_file() else {
            'path': str(core_conformance.relative_to(ROOT)), 'sha256': digest(core_conformance),
        }),
        'installed_library': (None if library_jar is None else {
            'path': str(library_jar.relative_to(ROOT)), 'sha256': digest(library_jar),
            'distribution_report': str(distribution_report.relative_to(ROOT)),
            'distribution_report_sha256': digest(distribution_report),
        }),
    }
    output = args.output.resolve()
    output.relative_to(ROOT)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'passed', 'report': str(output.relative_to(ROOT)), 'scope': report['scope']}))


if __name__ == '__main__':
    main()
