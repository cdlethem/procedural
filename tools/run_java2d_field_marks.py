#!/usr/bin/env python3
"""Compile CP1's adapter route; --render consumes its registered initial four images."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, run
from tools.check_processing_runtime import VERSION, CORE_SHA256

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render',action='store_true')
    args=parser.parse_args()
    home=java_home()
    core=ROOT/f'.work/toolchains/processing-{VERSION}/core-{VERSION}.jar'
    if digest(core)!=CORE_SHA256: raise RuntimeError('Processing core checksum mismatch')
    registration=ROOT/'design/java2d-adapter-validation.md'
    old_plan=ROOT/'evidence/reproductions/cp1-java2d/plan.json'
    previous=ROOT/'evidence/reproductions/cp1-java2d/result.json'
    cases=json.loads(old_plan.read_text())['cases']
    if [c['id'] for c in cases]!=['base','length','palette','bar']: raise RuntimeError('Unexpected CP1 cases')
    output=ROOT/'.work/reproductions/cp1-java2d-adapter'
    build=ROOT/'.work/build/java2d-field-marks'
    if build.exists(): shutil.rmtree(build)
    build.mkdir(parents=True)
    calls=[]
    for case in cases:
        destination=output/(case['id']+'.png')
        colors='new Integer[]{'+','.join('0x'+c for c in case['colors'])+'}'
        calls.append(f'render({json.dumps(case["id"])},{case["maxLength"]},{colors},'
                     f'{str(case["mark"]=="bar").lower()},{json.dumps(str(destination))});')
    template=ROOT/'tests/native/Java2DFieldMarks.java.in'
    generated=build/'Java2DFieldMarks.java'
    generated.write_text(template.read_text().replace('/* REGISTERED_RENDER_CALLS */','\n'.join(calls)))
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    sources+=sorted((ROOT/'packages/java-processing/src/main/java').rglob('*.java'))
    sources+=[ROOT/'packages/java/examples/FieldMarks/MarkField.java']
    inputs=[*sources,template,registration,old_plan,previous,core,Path(__file__).resolve(),
            ROOT/'catalog/drawing/fresh-raster-2d.json']
    hashes={str(p.relative_to(ROOT)):digest(p) for p in inputs}
    compiled=run([home/'bin/javac','--release','17','-cp',core,'-d',build,*sources,generated])
    if not args.render:
        print('Current adapter CP1 harness compiled; no render budget consumed.')
        return
    output.mkdir(parents=True,exist_ok=True)
    attempt=output/'attempt.json'
    # Exclusive creation prevents accidental duplicate consumption after interruption.
    with attempt.open('x') as stream:
        json.dump({'status':'started','reserved_images':4,'input_sha256':hashes},stream,indent=2)
    report={'scope':'CP1 adapter edit/transfer only; native profile probes and other hosts remain separate',
            'input_sha256':hashes,'processing_version':VERSION,'compiler_stderr':compiled.stderr,
            'runtime':run([home/'bin/java','-version']).stderr.strip(),'status':'failed'}
    try:
        execution=run(['xvfb-run','-a',home/'bin/java','-cp',f'{build}:{core}','Java2DFieldMarks'],timeout=120)
        native=[json.loads(line) for line in execution.stdout.splitlines() if line.strip()]
        report.update(native=native,renderer_stderr=execution.stderr)
        old={c['id']:c for c in json.loads(previous.read_text())['native']['cases']}
        if [c['id'] for c in native]!=[c['id'] for c in cases]: raise AssertionError('Missing native cases')
        for case in native:
            for key in ('model_sha256','geometry_sha256','color_sha256','commands'):
                if case[key]!=old[case['id']][key]: raise AssertionError(f'{case["id"]}: {key} differs from prior CP1')
        from PIL import Image, ImageChops
        images={}
        report['images']={}
        for case in cases:
            path=output/(case['id']+'.png')
            with Image.open(path) as image:
                if image.size!=(640,640): raise AssertionError('Wrong image size')
                images[case['id']]=image.convert('RGBA')
            pixels=images[case['id']].tobytes()
            if any(pixels[i]!=255 for i in range(3,len(pixels),4)): raise AssertionError('Nonopaque output')
            coverage=sum(tuple(pixels[i:i+3])!=(236,231,218) for i in range(0,len(pixels),4))
            if coverage==0: raise AssertionError('Empty composition')
            report['images'][case['id']]={'path':str(path.relative_to(ROOT)),'png_sha256':digest(path),
                'rgba_sha256':hashlib.sha256(pixels).hexdigest(),'nonbackground_pixels':coverage}
        report['edit_changed_pixels']={}
        for name in ('length','palette','bar'):
            pixels=ImageChops.difference(images['base'].convert('RGB'),images[name].convert('RGB')).tobytes()
            changed=sum(any(pixels[i:i+3]) for i in range(0,len(pixels),3))
            if not changed: raise AssertionError('Invisible edit '+name)
            report['edit_changed_pixels'][name]=changed
        if hashes!={str(p.relative_to(ROOT)):digest(p) for p in inputs}: raise RuntimeError('Inputs changed during execution')
        report.update(status='passed',visual_inspection='pending')
    except Exception as error:
        report['failure']=str(error)
        raise
    finally:
        destination=ROOT/'evidence/reproductions/cp1-java2d-adapter/result.json'
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(json.dumps(report,indent=2)+'\n')
        attempt.write_text(json.dumps({'status':report['status'],'reserved_images':4,'input_sha256':hashes},indent=2)+'\n')
    print(str(destination.relative_to(ROOT)))

if __name__=='__main__': main()
