#!/usr/bin/env python3
"""Compile and run the live seeded line-pool Java fixture and native checks."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/topology/LinePool2D.java"
NATIVE = ROOT / "tests/native/LinePoolNative.java"
CATALOG = ROOT / "catalog/operations/seeded-line-pool-2d.json"
FIXTURE = ROOT / "fixtures/operations/seeded-line-pool-2d.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def java_value(value: Any) -> str:
    if value is None: return "null"
    if isinstance(value, bool): return "Boolean.TRUE" if value else "Boolean.FALSE"
    if isinstance(value, str): return json.dumps(value)
    if isinstance(value, (int, float)): return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list): return "list(" + ",".join(java_value(v) for v in value) + ")"
    if isinstance(value, dict):
        return "map(" + ",".join(java_value(v) for pair in value.items() for v in pair) + ")"
    raise TypeError(value)


def vectors_source(fixture: dict[str, Any]) -> str:
    methods, calls = [], []
    for index, case in enumerate(fixture["cases"]):
        invocation = "LinePool2D.generate(" + java_value(case["input"]) + ")"
        if "output" in case:
            body = "exact(" + java_value(case["output"]) + "," + invocation + ".toValues()," + json.dumps(case["id"]) + ");"
        else:
            detail = java_value(case["error_detail"])
            body = ("Throwable t=null;try{" + invocation + ";}catch(Throwable e){t=e;}"
                    "check(t!=null," + json.dumps(case["id"]) + ");"
                    "check(code(t).equals(" + json.dumps(case["error"]) + ")," + json.dumps(case["id"]) + ");"
                    "exact(" + detail + ",detail(t)," + json.dumps(case["id"]) + ");")
        methods.append("static void case%d(){%s}" % (index, body))
        calls.append("case%d();" % index)
    return '''package org.procedurals.topology;
import java.util.*;
public final class LinePoolVectors {
 static int assertions;
 static void check(boolean v,String m){assertions++;if(!v)throw new AssertionError(m);}
 static List<Object> list(Object...v){return new ArrayList<Object>(Arrays.asList(v));}
 static Map<String,Object> map(Object...v){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m;}
 static String code(Throwable t){if(t instanceof LinePool2D.LinePoolException)return ((LinePool2D.LinePoolException)t).code;if(t instanceof LinePool2D.ArithmeticOverflowException)return ((LinePool2D.ArithmeticOverflowException)t).code;if(t instanceof LinePool2D.SegmentLimitException)return ((LinePool2D.SegmentLimitException)t).code;return "?";}
 static Map<String,Object> detail(Throwable t){if(t instanceof LinePool2D.ArithmeticOverflowException){LinePool2D.ArithmeticOverflowException e=(LinePool2D.ArithmeticOverflowException)t;Map<String,Object>m=map("attempt",e.attempt,"stage",e.stage);if(e.childOrdinal!=null)m.put("childOrdinal",e.childOrdinal);return m;}if(t instanceof LinePool2D.SegmentLimitException){LinePool2D.SegmentLimitException e=(LinePool2D.SegmentLimitException)t;return map("attempt",e.attempt,"selectedIndex",e.selectedIndex);}return map();}
 static void exact(Object e,Object a,String m){if(e instanceof Number){check(a instanceof Number&&Double.doubleToRawLongBits(((Number)e).doubleValue())==Double.doubleToRawLongBits(((Number)a).doubleValue()),m);return;}if(e instanceof List){check(a instanceof List,m);List<?>x=(List<?>)e,y=(List<?>)a;check(x.size()==y.size(),m);for(int i=0;i<x.size();i++)exact(x.get(i),y.get(i),m);return;}if(e instanceof Map){check(a instanceof Map,m);Map<?,?>x=(Map<?,?>)e,y=(Map<?,?>)a;check(x.keySet().equals(y.keySet()),m);for(Object k:x.keySet())exact(x.get(k),y.get(k),m);return;}check(e==null?a==null:e.equals(a),m);}
 ''' + " ".join(methods) + " public static void main(String[]a){" + " ".join(calls) + "System.out.println(\"{\\\"status\\\":\\\"passed\\\",\\\"cases\\\":" + str(len(fixture["cases"])) + ",\\\"assertions\\\":\"+assertions+\"}\");}}\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/seeded-line-pool-java.json")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() or ROOT / ".work" not in output.parents: raise RuntimeError("output must be a new file beneath .work")
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if fixture.get("catalog_sha256") != digest(CATALOG) or fixture.get("comparison") != "exact": raise RuntimeError("fixture/catalog binding mismatch")
    bound = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__).resolve()]
    before = {str(p.relative_to(ROOT)): digest(p) for p in bound}
    (ROOT / ".work/build").mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="seeded-line-pool-java-", dir=str(ROOT / ".work/build")))
    vectors = build / "LinePoolVectors.java"; vectors.write_text(vectors_source(fixture), encoding="utf-8")
    def run(cmd: list[str], timeout: int = 180) -> subprocess.CompletedProcess[str]:
        return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=True, timeout=timeout)
    try:
        run([str(args.java_home / "bin/javac"), "--release", "8", "-d", str(build), str(CORE), str(NATIVE), str(vectors)])
        vectors_result = json.loads(run([str(args.java_home / "bin/java"), "-cp", str(build), "org.procedurals.topology.LinePoolVectors"]).stdout)
        native = json.loads(run([str(args.java_home / "bin/java"), "-cp", str(build), "org.procedurals.topology.LinePoolNative"]).stdout)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        failure = {"status": "failed", "build": str(build), "error": str(error)}
        if isinstance(error, subprocess.CalledProcessError):
            failure.update({"command": error.cmd, "stdout": error.stdout, "stderr": error.stderr})
        (build / "failure.json").write_text(json.dumps(failure, indent=2) + "\n", encoding="utf-8")
        raise SystemExit(json.dumps(failure))
    after = {str(p.relative_to(ROOT)): digest(p) for p in bound}
    if before != after: raise RuntimeError("bound source changed during conformance")
    if vectors_result.get("status") != "passed" or native.get("status") != "passed": raise RuntimeError("vector/native check did not pass")
    report = {"status":"passed", "operation":"topology.seeded-line-pool-2d", "scope":"Java core exact live fixture and native ownership/access evidence only; no renderer, package, ports or support claim.", "catalog_sha256":digest(CATALOG), "fixture_sha256":digest(FIXTURE), "source_sha256_before":before, "source_sha256_after":after, "generated_vectors_sha256":digest(vectors), "fixture_cases_available":len(fixture["cases"]), "fixture_cases_executed":vectors_result.get("cases"), "vectors":vectors_result, "native":native, "runtime":run([str(args.java_home / "bin/java"), "-version"]).stderr.strip(), "javac_release":"8", "jdk_home":str(args.java_home.resolve())}
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status":"passed", "report":str(output), "assertions":native.get("assertions")}))

if __name__ == "__main__": main()
