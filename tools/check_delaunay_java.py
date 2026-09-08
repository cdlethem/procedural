#!/usr/bin/env python3
"""Compile and run frozen CP9 Java shared vectors plus native ownership checks."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.check_delaunay_fixtures import validate

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog/operations/delaunay-2d.json"
FIXTURE = ROOT / "fixtures/operations/delaunay-2d.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/topology/Delaunay2D.java"
NATIVE = ROOT / "tests/native/Delaunay2DNative.java"
CHECKER = ROOT / "tools/check_delaunay_fixtures.py"
REVIEW = ROOT / "evidence/investigations/cp9-target-metadata-review.json"
FROZEN_CATALOG = "e73d947703e0b0f798c95a3d3d0274b0e597aabc0e43a74303c971a5b39febcf"
FROZEN_FIXTURE = "2f2166e90dbab6345fda3148e65aae6079fcd0de96f6a9752ade3ed80c68a4d4"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def invoke(args: list[Path | str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    command = [str(item) for item in args]
    try:
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=True, timeout=timeout)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        stdout = getattr(error, "stdout", "") or ""
        stderr = getattr(error, "stderr", "") or ""
        raise RuntimeError("command failed: " + " ".join(command) + "\n" + stdout + stderr) from error


def jvalue(value: Any) -> str:
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
        return "list(" + ", ".join(jvalue(item) for item in value) + ")"
    if isinstance(value, dict):
        pairs: list[str] = []
        for key, item in value.items():
            pairs.extend((jvalue(key), jvalue(item)))
        return "map(" + ", ".join(pairs) + ")"
    raise TypeError(value)


def joutput(value: Any, field: str | None = None) -> str:
    """Emit a Java expected output with its frozen scalar carrier types."""
    if isinstance(value, dict):
        pairs: list[str] = []
        for key, item in value.items():
            pairs.extend((jvalue(key), joutput(item, key)))
        return "map(" + ", ".join(pairs) + ")"
    if isinstance(value, list):
        return "list(" + ", ".join(joutput(item, field) for item in value) + ")"
    if isinstance(value, float):
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, int):
        if field == "workUsed":
            return "Long.valueOf(" + str(value) + "L)"
        return "Integer.valueOf(" + str(value) + ")"
    raise TypeError(value)


def vectors_source(fixture: dict[str, Any]) -> str:
    methods: list[str] = []
    calls: list[str] = []
    for ordinal, case in enumerate(fixture["cases"]):
        calls.append("case%d();" % ordinal)
        body = ["Object input = " + jvalue(case["input"]) + ";"]
        if "error" in case:
            body.extend([
                "try { Delaunay2D.triangulate(input); fail(\"expected error\"); }",
                "catch (Throwable error) { equal(\"%s\", code(error), \"error code\"); }" % case["error"],
            ])
            detail = case.get("error_detail")
            if detail:
                body[-1] = ("catch (Throwable error) { equal(\"%s\", code(error), \"error code\"); "
                            "equal(%dL, longField(error, \"workUsed\"), \"workUsed\"); "
                            "equal(\"%s\", stringField(error, \"stage\"), \"stage\"); }") % (
                                case["error"], detail["workUsed"], detail["stage"])
        else:
            output = case["output"]
            body.extend([
                "Delaunay2D result = Delaunay2D.triangulate(input);",
                "equal(%d, result.inputCount(), \"input count\");" % len(case["input"]["points"]),
                "equal(%d, result.vertexCount(), \"vertex count\");" % len(output["points"]),
                "equal(%d, result.faceCount(), \"face count\");" % len(output["triangles"]),
                "equal(%d, result.edgeCount(), \"edge count\");" % len(output["edges"]),
                "equal(%dL, result.workUsed(), \"work used\");" % output["workUsed"],
                "deep(" + joutput(output) + ", result.toValues(), \"toValues\");",
            ])
            for point_index, point in enumerate(output["points"]):
                body.append("double[] point%d = result.pointAt(%dL);" % (point_index, point_index))
                for axis, bits in enumerate(case["comparison"]["points_bits_hex"][point_index]):
                    body.append("raw(point%d[%d], \"%s\", \"point %d/%d\");" % (point_index, axis, bits, point_index, axis))
                body.append("equal(%d, result.sourceIndexAt(%dL), \"source index\");" % (output["sourceIndices"][point_index], point_index))
            for input_index, vertex in enumerate(output["inputToVertex"]):
                body.append("equal(%d, result.inputVertexAt(%dL), \"input mapping\");" % (vertex, input_index))
            for field, method in (("triangles", "triangleAt"), ("edges", "edgeAt"), ("edgeFaces", "edgeFacesAt")):
                for index, row in enumerate(output[field]):
                    body.append("ints(result.%s(%dL), new int[]{%s}, \"%s %d\");" % (method, index, ",".join(map(str, row)), field, index))
        methods.append("  private static void case%d() {\n    %s\n  }" % (ordinal, "\n    ".join(body)))
    return """package org.procedurals.topology;
