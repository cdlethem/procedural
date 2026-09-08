#!/usr/bin/env python3
"""Preprocess/compile the actual PathMarks PDE with pinned Processing; no renders."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home,run
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--java-home');parser.add_argument('--output',type=Path,default=ROOT/'evidence/reproductions/cp2-java2d/pde-build.json')
    args=parser.parse_args();home=java_home(args.java_home)
    runtime=ROOT/'.work/toolchains/processing-4.5.6';core=runtime/'core-4.5.6.jar'
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    if sha(core)!=CORE_SHA256: raise RuntimeError('unexpected Processing core')
    libs=[runtime/'preprocessor'/name for name in NAMES]
    for p in libs:
        if not p.is_file():raise RuntimeError('missing pinned preprocessor library: '+str(p))
    build=ROOT/'.work/build/path-marks-pde';build.mkdir(parents=True,exist_ok=True)
    (build/'home').mkdir(exist_ok=True)
    example=ROOT/'packages/java-processing/examples/PathMarks'
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    sources+=sorted((ROOT/'packages/java-processing/src/main/java').rglob('*.java'))
    sources += [ROOT/'packages/java/examples/PathMarks/PathMarkComposition.java',example/'PathMarksCanvas.java']
    bridge=ROOT/'tests/native/PreprocessSketch.java'
    configuration_probe=ROOT/'tests/native/PathMarksPdeConfiguration.java'
    inputs=sources+[configuration_probe,bridge,example/'PathMarks.pde',core,*libs,Path(__file__).resolve()]
    bindings={str(p.relative_to(ROOT)):sha(p) for p in inputs}
    cp=os.pathsep.join(str(p) for p in [core,*libs])
    run([home/'bin/javac','-cp',cp,'-d',build,bridge])
    environment=os.environ.copy()
    for key in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA'):environment.pop(key,None)
    generated=build/'PathMarks.java'
    run([home/'bin/java',f'-Duser.home={build/"home"}','-cp',str(build)+os.pathsep+cp,
         'PreprocessSketch',example/'PathMarks.pde',generated,'PathMarks'],env=environment)
    run([home/'bin/javac','--release','17','-cp',core,'-d',build,*sources,generated,configuration_probe])
    run([home/'bin/java','-cp',str(build)+os.pathsep+str(core),'PathMarksPdeConfiguration'])
    if bindings!={str(p.relative_to(ROOT)):sha(p) for p in inputs}:raise RuntimeError('sources changed during compilation')
    report={'status':'passed','scope':'official Processing 4.5.6 PathMarks PDE preprocessing and compilation only',
            'input_sha256':bindings,'generated_java_sha256':sha(generated),'class_sha256':sha(build/'PathMarks.class'),
            'runtime':run([home/'bin/java','-version']).stderr.strip(),'build':str(build.relative_to(ROOT))}
    output=args.output;output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'passed','report':str(output),'scope':report['scope']}))

if __name__=='__main__':main()
