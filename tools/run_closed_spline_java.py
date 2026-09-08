#!/usr/bin/env python3
"""Run exact ClosedSpline2D fixture vectors and the focused Java native check."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/paths/ClosedSpline2D.java"
NATIVE = ROOT / "tests/native/ClosedSplineNative.java"
CATALOG = ROOT / "catalog/operations/closed-spline-2d.json"
FIXTURE = ROOT / "fixtures/operations/closed-spline-2d.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def carrier(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "Boolean." + str(value).upper()
    if isinstance(value, (int, float)):
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


def typed_constructor(case: dict) -> str:
    controls = case["input"]["controls"]
    rows = ", ".join("new double[]{%s}" % ", ".join(str(value) for value in row) for row in controls)
    return "ClosedSpline2D.create(new double[][]{%s}, %s)" % (rows, case["input"]["subdivisions"])


def vector_source(fixture: dict) -> str:
    methods = []
    calls = []
    for index, case in enumerate(fixture["cases"]):
        case_id = json.dumps(case["id"])
        if "error" in case:
            body = "expectError(new Action(){public void run(){ClosedSpline2D.create(%s);}},%s,%s);" % (carrier(case["input"]), json.dumps(case["error"]), case_id)
        else:
            typed = typed_constructor(case)
            queries = []
            for query_index, query in enumerate(case["queries"]):
                expected = carrier(query["output"])
                query_carrier = carrier(query["input"])
                method = "parameter" if query["input"]["mode"] == "parameter" else "distance"
                queries.append("checkQuery(object,%s,%s,%s,%s);" % (query_carrier, expected, json.dumps(case["id"] + " object " + str(query_index)), json.dumps(method)))
                queries.append("checkQuery(typed,%s,%s,%s,%s);" % (query_carrier, expected, json.dumps(case["id"] + " typed " + str(query_index)), json.dumps(method)))
            body = "checkCurve(ClosedSpline2D.create(%s),%s,%s,%s);checkCurve(%s,%s,%s,%s);" % (carrier(case["input"]), carrier(case["output"]), carrier(case["serialized"]), carrier(case["metadata"]), typed, carrier(case["output"]), carrier(case["serialized"]), carrier(case["metadata"]))
            body += "ClosedSpline2D object=" + "ClosedSpline2D.create(" + carrier(case["input"]) + ");ClosedSpline2D typed=" + typed + ";" + "".join(queries)
        methods.append("private static void case%d(){%s}" % (index, body))
        calls.append("case%d();" % index)
    query_methods = []
    query_calls = []
    for index, query in enumerate(fixture["query_cases"]):
        query_methods.append("private static void query%d(){expectError(new Action(){public void run(){VALID.sample(%s);}},%s,%s);}" % (index, carrier(query["input"]), json.dumps(query["error"]), json.dumps(query["id"])))
        query_calls.append("query%d();" % index)
    return """package org.procedurals.paths;
import java.util.*;
public final class ClosedSplineVectors {
 private static int assertions;
 private static final ClosedSpline2D VALID=ClosedSpline2D.create(new double[][]{{0,0},{2,0},{2,2}},8);
 private interface Action{void run();}
 private static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
 private static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
 private static void exact(Object e,Object a,String m){if(e instanceof Number){check(a instanceof Number&&Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){check(a instanceof List,m);List<?>x=(List<?>)e,y=(List<?>)a;check(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){check(a instanceof Map,m);Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;check(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}check(e==null?a==null:e.equals(a),m);}
 private static String code(Throwable t){return t instanceof ClosedSpline2D.SplineException?((ClosedSpline2D.SplineException)t).code:"?";}
 private static void expectError(Action a,String c,String m){try{a.run();throw new AssertionError(m+" missing error");}catch(ClosedSpline2D.SplineException e){check(c.equals(e.code),m);}}
 private static void checkCurve(ClosedSpline2D s,Object output,Object serialized,Object metadata){exact(output,s.serialize(),"output");exact(serialized,s.serialize(),"serialized");Map<?,?>m=(Map<?,?>)metadata;check(Double.doubleToRawLongBits(((Number)m.get("length")).doubleValue())==Double.doubleToRawLongBits(s.length()),"length");check(((Number)m.get("controlCount")).intValue()==s.controlCount(),"controlCount");check(((Number)m.get("subdivisions")).intValue()==s.subdivisions(),"subdivisions");}
 private static void checkQuery(ClosedSpline2D s,Object input,Object expected,String message,String mode){exact(expected,s.sample(input),message+" interchange");Map<?,?>q=(Map<?,?>)input;double v=((Number)q.get("value")).doubleValue();ClosedSpline2D.Sample sample="parameter".equals(mode)?s.sampleParameter(v):s.sampleDistance(v);Map<String,Object>actual=map("point",list(sample.x(),sample.y()),"tangent",list(sample.tangentX(),sample.tangentY()));exact(expected,actual,message);double[] target={99,99,99,99};if("parameter".equals(mode))s.sampleParameter(v,target);else s.sampleDistance(v,target);exact(expected,map("point",list(target[0],target[1]),"tangent",list(target[2],target[3])),message+" array");}
 %s
 %s
 public static void main(String[]a){%s%sSystem.out.println("{\\"status\\":\\"passed\\",\\"cases\\":%d,\\"assertions\\":"+assertions+"}");}
}
""" % (" ".join(methods), " ".join(query_methods), " ".join(calls), " ".join(query_calls), len(fixture["cases"]))


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=180, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/closed-spline-java.json")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    java, javac = args.java_home / "bin/java", args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CORE, NATIVE, ROOT / "design/operations/closed-spline-contract.md", Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="closed-spline-", dir=build_root))
    vectors = build / "ClosedSplineVectors.java"
    vectors.write_text(vector_source(fixture))
    run([str(javac), "--release", "8", "-d", str(build), str(CORE), str(NATIVE), str(vectors)], ROOT)
    artifacts = sorted(build.rglob("*.class"))
    artifact_before = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    vector_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.paths.ClosedSplineVectors"], ROOT).stdout)
    native_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.paths.ClosedSplineNative"], ROOT).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    artifact_after = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    if before != after or artifact_before != artifact_after:
        raise RuntimeError("bound input changed during check")
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("fixture or native checks failed")
    report = {"status":"passed","operation":"geometry.closed-spline-2d","fixture_cases_executed":vector_result["cases"],"vectors":vector_result,"native":native_result,"source_sha256_before":before,"source_sha256_after":after,"artifact_sha256_before":artifact_before,"artifact_sha256_after":artifact_after,"javac_release":"8","runtime":run([str(java),"-version"],ROOT).stderr.strip(),"scope":"Java core exact vectors and focused native ownership check; no renderer, distribution or port acceptance."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status":"passed","report":str(args.output)}))


if __name__ == "__main__":
    main()
