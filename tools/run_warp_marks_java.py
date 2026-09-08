#!/usr/bin/env python3
"""Compile a registered Java starter and optionally run its bounded JAVA2D lifecycle probe."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES, SHA256
from tools.check_processing_runtime import CORE_SHA256

RUNTIME = ROOT / '.work/toolchains/processing-4.5.6'
PROFILES = {
    'BodyMarks': ('body-marks', ['baseline', 'tapered', 'centerlines', 'body-restored', 'advanced', 'reset'], 'wmm.0s'),
    'PointerMarks': ('pointer-marks', ['baseline', 'held-dots', 'held-wire', 'released-dots', 'reset', 'replay-held-dots', 'replay-released-dots', 'lifecycle-paused'], 'mm0SPACESPACEs'),
    'PolygonMarks': ('polygon-marks', ['baseline', 'thin', 'recolored', 'diamonds', 'regenerated', 'reset'], 'acmr0s'),
    'CutMarks': ('cut-marks', ['baseline', 'selected-x', 'decorated', 'deleted', 'reset'], 'xdDELETE0s'),
    'PullMarks': ('pull-marks', ['baseline', 'wider', 'falloff', 'recolored', 'contours', 'reset'], 'rpcm0s'),
    'PanelMarks': ('panel-marks', ['baseline', 'denser', 'random_axis', 'recolored', 'panels', 'reset'], 'apcm0s'),
    'WarpMarks': ('warp-marks', ['baseline', 'strength64', 'zero', 'restored', 'sinusoidal', 'stripes', 'reset'], 'wwwfp0s'),
    'LayerMarks': ('layer-marks', ['baseline', 'local', 'feather', 'crossfade', 'restored'], 'mmmms'),
    'MaskMarks': ('mask-marks', ['baseline', 'image', 'crossfade', 'mask-view', 'crossfade-restored', 'baseline-restored'], 'mmvvms'),
    'PlacementImageMarks': ('placement-image-marks', ['baseline', 'cover', 'stretch', 'contain-restored', 'cropped', 'aligned-end', 'masked', 'unmasked-restored'], 'fffcamms'),
    'RampMarks': ('ramp-marks', ['baseline', 'shifted', 'recolored', 'radial', 'reset'], 'tcf0s'),
    'LoopMarks': ('loop-marks', ['baseline', 'moved', 'recolored', 'fans', 'reset'], 'tcm0s'),
    'BandMarks': ('band-marks', ['baseline', 'wider', 'recolored', 'marks', 'reset'], 'tcm0s'),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def label(path):
    return str(path.resolve().relative_to(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home', type=Path, default=ROOT / '.work/toolchains/jdk-17.0.20.1+1')
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--native', action='store_true')
    parser.add_argument('--sketch', choices=sorted(PROFILES), default='WarpMarks')
    args = parser.parse_args()
    jdk, output = args.java_home.resolve(), args.output_dir.resolve()
    sketch = args.sketch
    stem, ids, keys = PROFILES[sketch]
    pde = ROOT / 'packages/java-processing/examples' / sketch / (sketch + '.pde')
    probe = ROOT / 'tests/native' / (sketch + 'Probe.java')
    plan = ROOT / 'design/capabilities' / (stem + '-native-plan.md')
    if not output.is_relative_to(ROOT / '.work') or output.exists():
        raise ValueError('Preserve attempts: require fresh output below .work')
    core = RUNTIME / 'core-4.5.6.jar'
    archive = RUNTIME / 'processing-4.5.6-linux-x64-portable.zip'
    if sha(core) != CORE_SHA256 or sha(archive) != SHA256:
        raise ValueError('Pinned official Processing runtime mismatch')
    pre = [RUNTIME / 'preprocessor' / name for name in NAMES]
    with zipfile.ZipFile(archive) as runtime:
        for path in pre:
            if path.read_bytes() != runtime.read('Processing/lib/app/resources/modes/java/mode/' + path.name):
                raise ValueError('Preprocessor differs from pinned distribution: ' + path.name)
    bridge = ROOT / 'tests/native/PreprocessSketch.java'
    lease = ROOT / 'tools/with_native_render_lock.py'
    sources = sorted((ROOT / 'packages/java/src/main/java').rglob('*.java'))
    adapter_sources = (sorted((ROOT / 'packages/java-processing/src/main/java').rglob('*.java'))
                       if sketch in ('LayerMarks', 'MaskMarks', 'PlacementImageMarks') else [])
    inputs = [pde, probe, plan, bridge, lease, Path(__file__), core, archive,
              ROOT / 'tools/check_field_marks_pde.py', ROOT / 'tools/check_processing_runtime.py',
              *sources, *adapter_sources, *pre,
              *[jdk / name for name in ('bin/java', 'bin/javac', 'bin/jar', 'release', 'lib/modules')]]
    before = {label(path): sha(path) for path in inputs}
    output.mkdir(parents=True)
    core_classes, classes, prep, home = [output / name for name in ('core-classes', 'classes', 'pre-classes', 'home')]
    for directory in (core_classes, classes, prep, home):
        directory.mkdir()
    environment = os.environ.copy()
    for name in ('XDG_CONFIG_HOME', 'SNAP_USER_COMMON', 'APPDATA'):
        environment.pop(name, None)
    commands = []
    report = {'status': 'failed', 'scope': 'Candidate source-built JAR and actual PDE; no release acceptance',
              'input_sha256_before': before, 'commands': commands}

    def run(command, timeout=120):
        command = list(map(str, command))
        result = subprocess.run(command, cwd=ROOT, env=environment, text=True,
                                capture_output=True, timeout=timeout)
        commands.append({'argv': command, 'exit_code': result.returncode,
                         'stdout': result.stdout, 'stderr': result.stderr})
        if result.returncode:
            raise RuntimeError('Command failed: ' + result.stdout + result.stderr)
        return result

    try:
        jar, generated = output / 'procedurals-core-candidate.jar', output / (sketch + '.java')
        run([jdk / 'bin/javac', '--release', '8', '-d', core_classes, *sources])
        if adapter_sources:
            run([jdk / 'bin/javac', '--release', '8',
                 '-cp', os.pathsep.join(map(str, [core, core_classes])),
                 '-d', core_classes, *adapter_sources])
        run([jdk / 'bin/jar', 'cf', jar, '-C', core_classes, 'org'])
        prepath = os.pathsep.join(map(str, [core, *pre]))
        run([jdk / 'bin/javac', '-cp', prepath, '-d', prep, bridge])
        run([jdk / 'bin/java', '-Duser.home=' + str(home), '-cp', str(prep) + os.pathsep + prepath,
             'PreprocessSketch', pde, generated, sketch])
        run([jdk / 'bin/javac', '--release', '8', '-cp', os.pathsep.join(map(str, [core, jar])),
             '-d', classes, generated, probe])
        artifacts = [jar, generated, *classes.rglob('*.class'), *core_classes.rglob('*.class'), *prep.rglob('*.class')]
        artifact_before = {label(path): sha(path) for path in artifacts}
        report['artifact_sha256_before'] = artifact_before
        report['runtime'] = run([jdk / 'bin/java', '-version']).stderr.strip()
        if args.native:
            native_out = output / 'native'
            native_out.mkdir()
            # The lease wrapper owns process-group cleanup; outer timeout allows cleanup to finish.
            run([sys.executable, lease, '--timeout', '120', '--', 'xvfb-run', '-a', jdk / 'bin/java',
                 '-Duser.home=' + str(home), '-cp', os.pathsep.join(map(str, [classes, jar, core])),
                 sketch + 'Probe', native_out, jar], timeout=150)
            native = json.loads((native_out / 'native.json').read_text())
            if native.get('status') != 'passed' or native.get('frames') != len(ids) or native.get('keys') != keys:
                raise ValueError('Incomplete native sequence')
            if [frame['id'] for frame in native['frame_records']] != ids:
                raise ValueError('Unexpected frame records')
            if native['core_code_source'] != str(jar) or native['expected_jar'] != str(jar):
                raise ValueError('Wrong native core code source')
            if sketch in ('LayerMarks', 'MaskMarks'):
                expected_sources = {
                    'compositor': str(jar), 'crossfade': str(jar), 'adapter': str(jar)}
                if native.get('code_sources') != expected_sources:
                    raise ValueError('Wrong composition workflow class code sources')
            if sketch == 'PlacementImageMarks':
                expected_sources = {'placement': str(jar), 'layers': str(jar), 'compositor': str(jar)}
                if native.get('code_sources') != expected_sources:
                    raise ValueError('Wrong placement image workflow class code sources')
            report['native'] = native
            report['images'] = {name: {'path': label(native_out / (name + '.png')),
                                      'sha256': sha(native_out / (name + '.png'))}
                                for name in [*ids, stem]}
        after = {label(path): sha(path) for path in inputs}
        artifact_after = {label(path): sha(path) for path in artifacts}
        if before != after or artifact_before != artifact_after:
            raise ValueError('Input or executable artifact changed during validation')
        report.update(status='passed', input_sha256_after=after, artifact_sha256_after=artifact_after)
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'native': args.native, 'output': label(output)}))


if __name__ == '__main__':
    main()
