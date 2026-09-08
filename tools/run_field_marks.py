#!/usr/bin/env python3
"""Build/stage the native FieldMarks example and execute its four registered edit checks."""
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


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only',action='store_true',help='stage a Processing sketch without rendering')
    parser.add_argument('--java-home')
    parser.add_argument('--review-recheck',action='store_true',help='consume the explicitly registered corrective four-render budget')
    args=parser.parse_args()
    home=java_home(args.java_home)
    example=ROOT/'packages/java/examples/FieldMarks'
    stage=ROOT/'.work/examples/FieldMarks'
    stage.mkdir(parents=True,exist_ok=True)
    for name in ('FieldMarks.pde','MarkField.java'):
        source=example/name;target=stage/name
        if target.exists() and target.read_bytes()!=source.read_bytes():
            raise RuntimeError(f'Preserving edited staged sketch: {target}; move it before preparing a fresh copy')
        shutil.copyfile(source,target)
    build=ROOT/'.work/build/field-marks'
    if build.exists():shutil.rmtree(build)
    classes=build/'core';classes.mkdir(parents=True)
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac','--release','8','-d',classes,*sources])
    jar=ROOT/'dist/procedurals-core-0.1.0.jar';jar.parent.mkdir(exist_ok=True)
    run([home/'bin/jar','cf',jar,'-C',classes,'org'])
    (stage/'code').mkdir(exist_ok=True);shutil.copyfile(jar,stage/'code'/jar.name)
    if args.prepare_only:
        print(f'Open {stage/"FieldMarks.pde"} in Processing 4. No rendering performed.')
        return

    plan_path=ROOT/'evidence/reproductions/cp1-java2d/plan.json'
    plan=json.loads(plan_path.read_text())
    assert [c['id'] for c in plan['cases']]==['base','length','palette','bar']
    assert plan['render_budget'] in (4,8) and plan['dimensions']==[640,640]
    output=ROOT/plan['output'];output.mkdir(parents=True,exist_ok=True)
    core=ROOT/f'.work/toolchains/processing-{VERSION}/core-{VERSION}.jar'
    if not core.exists():
        run([sys.executable,ROOT/'tools/check_processing_runtime.py','--java-home',home])
    if digest(core)!=CORE_SHA256:raise RuntimeError('Processing core checksum mismatch')
    inputs=[plan_path,example/'FieldMarks.pde',example/'MarkField.java',
            ROOT/'tests/native/FieldMarksNative.java.in',Path(__file__).resolve(),core,*sources]
    input_hashes={str(p.relative_to(ROOT)):digest(p) for p in inputs}
    attempt_path=output/'attempt.json'
    report_path=ROOT/'evidence/reproductions/cp1-java2d/result.json'
    previous=None
    consumed=0
    if attempt_path.exists():
        attempt=json.loads(attempt_path.read_text())
        if attempt.get('status')=='complete' and attempt.get('input_sha256')==input_hashes and report_path.exists():
            report=json.loads(report_path.read_text())
            if all((ROOT/p).exists() and digest(ROOT/p)==sha for p,sha in report['image_sha256'].items()):
                print(f'Existing four-render result verified: {report_path}; no additional renders.')
                return
        if (args.review_recheck and plan.get('review_recheck',{}).get('additional_renders')==4
                and attempt.get('status')=='complete' and attempt.get('reserved_renders')==4):
            previous=json.loads(report_path.read_text());consumed=4
            (output/'initial-result.json').write_text(json.dumps(previous,indent=2)+'\n')
        else:
            raise RuntimeError('Registered render budget already reserved; inspect attempt.json and results before scheduling another run')
    native=build/'native';native.mkdir()
    calls=[]
    for case in plan['cases']:
        destination=output/case['id']/'frame_00001.png';destination.parent.mkdir(exist_ok=True)
        colors='new int[]{'+','.join('0x'+c for c in case['colors'])+'}'
        calls.append(f'render({json.dumps(case["id"])},{case["maxLength"]},{colors},{str(case["mark"]=="bar").lower()},{json.dumps(str(destination))});')
    source=native/'FieldMarksNative.java'
    source.write_text((ROOT/'tests/native/FieldMarksNative.java.in').read_text().replace('/* REGISTERED_RENDER_CALLS */','\n'.join(calls)))
    run([home/'bin/javac','--release','8','-cp',f'{jar}:{core}','-d',native,example/'MarkField.java',source])
    assert consumed+4<=plan['render_budget']
    attempt={'status':'started','reserved_renders':consumed+4,'input_sha256':input_hashes}
    attempt_path.write_text(json.dumps(attempt,indent=2)+'\n')
    result=run(['xvfb-run','-a',home/'bin/java','-cp',f'{native}:{jar}:{core}','FieldMarksNative'],timeout=120)
    native_result=json.loads(result.stdout)
    assert native_result['semantic_checks_passed']
    from PIL import Image, ImageChops, ImageStat
    images={}
    for case in plan['cases']:
        path=output/case['id']/'frame_00001.png'
        with Image.open(path) as image:
            assert image.size==(640,640)
            images[case['id']]=image.convert('RGB')
    metrics={}
    for name in ('length','palette','bar'):
        diff=ImageChops.difference(images['base'],images[name])
        pixels=diff.tobytes()
        metrics[name]={'mean_absolute_rgb_difference':sum(ImageStat.Stat(diff).mean)/(3*255),
                       'changed_pixel_fraction':sum((r|g|b)!=0 for r,g,b in zip(pixels[0::3],pixels[1::3],pixels[2::3]))/(640*640)}
        assert metrics[name]['changed_pixel_fraction']>0, f'{name}: edit made no visible pixels change'
    image_hashes={str((output/c['id']/'frame_00001.png').relative_to(ROOT)):digest(output/c['id']/'frame_00001.png') for c in plan['cases']}
    report={'scope':plan['scope'],'plan_sha256':digest(plan_path),'input_sha256':input_hashes,
            'jar_sha256':digest(jar),'runtime':run([home/'bin/java','-version']).stderr.strip(),
            'renderer_stderr':result.stderr,'native':native_result,'pixel_metrics':metrics,
            'image_sha256':image_hashes,'visual_inspection':'pending; record separately in decision.md',
            'pde_preprocessing':'unvalidated; actual Java helper compiled and executed'}
    if previous is not None:
        report['prior_validation']=previous
        report['corrective_images_identical']=image_hashes==previous['image_sha256']
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    attempt['status']='complete';attempt_path.write_text(json.dumps(attempt,indent=2)+'\n')
    print(json.dumps({'result':str(report_path),'images':str(output),'semantic_checks':True,'visual_inspection':'pending'}))


if __name__=='__main__':main()
