#!/usr/bin/env python3
"""Run the observational CP2 binary64 feedback diagnostic without rendering."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import select
import shutil
import struct
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / ".work/cp2-numerics"
CLASSES = OUTPUT / "classes"
RESULT = OUTPUT / "result.json"
EVIDENCE = ROOT / "evidence/investigations/cp2-numerics.json"
DEFAULT_JAVA_HOME = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
DEFAULT_CORE_JAR = ROOT / ".work/dist/java/procedurals-core-0.1.0.jar"
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


def decimal(bits: str) -> float:
    return struct.unpack(">d", bytes.fromhex(bits))[0]


def parse_record(line: bytes) -> tuple[int, dict[str, str]]:
    pieces = line.decode("ascii").rstrip("\n").split("\t")
    if len(pieces) != 7 or any(len(value) != 16 for value in pieces[1:]):
        raise RuntimeError("malformed diagnostic record: " + line[:160].decode("ascii", "replace"))
    return int(pieces[0]), dict(zip(FIELDS, pieces[1:]))


def output_of(command: list[str], timeout: float) -> str:
    return subprocess.check_output(command, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()


def validate_matrix(matrix: object) -> dict:
    if not isinstance(matrix, dict):
        raise RuntimeError("matrix must be an object")
    evaluation = matrix.get("evaluation")
    field = matrix.get("field_matrix")
    controls = matrix.get("constant_controls")
    if not isinstance(evaluation, dict) or not isinstance(field, dict) or not isinstance(controls, dict):
        raise RuntimeError("matrix requires evaluation, field_matrix, and constant_controls objects")
    for name in ("seeds", "starts", "coordinate_scales", "angle_bases", "angle_scales", "steps", "counts"):
        if not isinstance(field.get(name), list) or not field[name]:
            raise RuntimeError(f"field_matrix.{name} must be a nonempty list")
    for name in ("starts", "headings", "steps", "counts"):
        if not isinstance(controls.get(name), list) or not controls[name]:
            raise RuntimeError(f"constant_controls.{name} must be a nonempty list")
    selected = evaluation.get("selected_indices")
    if not isinstance(selected, list) or any(not isinstance(index, int) or index < 0 for index in selected):
        raise RuntimeError("evaluation.selected_indices must contain nonnegative integers")
    for start in [*field["starts"], *controls["starts"]]:
        if not isinstance(start, list) or len(start) != 2 or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in start):
            raise RuntimeError("each start must be two finite numbers")
    for count in [*field["counts"], *controls["counts"]]:
        if not isinstance(count, int) or count <= 0:
            raise RuntimeError("counts must be positive integers")
    return matrix


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
                                yield {"id": f"field-{ordinal:03d}", "mode": "field", "seed": seed,
                                       "start": start, "coordinate_scale": coordinate_scale,
                                       "angle_base": angle_base, "angle_scale": angle_scale,
                                       "step": step, "count": count}
                                ordinal += 1
    controls = matrix["constant_controls"]
    for start in controls["starts"]:
        for heading in controls["headings"]:
            for step in controls["steps"]:
                for count in controls["counts"]:
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


def commands(case: dict, java_home: Path, core_jar: Path) -> dict[str, list[str]]:
    values = runner_args(case)
    return {
        "java": [str(java_home / "bin/java"), "-cp", os.pathsep.join((str(CLASSES), str(core_jar))), "Cp2Numerics", *values],
        "javascript": ["node", str(HERE / "run-javascript.mjs"), *values],
        "python": [sys.executable, str(HERE / "run-python.py"), *values],
    }


def stop(processes: dict[str, subprocess.Popen], deadline: float, primary: bool) -> list[str]:
    if primary:
        for process in processes.values():
            if process.poll() is None:
                process.terminate()
    failures = []
    for name, process in processes.items():
        remaining = max(0.1, deadline - time.monotonic())
        try:
            _, stderr = process.communicate(timeout=remaining)
        except subprocess.TimeoutExpired:
            process.kill()
            _, stderr = process.communicate()
            failures.append(f"{name} exceeded timeout and was killed: {stderr.decode('utf-8', 'replace')}")
            continue
        if process.returncode:
            failures.append(f"{name} exited {process.returncode}: {stderr.decode('utf-8', 'replace')}")
    return failures


def read_one(process: subprocess.Popen, target: str, deadline: float) -> bytes:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError(f"{target} exceeded diagnostic timeout")
    ready, _, _ = select.select([process.stdout], [], [], remaining)
    if not ready:
        raise TimeoutError(f"{target} produced no record before timeout")
    line = process.stdout.readline()
    if not line:
        raise RuntimeError(f"{target} ended before its expected record")
    return line


def compare(case: dict, matrix: dict, java_home: Path, core_jar: Path, timeout: float) -> dict:
    deadline = time.monotonic() + timeout
    processes: dict[str, subprocess.Popen] = {}
    primary = True
    try:
        for name, command in commands(case, java_home, core_jar).items():
            processes[name] = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
        selected = {index for index in matrix["evaluation"]["selected_indices"] if index < case["count"]}
        captured = {name: [] for name in processes}
        summaries = {name: {"first_differing_step": None, "first_position_differing_step": None,
                            "maximum_abs_component": 0.0, "maximum_distance": 0.0,
                            "maximum_sample_abs": 0.0, "maximum_heading_abs": 0.0}
                     for name in processes if name != "java"}
        for expected in range(case["count"]):
            values = {}
            for name, process in processes.items():
                index, data = parse_record(read_one(process, name, deadline))
                if index != expected:
                    raise RuntimeError(f"{case['id']}: {name} emitted index {index}, expected {expected}")
                values[name] = data
            baseline = values["java"]
            for name, data in values.items():
                if expected in selected:
                    captured[name].append({"index": expected, **{key: data[key] for key in FIELDS}})
                if name == "java":
                    continue
                summary = summaries[name]
                if summary["first_differing_step"] is None and any(data[key] != baseline[key] for key in FIELDS):
                    summary["first_differing_step"] = expected
                if summary["first_position_differing_step"] is None and (data["x"] != baseline["x"] or data["y"] != baseline["y"]):
                    summary["first_position_differing_step"] = expected
                dx = abs(decimal(data["x"]) - decimal(baseline["x"]))
                dy = abs(decimal(data["y"]) - decimal(baseline["y"]))
                summary["maximum_abs_component"] = max(summary["maximum_abs_component"], dx, dy)
                summary["maximum_distance"] = max(summary["maximum_distance"], math.hypot(dx, dy))
                summary["maximum_sample_abs"] = max(summary["maximum_sample_abs"], abs(decimal(data["sample"]) - decimal(baseline["sample"])))
                summary["maximum_heading_abs"] = max(summary["maximum_heading_abs"], abs(decimal(data["heading"]) - decimal(baseline["heading"])))
        primary = False
    finally:
        failures = stop(processes, deadline, primary)
        if not primary and failures:
            raise RuntimeError("; ".join(failures))
    return {"case": case, "comparison_to_java": summaries, "selected_records_bits": captured}


def java_binding(core_jar: Path, java_source: Path) -> dict:
    evidence = ROOT / "evidence/distribution/java-artifacts.json"
    result = {"consumed_jar": relative(core_jar), "consumed_jar_sha256": digest(core_jar),
              "observed_source": relative(java_source), "observed_source_sha256": digest(java_source),
              "distribution_evidence": relative(evidence) if evidence.is_file() else None,
              "distribution_evidence_sha256": digest(evidence) if evidence.is_file() else None,
              "source_binding": "unverified"}
    if not evidence.is_file():
        return result
    try:
        report = json.loads(evidence.read_text())
        expected_jar = report["artifacts"]["core_jar"]["sha256"]
        expected_source = report["input_sha256"]["packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java"]
    except (KeyError, TypeError, json.JSONDecodeError):
        result["source_binding"] = "evidence_missing_required_binding"
        return result
    result["evidence_core_jar_sha256"] = expected_jar
    result["evidence_source_sha256"] = expected_source
    if result["consumed_jar_sha256"] == expected_jar and result["observed_source_sha256"] == expected_source:
        result["source_binding"] = "matched_distribution_evidence"
    else:
        result["source_binding"] = "mismatched_distribution_evidence"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--core-jar", type=Path, default=DEFAULT_CORE_JAR)
    parser.add_argument("--timeout-seconds", type=float, default=45.0)
    args = parser.parse_args()
    if not math.isfinite(args.timeout_seconds) or args.timeout_seconds <= 0:
        raise ValueError("--timeout-seconds must be finite and positive")
    java_home = args.java_home.expanduser().resolve()
    require_file(java_home / "bin/java", "java")
    javac = require_file(java_home / "bin/javac", "javac")
    core_jar = require_file(args.core_jar, "core JAR")
    matrix = validate_matrix(json.loads((HERE / "matrix.json").read_text()))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(CLASSES, ignore_errors=True)
    CLASSES.mkdir()
    subprocess.run([str(javac), "--release", "8", "-cp", str(core_jar), "-d", str(CLASSES), str(HERE / "Cp2Numerics.java")],
                   check=True, timeout=args.timeout_seconds)
    results = [compare(case, matrix, java_home, core_jar, args.timeout_seconds) for case in cases(matrix)]
    tool_inputs = [HERE / "matrix.json", HERE / "run.py", HERE / "run-javascript.mjs", HERE / "run-python.py", HERE / "Cp2Numerics.java"]
    javascript_imports = [ROOT / "packages/javascript/src/gradient-noise-2d-01.js", ROOT / "packages/javascript/src/internal/noise-hash.js"]
    python_imports = [ROOT / "packages/python/procedurals/__init__.py", ROOT / "packages/python/procedurals/fields.py",
                      ROOT / "packages/python/procedurals/layout.py", ROOT / "packages/python/procedurals/colors.py"]
    java_source = ROOT / "packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java"
    report = {
        "status": "completed_diagnostic",
        "scope": "Observational CP2 binary64 feedback diagnostic only; not a portable-conformance pass, contract tolerance, source reproduction, Android result, or native render.",
        "matrix": matrix,
        "runtimes": {"java": output_of([str(java_home / "bin/java"), "-version"], args.timeout_seconds),
                     "javascript": output_of(["node", "--version"], args.timeout_seconds),
                     "python": output_of([sys.executable, "--version"], args.timeout_seconds)},
        "execution": {"timeout_seconds_per_case": args.timeout_seconds, "streamed_records_not_persisted": True,
                      "selected_records_only": matrix["evaluation"]["selected_indices"]},
        "hashes": {"diagnostic_tools": {relative(path): digest(path) for path in tool_inputs},
                   "javascript_imports": {relative(path): digest(path) for path in javascript_imports},
                   "python_imports": {relative(path): digest(path) for path in python_imports},
                   "java_backend": java_binding(core_jar, java_source)},
        "results": results,
        "android": "Unmeasured by this Java/JavaScript/Python-only pure diagnostic."
    }
    text = json.dumps(report, indent=2) + "\n"
    temporary = RESULT.with_suffix(".tmp")
    temporary.write_text(text)
    temporary.replace(RESULT)
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(text)
    print(json.dumps({"status": report["status"], "cases": len(results), "result": relative(RESULT), "evidence": relative(EVIDENCE)}))


if __name__ == "__main__":
    main()
