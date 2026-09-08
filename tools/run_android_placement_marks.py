#!/usr/bin/env python3
"""Build or execute the one registered Android PlacementMarks native UI attempt."""
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

from build_android_placement_marks import ROOT, WORK, SDK, build, prepare

APP = "org.procedurals.placementmarksprobe"
ACTIVITY = "org.procedurals.examples.placementmarks.PlacementMarksProbeActivity"
STAGE = ROOT / ".work/environments/android/placement-marks-ui"
OUTPUT = ROOT / ".work/reproductions/placement-marks-android"
EVIDENCE = ROOT / "evidence/reproductions/placement-marks-android/result.json"
PLAN_PATH = ROOT / "evidence/reproductions/placement-marks-android/plan.json"
PROBE = ROOT / "tests/native/android-placement-marks/PlacementMarksProbeActivity.java"
PURE_TOOL = ROOT / "tools/run_circle_placement_java.py"
JDK = WORK / "toolchains/jdk-17.0.20.1+1"
TOTAL_STATES = 17


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
        raise TimeoutError("Android PlacementMarks execution deadline expired")
    return max(1, min(cap, math.ceil(remaining)))


def adb_before(deadline: float, *arguments: str, check: bool = True, cap: int = 120) -> subprocess.CompletedProcess[str]:
    return adb(*arguments, timeout=remaining_timeout(deadline, cap), check=check)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_plan(plan: dict[str, object]) -> None:
    if (plan.get("attempt_budget"), plan.get("composition_budget")) != (1, TOTAL_STATES):
        raise RuntimeError("unexpected Android PlacementMarks attempt registration")
    if (plan.get("timeout_seconds"), plan.get("execution_timeout_seconds"),
            plan.get("cleanup_timeout_seconds")) != (2460, 2400, 60):
        raise RuntimeError("Android PlacementMarks total/execution/cleanup timeout split changed")
    runtime = plan.get("runtime", {})
    if (runtime.get("application_id") != APP or runtime.get("activity") != ACTIVITY
            or runtime.get("adb_port") != 5038 or runtime.get("serial") != "emulator-5580"):
        raise RuntimeError("unexpected Android PlacementMarks runtime binding")
    states = plan.get("states")
    if not isinstance(states, list) or len(states) != TOTAL_STATES:
        raise RuntimeError("Android PlacementMarks state registration changed")
    expected_ids = ["baseline", "diamonds", "rings-restored", "palette", "palette-restored",
                    "spacing", "spacing-restored", "size-min", "size-min-restored", "size-max",
                    "size-max-restored", "count-extended", "count-restored", "seed", "radial",
                    "radial-spacing", "radial-spacing-restored"]
    expected_accepted = [424, 424, 424, 424, 424, 353, 424, 239, 424, 613, 424, 517, 424, 432, 111, 95, 111]
    for index, state in enumerate(states):
        if state.get("id") != expected_ids[index] or state.get("ordinal") != index + 1:
            raise RuntimeError("Android PlacementMarks state order changed at " + str(index + 1))
        if state.get("accepted") != expected_accepted[index]:
            raise RuntimeError("Android PlacementMarks accepted count changed at " + expected_ids[index])
        submitted = state.get("submitted_commands")
        if submitted != state["accepted"] * (4 if state.get("diamonds") else 64):
            raise RuntimeError("Android PlacementMarks submitted commands changed at " + expected_ids[index])
    if plan.get("visual_images") != ["baseline.png", "diamonds.png", "palette.png", "spacing.png",
                                     "size-min.png", "size-max.png", "count.png", "seed.png",
                                     "radial.png", "radial-spacing.png"]:
        raise RuntimeError("unexpected Android PlacementMarks visual image registration")


def source_hashes(prepared: dict[str, object], pure_report: Path) -> dict[str, str]:
    values = dict(prepared["source_hashes"])
    for path in (Path(__file__).resolve(), PROBE, PLAN_PATH, PURE_TOOL,
                 ROOT / "design/capabilities/placement-marks-p5-acceptance.md",
                 ROOT / "catalog/operations/ordered-circle-filter.json",
                 ROOT / "catalog/operations/seeded-circle-placement.json",
                 ROOT / "fixtures/operations/ordered-circle-filter.json",
                 ROOT / "fixtures/operations/seeded-circle-placement.json"):
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
    subprocess.run([os.environ.get("PYTHON", "python3"), str(PURE_TOOL),
                    "--java-home", str(JDK), "--output", str(output)],
                   cwd=ROOT, check=True, capture_output=True, text=True, timeout=600)
    report = json.loads(output.read_text())
    if report.get("vectors", {}).get("status") != "passed" or report.get("native", {}).get("status") != "passed":
        raise RuntimeError("PlacementMarks pure Java preflight failed")
    return output, report


