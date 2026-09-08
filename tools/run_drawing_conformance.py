#!/usr/bin/env python3
"""Run one actual language's pure drawing validator; no native adapter claim."""
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
    from tools.run_grid_conformance import java_home, java_value, run
    home=java_home(None)
    build=ROOT/'.work/build/drawing-java'
    if build.exists():shutil.rmtree(build)
    build.mkdir(parents=True)
    fixture=json.loads((ROOT/'fixtures/drawing/fresh-raster-normalized.json').read_text())
    geometry=json.loads((ROOT/'fixtures/drawing/geometry-investigation.json').read_text())
    calls=[]
    for case in fixture['cases']:
        calls.append('normalized('+','.join(java_value(case[k]) for k in ('id','environment','command','expected'))+');')
    for case in geometry['quads']:
        calls.append('topology('+','.join(java_value(case[k]) for k in ('id','vertices','binary32_vertices'))+','+str(case['canonical_strictly_convex']).lower()+','+str(case['binary32_strictly_convex']).lower()+');')
    for case in geometry['conversion']:
        calls.append('conversion('+','.join(java_value(case[k]) for k in ('id','input','output_bits_hex'))+');')
    template=ROOT/'tests/native/DrawingNative.java.in'
    generated=build/'DrawingNative.java'
    text=template.read_text().replace('/* SHARED_CASES */','\n'.join(calls))
    for key,count in [('NORMALIZED',len(fixture['cases'])),('TOPOLOGY',len(geometry['quads'])),('CONVERSION',len(geometry['conversion']))]:
        text=text.replace('__'+key+'_COUNT__',str(count))
    generated.write_text(text)
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    bound=[*sources,template,ROOT/'fixtures/drawing/fresh-raster-normalized.json',ROOT/'fixtures/drawing/geometry-investigation.json']
    initial={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}
    run([home/'bin/javac','--release','8','-d',build,*sources,generated])
    if initial!={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}:
        raise RuntimeError('Java source/fixtures changed during compilation')
    return [str(home/'bin/java'),'-cp',str(build),'DrawingNative'],[str(p.relative_to(ROOT)) for p in [*sources,template]],run([home/'bin/java','-version']).stderr.strip()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',choices=['python','javascript','java'],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.target=='python':
        command=[sys.executable,'tests/native/drawing-python.py']
        sources=['packages/python/procedurals/_drawing.py','tests/native/drawing-python.py']
        runtime=sys.version
    elif args.target=='javascript':
        command=['node','tests/native/drawing-javascript.mjs']
        sources=['packages/javascript/src/internal/drawing.js','tests/native/drawing-javascript.mjs']
        runtime=subprocess.check_output(['node','--version'],text=True).strip()
    else:
        command,sources,runtime=prepare_java()
    sources += ['catalog/drawing/fresh-raster-2d.json','fixtures/drawing/fresh-raster-normalized.json',
                'fixtures/drawing/geometry-investigation.json','fixtures/drawing/fresh-raster-schema.json',
                'tools/run_drawing_conformance.py']
    def hashes():
        return {s:hashlib.sha256((ROOT/s).read_bytes()).hexdigest() for s in sources}
    before=hashes()
    subprocess.run([sys.executable,'tools/build_drawing_geometry_fixtures.py','--check'],cwd=ROOT,check=True,capture_output=True,text=True)
    subprocess.run([sys.executable,'tools/build_drawing_normalization_fixtures.py','--check'],cwd=ROOT,check=True,capture_output=True,text=True)
    result=subprocess.run(command,cwd=ROOT,check=True,capture_output=True,text=True)
    if before!=hashes():raise RuntimeError('Inputs changed during conformance; rerun on stable sources')
    report={'target':args.target,'scope':'Pure command/environment validator only; no frame lifecycle or native backend certification.',
            'input_sha256':before,'runtime':runtime,'result':json.loads(result.stdout),'stderr':result.stderr}
    destination=args.output if args.output.is_absolute() else ROOT/args.output
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':args.target,'report':str(destination),'scope':report['scope']}))


if __name__=='__main__':main()
