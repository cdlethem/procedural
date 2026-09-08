#!/usr/bin/env python3
"""Run the preregistered GrainMarks native probe on an existing API33 emulator."""
import argparse
import json
import subprocess
import time
from pathlib import Path
from build_android_grain_marks import ROOT, SDK, digest, staged_hashes

APP = "org.procedurals.grainmarksprobe"
ACTIVITY = "org.procedurals.examples.grainmarks.GrainMarksProbeActivity"
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
report = {"status": "failed", "scope": "API33 GrainMarks native callbacks, pause/resume and cached MediaStore save", "build": metadata,
          "runner_sha256": digest(Path(__file__)),
          "plan_sha256": digest(ROOT / "design/capabilities/grain-marks-android-acceptance.md")}
start = time.monotonic()

def adb(*arguments, cleanup=False, check=True):
    left = (240 if cleanup else 210) - (time.monotonic() - start)
    if left <= 0: raise TimeoutError("GrainMarks execution deadline")
    return subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5582", *arguments],
                          capture_output=True, check=check, timeout=min(left, 45))

try:
    report["api"] = adb("shell", "getprop", "ro.build.version.sdk").stdout.decode().strip()
    if report["api"] != "33": raise RuntimeError("expected API33")
    report["fingerprint"] = adb("shell", "getprop", "ro.build.fingerprint").stdout.decode().strip()
    adb("install", "-r", str(apk))
    adb("shell", "pm", "clear", APP)
    adb("shell", "am", "start", "-W", "-n", APP + "/" + ACTIVITY)
    resumed = False
    while True:
        result = adb("exec-out", "run-as", APP, "cat", "files/grain-marks-probe/result.json", check=False)
        payload = result.stdout.strip()
        # adb exec-out can return host exit0 for a remote cat failure during startup.
        if payload.startswith(b"cat:") and b"No such file or directory" in payload:
            time.sleep(0.2)
            continue
        if result.returncode == 0:
            state = json.loads(payload)
            if state["status"] == "failed": raise RuntimeError(state.get("failure", "native probe failed"))
            if state["status"] == "awaiting-pause" and not resumed:
                adb("shell", "input", "keyevent", "KEYCODE_HOME")
                time.sleep(0.5)
                adb("shell", "am", "start", "-W", "--activity-reorder-to-front", "-n", APP + "/" + ACTIVITY)
                resumed = True
            if state["status"] == "passed": break
        time.sleep(0.2)
    if not resumed or not state['paused'] or not state['resumed'] or state['composition_count'] != 10:
        raise RuntimeError("incomplete lifecycle/sequence")
    report['native'] = state
    report['images'] = {}
    for name in [row['id'] + '.png' for row in state['frames']] + ['saved.png']:
        data = adb('exec-out', 'run-as', APP, 'cat', 'files/grain-marks-probe/' + name).stdout
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
    failed = adb('exec-out', 'run-as', APP, 'cat', 'files/grain-marks-probe/result.json', cleanup=True, check=False)
    (output / 'native-last.json').write_bytes(failed.stdout)
finally:
    try:
        adb('shell', 'am', 'force-stop', APP, cleanup=True)
        report['cleanup'] = 'force-stopped test app; APK and MediaStore saved image retained'
    except Exception as error:
        report.update(status='failed', cleanup_failure=str(error))
    report['elapsed_seconds'] = time.monotonic() - start
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'output': str(output), 'failure': report.get('failure')}))
raise SystemExit(0 if report['status'] == 'passed' else 1)
