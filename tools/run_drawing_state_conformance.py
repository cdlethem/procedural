#!/usr/bin/env python3
"""Run production pure frame state with simulated adapter events, not native rendering."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def prepare_java():
    from tools.run_grid_conformance import java_home,java_value,run
    home=java_home(None);build=ROOT/'.work/build/drawing-state-java'
    if build.exists():shutil.rmtree(build)
    build.mkdir(parents=True)
    suite=json.loads((ROOT/'fixtures/drawing/fresh-raster-lifecycle.json').read_text())
    profile=json.loads((ROOT/'catalog/drawing/fresh-raster-2d.json').read_text())
    assert (suite['profile'],suite['version'])==(profile['id'],profile['version'])
    calls=['environment='+java_value(suite['environment'])+';']
    calls += ['scenario('+java_value(case)+');' for case in suite['cases']]
    template=ROOT/'tests/native/DrawingStateNative.java.in'
    generated=build/'DrawingStateNative.java'
    generated.write_text(template.read_text().replace('/* SHARED_LIFECYCLE_CASES */','\n'.join(calls)).replace('__LIFECYCLE_COUNT__',str(len(suite['cases']))))
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac','--release','8','-d',build,*sources,generated])
    return [str(home/'bin/java'),'-cp',str(build),'DrawingStateNative'],[str(p.relative_to(ROOT)) for p in [*sources,template]],run([home/'bin/java','-version']).stderr.strip()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',choices=['python','javascript','java'],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.target=='python':
        command=[sys.executable,'tests/native/drawing-state-python.py']
        sources=['packages/python/procedurals/_drawing.py','packages/python/procedurals/_drawing_state.py',
                 'tests/native/drawing-state-python.py']
        runtime=sys.version
    elif args.target=='javascript':
        command=['node','tests/native/drawing-state-javascript.mjs']
        sources=['packages/javascript/src/internal/drawing.js','packages/javascript/src/internal/drawing-state.js',
                 'tests/native/drawing-state-javascript.mjs']
        runtime=subprocess.check_output(['node','--version'],text=True).strip()
    else:command,sources,runtime=prepare_java()
    sources += ['catalog/drawing/fresh-raster-2d.json','fixtures/drawing/fresh-raster-lifecycle.json',
                'tools/run_drawing_state_conformance.py']
    def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources}
    before=hashes()
    result=subprocess.run(command,cwd=ROOT,check=True,capture_output=True,text=True)
    if before!=hashes():raise RuntimeError('Inputs changed during state conformance')
    report={'target':args.target,'scope':'Production pure frame state with simulated adapter events; no native surface, cleanup or renderer certification.',
            'input_sha256':before,'runtime':runtime,'result':json.loads(result.stdout),'stderr':result.stderr}
    destination=args.output if args.output.is_absolute() else ROOT/args.output
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':args.target,'report':str(destination),'scope':report['scope']}))


if __name__=='__main__':main()
