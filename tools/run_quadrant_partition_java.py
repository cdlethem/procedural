#!/usr/bin/env python3
"""Compile and run frozen CP4 Java-core fixture and native checks without rendering."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog/operations/seeded-quadrant-partition.json"
FIXTURE = ROOT / "fixtures/operations/seeded-quadrant-partition.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java"
NATIVE = ROOT / "tests/native/QuadrantPartitionNative.java"
FROZEN_CATALOG = "effcfead03c5de7cb92bc7430dbee965cf6368baaea43743b429659e36c8ffe1"
FROZEN_FIXTURE = "bb1b6a2cadc0f276cd227706da9c27459f00d1811cbc0ee18faea37941744683"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[Path | str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run([str(value) for value in command], cwd=ROOT, text=True, capture_output=True, check=True, timeout=timeout)
    except subprocess.CalledProcessError as error:
        raise RuntimeError("command failed: " + " ".join(str(value) for value in command) + "\nstdout:\n" + error.stdout + "\nstderr:\n" + error.stderr) from error


def java_home(value: str | None) -> Path:
    if value is not None:
        return Path(value)
    candidates = sorted((ROOT / ".work/toolchains").glob("jdk-17*"))
    if len(candidates) == 1:
        return candidates[0]
    raise RuntimeError("pass --java-home; expected exactly one .work/toolchains/jdk-17*")


def java_value(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "Boolean.TRUE"
    if value is False:
        return "Boolean.FALSE"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, (int, float)):
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list):
        return "list(" + ",".join(java_value(item) for item in value) + ")"
    if isinstance(value, dict):
        return "map(" + ",".join(java_value(item) for pair in value.items() for item in pair) + ")"
    raise TypeError(type(value))


def vector_source(fixture: dict[str, Any]) -> str:
    methods: list[str] = []
    calls: list[str] = []
    results: list[str] = []
    trace_cases = 0
    for index, case in enumerate(fixture["cases"]):
        method = "case" + str(index)
        lines = ["Object config=" + java_value(case["input"]) + ";"]
        if "error" in case:
            lines.append("try { QuadrantPartition2D.generate(config); throw new AssertionError(\"expected " + case["error"] + "\"); }")
            detail = case.get("error_detail")
            if detail:
                lines.append("catch(QuadrantPartition2D.PartitionArithmeticException e){check(\"" + case["error"] + "\".equals(e.code));check(e.replacementIndex==" + str(detail["replacementIndex"]) + ");check(\"" + detail["stage"] + "\".equals(e.stage));}")
            else:
                lines.append("catch(QuadrantPartition2D.PartitionException e){check(\"" + case["error"] + "\".equals(e.code));}")
        else:
            output = case["output"]
            lines.extend([
                "QuadrantPartition2D result=QuadrantPartition2D.generate(config);",
                "results.put(" + json.dumps(case["id"]) + ",result);",
                "check(result.replacements()==" + str(output["replacements"]) + ");",
                "check(result.size()==" + str(len(output["ids"])) + ");",
            ])
            for row_index, (row_bits, expected_id) in enumerate(zip(case["bounds_bits_hex"], output["ids"])):
                for coordinate, bit in enumerate(row_bits):
                    lines.append("bits(result.boundsAt(" + str(row_index) + "L)[" + str(coordinate) + "],\"" + bit + "\");")
                lines.append("check(result.idAt(" + str(row_index) + "L)==" + str(expected_id) + ");")
            trace = case.get("selection_trace")
            if trace is not None:
                trace_cases += 1
                lines.append("int[] trace=QuadrantPartition2D.selectionTraceForTest(config);check(trace.length==" + str(len(trace)) + ");")
                for trace_index, entry in enumerate(trace):
                    lines.append("check(trace[" + str(trace_index) + "]==" + str(entry["selected"]) + ");")
        methods.append("static void " + method + "(){" + "".join(lines) + "}")
        calls.append(method + "();")
    for item in fixture.get("cross_case_checks", []):
        if item.get("kind") == "explicit-non-prefix":
            calls.append("notPrefix(results.get(" + json.dumps(item["short_case"]) + "),results.get(" + json.dumps(item["long_case"]) + "));" )
    rng_calls: list[str] = []
    for vector in fixture["seed_vectors"]:
        rng_calls.append(
            "rng(" + str(vector["seed"]) + "L,new long[]{" + ",".join(str(value) + "L" for value in vector["initial_state"])
            + "},new long[]{" + ",".join(str(entry["output_u32"]) + "L" for entry in vector["first_10"])
            + "},new long[][]{" + ",".join("new long[]{" + ",".join(str(value) + "L" for value in entry["post_state"]) + "}" for entry in vector["first_10"]) + "});"
        )
    return """package org.procedurals.layout;
