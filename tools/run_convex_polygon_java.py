#!/usr/bin/env python3
"""Run exact ordered convex polygon filter vectors and the focused Java native check."""
from __future__ import annotations
import argparse
import hashlib
import json
import struct
import subprocess
import tempfile
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_noise3d_java import carrier

def jcarrier(value: object) -> str:
    if value is None:
        return "(Object)null"
    if isinstance(value, list):
        return "list(" + ",".join(jcarrier(item) for item in value) + ")"
    if isinstance(value, dict):
        return "map(" + ",".join(carrier(key) + "," + jcarrier(item) for key, item in value.items()) + ")"
    return carrier(value)

CORE = ROOT / "packages/java/src/main/java/org/procedurals/sampling/ConvexPolygonPlacements2D.java"
NATIVE = ROOT / "tests/native/ConvexPolygonNative.java"
CATALOG = ROOT / "catalog/operations/ordered-convex-polygon-filter-2d.json"
FIXTURE = ROOT / "fixtures/operations/ordered-convex-polygon-filter-2d.json"
CONTRACT = ROOT / "design/operations/convex-polygon-placement-contract.md"
ORACLE = ROOT / "tools/build_convex_polygon_fixtures.py"
CARRIER_HELPER = ROOT / "tools/run_noise3d_java.py"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def typed_number(value: object) -> str:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError("not a numeric coordinate")
    number = float(value)
    bits = struct.unpack(">Q", struct.pack(">d", number))[0]
    return "Double.longBitsToDouble(0x%016xL)" % bits


def typed_polygons(value: dict) -> str | None:
    if not isinstance(value, dict) or set(value) != {"polygons"}:
        return None
    polygons = value.get("polygons")
    if polygons is None:
        return "(double[][][])null"
    if not isinstance(polygons, list):
        return None
    rows = []
    for polygon in polygons:
        if polygon is None:
            rows.append("null")
            continue
        if not isinstance(polygon, list):
            return None
        vertices = []
        for vertex in polygon:
            if vertex is None:
                vertices.append("null")
                continue
            if not isinstance(vertex, list):
                return None
            try:
                vertices.append("new double[]{%s}" % ",".join(typed_number(v) for v in vertex))
            except TypeError:
                return None
        rows.append("new double[][]{%s}" % ",".join(vertices))
    return "new double[][][]{%s}" % ",".join(rows)


