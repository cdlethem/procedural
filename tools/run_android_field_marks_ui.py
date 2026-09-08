#!/usr/bin/env python3
"""Build the native editable Field Marks UI probe; execute only with --render."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

from PIL import Image
from prepare_android_field_marks import ROOT, SDK, build, prepare, sha256
from run_android_adapter import adb, digest

APP = "org.procedurals.fieldmarksprobe"
ACTIVITY = "org.procedurals.examples.fieldmarks.FieldMarksProbeActivity"
STAGE = ROOT / ".work/environments/android/field-marks-ui"
OUTPUT = ROOT / ".work/reproductions/android-field-marks-ui"
EVIDENCE = ROOT / "evidence/reproductions/android-field-marks-ui/result.json"
PROBE = ROOT / "tests/native/android-field-marks/FieldMarksProbeActivity.java"
CP1 = ROOT / "evidence/reproductions/cp1-android/result.json"
DESIGN = ROOT / "design/android-editable-example.md"


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def source_hashes(prepared):
    values = dict(prepared["source_hashes"])
    for path in (Path(__file__).resolve(), PROBE, CP1, DESIGN,
                 ROOT / "design/android-adapter-validation.md",
                 ROOT / "design/android-cp1-decision.md",
                 ROOT / "evidence/conformance/android-environment.json",
                 ROOT / "catalog/drawing/fresh-raster-2d.json",
                 ROOT / "evidence/reproductions/cp1-java2d/plan.json",
                 ROOT / "tools/run_android_adapter.py"):
        values[str(path.relative_to(ROOT))] = digest(path)
    return values


def verify_sources(values):
    for name, expected in values.items():
        if sha256(ROOT / name) != expected:
            raise RuntimeError("Source input changed: " + name)


def pull_binary(remote, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580",
                        "exec-out", "run-as", APP, "cat", remote], stdout=stream,
                       stderr=subprocess.PIPE, timeout=120, check=True)


def read_private_json(name):
    result = adb("shell", "run-as", APP, "cat", "files/field-marks-probe/" + name, check=False)
    return json.loads(result.stdout) if result.returncode == 0 else None


def image_record(path):
    with Image.open(path) as source:
        image = source.convert("RGBA")
        rgba = image.tobytes()
    if image.size != (640, 640) or any(value != 255 for value in rgba[3::4]):
        raise AssertionError("Cached Field Marks frame is not opaque 640x640: " + path.name)
    background = bytes((236, 231, 218))
    nonbackground = sum(rgba[index:index + 3] != background for index in range(0, len(rgba), 4))
    if nonbackground == 0:
        raise AssertionError("Cached Field Marks frame is empty: " + path.name)
    return {"path": str(path.relative_to(ROOT)), "png_sha256": digest(path),
            "rgba_sha256": hashlib.sha256(rgba).hexdigest(),
            "nonbackground_pixels": nonbackground, "_image": image, "_rgba": rgba}


def expected_cp1():
    result = json.loads(CP1.read_text())
    if result.get("status") != "passed" or result.get("part") != "cp1":
        raise RuntimeError("Accepted Android CP1 evidence is not passed")
    images = result.get("images")
    if not isinstance(images, dict) or set(images) != {"base", "length", "palette", "bar"}:
        raise RuntimeError("Accepted Android CP1 image evidence is incomplete")
    decoded = {}
    for name, value in images.items():
        path = ROOT / value["path"]
        if not path.is_file():
            raise RuntimeError("Accepted Android CP1 PNG is missing: " + str(path))
        record = image_record(path)
        if record["rgba_sha256"] != value.get("rgba_sha256"):
            raise RuntimeError("Accepted Android CP1 PNG differs from its evidence hash: " + name)
        decoded[name] = record
    return decoded


def require_front(report, deadline):
    observed = {}
    while time.monotonic() < deadline:
        activities = adb("shell", "dumpsys", "activity", "activities").stdout
        windows = adb("shell", "dumpsys", "window").stdout
        resumed = [line.strip() for line in activities.splitlines()
                   if "topResumedActivity=" in line or "mResumedActivity:" in line]
        focused = [line.strip() for line in windows.splitlines() if "mCurrentFocus=" in line]
        observed = {"resumed": resumed, "focused": focused}
        if (any(APP in line and "FieldMarksProbeActivity" in line for line in resumed) and
                any(APP in line and "FieldMarksProbeActivity" in line for line in focused)):
            report["focus_checks"].append(observed)
            return
        time.sleep(.25)
    report["focus_checks"].append(observed)
    raise TimeoutError("Probe Activity is not resumed and focused; no click sent")


def button_center(marker, name):
    rows = marker.get("button_center_bounds")
    if not isinstance(rows, list):
        raise AssertionError("Frame marker has no observed button bounds")
    found = [row for row in rows if row.get("id") == name]
    if len(found) != 1:
        raise AssertionError("Frame marker has no unique " + name + " button")
    row = found[0]
    x, y = row.get("center_x"), row.get("center_y")
    if not isinstance(x, int) or not isinstance(y, int) or x < row.get("left", x) or y < row.get("top", y):
        raise AssertionError("Invalid observed " + name + " button center")
    if x >= row["left"] + row["width"] or y >= row["top"] + row["height"]:
        raise AssertionError("Observed " + name + " center lies outside its button")
    return x, y


def check_frames(frames, cp1_images, report):
    accepted = {case["id"]: case for case in json.loads(CP1.read_text())["native"]["native"]["cases"]}
    expected_states = (
        (False, False, False), (True, False, False), (False, False, False),
        (False, True, False), (False, False, False), (False, False, True),
        (True, False, True), (True, True, True),
    )
    if len(frames) != 8:
        raise AssertionError("Expected eight frame observations")
    model = None
    for index, (frame, state) in enumerate(zip(frames, expected_states), 1):
        if frame.get("composition_count") != index or frame.get("completed_frame_count") != index + 1:
            raise AssertionError("Unexpected composition/frame count at frame " + str(index))
        if frame.get("state_version") != index - 1:
            raise AssertionError("Unexpected retained state version at frame " + str(index))
        if (frame.get("longer"), frame.get("neon"), frame.get("bars")) != state:
            raise AssertionError("Unexpected retained edit state at frame " + str(index))
        if frame.get("commands") != 25600:
            raise AssertionError("Unexpected command count at frame " + str(index))
        if frame.get("max_length") != (32 if state[0] else 16):
            raise AssertionError("Unexpected length at frame " + str(index))
        if report["images"]["frame-" + str(index)]["png_sha256"] != frame.get("png_sha256"):
            raise AssertionError("Pulled PNG differs from acknowledged snapshot")
        if model is None:
            model = frame.get("model_sha256")
        elif frame.get("model_sha256") != model:
            raise AssertionError("Retained model changed at frame " + str(index))
    for index, case in enumerate(("base", "length", "base", "palette", "base", "bar"), 1):
        for key in ("model_sha256", "geometry_sha256", "color_sha256", "commands"):
            if frames[index-1].get(key) != accepted[case].get(key):
                raise AssertionError("Frame differs from accepted CP1 " + case + " " + key)
        actual = report["images"]["frame-" + str(index)]
        if actual["_rgba"] != cp1_images[case]["_rgba"]:
            raise AssertionError("Decoded frame " + str(index) + " differs from accepted CP1 " + case)
    # The last two combinations are not registered CP1 pixel cases. Their independent
    # retained edits are established from command hashes before their opaque PNGs are inspected.
    if frames[6]["color_sha256"] != frames[5]["color_sha256"] or frames[6]["geometry_sha256"] == frames[5]["geometry_sha256"]:
        raise AssertionError("Length edit did not preserve bar colour and change geometry")
    if frames[7]["geometry_sha256"] != frames[6]["geometry_sha256"] or frames[7]["color_sha256"] == frames[6]["color_sha256"]:
        raise AssertionError("Palette edit did not preserve long-bar geometry and change colour")
    if frames[7]["color_sha256"] != accepted["palette"]["color_sha256"]:
        raise AssertionError("Combined palette edit differs from accepted palette samples")
    report["combined_edit_changed_pixels"] = {}
    for before, after in ((6, 7), (7, 8)):
        left = report["images"]["frame-" + str(before)]["_rgba"]
        right = report["images"]["frame-" + str(after)]["_rgba"]
        changed = sum(left[i:i+4] != right[i:i+4] for i in range(0, len(left), 4))
        if not changed:
            raise AssertionError("Combined edit did not change the rendered image")
        report["combined_edit_changed_pixels"][str(after)] = changed
    report["model_sha256"] = model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args()
    prepared = prepare(STAGE, APP, ACTIVITY, extra_sources=(PROBE,))
    inputs = source_hashes(prepared)
    cp1_images = expected_cp1()
    apk = build(STAGE)
    verify_sources(inputs)
    if not args.render:
        print("Android Field Marks UI APK built; no native execution")
        return
    if adb("shell", "getprop", "sys.boot_completed").stdout.strip() != "1":
        raise RuntimeError("Existing emulator is not booted")
    fingerprint = adb("shell", "getprop", "ro.build.fingerprint").stdout.strip()
    api = adb("shell", "getprop", "ro.build.version.sdk").stdout.strip()
    if api != "33" or fingerprint != json.loads(CP1.read_text())["fingerprint"]:
        raise RuntimeError("Emulator differs from accepted Android CP1 runtime")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    attempt = OUTPUT / "attempt.json"
    with attempt.open("x") as stream:
        json.dump({"status": "started", "input_sha256": inputs}, stream)
    report = {"status": "failed", "part": "android-editable-field-marks-ui",
              "scope": "Actual Android editable-example controls and cached-PNG save route; not a human usability study",
              "input_sha256": inputs, "prepared": prepared, "apk_sha256": digest(apk),
              "api": 33, "fingerprint": fingerprint,
              "frames": [], "images": {}, "focus_checks": [], "clicks": []}
    deadline = time.monotonic() + 1800
    nonce = None
    sequence = -1

    def wait_frame(number):
        nonlocal nonce, sequence
        filename = "frame-" + str(number) + ".json"
        while time.monotonic() < deadline:
            marker = read_private_json(filename)
            if marker is not None:
                if marker.get("event") != "frame-ready":
                    raise AssertionError("Wrong frame marker event for " + filename)
                if nonce is None:
                    nonce = marker.get("nonce")
                if not nonce or marker.get("nonce") != nonce:
                    raise AssertionError("Probe Activity changed identity")
                if marker.get("sequence") != number:
                    raise AssertionError("Probe frame sequence differs from registered sequence")
                sequence = marker["sequence"]
                report["frames"].append(marker)
                return marker
            result = read_private_json("result.json")
            if result is not None and result.get("passed") is not True:
                report["native"] = result
                raise AssertionError("Probe failed before frame " + str(number))
            if not adb("shell", "pidof", APP, check=False).stdout.strip():
                raise RuntimeError("Probe process exited before frame " + str(number))
            time.sleep(.25)
        raise TimeoutError("No frame marker " + str(number))

    try:
        report["install"] = adb("install", "-r", str(apk)).stdout
        adb("shell", "am", "force-stop", APP)
        adb("shell", "run-as", APP, "rm", "-rf", "files")
        adb("shell", "run-as", APP, "mkdir", "-p", "files")
        report["launch"] = adb("shell", "am", "start", "-W", "-n", APP + "/" + ACTIVITY).stdout
        if "Status: ok" not in report["launch"]:
            raise RuntimeError("Probe Activity did not launch")
        marker = wait_frame(1)
        for number, control in enumerate(("length", "length", "palette", "palette", "marks", "length", "palette"), 2):
            require_front(report, deadline)
            x, y = button_center(marker, control)
            click = adb("shell", "input", "tap", str(x), str(y))
            report["clicks"].append({"before_frame": number - 1, "control": control,
                                     "center_x": x, "center_y": y, "stdout": click.stdout})
            marker = wait_frame(number)
        require_front(report, deadline)
        x, y = button_center(marker, "save")
        click = adb("shell", "input", "tap", str(x), str(y))
        report["clicks"].append({"before_frame": 8, "control": "save", "center_x": x,
                                 "center_y": y, "stdout": click.stdout})
        native = None
        while time.monotonic() < deadline:
            native = read_private_json("result.json")
            if native is not None:
                break
            if not adb("shell", "pidof", APP, check=False).stdout.strip():
                raise RuntimeError("Probe process exited before save result")
            time.sleep(.25)
        if native is None:
            raise TimeoutError("No saved Field Marks result")
        report["native"] = native
        if native.get("event") != "result" or native.get("passed") is not True or native.get("nonce") != nonce:
            raise AssertionError("Probe result failed")
        if native.get("sequence") != 9:
            raise AssertionError("Terminal probe sequence differs from registered sequence")
        if native.get("composition_count") != 8 or native.get("completed_frame_count") != 9:
            raise AssertionError("Save advanced or omitted a composition/frame")
        if not isinstance(native.get("frames"), list) or len(native["frames"]) != 8:
            raise AssertionError("Probe final report lacks exactly eight frames")
        if native["frames"] != report["frames"]:
            raise AssertionError("Probe terminal frames differ from observed frame markers")
        if read_private_json("frame-9.json") is not None:
            raise AssertionError("Save created an unexpected ninth composition")
        for number in range(1, 9):
            target = OUTPUT / ("frame-" + str(number) + ".png")
            pull_binary("files/field-marks-probe/frame-" + str(number) + ".png", target)
            report["images"]["frame-" + str(number)] = image_record(target)
        check_frames(report["frames"], cp1_images, report)
        saved = OUTPUT / "saved.png"
        pull_binary("files/field-marks-probe/saved.png", saved)
        saved_bytes = saved.read_bytes()
        frame_eight = (OUTPUT / "frame-8.png").read_bytes()
        if saved_bytes != frame_eight:
            raise AssertionError("Saved PNG bytes differ from cached frame eight")
        saved_info = native.get("saved")
        if not isinstance(saved_info, dict) or saved_info.get("byte_sha256") != digest(saved):
            raise AssertionError("Probe saved PNG digest does not match pulled bytes")
        report["saved"] = {"path": str(saved.relative_to(ROOT)), "png_sha256": digest(saved),
                           "bytes_equal_frame_8": True, "native": saved_info}
        screenshot = OUTPUT / "example-screen.png"
        require_front(report, deadline)
        with screenshot.open("wb") as stream:
            subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580",
                            "exec-out", "screencap", "-p"], stdout=stream,
                           stderr=subprocess.PIPE, timeout=120, check=True)
        report["screenshot"] = {"path": str(screenshot.relative_to(ROOT)), "sha256": digest(screenshot)}
        verify_sources(inputs)
        report["status"] = "passed"
    except Exception as error:
        report["failure"] = str(error)
        report["runtime_errors"] = adb("logcat", "-d", "-t", "200", "-s", "AndroidRuntime", check=False).stdout
        raise
    finally:
        for value in report["images"].values():
            value.pop("_image", None)
            value.pop("_rgba", None)
        atomic(EVIDENCE, report)
        atomic(attempt, {"status": report["status"], "input_sha256": inputs})
    adb("shell", "am", "force-stop", APP)
    print(EVIDENCE.relative_to(ROOT))


if __name__ == "__main__":
    main()
