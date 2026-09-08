#!/usr/bin/env python3
"""Prepare existing noise-band-path vectors/access checks for ART; no native execution."""
import argparse
import json
import os
from pathlib import Path
from prepare_circle_placement_android_core import run, require_file, java_home, d8_path, tree_hashes
from run_noise_band_path_java import ROOT, CATALOG, FIXTURE, SOURCE, FIELD, NATIVE, sha, vectors


def access_source():
    source = NATIVE.read_text()
    marker = "    private static String measure("
    if source.count(marker) != 1:
        raise RuntimeError("noise-band-path access extraction marker changed")
    prefix = source[:source.index(marker)]
    if prefix.count("public final class NoiseBandPathNative") != 1:
        raise RuntimeError("noise-band-path access declaration changed")
    prefix = prefix.replace("public final class NoiseBandPathNative", "public final class NoiseBandPathAndroidAccess", 1)
    return prefix + '''    public static void main(String[] args) {
        ownershipAndErrors();
        System.out.println("{\\"status\\":\\"passed\\",\\"native_ownership_access\\":true,\\"checks\\":" + checks + "}");
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
    paths = [CATALOG, FIXTURE, SOURCE, FIELD, NATIVE, Path(__file__).resolve(),
             ROOT / "tools/run_noise_band_path_java.py", ROOT / "tools/prepare_circle_placement_android_core.py"]
    inputs = lambda: {str(p.relative_to(ROOT)): sha(p) for p in paths}
    tools = lambda: {name: sha(p) for name, p in toolchain.items()}
    before, tool_before = inputs(), tools()
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != sha(CATALOG):
        raise RuntimeError("fixture catalog binding changed")
    classes = output / "classes"
    classes.mkdir(parents=True)
    vector_source = output / "NoiseBandPathVectors.java"
    access = output / "NoiseBandPathAndroidAccess.java"
    vector_source.write_text(vectors(fixture))
    access.write_text(access_source())
    env = dict(os.environ, JAVA_HOME=str(java))
    run([java / "bin/javac", "--release", "8", "-d", classes, SOURCE, FIELD, NATIVE, vector_source, access], env=env)
    results = {}
    for name in ("NoiseBandPathVectors", "NoiseBandPathAndroidAccess"):
        results[name] = json.loads(run([java / "bin/java", "-cp", classes, "org.procedurals.paths." + name], timeout=60, env=env).stdout)
        if results[name].get("status") != "passed":
            raise RuntimeError("desktop preflight failed: " + name)
    if results["NoiseBandPathVectors"]["cases"] != len(fixture["cases"]):
        raise RuntimeError("incomplete vector preflight")
    run([d8, "--min-api", "33", "--lib", android, "--output", output, *sorted(classes.rglob("*.class"))], env=env)
    if {p.name for p in output.glob("*.dex")} != {"classes.dex"}:
        raise RuntimeError("expected one dex")
    if inputs() != before or tools() != tool_before:
        raise RuntimeError("inputs/toolchain changed")
    report = {"status": "passed", "scope": "Desktop noise-band-path fixtures/access and API33 dex preparation only; no ART/native support claim",
              "inputs_sha256": before, "toolchain_sha256": tool_before,
              "toolchain_paths": {name: str(p.resolve()) for name, p in toolchain.items()},
              "generated_sources_sha256": {p.name: sha(p) for p in (vector_source, access)},
              "generated_classes_sha256": tree_hashes(classes), "dex_sha256": sha(output / "classes.dex"),
              "desktop_preflight": results}
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "output": str(output), "desktop_preflight": results}))


if __name__ == "__main__":
    main()
