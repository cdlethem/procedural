#!/usr/bin/env python3
"""Prepare the Java circle-placement core for Android dexing.

This tool performs a desktop vector preflight and produces an API 33 dex file.
It does not install, launch, or render anything.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from run_circle_placement_java import ROOT, sha, vector_source

ORDERED = ROOT / "catalog/operations/ordered-circle-filter.json"
SEEDED = ROOT / "catalog/operations/seeded-circle-placement.json"
ORDERED_FIXTURE = ROOT / "fixtures/operations/ordered-circle-filter.json"
SEEDED_FIXTURE = ROOT / "fixtures/operations/seeded-circle-placement.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java"
VECTOR_TOOL = ROOT / "tools/run_circle_placement_java.py"
NATIVE = ROOT / "tests/native/CirclePlacementsNative.java"


def run(command: list[Path | str], *, cwd: Path = ROOT, timeout: int = 300,
        env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run([str(item) for item in command], cwd=cwd, text=True,
                              capture_output=True, check=True, timeout=timeout, env=env)
    except subprocess.CalledProcessError as error:
        raise RuntimeError("command failed: " + " ".join(str(item) for item in command)
                           + "\nstdout:\n" + error.stdout + "\nstderr:\n" + error.stderr) from error


def require_file(path: Path, label: str) -> Path:
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(label + " is missing: " + str(path))
    return path


def inside_root(path: Path) -> Path:
    path = path.resolve()
    try:
        path.relative_to(ROOT.resolve())
    except ValueError as error:
        raise ValueError("output must stay inside the repository") from error
    return path


def java_home(value: str) -> Path:
    home = require_file(Path(value) / "bin/java", "Java runtime")
    require_file(home.parent / "javac", "Java compiler")
    return home.parent.parent


def d8_path(sdk: Path) -> Path:
    candidates = sorted(sdk.glob("build-tools/*/d8"))
    if not candidates:
        candidates = sorted(sdk.glob("cmdline-tools/*/bin/d8"))
    if not candidates:
        raise FileNotFoundError("Android SDK d8 is missing under " + str(sdk))
    return require_file(candidates[-1], "Android d8")


def file_hashes(paths: list[tuple[str, Path]]) -> dict[str, str]:
    return {name: sha(path) for name, path in paths}


def tree_hashes(root: Path) -> dict[str, str]:
    return {str(path.relative_to(root)): sha(path)
            for path in sorted(root.rglob("*")) if path.is_file()}


def android_access_source() -> str:
    """Derive only the Android-compatible ownership/access portion of the native probe."""
    source = NATIVE.read_text()
    marker = "    private static String benchmark("
    if source.count(marker) != 1:
        raise RuntimeError("CirclePlacementsNative benchmark marker is not unique")
    prefix = source[:source.index(marker)]
    for line in ("import com.sun.management.ThreadMXBean;\n",
                 "import java.lang.management.ManagementFactory;\n"):
        if prefix.count(line) != 1:
            raise RuntimeError("CirclePlacementsNative management import is not unique")
        prefix = prefix.replace(line, "", 1)
    declaration = "public final class CirclePlacementsNative"
    constructor = "private CirclePlacementsNative()"
    if prefix.count(declaration) != 1 or prefix.count(constructor) != 1:
        raise RuntimeError("CirclePlacementsNative declaration is not unique")
    prefix = prefix.replace(declaration, "public final class CirclePlacementsAndroidAccess", 1)
    prefix = prefix.replace(constructor, "private CirclePlacementsAndroidAccess()", 1)
    return prefix + '''    public static void main(String[] args) {
        ownershipAndAccess();
        System.out.println("{\\"status\\":\\"passed\\",\\"assertions\\":" + assertions + ",\\"native_ownership_access\\":true}");
    }
}
'''


def prepare(java: Path, sdk: Path, output: Path) -> dict[str, object]:
    output = inside_root(output)
    if output.exists() and any(output.iterdir()):
        raise FileExistsError("output must be a fresh directory: " + str(output))
    output.mkdir(parents=True, exist_ok=True)
    classes = output / "classes"
    dex = output / "classes.dex"
    classes.mkdir()
    android_jar = require_file(sdk / "platforms/android-33/android.jar", "Android API 33 android.jar")
    d8 = d8_path(sdk)
    d8_jar = require_file(d8.parent / "lib/d8.jar", "Android d8.jar")
    ordered = json.loads(ORDERED_FIXTURE.read_text())
    seeded = json.loads(SEEDED_FIXTURE.read_text())
    if ordered.get("catalog_sha256") != sha(ORDERED):
        raise RuntimeError("ordered circle fixture catalog binding is stale")
    if seeded.get("catalog_sha256") != sha(SEEDED):
        raise RuntimeError("seeded circle fixture catalog binding is stale")
    generated = output / "CirclePlacementsVectors.java"
    generated.write_text(vector_source(ordered, seeded))
    access = output / "CirclePlacementsAndroidAccess.java"
    access.write_text(android_access_source())
    inputs = file_hashes([
        ("catalog/operations/ordered-circle-filter.json", ORDERED),
        ("catalog/operations/seeded-circle-placement.json", SEEDED),
        ("fixtures/operations/ordered-circle-filter.json", ORDERED_FIXTURE),
        ("fixtures/operations/seeded-circle-placement.json", SEEDED_FIXTURE),
        ("packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java", CORE),
        ("tests/native/CirclePlacementsNative.java", NATIVE),
        ("tools/run_circle_placement_java.py", VECTOR_TOOL),
        ("tools/prepare_circle_placement_android_core.py", Path(__file__).resolve()),
    ])
    toolchain = file_hashes([
        ("java", java / "bin/java"),
        ("javac", java / "bin/javac"),
        ("android.jar", android_jar),
        ("d8", d8),
        ("d8.jar", d8_jar),
        ("java.release", java / "release"),
        ("java.modules", java / "lib/modules"),
    ])
    java_env = dict(os.environ, JAVA_HOME=str(java))
    run([java / "bin/javac", "--release", "8", "-d", classes, CORE, generated, access], timeout=300, env=java_env)
    vector_result = json.loads(run([java / "bin/java", "-cp", classes,
                                    "org.procedurals.sampling.CirclePlacementsVectors"], timeout=180, env=java_env).stdout)
    if vector_result.get("status") != "passed":
        raise RuntimeError("desktop circle-placement vector preflight failed")
    access_result = json.loads(run([java / "bin/java", "-cp", classes,
                                    "org.procedurals.sampling.CirclePlacementsAndroidAccess"], timeout=180, env=java_env).stdout)
    if access_result.get("native_ownership_access") is not True:
        raise RuntimeError("desktop Android-compatible ownership/access preflight failed")
    run([d8, "--min-api", "33", "--lib", android_jar, "--output", output, *sorted(classes.rglob("*.class"))], timeout=300, env=java_env)
    if not dex.is_file() or {path.name for path in output.glob("*.dex")} != {"classes.dex"}:
        raise RuntimeError("d8 did not produce exactly classes.dex")
    dex_files = {"classes.dex": sha(dex)}
    if inputs != file_hashes([
        ("catalog/operations/ordered-circle-filter.json", ORDERED),
        ("catalog/operations/seeded-circle-placement.json", SEEDED),
        ("fixtures/operations/ordered-circle-filter.json", ORDERED_FIXTURE),
        ("fixtures/operations/seeded-circle-placement.json", SEEDED_FIXTURE),
        ("packages/java/src/main/java/org/procedurals/sampling/CirclePlacements2D.java", CORE),
        ("tests/native/CirclePlacementsNative.java", NATIVE),
        ("tools/run_circle_placement_java.py", VECTOR_TOOL),
        ("tools/prepare_circle_placement_android_core.py", Path(__file__).resolve()),
    ]) or toolchain != file_hashes([
        ("java", java / "bin/java"), ("javac", java / "bin/javac"),
        ("android.jar", android_jar), ("d8", d8), ("d8.jar", d8_jar),
        ("java.release", java / "release"), ("java.modules", java / "lib/modules"),
    ]):
        raise RuntimeError("inputs or toolchain changed during preparation")
    result = {
        "status": "passed",
        "scope": "desktop circle-placement vector preflight and API 33 dex preparation only; no emulator, install, or render",
        "operations": ["sampling.ordered-circle-filter-2d", "sampling.seeded-circle-placement-2d"],
        "inputs_sha256": inputs,
        "toolchain_sha256": toolchain,
        "toolchain_paths": {name: str(path.resolve()) for name,path in [
            ("java",java/"bin/java"),("javac",java/"bin/javac"),
            ("android.jar",android_jar),("d8",d8),("d8.jar",d8_jar),
            ("java.release",java/"release"),("java.modules",java/"lib/modules")]},
        "generated_source_sha256": sha(generated),
        "generated_access_source_sha256": sha(access),
        "generated_classes_sha256": tree_hashes(classes),
        "dex_sha256": dex_files,
        "vectors": vector_result,
        "ownership_access": access_result,
        "paths": {"generated_source": str(generated.relative_to(ROOT)),
                  "classes": str(classes.relative_to(ROOT)),
                  "dex": str(dex.relative_to(ROOT))},
    }
    (output / "result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", required=True)
    parser.add_argument("--android-sdk", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = prepare(java_home(args.java_home), Path(args.android_sdk).resolve(), args.output)
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1
    print(json.dumps({"status": result["status"], "output": result["paths"]["dex"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