def vector_source(fixture: dict) -> str:
    methods, calls = [], []
    typed_count = 0
    for index, case in enumerate(fixture["cases"]):
        cid = json.dumps(case["id"])
        config = jcarrier(case["input"])
        expected_error = case.get("error")
        typed = typed_polygons(case["input"])
        if expected_error is not None:
            body = "expectError(%s,%s,%s,%s);" % (config, json.dumps(expected_error), str(case["candidateIndex"]), cid)
            if typed is not None:
                body += "expectTypedError(%s,%s,%s,%s);" % (typed, json.dumps(expected_error), str(case["candidateIndex"]), cid)
                typed_count += 1
        else:
            body = "checkResult(ConvexPolygonPlacements2D.filter(%s),%s,%s);" % (config, jcarrier(case["output"]), cid)
            if typed is None:
                raise ValueError("success case is not typed-representable: " + case["id"])
            body += "checkResult(ConvexPolygonPlacements2D.filter(%s),%s,%s);" % (typed, jcarrier(case["output"]), json.dumps(case["id"] + " typed"))
            typed_count += 1
        methods.append("private static void case%d(){%s}" % (index, body))
        calls.append("case%d();" % index)
    return r'''package org.procedurals.sampling;
import java.util.*;
public final class ConvexPolygonVectors {
 private static int assertions;
 private static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 private static List<Object> list(Object... values){return new ArrayList<Object>(Arrays.asList(values));}
 private static Map<String,Object> map(Object... values){Map<String,Object> result=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);return result;}
 private static void exact(Object expected,Object actual,String message){
  if(expected instanceof Number){check(actual instanceof Number,message);check(Double.doubleToRawLongBits(((Number)expected).doubleValue())==Double.doubleToRawLongBits(((Number)actual).doubleValue()),message);return;}
  if(expected instanceof List){check(actual instanceof List,message);List<?> a=(List<?>)expected,b=(List<?>)actual;check(a.size()==b.size(),message);for(int i=0;i<a.size();i++)exact(a.get(i),b.get(i),message);return;}
  if(expected instanceof Map){check(actual instanceof Map,message);Map<?,?> a=(Map<?,?>)expected,b=(Map<?,?>)actual;check(a.keySet().equals(b.keySet()),message);for(Object key:a.keySet())exact(a.get(key),b.get(key),message);return;}
  check(expected==null?actual==null:expected.equals(actual),message);
 }
 private static void checkAccessors(ConvexPolygonPlacements2D result,Object expected,String message){
  Map<?,?> output=(Map<?,?>)expected;List<?> polygons=(List<?>)output.get("polygons");List<?> indices=(List<?>)output.get("sourceIndices");
  check(result.attempts()==((Number)output.get("attempts")).intValue(),message+" attempts");check(result.size()==polygons.size(),message+" size");
  for(int i=0;i<polygons.size();i++){List<?> polygon=(List<?>)polygons.get(i);check(result.sourceIndexAt((long)i)==((Number)indices.get(i)).intValue(),message+" source");check(result.vertexCountAt((long)i)==polygon.size(),message+" count");for(int j=0;j<polygon.size();j++){List<?> point=(List<?>)polygon.get(j);exact(point.get(0),Double.valueOf(result.xAt((long)i,(long)j)),message+" x");exact(point.get(1),Double.valueOf(result.yAt((long)i,(long)j)),message+" y");}}
 }
 private static void checkResult(ConvexPolygonPlacements2D result,Object expected,String message){Object first=result.toValues(),second=result.toValues();exact(expected,first,message);exact(expected,second,message);check(first!=second,message+" detached");checkAccessors(result,expected,message);}
 private static void expectError(Object input,String code,int candidate,String message){try{ConvexPolygonPlacements2D.filter(input);throw new AssertionError(message+" missing error");}catch(ConvexPolygonPlacements2D.PlacementException error){check(code.equals(error.code),message+" code");check(candidate==error.candidateIndex,message+" candidate");}}
 private static void expectTypedError(double[][][] input,String code,int candidate,String message){try{ConvexPolygonPlacements2D.filter(input);throw new AssertionError(message+" missing typed error");}catch(ConvexPolygonPlacements2D.PlacementException error){check(code.equals(error.code),message+" typed code");check(candidate==error.candidateIndex,message+" typed candidate");}}
 %s
 public static void main(String[] args){%sSystem.out.println("{\"status\":\"passed\",\"constructor_cases\":%d,\"typed_cases\":%d,\"assertions\":"+assertions+"}");}
}
''' % (" ".join(methods), " ".join(calls), len(fixture["cases"]), typed_count)


def run(command: list[object], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run([str(item) for item in command], cwd=cwd, text=True, capture_output=True, timeout=180, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/ordered-convex-polygon-filter-java.json")
    args = parser.parse_args()
    output = args.output.resolve()
    work = (ROOT / ".work").resolve()
    if not output.is_relative_to(work) or output.exists():
        raise ValueError("Preserve attempts: require a fresh output below .work")
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    args.java_home = args.java_home.resolve()
    java, javac = args.java_home / "bin/java", args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CONTRACT, CORE, NATIVE, ORACLE, CARRIER_HELPER, Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"; build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="convex-polygon-", dir=build_root))
    vectors = build / "ConvexPolygonVectors.java"; vectors.write_text(vector_source(fixture))
    run([javac, "--release", "8", "-d", build, CORE, NATIVE, vectors], ROOT)
    artifacts = [vectors, *sorted(build.rglob("*.class"))]; artifact_before = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    vector_result = json.loads(run([java, "-cp", build, "org.procedurals.sampling.ConvexPolygonVectors"], ROOT).stdout)
    native_result = json.loads(run([java, "-cp", build, "org.procedurals.sampling.ConvexPolygonNative"], ROOT).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}; artifact_after = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    if before != after or artifact_before != artifact_after: raise RuntimeError("bound input or generated artifact changed during check")
    if vector_result.get("status") != "passed" or (native_result is not None and native_result.get("status") != "passed"): raise RuntimeError("fixture or native checks failed")
    report = {"status":"passed","operation":fixture["operation"],"constructor_cases_executed":vector_result["constructor_cases"],"typed_cases_executed":vector_result["typed_cases"],"vectors":vector_result,"native":native_result,"source_sha256_before":before,"source_sha256_after":after,"artifact_sha256_before":artifact_before,"artifact_sha256_after":artifact_after,"javac_release":"8","runtime":run([java,"-version"],ROOT).stderr.strip(),"scope":"Java core exact vectors and focused native ownership/workload check; no renderer, distribution or port acceptance."}
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report,indent=2)+"\n"); print(json.dumps({"status":"passed","report":str(output)}))

if __name__ == "__main__": main()
