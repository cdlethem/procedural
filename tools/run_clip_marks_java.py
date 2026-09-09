#!/usr/bin/env python3
"""Compile the current Java core and run the bounded ClipMarks JAVA2D probe."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile
import struct
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.diagnostics.clipping.exact_clip_study import clip as exact_clip
from tools.check_processing_runtime import CORE_SHA256
from tools.diagnostics.cp7.run_profiles import ARCHIVE_SHA256

RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"
JDK_DEFAULT = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
IDS = ["baseline", "sparse", "spacing-restored", "shallow-notch", "notch-restored", "supplied-strokes", "recolored", "endpoints-hidden", "overlay", "reset"]
KEYS = "hhnntcmo0s"



def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def label(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def run(command: list[object], cwd: Path = ROOT, environment: dict[str, str] | None = None,
        timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(item) for item in command], cwd=cwd, env=environment,
                          text=True, capture_output=True, timeout=timeout)


def check_runtime() -> list[Path]:
    archive = RUNTIME / "processing-4.5.6-linux-x64-portable.zip"
    if sha(archive) != ARCHIVE_SHA256:
        raise RuntimeError("Pinned Processing archive mismatch")
    core = RUNTIME / "core-4.5.6.jar"
    if sha(core) != CORE_SHA256:
        raise RuntimeError("Pinned Processing core mismatch")
    paths = [archive, core]
    for name in NAMES:
        path = RUNTIME / "preprocessor" / name
        with zipfile.ZipFile(archive) as source:
            expected = source.read("Processing/lib/app/resources/modes/java/mode/" + name)
        if path.read_bytes() != expected:
            raise RuntimeError("Pinned preprocessor mismatch: " + name)
        paths.append(path)
    return paths


def validate_native(native: dict, output: Path, jar: Path) -> dict:
    if native.get("status") != "passed" or native.get("frames") != len(IDS) or native.get("keys") != KEYS:
        raise RuntimeError("Incomplete ClipMarks native sequence")
    records = native.get("frame_records")
    if not isinstance(records, list) or [item.get("id") for item in records] != IDS:
        raise RuntimeError("Unexpected ClipMarks frame records")
    if native.get("core_code_source") != str(jar) or native.get("expected_jar") != str(jar):
        raise RuntimeError("ClipMarks did not use the source-built core JAR")
    if native.get("renderer") != "processing.awt.PGraphicsJava2D":
        raise RuntimeError("ClipMarks renderer was not PGraphicsJava2D")
    if any(native.get(key) != value for key, value in (("width", 640), ("height", 640), ("density", 1))):
        raise RuntimeError("ClipMarks dimensions or density mismatch")
    for record in records:
        digest = hashlib.sha256()
        for index, raw in enumerate(record["sources"]):
            a = [Fraction(value) for value in raw[:2]]
            delta = [Fraction(raw[i+2])-a[i] for i in (0,1)]
            for lo, hi in exact_clip(record["polygon"], [raw[:2], raw[2:]]):
                values = [float(a[i]+delta[i]*t) for t in (lo,hi) for i in (0,1)]
                values += [float(lo), float(hi)]
                for value in values:
                    digest.update(struct.pack(">d", value if value else 0.0))
                digest.update(struct.pack(">Q", index))
        if digest.hexdigest() != record["geometry_sha256"]:
            raise RuntimeError("Native geometry differs from exact oracle: " + record["id"])
    names = [*IDS, "clip-marks"]
    images = {}
    for name in names:
        path = output / (name + ".png")
        if not path.is_file():
            raise RuntimeError("Missing ClipMarks image: " + name)
        images[name] = {"path": label(path), "sha256": sha(path)}
    return images


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=JDK_DEFAULT)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--native", action="store_true")
    args = parser.parse_args()
    jdk = args.java_home.resolve()
    output = args.output_dir.resolve()
    if not output.is_relative_to(ROOT / ".work") or output.exists():
        raise ValueError("Preserve attempts: require fresh output below .work")
    pde = ROOT / "packages/java-processing/examples/ClipMarks/ClipMarks.pde"
    probe = ROOT / "tests/native/ClipMarksProbe.java"
    plan = ROOT / "design/capabilities/clip-marks-native-plan.md"
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    lease = ROOT / "tools/with_native_render_lock.py"
    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    adapter = ROOT / "packages/java-processing/src/main/java/org/procedurals/processing/Java2DLayers.java"
    runtime_inputs = check_runtime()
    jdk_inputs = [jdk / name for name in ("bin/java", "bin/javac", "bin/jar", "release", "lib/modules")]
    inputs = [pde, probe, plan, bridge, lease, adapter, Path(__file__), ROOT / "tools/check_field_marks_pde.py",
              ROOT / "tools/check_processing_runtime.py", ROOT / "tools/diagnostics/cp7/run_profiles.py",
              ROOT / "tools/diagnostics/clipping/exact_clip_study.py",
              *core_sources, *runtime_inputs, *jdk_inputs]
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
    report = {"status": "failed", "scope": "Candidate source-built core/JAR and actual ClipMarks JAVA2D lifecycle; no distribution acceptance", "commands": commands, "input_sha256_before": before}

    def invoke(command: list[object], timeout: int = 120) -> subprocess.CompletedProcess[str]:
        result = run(command, environment=environment, timeout=timeout)
        commands.append({"argv": [str(item) for item in command], "exit_code": result.returncode,
                         "stdout": result.stdout, "stderr": result.stderr})
        return result

    try:
        java, javac, jar = jdk / "bin/java", jdk / "bin/javac", jdk / "bin/jar"
        candidate_jar, generated = output / "procedurals-core-candidate.jar", output / "ClipMarks.java"
        result = invoke([javac, "--release", "8", "-d", core_classes, *core_sources])
        if result.returncode:
            raise RuntimeError("Core compilation failed")
        result = invoke([jar, "cf", candidate_jar, "-C", core_classes, "org"])
        if result.returncode:
            raise RuntimeError("Core JAR creation failed")
        processing_jars = [RUNTIME / "core-4.5.6.jar"]
        prepath = os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", *[RUNTIME / "preprocessor" / name for name in NAMES]]))
        result = invoke([javac, "-cp", prepath, "-d", prep, bridge])
        if result.returncode:
            raise RuntimeError("Preprocessor bridge compilation failed")
        result = invoke([java, "-Duser.home=" + str(home), "-cp", str(prep) + os.pathsep + prepath,
                         "PreprocessSketch", pde, generated, "ClipMarks"])
        if result.returncode:
            raise RuntimeError("PDE preprocessing failed")
        result = invoke([javac, "--release", "8", "-cp", os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", candidate_jar])),
                         "-d", classes, adapter, generated, probe])
        if result.returncode:
            raise RuntimeError("ClipMarks/probe compilation failed")
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
                       "-Duser.home=" + str(home), "-cp", os.pathsep.join(map(str, [classes, candidate_jar, *processing_jars])),
                       "ClipMarksProbe", native_out, candidate_jar]
            result = invoke(command, timeout=150)
            if result.returncode:
                raise RuntimeError("ClipMarks native process failed")
            if result.stderr:
                raise RuntimeError("Unexpected native stderr diagnostics: " + result.stderr)
            native_path = native_out / "native.json"
            if not native_path.is_file():
                raise RuntimeError("ClipMarks native process produced no native.json")
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
