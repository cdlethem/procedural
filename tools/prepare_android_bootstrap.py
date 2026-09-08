#!/usr/bin/env python3
"""Stage and build the pinned actual Android bootstrap; no emulator launch."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def main():
    sources=ROOT/'tests/native/android-bootstrap'
    destination=ROOT/'.work/environments/android/bootstrap'
    sdk=ROOT/'.work/toolchains/android/sdk'
    core=ROOT/'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip'
    inputs={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(sources.rglob('*')) if p.is_file()}
    inputs[str(core.relative_to(ROOT))]=hashlib.sha256(core.read_bytes()).hexdigest()
    shutil.copytree(sources,destination,dirs_exist_ok=True)
    (destination/'app/libs').mkdir(exist_ok=True)
    shutil.copyfile(core,destination/'app/libs/processing-core.jar')
    (destination/'local.properties').write_text('sdk.dir='+str(sdk)+'\n')
    env=dict(os.environ,JAVA_HOME=str(ROOT/'.work/toolchains/jdk-17.0.20.1+1'),
             ANDROID_USER_HOME=str(ROOT/'.work/environments/android/user'),
             GRADLE_USER_HOME=str(ROOT/'.work/environments/android/gradle'))
    keystore=destination/'debug.keystore'
    if not keystore.exists():
        subprocess.run([str(Path(env['JAVA_HOME'])/'bin/keytool'),'-genkeypair','-keystore',str(keystore),
            '-storepass','android','-keypass','android','-alias','androiddebugkey',
            '-keyalg','RSA','-keysize','2048','-validity','10000',
            '-dname','CN=Android Debug,O=Android,C=US'],check=True,env=env)
    report={'status':'failed','scope':'Android bootstrap build only','input_sha256':inputs}
    try:
        subprocess.run([str(ROOT/'.work/toolchains/android/gradle-7.4.2/bin/gradle'),
            '--no-daemon','--console=plain',':app:assembleDebug'],cwd=destination,env=env,check=True)
        apk=destination/'app/build/outputs/apk/debug/app-debug.apk'
        report.update(status='passed',apk_sha256=hashlib.sha256(apk.read_bytes()).hexdigest())
    finally:
        (ROOT/'evidence/conformance/android-bootstrap-build.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':main()
