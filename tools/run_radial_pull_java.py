#!/usr/bin/env python3
"""Run exact RadialPull2D vectors and the focused native check."""
from __future__ import annotations
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_noise3d_java import carrier

CORE = ROOT / "packages/java/src/main/java/org/procedurals/geometry/RadialPull2D.java"
NATIVE = ROOT / "tests/native/RadialPullNative.java"
CATALOG = ROOT / "catalog/operations/radial-pull-2d.json"
FIXTURE = ROOT / "fixtures/operations/radial-pull-2d.json"
CONTRACT = ROOT / "design/operations/radial-pull-contract.md"
ORACLE = ROOT / "tools/build_radial_pull_fixtures.py"
CARRIER_HELPER = ROOT / "tools/run_noise3d_java.py"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def typed_field(input_value: dict) -> str:
    rows = input_value["influences"]
    row_values = []
    for row in rows:
        row_values.append("new double[]{%s}" % ", ".join(carrier(value) for value in row))
    return "RadialPull2D.create(new double[][]{%s})" % ", ".join(row_values)


def vector_source(fixture: dict) -> str:
    methods, calls = [], []
    for index, case in enumerate(fixture["cases"]):
        case_id = case["id"]
        descriptor = carrier(case["input"])
        if "error" in case:
            body = "expectError(%s,%s,%s);" % (descriptor, json.dumps(case["error"]), json.dumps(case_id))
        else:
            typed = typed_field(case["input"])
            body = "RadialPull2D object=RadialPull2D.create(%s);RadialPull2D typed=%s;" % (descriptor, typed)
            body += "checkSerialize(object,%s,%s);checkSerialize(typed,%s,%s);" % (carrier(case["serialized"]), json.dumps(case_id + " object"), carrier(case["serialized"]), json.dumps(case_id + " typed"))
            body += "runQueries(object,typed,%s);" % carrier(case["queries"])
        methods.append("private static void case%d(){%s}" % (index, body))
        calls.append("case%d();" % index)
    query_methods, query_calls = [], []
    for index, query in enumerate(fixture["query_cases"]):
        query_methods.append("private static void query%d(){expectQueryError(VALID,%s,%s,%s);}" % (index, carrier(query["input"]), json.dumps(query["error"]), json.dumps(query["id"])))
        query_calls.append("query%d();" % index)
    query_count = sum(len(case.get("queries", [])) for case in fixture["cases"])
    return """package org.procedurals.geometry;
import java.util.*;
public final class RadialPullVectors {
 private static int assertions;
 private static final RadialPull2D VALID=RadialPull2D.create(new double[][]{{0,0,10,2}});
 private interface Action{void run();}
 private static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
 private static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
 private static void exact(Object e,Object a,String m){if(e instanceof Number){check(a instanceof Number,m);check(Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){check(a instanceof List,m);List<?>x=(List<?>)e,y=(List<?>)a;check(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){check(a instanceof Map,m);Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;check(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}check(e==null?a==null:e.equals(a),m);}
 private static void checkSerialize(RadialPull2D field,Object expected,String message){Object first=field.serialize();Object second=field.serialize();exact(expected,first,message);exact(expected,second,message);check(first!=second,message+" detached");}
 private static void checkTransform(RadialPull2D field,Object query,Object expected,String message){exact(expected,field.transform(query),message+" object");List<?>point=(List<?>)query;double x=((Number)point.get(0)).doubleValue(),y=((Number)point.get(1)).doubleValue();RadialPull2D.Point p=field.transform(x,y);exact(expected,list(p.x(),p.y()),message+" point");double[] target={99,99};field.transform(x,y,target);exact(expected,list(target[0],target[1]),message+" target");}
 private static void runQueries(RadialPull2D object,RadialPull2D typed,Object raw){List<?>queries=(List<?>)raw;for(int i=0;i<queries.size();i++){Map<?,?>q=(Map<?,?>)queries.get(i);checkTransform(object,q.get("input"),q.get("output"),"query "+i);checkTransform(typed,q.get("input"),q.get("output"),"typed query "+i);}}
 private static void expectError(Object input,String expected,String message){try{RadialPull2D.create(input);throw new AssertionError(message+" missing error");}catch(RadialPull2D.PullException e){check(expected.equals(e.code),message);}}
 private static void expectQueryError(RadialPull2D field,Object input,String expected,String message){try{field.transform(input);throw new AssertionError(message+" missing error");}catch(RadialPull2D.PullException e){check(expected.equals(e.code),message);}}
 %s
 %s
 public static void main(String[]args){%s%sSystem.out.println("{\\"status\\":\\"passed\\",\\"constructor_cases\\":%d,\\"query_cases\\":%d,\\"queries\\":%d,\\"assertions\\":"+assertions+"}");}
}
""" % (" ".join(methods), " ".join(query_methods), " ".join(calls), " ".join(query_calls), len(fixture["cases"]), len(fixture["query_cases"]), query_count)


def run(command: list[object], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(item) for item in command], cwd=cwd, text=True, capture_output=True, timeout=180, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/radial-pull-java.json")
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / ".work") or output.exists():
        raise ValueError("Preserve attempts: require a fresh output below .work")
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    java, javac = args.java_home / "bin/java", args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CONTRACT, CORE, NATIVE, ORACLE, CARRIER_HELPER, Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="radial-pull-", dir=build_root))
    vectors = build / "RadialPullVectors.java"
    vectors.write_text(vector_source(fixture))
    run([javac, "--release", "8", "-d", build, CORE, NATIVE, vectors], ROOT)
    artifacts = sorted(build.rglob("*.class"))
    artifact_before = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    vector_result = json.loads(run([java, "-cp", build, "org.procedurals.geometry.RadialPullVectors"], ROOT).stdout)
    native_result = json.loads(run([java, "-cp", build, "org.procedurals.geometry.RadialPullNative"], ROOT).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    artifact_after = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    if before != after or artifact_before != artifact_after:
        raise RuntimeError("bound input or generated artifact changed during check")
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("fixture or native checks failed")
    report = {"status": "passed", "operation": fixture["operation"], "constructor_cases_executed": vector_result["constructor_cases"], "query_error_cases_executed": vector_result["query_cases"], "queries_executed": vector_result["queries"], "vectors": vector_result, "native": native_result, "source_sha256_before": before, "source_sha256_after": after, "artifact_sha256_before": artifact_before, "artifact_sha256_after": artifact_after, "javac_release": "8", "runtime": run([java, "-version"], ROOT).stderr.strip(), "scope": "Java core exact vectors and focused native ownership/workload check; no renderer, distribution or port acceptance."}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "report": str(output)}))


if __name__ == "__main__":
    main()
