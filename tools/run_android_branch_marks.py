#!/usr/bin/env python3
"""Run the preregistered BranchMarks native probe on an existing API33 emulator."""
import argparse
import json
import subprocess
import time
from pathlib import Path
from PIL import Image
from build_android_branch_marks import ROOT, SDK, digest, staged_hashes

APP = "org.procedurals.branchmarksprobe"
ACTIVITY = "org.procedurals.examples.branchmarks.BranchMarksProbeActivity"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--stage", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
stage, output = args.stage.resolve(), args.output.resolve()
output.relative_to(ROOT / ".work")
metadata = json.loads((stage / "build-result.json").read_text())
apk = Path(metadata["apk"])
if metadata['application_id'] != APP or metadata['activity_class'] != ACTIVITY:
    raise RuntimeError("wrong probe build")

def verify():
    if digest(apk) != metadata["apk_sha256"] or staged_hashes(stage) != metadata["staged_project_sha256"]:
        raise RuntimeError("APK or staged inputs changed")
    for name, expected in metadata["source_hashes"].items():
        if digest(ROOT / name) != expected:
            raise RuntimeError("source changed: " + name)

verify()
output.mkdir(parents=True, exist_ok=False)
report = {"status": "failed", "scope": "API33 BranchMarks native callbacks, pause/resume and cached MediaStore save", "build": metadata,
          "runner_sha256": digest(Path(__file__)),
          "plan_sha256": digest(ROOT / "design/capabilities/branch-marks-android-acceptance.md")}
start = time.monotonic()

def adb(*arguments, cleanup=False, check=True):
    left = (240 if cleanup else 210) - (time.monotonic() - start)
    if left <= 0: raise TimeoutError("BranchMarks execution deadline")
    return subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5582", *arguments],
                          capture_output=True, check=check, timeout=min(left, 45))

try:
    report["api"] = adb("shell", "getprop", "ro.build.version.sdk").stdout.decode().strip()
    if report["api"] != "33": raise RuntimeError("expected API33")
    report["fingerprint"] = adb("shell", "getprop", "ro.build.fingerprint").stdout.decode().strip()
    adb("install", "-r", str(apk))
    adb("shell", "pm", "clear", APP)
    adb("shell", "am", "start", "-W", "-n", APP + "/" + ACTIVITY)
    def screenshot(name):
        destination=output/name
        destination.write_bytes(adb('exec-out','screencap','-p').stdout)
        return destination
    resumed = False
    display_reviewed = False
    while True:
        result = adb("exec-out", "run-as", APP, "cat", "files/branch-marks-probe/result.json", check=False)
        payload = result.stdout.strip()
        # adb exec-out can return host exit0 for a remote cat failure during startup.
        if payload.startswith(b"cat:") and b"No such file or directory" in payload:
            time.sleep(0.2)
            continue
        if result.returncode == 0:
            state = json.loads(payload)
            if state["status"] == "failed": raise RuntimeError(state.get("failure", "native probe failed"))
            if state["status"] == "awaiting-pause" and not resumed:
                time.sleep(1.0)
                before=screenshot('before-resume-screen.png')
                bounds=tuple(state['viewport_bounds'])
                adb("shell", "input", "keyevent", "KEYCODE_HOME")
                time.sleep(0.5)
                adb("shell", "am", "start", "-W", "--activity-reorder-to-front", "-n", APP + "/" + ACTIVITY)
                resumed = True
            if state["status"] == "resumed" and not display_reviewed:
                time.sleep(1.0)
                after=screenshot('after-resume-screen.png')
                with Image.open(before) as first,Image.open(after) as second:
                    equal=first.convert('RGBA').crop(bounds).tobytes()==second.convert('RGBA').crop(bounds).tobytes()
                report['display_restore']={'bounds':bounds,'equal':equal,'before_sha256':digest(before),'after_sha256':digest(after)}
                if not equal:raise AssertionError('displayed viewport differs after resume before any edit')
                adb('shell','run-as',APP,'touch','files/branch-marks-probe/display-reviewed')
                display_reviewed=True
            if state["status"] == "passed": break
        time.sleep(0.2)
    if not display_reviewed or not resumed or not state['paused'] or not state['resumed'] or state['composition_count'] != 18:
        raise RuntimeError("incomplete lifecycle/sequence")
    report['native'] = state
    report['images'] = {}
    for name in [row['id'] + '.png' for row in state['frames']] + ['saved.png']:
        data = adb('exec-out', 'run-as', APP, 'cat', 'files/branch-marks-probe/' + name).stdout
        (output / name).write_bytes(data)
        report['images'][name] = digest(output / name)
    for row in state['frames']:
        if report['images'][row['id'] + '.png'] != row['png_sha256']:
            raise RuntimeError('pulled image differs')
    if report['images']['saved.png'] != report['images']['reset-again.png']:
        raise RuntimeError('saved image differs')
    verify()
    report['status'] = 'passed'
except Exception as error:
    report['failure'] = str(error)
    failed = adb('exec-out', 'run-as', APP, 'cat', 'files/branch-marks-probe/result.json', cleanup=True, check=False)
    (output / 'native-last.json').write_bytes(failed.stdout)
finally:
    try:
        diagnostic = adb('exec-out', 'run-as', APP, 'cat', 'files/branch-marks-probe/resume-redraw-diagnostics.json', cleanup=True, check=False)
        (output / 'resume-redraw-diagnostics.json').write_bytes(diagnostic.stdout)
        if report['status'] != 'passed' and (output / 'native-last.json').exists():
            partial = json.loads((output / 'native-last.json').read_text())
            for row in partial.get('frames', []):
                name = row['id'] + '.png'
                if '/' in name or '..' in name: raise ValueError('invalid image name')
                data = adb('exec-out', 'run-as', APP, 'cat', 'files/branch-marks-probe/' + name, cleanup=True).stdout
                (output / name).write_bytes(data)
    except Exception as error:
        report['diagnostic_collection_failure'] = str(error)
    try:
        adb('shell', 'am', 'force-stop', APP, cleanup=True)
        report['cleanup'] = 'force-stopped test app; APK and MediaStore saved image retained'
    except Exception as error:
        report.update(status='failed', cleanup_failure=str(error))
    report['elapsed_seconds'] = time.monotonic() - start
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'output': str(output), 'failure': report.get('failure')}))
raise SystemExit(0 if report['status'] == 'passed' else 1)
