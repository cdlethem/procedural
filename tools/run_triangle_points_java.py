#!/usr/bin/env python3
"""Compile and run frozen CP5 Java-core triangle-point conformance without rendering."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SEEDED_CATALOG = ROOT / "catalog/operations/seeded-triangle-points.json"
MAPPED_CATALOG = ROOT / "catalog/operations/triangle-coordinate-map.json"
SEEDED_FIXTURE = ROOT / "fixtures/operations/seeded-triangle-points.json"
MAPPED_FIXTURE = ROOT / "fixtures/operations/triangle-coordinate-map.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/sampling/TrianglePoints2D.java"
NATIVE = ROOT / "tests/native/TrianglePointsNative.java"

# `design/operations/triangle-points-contract-review.md` freezes these inputs.  Keeping
# the values here turns an accidental fixture/catalog replacement into a failed run.
FROZEN = {
    SEEDED_CATALOG: "610e25f26407f4c0cea1ca5335c28d46c2ff49453bec949dbc84bd3a34903bb8",
    MAPPED_CATALOG: "81992a9369392ef272262104c36111d31ed3ea838bea8c7d53c9d3854ffcf78f",
    SEEDED_FIXTURE: "719a6d292dbf6a81683f7635dc49100a28fc3452c128b5ce8fdf6c473c5af35e",
    MAPPED_FIXTURE: "b6f303d718093c6f587f793ed40e19346d8844dbeffeb4c15e86f9d343644607",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[Path | str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            [str(value) for value in command], cwd=ROOT, text=True,
            capture_output=True, check=True, timeout=timeout,
        )
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            "command failed: " + " ".join(str(value) for value in command)
            + "\nstdout:\n" + error.stdout + "\nstderr:\n" + error.stderr
        ) from error


def java_home(value: str | None) -> Path:
    if value is not None:
        return Path(value)
    candidates = sorted((ROOT / ".work/toolchains").glob("jdk-17*"))
    if len(candidates) == 1:
        return candidates[0]
    raise RuntimeError("pass --java-home; expected exactly one .work/toolchains/jdk-17*")


def java_value(value: Any) -> str:
    """Emit only the passive Map/List/carriers and scalar values accepted by the core."""
    if value is None:
        return "null"
    if value is True:
        return "Boolean.TRUE"
    if value is False:
        return "Boolean.FALSE"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        # Double preserves JSON -0 and all fixture binary64 values when parsed by Java.
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list):
        return "list(" + ",".join(java_value(item) for item in value) + ")"
    if isinstance(value, dict):
        return "map(" + ",".join(
            java_value(item) for pair in value.items() for item in pair
        ) + ")"
    raise TypeError("unsupported fixture value " + repr(type(value)))


def fixture_methods(fixture: dict[str, Any], prefix: str, factory: str) -> tuple[list[str], list[str]]:
    methods: list[str] = []
    calls: list[str] = []
    for ordinal, case in enumerate(fixture["cases"]):
        name = prefix + str(ordinal)
        lines = ["Object config=" + java_value(case["input"]) + ";"]
        invocation = "TrianglePoints2D." + factory + "(config)"
        if "error" in case:
            lines.extend([
                "try{" + invocation + ";throw new AssertionError(\"expected " + case["error"] + "\");}",
                "catch(TrianglePoints2D.TrianglePointsException error){check(\""
                + case["error"] + "\".equals(error.code));}",
            ])
        else:
            expected = case["output"]["points"]
            bits = case["points_bits_hex"]
            lines.extend([
                "TrianglePoints2D result=" + invocation + ";",
                "results.put(" + json.dumps(case["id"]) + ",result);",
                "check(result.size()==" + str(len(expected)) + ");",
            ])
            for point_index, point_bits in enumerate(bits):
                lines.append("bits(result.pointAt(" + str(point_index) + "L)[0],\"" + point_bits[0] + "\");")
                lines.append("bits(result.pointAt(" + str(point_index) + "L)[1],\"" + point_bits[1] + "\");")
        methods.append("static void " + name + "(){" + "".join(lines) + "}")
        calls.append(name + "();")
    return methods, calls


def vector_source(seeded: dict[str, Any], mapped: dict[str, Any]) -> str:
    methods, calls = fixture_methods(seeded, "seededCase", "seeded")
    mapped_methods, mapped_calls = fixture_methods(mapped, "mappedCase", "map")
    methods.extend(mapped_methods)
    calls.extend(mapped_calls)
    for item in seeded.get("cross_case_checks", []):
        kind = item["kind"]
        if kind == "raw-binary64-prefix":
            calls.append("prefix(results.get(" + json.dumps(item["prefix_case"]) + "),results.get("
                         + json.dumps(item["extended_case"]) + "));")
        elif kind == "seeded-output-equals-explicit-map":
            calls.append("equal(results.get(" + json.dumps(item["seeded_case"]) + "),results.get("
                         + json.dumps(item["mapping_case"]) + "));")
        else:
            raise RuntimeError("unknown frozen seeded cross-case kind " + repr(kind))
    return """package org.procedurals.sampling;
