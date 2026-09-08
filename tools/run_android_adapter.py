#!/usr/bin/env python3
"""Build a registered Android suite part; --render executes it on the existing emulator."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT=Path(__file__).resolve().parents[1]
SDK=ROOT/'.work/toolchains/android/sdk'
APP='org.procedurals.nativeprobe'


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def adb(*args,timeout=120,check=True):
    return subprocess.run([str(SDK/'platform-tools/adb'),'-P','5038','-s','emulator-5580',*args],
                          text=True,capture_output=True,timeout=timeout,check=check)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--part',required=True,choices=('pixels','failures'))
    parser.add_argument('--render',action='store_true')
    args=parser.parse_args()
    harness=ROOT/('tests/native/AndroidFramePixels.java' if args.part=='pixels' else 'tests/native/AndroidFrameFailures.java')
    template=ROOT/'tests/native/android-bootstrap'
    activity=ROOT/'tests/native/android-adapter/MainActivity.java'
    core=ROOT/'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip'
    sources=[*sorted((ROOT/'packages/java/src/main/java').rglob('*.java')),
             *sorted((ROOT/'packages/java-android/src/main/java').rglob('*.java')),harness]
    template_files=[p for p in sorted(template.rglob('*')) if p.is_file() and p.suffix!='.java']
    bindings=[*sources,*template_files,activity,core,Path(__file__).resolve(),
              ROOT/'catalog/drawing/fresh-raster-2d.json',ROOT/'design/android-adapter-validation.md',
              ROOT/'evidence/conformance/android-environment.json',SDK/'platforms/android-33/android.jar']
    inputs={str(p.relative_to(ROOT)):digest(p) for p in bindings}
    stage=ROOT/f'.work/environments/android/adapter-{args.part}'
    stage.mkdir(parents=True,exist_ok=True)
    for source in template_files:
        destination=stage/source.relative_to(template)
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(source.read_text().replace('org.procedurals.bootstrap',APP))
    java=stage/'app/src/main/java'
    java.mkdir(parents=True,exist_ok=True)
    # Only this generated staging tree is replaced; developer sources stay untouched.
    for old in java.rglob('*.java'):old.unlink()
    for source in sources:
        destination=java/source.name
        if destination.exists():raise RuntimeError('Duplicate staged Java class filename')
        shutil.copyfile(source,destination)
    shutil.copyfile(activity,java/'MainActivity.java')
    (java/'SelectedPart.java').write_text('''package org.procedurals.nativeprobe;
import processing.core.PApplet;
import org.json.JSONObject;
import org.procedurals.android.internal.*;
final class SelectedPart {
 static final String NAME="pixels";
 static JSONObject run(PApplet parent, AndroidFrameHost host) { return AndroidFramePixels.run(parent,host); }
}
'''.replace('"pixels"','"'+args.part+'"').replace('AndroidFramePixels',harness.stem))
    (stage/'app/libs').mkdir(exist_ok=True)
    shutil.copyfile(core,stage/'app/libs/processing-core.jar')
    shutil.copyfile(ROOT/'.work/environments/android/bootstrap/debug.keystore',stage/'debug.keystore')
    (stage/'local.properties').write_text('sdk.dir='+str(SDK)+'\n')
    env=dict(os.environ,JAVA_HOME=str(ROOT/'.work/toolchains/jdk-17.0.20.1+1'),
             ANDROID_USER_HOME=str(ROOT/'.work/environments/android/user'),
             GRADLE_USER_HOME=str(ROOT/'.work/environments/android/gradle'))
    with (stage/'build.log').open('w') as log:
        subprocess.run([str(ROOT/'.work/toolchains/android/gradle-7.4.2/bin/gradle'),
            '--no-daemon','--console=plain',':app:assembleDebug'],cwd=stage,env=env,stdout=log,
            stderr=subprocess.STDOUT,check=True)
    if inputs!={str(p.relative_to(ROOT)):digest(p) for p in bindings}:raise RuntimeError('Inputs changed during build')
    apk=stage/'app/build/outputs/apk/debug/app-debug.apk'
    if not args.render:
        print('Android '+args.part+' APK built; no native execution')
        return
    if adb('shell','getprop','sys.boot_completed').stdout.strip()!='1':raise RuntimeError('Existing emulator is not booted')
    attempt=stage/'native-attempt.json'
    with attempt.open('x') as stream:json.dump({'status':'started','input_sha256':inputs},stream)
    report={'status':'failed','part':args.part,'input_sha256':inputs,'apk_sha256':digest(apk),
            'scope':'Actual registered Android suite part only; not full target certification'}
    try:
        report['install']=adb('install','-r',str(apk)).stdout
        adb('shell','am','force-stop',APP)
        adb('shell','run-as',APP,'rm','-f','files/result.json','files/result.tmp')
        report['launch']=adb('shell','am','start','-W','-n',APP+'/.MainActivity').stdout
        if 'Status: ok' not in report['launch']:raise RuntimeError('Native activity did not launch successfully')
        deadline=time.monotonic()+1800
        while time.monotonic()<deadline:
            result=adb('shell','run-as',APP,'cat','files/result.json',check=False)
            if result.returncode==0:
                native=json.loads(result.stdout)
                break
            if not adb('shell','pidof',APP,check=False).stdout.strip():
                report['runtime_errors']=adb('logcat','-d','-t','100','-s','AndroidRuntime',check=False).stdout
                raise RuntimeError('Native app process exited before publishing its result')
            time.sleep(2)
        else:raise TimeoutError('Native part has not published a result; inspect existing app before retrying')
        report['native']=native
        if native.get('passed') is not True or native.get('part')!=args.part:raise AssertionError('Native assertions failed')
        if native['api']!=33 or native['renderer']!='processing.a2d.PGraphicsAndroid2D':raise AssertionError('Unexpected native runtime')
        report['fingerprint']=adb('shell','getprop','ro.build.fingerprint').stdout.strip()
        if inputs!={str(p.relative_to(ROOT)):digest(p) for p in bindings}:raise RuntimeError('Inputs changed during native execution')
        report['status']='passed'
    except Exception as error:
        report['failure']=str(error)
        raise
    finally:
        destination=ROOT/f'evidence/conformance/android-adapter-{args.part}.json'
        destination.write_text(json.dumps(report,indent=2)+'\n')
        attempt.write_text(json.dumps({'status':report['status'],'input_sha256':inputs})+'\n')
    adb('shell','am','force-stop',APP)
    print(destination.relative_to(ROOT))


if __name__=='__main__':main()
