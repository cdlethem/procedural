#!/usr/bin/env python3
"""Build a local CP3 wheel and standalone PlacementMarks starter; never render/publish."""
import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import zipfile

from build_path_marks_python import (ROOT, archive_entries, copy, digest, isolated_python,
                                    run, source_files, uv_executable)
from operation_attestations import validate_target_attestation

NAMES = ('regular-grid', 'gradient-noise-2d-01', 'cyclic-palette', 'gradient-path',
         'ordered-circle-filter', 'seeded-circle-placement')
PACKAGE = ROOT / 'packages/python'
EXAMPLE = PACKAGE / 'examples/placement_marks'
VERSION = '0.3.0'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--py5-python', type=Path, default=ROOT / '.work/environments/py5/bin/python')
    parser.add_argument('--java-home', type=Path, default=ROOT / '.work/toolchains/jdk-17.0.20.1+1')
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / '.work/dist/cp3')
    support = []
    for name in NAMES:
        operation = json.loads((ROOT / f'catalog/operations/{name}.json').read_text())
        operation['_file'] = name + '.json'
        errors, record = validate_target_attestation(ROOT, operation, 'py5')
        if errors or record is None or record['dimensions']['core']['status'] != 'conformant':
            raise RuntimeError('Python support not verified: ' + name + ': ' + str(errors))
        support.append(record)
    inputs = [*source_files(PACKAGE / 'procedurals'), *source_files(EXAMPLE), PACKAGE / 'pyproject.toml',
              ROOT / 'LICENSE', ROOT / 'THIRD_PARTY_NOTICES.md', Path(__file__).resolve(),
              ROOT / 'tools/build_path_marks_python.py', ROOT / 'tools/operation_attestations.py',
              ROOT / 'tools/reviewed_export_extension.py']
    before = {str(p.relative_to(ROOT)): digest(p) for p in inputs}
    output.mkdir(parents=True, exist_ok=False)
    environment = dict(os.environ, PYTHONNOUSERSITE='1', PYTHONPATH='')
    stage = output / 'source'; stage.mkdir()
    shutil.copytree(PACKAGE / 'procedurals', stage / 'procedurals', ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    metadata = (PACKAGE / 'pyproject.toml').read_text()
    if metadata.count('version = "0.1.0"') != 1:
        raise RuntimeError('source package metadata changed')
    (stage / 'pyproject.toml').write_text(metadata.replace('version = "0.1.0"', 'version = "0.3.0"', 1))
    for name in ('LICENSE', 'THIRD_PARTY_NOTICES.md'): copy(ROOT / name, stage / name)
    uv = uv_executable()
    wheelhouse = output / 'wheelhouse'; wheelhouse.mkdir()
    run([uv, 'build', '--wheel', '--out-dir', wheelhouse, stage], cwd=output, environment=environment)
    wheels = list(wheelhouse.glob('*.whl'))
    if len(wheels) != 1: raise RuntimeError('expected exactly one wheel')
    wheel = wheels[0]
    entries = archive_entries(wheel)
    names = [v['path'] for v in entries]
    if not all(any(v.endswith(suffix) for v in names) for suffix in
               ('procedurals/placements.py', 'licenses/LICENSE', 'licenses/THIRD_PARTY_NOTICES.md')):
        raise RuntimeError('wheel lacks implementation or notices')
    entries_by_name = {entry['path']:entry['sha256'] for entry in entries}
    for path in source_files(stage / 'procedurals'):
        if entries_by_name.get(str(path.relative_to(stage))) != digest(path):
            raise RuntimeError('wheel core differs: ' + str(path))
    starter = output / 'placement-marks'; starter.mkdir()
    original = (EXAMPLE / 'sketch.py').read_text()
    removed = '# Run directly from this repository checkout; packaged starters may omit this path.\nsys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n'
    if original.count(removed) != 1: raise RuntimeError('unexpected checkout import block')
    transformed = original.replace(removed, '', 1)
    classes = lambda s: [ast.dump(n) for n in ast.parse(s).body if isinstance(n, ast.ClassDef)]
    if classes(original) != classes(transformed): raise RuntimeError('sketch behavior changed')
    (starter / 'sketch.py').write_text(transformed)
    copy(EXAMPLE / 'placement_marks.py', starter / 'placement_marks.py')
    for name in ('LICENSE', 'THIRD_PARTY_NOTICES.md'): copy(ROOT / name, starter / name)
    (starter / 'README.md').write_text('# PlacementMarks for py5\n\nRequires Python 3.11+, Java17 and py5 0.10.11a0.\n\nFrom the extracted directory:\n\n```sh\npython -m pip install "./' + wheel.name + '[py5]"\npython placement-marks/sketch.py\n```\n\nR seed, N budget, X source, G separation, I/O radii, M motif, C palette, S save.\nOutput is saved beside the sketch in output/. Controls describe this piece, not library defaults.\n')
    archive = output / ('procedurals-placement-marks-python-' + VERSION + '.zip')
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as z:
        z.write(wheel, wheel.name)
        for p in source_files(starter): z.write(p, 'placement-marks/' + str(p.relative_to(starter)))
    extracted = output / 'extracted'; extracted.mkdir()
    with zipfile.ZipFile(archive) as z: z.extractall(extracted)
    if digest(extracted / wheel.name) != digest(wheel): raise RuntimeError('bundled wheel differs')
    for path in source_files(starter):
        if digest(extracted / 'placement-marks' / path.relative_to(starter)) != digest(path):
            raise RuntimeError('extracted starter differs')
    consumer_python = isolated_python(uv, output / 'consumer-venv', environment)
    run([consumer_python, '-m', 'pip', 'install', '--no-deps', extracted / wheel.name], cwd=extracted, environment=environment)
    smoke = '''import json, pathlib, procedurals, struct
from placement_marks import create_placement_composition
base=create_placement_composition(False,42,5000,4,64,1)
extended=create_placement_composition(False,42,10000,4,64,1)
assert base.size==424 and extended.size==517
pack=lambda p: struct.pack('>d',p)
a,b=base.to_values(),extended.to_values()
for i in range(base.size):
 assert [pack(x) for x in a['centres'][i]]==[pack(x) for x in b['centres'][i]]
 assert pack(a['radii'][i])==pack(b['radii'][i]) and a['sourceIndices'][i]==b['sourceIndices'][i]
assert create_placement_composition(True,42,5000,4,64,1).attempts==160
for name in ('regular_grid','gradient_noise_2d_01','cyclic_palette','gradient_path_2d'):
 assert callable(getattr(procedurals,name))
print(json.dumps({'status':'passed','baseline':base.size,'extended':extended.size,'prefix':True,'imported':str(pathlib.Path(procedurals.__file__).resolve())}))
'''
    smoke_path = extracted / 'placement-marks/consumer.py'; smoke_path.write_text(smoke)
    consumer = json.loads(run([consumer_python, smoke_path], cwd=extracted, environment=environment).stdout)
    Path(consumer['imported']).relative_to(output / 'consumer-venv')
    py5_environment = dict(environment, JAVA_HOME=str(args.java_home.resolve()),
                           PYTHONPATH=str(Path(consumer['imported']).parent.parent))
    load_code = "import json,runpy,procedurals,py5; from pathlib import Path; " + \
        "module=runpy.run_path('sketch.py',run_name='package_import_check'); " + \
        "assert 'PlacementMarksSketch' in module; " + \
        "assert str(Path(procedurals.__file__).resolve())==" + repr(consumer['imported']) + \
        "; print(json.dumps({'status':'passed','py5':py5.__version__,'scope':'class import only; no sketch instantiation or render'}))"
    py5_load = json.loads(run(['xvfb-run','-a',args.py5_python.absolute(),'-c',load_code],
                             cwd=extracted / 'placement-marks', environment=py5_environment).stdout)
    if py5_load['py5'] != '0.10.11a0': raise RuntimeError('unexpected py5 version')
    for p,expected in before.items():
        if digest(ROOT / p) != expected: raise RuntimeError('source changed: ' + p)
    report = {'status':'passed','scope':'Local wheel, extracted starter model and installed public-core checks. Includes real py5 class import with the installed wheel; no native render, publication or distribution acceptance claim.',
              'version':VERSION,'input_sha256':before,'support':support,'wheel_sha256':digest(wheel),
              'wheel_entries':entries,'starter_sha256':digest(archive),'starter_entries':archive_entries(archive),
              'sketch_transform':{'removed':removed,'class_ast_preserved':True},'consumer':consumer,'py5_load':py5_load}
    (output / 'result.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'status':'passed','wheel':str(wheel),'starter':str(archive)}))


if __name__ == '__main__': main()
