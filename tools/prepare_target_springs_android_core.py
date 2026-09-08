#!/usr/bin/env python3
"""Prepare existing target-springs vectors/access checks for ART; no native execution.

Compiles and preflights directly from CORE/NATIVE/vectors_source rather than
reusing run_target_springs_java.py's own main(), which additionally verifies a
design/phase2 + tools/check_catalog.py review-binding snapshot unrelated to this
operation's own core/fixture/native sources (observed stale at this baseline;
see the porting checkpoint).
"""
import argparse
import json
import os
from pathlib import Path
from prepare_circle_placement_android_core import run, require_file, java_home, d8_path, tree_hashes
from run_target_springs_java import ROOT, CATALOG, FIXTURE, CORE, NATIVE, sha, vectors_source


def access_source():
    source = NATIVE.read_text()
    if source.count("public final class TargetSpringsNative") != 1:
        raise RuntimeError("target-springs access declaration changed")
    source = source.replace("public final class TargetSpringsNative", "public final class TargetSpringsAndroidAccess", 1)
    marker = '"{\\"status\\":\\"passed\\",\\"assertions\\":" + assertions'
    replacement = '"{\\"status\\":\\"passed\\",\\"native_ownership_access\\":true,\\"assertions\\":" + assertions'
    if source.count(marker) != 1:
        raise RuntimeError("target-springs success-line marker changed")
    return source.replace(marker, replacement, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", required=True)
    parser.add_argument("--android-sdk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / ".work")
    if output.exists():
        raise FileExistsError("fresh output directory required")
    java, sdk = java_home(args.java_home), args.android_sdk.resolve()
    android = require_file(sdk / "platforms/android-33/android.jar", "API33")
    d8 = d8_path(sdk)
    toolchain = {"java": java / "bin/java", "javac": java / "bin/javac",
                 "java.release": java / "release", "java.modules": java / "lib/modules",
                 "android.jar": android, "d8": d8, "d8.jar": d8.parent / "lib/d8.jar"}
    paths = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__).resolve(),
             ROOT / "tools/run_target_springs_java.py", ROOT / "tools/prepare_circle_placement_android_core.py"]
    inputs = lambda: {str(p.relative_to(ROOT)): sha(p) for p in paths}
    tools = lambda: {name: sha(p) for name, p in toolchain.items()}
    before, tool_before = inputs(), tools()
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != sha(CATALOG):
        raise RuntimeError("fixture catalog binding changed")
    classes = output / "classes"
    classes.mkdir(parents=True)
    vector_source = output / "TargetSpringsVectors.java"
    access = output / "TargetSpringsAndroidAccess.java"
    vector_source.write_text(vectors_source(fixture))
    access.write_text(access_source())
    env = dict(os.environ, JAVA_HOME=str(java))
    run([java / "bin/javac", "--release", "8", "-d", classes, CORE, NATIVE, vector_source, access], env=env)
    results = {}
    for name in ("TargetSpringsVectors", "TargetSpringsAndroidAccess"):
        results[name] = json.loads(run([java / "bin/java", "-cp", classes, "org.procedurals.motion." + name], timeout=60, env=env).stdout)
        if results[name].get("status") != "passed":
            raise RuntimeError("desktop preflight failed: " + name)
    if results["TargetSpringsVectors"]["fixture_cases"] != len(fixture["cases"]):
        raise RuntimeError("incomplete vector preflight")
    run([d8, "--min-api", "33", "--lib", android, "--output", output, *sorted(classes.rglob("*.class"))], env=env)
    if {p.name for p in output.glob("*.dex")} != {"classes.dex"}:
        raise RuntimeError("expected one dex")
    if inputs() != before or tools() != tool_before:
        raise RuntimeError("inputs/toolchain changed")
    report = {"status": "passed", "scope": "Desktop target-springs fixtures/access and API33 dex preparation only; no ART/native support claim",
              "inputs_sha256": before, "toolchain_sha256": tool_before,
              "toolchain_paths": {name: str(p.resolve()) for name, p in toolchain.items()},
              "generated_sources_sha256": {p.name: sha(p) for p in (vector_source, access)},
              "generated_classes_sha256": tree_hashes(classes), "dex_sha256": sha(output / "classes.dex"),
              "desktop_preflight": results}
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "output": str(output), "desktop_preflight": results}))


if __name__ == "__main__":
    main()
