#!/usr/bin/env python3
"""Run the installed bootstrap on the isolated emulator and retain native evidence."""
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT=Path(__file__).resolve().parents[1]
ADB=ROOT/'.work/toolchains/android/sdk/platform-tools/adb'


def adb(*args):
    return subprocess.check_output([str(ADB),'-P','5038','-s','emulator-5580',*args],text=True,timeout=30).strip()


def main():
    if adb('shell','getprop','sys.boot_completed')!='1':
        raise RuntimeError('The existing isolated emulator is not fully booted; keep waiting on its live handle')
    build=ROOT/'evidence/conformance/android-bootstrap-build.json'
    apk=ROOT/'.work/environments/android/bootstrap/app/build/outputs/apk/debug/app-debug.apk'
    record=json.loads(build.read_text())
    if record['status']!='passed' or record['apk_sha256']!=hashlib.sha256(apk.read_bytes()).hexdigest():
        raise RuntimeError('Bootstrap APK does not match successful build')
    for path,expected in record['input_sha256'].items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=expected:raise RuntimeError('Stale build: '+path)
    attempt=ROOT/'.work/environments/android/bootstrap-run-attempt.json'
    with attempt.open('x') as stream:json.dump({'status':'started','apk_sha256':record['apk_sha256']},stream)
    report={'status':'failed','scope':'Actual Android Processing setup only; no adapter support claim',
            'apk_sha256':record['apk_sha256'],'build_report_sha256':hashlib.sha256(build.read_bytes()).hexdigest(),
            'environment_report_sha256':hashlib.sha256((ROOT/'evidence/conformance/android-environment.json').read_bytes()).hexdigest()}
    try:
        report['install']=adb('install','-r',str(apk))
        report['launch']=adb('shell','am','start','-W','-n','org.procedurals.bootstrap/.MainActivity')
        deadline=time.monotonic()+180
        while time.monotonic()<deadline:
            try:
                native=json.loads(adb('shell','run-as','org.procedurals.bootstrap','cat','files/bootstrap.json'))
                break
            except (subprocess.CalledProcessError,json.JSONDecodeError):time.sleep(2)
        else:raise TimeoutError('No bootstrap result from the launched app')
        if native.get('passed') is not True:raise RuntimeError('Native bootstrap assertions failed')
        report.update(status='passed',native=native,fingerprint=adb('shell','getprop','ro.build.fingerprint'))
    finally:
        (ROOT/'evidence/conformance/android-bootstrap-runtime.json').write_text(json.dumps(report,indent=2)+'\n')
        attempt.write_text(json.dumps({'status':report['status'],'apk_sha256':record['apk_sha256']})+'\n')


if __name__=='__main__':main()
