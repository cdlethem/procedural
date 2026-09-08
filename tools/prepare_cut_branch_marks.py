#!/usr/bin/env python3
"""Build a line-pool candidate core and compile its editable staged sketch; no rendering."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / '.work')
    if output.exists():
        raise RuntimeError('Preserve existing staging/build attempts')
    review_path = ROOT / 'evidence/distribution/r3-review.json'
    review = json.loads(review_path.read_text())
    core_review_path = ROOT / 'evidence/conformance/line-pool-java-root-review.json'
    core_review = json.loads(core_review_path.read_text())
    if any(r.get('status') != 'accepted' or r.get('reviewer') != 'root'
           for r in (review, core_review)):
        raise RuntimeError('Accepted root package/core reviews required')
    archive = ROOT / review['final_archive']['path']
    if sha(archive) != review['final_archive']['sha256']:
        raise RuntimeError('Accepted Java0.14 archive changed')
    source = ROOT / 'packages/java/src/main/java/org/procedurals/topology/LinePool2D.java'
    if sha(source) != core_review['core_sha256']:
        raise RuntimeError('Accepted LinePool2D source changed')
    helper = ROOT / 'packages/java/examples/CutBranchMarks/CutBranchComposition.java'
    pde = ROOT / 'packages/java-processing/examples/CutBranchMarks/CutBranchMarks.pde'
    bridge = ROOT / 'tests/native/PreprocessSketch.java'
    jdk = ROOT / '.work/toolchains/jdk-17.0.20.1+1'
    runtime = ROOT / '.work/toolchains/processing-4.5.6'
    processing = runtime / 'core-4.5.6.jar'
    prelibs = [runtime / 'preprocessor' / n for n in NAMES]
    inputs = [Path(__file__).resolve(), review_path, core_review_path, archive,
              source, helper, pde, bridge, processing, *prelibs,
              jdk / 'release', jdk / 'bin/javac', jdk / 'bin/java', jdk / 'lib/modules']
    before = {str(p.relative_to(ROOT)): sha(p) for p in inputs}
    output.mkdir(parents=True)
    build = output / 'build'
    addition = output / 'addition'
    sketch = output / 'CutBranchMarks'
    for directory in (build, addition, sketch / 'code', output / 'home'):
        directory.mkdir(parents=True)
    commands = []
    report = {'status': 'failed', 'scope': 'Candidate JAR and staged PDE compilation only; no native render or release acceptance.',
              'inputs_before': before, 'commands': commands}

    def run(argv):
        env = os.environ.copy()
        env.pop('APPDATA', None)
        env.pop('XDG_CONFIG_HOME', None)
        result = subprocess.run(list(map(str, argv)), cwd=ROOT, capture_output=True,
                                text=True, timeout=120, env=env)
        commands.append({'argv': list(map(str, argv)), 'exit_code': result.returncode,
                         'stdout': result.stdout, 'stderr': result.stderr})
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)

    try:
        run([jdk / 'bin/javac', '--release', '8', '-d', addition, source])
        with zipfile.ZipFile(archive) as bundle:
            inherited = bundle.read('procedurals/library/procedurals.jar')
        library = sketch / 'code/procedurals.jar'
        with zipfile.ZipFile(io.BytesIO(inherited)) as old, zipfile.ZipFile(library, 'x') as new:
            old_names = set(old.namelist())
            for info in old.infolist():
                new.writestr(info, old.read(info))
            additions = sorted(addition.rglob('*.class'))
            if not additions:
                raise RuntimeError('No LinePool2D classes compiled')
            for path in additions:
                name = path.relative_to(addition).as_posix()
                if name in old_names or not name.startswith('org/procedurals/topology/LinePool2D'):
                    raise RuntimeError('Unexpected new class: ' + name)
                info = zipfile.ZipInfo(name, (2026, 9, 7, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                new.writestr(info, path.read_bytes())
        with zipfile.ZipFile(io.BytesIO(inherited)) as old, zipfile.ZipFile(library) as new:
            if new.testzip() is not None or any(new.read(n) != old.read(n) for n in old.namelist()):
                raise RuntimeError('Inherited core member changed or CRC failure')
        for path in (helper, pde):
            (sketch / path.name).write_bytes(path.read_bytes())
        pre = os.pathsep.join(map(str, [processing, *prelibs]))
        run([jdk / 'bin/javac', '-cp', pre, '-d', build, bridge])
        generated = build / 'CutBranchMarks.java'
        run([jdk / 'bin/java', '-Duser.home=' + str(output / 'home'), '-cp', str(build) + os.pathsep + pre,
             'PreprocessSketch', sketch / pde.name, generated, 'CutBranchMarks'])
        cp = os.pathsep.join(map(str, [processing, library, build]))
        run([jdk / 'bin/javac', '--release', '17', '-cp', cp, '-d', build,
             sketch / helper.name, generated])
        if list((build / 'org/procedurals/topology').glob('*.class')):
            raise RuntimeError('Core classes must load from the candidate JAR')
        after = {str(p.relative_to(ROOT)): sha(p) for p in inputs}
        if after != before:
            raise RuntimeError('Inputs changed during staging')
        artifacts = [*sketch.rglob('*'), *build.rglob('*.class'), generated]
        report.update(status='passed', inputs_after=after,
                      artifacts_sha256={str(p.relative_to(ROOT)): sha(p) for p in artifacts if p.is_file()},
                      inherited_jar_members_preserved=len(old_names), added_core_classes=len(additions),
                      core_jar=str(library.relative_to(ROOT)), sketch_dir=str(sketch.relative_to(ROOT)))
    finally:
        (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(output / 'result.json')}))


if __name__ == '__main__':
    main()
