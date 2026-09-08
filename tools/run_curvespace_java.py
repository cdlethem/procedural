#!/usr/bin/env python3
"""Compile and optionally run the bounded Curvespace P2D recreation probe."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.diagnostics.cp7.run_profiles import ARCHIVE_SHA256, JARS, KNOWN_STDERR
from tools.run_depth_marks_java import SHUTDOWN_STDERR, P3D_RUNTIME, check_runtime, RUNTIME

JDK_DEFAULT = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
IDS = ["baseline", "recolored", "regenerated", "reset"]
KEYS = "cr0s"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def validate_native(native: dict, output: Path, library: Path) -> dict:
    if native.get("status") != "passed" or native.get("frames") != len(IDS) or native.get("keys") != KEYS:
        raise RuntimeError("incomplete Curvespace native sequence")
    records = native.get("frame_records")
    if not isinstance(records, list) or [r.get("id") for r in records] != IDS:
        raise RuntimeError("unexpected Curvespace frame records")
    if native.get("core_code_source") != str(library) or native.get("expected_jar") != str(library):
        raise RuntimeError("Curvespace did not use the requested library JAR")
    if native.get("renderer") != "processing.opengl.PGraphics2D":
        raise RuntimeError("Curvespace renderer was not PGraphics2D")
    if native.get("density") != 1 or native.get("width") != 960 or native.get("height") != 960:
        raise RuntimeError("Curvespace dimensions or density mismatch")
    images = {}
    for name in [*IDS, "curvespace"]:
        path = output / (name + ".png")
        if not path.is_file():
            raise RuntimeError("missing Curvespace image: " + name)
        images[name] = {"path": rel(path), "sha256": sha(path)}
    return images


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=JDK_DEFAULT)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--native", action="store_true")
    args = parser.parse_args()
    jdk = args.java_home.resolve()
    output = args.output_dir.resolve()
    library = args.library.resolve()
    if not output.is_relative_to(ROOT / ".work") or output.exists():
        raise ValueError("Preserve attempts: require fresh output below .work")
    pde = ROOT / "examples/recreations/Curvespace/Curvespace.pde"
    tab = ROOT / "examples/recreations/Curvespace/CurvespaceComposition.java"
    probe = ROOT / "tests/native/CurvespaceProbe.java"
    walkthrough = ROOT / "design/capabilities/curvespace-recreation-walkthrough.md"
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    lease = ROOT / "tools/with_native_render_lock.py"
    runtime_inputs = check_runtime()
    jdk_inputs = [jdk / name for name in ("bin/java", "bin/javac", "release", "lib/modules")]
    helpers = [ROOT / "tools/check_field_marks_pde.py", ROOT / "tools/check_processing_runtime.py", ROOT / "tools/diagnostics/cp7/run_profiles.py", ROOT / "tools/run_depth_marks_java.py", lease]
    inputs = [pde, tab, probe, walkthrough, bridge, Path(__file__), library, *helpers, *runtime_inputs, *jdk_inputs]
    if any(not path.is_file() for path in inputs):
        missing = next(path for path in inputs if not path.is_file())
        raise RuntimeError("missing input: " + str(missing))
    before = {rel(path): sha(path) for path in inputs}
    output.mkdir(parents=True)
    classes, prep, home = output / "classes", output / "pre-classes", output / "home"
    for directory in (classes, prep, home):
        directory.mkdir()
    processing_core = RUNTIME / "core-4.5.6.jar"
    prepath = os.pathsep.join(map(str, [processing_core, *[RUNTIME / "preprocessor" / name for name in NAMES]]))
    compile_cp = os.pathsep.join(map(str, [processing_core, library]))
    environment = os.environ.copy()
    environment["LIBGL_ALWAYS_SOFTWARE"] = "1"
    for name in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(name, None)
    commands = []
    report = {"status": "failed", "scope": "Curvespace P2D recreation with adjacent composition tab; no workflow or acceptance claim", "input_sha256_before": before, "commands": commands}

    def invoke(command: list[object], timeout: int = 120) -> subprocess.CompletedProcess[str]:
        result = subprocess.run([str(item) for item in command], cwd=ROOT, env=environment, text=True, capture_output=True, timeout=timeout)
        commands.append({"argv": [str(item) for item in command], "exit_code": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        if result.returncode:
            raise RuntimeError("command failed: " + result.stdout + result.stderr)
        return result

    try:
        generated = output / "Curvespace.java"
        invoke([jdk / "bin/javac", "--release", "17", "-cp", prepath, "-d", prep, bridge])
        invoke([jdk / "bin/java", "-Duser.home=" + str(home), "-cp", str(prep) + os.pathsep + prepath, "PreprocessSketch", pde, generated, "Curvespace"])
        invoke([jdk / "bin/javac", "--release", "8", "-cp", compile_cp, "-d", classes, generated, tab, probe])
        artifacts = [generated, *classes.rglob("*.class"), *prep.rglob("*.class")]
        artifact_before = {rel(path): sha(path) for path in artifacts}
        report["artifact_sha256_before"] = artifact_before
        report["runtime"] = invoke([jdk / "bin/java", "-version"]).stderr.strip()
        if args.native:
            native_out = output / "native"
            native_out.mkdir()
            result = invoke([sys.executable, lease, "--timeout", "120", "--", "xvfb-run", "-a", jdk / "bin/java", "-Duser.home=" + str(home), "-cp", os.pathsep.join(map(str, [classes, library, *[P3D_RUNTIME / name for name in JARS]])), "CurvespaceProbe", native_out, library], timeout=150)
            if result.stderr and not (KNOWN_STDERR.fullmatch(result.stderr) or SHUTDOWN_STDERR.fullmatch(result.stderr)):
                raise RuntimeError("unexpected native diagnostics")
            native_path = native_out / "native.json"
            if not native_path.is_file():
                raise RuntimeError("Curvespace native process produced no native.json")
            native = json.loads(native_path.read_text())
            report["native"] = native
            report["images"] = validate_native(native, native_out, library)
        after = {rel(path): sha(path) for path in inputs}
        artifact_after = {rel(path): sha(path) for path in artifacts}
        if before != after or artifact_before != artifact_after:
            raise RuntimeError("input or executable artifact changed during validation")
        report.update(status="passed", input_sha256_after=after, artifact_sha256_after=artifact_after)
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "native": args.native, "output": rel(output)}))


if __name__ == "__main__":
    main()
