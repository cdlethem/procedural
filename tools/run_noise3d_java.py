#!/usr/bin/env python3
"""Run exact GradientNoise3D01 vectors and the focused Java native check."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/fields/GradientNoise3D01.java"
DEPENDENCY = ROOT / "packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java"
NATIVE = ROOT / "tests/native/Noise3DNative.java"
CATALOG = ROOT / "catalog/operations/gradient-noise-3d-01.json"
FIXTURE = ROOT / "fixtures/operations/gradient-noise-3d-01.json"
CONTRACT = ROOT / "design/operations/gradient-noise-3d-contract.md"
ORACLE_3D = ROOT / "tools/build_noise3d_fixtures.py"
ORACLE_2D = ROOT / "tools/build_noise_fixtures.py"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def carrier(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "Boolean." + str(value).upper()
    if isinstance(value, int):
        if -2147483648 <= value <= 2147483647:
            return str(value)
        return str(value) + "L"
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


def vector_source(fixture: dict) -> str:
    methods: list[str] = []
    calls: list[str] = []
    for index, case in enumerate(fixture["cases"]):
        case_id = case["id"]
        config = carrier(case["input"])
        if "error" in case:
            body = f"expectConstructorError({config},{json.dumps(case['error'])},{json.dumps(case_id)});"
        else:
            typed_seed = int(case["input"]["seed"])
            body = f"checkSerialize(GradientNoise3D01.create({config}),{carrier(case['serialized'])},{json.dumps(case_id + ' object')});"
            body += f"checkSerialize(GradientNoise3D01.create({typed_seed}L),{carrier(case['serialized'])},{json.dumps(case_id + ' typed')});"
            body += f"runQueries(GradientNoise3D01.create({config}),GradientNoise3D01.create({typed_seed}L),{json.dumps(case_id)}, {carrier(case['queries'])});"
        methods.append(f"private static void case{index}(){{{body}}}")
        calls.append(f"case{index}();")
    query_methods: list[str] = []
    query_calls: list[str] = []
    for index, query in enumerate(fixture["query_cases"]):
        query_methods.append(
            f"private static void query{index}(){{expectQueryError(VALID,{carrier(query['input'])},{json.dumps(query['error'])},{json.dumps(query['id'])});}}"
        )
        query_calls.append(f"query{index}();")
    return """package org.procedurals.fields;
