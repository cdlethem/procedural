#!/usr/bin/env python3
"""Compile the registered JAVA2D probes; --render reserves the initial native suite."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, run
from tools.check_processing_runtime import VERSION, CORE_SHA256

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--part',choices=('pixels','failures'),required=True,
                        help='Run each registered suite part once; both are required for acceptance')
    args=parser.parse_args()
    home=java_home()
    core=ROOT/f'.work/toolchains/processing-{VERSION}/core-{VERSION}.jar'
    if digest(core)!=CORE_SHA256: raise RuntimeError('Processing core checksum mismatch')
    build=ROOT/'.work/build/java2d-adapter-probes'
    if build.exists(): shutil.rmtree(build)
    build.mkdir(parents=True)
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    sources+=sorted((ROOT/'packages/java-processing/src/main/java').rglob('*.java'))
    sources += [ROOT/('tests/native/Java2DFrameNative.java' if args.part=='pixels'
                     else 'tests/native/Java2DFrameFailures.java')]
    inputs=[*sources,core,Path(__file__).resolve(),ROOT/'design/java2d-adapter-validation.md',
            ROOT/'catalog/drawing/fresh-raster-2d.json']
    hashes={str(p.relative_to(ROOT)):digest(p) for p in inputs}
    compiler=run([home/'bin/javac','--release','17','-cp',core,'-d',build,*sources])
    if not args.render:
        print('Native JAVA2D probe harnesses compiled; no rendering performed.')
        return
    output=ROOT/'.work/reproductions/java2d-adapter-probes'
    output.mkdir(parents=True,exist_ok=True)
    attempt=output/(args.part+'-attempt.json')
    with attempt.open('x') as stream:
        json.dump({'status':'started','reserved_suite_part':args.part,'input_sha256':hashes},stream,indent=2)
    report={'scope':'Registered JAVA2D native probe suite; CP1 and other hosts are separate',
            'processing_version':VERSION,'input_sha256':hashes,'compiler_stderr':compiler.stderr,
            'runtime':run([home/'bin/java','-version']).stderr.strip(),'status':'failed','runs':[]}
    try:
        # One serialized executor; retain output even when a harness reports failure.
        selected=[('Java2DFrameNative',[str(output)])] if args.part=='pixels' else [
            ('org.procedurals.processing.internal.Java2DFrameFailures',[])]
        report['part']=args.part
        for name,arguments in selected:
            result=subprocess.run(['xvfb-run','-a',str(home/'bin/java'),'-cp',f'{build}:{core}',name,*arguments],
                                  capture_output=True,text=True,cwd=ROOT,timeout=120)
            entry={'harness':name,'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
            try: entry['native']=json.loads(result.stdout)
            except json.JSONDecodeError: pass
            report['runs'].append(entry)
        if any(r['exit_code']!=0 or 'native' not in r for r in report['runs']):
            raise AssertionError('Native harness failure; inspect preserved output')
        if hashes!={str(p.relative_to(ROOT)):digest(p) for p in inputs}: raise RuntimeError('Inputs changed during native execution')
        report['images']={str(p.relative_to(ROOT)):digest(p) for p in sorted(output.glob('*.png'))}
        report['status']='passed'
    except Exception as error:
        report['failure']=str(error)
        raise
    finally:
        destination=ROOT/f'evidence/conformance/java2d-adapter-{args.part}.json'
        destination.write_text(json.dumps(report,indent=2)+'\n')
        attempt.write_text(json.dumps({'status':report['status'],'reserved_suite_part':args.part,'input_sha256':hashes},indent=2)+'\n')
    print(str(destination.relative_to(ROOT)))

if __name__=='__main__': main()
