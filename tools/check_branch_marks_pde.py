#!/usr/bin/env python3
"""Preprocess and compile the actual BranchMarks PDE with pinned Processing; no render."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.run_grid_conformance import java_home, run


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def installed_library(library: Path | None, report: Path | None) -> tuple[Path | None, Path | None]:
    if (library is None) != (report is None):
        raise RuntimeError("--library-jar and --distribution-report must be supplied together")
    if library is None:
        return None, None
    jar, evidence = library.resolve(), report.resolve()
    jar.relative_to(ROOT)
    evidence.relative_to(ROOT)
    if not jar.is_file() or not evidence.is_file():
        raise RuntimeError("installed library JAR or distribution report is missing")
    payload = json.loads(evidence.read_text(encoding="utf-8"))
    if payload.get("status") != "passed":
        raise RuntimeError("distribution report is not passed")
    jar_hash = digest(jar)
    if payload.get("artifacts", {}).get("core", {}).get("sha256") != jar_hash:
        raise RuntimeError("distribution report does not bind supplied installed core JAR hash")
    before, after = payload.get("input_sha256_before"), payload.get("input_sha256_after")
    if not isinstance(before, dict) or not before or before != after:
        raise RuntimeError("distribution source bindings are incomplete")
    for name, expected in before.items():
        source = (ROOT / name).resolve()
        source.relative_to(ROOT)
        if not source.is_file() or digest(source) != expected:
            raise RuntimeError("distribution input is stale: " + name)
    return jar, evidence


def installed_examples(jar: Path | None, report: Path | None, root_pde: Path,
                       root_composition: Path) -> tuple[Path, Path]:
    if jar is None:
        return root_pde, root_composition
    example = jar.parent.parent / "examples" / "BranchMarks"
    pde, composition = example / "BranchMarks.pde", example / "BranchComposition.java"
    if not pde.is_file() or not composition.is_file():
        raise RuntimeError("installed library layout lacks editable BranchMarks tabs")
    payload = json.loads(report.read_text(encoding="utf-8"))
    before = payload["input_sha256_before"]
    entries = payload.get("artifacts", {}).get("starter", {}).get("entries")
    if not isinstance(entries, list):
        raise RuntimeError("distribution report lacks starter entries")
    entry_hashes = {entry.get("path"): entry.get("sha256") for entry in entries if isinstance(entry, dict)}
    checks = ((pde, root_pde, "procedurals/examples/BranchMarks/BranchMarks.pde"),
              (composition, root_composition, "procedurals/examples/BranchMarks/BranchComposition.java"))
    for extracted, root, archive_path in checks:
        expected = before.get(str(root.relative_to(ROOT)))
        if not isinstance(expected, str) or entry_hashes.get(archive_path) != expected:
            raise RuntimeError("distribution report does not bind " + archive_path + " to root source")
        if digest(root) != expected or digest(extracted) != expected:
            raise RuntimeError("installed tab differs from recorded/root source: " + archive_path)
    return pde, composition


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/build/branch-marks-pde/report.json")
    parser.add_argument("--library-jar", type=Path,
                        help="compile the hash-bound installed core JAR rather than checkout core sources")
    parser.add_argument("--distribution-report", type=Path,
                        help="passed distribution evidence that binds --library-jar")
    args = parser.parse_args()
    home = java_home(args.java_home)
    library_jar, distribution_report = installed_library(args.library_jar, args.distribution_report)
    runtime = ROOT / ".work/toolchains/processing-4.5.6"
    core = runtime / "core-4.5.6.jar"
    if not core.is_file() or digest(core) != CORE_SHA256:
        raise RuntimeError("unexpected Processing 4.5.6 core")
    libraries = [runtime / "preprocessor" / name for name in NAMES]
    if any(not library.is_file() for library in libraries):
        raise RuntimeError("missing pinned Processing preprocessor dependency")

    build = ROOT / (".work/build/branch-marks-pde-installed" if library_jar else ".work/build/branch-marks-pde")
    if library_jar and build.exists():
        shutil.rmtree(build)
    build.mkdir(parents=True, exist_ok=True)
    (build / "home").mkdir(exist_ok=True)
    root_pde = ROOT / "packages/java-processing/examples/BranchMarks/BranchMarks.pde"
    root_composition = ROOT / "packages/java/examples/BranchMarks/BranchComposition.java"
    pde, composition = installed_examples(library_jar, distribution_report, root_pde, root_composition)
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    sources = [composition] if library_jar else [*core_sources, composition]
    inputs = [*sources, pde, root_pde, root_composition, bridge, core, *libraries,
              ROOT / "tools/check_field_marks_pde.py", ROOT / "tools/check_processing_runtime.py",
              ROOT / "tools/run_grid_conformance.py", Path(__file__).resolve()]
    if library_jar:
        inputs += [library_jar, distribution_report]
    for item in inputs:
        if not item.is_file():
            raise FileNotFoundError("BranchMarks compile input missing: " + str(item))
    before = {str(item.relative_to(ROOT)): digest(item) for item in inputs}

    preprocess_classpath = os.pathsep.join(str(item) for item in [core, *libraries])
    run([home / "bin/javac", "-cp", preprocess_classpath, "-d", build, bridge])
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(key, None)
    generated = build / "BranchMarks.java"
    run([home / "bin/java", "-Duser.home=" + str(build / "home"), "-cp",
         str(build) + os.pathsep + preprocess_classpath,
         "PreprocessSketch", pde, generated, "BranchMarks"], env=environment)
    compile_classpath = os.pathsep.join(str(path) for path in ([core, library_jar] if library_jar else [core]))
    run([home / "bin/javac", "--release", "17", "-cp", compile_classpath, "-d", build,
         *sources, generated])
    after = {str(item.relative_to(ROOT)): digest(item) for item in inputs}
    if before != after:
        raise RuntimeError("BranchMarks sources changed during preprocessing/compilation")

    report = {
        "status": "passed",
        "scope": "Official Processing 4.5.6 BranchMarks PDE preprocessing and Java compilation only; no GUI lifecycle, renderer, image, or native support evidence was run.",
        "input_sha256_before": before,
        "input_sha256_after": after,
        "generated_java_sha256": digest(generated),
        "class_sha256": digest(build / "BranchMarks.class"),
        "runtime": run([home / "bin/java", "-version"]).stderr.strip(),
        "build": str(build.relative_to(ROOT)),
        "installed_library": (None if library_jar is None else {
            "path": str(library_jar.relative_to(ROOT)), "sha256": digest(library_jar),
            "distribution_report": str(distribution_report.relative_to(ROOT)),
            "distribution_report_sha256": digest(distribution_report),
        }),
    }
    output = args.output.resolve()
    output.relative_to(ROOT)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "report": str(output.relative_to(ROOT)), "scope": report["scope"]}))


if __name__ == "__main__":
    main()