import java.lang.reflect.*;
import java.util.*;
/** Generated from the frozen shared CP9 JSON fixture; no schedule oracle is called. */
public final class Delaunay2DVectors {
  private static int assertions;
  private static void check(boolean value, String label) { assertions++; if (!value) throw new AssertionError(label); }
  private static void fail(String label) { throw new AssertionError(label); }
  private static void equal(int expected, int actual, String label) { check(expected == actual, label); }
  private static void equal(long expected, long actual, String label) { check(expected == actual, label); }
  private static void equal(String expected, String actual, String label) { check(expected.equals(actual), label); }
  private static void raw(double actual, String bits, String label) { check(Double.doubleToRawLongBits(actual) == Long.parseUnsignedLong(bits, 16), label); }
  private static void ints(int[] actual, int[] expected, String label) { check(Arrays.equals(actual, expected), label); }
  private static void deep(Object expected, Object actual, String label) {
    if (expected instanceof Double) { check(actual instanceof Double, label + " double carrier"); raw(((Double) actual).doubleValue(), Long.toUnsignedString(Double.doubleToRawLongBits(((Double) expected).doubleValue()), 16), label); return; }
    if (expected instanceof Integer) { check(actual instanceof Integer && ((Integer) expected).intValue() == ((Integer) actual).intValue(), label + " integer"); return; }
    if (expected instanceof Long) { check(actual instanceof Long && ((Long) expected).longValue() == ((Long) actual).longValue(), label + " long"); return; }
    if (expected instanceof List) { check(actual instanceof List, label + " list carrier"); List<?> e = (List<?>) expected, a = (List<?>) actual; check(e.size() == a.size(), label + " list size"); for (int i = 0; i < e.size(); i++) deep(e.get(i), a.get(i), label + "/" + i); return; }
    if (expected instanceof Map) { check(actual instanceof Map, label + " map carrier"); Map<?,?> e = (Map<?,?>) expected, a = (Map<?,?>) actual; check(e.keySet().equals(a.keySet()), label + " map keys"); for (Object key : e.keySet()) deep(e.get(key), a.get(key), label + "/" + key); return; }
    throw new AssertionError(label + " unexpected expected carrier");
  }
  private static List<Object> list(Object... items) { return new ArrayList<Object>(Arrays.asList(items)); }
  private static Map<String,Object> map(Object... items) { Map<String,Object> result = new LinkedHashMap<String,Object>(); for (int i = 0; i < items.length; i += 2) result.put((String) items[i], items[i + 1]); return result; }
  private static String code(Throwable error) { try { return (String) error.getClass().getField("code").get(error); } catch (ReflectiveOperationException ignored) { return null; } }
  private static long longField(Throwable error, String field) { try { return ((Number) error.getClass().getField(field).get(error)).longValue(); } catch (ReflectiveOperationException ignored) { throw new AssertionError(field, ignored); } }
  private static String stringField(Throwable error, String field) { try { return (String) error.getClass().getField(field).get(error); } catch (ReflectiveOperationException ignored) { throw new AssertionError(field, ignored); } }
%s
  public static void main(String[] args) { %s System.out.println("{\\\"status\\\":\\\"passed\\\",\\\"fixture_cases\\\":%d,\\\"assertions\\\":" + assertions + "}"); }
}
""" % ("\n".join(methods), "".join(calls), len(fixture["cases"]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--build-dir", type=Path, required=True,
                        help="new ignored build directory; existing directories are never reused")
    parser.add_argument("--output", type=Path, required=True,
                        help="new report path; an existing report is never overwritten")
    args = parser.parse_args()
    if sha(CATALOG) != FROZEN_CATALOG or sha(FIXTURE) != FROZEN_FIXTURE:
        raise RuntimeError("frozen CP9 catalog/fixture hash mismatch")
    operation = json.loads(CATALOG.read_text(encoding="utf-8"))
    operation["_file"] = CATALOG.name
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    errors = validate(ROOT, "delaunay", operation, fixture)
    if errors:
        raise RuntimeError("fixture validation failed:\n" + "\n".join(errors))
    if fixture.get("catalog_sha256") != sha(CATALOG):
        raise RuntimeError("fixture catalog binding is stale")
    if not CORE.is_file():
        raise RuntimeError("Delaunay2D core source is not available")
    bound = [CATALOG, FIXTURE, REVIEW, CHECKER, CORE, NATIVE, Path(__file__).resolve()]
    before = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    build = args.build_dir if args.build_dir.is_absolute() else ROOT / args.build_dir
    output = args.output if args.output.is_absolute() else ROOT / args.output
    if build.exists():
        raise RuntimeError("refusing to reuse existing build directory: " + str(build))
    if output.exists():
        raise RuntimeError("refusing to overwrite existing report: " + str(output))
    build.mkdir(parents=True)
    generated = build / "Delaunay2DVectors.java"
    generated.write_text(vectors_source(fixture), encoding="utf-8")
    result_path = build / "result.json"
    try:
        invoke([args.java_home / "bin/javac", "--release", "8", "-d", build, CORE, generated, NATIVE])
        vectors = json.loads(invoke([args.java_home / "bin/java", "-cp", build, "org.procedurals.topology.Delaunay2DVectors"]).stdout)
        native = json.loads(invoke([args.java_home / "bin/java", "-cp", build, "org.procedurals.topology.Delaunay2DNative"]).stdout)
        if vectors.get("status") != "passed" or native.get("status") != "passed":
            raise RuntimeError("native process did not report passed")
        after = {str(path.relative_to(ROOT)): sha(path) for path in bound}
        if before != after:
            raise RuntimeError("bound sources changed during run")
        report = {
            "operation": operation["id"], "status": "passed",
            "scope": "Frozen CP9 Java core fixture and native ownership/access evidence only; no renderer, package, performance-plan, or other-target claim.",
            "catalog_sha256": sha(CATALOG), "fixture_sha256": sha(FIXTURE),
            "source_sha256_before": before, "source_sha256_after": after,
            "generated_vectors_sha256": sha(generated),
            "runtime": invoke([args.java_home / "bin/java", "-version"]).stderr.strip(),
            "vectors": vectors, "native": native,
        }
        result_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"status": "passed", "cases": len(fixture["cases"]), "report": str(output)}, sort_keys=True))
        return 0
    except Exception as error:
        result_path.write_text(json.dumps({"status": "failed", "error": str(error), "source_sha256_before": before}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