import java.util.*;
public final class GradientNoise3DVectors {
 private static int assertions;
 private static final GradientNoise3D01 VALID=GradientNoise3D01.create(42L);
 private interface Action{void run();}
 private static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 private static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
 private static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 private static void exact(Object expected,Object actual,String message){
  if(expected instanceof Number){check(actual instanceof Number,message);check(Double.doubleToRawLongBits(((Number)expected).doubleValue())==Double.doubleToRawLongBits(((Number)actual).doubleValue()),message);return;}
  if(expected instanceof Map){check(actual instanceof Map,message);Map<?,?>x=(Map<?,?>)expected,y=(Map<?,?>)actual;check(x.keySet().equals(y.keySet()),message);for(Object k:x.keySet())exact(x.get(k),y.get(k),message);return;}
  if(expected instanceof List){check(actual instanceof List,message);List<?>x=(List<?>)expected,y=(List<?>)actual;check(x.size()==y.size(),message);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),message);return;}
  check(expected==null?actual==null:expected.equals(actual),message);
 }
 private static void checkSample(double actual,Object expected,String message){exact(expected,Double.valueOf(actual),message);}
 private static void checkSample(Object actual,Object expected,String message){exact(expected,actual,message);}
 private static void checkObjectScalars(GradientNoise3D01 field,Object x,Object y,Object z,Object expected,String message){checkSample(field.sample(x,y,z),expected,message);}
 private static void checkDoubleScalars(GradientNoise3D01 field,double x,double y,double z,Object expected,String message){checkSample(field.sample(x,y,z),expected,message);}
 private static void checkSerialize(GradientNoise3D01 field,Object expected,String message){Object first=field.serialize();Object second=field.serialize();exact(expected,first,message);exact(expected,second,message);check(first!=second,message+" detached");}
 private static void runQueries(GradientNoise3D01 object,GradientNoise3D01 typed,String id,Object rawQueries){List<?>queries=(List<?>)rawQueries;for(int i=0;i<queries.size();i++){Map<?,?>q=(Map<?,?>)queries.get(i);Object point=q.get("input");Object expected=q.get("output");String label=id+" "+i;List<?>p=(List<?>)point;Object x=p.get(0),y=p.get(1),z=p.get(2);checkSample(object.sample(point),expected,label+" object tuple");checkSample(typed.sample(point),expected,label+" typed tuple");checkObjectScalars(object,x,y,z,expected,label+" object scalars");checkObjectScalars(typed,x,y,z,expected,label+" typed scalars");checkDoubleScalars(object,((Number)x).doubleValue(),((Number)y).doubleValue(),((Number)z).doubleValue(),expected,label+" object doubles");checkDoubleScalars(typed,((Number)x).doubleValue(),((Number)y).doubleValue(),((Number)z).doubleValue(),expected,label+" typed doubles");}}
 private static void expectConstructorError(Object input,String expected,String message){try{GradientNoise3D01.create(input);throw new AssertionError(message+" missing error");}catch(GradientNoise3D01.NoiseException error){check(expected.equals(error.code),message);}}
 private static void expectQueryError(GradientNoise3D01 field,Object input,String expected,String message){try{field.sample(input);throw new AssertionError(message+" missing error");}catch(GradientNoise3D01.NoiseException error){check(expected.equals(error.code),message);}}
 %s
 %s
 public static void main(String[]args){%s%sSystem.out.println("{\\"status\\":\\"passed\\",\\"constructor_cases\\":%d,\\"query_cases\\":%d,\\"queries\\":%d,\\"assertions\\":"+assertions+"}");}
}
""" % (" ".join(methods), " ".join(query_methods), " ".join(calls), " ".join(query_calls), len(fixture["cases"]), len(fixture["query_cases"]), sum(len(case.get("queries", [])) for case in fixture["cases"]))


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=180, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/gradient-noise-3d-java.json")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")
    java, javac = args.java_home / "bin/java", args.java_home / "bin/javac"
    bound = [CATALOG, FIXTURE, CONTRACT, CORE, DEPENDENCY, NATIVE, ORACLE_3D, ORACLE_2D, Path(__file__), java, javac, args.java_home / "release", args.java_home / "lib/modules"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="gradient-noise-3d-", dir=build_root))
    vectors = build / "GradientNoise3DVectors.java"
    vectors.write_text(vector_source(fixture))
    run([str(javac), "--release", "8", "-d", str(build), str(CORE), str(DEPENDENCY), str(NATIVE), str(vectors)], ROOT)
    artifacts = sorted(build.rglob("*.class"))
    artifact_before = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    vector_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.fields.GradientNoise3DVectors"], ROOT).stdout)
    native_result = json.loads(run([str(java), "-cp", str(build), "org.procedurals.fields.Noise3DNative"], ROOT).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    artifact_after = {str(path.relative_to(ROOT)): digest(path) for path in artifacts}
    if before != after or artifact_before != artifact_after:
        raise RuntimeError("bound input changed during check")
    if vector_result.get("status") != "passed" or native_result.get("status") != "passed":
        raise RuntimeError("fixture or native checks failed")
    report = {"status": "passed", "operation": fixture["operation"], "constructor_cases_executed": vector_result["constructor_cases"], "query_error_cases_executed": vector_result["query_cases"], "scalar_queries_executed": vector_result["queries"], "vectors": vector_result, "native": native_result, "source_sha256_before": before, "source_sha256_after": after, "artifact_sha256_before": artifact_before, "artifact_sha256_after": artifact_after, "javac_release": "8", "runtime": run([str(java), "-version"], ROOT).stderr.strip(), "scope": "Java core exact vectors and focused native ownership/performance check; no renderer, distribution or port acceptance."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "report": str(args.output)}))


if __name__ == "__main__":
    main()