import java.util.*;
public final class TrianglePointsVectors {
 static final Map<String,TrianglePoints2D> results=new HashMap<String,TrianglePoints2D>(); static int assertions;
 static Map<String,Object> map(Object... values){Map<String,Object> result=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);return result;}
 static List<Object> list(Object... values){return new ArrayList<Object>(Arrays.asList(values));}
 static void check(boolean condition){assertions++;if(!condition)throw new AssertionError();}
 static void bits(double value,String expected){check(Double.doubleToRawLongBits(value)==Long.parseUnsignedLong(expected,16));}
 static void equal(TrianglePoints2D left,TrianglePoints2D right){check(left.size()==right.size());for(int i=0;i<left.size();i++){double[] a=left.pointAt((long)i),b=right.pointAt((long)i);check(Double.doubleToRawLongBits(a[0])==Double.doubleToRawLongBits(b[0]));check(Double.doubleToRawLongBits(a[1])==Double.doubleToRawLongBits(b[1]));}}
 static void prefix(TrianglePoints2D prefix,TrianglePoints2D extended){check(prefix.size()<=extended.size());for(int i=0;i<prefix.size();i++){double[] a=prefix.pointAt((long)i),b=extended.pointAt((long)i);check(Double.doubleToRawLongBits(a[0])==Double.doubleToRawLongBits(b[0]));check(Double.doubleToRawLongBits(a[1])==Double.doubleToRawLongBits(b[1]));}}
""" + "\n".join(methods) + "\n public static void main(String[] args){" + "".join(calls) + "System.out.println(\"{\\\"status\\\":\\\"passed\\\",\\\"fixture_cases\\\":" + str(len(seeded["cases"]) + len(mapped["cases"])) + ",\\\"assertions\\\":\"+assertions+\"}\");}\n}\n"


def require_frozen_inputs() -> None:
    for path, expected in FROZEN.items():
        actual = sha(path)
        if actual != expected:
            raise RuntimeError("frozen input SHA mismatch for " + str(path.relative_to(ROOT)) + ": " + actual)
    seeded = json.loads(SEEDED_FIXTURE.read_text(encoding="utf-8"))
    mapped = json.loads(MAPPED_FIXTURE.read_text(encoding="utf-8"))
    if seeded.get("catalog_sha256") != sha(SEEDED_CATALOG):
        raise RuntimeError("seeded fixture catalog binding is stale")
    if mapped.get("catalog_sha256") != sha(MAPPED_CATALOG):
        raise RuntimeError("mapped fixture catalog binding is stale")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/triangle-points-java.json")
    args = parser.parse_args()
    require_frozen_inputs()
    seeded = json.loads(SEEDED_FIXTURE.read_text(encoding="utf-8"))
    mapped = json.loads(MAPPED_FIXTURE.read_text(encoding="utf-8"))
    home = java_home(args.java_home)
    bound = [SEEDED_CATALOG, MAPPED_CATALOG, SEEDED_FIXTURE, MAPPED_FIXTURE, CORE, NATIVE, Path(__file__).resolve()]
    before = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    build = ROOT / ".work/build/triangle-points-java"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir(parents=True)
    vectors = build / "TrianglePointsVectors.java"
    vectors.write_text(vector_source(seeded, mapped), encoding="utf-8")
    run([home / "bin/javac", "--release", "8", "-d", build, CORE, vectors])
    vector_result = json.loads(run([home / "bin/java", "-cp", build, "org.procedurals.sampling.TrianglePointsVectors"], timeout=180).stdout)
    run([home / "bin/javac", "--release", "8", "-cp", build, "-d", build, NATIVE])
    native_result = json.loads(run([home / "bin/java", "-cp", build, "org.procedurals.sampling.TrianglePointsNative"], timeout=300).stdout)
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("Java vector or native check failed")
    after = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    if before != after:
        raise RuntimeError("bound input changed during conformance")
    report = {
        "operations": ["sampling.seeded-triangle-points-2d", "sampling.triangle-coordinate-map-2d"],
        "scope": "Java core exact fixture, black-box seeded-prefix/equivalence, ownership/access, and bounded workload observations only; no renderer, package, Android, JavaScript, or Python claim.",
        "contract_sha256": {str(SEEDED_CATALOG.relative_to(ROOT)): sha(SEEDED_CATALOG), str(MAPPED_CATALOG.relative_to(ROOT)): sha(MAPPED_CATALOG)},
        "fixture_sha256": {str(SEEDED_FIXTURE.relative_to(ROOT)): sha(SEEDED_FIXTURE), str(MAPPED_FIXTURE.relative_to(ROOT)): sha(MAPPED_FIXTURE)},
        "source_sha256_before": before,
        "source_sha256_after": after,
        "vectors": vector_result,
        "stream_diagnostics": "No private-stream reflection was used. Exact seeded outputs across every frozen seeded case plus raw-prefix and seeded-to-explicit-map checks exercise the private stream through the public factories.",
        "native": native_result,
        "runtime": run([home / "bin/java", "-version"]).stderr.strip(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "report": str(args.output), "cases": vector_result["fixture_cases"]}, sort_keys=True))


if __name__ == "__main__":
    main()
