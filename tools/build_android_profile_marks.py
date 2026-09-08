#!/usr/bin/env python3
"""Stage or compile workflow-local Android ProfileMarks; never install or launch it."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.work'
BOOT = ROOT / 'tests/native/android-bootstrap'
EXAMPLE = ROOT / 'packages/java-android/examples/ProfileMarks'
CORE = WORK / 'toolchains/android/mode-412/AndroidMode/processing-core.zip'
SDK = WORK / 'toolchains/android/sdk'
GRADLE = WORK / 'toolchains/android/gradle-7.4.2/bin/gradle'
KEY = WORK / 'environments/android/bootstrap/debug.keystore'
JDK = WORK / 'toolchains/jdk-17.0.20.1+1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bindings(paths):
    return {str(path.relative_to(ROOT)): sha(path) for path in paths}


def write_result(stage, result):
    (stage / 'build-result.json').write_text(json.dumps(result, indent=2) + '\n')


def staged_hashes(stage):
    paths = [*sorted((stage/'app/src/main/java').rglob('*.java')),
             stage/'app/build.gradle', stage/'app/src/main/AndroidManifest.xml',
             stage/'app/libs/processing-core.jar', stage/'build.gradle',
             stage/'settings.gradle', stage/'gradle.properties', stage/'debug.keystore',
             stage/'local.properties']
    return {str(path.relative_to(stage)): sha(path) for path in paths}


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('staging template changed: ' + before)
    return text.replace(before, after)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', type=Path, default=WORK / 'examples/android-profile-marks')
    parser.add_argument('--build', action='store_true')
    parser.add_argument('--application-id', default='org.procedurals.profilemarks')
    parser.add_argument('--activity-class', default='org.procedurals.examples.profilemarks.ProfileMarksActivity')
    parser.add_argument('--extra-source', type=Path, action='append', default=[])
    args = parser.parse_args()
    for name in (args.application_id, args.activity_class):
        if not re.fullmatch(r'[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+', name):
            raise ValueError('invalid Java application/activity identifier')
    for path in args.extra_source:
        if not path.resolve().is_relative_to(ROOT):
            raise ValueError('probe source must stay inside repository')
    stage = args.stage.resolve()
    if not stage.is_relative_to(WORK.resolve()) or stage == WORK.resolve() or stage.exists():
        raise SystemExit('--stage must be fresh under ROOT/.work')
    stage.mkdir(parents=True)

    sources = [
        *sorted((ROOT / 'packages/java/src/main/java').rglob('*.java')),
        *sorted((ROOT / 'packages/java-android/src/main/java').rglob('*.java')),
        EXAMPLE / 'ProfileMarksActivity.java',
        ROOT / 'packages/java/examples/ProfileMarks/ProfileComposition.java',
        ROOT / 'packages/java-android/examples/FieldMarks/GalleryWriter.java',
        *(path.resolve() for path in args.extra_source),
    ]
    input_paths = [*sorted(path for path in BOOT.rglob('*') if path.is_file()),
                   EXAMPLE / 'AndroidManifest.xml', *sources, CORE, GRADLE, KEY,
                   Path(__file__).resolve(), SDK/'platforms/android-33/android.jar',
                   SDK/'build-tools/30.0.3/d8', JDK/'release', JDK/'lib/modules']
    before = bindings(input_paths)
    result = {'stage': str(stage.relative_to(ROOT)), 'scope': 'compile only; no install/emulator/render',
              'inputs_before': before, 'terminal_status': 'staged',
              'application_id': args.application_id, 'activity_class': args.activity_class}
    try:
        for path in BOOT.rglob('*'):
            if path.is_file():
                target = stage / path.relative_to(BOOT)
                target.parent.mkdir(parents=True, exist_ok=True)
                text = path.read_text()
                if path.name == 'build.gradle' and path.parent.name == 'app':
                    text = replace_once(text, "applicationId 'org.procedurals.bootstrap'", "applicationId '" + args.application_id + "'")
                    text = replace_once(text, 'minSdkVersion 23', 'minSdkVersion 29')
                target.write_text(text)
        manifest_target = stage / 'app/src/main/AndroidManifest.xml'
        manifest_target.parent.mkdir(parents=True, exist_ok=True)
        manifest = (EXAMPLE / 'AndroidManifest.xml').read_text()
        manifest = replace_once(manifest, 'package="org.procedurals.profilemarks"', 'package="'+args.application_id+'"')
        manifest = replace_once(manifest, 'android:name="org.procedurals.examples.profilemarks.ProfileMarksActivity"', 'android:name="'+args.activity_class+'"')
        manifest_target.write_text(manifest)
        destination = stage / 'app/src/main/java'
        destination.mkdir(parents=True, exist_ok=True)
        names = set()
        for source in sources:
            if source.name in names:
                raise RuntimeError('duplicate staged Java basename: ' + source.name)
            names.add(source.name)
            shutil.copyfile(source, destination / source.name)
        (stage / 'app/libs').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CORE, stage / 'app/libs/processing-core.jar')
        shutil.copyfile(KEY, stage / 'debug.keystore')
        (stage / 'local.properties').write_text('sdk.dir=' + str(SDK) + '\n')
        after = bindings(input_paths)
        result['inputs_after'] = after
        if before != after:
            raise RuntimeError('bound source or runtime input changed while staging')
        staged_before = staged_hashes(stage)
        result['staged_project_sha256'] = staged_before
        if args.build:
            env = dict(os.environ,
                JAVA_HOME=str(WORK / 'toolchains/jdk-17.0.20.1+1'),
                ANDROID_USER_HOME=str(WORK / 'environments/android/user'),
                GRADLE_USER_HOME=str(WORK / 'environments/android/gradle'))
            with (stage/'build.log').open('w') as log:
                subprocess.run([str(GRADLE), '--no-daemon', '--console=plain', ':app:assembleDebug'],
                               cwd=stage, env=env, check=True, timeout=600,
                               stdout=log, stderr=subprocess.STDOUT)
            apk = stage / 'app/build/outputs/apk/debug/app-debug.apk'
            result['apk'] = str(apk.relative_to(ROOT))
            result['apk_sha256'] = sha(apk)
            result['terminal_status'] = 'success'
        result['inputs_after'] = bindings(input_paths)
        if result['inputs_after'] != before or staged_hashes(stage) != staged_before:
            raise RuntimeError('source/runtime/staged input changed during compilation')
        write_result(stage, result)
    except BaseException as error:
        result['inputs_after'] = bindings(input_paths)
        result['terminal_status'] = 'failure'
        result['error'] = '{}: {}'.format(type(error).__name__, error)
        write_result(stage, result)
        raise
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
