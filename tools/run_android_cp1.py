#!/usr/bin/env python3
"""Stage Android CP1, and execute its one registered attempt only with --render."""
import argparse, hashlib, json, os, shutil, subprocess, time
from pathlib import Path
from PIL import Image, ImageChops
from run_android_adapter import ROOT, SDK, adb, digest

APP='org.procedurals.cp1probe'
STAGE=ROOT/'.work/environments/android/cp1'
OUTPUT=ROOT/'.work/reproductions/cp1-android'
EVIDENCE=ROOT/'evidence/reproductions/cp1-android/result.json'

def calls(plan):
    required=('base','length','palette','bar')
    if [item.get('id') for item in plan['cases']]!=list(required):raise RuntimeError('Unexpected CP1 plan cases')
    rows=[]
    for item in plan['cases']:
        if set(item)!=(set(('id','maxLength','colors','mark')) if item['id']!='bar' else set(('id','maxLength','colors','mark','width'))):
            raise RuntimeError('Unexpected CP1 case fields: '+item['id'])
        if item['mark'] not in ('line','bar') or (item['mark']=='bar' and item.get('width')!=2.5):
            raise RuntimeError('Unexpected CP1 mark configuration')
        colors=', '.join('0x'+value for value in item['colors'])
        rows.append('cases.put(render(host, outputDirectory, '+json.dumps(item['id'])+', '+str(float(item['maxLength']))+', new Integer[]{'+colors+'}, '+str(item['mark']=='bar').lower()+'));')
    return '\n        '.join(rows)

def atomic(path,value):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(value,indent=2)+'\n'); tmp.replace(path)

def binary_pull(remote,destination):
    with destination.open('wb') as stream:
        subprocess.run([str(SDK/'platform-tools/adb'),'-P','5038','-s','emulator-5580','exec-out','run-as',APP,'cat',remote],stdout=stream,stderr=subprocess.PIPE,timeout=120,check=True)

