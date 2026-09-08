#!/usr/bin/env python3
"""Run exact BinaryCellPartition2D fixture vectors and the focused native check."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/layout/BinaryCellPartition2D.java"
DEPENDENCY = ROOT / "packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java"
NATIVE = ROOT / "tests/native/BinaryCellPartitionNative.java"
CATALOG = ROOT / "catalog/operations/binary-cell-partition-2d.json"
FIXTURE = ROOT / "fixtures/operations/binary-cell-partition-2d.json"
CONTRACT = ROOT / "design/operations/binary-cell-partition-contract.md"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def carrier(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "Boolean." + str(value).upper()
    if isinstance(value, int):
        return str(value) if -2147483648 <= value <= 2147483647 else str(value) + "L"
    if isinstance(value, float):
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, list):
        return "list(" + ", ".join(carrier(item) for item in value) + ")"
    if isinstance(value, dict):
        values = []
        for key, item in value.items():
            values.extend((json.dumps(key), carrier(item)))
        return "map(" + ", ".join(values) + ")"
    raise TypeError("unsupported fixture carrier: " + repr(value))


def typed_call(case: dict) -> str:
    i = case["input"]
    return "BinaryCellPartition2D.generate(%s,%s,%s,%s,%s)" % (
        carrier(i["seed"]), carrier(i["columns"]), carrier(i["rows"]),
        carrier(i["attempts"]), carrier(i["axisPolicy"]),
    )


def vector_source(fixture: dict) -> str:
    methods = []
    calls = []
    for index, case in enumerate(fixture["cases"]):
        case_id = json.dumps(case["id"])
        config = carrier(case["input"])
        if "error" in case:
            body = "expectError(new Action(){public void run(){BinaryCellPartition2D.generate(%s);}},%s,%s);" % (config, json.dumps(case["error"]), case_id)
        else:
            expected = carrier(case["output"])
            body = "check(BinaryCellPartition2D.generate(%s).toValues(),%s,%s);" % (config, expected, json.dumps(case["id"] + " object"))
            body += "check(%s.toValues(),%s,%s);" % (typed_call(case), expected, json.dumps(case["id"] + " typed"))
        methods.append("private static void case%d(){%s}" % (index, body))
        calls.append("case%d();" % index)
    return """package org.procedurals.layout;
import java.util.*;
public final class BinaryCellPartitionVectors {
 private static int assertions;
 private interface Action{void run();}
 private static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
 private static void check(Object actual,Object expected,String message){assertions++;exact(expected,actual,message);}
 private static void exact(Object expected,Object actual,String message){
  if(expected instanceof Number){if(!(actual instanceof Number)||Double.compare(((Number)expected).doubleValue(),((Number)actual).doubleValue())!=0)throw new AssertionError(message);return;}
  if(expected instanceof List){if(!(actual instanceof List))throw new AssertionError(message);List<?>x=(List<?>)expected,y=(List<?>)actual;if(x.size()!=y.size())throw new AssertionError(message);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),message);return;}
  if(expected instanceof Map){if(!(actual instanceof Map))throw new AssertionError(message);Map<?,?>x=(Map<?,?>)expected,y=(Map<?,?>)actual;if(!x.keySet().equals(y.keySet()))throw new AssertionError(message);for(Object k:x.keySet())exact(x.get(k),y.get(k),message);return;}
  if(expected==null?actual!=null:!expected.equals(actual))throw new AssertionError(message);
 }
 private static void expectError(Action action,String expected,String message){try{action.run();throw new AssertionError(message+" missing error");}catch(BinaryCellPartition2D.PartitionException error){check(error.code,expected,message);}}
 %s
 public static void main(String[] args){%sSystem.out.println("{\\"status\\":\\"passed\\",\\"cases\\":%d,\\"assertions\\":"+assertions+"}");}
}
""" % (" ".join(methods), " ".join(calls), len(fixture["cases"]))


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=180, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/binary-cell-partition-java.json")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    java, javac = args.java_home / "bin/java", args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CONTRACT, CORE, DEPENDENCY, NATIVE, Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="binary-cell-partition-", dir=build_root))
    vectors = build / "BinaryCellPartitionVectors.java"
    vectors.write_text(vector_source(fixture))
    run([str(javac), "--release", "8", "-d", str(build), str(CORE), str(DEPENDENCY), str(NATIVE), str(vectors)], ROOT)
    artifacts = sorted(build.rglob("*.class"))
    artifact_before = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    vector_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.layout.BinaryCellPartitionVectors"], ROOT).stdout)
    native_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.layout.BinaryCellPartitionNative"], ROOT).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    artifact_after = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    if before != after or artifact_before != artifact_after:
        raise RuntimeError("bound input changed during check")
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("fixture or native checks failed")
    report = {"status": "passed", "operation": fixture["operation"], "fixture_cases_executed": vector_result["cases"], "vectors": vector_result, "native": native_result, "source_sha256_before": before, "source_sha256_after": after, "artifact_sha256_before": artifact_before, "artifact_sha256_after": artifact_after, "javac_release": "8", "runtime": run([str(java), "-version"], ROOT).stderr.strip(), "scope": "Java core exact vectors and focused native ownership check; no renderer, distribution or port acceptance."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "report": str(args.output)}))


if __name__ == "__main__":
    main()