def read_private_json(deadline: float, name: str) -> dict[str, object] | None:
    result = adb_before(deadline, "shell", "run-as", APP, "cat", "files/placement-marks-probe/" + name, check=False)
    return json.loads(result.stdout) if result.returncode == 0 else None


def pull_binary(deadline: float, remote: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580",
                        "exec-out", "run-as", APP, "cat", remote],
                       stdout=stream, stderr=subprocess.PIPE, timeout=remaining_timeout(deadline), check=True)


def image_record(path: Path) -> dict[str, object]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        rgba = image.tobytes()
    if image.size != (640, 640) or any(value != 255 for value in rgba[3::4]):
        raise AssertionError("cached PlacementMarks image is not opaque 640x640: " + path.name)
    background = bytes((236, 231, 218))
    nonbackground = sum(rgba[index:index + 3] != background for index in range(0, len(rgba), 4))
    if nonbackground == 0:
        raise AssertionError("cached PlacementMarks image is blank: " + path.name)
    return {"path": str(path.relative_to(ROOT)), "png_sha256": sha(path),
            "rgba_sha256": hashlib.sha256(rgba).hexdigest(),
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
        if any(APP in line and "PlacementMarksProbeActivity" in line for line in resumed) and any(APP in line and "PlacementMarksProbeActivity" in line for line in focused):
            report["focus_checks"].append(observed)
            return
        time.sleep(.25)
    report["focus_checks"].append(observed)
    raise TimeoutError("PlacementMarks Probe Activity is not resumed and focused; no click sent")


def check_frames(frames: list[dict[str, object]], images: dict[str, dict[str, object]], plan: dict[str, object]) -> None:
    if len(frames) != TOTAL_STATES:
        raise AssertionError("expected " + str(TOTAL_STATES) + " Android PlacementMarks frame observations")
    for index, (frame, state) in enumerate(zip(frames, plan["states"]), 1):
        expected_settings = (frame.get("seed"), frame.get("attempts"), frame.get("radial"),
                             frame.get("separation"), frame.get("minimum"), frame.get("maximum"),
                             frame.get("diamonds"), frame.get("alternate"))
        actual_settings = (state["seed"], state["attempts"], state["radial"],
                           state["separation"], state["minimum"], state["maximum"],
                           state["diamonds"], state["alternate"])
        if expected_settings != actual_settings:
            raise AssertionError("unexpected PlacementMarks edit state at " + str(index))
        if (frame.get("id") != state["id"] or frame.get("composition_count") != index
                or frame.get("completed_frame_count") != index + 1
                or frame.get("state_version") != index - 1
                or frame.get("accepted") != state["accepted"]
                or frame.get("proposals") != state["proposals"]
                or frame.get("submitted_commands") != state["submitted_commands"]):
            raise AssertionError("unexpected registered frame identity/count at " + str(index))
        expected_retained = None if index == 1 else index <= 5
        if frame.get("retained_identity") is not expected_retained:
            raise AssertionError("unexpected retained composition identity at " + str(index))
        if index == 12 and frame.get("prefix_checked") is not True:
            raise AssertionError("count-extended prefix check is missing")
        if frame.get("renderer") != plan["runtime"]["renderer"]:
            raise AssertionError("unexpected PlacementMarks renderer at " + str(index))
        if images["frame-" + str(index)]["png_sha256"] != frame.get("png_sha256"):
            raise AssertionError("pulled PlacementMarks frame differs from acknowledged cached PNG")
    if images["frame-1"]["_rgba"] != images["frame-3"]["_rgba"] or images["frame-1"]["_rgba"] != images["frame-5"]["_rgba"]:
        raise AssertionError("motif/palette restoration pixels differ from baseline")
    for index in (7, 9, 11, 13):
        if images["frame-1"]["_rgba"] != images["frame-" + str(index)]["_rgba"]:
            raise AssertionError("geometry restoration frame " + str(index) + " pixels differ from baseline")
    if images["frame-15"]["_rgba"] == images["frame-1"]["_rgba"] or images["frame-15"]["_rgba"] == images["frame-14"]["_rgba"]:
        raise AssertionError("radial source pixels match a seeded frame")
    if images["frame-15"]["_rgba"] != images["frame-17"]["_rgba"]:
        raise AssertionError("radial spacing restoration pixels differ from radial")
    if images["frame-2"]["_rgba"] == images["frame-1"]["_rgba"] or images["frame-4"]["_rgba"] == images["frame-3"]["_rgba"]:
        raise AssertionError("style edit produced no visible pixel change")


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
        print(json.dumps({"prepared": True,
                          "scope": "pure Java preflight and isolated Android APK build only; no install, emulator launch, or render",
                          "pure_preflight": str(pure_path.relative_to(ROOT)), "apk": str(apk.relative_to(ROOT)),
                          "apk_sha256": sha(apk), "input_sha256": inputs}, sort_keys=True))
        return 0

    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        started = time.monotonic()
        execution_deadline = started + int(plan["execution_timeout_seconds"])
        cleanup_deadline = started + int(plan["timeout_seconds"])
        with attempt.open("x") as stream:
            json.dump({"status": "reserved", "composition_budget": TOTAL_STATES, "input_sha256": inputs},
                      stream, indent=2, sort_keys=True)
        report: dict[str, object] = {"status": "failed", "scope": plan["scope"], "input_sha256": inputs,
                                     "prepared": prepared, "pure_preflight": pure, "apk_sha256": sha(apk),
                                     "timeout": {"total_seconds": 2460, "execution_seconds": 2400, "cleanup_seconds": 60},
                                     "frames": [], "images": {}, "clicks": [], "focus_checks": [],
                                     "ignored_while_radial": [], "visual_review": "pending"}
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
            report["launch"] = adb_before(execution_deadline, "shell", "am", "start", "-W", "-n",
                                          APP + "/" + ACTIVITY).stdout
            if "Status: ok" not in report["launch"]:
                raise RuntimeError("PlacementMarks Probe Activity did not launch")

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
                            raise AssertionError("PlacementMarks probe identity changed")
                        report["frames"].append(marker)
                        return marker
                    terminal = read_private_json(execution_deadline, "result.json")
                    if terminal is not None and terminal.get("passed") is not True:
                        report["native"] = terminal
                        raise AssertionError("PlacementMarks Probe failed before " + filename)
                    if not adb_before(execution_deadline, "shell", "pidof", APP, check=False).stdout.strip():
                        raise RuntimeError("PlacementMarks Probe exited before " + filename)
                    time.sleep(.25)
                raise TimeoutError("no marker " + filename)

            marker = wait_frame(1)
            taps = [("motif", 2), ("motif", 3), ("palette", 4), ("palette", 5), ("separation", 6),
                    ("separation", 7), ("min", 8), ("min", 9), ("max", 10), ("max", 11),
                    ("budget", 12), ("budget", 13), ("seed", 14), ("source", 15)]
            for control, number in taps:
                require_front(report, execution_deadline)
                x, y = button_center(marker, control)
                click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
                report["clicks"].append({"before_frame": number - 1, "control": control,
                                         "center_x": x, "center_y": y, "stdout": click.stdout})
                marker = wait_frame(number)
            # Ignored edits while radial: seed, budget, min, max must produce no frame.
            for control in ("seed", "budget", "min", "max"):
                require_front(report, execution_deadline)
                x, y = button_center(marker, control)
                click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
                report["clicks"].append({"before_frame": 15, "control": control + "-ignored",
                                         "center_x": x, "center_y": y, "stdout": click.stdout})
            ignored_started = time.monotonic()
            time.sleep(1.5)
            if read_private_json(execution_deadline, "frame-16.json") is not None:
                raise AssertionError("ignored edit while radial produced a frame")
            if read_private_json(execution_deadline, "result.json") is not None:
                raise AssertionError("probe terminated after ignored edits while radial")
            report["ignored_while_radial"] = {
                "taps": ["seed", "budget", "min", "max"],
                "window_seconds": 1.5,
                "elapsed_seconds": round(time.monotonic() - ignored_started, 3),
                "frame_16_present": False,
                "result_present": False,
            }
            require_front(report, execution_deadline)
            x, y = button_center(marker, "separation")
            click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
            report["clicks"].append({"before_frame": 15, "control": "separation",
                                     "center_x": x, "center_y": y, "stdout": click.stdout})
            marker = wait_frame(16)
            require_front(report, execution_deadline)
            x, y = button_center(marker, "separation")
            click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
            report["clicks"].append({"before_frame": 16, "control": "separation",
                                     "center_x": x, "center_y": y, "stdout": click.stdout})
            marker = wait_frame(17)
            require_front(report, execution_deadline)
            x, y = button_center(marker, "save")
            click = adb_before(execution_deadline, "shell", "input", "tap", str(x), str(y))
            report["clicks"].append({"before_frame": 17, "control": "save",
                                     "center_x": x, "center_y": y, "stdout": click.stdout})
            native = None
            while time.monotonic() < execution_deadline:
                native = read_private_json(execution_deadline, "result.json")
                if native is not None:
                    break
                if not adb_before(execution_deadline, "shell", "pidof", APP, check=False).stdout.strip():
                    raise RuntimeError("PlacementMarks Probe exited before save result")
                time.sleep(.25)
            if native is None:
                raise TimeoutError("no PlacementMarks save result")
            report["native"] = native
            if (native.get("event") != "result" or native.get("passed") is not True
                    or native.get("nonce") != nonce or native.get("sequence") != TOTAL_STATES + 1):
                raise AssertionError("PlacementMarks Probe terminal result failed")
            quiet = native.get("save_quiet_ms")
            if (type(quiet) not in (int, float) or not math.isfinite(quiet) or quiet < 300
                    or native.get("api") != 33
                    or native.get("renderer") != plan["runtime"]["renderer"]
                    or native.get("composition_count") != TOTAL_STATES
                    or native.get("completed_frame_count") != TOTAL_STATES + 1):
                raise AssertionError("unexpected PlacementMarks Android runtime/final counts")
            if native.get("frames") != report["frames"] or read_private_json(execution_deadline, "frame-18.json") is not None:
                raise AssertionError("save altered PlacementMarks frame journal")
            for number in range(1, TOTAL_STATES + 1):
                target = OUTPUT / ("frame-" + str(number) + ".png")
                pull_binary(execution_deadline,
                            "files/placement-marks-probe/frame-" + str(number) + ".png", target)
                report["images"]["frame-" + str(number)] = image_record(target)
            check_frames(report["frames"], report["images"], plan)
            for image_name, frame_number in (("baseline.png", 1), ("diamonds.png", 2), ("palette.png", 4),
                                             ("spacing.png", 6), ("size-min.png", 8), ("size-max.png", 10),
                                             ("count.png", 12), ("seed.png", 14),
                                             ("radial.png", 15), ("radial-spacing.png", 16)):
                target = OUTPUT / image_name
                shutil.copyfile(OUTPUT / ("frame-" + str(frame_number) + ".png"), target)
                report["images"][image_name] = image_record(target)
            saved = OUTPUT / "saved.png"
            pull_binary(execution_deadline, "files/placement-marks-probe/saved.png", saved)
            if saved.read_bytes() != (OUTPUT / "frame-17.png").read_bytes():
                raise AssertionError("MediaStore save differs from cached frame seventeen bytes")
            saved_info = native.get("saved")
            if not isinstance(saved_info, dict) or saved_info.get("byte_sha256") != sha(saved):
                raise AssertionError("saved PlacementMarks bytes do not bind to native MediaStore observation")
            report["saved"] = {"path": str(saved.relative_to(ROOT)), "png_sha256": sha(saved),
                               "bytes_equal_frame_17": True, "native": saved_info}
            verify_sources(inputs)
            report["status"] = "passed"
        except BaseException as error:
            report["failure"] = str(error)
            try:
                report["runtime_errors"] = adb_before(execution_deadline, "logcat", "-d", "-t", "200",
                                                      "-s", "AndroidRuntime", check=False).stdout
            except BaseException as diagnostic_error:
                report["diagnostic_failure"] = str(diagnostic_error)
        finally:
            try:
                cleanup = adb_before(cleanup_deadline, "shell", "am", "force-stop", APP, check=False, cap=30)
                report["cleanup"] = {"returncode": cleanup.returncode, "stdout": cleanup.stdout,
                                     "stderr": cleanup.stderr}
                if cleanup.returncode != 0:
                    report["status"] = "failed"
                    report["cleanup_failure"] = "force-stop returned " + str(cleanup.returncode)
            except BaseException as cleanup_error:
                report["status"] = "failed"
                report["cleanup_failure"] = str(cleanup_error)
            for value in report["images"].values():
                value.pop("_rgba", None)
            atomic(EVIDENCE, report)
            atomic(attempt, {"status": report["status"], "composition_budget": TOTAL_STATES,
                             "input_sha256": inputs})
    print(json.dumps({"status": report["status"], "failure": report.get("failure"),
                      "visual_review": report["visual_review"]}, sort_keys=True))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
