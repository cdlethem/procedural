#!/usr/bin/env python3
"""Compile the CP8 example and run pure/font preflight checks; never launch a renderer."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build-dir', type=Path, required=True)
    parser.add_argument('--font', type=Path, required=True)
    parser.add_argument('--sketch-dir', type=Path)
    args = parser.parse_args()
    build = args.build_dir.resolve()
    build.relative_to(ROOT / '.work')
    if build.exists():
        raise RuntimeError('Refusing to overwrite an existing CP8 compile attempt')
    java = ROOT / '.work/toolchains/jdk-17.0.20.1+1/bin'
    runtime = ROOT / '.work/toolchains/processing-4.5.6'
    core = runtime / 'core-4.5.6.jar'
    library = ROOT / '.work/dist/cp7/java-savefix/consumer/procedurals/library/procedurals.jar'
    prelibs = [runtime / 'preprocessor' / name for name in NAMES]
    example = ROOT / 'packages/java/examples/GlyphMarks'
    tabs = [example / 'GlyphComposition.java', example / 'GlyphFont.java']
    checks = [ROOT / 'tests/native' / name for name in
              ('GlyphCompositionNative.java', 'GlyphFontNative.java')]
    pde = ROOT / 'packages/java-processing/examples/GlyphMarks/GlyphMarks.pde'
    originals = [*tabs, pde]
    if args.sketch_dir:
        sketch = args.sketch_dir.resolve()
        sketch.relative_to(ROOT / '.work')
        tabs = [sketch / p.name for p in tabs]
        pde = sketch / 'GlyphMarks.pde'
        library = sketch / 'code/procedurals.jar'
        if any(sha(a) != sha(b) for a, b in zip(originals, [*tabs, pde])):
            raise RuntimeError('Staged example differs from current source')
        if args.font.resolve() != sketch / 'data/GlyphMarks.ttf':
            raise RuntimeError('Use the staged font with a staged sketch')
    bridge = ROOT / 'tests/native/PreprocessSketch.java'
    font = args.font.resolve()
    inputs = [Path(__file__).resolve(), core, library, *prelibs, *tabs, *originals, *checks,
              pde, bridge, font]
    before = {str(p): sha(p) for p in inputs}
    if sha(core) != CORE_SHA256:
        raise RuntimeError('Processing core hash mismatch')
    if sha(library) != '2cd36310135e4d74f748e33cf062666d4abb6a8d9844620f921d7c0e7936440a':
        raise RuntimeError('Expected delivered CP7 core JAR')
    build.mkdir(parents=True)
    (build / 'home').mkdir()
    (build / 'tmp').mkdir()
    commands = []

    def run(argv):
        argv = list(map(str, argv))
        env = os.environ.copy()
        for key in ('XDG_CONFIG_HOME', 'SNAP_USER_COMMON', 'APPDATA'):
            env.pop(key, None)
        result = subprocess.run(argv, capture_output=True, text=True, env=env, timeout=90)
        commands.append({'argv': argv, 'exit_code': result.returncode,
                         'stdout': result.stdout, 'stderr': result.stderr})
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)

    pre = os.pathsep.join(map(str, [core, *prelibs]))
    cp = os.pathsep.join(map(str, [core, library, build]))
    generated = build / 'GlyphMarks.java'
    report = {'scope': 'Official PDE compilation and headless helper checks only; no native drawing or delivery claim.',
              'inputs_before': before, 'commands': commands, 'status': 'failed',
              'sketch_dir': str(args.sketch_dir.resolve()) if args.sketch_dir else None,
              'core_jar': str(library)}
    try:
        run([java / 'javac', '-cp', pre, '-d', build, bridge])
        run([java / 'java', '-Duser.home=' + str(build / 'home'), '-cp',
             str(build) + os.pathsep + pre, 'PreprocessSketch', pde, generated, 'GlyphMarks'])
        run([java / 'javac', '--release', '17', '-cp', cp, '-d', build,
             *tabs, *checks, generated])
        run([java / 'java', '-Djava.awt.headless=true', '-cp', cp, 'GlyphCompositionNative'])
        run([java / 'java', '-Djava.awt.headless=true', '-Djava.io.tmpdir=' + str(build / 'tmp'),
             '-cp', cp, 'org.procedurals.examples.glyphmarks.GlyphFontNative', font])
        report['inputs_after'] = {str(p): sha(p) for p in inputs}
        if report['inputs_after'] != before:
            raise RuntimeError('Inputs changed during check')
        report['generated_java_sha256'] = sha(generated)
        report['status'] = 'passed'
    finally:
        (build / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(build / 'result.json')}))


if __name__ == '__main__':
    main()
