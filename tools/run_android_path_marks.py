#!/usr/bin/env python3
"""Build or execute the one registered Android PathMarks native UI attempt."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time

from PIL import Image

from build_android_path_marks import ROOT, SDK, build, digest, prepare

APP = "org.procedurals.pathmarksprobe"
ACTIVITY = "org.procedurals.examples.pathmarks.PathMarksProbeActivity"
STAGE = ROOT / ".work/environments/android/path-marks-ui"
OUTPUT = ROOT / ".work/reproductions/cp2-android"
EVIDENCE = ROOT / "evidence/reproductions/cp2-android/result.json"
PLAN_PATH = ROOT / "evidence/reproductions/cp2-android/plan.json"
PROBE = ROOT / "tests/native/android-path-marks/PathMarksProbeActivity.java"
PURE_TOOL = ROOT / "tools/check_path_marks_commands.py"


def atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def adb(*arguments: str, timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580", *arguments],
                          text=True, capture_output=True, timeout=timeout, check=check)


def remaining_timeout(deadline: float, cap: int = 120) -> int:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("Android PathMarks execution deadline expired")
    return max(1, min(cap, math.ceil(remaining)))


def adb_before(deadline: float, *arguments: str, check: bool = True, cap: int = 120) -> subprocess.CompletedProcess[str]:
    return adb(*arguments, timeout=remaining_timeout(deadline, cap), check=check)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_plan(plan: dict[str, object]) -> None:
    if (plan.get("attempt_budget"), plan.get("composition_budget")) != (1, 7):
        raise RuntimeError("unexpected Android PathMarks attempt registration")
    if (plan.get("timeout_seconds"), plan.get("execution_timeout_seconds"), plan.get("cleanup_timeout_seconds")) != (1800, 1770, 30):
        raise RuntimeError("Android PathMarks total/execution/cleanup timeout split changed")
    runtime = plan.get("runtime", {})
    if runtime.get("application_id") != APP or runtime.get("activity") != ACTIVITY or runtime.get("adb_port") != 5038 or runtime.get("serial") != "emulator-5580":
        raise RuntimeError("unexpected Android PathMarks runtime binding")
    states = plan.get("states")
    expected = [
        ("marks", "initial Activity frame", 12000, 7002), ("trace", "Mode tap", 48000, 27784),
        ("marks-replay", "Mode tap", 12000, 7002), ("long-marks", "Length tap", 12000, 7057),
        ("palette", "Palette tap", 12000, 7057), ("count", "Count tap", 12024, 7066),
        ("distance", "Distance tap", 12024, 5500),
    ]
    actual = [(state.get("id"), state.get("trigger"), state.get("raw_commands"), state.get("submitted_commands")) for state in states] if isinstance(states, list) else None
    if actual != expected:
        raise RuntimeError("Android PathMarks state/culling registration changed")
    if plan.get("visual_images") != ["marks.png", "trace.png", "long-marks.png"]:
        raise RuntimeError("unexpected Android PathMarks visual image registration")


def source_hashes(prepared: dict[str, object], pure_report: Path) -> dict[str, str]:
    values = dict(prepared["source_hashes"])
    for path in (Path(__file__).resolve(), PROBE, PLAN_PATH, PURE_TOOL,
                 ROOT / "design/capabilities/cp2-public-example.md",
                 ROOT / "design/android-editable-example.md",
                 ROOT / "design/android-adapter-validation.md",
                 ROOT / "catalog/operations/gradient-path.json",
                 ROOT / "catalog/drawing/fresh-raster-2d.json",
                 ROOT / "tests/native/PathMarksCommands.java"):
        values[str(path.relative_to(ROOT))] = sha(path)
    values[str(pure_report.relative_to(ROOT))] = sha(pure_report)
    return values


def verify_sources(values: dict[str, str]) -> None:
    for relative, expected in values.items():
        if sha(ROOT / relative) != expected:
            raise RuntimeError("source input changed: " + relative)


def pure_preflight(plan: dict[str, object]) -> tuple[Path, dict[str, object]]:
    output = ROOT / str(plan["pure_preflight"]["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([os.environ.get("PYTHON", "python3"), str(PURE_TOOL), "--output", str(output)], cwd=ROOT, check=True,
                   capture_output=True, text=True, timeout=120)
    report = json.loads(output.read_text())
    result = report.get("result", {})
    if report.get("status") != "passed" or result.get("prefix_passed") is not True or result.get("distance_feedback_passed") is not True or result.get("unchanged_movement_passed") is not True:
        raise RuntimeError("PathMarks pure Java preflight failed")
    expected = [state["submitted_commands"] for state in plan["states"]]
    if result.get("submitted_commands_by_state") != expected:
        raise RuntimeError("pure Java submitted counts differ from Android registration")
    return output, report


def read_private_json(deadline: float, name: str) -> dict[str, object] | None:
    result = adb_before(deadline, "shell", "run-as", APP, "cat", "files/path-marks-probe/" + name, check=False)
    return json.loads(result.stdout) if result.returncode == 0 else None


def pull_binary(deadline: float, remote: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580", "exec-out", "run-as", APP, "cat", remote],
                       stdout=stream, stderr=subprocess.PIPE, timeout=remaining_timeout(deadline), check=True)


def image_record(path: Path) -> dict[str, object]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        rgba = image.tobytes()
    if image.size != (640, 640) or any(value != 255 for value in rgba[3::4]):
        raise AssertionError("cached PathMarks image is not opaque 640x640: " + path.name)
    background = bytes((236, 231, 218))
    nonbackground = sum(rgba[index:index + 3] != background for index in range(0, len(rgba), 4))
    if nonbackground == 0:
        raise AssertionError("cached PathMarks image is blank: " + path.name)
    return {"path": str(path.relative_to(ROOT)), "png_sha256": sha(path), "rgba_sha256": hashlib.sha256(rgba).hexdigest(),
            "nonbackground_pixels": nonbackground, "_rgba": rgba}


def button_center(marker: dict[str, object], name: str) -> tuple[int, int]:
    rows = marker.get("button_center_bounds")
    if not isinstance(rows, list):
        raise AssertionError("frame marker has no button bounds")
    matches = [row for row in rows if row.get("id") == name]
    if len(matches) != 1:
        raise AssertionError("frame marker has no unique " + name + " button")
    row = matches[0]
    x, y = row.get("center_x"), row.get("center_y")
    if not isinstance(x, int) or not isinstance(y, int) or not (row["left"] <= x < row["left"] + row["width"] and row["top"] <= y < row["top"] + row["height"]):
        raise AssertionError("invalid observed " + name + " button center")
    return x, y


def require_front(report: dict[str, object], deadline: float) -> None:
    observed: dict[str, object] = {}
    while time.monotonic() < deadline:
        activities = adb_before(deadline, "shell", "dumpsys", "activity", "activities").stdout
        windows = adb_before(deadline, "shell", "dumpsys", "window").stdout
        resumed = [line.strip() for line in activities.splitlines() if "topResumedActivity=" in line or "mResumedActivity:" in line]
        focused = [line.strip() for line in windows.splitlines() if "mCurrentFocus=" in line]
        observed = {"resumed": resumed, "focused": focused}
        if any(APP in line and "PathMarksProbeActivity" in line for line in resumed) and any(APP in line and "PathMarksProbeActivity" in line for line in focused):
            report["focus_checks"].append(observed)
            return
        time.sleep(.25)
    report["focus_checks"].append(observed)
    raise TimeoutError("PathMarks Probe Activity is not resumed and focused; no click sent")


def check_frames(frames: list[dict[str, object]], images: dict[str, dict[str, object]], plan: dict[str, object]) -> None:
    if len(frames) != 7:
        raise AssertionError("expected seven Android PathMarks frame observations")
    for index, (frame, state) in enumerate(zip(frames, plan["states"]), 1):
        expected_options = (state["trace"], state["length"] == 24, state["alternate"], state["steps"] == 2001, state["distance"] == .8)
        actual_options = (frame.get("trace"), frame.get("longer"), frame.get("alternate"), frame.get("more"), frame.get("farther"))
        if frame.get("id") != state["id"] or frame.get("composition_count") != index or frame.get("completed_frame_count") != index + 1 or frame.get("state_version") != index - 1:
            raise AssertionError("unexpected registered frame identity/count at " + str(index))
        if actual_options != expected_options or frame.get("steps") != state["steps"] or frame.get("distance") != state["distance"] or frame.get("mark_length") != state["length"]:
            raise AssertionError("unexpected PathMarks edit state at " + str(index))
        if frame.get("path_count") != 24 or frame.get("raw_commands") != state["raw_commands"] or frame.get("submitted_commands") != state["submitted_commands"]:
            raise AssertionError("unexpected PathMarks raw/submitted record at " + str(index))
        if images["frame-" + str(index)]["png_sha256"] != frame.get("png_sha256"):
            raise AssertionError("pulled PathMarks frame differs from acknowledged cached PNG")
        if index in (2, 3, 4, 5) and (frame.get("same_movement_as_previous") is not True or frame.get("same_path_objects_as_previous") is not True):
            raise AssertionError("style edit did not retain actual movement at " + str(index))
        if index in (6, 7) and (frame.get("same_movement_as_previous") is not False or frame.get("same_path_objects_as_previous") is not False):
            raise AssertionError("movement edit did not replace actual movement at " + str(index))
    if frames[5].get("count_prefix_checked") is not True or frames[6].get("distance_feedback_checked") is not True:
        raise AssertionError("actual Android prefix/feedback checks are missing")
    if images["frame-1"]["_rgba"] != images["frame-3"]["_rgba"]:
        raise AssertionError("marks replay pixels differ from base")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="reserve and execute the one Android native attempt")
    args = parser.parse_args()
    plan = json.loads(PLAN_PATH.read_text())
    validate_plan(plan)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    attempt = OUTPUT / "attempt.json"
    if args.render:
        if attempt.exists():
            raise RuntimeError("attempt already reserved; inspect terminal evidence before any rebuild or execution")
        allowed = {str(plan["pure_preflight"]["output"]).split("/")[-1]}
        stale = [path.name for path in OUTPUT.iterdir() if path.name not in allowed]
        if stale:
            raise RuntimeError("stale native/image artifacts must be preserved outside this new attempt: " + ", ".join(sorted(stale)))
    pure_path, pure = pure_preflight(plan)
    prepared = prepare(STAGE, APP, ACTIVITY, (PROBE,))
    inputs = source_hashes(prepared, pure_path)
    apk = build(STAGE)
    verify_sources(inputs)
    if not args.render:
        print(json.dumps({"prepared": True, "scope": "pure Java preflight and isolated Android APK build only; no install, emulator launch, or render",
                          "pure_preflight": str(pure_path.relative_to(ROOT)), "apk": str(apk.relative_to(ROOT)), "apk_sha256": sha(apk), "input_sha256": inputs}, sort_keys=True))
        return 0

    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        started = time.monotonic()
        execution_deadline = started + int(plan["execution_timeout_seconds"])
        cleanup_deadline = started + int(plan["timeout_seconds"])
        with attempt.open("x") as stream:
            json.dump({"status": "reserved", "composition_budget": 7, "input_sha256": inputs}, stream, indent=2, sort_keys=True)
        report: dict[str, object] = {"status": "failed", "scope": plan["scope"], "input_sha256": inputs,
                                     "prepared": prepared, "pure_preflight": pure, "apk_sha256": sha(apk),
                                     "timeout": {"total_seconds": 1800, "execution_seconds": 1770, "cleanup_seconds": 30},
                                     "frames": [], "images": {}, "clicks": [], "focus_checks": [], "visual_review": "pending"}
        nonce = None
        try:
            if adb_before(execution_deadline, "shell", "getprop", "sys.boot_completed").stdout.strip() != "1":
                raise RuntimeError("existing emulator is not booted; executor will not restart it")
            api = adb_before(execution_deadline, "shell", "getprop", "ro.build.version.sdk").stdout.strip()
            if api != "33":
                raise RuntimeError("existing emulator API is not 33")
            report["api"] = 33
            report["fingerprint"] = adb_before(execution_deadline, "shell", "getprop", "ro.build.fingerprint").stdout.strip()
            report["install"] = adb_before(execution_deadline, "install", "-r", str(apk)).stdout
            adb_before(execution_deadline, "shell", "am", "force-stop", APP)
            adb_before(execution_deadline, "shell", "run-as", APP, "rm", "-rf", "files")
            adb_before(execution_deadline, "shell", "run-as", APP, "mkdir", "-p", "files")
            report["launch"] = adb_before(execution_deadline, "shell", "am", "start", "-W", "-n", APP + "/" + ACTIVITY).stdout
            if "Status: ok" not in report["launch"]:
                raise RuntimeError("PathMarks Probe Activity did not launch")

            def wait_frame(number: int) -> dict[str, object]:
                nonlocal nonce
                filename = "frame-" + str(number) + ".json"
                while time.monotonic() < execution_deadline:
                    marker = read_private_json(execution_deadline, filename)
                    if marker is not None:
                        if marker.get("event") != "frame-ready" or marker.get("sequence") != number:
                            raise AssertionError("invalid frame marker " + filename)
                        if nonce is None:
                            nonce = marker.get("nonce")
                        if not nonce or marker.get("nonce") != nonce:
                            raise AssertionError("PathMarks probe identity changed")
                        report["frames"].append(marker)
                        return marker
                    terminal = read_private_json(execution_deadline, "result.json")
                    if terminal is not None and terminal.get("passed") is not True:
                        report["native"] = terminal
                        raise AssertionError("PathMarks Probe failed before " + filename)
                    if not adb_before(execution_deadline, "shell", "pidof", APP, check=False).stdout.strip():
                        raise RuntimeError("PathMarks Probe exited before " + filename)
                    time.sleep(.25)
                raise TimeoutError("no marker " + filename)

            marker = wait_frame(1)
            for number, control in enumerate(("mode", "mode", "length", "palette", "count", "distance"), 2):
                require_front(report, execution_deadline)
                x, y = button_center(marker, control)
                click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
                report["clicks"].append({"before_frame": number - 1, "control": control, "center_x": x, "center_y": y, "stdout": click.stdout})
                marker = wait_frame(number)
            require_front(report, execution_deadline)
            x, y = button_center(marker, "save")
            click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
            report["clicks"].append({"before_frame": 7, "control": "save", "center_x": x, "center_y": y, "stdout": click.stdout})
            native = None
            while time.monotonic() < execution_deadline:
                native = read_private_json(execution_deadline, "result.json")
                if native is not None:
                    break
                if not adb_before(execution_deadline, "shell", "pidof", APP, check=False).stdout.strip():
                    raise RuntimeError("PathMarks Probe exited before save result")
                time.sleep(.25)
            if native is None:
                raise TimeoutError("no PathMarks save result")
            report["native"] = native
            if native.get("event") != "result" or native.get("passed") is not True or native.get("nonce") != nonce or native.get("sequence") != 8:
                raise AssertionError("PathMarks Probe terminal result failed")
            quiet = native.get("save_quiet_ms")
            if (type(quiet) not in (int, float) or not math.isfinite(quiet) or quiet < 300 or
                    native.get("api") != 33 or native.get("renderer") != plan["runtime"]["renderer"] or native.get("composition_count") != 7 or native.get("completed_frame_count") != 8):
                raise AssertionError("unexpected PathMarks Android runtime/final counts")
            if native.get("frames") != report["frames"] or read_private_json(execution_deadline, "frame-8.json") is not None:
                raise AssertionError("save altered PathMarks frame journal")
            for number in range(1, 8):
                target = OUTPUT / ("frame-" + str(number) + ".png")
                pull_binary(execution_deadline, "files/path-marks-probe/frame-" + str(number) + ".png", target)
                report["images"]["frame-" + str(number)] = image_record(target)
            check_frames(report["frames"], report["images"], plan)
            for image_name, frame_number in (("marks.png", 1), ("trace.png", 2), ("long-marks.png", 4)):
                target = OUTPUT / image_name
                shutil.copyfile(OUTPUT / ("frame-" + str(frame_number) + ".png"), target)
                report["images"][image_name] = image_record(target)
            saved = OUTPUT / "saved.png"
            pull_binary(execution_deadline, "files/path-marks-probe/saved.png", saved)
            if saved.read_bytes() != (OUTPUT / "frame-7.png").read_bytes():
                raise AssertionError("MediaStore save differs from cached frame seven bytes")
            saved_info = native.get("saved")
            if not isinstance(saved_info, dict) or saved_info.get("byte_sha256") != sha(saved):
                raise AssertionError("saved PathMarks bytes do not bind to native MediaStore observation")
            report["saved"] = {"path": str(saved.relative_to(ROOT)), "png_sha256": sha(saved), "bytes_equal_frame_7": True, "native": saved_info}
            verify_sources(inputs)
            report["status"] = "passed"
        except BaseException as error:
            report["failure"] = str(error)
            try:
                report["runtime_errors"] = adb_before(execution_deadline, "logcat", "-d", "-t", "200", "-s", "AndroidRuntime", check=False).stdout
            except BaseException as diagnostic_error:
                report["diagnostic_failure"] = str(diagnostic_error)
        finally:
            try:
                cleanup = adb_before(cleanup_deadline, "shell", "am", "force-stop", APP, check=False, cap=30)
                report["cleanup"] = {"returncode": cleanup.returncode, "stdout": cleanup.stdout, "stderr": cleanup.stderr}
                if cleanup.returncode != 0:
                    report["status"] = "failed"
                    report["cleanup_failure"] = "force-stop returned " + str(cleanup.returncode)
            except BaseException as cleanup_error:
                report["status"] = "failed"
                report["cleanup_failure"] = str(cleanup_error)
            for value in report["images"].values():
                value.pop("_rgba", None)
            atomic(EVIDENCE, report)
            atomic(attempt, {"status": report["status"], "composition_budget": 7, "input_sha256": inputs})
    print(json.dumps({"status": report["status"], "failure": report.get("failure"), "visual_review": report["visual_review"]}, sort_keys=True))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
