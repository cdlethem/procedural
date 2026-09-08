#!/usr/bin/env python3
"""Compile the current Java core and run the bounded AnnularMarks P3D probe."""
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

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.diagnostics.cp7.run_profiles import ARCHIVE_SHA256, JARS, KNOWN_STDERR

RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"
P3D_RUNTIME = ROOT / ".work/toolchains/cp7-processing-4.5.6/resources/core/library"
JDK_DEFAULT = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
IDS = ["baseline", "wide", "width-restored", "deep", "depth-restored", "facets", "facets-restored", "recolored", "colors-restored", "arrangement", "reset"]
KEYS = "wwddffccm0s"

# Root-reviewed successful CP18 exit diagnostic: the established X11 shutdown block
# can occur without the two EGL/DRI3 warnings. No other diagnostic text is accepted.
SHUTDOWN_STDERR = re.compile(
    r"\AX11Util\.Display: Shutdown \(JVM shutdown: true, open \(no close attempt\): 3/3, "
    r"reusable \(open, marked uncloseable\): 0, pending \(open in creation order\): 3\)\n"
    r"X11Util: Open X11 Display Connections: 3\n"
    r"X11Util: Open\[0\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n"
    r"X11Util: Open\[1\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n"
    r"X11Util: Open\[2\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n\Z"
)


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
    for name, expected in JARS.items():
        path = P3D_RUNTIME / name
        if not path.is_file() or sha(path) != expected:
            raise RuntimeError("Pinned P3D dependency mismatch: " + label(path))
        paths.append(path)
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
        raise RuntimeError("Incomplete AnnularMarks native sequence")
    records = native.get("frame_records")
    if not isinstance(records, list) or [item.get("id") for item in records] != IDS:
        raise RuntimeError("Unexpected AnnularMarks frame records")
    if native.get("core_code_source") != str(jar) or native.get("expected_jar") != str(jar):
        raise RuntimeError("AnnularMarks did not use the source-built core JAR")
    if native.get("renderer") != "processing.opengl.PGraphics3D":
        raise RuntimeError("AnnularMarks renderer was not PGraphics3D")
    if any(native.get(key) != value for key, value in (("width", 640), ("height", 640), ("density", 1))):
        raise RuntimeError("AnnularMarks dimensions or density mismatch")
    names = [*IDS, "annular-marks"]
    images = {}
    for name in names:
        path = output / (name + ".png")
        if not path.is_file():
            raise RuntimeError("Missing AnnularMarks image: " + name)
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
    pde = ROOT / "packages/java-processing/examples/AnnularMarks/AnnularMarks.pde"
    probe = ROOT / "tests/native/AnnularMarksProbe.java"
    plan = ROOT / "design/capabilities/annular-marks-native-plan.md"
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    lease = ROOT / "tools/with_native_render_lock.py"
    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    runtime_inputs = check_runtime()
    jdk_inputs = [jdk / name for name in ("bin/java", "bin/javac", "bin/jar", "release", "lib/modules")]
    inputs = [pde, probe, plan, bridge, lease, Path(__file__), ROOT / "tools/check_field_marks_pde.py",
              ROOT / "tools/check_processing_runtime.py", ROOT / "tools/diagnostics/cp7/run_profiles.py",
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
    report = {"status": "failed", "scope": "Candidate source-built core/JAR and actual AnnularMarks P3D lifecycle; no distribution acceptance", "commands": commands, "input_sha256_before": before}

    def invoke(command: list[object], timeout: int = 120) -> subprocess.CompletedProcess[str]:
        result = run(command, environment=environment, timeout=timeout)
        commands.append({"argv": [str(item) for item in command], "exit_code": result.returncode,
                         "stdout": result.stdout, "stderr": result.stderr})
        return result

    try:
        java, javac, jar = jdk / "bin/java", jdk / "bin/javac", jdk / "bin/jar"
        candidate_jar, generated = output / "procedurals-core-candidate.jar", output / "AnnularMarks.java"
        result = invoke([javac, "--release", "8", "-d", core_classes, *core_sources])
        if result.returncode:
            raise RuntimeError("Core compilation failed")
        result = invoke([jar, "cf", candidate_jar, "-C", core_classes, "org"])
        if result.returncode:
            raise RuntimeError("Core JAR creation failed")
        processing_jars = [P3D_RUNTIME / name for name in JARS]
        prepath = os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", *[RUNTIME / "preprocessor" / name for name in NAMES]]))
        result = invoke([javac, "-cp", prepath, "-d", prep, bridge])
        if result.returncode:
            raise RuntimeError("Preprocessor bridge compilation failed")
        result = invoke([java, "-Duser.home=" + str(home), "-cp", str(prep) + os.pathsep + prepath,
                         "PreprocessSketch", pde, generated, "AnnularMarks"])
        if result.returncode:
            raise RuntimeError("PDE preprocessing failed")
        result = invoke([javac, "--release", "8", "-cp", os.pathsep.join(map(str, [RUNTIME / "core-4.5.6.jar", candidate_jar])),
                         "-d", classes, generated, probe])
        if result.returncode:
            raise RuntimeError("AnnularMarks/probe compilation failed")
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
                       "AnnularMarksProbe", native_out, candidate_jar]
            result = invoke(command, timeout=150)
            if result.returncode:
                raise RuntimeError("AnnularMarks native process failed")
            if result.stderr and not (KNOWN_STDERR.fullmatch(result.stderr) or SHUTDOWN_STDERR.fullmatch(result.stderr)):
                raise RuntimeError("Unexpected native stderr diagnostics: " + result.stderr)
            native_path = native_out / "native.json"
            if not native_path.is_file():
                raise RuntimeError("AnnularMarks native process produced no native.json")
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
