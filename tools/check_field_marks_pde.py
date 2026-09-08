#!/usr/bin/env python3
"""Preprocess and compile FieldMarks with the pinned official Processing distribution."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from urllib.request import urlopen
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, run
from tools.check_processing_runtime import CORE_SHA256

URL='https://github.com/processing/processing4/releases/download/processing-1434-4.5.6/processing-4.5.6-linux-x64-portable.zip'
SHA256='ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c'
NAMES=['preprocessor-4.5.6.jar','utils-4.5.6.jar','antlr4-runtime-4.13.2.jar',
       'antlr4-4.13.2.jar','org.eclipse.jdt.core-3.16.0.jar']


def digest(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--java-home')
    args=parser.parse_args();home=java_home(args.java_home)
    root=ROOT/'.work/toolchains/processing-4.5.6';root.mkdir(parents=True,exist_ok=True)
    archive=root/'processing-4.5.6-linux-x64-portable.zip'
    if not archive.exists():
        temporary=archive.with_suffix('.download')
        with urlopen(URL,timeout=60) as response,temporary.open('wb') as output:
            shutil.copyfileobj(response,output)
        if digest(temporary)!=SHA256:raise RuntimeError('Processing archive checksum mismatch')
        temporary.replace(archive)
    if digest(archive)!=SHA256:raise RuntimeError('Processing archive checksum mismatch')
    libraries=root/'preprocessor';libraries.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for name in NAMES:
            (libraries/name).write_bytes(z.read('Processing/lib/app/resources/modes/java/mode/'+name))
    core=root/'core-4.5.6.jar'
    if not core.exists() or digest(core)!=CORE_SHA256:raise RuntimeError('Run tools/check_processing_runtime.py for the pinned core')
    build=ROOT/'.work/build/field-marks-pde'
    if build.exists():shutil.rmtree(build)
    build.mkdir(parents=True);(build/'home').mkdir()
    # Build the exact current core in this check's private directory. An unrelated
    # dist JAR (or an artist-edited staged example) must not determine compilation.
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    if not sources:raise RuntimeError('No Java core sources found')
    source_hashes={str(p.relative_to(ROOT)):digest(p) for p in sources}
    classes=build/'core';classes.mkdir()
    run([home/'bin/javac','--release','8','-d',classes,*sources])
    if source_hashes!={str(p.relative_to(ROOT)):digest(p) for p in sources}:
        raise RuntimeError('Core sources changed during compilation; retry on a stable checkout')
    jar=build/'procedurals-core-0.1.0.jar'
    run([home/'bin/jar','cf',jar,'-C',classes,'org'])
    classpath=os.pathsep.join(str(libraries/name) for name in NAMES)+os.pathsep+str(core)
    bridge=ROOT/'tests/native/PreprocessFieldMarks.java'
    run([home/'bin/javac','-cp',classpath,'-d',build,bridge])
    example=ROOT/'packages/java/examples/FieldMarks';generated=build/'FieldMarks.java'
    environment=os.environ.copy()
    # The SDK's Preferences reader must not create settings outside this repository.
    for name in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA'):environment.pop(name,None)
    result=run([home/'bin/java',f'-Duser.home={build/"home"}','-cp',str(build)+os.pathsep+classpath,
                'PreprocessFieldMarks',example/'FieldMarks.pde',generated],env=environment)
    run([home/'bin/javac','-cp',os.pathsep.join((str(core),str(jar))),'-d',build,generated,example/'MarkField.java'])
    inputs=[example/'FieldMarks.pde',example/'MarkField.java',bridge,Path(__file__).resolve(),jar,core,*sources,*[libraries/name for name in NAMES]]
    report={'scope':'Official Processing 4.5.6 production PDE preprocessing and Java compilation; GUI lifecycle/rendering is separate.',
            'archive_url':URL,'archive_sha256':SHA256,'result':result.stdout.strip(),
            'core_build':{'source_sha256':source_hashes,'java_release':8,
                          'javac_sha256':digest(home/'bin/javac'),
                          'jar_path':str(jar.relative_to(ROOT)),
                          'jar_sha256':digest(jar),'reused_dist_jar':False},
            'runtime':run([home/'bin/java','-version']).stderr.strip(),
            'input_sha256':{str(p.relative_to(ROOT)):digest(p) for p in inputs},
            'generated_java_sha256':digest(generated),'compiled_class_sha256':digest(build/'FieldMarks.class')}
    destination=ROOT/'evidence/reproductions/cp1-java2d/pde-build.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'pde_preprocessing':True,'java_compilation':True,'evidence':str(destination)}))


if __name__=='__main__':main()
