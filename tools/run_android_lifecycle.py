#!/usr/bin/env python3
"""Build the registered actual Activity lifecycle probe; execute only with --render."""
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import time

from run_android_adapter import ROOT, SDK, adb, digest

APP = 'org.procedurals.lifecycleprobe'
STAGE = ROOT / '.work/environments/android/adapter-lifecycle-v2'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--corrective', action='store_true')
    args = parser.parse_args()
    template = ROOT / 'tests/native/android-bootstrap'
    app_sources = ROOT / 'tests/native/android-lifecycle'
    core = ROOT / '.work/toolchains/android/mode-412/AndroidMode/processing-core.zip'
    sources = [*sorted((ROOT / 'packages/java/src/main/java').rglob('*.java')),
               *sorted((ROOT / 'packages/java-android/src/main/java').rglob('*.java')),
               ROOT / 'tests/native/AndroidActivityLifecycle.java',
               *sorted(app_sources.rglob('*.java'))]
    templates = [p for p in sorted(template.rglob('*'))
                 if p.is_file() and p.suffix != '.java' and p.name != 'AndroidManifest.xml']
    manifest = app_sources / 'app/src/main/AndroidManifest.xml'
    bindings = [*sources, *templates, manifest, core, Path(__file__).resolve(),
                ROOT / 'tools/run_android_adapter.py',
                ROOT / 'catalog/drawing/fresh-raster-2d.json',
                ROOT / 'design/android-adapter-validation.md',
                ROOT / 'design/android-activity-lifecycle-validation.md',
                ROOT / 'design/android-lifecycle-preflight-decision.md',
                ROOT / 'design/android-activity-lifecycle-v2.md',
                ROOT / 'design/android-redraw-integration-finding.md',
                ROOT / 'evidence/conformance/android-adapter-lifecycle-initial.json',
                ROOT / 'evidence/conformance/android-adapter-lifecycle-corrective.json',
                ROOT / 'evidence/conformance/android-environment.json',
                SDK / 'platforms/android-33/android.jar']
    if args.corrective:
        initial = ROOT / 'evidence/conformance/android-adapter-lifecycle-v2-initial.json'
        if json.loads(initial.read_text()).get('status') != 'failed':
            raise RuntimeError('Corrective execution requires preserved failed initial evidence')
        bindings += [initial, ROOT / 'design/android-lifecycle-v2-correction.md']
    def input_hashes():
        return {str(p.relative_to(ROOT)): digest(p) for p in bindings}
    inputs = input_hashes()
    STAGE.mkdir(parents=True, exist_ok=True)
    for source in templates:
        target = STAGE / source.relative_to(template)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source.read_text().replace('org.procedurals.bootstrap', APP))
    (STAGE / 'app/src/main').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(manifest, STAGE / 'app/src/main/AndroidManifest.xml')
    java = STAGE / 'app/src/main/java'
    java.mkdir(parents=True, exist_ok=True)
    for old in java.rglob('*.java'):
        old.unlink()
    for source in sources:
        target = java / source.name
        if target.exists():
            raise RuntimeError('Duplicate staged source name: ' + source.name)
        shutil.copyfile(source, target)
    (STAGE / 'app/libs').mkdir(exist_ok=True)
    shutil.copyfile(core, STAGE / 'app/libs/processing-core.jar')
    shutil.copyfile(ROOT / '.work/environments/android/bootstrap/debug.keystore', STAGE / 'debug.keystore')
    (STAGE / 'local.properties').write_text('sdk.dir=' + str(SDK) + '\n')
    env = dict(os.environ, JAVA_HOME=str(ROOT / '.work/toolchains/jdk-17.0.20.1+1'),
               ANDROID_USER_HOME=str(ROOT / '.work/environments/android/user'),
               GRADLE_USER_HOME=str(ROOT / '.work/environments/android/gradle'))
    with (STAGE / 'build.log').open('w') as log:
        subprocess.run([str(ROOT / '.work/toolchains/android/gradle-7.4.2/bin/gradle'),
                        '--no-daemon', '--console=plain', ':app:assembleDebug'],
                       cwd=STAGE, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    if inputs != input_hashes():
        raise RuntimeError('Inputs changed during build')
    apk = STAGE / 'app/build/outputs/apk/debug/app-debug.apk'
    if not args.render:
        print('Android lifecycle APK built; no native execution')
        return
    if adb('shell', 'getprop', 'sys.boot_completed').stdout.strip() != '1':
        raise RuntimeError('Existing emulator is not booted')
    attempt = STAGE / ('native-attempt-corrective.json' if args.corrective else 'native-attempt.json')
    with attempt.open('x') as stream:
        json.dump({'status': 'started', 'input_sha256': inputs}, stream)
    report = {'status': 'failed', 'part': 'lifecycle-v2', 'input_sha256': inputs,
              'apk_sha256': digest(apk), 'markers': [], 'transitions': [],
              'attempt': 'corrective' if args.corrective else 'initial',
              'scope': 'Actual Activity lifecycle on pinned Android runtime; test-only bounded consume race'}
    nonce = None
    last_sequence = -1
    deadline = time.monotonic() + 1800

    def read(name):
        result = adb('shell', 'run-as', APP, 'cat', 'files/' + name + '.json', check=False)
        return json.loads(result.stdout) if result.returncode == 0 else None

    def wait_marker(name):
        nonlocal nonce, last_sequence
        while time.monotonic() < deadline:
            value = read(name)
            if value is not None:
                if value.get('phase') != name:
                    raise AssertionError('Wrong phase in marker file: ' + name)
                if value.get('passed') is False:
                    raise AssertionError('Failed phase ' + name + ': ' + json.dumps(value))
                if nonce is None:
                    nonce = value['nonce']
                if value['nonce'] != nonce:
                    raise AssertionError('Activity recreated: nonce changed')
                sequence = value['sequence']
                if sequence <= last_sequence:
                    raise AssertionError('Phase sequence did not advance: ' + name)
                last_sequence = sequence
                report['markers'].append({'phase': name, 'value': value})
                return value
            final = read('result')
            if final is not None and final.get('passed') is not True:
                report['native'] = final
                raise AssertionError('Lifecycle assertion failed before ' + name)
            if not adb('shell', 'pidof', APP, check=False).stdout.strip():
                raise RuntimeError('Probe exited before ' + name)
            time.sleep(0.25)
        raise TimeoutError('No phase ' + name + '; inspect existing app before retrying')

    def cover():
        result = adb('shell', 'am', 'start', '-W', '-n', APP + '/.CoverActivity')
        report['transitions'].append({'cover': result.stdout})
        if 'Status: ok' not in result.stdout:
            raise RuntimeError('CoverActivity failed to start')

    def require_front(component):
        observed = {}
        while time.monotonic() < deadline:
            activities = adb('shell', 'dumpsys', 'activity', 'activities').stdout
            resumed = [line.strip() for line in activities.splitlines()
                       if 'topResumedActivity=' in line or 'mResumedActivity:' in line]
            windows = adb('shell', 'dumpsys', 'window').stdout
            focused = [line.strip() for line in windows.splitlines() if 'mCurrentFocus=' in line]
            observed = {'verified_top': resumed, 'verified_window_focus': focused}
            component_pattern = re.escape(APP) + r'/(?:\.|' + re.escape(APP) + r'\.)' + re.escape(component) + r'(?=[\s}])'
            if any(re.search(component_pattern, line) for line in resumed) and any(
                    re.search(component_pattern, line) for line in focused):
                report['transitions'].append(observed)
                return
            time.sleep(0.25)
        report['transitions'].append(observed)
        raise TimeoutError('Expected resumed and focused ' + component + '; no input sent')

    def resume_and_input(number):
        require_front('CoverActivity')
        adb('shell', 'input', 'keyevent', '4')
        wait_marker('resume-' + str(number))
        wait_marker('restore-idle-' + str(number))
        wait_marker('idle-polls-' + str(number))
        require_front('MainActivity')
        # Ordinary touch delivered to PApplet: handler changes model and requests redraw.
        size = adb('shell', 'wm', 'size').stdout
        dimensions = re.findall(r'(\d+)x(\d+)', size)
        if not dimensions:
            raise RuntimeError('Cannot determine display center: ' + size)
        width, height = map(int, dimensions[-1])
        adb('shell', 'input', 'tap', str(width // 2), str(height // 2))

    destination = ROOT / 'evidence/conformance/android-adapter-lifecycle-v2.json'
    try:
        report['install'] = adb('install', '-r', str(apk)).stdout
        adb('shell', 'am', 'force-stop', APP)
        # Dedicated test app owns this entire private directory.
        adb('shell', 'run-as', APP, 'rm', '-rf', 'files')
        adb('shell', 'run-as', APP, 'mkdir', '-p', 'files')
        report['launch'] = adb('shell', 'am', 'start', '-W', '-n', APP + '/.MainActivity').stdout
        if 'Status: ok' not in report['launch']:
            raise RuntimeError('MainActivity failed to start')
        wait_marker('active-ready')
        cover()
        wait_marker('pause-1')
        resume_and_input(1)
        wait_marker('completed-ready')
        cover()
        wait_marker('pause-2')
        resume_and_input(2)
        wait_marker('consumer-entered')
        cover()
        wait_marker('pause-3')
        resume_and_input(3)
        wait_marker('destroy-ready')
        report['transitions'].append({'finish': adb('shell', 'am', 'broadcast', '-a',
            APP + '.FINISH', '-n', APP + '/.FinishReceiver').stdout})
        wait_marker('pause-4')
        wait_marker('onDestroy')
        native = wait_marker('result')
        report['native'] = native
        if native.get('passed') is not True:
            raise AssertionError('Final lifecycle assertions did not pass')
        if native.get('api') != 33 or native.get('renderer') != 'processing.a2d.PGraphicsAndroid2D':
            raise AssertionError('Unexpected native runtime')
        report['fingerprint'] = adb('shell', 'getprop', 'ro.build.fingerprint').stdout.strip()
        if inputs != input_hashes():
            raise RuntimeError('Inputs changed during native execution')
        report['status'] = 'passed'
    except Exception as error:
        report['failure'] = str(error)
        report['runtime_errors'] = adb('logcat', '-d', '-t', '150', '-s', 'AndroidRuntime', check=False).stdout
        raise
    finally:
        destination.write_text(json.dumps(report, indent=2) + '\n')
        attempt.write_text(json.dumps({'status': report['status'], 'input_sha256': inputs}) + '\n')
    adb('shell', 'am', 'force-stop', APP)
    print(destination.relative_to(ROOT))


if __name__ == '__main__':
    main()