def image_record(path):
    with Image.open(path) as source:
        image=source.convert('RGBA'); data=image.tobytes()
    if image.size!=(640,640) or any(v!=255 for v in data[3::4]):raise AssertionError('CP1 image is not opaque 640x640: '+path.name)
    background=bytes((236,231,218)); nonbackground=sum(data[i:i+3]!=background for i in range(0,len(data),4))
    if nonbackground==0:raise AssertionError('CP1 image is empty: '+path.name)
    return {'path':str(path.relative_to(ROOT)),'png_sha256':digest(path),'rgba_sha256':hashlib.sha256(data).hexdigest(),'nonbackground_pixels':nonbackground,'_image':image}

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--render',action='store_true'); args=parser.parse_args()
    plan_path=ROOT/'evidence/reproductions/cp1-java2d/plan.json'; accepted_path=ROOT/'evidence/reproductions/cp1-java2d-adapter/result.json'
    plan=json.loads(plan_path.read_text()); accepted_result=json.loads(accepted_path.read_text())
    if accepted_result.get('status')!='passed':raise RuntimeError('Accepted JAVA2D CP1 result is not passed')
    accepted=accepted_result.get('native')
    if not isinstance(accepted,list):raise RuntimeError('Accepted JAVA2D CP1 native cases are missing')
    template=ROOT/'tests/native/android-bootstrap'; core=ROOT/'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip'
    harness=ROOT/'tests/native/AndroidFieldMarks.java.in'; mark=ROOT/'packages/java/examples/FieldMarks/MarkField.java'; activity=ROOT/'tests/native/android-cp1/MainActivity.java'
    sources=[*sorted((ROOT/'packages/java/src/main/java').rglob('*.java')),*sorted((ROOT/'packages/java-android/src/main/java').rglob('*.java')),harness,mark,activity]
    templates=[p for p in template.rglob('*') if p.is_file() and p.suffix!='.java']
    bindings=[*sources,*templates,plan_path,accepted_path,core,Path(__file__).resolve(),ROOT/'tools/run_android_adapter.py',ROOT/'catalog/drawing/fresh-raster-2d.json',ROOT/'design/android-adapter-validation.md',ROOT/'evidence/conformance/android-environment.json',SDK/'platforms/android-33/android.jar']
    def hashes():return {str(p.relative_to(ROOT)):digest(p) for p in bindings}
    inputs=hashes(); STAGE.mkdir(parents=True,exist_ok=True)
    for source in templates:
        target=STAGE/source.relative_to(template); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(source.read_text().replace('org.procedurals.bootstrap',APP))
    java=STAGE/'app/src/main/java'; java.mkdir(parents=True,exist_ok=True)
    for old in java.rglob('*.java'):old.unlink()
    for source in sources:
        if source==harness: text=source.read_text().replace('/* REGISTERED_ANDROID_CP1_CALLS */',calls(plan)); target=java/'AndroidFieldMarks.java'
        elif source==mark: text='package org.procedurals.android.internal;\n'+source.read_text(); target=java/'MarkField.java'
        else: text=source.read_text(); target=java/source.name
        target.write_text(text)
    (STAGE/'app/libs').mkdir(exist_ok=True); shutil.copyfile(core,STAGE/'app/libs/processing-core.jar'); shutil.copyfile(ROOT/'.work/environments/android/bootstrap/debug.keystore',STAGE/'debug.keystore'); (STAGE/'local.properties').write_text('sdk.dir='+str(SDK)+'\n')
    env=dict(os.environ,JAVA_HOME=str(ROOT/'.work/toolchains/jdk-17.0.20.1+1'),ANDROID_USER_HOME=str(ROOT/'.work/environments/android/user'),GRADLE_USER_HOME=str(ROOT/'.work/environments/android/gradle'))
    with (STAGE/'build.log').open('w') as log: subprocess.run([str(ROOT/'.work/toolchains/android/gradle-7.4.2/bin/gradle'),'--no-daemon','--console=plain',':app:assembleDebug'],cwd=STAGE,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    if inputs!=hashes():raise RuntimeError('Inputs changed during build')
    apk=STAGE/'app/build/outputs/apk/debug/app-debug.apk'
    if not args.render: print('Android CP1 APK built; no native execution'); return
    if adb('shell','getprop','sys.boot_completed').stdout.strip()!='1':raise RuntimeError('Existing emulator is not booted')
    attempt=OUTPUT/'attempt.json'; OUTPUT.mkdir(parents=True,exist_ok=True)
    with attempt.open('x') as stream:json.dump({'status':'started','input_sha256':inputs},stream)
    report={'status':'failed','part':'cp1','input_sha256':inputs,'apk_sha256':digest(apk),'scope':'Actual Android CP1 four-edit command route; root image inspection pending'}
    try:
        report['install']=adb('install','-r',str(apk)).stdout; adb('shell','am','force-stop',APP); adb('shell','run-as',APP,'rm','-f','files/result.json','files/result.tmp'); report['launch']=adb('shell','am','start','-W','-n',APP+'/.MainActivity').stdout
        if 'Status: ok' not in report['launch']:raise RuntimeError('Native activity did not launch successfully')
        deadline=time.monotonic()+1800; native=None
        while time.monotonic()<deadline:
            result=adb('shell','run-as',APP,'cat','files/result.json',check=False)
            if result.returncode==0: native=json.loads(result.stdout); break
            if not adb('shell','pidof',APP,check=False).stdout.strip():raise RuntimeError('CP1 app exited before result')
            time.sleep(.5)
        if native is None:raise TimeoutError('CP1 result timed out')
        report['native']=native
        if native.get('passed') is not True or native.get('part')!='cp1' or native.get('api')!=33 or native.get('renderer')!='processing.a2d.PGraphicsAndroid2D':raise AssertionError('Android CP1 native report failed')
        native_cases=native.get('native',{}).get('cases')
        if native.get('native',{}).get('model_records')!=25600 or not isinstance(native_cases,list) or len(native_cases)!=4:raise AssertionError('Unexpected Android CP1 native case structure')
        cases=native_cases
        if len(cases)!=len(accepted):raise AssertionError('CP1 case count mismatch')
        for actual,expected in zip(cases,accepted):
            for key in ('id','model_sha256','geometry_sha256','color_sha256','commands','omitted_zero_length'):
                if actual.get(key)!=expected.get(key):raise AssertionError('CP1 mismatch '+actual.get('id','?')+' '+key)
        images={}
        for case in cases:
            case_id=case['id']
            if case.get('image_path')!=case_id+'.png':raise AssertionError('Unexpected CP1 image path: '+case_id)
            target=OUTPUT/(case_id+'.png'); binary_pull('files/cp1/'+case['image_path'],target); images[case_id]=image_record(target)
        base=images['base']['_image']; metrics={}
        for name in ('length','palette','bar'):
            diff=ImageChops.difference(base,images[name]['_image']).convert('RGB').tobytes(); changed=sum(any(diff[i:i+3]) for i in range(0,len(diff),3))
            if changed==0:raise AssertionError('CP1 edit did not change image: '+name)
            metrics[name]={'changed_pixels':changed}
        for value in images.values():value.pop('_image')
        report.update(images=images,edit_changed_pixels=metrics,fingerprint=adb('shell','getprop','ro.build.fingerprint').stdout.strip(),visual_inspection='pending root inspection')
        if inputs!=hashes():raise RuntimeError('Inputs changed during native execution')
        report['status']='passed'
    except Exception as error:
        report['failure']=str(error); report['runtime_errors']=adb('logcat','-d','-t','150','-s','AndroidRuntime',check=False).stdout; raise
    finally:
        atomic(EVIDENCE,report); atomic(attempt,{'status':report['status'],'input_sha256':inputs})
    adb('shell','am','force-stop',APP); print(EVIDENCE.relative_to(ROOT))
if __name__=='__main__':main()
