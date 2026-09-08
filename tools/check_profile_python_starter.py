#!/usr/bin/env python3
"""Import the extracted ProfileMarks starter in its installed environment; use shared render lock."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--java-home', type=Path, required=True)
    args = parser.parse_args()
    build, output = args.build.resolve(), args.output.resolve()
    if not build.is_relative_to(ROOT / '.work') or not output.is_relative_to(ROOT / '.work') or output.exists():
        raise ValueError('existing .work build and fresh .work output required')
    source = build / 'build-result.json'
    report = json.loads(source.read_text())
    if report['status'] != 'passed':
        raise ValueError('package build has not passed')
    bindings = {**report['input_sha256'], str(source.relative_to(ROOT)): sha(source),
                str(Path(__file__).resolve().relative_to(ROOT)): sha(Path(__file__))}
    def verify():
        for name, expected in bindings.items():
            if sha(ROOT / name) != expected:
                raise ValueError('changed input: ' + name)
    verify()
    starter = build / 'build/extracted/profile-marks'
    python = build / 'build/consumer-venv/bin/python'
    script = '''import hashlib,inspect,json,sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
import sketch,py5,procedurals
from procedurals import RadialProfile3D
from procedurals.radial_profile import RadialProfile3D as direct
from jpype import JClass
assert RadialProfile3D is direct
assert issubclass(sketch.ProfileMarksSketch,py5.Sketch)
assert callable(sketch.ProfileMarksSketch.draw) and callable(sketch.ProfileMarksSketch.get_pixels)
assert Path(sketch.__file__).resolve().parent==Path(sys.argv[1])
assert Path(procedurals.__file__).resolve().is_relative_to(Path(sys.prefix))
package=Path(py5.__file__).parent
java=Path(str(JClass('java.lang.System').getProperty('java.home')))
paths=[Path(sketch.__file__),Path(procedurals.__file__),Path(inspect.getfile(direct))]
paths += [package/name for name in ('__init__.py','sketch.py','base.py','jars/core.jar','jars/py5.jar')]
paths += [java/'release',java/'lib/modules']
print(json.dumps({'status':'passed','scope':'Extracted starter class import only; no sketch instance or render','python':sys.version,'py5':str(py5.__version__),'files_sha256':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}))
'''
    env = dict(os.environ, JAVA_HOME=str(args.java_home.resolve()), PYTHONPATH='', PYTHONNOUSERSITE='1')
    result = subprocess.run([str(python), '-I', '-c', script, str(starter)], cwd=starter,
                            env=env, capture_output=True, text=True, timeout=90)
    output.mkdir(parents=True)
    (output / 'stdout.txt').write_text(result.stdout)
    (output / 'stderr.txt').write_text(result.stderr)
    if result.returncode:
        raise RuntimeError('starter import failed; preserved stdout/stderr in ' + str(output))
    observed = json.loads(result.stdout)
    for name, expected in observed['files_sha256'].items():
        if sha(Path(name)) != expected:
            raise ValueError('runtime/starter changed: ' + name)
    verify()
    observed['input_sha256'] = bindings
    (output / 'result.json').write_text(json.dumps(observed, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'output': str(output)}))

if __name__ == '__main__':
    main()
