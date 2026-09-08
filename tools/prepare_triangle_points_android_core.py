#!/usr/bin/env python3
"""Prepare existing triangle vectors/access checks for ART; no native execution."""
import argparse
import json
import os
from pathlib import Path
from prepare_circle_placement_android_core import run, require_file, java_home, d8_path, tree_hashes
from run_triangle_points_java import ROOT, SEEDED_CATALOG, MAPPED_CATALOG, SEEDED_FIXTURE, MAPPED_FIXTURE, CORE, NATIVE, sha, vector_source, require_frozen_inputs


def access_source(fixture):
    source = NATIVE.read_text()
    marker = "    private static long checksum("
    if source.count(marker) != 1:
        raise RuntimeError("triangle access extraction marker changed")
    prefix = source[:source.index(marker)]
    for before, after in [("public final class TrianglePointsNative", "public final class TrianglePointsAndroidAccess"),
                          ("private TrianglePointsNative()", "private TrianglePointsAndroidAccess()"),
                          ("    private static volatile long sink;\n", "")]:
        if prefix.count(before) != 1:
            raise RuntimeError("triangle access declaration changed")
        prefix = prefix.replace(before, after, 1)
    prefix += stream_checks(fixture)
    return prefix + '''    public static void main(String[] args) throws Exception {
        ownershipAndAccess();
        streamChecks();
        System.out.println("{\\"status\\":\\"passed\\",\\"assertions\\":" + assertions + ",\\"native_ownership_access\\":true}");
    }
}
'''


def stream_checks(fixture):
    lines = ["    private static void streamChecks() throws Exception {",
        '        Class<?> type=Class.forName("org.procedurals.sampling.TrianglePoints2D$Xoshiro128StarStar11");',
        '        java.lang.reflect.Constructor<?> constructor=type.getDeclaredConstructor(long.class); constructor.setAccessible(true);',
        '        java.lang.reflect.Method next=type.getDeclaredMethod("nextU32"), unit=type.getDeclaredMethod("unit"); next.setAccessible(true); unit.setAccessible(true);',
        '        java.lang.reflect.Field[] fields=new java.lang.reflect.Field[4];',
        '        for(int i=0;i<4;i++){fields[i]=type.getDeclaredField("s"+i);fields[i].setAccessible(true);}',
        '        Object stream, units;']
    for vector in fixture['seed_vectors']:
        lines.append(f"        stream=constructor.newInstance({vector['seed']}L); units=constructor.newInstance({vector['seed']}L);")
        for i, value in enumerate(vector['initial_state']):
            lines.append(f'        check(Integer.toUnsignedLong(fields[{i}].getInt(stream))=={value}L,"initial state");')
        for item in vector['first_10']:
            lines.append(f'        check(Integer.toUnsignedLong((Integer)next.invoke(stream))=={item["output_u32"]}L,"stream output");')
            lines.append(f'        check(raw((Double)unit.invoke(units),{repr(item["unit"])}d),"stream unit");')
            for i, value in enumerate(item['post_state']):
                lines.append(f'        check(Integer.toUnsignedLong(fields[{i}].getInt(stream))=={value}L,"post state");')
    return "\n".join(lines + ["    }", ""])


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
    paths = [SEEDED_CATALOG, MAPPED_CATALOG, SEEDED_FIXTURE, MAPPED_FIXTURE, CORE, NATIVE, Path(__file__).resolve(),
             ROOT / "tools/run_triangle_points_java.py", ROOT / "tools/prepare_circle_placement_android_core.py"]
    inputs = lambda: {str(p.relative_to(ROOT)): sha(p) for p in paths}
    tools = lambda: {name: sha(p) for name, p in toolchain.items()}
    before, tool_before = inputs(), tools()
    require_frozen_inputs()
    fixture = json.loads(SEEDED_FIXTURE.read_text())
    mapped = json.loads(MAPPED_FIXTURE.read_text())
    classes = output / "classes"
    classes.mkdir(parents=True)
    vectors = output / "TrianglePointsVectors.java"
    access = output / "TrianglePointsAndroidAccess.java"
    vectors.write_text(vector_source(fixture, mapped))
    access.write_text(access_source(fixture))
    env = dict(os.environ, JAVA_HOME=str(java))
    run([java / "bin/javac", "--release", "8", "-d", classes, CORE, vectors, access], env=env)
    results = {}
    for name in ("TrianglePointsVectors", "TrianglePointsAndroidAccess"):
        results[name] = json.loads(run([java / "bin/java", "-cp", classes, "org.procedurals.sampling." + name], timeout=60, env=env).stdout)
        if results[name].get("status") != "passed":
            raise RuntimeError("desktop preflight failed: " + name)
    if results["TrianglePointsVectors"]["fixture_cases"] != len(fixture["cases"]) + len(mapped["cases"]):
        raise RuntimeError("incomplete vector preflight")
    run([d8, "--min-api", "33", "--lib", android, "--output", output, *sorted(classes.rglob("*.class"))], env=env)
    if {p.name for p in output.glob("*.dex")} != {"classes.dex"}:
        raise RuntimeError("expected one dex")
    if inputs() != before or tools() != tool_before:
        raise RuntimeError("inputs/toolchain changed")
    report = {"status": "passed", "scope": "Desktop triangle fixtures/access and API33 dex preparation only; no ART/native support claim",
              "inputs_sha256": before, "toolchain_sha256": tool_before,
              "toolchain_paths": {name: str(p.resolve()) for name, p in toolchain.items()},
              "generated_sources_sha256": {p.name: sha(p) for p in (vectors, access)},
              "generated_classes_sha256": tree_hashes(classes), "dex_sha256": sha(output / "classes.dex"),
              "desktop_preflight": results}
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "output": str(output), "desktop_preflight": results}))


if __name__ == "__main__":
    main()
