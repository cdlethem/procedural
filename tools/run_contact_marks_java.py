#!/usr/bin/env python3
"""Compile candidate ContactMarks and optionally run its bounded JAVA2D lifecycle probe."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import zipfile
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools/diagnostics/clipping"))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.diagnostics.cp7.run_profiles import ARCHIVE_SHA256
from closed_contact_study import nearest

RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"
JDK_DEFAULT = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
IDS = ["baseline", "shifted", "restored", "recolored", "reset"]
KEYS = "nnc0s"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def label(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def run(command: list[object], environment: dict[str, str], timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(item) for item in command], cwd=ROOT, env=environment,
                          text=True, capture_output=True, timeout=timeout)


def check_runtime() -> list[Path]:
    archive = RUNTIME / "processing-4.5.6-linux-x64-portable.zip"
    if sha(archive) != ARCHIVE_SHA256:
        raise RuntimeError("Pinned Processing archive mismatch")
    core = RUNTIME / "core-4.5.6.jar"
    if sha(core) != CORE_SHA256:
        raise RuntimeError("Pinned Processing core mismatch")
    paths = [archive, core]
    with zipfile.ZipFile(archive) as source:
        for name in NAMES:
            path = RUNTIME / "preprocessor" / name
            if path.read_bytes() != source.read("Processing/lib/app/resources/modes/java/mode/" + name):
                raise RuntimeError("Pinned preprocessor mismatch: " + name)
            paths.append(path)
    return paths


def bits(value: float) -> bytes:
    return struct.pack(">d", value)


def rounded(value) -> float:
    result = float(value)
    return result if result else 0.0


def validate_record(record: dict) -> None:
    queries, obstacles, exported = record.get("queries"), record.get("obstacles"), record.get("hits")
    if not isinstance(queries, list) or not isinstance(obstacles, list) or not isinstance(exported, dict):
        raise RuntimeError("Malformed native exact-data record: " + str(record.get("id")))
    hits = exported.get("hits")
    if set(exported) != {"hits"} or not isinstance(hits, list) or len(hits) != len(queries):
        raise RuntimeError("Malformed native hit export: " + str(record.get("id")))
    for index, query in enumerate(queries):
        if not isinstance(query, list) or len(query) != 4:
            raise RuntimeError("Malformed native query")
        exact = nearest(query, obstacles)
        actual = hits[index]
        if exact is None:
            if actual is not None:
                raise RuntimeError("Native miss differs from exact oracle")
            continue
        parameter, obstacle_index, _ = exact
        if not isinstance(actual, dict) or set(actual) != {"obstacleIndex", "t", "point"}:
            raise RuntimeError("Malformed native contact export")
        if actual["obstacleIndex"] != obstacle_index or not isinstance(actual["point"], list) or len(actual["point"]) != 2:
            raise RuntimeError("Native selected wrong contact")
        if parameter == 0:
            expected = [rounded(query[0]), rounded(query[1])]
        elif parameter == 1:
            expected = [rounded(query[2]), rounded(query[3])]
        else:
            exact_query = [Fraction(value) for value in query]
            expected = [rounded(parameter),
                        rounded(exact_query[0] + parameter * (exact_query[2] - exact_query[0])),
                        rounded(exact_query[1] + parameter * (exact_query[3] - exact_query[1]))]
        actual_values = [actual["t"], actual["point"][0], actual["point"][1]]
        if len(expected) == 2:
            expected = [rounded(parameter), *expected]
        if any(bits(float(got)) != bits(want) for got, want in zip(actual_values, expected)):
            raise RuntimeError("Native rounding differs from exact oracle")


def validate_native(native: dict, output: Path, jar: Path) -> dict:
    if native.get("status") != "passed" or native.get("frames") != len(IDS) or native.get("keys") != KEYS:
        raise RuntimeError("Incomplete ContactMarks native sequence")
    records = native.get("frame_records")
    if not isinstance(records, list) or [record.get("id") for record in records] != IDS:
        raise RuntimeError("Unexpected ContactMarks frame records")
    if native.get("core_code_source") != str(jar) or native.get("expected_jar") != str(jar):
        raise RuntimeError("ContactMarks did not use the source-built core JAR")
    if native.get("renderer") != "processing.awt.PGraphicsJava2D":
        raise RuntimeError("ContactMarks renderer was not PGraphicsJava2D")
    if any(native.get(key) != value for key, value in (("width", 640), ("height", 640), ("density", 1))):
        raise RuntimeError("ContactMarks dimensions or density mismatch")
    for record in records:
        validate_record(record)
    images = {}
    for name in [*IDS, "contact-marks"]:
        path = output / (name + ".png")
        if not path.is_file():
            raise RuntimeError("Missing ContactMarks image: " + name)
        images[name] = {"path": label(path), "sha256": sha(path)}
    return images


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=JDK_DEFAULT)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--native", action="store_true")
    args = parser.parse_args()
    jdk, output = args.java_home.resolve(), args.output_dir.resolve()
    if not output.is_relative_to(ROOT / ".work") or output.exists():
        raise ValueError("Preserve attempts: require fresh output below .work")
    pde = ROOT / "packages/java-processing/examples/ContactMarks/ContactMarks.pde"
    probe = ROOT / "tests/native/ContactMarksProbe.java"
    plan = ROOT / "design/capabilities/contact-marks-native-plan.md"
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    adapter = ROOT / "packages/java-processing/src/main/java/org/procedurals/processing/Java2DLayers.java"
    lease = ROOT / "tools/with_native_render_lock.py"
    oracle = ROOT / "tools/diagnostics/clipping/closed_contact_study.py"
    oracle_dependency = ROOT / "tools/diagnostics/clipping/nearest_hit_study.py"
    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    runtime_inputs = check_runtime()
    jdk_inputs = [jdk / name for name in ("bin/java", "bin/javac", "bin/jar", "release", "lib/modules")]
    inputs = [pde, probe, plan, bridge, adapter, lease, oracle, oracle_dependency, Path(__file__),
              ROOT / "tools/check_field_marks_pde.py", ROOT / "tools/check_processing_runtime.py",
              ROOT / "tools/diagnostics/cp7/run_profiles.py", *core_sources, *runtime_inputs, *jdk_inputs]
    before = {label(path): sha(path) for path in inputs}
    output.mkdir(parents=True)
    core_classes, classes, prep, home = [output / name for name in ("core-classes", "classes", "pre-classes", "home")]
    for directory in (core_classes, classes, prep, home):
        directory.mkdir()
    environment = os.environ.copy()
    environment["LIBGL_ALWAYS_SOFTWARE"] = "1"
    for name in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(name, None)
    commands = []
    report = {"status": "failed", "scope": "Candidate source-built core/JAR and actual ContactMarks JAVA2D lifecycle; no distribution acceptance", "commands": commands, "input_sha256_before": before}

    def invoke(command: list[object], timeout: int = 120) -> subprocess.CompletedProcess[str]:
        result = run(command, environment, timeout)
        commands.append({"argv": [str(item) for item in command], "exit_code": result.returncode,
                         "stdout": result.stdout, "stderr": result.stderr})
        return result

    try:
        java, javac, jar = jdk / "bin/java", jdk / "bin/javac", jdk / "bin/jar"
        candidate_jar, generated = output / "procedurals-core-candidate.jar", output / "ContactMarks.java"
        if invoke([javac, "--release", "8", "-d", core_classes, *core_sources]).returncode:
            raise RuntimeError("Core compilation failed")
        if invoke([jar, "cf", candidate_jar, "-C", core_classes, "org"]).returncode:
            raise RuntimeError("Core JAR creation failed")
        prepath = os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", *[RUNTIME / "preprocessor" / name for name in NAMES]]))
        if invoke([javac, "-cp", prepath, "-d", prep, bridge]).returncode:
            raise RuntimeError("Preprocessor bridge compilation failed")
        if invoke([java, "-Duser.home=" + str(home), "-cp", str(prep) + os.pathsep + prepath,
                   "PreprocessSketch", pde, generated, "ContactMarks"]).returncode:
            raise RuntimeError("PDE preprocessing failed")
        if invoke([javac, "--release", "8", "-cp", os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", candidate_jar])),
                   "-d", classes, adapter, generated, probe]).returncode:
            raise RuntimeError("ContactMarks/probe compilation failed")
        artifacts = [candidate_jar, generated, *classes.rglob("*.class"), *core_classes.rglob("*.class"), *prep.rglob("*.class")]
        artifact_before = {label(path): sha(path) for path in artifacts}
        report["artifact_sha256_before"] = artifact_before
        runtime = invoke([java, "-version"])
        report["runtime"] = runtime.stderr.strip()
        if runtime.returncode:
            raise RuntimeError("Java runtime probe failed")
        if args.native:
            native_out = output / "native"
            native_out.mkdir()
            command = [sys.executable, lease, "--timeout", "120", "--", "xvfb-run", "-a", java,
                       "-Duser.home=" + str(home), "-cp", os.pathsep.join(map(str, [classes, candidate_jar, RUNTIME / "core-4.5.6.jar"])),
                       "ContactMarksProbe", native_out, candidate_jar]
            result = invoke(command, timeout=150)
            if result.returncode:
                raise RuntimeError("ContactMarks native process failed")
            if result.stderr:
                raise RuntimeError("Unexpected native stderr diagnostics: " + result.stderr)
            native_path = native_out / "native.json"
            if not native_path.is_file():
                raise RuntimeError("ContactMarks native process produced no native.json")
            native = json.loads(native_path.read_text(encoding="utf-8"))
            report["native"] = native
            report["images"] = validate_native(native, native_out, candidate_jar)
        after = {label(path): sha(path) for path in inputs}
        artifact_after = {label(path): sha(path) for path in artifacts}
        if before != after or artifact_before != artifact_after:
            raise RuntimeError("Input or executable artifact changed during validation")
        report.update(status="passed", input_sha256_after=after, artifact_sha256_after=artifact_after)
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "native": args.native, "output": label(output)}))


if __name__ == "__main__":
    main()
