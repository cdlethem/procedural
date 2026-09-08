#!/usr/bin/env python3
"""Compile and run the focused CP11 Java core/native checks without rendering."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/paths/OccupiedLatticePaths2D.java"
NATIVE = ROOT / "tests/native/OccupiedLatticePathsNative.java"
CATALOG = ROOT / "catalog/operations/occupied-lattice-paths-2d.json"
FIXTURE = ROOT / "fixtures/operations/occupied-lattice-paths-2d.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def java_value(value: Any) -> str:
    if isinstance(value, str): return json.dumps(value)
    if isinstance(value, bool): return "Boolean.TRUE" if value else "Boolean.FALSE"
    if isinstance(value, (int, float)): return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list): return "list(" + ",".join(java_value(item) for item in value) + ")"
    if isinstance(value, dict):
        values: list[str] = []
        for key, item in value.items(): values.extend((java_value(key), java_value(item)))
        return "map(" + ",".join(values) + ")"
    raise TypeError(value)


def vectors_source(fixture: dict[str, Any]) -> str:
    calls=[]; methods=[]
    for index, case in enumerate(fixture["cases"]):
        calls.append("case%d();" % index)
        input_value=java_value(case["input"])
        if "output" in case:
            body="OccupiedLatticePaths2D p=OccupiedLatticePaths2D.generate(%s); exact(%s,p.toValues(),%s);" % (input_value,java_value(case["output"]),json.dumps(case["id"]))
        else:
            body="Throwable t=null;try{OccupiedLatticePaths2D.generate(%s);}catch(Throwable e){t=e;} check(t instanceof OccupiedLatticePaths2D.LatticeException,%s); equal(%s,((OccupiedLatticePaths2D.LatticeException)t).code,%s);" % (input_value,json.dumps(case["id"]),java_value(case["error"]),json.dumps(case["id"]))
        methods.append("static void case%d(){%s}" % (index,body))
    return """package org.procedurals.paths; import java.util.*; public final class OccupiedLatticeVectors { static int assertions; static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);} static void equal(Object e,Object a,String m){check(e==null?a==null:e.equals(a),m);} static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));} static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;} static void exact(Object e,Object a,String m){if(e instanceof Number){check(a instanceof Number&&Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){check(a instanceof List,m);List<?>x=(List<?>)e,y=(List<?>)a;check(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){check(a instanceof Map,m);Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;check(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}equal(e,a,m);} %s public static void main(String[]a){%s System.out.println(\"{\\\"status\\\":\\\"passed\\\",\\\"cases\\\":%d,\\\"assertions\\\":\"+assertions+\"}\");}}""" % (" ".join(methods)," ".join(calls),len(fixture["cases"]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/cp11-occupied-lattice-java.json")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() or ROOT / ".work" not in output.parents:
        raise RuntimeError("output must be a new file beneath .work")
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG) or fixture.get("comparison") != "exact":
        raise RuntimeError("frozen CP11 catalog/fixture binding mismatch")
    build_parent = ROOT / ".work/build"; build_parent.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="cp11-occupied-lattice-", dir=str(build_parent)))
    vectors = build / "OccupiedLatticeVectors.java"; vectors.write_text(vectors_source(fixture))
    command = [str(args.java_home / "bin/javac"), "--release", "8", "-d", str(build), str(CORE), str(NATIVE), str(vectors)]
    try:
        subprocess.run(command, cwd=ROOT, text=True, check=True, capture_output=True)
        vector_output = subprocess.run([str(args.java_home / "bin/java"), "-cp", str(build), "org.procedurals.paths.OccupiedLatticeVectors"], cwd=ROOT, text=True, check=True, capture_output=True)
        vectors_result = json.loads(vector_output.stdout)
        completed = subprocess.run([str(args.java_home / "bin/java"), "-cp", str(build), "org.procedurals.paths.OccupiedLatticePathsNative"], cwd=ROOT, text=True, check=True, capture_output=True)
        native = json.loads(completed.stdout)
    except subprocess.CalledProcessError as error:
        failure = {"status":"failed", "build":str(build), "command":error.cmd, "stdout":error.stdout, "stderr":error.stderr}
        (build / "failure.json").write_text(json.dumps(failure, indent=2) + "\n")
        raise SystemExit(json.dumps(failure))
    if native.get("status") != "passed" or vectors_result.get("cases") != len(fixture["cases"]): raise RuntimeError("vector/native check did not pass")
    report = {"status":"passed", "operation":"path.occupied-lattice-paths-2d", "scope":"Java core/native evidence only; no renderer, package, port or support claim.", "build":str(build), "catalog_sha256":digest(CATALOG), "fixture_sha256":digest(FIXTURE), "source_sha256":{"core":digest(CORE),"native":digest(NATIVE),"runner":digest(Path(__file__).resolve())}, "fixture_cases_available":len(fixture["cases"]), "fixture_cases_executed":vectors_result.get("cases"), "vectors":vectors_result, "native":native}
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status":"passed", "report":str(output), "assertions":native.get("assertions")}))


if __name__ == "__main__": main()
