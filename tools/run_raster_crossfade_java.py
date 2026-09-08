#!/usr/bin/env python3
"""Run raster crossfade exact vectors, focused Java carrier checks, and bounded timings."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/raster/RasterCrossfade2D.java"
NATIVE = ROOT / "tests/native/RasterCrossfadeNative.java"
CATALOG = ROOT / "catalog/operations/raster-crossfade.json"
FIXTURE = ROOT / "fixtures/operations/raster-crossfade.json"


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
        return "list(" + ",".join(carrier(item) for item in value) + ")"
    if isinstance(value, dict):
        pairs: list[str] = []
        for key, item in value.items():
            pairs.extend((json.dumps(key), carrier(item)))
        return "map(" + ",".join(pairs) + ")"
    raise TypeError("unsupported fixture carrier: " + repr(value))


def typed(case: dict) -> str:
    value = case["input"]
    first = ",".join("(int)" + str(pixel) + "L" for pixel in value["first"]["pixels"])
    second = ",".join("(int)" + str(pixel) + "L" for pixel in value["second"]["pixels"])
    weights = ",".join(str(number) for number in value["weights"])
    return "RasterCrossfade2D.mix(%s,%s,new int[]{%s},new int[]{%s},new double[]{%s})" % (
        value["first"]["width"], value["first"]["height"], first, second, weights)


def vector_source(fixture: dict) -> str:
    bodies: list[str] = []
    calls: list[str] = []
    for index, case in enumerate(fixture["cases"]):
        call = "RasterCrossfade2D.mix(" + carrier(case["input"]) + ")"
        case_id = json.dumps(case["id"])
        if "output" in case:
            body = "exact(%s,%s.toValues(),%s);exact(%s,%s.toValues(),%s);" % (
                carrier(case["output"]), call, json.dumps(case["id"] + " object"),
                carrier(case["output"]), typed(case), json.dumps(case["id"] + " typed"))
        else:
            body = "expect(new Action(){public void run(){%s;}},%s,%s);" % (
                call, json.dumps(case["error"]), case_id)
        bodies.append("static void c%d(){%s}" % (index, body))
        calls.append("c%d();" % index)
    return """package org.procedurals.raster;
import java.util.*;
public final class RasterCrossfadeVectors {
  static int assertions;
  interface Action { void run(); }
  static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  static Map<String,Object> map(Object... values) { Map<String,Object> result=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2) result.put((String)values[i],values[i+1]); return result; }
  static void ok(boolean value,String message) { assertions++; if(!value) throw new AssertionError(message); }
  static void exact(Object expected,Object actual,String message) { if(expected instanceof Number) { ok(actual instanceof Number && Double.doubleToRawLongBits(((Number)expected).doubleValue())==Double.doubleToRawLongBits(((Number)actual).doubleValue()),message); return; } if(expected instanceof List) { ok(actual instanceof List,message); List<?> a=(List<?>)expected,b=(List<?>)actual; ok(a.size()==b.size(),message); for(int i=0;i<a.size();i++) exact(a.get(i),b.get(i),message); return; } if(expected instanceof Map) { ok(actual instanceof Map,message); Map<?,?> a=(Map<?,?>)expected,b=(Map<?,?>)actual; ok(a.keySet().equals(b.keySet()),message); for(Object key:a.keySet()) exact(a.get(key),b.get(key),message); return; } ok(expected==null ? actual==null : expected.equals(actual),message); }
  static void expect(Action action,String code,String message) { try { action.run(); throw new AssertionError(message+" missing error"); } catch(RasterCrossfade2D.RasterCrossfadeException error) { ok(code.equals(error.code),message); } }
  %s
  public static void main(String[] args) { %s System.out.println("{\\\"status\\\":\\\"passed\\\",\\\"cases\\\":%d,\\\"assertions\\\":"+assertions+"}"); }
}
""" % (" ".join(bodies), " ".join(calls), len(fixture["cases"]))


def execute(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=90, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/raster-crossfade-java.json")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    java = args.java_home / "bin/java"
    javac = args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="raster-crossfade-", dir=build_root))
    vectors = build / "RasterCrossfadeVectors.java"
    vectors.write_text(vector_source(fixture))
    execute([str(javac), "--release", "8", "-d", str(build), str(CORE), str(NATIVE), str(vectors)])
    vector_result = json.loads(execute([str(java), "-cp", str(build), "org.procedurals.raster.RasterCrossfadeVectors"]).stdout)
    native_result = json.loads(execute([str(java), "-cp", str(build), "org.procedurals.raster.RasterCrossfadeNative"]).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    if before != after:
        raise RuntimeError("bound input changed during check")
    report = {
        "status": "passed", "operation": "raster.crossfade-2d",
        "fixture_cases": len(fixture["cases"]), "vectors": vector_result, "native": native_result,
        "source_sha256_before": before, "source_sha256_after": after, "javac_release": "8",
        "runtime": execute([str(java), "-version"]).stderr.strip(),
        "scope": "Java core exact vectors and focused ownership/carrier checks; no native renderer or support claim."
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "report": str(args.output)}))


if __name__ == "__main__":
    main()