import java.util.*;
public final class QuadrantPartitionVectors {
 static final Map<String,QuadrantPartition2D> results=new HashMap<String,QuadrantPartition2D>(); static int assertions;
 static Map<String,Object> map(Object... values){Map<String,Object> result=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);return result;}
 static List<Object> list(Object... values){return new ArrayList<Object>(Arrays.asList(values));}
 static void check(boolean condition){assertions++;if(!condition)throw new AssertionError();}
 static void bits(double value,String expected){check(Double.doubleToRawLongBits(value)==Long.parseUnsignedLong(expected,16));}
 static void notPrefix(QuadrantPartition2D shortResult,QuadrantPartition2D longResult){check(shortResult.size()<longResult.size());boolean same=true;for(int i=0;i<shortResult.size();i++){for(int j=0;j<4;j++)if(Double.doubleToRawLongBits(shortResult.boundsAt((long)i)[j])!=Double.doubleToRawLongBits(longResult.boundsAt((long)i)[j]))same=false;if(shortResult.idAt((long)i)!=longResult.idAt((long)i))same=false;}check(!same);}
 static void rng(long seed,long[] initial,long[] outputs,long[][] post){QuadrantPartition2D.Xoshiro128StarStar11 stream=new QuadrantPartition2D.Xoshiro128StarStar11(seed);int[] state=stream.stateForTest();for(int i=0;i<4;i++)check(Integer.toUnsignedLong(state[i])==initial[i]);for(int i=0;i<outputs.length;i++){check(Integer.toUnsignedLong(stream.nextU32())==outputs[i]);state=stream.stateForTest();for(int j=0;j<4;j++)check(Integer.toUnsignedLong(state[j])==post[i][j]);}}
""" + "\n".join(methods) + "\n public static void main(String[] args){" + "".join(calls) + "".join(rng_calls) + "System.out.println(\"{\\\"status\\\":\\\"passed\\\",\\\"fixture_cases\\\":" + str(len(fixture["cases"])) + ",\\\"trace_cases\\\":" + str(trace_cases) + ",\\\"assertions\\\":\"+assertions+\"}\");}\n}\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--output", type=Path, default=ROOT / "evidence/conformance/quadrant-partition-java.json")
    args = parser.parse_args()
    if sha(CATALOG) != FROZEN_CATALOG or sha(FIXTURE) != FROZEN_FIXTURE:
        raise RuntimeError("frozen contract or fixture SHA mismatch")
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if fixture.get("catalog_sha256") != sha(CATALOG):
        raise RuntimeError("fixture catalog binding is stale")
    home = java_home(args.java_home)
    bound = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__).resolve()]
    before = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    build = ROOT / ".work/build/quadrant-partition-java"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir(parents=True)
    vectors = build / "QuadrantPartitionVectors.java"
    vectors.write_text(vector_source(fixture), encoding="utf-8")
    run([home / "bin/javac", "--release", "8", "-d", build, CORE, vectors])
    vector_result = json.loads(run([home / "bin/java", "-cp", build, "org.procedurals.layout.QuadrantPartitionVectors"], timeout=180).stdout)
    run([home / "bin/javac", "--release", "8", "-cp", build, "-d", build, NATIVE])
    native_result = json.loads(run([home / "bin/java", "-cp", build, "org.procedurals.layout.QuadrantPartitionNative"], timeout=300).stdout)
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("Java vector or native check failed")
    after = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    if before != after:
        raise RuntimeError("bound input changed during conformance")
    report = {
        "operation": "layout.seeded-quadrant-partition-2d",
        "scope": "Java core fixture, deterministic stream, ownership/access, and bounded workload evidence only; no renderer, example, package, Android, JavaScript, or Python claim.",
        "contract_sha256": {str(CATALOG.relative_to(ROOT)): sha(CATALOG)},
        "fixture_sha256": {str(FIXTURE.relative_to(ROOT)): sha(FIXTURE)},
        "source_sha256_before": before,
        "source_sha256_after": after,
        "vectors": vector_result,
        "native": native_result,
        "runtime": run([home / "bin/java", "-version"]).stderr.strip(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "report": str(args.output), "cases": vector_result["fixture_cases"]}, sort_keys=True))


if __name__ == "__main__":
    main()
