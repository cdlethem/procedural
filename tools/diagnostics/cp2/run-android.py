#!/usr/bin/env python3
"""Run the frozen CP2 numeric probe on Android ART without an APK or renderer."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import shlex
import struct
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / ".work/cp2-numerics-android"
CLASSES = OUTPUT / "classes"
DEX = OUTPUT / "dex"
RESULT = OUTPUT / "result.json"
EVIDENCE = ROOT / "evidence/investigations/cp2-numerics-android.json"
JAVA_DISTRIBUTION_EVIDENCE = ROOT / "evidence/distribution/java-artifacts.json"
DEFAULT_JAVA_HOME = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
DEFAULT_CORE_JAR = ROOT / ".work/dist/java/procedurals-core-0.1.0.jar"
DEFAULT_SDK = ROOT / ".work/toolchains/android/sdk"
DEFAULT_ADB_SERVER = "tcp:5038"
DEFAULT_SERIAL = "emulator-5580"
REMOTE = "/data/local/tmp/procedurals-cp2-numerics"
FIELDS = ("sample", "heading", "dx", "dy", "x", "y")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    path = path.resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def require_file(path: Path, label: str) -> Path:
    path = path.expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"{label} is missing: {path}")
    return path


def invoke(command: list[str], *, timeout: float, env: dict[str, str] | None = None,
           text: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=text,
                          timeout=timeout, env=env, check=False)


def require_success(result: subprocess.CompletedProcess, label: str) -> str:
    if result.returncode:
        stdout = result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", "replace")
        stderr = result.stderr if isinstance(result.stderr, str) else result.stderr.decode("utf-8", "replace")
        raise RuntimeError(f"{label} failed ({result.returncode}): {stdout}{stderr}")
    return result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", "replace")


def command_text(command: list[str], label: str, timeout: float) -> str:
    """Return both streams because Java's version banner is conventionally stderr."""
    result = invoke(command, timeout=timeout)
    require_success(result, label)
    stdout = result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", "replace")
    stderr = result.stderr if isinstance(result.stderr, str) else result.stderr.decode("utf-8", "replace")
    return (stdout + stderr).strip()


def adb_command(adb: Path, serial: str, *arguments: str) -> list[str]:
    return [str(adb), "-s", serial, *arguments]


def shell(adb: Path, serial: str, command: str, timeout: float) -> str:
    return require_success(invoke(adb_command(adb, serial, "shell", command), timeout=timeout), "adb shell")


def bits_to_float(bits: str) -> float:
    return struct.unpack(">d", bytes.fromhex(bits))[0]


def parse_records(text: str, count: int, label: str) -> list[dict[str, str]]:
    lines = text.splitlines()
    if len(lines) != count:
        raise RuntimeError(f"{label}: expected {count} records, got {len(lines)}: {text[:800]}")
    records = []
    for expected, line in enumerate(lines):
        pieces = line.split("\t")
        if len(pieces) != 7 or any(len(value) != 16 for value in pieces[1:]):
            raise RuntimeError(f"{label}: malformed record at {expected}: {line[:160]}")
        if int(pieces[0]) != expected:
            raise RuntimeError(f"{label}: expected index {expected}, got {pieces[0]}")
        records.append(dict(zip(FIELDS, pieces[1:])))
    return records


def validate_matrix(value: object) -> dict:
    if not isinstance(value, dict):
        raise RuntimeError("matrix must be an object")
    for section, names in (("field_matrix", ("seeds", "starts", "coordinate_scales", "angle_bases", "angle_scales", "steps", "counts")),
                           ("constant_controls", ("starts", "headings", "steps", "counts"))):
        data = value.get(section)
        if not isinstance(data, dict) or any(not isinstance(data.get(name), list) or not data[name] for name in names):
            raise RuntimeError(f"matrix {section} requires nonempty lists")
    if not isinstance(value.get("evaluation"), dict) or not isinstance(value["evaluation"].get("selected_indices"), list):
        raise RuntimeError("matrix requires evaluation.selected_indices")
    return value


def cases(matrix: dict):
    field = matrix["field_matrix"]
    ordinal = 0
    for seed in field["seeds"]:
        for start in field["starts"]:
            for coordinate_scale in field["coordinate_scales"]:
                for angle_base in field["angle_bases"]:
                    for angle_scale in field["angle_scales"]:
                        for step in field["steps"]:
                            for count in field["counts"]:
                                yield {"id": f"field-{ordinal:03d}", "mode": "field", "seed": seed, "start": start,
                                       "coordinate_scale": coordinate_scale, "angle_base": angle_base,
                                       "angle_scale": angle_scale, "step": step, "count": count}
                                ordinal += 1
    control = matrix["constant_controls"]
    for start in control["starts"]:
        for heading in control["headings"]:
            for step in control["steps"]:
                for count in control["counts"]:
                    yield {"id": f"constant-{ordinal:03d}", "mode": "constant", "start": start,
                           "heading": heading, "step": step, "count": count}
                    ordinal += 1


