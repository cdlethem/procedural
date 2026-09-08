#!/usr/bin/env python3
"""Observe resume controls in the exact existing distributed example APKs."""
import argparse
import hashlib
import json
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SDK = ROOT / '.work/toolchains/android/sdk'
CASES = [
 ('fieldmarks', 4, 'FieldMarksActivity', '.work/dist/android/build/zip-consumer/procedurals-field-marks-android/app/build/outputs/apk/debug/app-debug.apk', 'evidence/distribution/android.json', 'sample_consumption', 'unpacked_zip_external_processing_core_apk_sha256'),
 ('pathmarks', 6, 'PathMarksActivity', '.work/dist/cp2/android/build/consumer/procedurals-path-marks-android/app/build/outputs/apk/debug/app-debug.apk', 'evidence/distribution/cp2-android.json', 'consumer', 'compiled_apk_sha256'),
 ('placementmarks', 9, 'PlacementMarksActivity', '.work/dist/cp3/android-placement3/build/consumer/procedurals-placement-marks-android/app/build/outputs/apk/debug/app-debug.apk', 'evidence/distribution/cp3-android.json', 'consumer', 'compiled_apk_sha256'),
]
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(); output = args.output.resolve(); output.relative_to(ROOT / '.work')
for name, count, activity, apk, report, group, key in CASES:
    if sha(ROOT / apk) != json.loads((ROOT / report).read_text())[group][key]:
        raise RuntimeError('distributed APK binding differs: ' + name)
output.mkdir(parents=True, exist_ok=False)
started = time.monotonic()
result = {'status': 'failed', 'scope': 'Exact local-distribution APK baseline/HOME/resume UI audit; not acceptance',
          'runner_sha256': sha(__file__), 'cases': []}

def adb(*args, check=True):
    left = 360 - (time.monotonic() - started)
    if left <= 0: raise TimeoutError('resume audit deadline')
    return subprocess.run([str(SDK / 'platform-tools/adb'), '-P', '5038', '-s', 'emulator-5582', *args],
                          capture_output=True, check=check, timeout=min(left, 30))

def ui(package, destination):
    adb('shell', 'uiautomator', 'dump', '/sdcard/procedurals-resume-audit.xml')
    raw = adb('exec-out', 'cat', '/sdcard/procedurals-resume-audit.xml').stdout
    destination.write_bytes(raw)
    nodes = ET.fromstring(raw).iter('node')
    return [{'text': n.get('text'), 'enabled': n.get('enabled') == 'true'} for n in nodes
            if n.get('package') == package and n.get('class') == 'android.widget.Button']

try:
    result['api'] = adb('shell', 'getprop', 'ro.build.version.sdk').stdout.decode().strip()
    if result['api'] != '33': raise RuntimeError('API33 required')
    for name, count, activity, apk, evidence, group, key in CASES:
        package = 'org.procedurals.' + name
        component = package + '/org.procedurals.examples.' + name + '.' + activity
        directory = output / name; directory.mkdir()
        row = {'name': name, 'apk_sha256': sha(ROOT / apk), 'distribution_evidence': evidence,
               'distribution_evidence_sha256': sha(ROOT / evidence)}
        result['cases'].append(row)
        try:
            install = adb('install', '-r', str(ROOT / apk), check=False)
            if install.returncode:
                if b'INSTALL_FAILED_UPDATE_INCOMPATIBLE' not in install.stdout + install.stderr:
                    raise RuntimeError((install.stdout + install.stderr).decode())
                adb('uninstall', package)
                adb('install', str(ROOT / apk))
                row['replaced_incompatible_demo_install'] = True
            adb('shell', 'am', 'force-stop', package)
            adb('shell', 'am', 'start', '-W', '-n', component)
            deadline = time.monotonic() + 45
            while True:
                before = ui(package, directory / 'before.xml')
                if len(before) == count and all(b['enabled'] for b in before): break
                if time.monotonic() >= deadline: raise RuntimeError('baseline controls not ready: ' + name)
            row['before'] = before
            (directory / 'before.png').write_bytes(adb('exec-out', 'screencap', '-p').stdout)
            adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
            if ui(package, directory / 'home.xml'): raise RuntimeError('HOME did not hide starter')
            adb('shell', 'am', 'start', '-W', '--activity-reorder-to-front', '-n', component)
            deadline = time.monotonic() + 10
            while True:
                after = ui(package, directory / 'after.xml')
                if len(after) == count and all(b['enabled'] for b in after): break
                if time.monotonic() >= deadline: break
            if len(after) != count: raise RuntimeError('resumed starter UI unavailable')
            row['after'] = after
            row['finding'] = 'controls-recovered' if all(b['enabled'] for b in after) else 'disabled-controls-reproduced'
            (directory / 'after.png').write_bytes(adb('exec-out', 'screencap', '-p').stdout)
            row['artifact_sha256'] = {p.name: sha(p) for p in directory.iterdir() if p.is_file()}
        finally:
            adb('shell', 'am', 'force-stop', package, check=False)
    result['status'] = 'completed-audit'
except Exception as error:
    result['failure'] = str(error)
finally:
    result['elapsed_seconds'] = time.monotonic() - started
    (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'findings': [(r['name'],r.get('finding')) for r in result['cases']], 'failure': result.get('failure')}))
raise SystemExit(0 if result['status'] == 'completed-audit' else 1)
