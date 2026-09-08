#!/usr/bin/env python3
"""Prepare existing raster-remap vectors/access checks for ART; no native execution."""
import argparse
import json
import os
from pathlib import Path
from prepare_circle_placement_android_core import run, require_file, java_home, d8_path, tree_hashes
from run_raster_remap_java import ROOT, CAT as CATALOG, FIX as FIXTURE, CORE, NATIVE, digest as sha, vector_source


def access_source():
    source = NATIVE.read_text()
    marker = "    public static void main(String[] args) {"
    if source.count(marker) != 1:
        raise RuntimeError("raster-remap access extraction marker changed")
    prefix = source[:source.index(marker)]
    if prefix.count("public final class RasterRemapNative") != 1:
        raise RuntimeError("raster-remap access declaration changed")
    prefix = prefix.replace("public final class RasterRemapNative", "public final class RasterRemapAndroidAccess", 1)
    return prefix + '''    public static void main(String[] args) {
        ownership();
        typedOwnership();
        access();
        invalidInputs();
        System.out.println("{\\"status\\":\\"passed\\",\\"native_ownership_access\\":true,\\"assertions\\":" + assertions + "}");
    }
}
'''


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
             ROOT / "tools/run_raster_remap_java.py", ROOT / "tools/prepare_circle_placement_android_core.py"]
    inputs = lambda: {str(p.relative_to(ROOT)): sha(p) for p in paths}
    tools = lambda: {name: sha(p) for name, p in toolchain.items()}
    before, tool_before = inputs(), tools()
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != sha(CATALOG):
        raise RuntimeError("fixture catalog binding changed")
    classes = output / "classes"
    classes.mkdir(parents=True)
    vectors = output / "V.java"
    access = output / "RasterRemapAndroidAccess.java"
    vectors.write_text(vector_source(fixture))
    access.write_text(access_source())
    env = dict(os.environ, JAVA_HOME=str(java))
    run([java / "bin/javac", "--release", "8", "-d", classes, CORE, vectors, access], env=env)
    results = {}
    for name in ("V", "RasterRemapAndroidAccess"):
        results[name] = json.loads(run([java / "bin/java", "-cp", classes, "org.procedurals.raster." + name], timeout=60, env=env).stdout)
        if results[name].get("status") != "passed":
            raise RuntimeError("desktop preflight failed: " + name)
    if results["V"]["cases"] != len(fixture["cases"]):
        raise RuntimeError("incomplete vector preflight")
    run([d8, "--min-api", "33", "--lib", android, "--output", output, *sorted(classes.rglob("*.class"))], env=env)
    if {p.name for p in output.glob("*.dex")} != {"classes.dex"}:
        raise RuntimeError("expected one dex")
    if inputs() != before or tools() != tool_before:
        raise RuntimeError("inputs/toolchain changed")
    report = {"status": "passed", "scope": "Desktop raster-remap fixtures/access and API33 dex preparation only; no ART/native support claim",
              "inputs_sha256": before, "toolchain_sha256": tool_before,
              "toolchain_paths": {name: str(p.resolve()) for name, p in toolchain.items()},
              "generated_sources_sha256": {p.name: sha(p) for p in (vectors, access)},
              "generated_classes_sha256": tree_hashes(classes), "dex_sha256": sha(output / "classes.dex"),
              "desktop_preflight": results}
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "output": str(output), "desktop_preflight": results}))


if __name__ == "__main__":
    main()