def runner_args(case: dict) -> list[str]:
    if case["mode"] == "field":
        return ["field", str(case["seed"]), repr(case["start"][0]), repr(case["start"][1]),
                repr(case["coordinate_scale"]), repr(case["angle_base"]), repr(case["angle_scale"]),
                repr(case["step"]), str(case["count"])]
    return ["constant", "0", repr(case["start"][0]), repr(case["start"][1]), "0.0", "0.0",
            repr(case["heading"]), repr(case["step"]), str(case["count"])]


def compare(case: dict, matrix: dict, host_command: list[str], android_command: list[str], timeout: float) -> dict:
    # One process runs at a time: capture Android ART first, then independently execute host Java.
    android_result = require_success(invoke(android_command, timeout=timeout), case["id"] + " ART")
    host_result = require_success(invoke(host_command, timeout=timeout), case["id"] + " host Java")
    android = parse_records(android_result, case["count"], case["id"] + " ART")
    host = parse_records(host_result, case["count"], case["id"] + " host Java")
    selected = {index for index in matrix["evaluation"]["selected_indices"] if index < case["count"]}
    summary = {"first_differing_step": None, "first_position_differing_step": None,
               "maximum_abs_component": 0.0, "maximum_distance": 0.0,
               "maximum_sample_abs": 0.0, "maximum_heading_abs": 0.0}
    selected_records = {"host_java": [], "android_art": []}
    for index, (expected, actual) in enumerate(zip(host, android)):
        if index in selected:
            selected_records["host_java"].append({"index": index, **expected})
            selected_records["android_art"].append({"index": index, **actual})
        if summary["first_differing_step"] is None and any(actual[key] != expected[key] for key in FIELDS):
            summary["first_differing_step"] = index
        if summary["first_position_differing_step"] is None and (actual["x"] != expected["x"] or actual["y"] != expected["y"]):
            summary["first_position_differing_step"] = index
        dx = abs(bits_to_float(actual["x"]) - bits_to_float(expected["x"]))
        dy = abs(bits_to_float(actual["y"]) - bits_to_float(expected["y"]))
        summary["maximum_abs_component"] = max(summary["maximum_abs_component"], dx, dy)
        summary["maximum_distance"] = max(summary["maximum_distance"], math.hypot(dx, dy))
        summary["maximum_sample_abs"] = max(summary["maximum_sample_abs"], abs(bits_to_float(actual["sample"]) - bits_to_float(expected["sample"])))
        summary["maximum_heading_abs"] = max(summary["maximum_heading_abs"], abs(bits_to_float(actual["heading"]) - bits_to_float(expected["heading"])))
    return {"case": case, "comparison_to_host_java": summary, "selected_records_bits": selected_records}


def properties(adb: Path, serial: str, timeout: float) -> dict[str, str]:
    names = ["ro.build.version.sdk", "ro.build.version.release", "ro.build.fingerprint", "ro.build.id",
             "ro.product.cpu.abi", "ro.build.version.incremental", "dalvik.vm.version", "ro.art.version"]
    return {name: shell(adb, serial, "getprop " + name, timeout).strip() for name in names}


def remote_sha256(adb: Path, serial: str, path: str, timeout: float) -> str:
    output = shell(adb, serial, "sha256sum " + shlex.quote(path), timeout).strip().split()
    if not output or len(output[0]) != 64 or any(char not in "0123456789abcdef" for char in output[0].lower()):
        raise RuntimeError(f"remote sha256sum did not return a digest for {path}")
    return output[0].lower()


