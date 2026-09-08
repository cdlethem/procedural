#!/usr/bin/env python3
"""Read-only recovery of host evidence from the terminal Android PathMarks attempt.

Run only with --recover after review of recovery-plan.json. This tool never installs,
builds, launches, taps, stops, or otherwise changes the app/emulator.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))
from tools.run_android_path_marks import APP, SDK, check_frames, image_record

PLAN_PATH = ROOT / "evidence/reproductions/cp2-android/recovery-plan.json"
ORIGINAL = ROOT / "evidence/reproductions/cp2-android/result.json"
ORIGINAL_ATTEMPT = ROOT / ".work/reproductions/cp2-android/attempt.json"
SURFACE = ROOT / "packages/java-android/src/main/java/org/procedurals/android/internal/AndroidSurface.java"
RECOVERY_INPUTS = (Path(__file__).resolve(), PLAN_PATH, ORIGINAL, ORIGINAL_ATTEMPT)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def recovery_input_hashes() -> dict[str, str]:
    return {str(path.relative_to(ROOT)): sha256(path) for path in RECOVERY_INPUTS}


def atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def remaining(deadline: float, cap: int = 30) -> int:
    seconds = deadline - time.monotonic()
    if seconds <= 0:
        raise TimeoutError("120-second recovery deadline expired")
    return max(1, min(cap, math.ceil(seconds)))


def adb(deadline: float, *arguments: str, check: bool = True, cap: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580", *arguments],
                          text=True, capture_output=True, timeout=remaining(deadline, cap), check=check)


def pull(deadline: float, remote: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        subprocess.run([str(SDK / "platform-tools/adb"), "-P", "5038", "-s", "emulator-5580", "exec-out",
                        "run-as", APP, "cat", remote], stdout=stream, stderr=subprocess.PIPE,
                       timeout=remaining(deadline), check=True)


def pull_private_json(deadline: float, name: str, destination: Path) -> tuple[dict[str, object], dict[str, object]]:
    """Preserve app-private JSON bytes and separately expose their parsed contents."""
    pull(deadline, "files/path-marks-probe/" + name, destination)
    raw = destination.read_bytes()
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError("private " + name + " is not a JSON object")
    return parsed, {"path": str(destination.relative_to(ROOT)), "sha256": sha256(destination), "bytes": len(raw)}


def app_pid(deadline: float) -> dict[str, object]:
    result = adb(deadline, "shell", "pidof", APP, check=False)
    pids = result.stdout.split()
    if pids:
        raise RuntimeError("application process is running; recovery would not be a stable read-only observation: " + " ".join(pids))
    if result.returncode not in (0, 1):
        raise RuntimeError("pidof failed while checking app-process absence: " + result.stderr.strip())
    return {"absent": True, "returncode": result.returncode}


def validate_plan(plan: dict[str, object]) -> None:
    runtime = plan.get("runtime", {})
    if plan.get("status") != "planned" or plan.get("deadline_seconds") != 120:
        raise RuntimeError("unexpected recovery plan state/deadline")
    if (runtime.get("application_id"), runtime.get("adb_port"), runtime.get("serial"), runtime.get("api")) != (APP, 5038, "emulator-5580", 33):
        raise RuntimeError("unexpected recovery runtime binding")
    if runtime.get("renderer_base") != "processing.a2d.PGraphicsAndroid2D" or runtime.get("renderer_concrete") != "org.procedurals.android.internal.AndroidSurface":
        raise RuntimeError("unexpected renderer recovery binding")


def validate_original(plan: dict[str, object]) -> tuple[dict[str, object], dict[str, object]]:
    source = plan["source_attempt"]
    if sha256(ORIGINAL) != source["report_sha256"]:
        raise RuntimeError("original failed report hash differs from the recovery-plan binding")
    report = json.loads(ORIGINAL.read_text())
    attempt = json.loads(ORIGINAL_ATTEMPT.read_text())
    if report.get("status") != source["required_status"] or report.get("failure") != source["required_failure"]:
        raise RuntimeError("original report is not the expected terminal renderer-guard failure")
    if sha256(ORIGINAL_ATTEMPT) != source["attempt_sha256"]:
        raise RuntimeError("original attempt journal hash differs from the recovery-plan binding")
    if attempt.get("status") != "failed" or attempt.get("input_sha256") != report.get("input_sha256"):
        raise RuntimeError("original attempt journal is not the matching terminal failed attempt")
    for relative, expected in report.get("input_sha256", {}).items():
        path = ROOT / relative
        if not path.is_file() or sha256(path) != expected:
            raise RuntimeError("original bound input changed or is unavailable: " + relative)
    surface = SURFACE.read_text()
    if "class AndroidSurface extends PGraphicsAndroid2D" not in surface:
        raise RuntimeError("concrete AndroidSurface no longer declares planned renderer base")
    native = report.get("native")
    if not isinstance(native, dict):
        raise RuntimeError("original report lacks native result")
    frames = report.get("frames")
    nonce = native.get("nonce")
    quiet = native.get("save_quiet_ms")
    if (native.get("event"), native.get("passed"), native.get("api"), native.get("renderer"), native.get("composition_count"), native.get("completed_frame_count"), native.get("sequence")) != ("result", True, 33, plan["runtime"]["renderer_concrete"], 7, 8, 8):
        raise RuntimeError("original native tuple is not the known renderer-guard mismatch result")
    if not isinstance(nonce, str) or not nonce or type(quiet) not in (int, float) or not math.isfinite(quiet) or quiet < 300:
        raise RuntimeError("original native nonce/quiet observation is invalid")
    if not isinstance(frames, list) or len(frames) != 7 or native.get("frames") != frames:
        raise RuntimeError("original native/report frame journal is incomplete")
    for sequence, frame in enumerate(frames, 1):
        if frame.get("sequence") != sequence or frame.get("nonce") != nonce:
            raise RuntimeError("original frame journal has an unexpected nonce or sequence")
    return report, native


def missing_frame_eight(deadline: float) -> dict[str, object]:
    result = adb(deadline, "shell", "run-as", APP, "ls", "files/path-marks-probe/frame-8.json", check=False)
    combined = (result.stdout + "\n" + result.stderr).lower()
    if result.returncode == 0:
        raise RuntimeError("private frame-8.json unexpectedly exists")
    if "no such file" not in combined and "not found" not in combined:
        raise RuntimeError("frame-8 absence is ambiguous; adb/run-as did not report a missing file: " + combined.strip())
    return {"confirmed_missing": True, "returncode": result.returncode, "stderr": result.stderr, "stdout": result.stdout}


def installed_apk_hash(deadline: float) -> dict[str, object]:
    location = adb(deadline, "shell", "pm", "path", APP, check=False)
    if location.returncode != 0:
        return {"available": False, "reason": "pm path failed", "returncode": location.returncode, "stderr": location.stderr}
    lines = [line.removeprefix("package:") for line in location.stdout.splitlines() if line.startswith("package:")]
    if len(lines) != 1:
        return {"available": False, "reason": "pm path was not a single base APK", "stdout": location.stdout}
    checksum = adb(deadline, "shell", "sha256sum", lines[0], check=False)
    fields = checksum.stdout.split()
    if checksum.returncode != 0 or not fields or len(fields[0]) != 64:
        return {"available": False, "reason": "sha256sum unavailable for installed APK", "returncode": checksum.returncode,
                "stdout": checksum.stdout, "stderr": checksum.stderr, "path": lines[0]}
    return {"available": True, "path": lines[0], "sha256": fields[0]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recover", action="store_true", help="perform the reviewed read-only ADB recovery")
    args = parser.parse_args()
    recovery_inputs = recovery_input_hashes()
    plan = json.loads(PLAN_PATH.read_text())
    validate_plan(plan)
    report, native = validate_original(plan)
    output = ROOT / plan["output"]
    destination = ROOT / plan["report"]
    if not args.recover:
        print(json.dumps({"prepared": True, "scope": "local original-attempt/source validation only; no ADB recovery", "plan": str(PLAN_PATH.relative_to(ROOT)),
                          "original_status": report["status"], "original_failure": report["failure"]}, sort_keys=True))
        return 0
    if output.exists() and any(output.iterdir()):
        raise RuntimeError("recovery output already contains artifacts; preserve it rather than overwrite")
    if destination.exists():
        raise RuntimeError("recovery report already exists; preserve it rather than overwrite")
    output.mkdir(parents=True, exist_ok=False)
    deadline = time.monotonic() + int(plan["deadline_seconds"])
    recovered: dict[str, object] = {"status": "failed", "scope": "read-only recovery of original terminal Android PathMarks attempt; no new execution",
                                    "source_report": str(ORIGINAL.relative_to(ROOT)), "source_attempt": str(ORIGINAL_ATTEMPT.relative_to(ROOT)),
                                    "source_status": report["status"], "source_failure": report["failure"], "input_sha256": report["input_sha256"],
                                    "recovery_input_sha256": recovery_inputs, "deadline_seconds": plan["deadline_seconds"],
                                    "native": native, "frames": [], "images": {}}
    try:
        recovered["app_process_before"] = app_pid(deadline)
        api = adb(deadline, "shell", "getprop", "ro.build.version.sdk").stdout.strip()
        fingerprint = adb(deadline, "shell", "getprop", "ro.build.fingerprint").stdout.strip()
        if api != "33" or fingerprint != report.get("fingerprint"):
            raise RuntimeError("current emulator runtime differs from original attempt")
        recovered["runtime"] = {"api": 33, "fingerprint": fingerprint}
        recovered["renderer_type"] = {
            "source": str(SURFACE.relative_to(ROOT)),
            "sha256": sha256(SURFACE),
            "declaration": "class AndroidSurface extends PGraphicsAndroid2D",
            "base": plan["runtime"]["renderer_base"],
            "concrete": plan["runtime"]["renderer_concrete"],
        }
        recovered["installed_apk"] = installed_apk_hash(deadline)
        if recovered["installed_apk"].get("available") and recovered["installed_apk"].get("sha256") != report.get("apk_sha256"):
            raise RuntimeError("installed APK hash differs from the original terminal attempt")
        private_before, before_artifact = pull_private_json(deadline, "result.json", output / "result-before.json")
        if private_before != native:
            raise RuntimeError("private result before pulls differs from original native result")
        recovered["private_result_before"] = {**before_artifact, "exact_original": True}
        for number, expected in enumerate(report["frames"], 1):
            marker, artifact = pull_private_json(deadline, "frame-" + str(number) + ".json", output / ("frame-" + str(number) + ".json"))
            if marker != expected:
                raise RuntimeError("private frame journal differs from original frame-" + str(number))
            if marker.get("sequence") != number or marker.get("nonce") != native["nonce"]:
                raise RuntimeError("private frame journal has an unexpected nonce or sequence at frame-" + str(number))
            recovered["frames"].append(marker)
            recovered.setdefault("private_frame_artifacts", []).append({"number": number, **artifact, "exact_original": True})
        recovered["frame_8"] = missing_frame_eight(deadline)
        for number in range(1, 8):
            target = output / ("frame-" + str(number) + ".png")
            pull(deadline, "files/path-marks-probe/frame-" + str(number) + ".png", target)
            recovered["images"]["frame-" + str(number)] = image_record(target)
        check_frames(recovered["frames"], recovered["images"], json.loads((ROOT / "evidence/reproductions/cp2-android/plan.json").read_text()))
        for name, number in (("marks.png", 1), ("trace.png", 2), ("long-marks.png", 4)):
            target = output / name
            target.write_bytes((output / ("frame-" + str(number) + ".png")).read_bytes())
            recovered["images"][name] = image_record(target)
        saved = output / "saved.png"
        pull(deadline, "files/path-marks-probe/saved.png", saved)
        if saved.read_bytes() != (output / "frame-7.png").read_bytes():
            raise RuntimeError("recovered saved PNG differs from original frame seven cached bytes")
        saved_native = native.get("saved")
        if not isinstance(saved_native, dict):
            raise RuntimeError("original native journal has no saved-item metadata")
        expected_saved = {
            "byte_sha256": sha256(saved), "is_pending": 0, "metadata_width": 640, "metadata_height": 640,
            "png_width": 640, "png_height": 640, "mime_type": "image/png", "relative_path": "Pictures/Procedurals/",
        }
        for key, expected in expected_saved.items():
            if saved_native.get(key) != expected:
                raise RuntimeError("recovered saved PNG/native metadata mismatch for " + key)
        recovered["saved"] = {"path": str(saved.relative_to(ROOT)), "png_sha256": sha256(saved), "bytes_equal_frame_7": True,
                              "native": saved_native}
        private_after, after_artifact = pull_private_json(deadline, "result.json", output / "result-after.json")
        if private_after != native:
            raise RuntimeError("private result after pulls differs from original native result")
        recovered["private_result_after"] = {**after_artifact, "exact_original": True,
                                              "bytes_equal_before": (output / "result-after.json").read_bytes() == (output / "result-before.json").read_bytes()}
        if not recovered["private_result_after"]["bytes_equal_before"]:
            raise RuntimeError("private result bytes changed between before/after pulls")
        recovered["app_process_after"] = app_pid(deadline)
        validate_original(plan)
        if recovery_input_hashes() != recovery_inputs:
            raise RuntimeError("recovery tool, plan, or original terminal evidence changed during recovery")
        remaining(deadline)
        recovered["status"] = "recovered"
    except BaseException as error:
        recovered["failure"] = str(error)
    finally:
        for value in recovered["images"].values():
            value.pop("_rgba", None)
        atomic(destination, recovered)
    print(json.dumps({"status": recovered["status"], "failure": recovered.get("failure"), "report": str(destination.relative_to(ROOT))}, sort_keys=True))
    return 0 if recovered["status"] == "recovered" else 1


if __name__ == "__main__":
    raise SystemExit(main())
