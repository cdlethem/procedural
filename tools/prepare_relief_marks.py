#!/usr/bin/env python3
"""Build a R1 candidate core and compile its editable staged sketch; no rendering."""
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
    review_path = ROOT / 'evidence/distribution/cp11-review.json'
    review = json.loads(review_path.read_text())
    if review.get('status') != 'accepted' or review.get('reviewer') != 'root':
        raise RuntimeError('Accepted root package review required')
    archive = ROOT / review['final_archive']['path']
    if sha(archive) != review['final_archive']['sha256']:
        raise RuntimeError('Accepted CP10 archive changed')
    helper = ROOT / 'packages/java/examples/ReliefMarks/ReliefComposition.java'
    pde = ROOT / 'packages/java-processing/examples/ReliefMarks/ReliefMarks.pde'
    bridge = ROOT / 'tests/native/PreprocessSketch.java'
    jdk = ROOT / '.work/toolchains/jdk-17.0.20.1+1'
    runtime = ROOT / '.work/toolchains/processing-4.5.6'
    processing = runtime / 'core-4.5.6.jar'
    prelibs = [runtime / 'preprocessor' / n for n in NAMES]
    inputs = [Path(__file__).resolve(), review_path, archive,
              helper, pde, bridge, processing, *prelibs,
              jdk / 'release', jdk / 'bin/javac', jdk / 'bin/java', jdk / 'lib/modules']
    before = {str(p.relative_to(ROOT)): sha(p) for p in inputs}
    output.mkdir(parents=True)
    build = output / 'build'
    addition = output / 'addition'
    sketch = output / 'ReliefMarks'
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
        with zipfile.ZipFile(archive) as bundle:
            inherited = bundle.read('procedurals/library/procedurals.jar')
        library = sketch / 'code/procedurals.jar'
        library.write_bytes(inherited)
        with zipfile.ZipFile(library) as jar:
            if jar.testzip() is not None:
                raise RuntimeError('Accepted JAR CRC failure')
            old_names = set(jar.namelist())
        additions = []
        for path in (helper, pde):
            (sketch / path.name).write_bytes(path.read_bytes())
        pre = os.pathsep.join(map(str, [processing, *prelibs]))
        run([jdk / 'bin/javac', '-cp', pre, '-d', build, bridge])
        generated = build / 'ReliefMarks.java'
        run([jdk / 'bin/java', '-Duser.home=' + str(output / 'home'), '-cp', str(build) + os.pathsep + pre,
             'PreprocessSketch', sketch / pde.name, generated, 'ReliefMarks'])
        cp = os.pathsep.join(map(str, [processing, library, build]))
        run([jdk / 'bin/javac', '--release', '17', '-cp', cp, '-d', build,
             sketch / helper.name, generated])
        if list((build / 'org/procedurals/topology').glob('*.class')) or list((build / 'org/procedurals/layout').glob('*.class')):
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
