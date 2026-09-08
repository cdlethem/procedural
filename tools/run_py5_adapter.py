#!/usr/bin/env python3
"""Prepare the pinned py5 native suite; --render reserves and executes one part."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--part',required=True,choices=('pixels','failures','cp1','ui','interruption'))
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--corrective',action='store_true')
    args=parser.parse_args()
    environment=ROOT/'.work/environments/py5'
    site=next((environment/'lib').glob('python*/site-packages'))
    driver=ROOT/('tests/native/py5_field_marks_ui.py' if args.part=='ui' else 'tests/native/py5_frame_driver.py')
    harness=ROOT/('tests/native/py5_frame_cp1.py' if args.part=='ui' else f'tests/native/py5_frame_{args.part}.py')
    sources=[driver,harness,
             Path(__file__).resolve(),ROOT/'design/py5-adapter-validation.md',ROOT/'catalog/drawing/fresh-raster-2d.json',
             *sorted((ROOT/'packages/python/procedurals').glob('*.py')),
             *[site/'py5'/p for p in ('__init__.py','graphics.py','sketch.py','base.py','mixins/pixels.py','jars/core.jar','jars/py5.jar')]]
    if args.part=='cp1':sources += [ROOT/'packages/python/examples/field_marks/mark_field.py',
        ROOT/'evidence/reproductions/cp1-java2d/plan.json',ROOT/'evidence/reproductions/cp1-java2d/result.json']
    if args.part=='ui':sources += [ROOT/'packages/python/examples/field_marks/mark_field.py',
        ROOT/'packages/python/examples/field_marks/sketch.py',ROOT/'design/py5-example-validation.md',
        ROOT/'evidence/conformance/py5-adapter-cp1.json']
    if args.part=='interruption':sources += [ROOT/'tests/native/py5_frame_failures.py',
        ROOT/'design/py5-interruption-validation.md']
    if args.corrective:
        if args.part!='pixels':parser.error('Only the documented pixel correction is registered')
        sources.append(ROOT/'design/py5-pixel-acquisition-repair.md')
    inputs={str(p.relative_to(ROOT)):digest(p) for p in sources}
    for source in sources:
        if source.suffix=='.py':ast.parse(source.read_text())
    if not args.render:
        print(f'py5 {args.part} inputs and Python syntax prepared; no rendering.')
        return
    output=ROOT/'.work/reproductions/py5-adapter';output.mkdir(parents=True,exist_ok=True)
    if args.corrective:
        initial=json.loads((output/f'{args.part}-attempt.json').read_text())
        if initial['status']!='failed':raise RuntimeError('Correction requires failed initial execution')
        source=ROOT/f'evidence/conformance/py5-adapter-{args.part}.json'
        preserved=source.with_name(f'py5-adapter-{args.part}-initial.json')
        with preserved.open('x') as stream:stream.write(source.read_text())
    attempt=output/f'{args.part}{"-corrective" if args.corrective else ""}-attempt.json'
    with attempt.open('x') as stream:json.dump({'status':'started','part':args.part,'input_sha256':inputs},stream,indent=2)
    report={'status':'failed','part':args.part,'scope':'Actual py5 JAVA2D registered suite part only',
            'input_sha256':inputs,'platform':sys.platform}
    try:
        env=dict(os.environ,JAVA_HOME=str(java_home()),JAVA_TOOL_OPTIONS='-Dsun.java2d.uiScale=2')
        result=subprocess.run(['xvfb-run','-a',str(environment/'bin/python'),str(driver),args.part],
            cwd=ROOT,env=env,capture_output=True,text=True,timeout=180)
        report.update(exit_code=result.returncode,stdout=result.stdout,stderr=result.stderr)
        records=[line.removeprefix('PROCEDURALS_RESULT=') for line in result.stdout.splitlines() if line.startswith('PROCEDURALS_RESULT=')]
        if len(records)!=1:raise AssertionError('Expected one py5 result')
        native=json.loads(records[0]);report['native']=native
        if result.returncode!=0 or native['passed'] is not True:raise AssertionError('py5 native assertions failed')
        if native['py5']!='0.10.11a0' or native['java']!='17.0.20.1':raise AssertionError('Unexpected runtime')
        if inputs!={str(p.relative_to(ROOT)):digest(p) for p in sources}:raise RuntimeError('Inputs changed during execution')
        report['status']='passed'
    except Exception as error:
        report['failure']=str(error)
        raise
    finally:
        destination=ROOT/f'evidence/conformance/py5-adapter-{args.part}.json'
        destination.write_text(json.dumps(report,indent=2)+'\n')
        attempt.write_text(json.dumps({'status':report['status'],'part':args.part,'input_sha256':inputs},indent=2)+'\n')
    print(str(destination.relative_to(ROOT)))

if __name__=='__main__':main()