def core_distribution_binding(core_jar: Path) -> dict[str, object]:
    """Bind the consumed JAR to the durable core-build evidence and source it names."""
    evidence = json.loads(require_file(JAVA_DISTRIBUTION_EVIDENCE, "Java distribution evidence").read_text())
    artifact = evidence.get("artifacts", {}).get("core_jar", {})
    source_hash = evidence.get("input_sha256", {}).get("packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java")
    current_source = ROOT / "packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java"
    actual_jar = digest(core_jar)
    if evidence.get("status") != "passed" or artifact.get("sha256") != actual_jar:
        raise RuntimeError("core JAR does not match passed Java distribution evidence")
    if not isinstance(source_hash, str) or source_hash != digest(require_file(current_source, "GradientNoise2D01 source")):
        raise RuntimeError("GradientNoise2D01 source does not match the core JAR distribution binding")
    return {"path": relative(JAVA_DISTRIBUTION_EVIDENCE), "sha256": digest(JAVA_DISTRIBUTION_EVIDENCE),
            "core_jar_sha256": actual_jar, "gradient_noise_source": relative(current_source),
            "gradient_noise_source_sha256": source_hash}


def cleanup_remote(adb: Path, serial: str, timeout: float) -> None:
    # This directory is created and owned exclusively by this diagnostic.
    for name in ("classes.dex",):
        require_success(invoke(adb_command(adb, serial, "shell", "rm", REMOTE + "/" + name), timeout=timeout), "remote dex cleanup")
    require_success(invoke(adb_command(adb, serial, "shell", "rmdir", REMOTE), timeout=timeout), "remote directory cleanup")
    require_success(invoke(adb_command(adb, serial, "shell", "test", "!", "-d", REMOTE), timeout=timeout), "remote cleanup verification")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--core-jar", type=Path, default=DEFAULT_CORE_JAR)
    parser.add_argument("--sdk", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--serial", default=DEFAULT_SERIAL)
    parser.add_argument("--adb-server", default=DEFAULT_ADB_SERVER)
    parser.add_argument("--timeout-seconds", type=float, default=60.0)
    args = parser.parse_args()
    if not math.isfinite(args.timeout_seconds) or args.timeout_seconds <= 0 or args.timeout_seconds > 60:
        raise ValueError("--timeout-seconds must be finite, positive, and at most 60")
    java_home = args.java_home.expanduser().resolve()
    javac = require_file(java_home / "bin/javac", "javac")
    java = require_file(java_home / "bin/java", "java")
    core_jar = require_file(args.core_jar, "core JAR")
    distribution_binding = core_distribution_binding(core_jar)
    sdk = args.sdk.expanduser().resolve()
    d8 = require_file(sdk / "build-tools/30.0.3/d8", "d8")
    adb = require_file(sdk / "platform-tools/adb", "adb")
    matrix_path = HERE / "matrix.json"
    matrix = validate_matrix(json.loads(matrix_path.read_text()))
    environment = {**os.environ, "ADB_SERVER_SOCKET": args.adb_server}
    # app_process/d8 commands use an explicit ADB server; do not start or restart an AVD.
    old_environment = os.environ.get("ADB_SERVER_SOCKET")
    os.environ["ADB_SERVER_SOCKET"] = args.adb_server
    remote_created = False
    try:
        state = require_success(invoke(adb_command(adb, args.serial, "get-state"), timeout=args.timeout_seconds), "adb get-state").strip()
        if state != "device":
            raise RuntimeError("existing emulator is not ready: " + state)
        if shell(adb, args.serial, "getprop sys.boot_completed", args.timeout_seconds).strip() != "1":
            raise RuntimeError("existing emulator has not completed boot")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        if RESULT.is_file():
            shutil.copy2(RESULT, OUTPUT / "result-before-remote-timeout.json")
        shutil.rmtree(CLASSES, ignore_errors=True)
        shutil.rmtree(DEX, ignore_errors=True)
        CLASSES.mkdir(); DEX.mkdir()
        subprocess.run([str(javac), "--release", "8", "-cp", str(core_jar), "-d", str(CLASSES), str(HERE / "Cp2Numerics.java")],
                       check=True, timeout=args.timeout_seconds)
        compiled_probe = CLASSES / "Cp2Numerics.class"
        if not compiled_probe.is_file():
            raise RuntimeError(f"javac did not produce {compiled_probe}")
        require_success(invoke([str(d8), "--min-api", "23", "--output", str(DEX), str(core_jar), str(compiled_probe)],
                               timeout=args.timeout_seconds), "d8")
        dex = require_file(DEX / "classes.dex", "d8 classes.dex")
        require_success(invoke(adb_command(adb, args.serial, "shell", "mkdir", "-p", REMOTE), timeout=args.timeout_seconds), "remote mkdir")
        remote_created = True
        require_success(invoke(adb_command(adb, args.serial, "push", str(dex), REMOTE + "/classes.dex"), timeout=args.timeout_seconds), "adb push")
        result = invoke(adb_command(adb, args.serial, "shell", "ls", "-l", REMOTE + "/classes.dex"), timeout=args.timeout_seconds)
        require_success(result, "remote dex inspection")
        remote_dex_sha256 = remote_sha256(adb, args.serial, REMOTE + "/classes.dex", args.timeout_seconds)
        if remote_dex_sha256 != digest(dex):
            raise RuntimeError("remote classes.dex sha256 does not match the local d8 output")
        output_cases = []
        remote_timeout_seconds = max(1, int(math.floor(args.timeout_seconds)) - 1)
        for case in cases(matrix):
            values = runner_args(case)
            art_command = shlex.join(["env", "CLASSPATH=" + REMOTE + "/classes.dex", "app_process", "/system/bin", "Cp2Numerics", *values])
            android_shell = shlex.join(["timeout", str(remote_timeout_seconds) + "s", "sh", "-c", art_command])
            output_cases.append(compare(case, matrix,
                                        [str(java), "-cp", os.pathsep.join((str(CLASSES), str(core_jar))), "Cp2Numerics", *values],
                                        adb_command(adb, args.serial, "exec-out", "sh", "-c", android_shell),
                                        args.timeout_seconds))
        cleanup_remote(adb, args.serial, args.timeout_seconds)
        remote_created = False
        reported_matrix = json.loads(json.dumps(matrix))
        prior_android_scope = reported_matrix.get("android")
        reported_matrix["android"] = "Measured here only as standalone ART through app_process; Android Processing integration remains unmeasured."
        report = {
            "status": "completed_diagnostic",
            "scope": "Observational standalone ART CP2 numeric probe versus host Java; no APK, UI, Processing renderer, lifecycle work, Android Processing example integration, or portable-conformance claim.",
            "matrix": reported_matrix,
            "matrix_metadata": {"input_sha256": digest(matrix_path),
                                "report_scope_override": {"field": "android", "prior_value": prior_android_scope,
                                                          "value": reported_matrix["android"]}},
            "device": {"serial": args.serial, "adb_server": args.adb_server, "properties": properties(adb, args.serial, args.timeout_seconds),
                       "app_process": shell(adb, args.serial, "command -v app_process", args.timeout_seconds).strip(),
                       "dalvikvm": shell(adb, args.serial, "command -v dalvikvm", args.timeout_seconds).strip(),
                       "app_process_sha256": remote_sha256(adb, args.serial, "/system/bin/app_process", args.timeout_seconds),
                       "libart_path": "/apex/com.android.art/lib64/libart.so",
                       "libart_sha256": remote_sha256(adb, args.serial, "/apex/com.android.art/lib64/libart.so", args.timeout_seconds)},
            "runtimes": {"host_java": command_text([str(java), "-version"], "host java version", args.timeout_seconds),
                         "d8": command_text([str(d8), "--version"], "d8 version", args.timeout_seconds)},
            "hashes": {"matrix": digest(matrix_path), "probe_java": digest(HERE / "Cp2Numerics.java"),
                       "host_runner": digest(HERE / "run.py"), "android_runner": digest(HERE / "run-android.py"),
                       "core_jar": digest(core_jar), "compiled_probe_class": digest(CLASSES / "Cp2Numerics.class"),
                       "dex": digest(dex), "d8": digest(d8),
                       "android_sdk_build_tools_properties": digest(require_file(sdk / "build-tools/30.0.3/source.properties", "build tools properties"))},
            "core_jar_binding": distribution_binding,
            "execution": {"per_case_timeout_seconds": args.timeout_seconds, "remote_art_timeout_seconds": remote_timeout_seconds,
                          "remote_directory": REMOTE,
                          "remote_artifacts": ["classes.dex"], "one_process_at_a_time": True,
                          "remote_dex_sha256": remote_dex_sha256,
                          "remote_cleanup_verified": True,
                          "full_records_compared_transiently": True, "selected_records_persisted": matrix["evaluation"]["selected_indices"]},
            "results": output_cases,
            "android_processing": "Unmeasured: standalone app_process ART execution does not exercise Processing Android integration."
        }
        text = json.dumps(report, indent=2) + "\n"
        RESULT.write_text(text)
        EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
        EVIDENCE.write_text(text)
        print(json.dumps({"status": report["status"], "cases": len(output_cases), "result": relative(RESULT), "evidence": relative(EVIDENCE)}))
    finally:
        if remote_created:
            cleanup_remote(adb, args.serial, args.timeout_seconds)
        if old_environment is None:
            os.environ.pop("ADB_SERVER_SOCKET", None)
        else:
            os.environ["ADB_SERVER_SOCKET"] = old_environment


if __name__ == "__main__":
    main()
