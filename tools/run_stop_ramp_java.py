#!/usr/bin/env python3
"""Run CP14 Java StopRamp vectors, focused native checks, and bounded timings."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "packages/java/src/main/java/org/procedurals/color/StopRamp.java"
NATIVE = ROOT / "tests/native/StopRampNative.java"
CATALOG = ROOT / "catalog/operations/stop-ramp.json"
FIXTURE = ROOT / "fixtures/operations/stop-ramp.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def carrier(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "Boolean." + str(value).upper()
    if isinstance(value, (int, float)):
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list):
        return "list(" + ", ".join(carrier(item) for item in value) + ")"
    if isinstance(value, dict):
        entries = []
        for key, item in value.items():
            entries.extend((json.dumps(key), carrier(item)))
        return "map(" + ", ".join(entries) + ")"
    if isinstance(value, str):
        return json.dumps(value)
    raise TypeError("unsupported fixture carrier: " + repr(value))


def typed_call(case: dict) -> str:
    stops = case["input"]["stops"]
    positions = ", ".join(str(stop["position"]) for stop in stops)
    colors = ", ".join("(int) " + str(stop["color"]) + "L" for stop in stops)
    return "StopRamp.create(new double[] {%s}, new int[] {%s})" % (positions, colors)


def vector_source(fixture: dict) -> str:
    methods: list[str] = []
    calls: list[str] = []
    for index, case in enumerate(fixture["cases"]):
        case_id = json.dumps(case["id"])
        if "error" in case:
            body = (
                "expectError(new Action() { public void run() { StopRamp.create(%s); } }, %s, %s);"
                % (carrier(case["input"]), json.dumps(case["error"]), case_id)
            )
        else:
            query_inputs = "new Object[] {%s}" % ", ".join(
                carrier(query["input"]) for query in case["queries"]
            )
            query_outputs = "new Object[] {%s}" % ", ".join(
                carrier(query["output"]) for query in case["queries"]
            )
            query_checks = (
                "checkQueries(StopRamp.create(%s), %s, %s);"
                "checkQueries(%s, %s, %s);"
                % (carrier(case["input"]), query_inputs, query_outputs,
                   typed_call(case), query_inputs, query_outputs)
            )
            body = (
                "checkRamp(StopRamp.create(%s), %s, %s, %s);"
                "checkRamp(%s, %s, %s, %s);%s"
                % (carrier(case["input"]), carrier(case["output"]), carrier(case["serialized"]),
                   json.dumps(case["id"] + " object"), typed_call(case),
                   carrier(case["output"]), carrier(case["serialized"]),
                   json.dumps(case["id"] + " typed"), query_checks)
            )
        methods.append("    private static void case%d() { %s }" % (index, body))
        calls.append("case%d();" % index)

    query_methods: list[str] = []
    query_calls: list[str] = []
    for index, case in enumerate(fixture["query_cases"]):
        query_methods.append(
            "    private static void query%d() { expectError(new Action() { public void run() { VALID.sample(%s); } }, %s, %s); }"
            % (index, carrier(case["input"]), json.dumps(case["error"]), json.dumps(case["id"]))
        )
        query_calls.append("query%d();" % index)

    return """package org.procedurals.color;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class StopRampVectors {
    private static int assertions;
    private static final StopRamp VALID = StopRamp.create(new double[] {0.0, 1.0}, new int[] {0, 16777215});
    private interface Action { void run(); }

    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int index = 0; index < values.length; index += 2) result.put((String) values[index], values[index + 1]);
        return result;
    }
    private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
    private static void exact(Object expected, Object actual, String message) {
        if (expected instanceof Number) {
            check(actual instanceof Number && Double.doubleToRawLongBits(((Number) expected).doubleValue()) == Double.doubleToRawLongBits(((Number) actual).doubleValue()), message);
        } else if (expected instanceof List) {
            List<?> left = (List<?>) expected; List<?> right = (List<?>) actual;
            check(left.size() == right.size(), message);
            for (int index = 0; index < left.size(); index++) exact(left.get(index), right.get(index), message);
        } else if (expected instanceof Map) {
            Map<?, ?> left = (Map<?, ?>) expected; Map<?, ?> right = (Map<?, ?>) actual;
            check(left.keySet().equals(right.keySet()), message);
            for (Object key : left.keySet()) exact(left.get(key), right.get(key), message);
        } else {
            check(expected == null ? actual == null : expected.equals(actual), message);
        }
    }
    private static void checkRamp(StopRamp ramp, Object output, Object serialized, String message) {
        exact(output, ramp.serialize(), message + " output");
        exact(serialized, ramp.serialize(), message + " serialized");
    }
    private static void checkQueries(StopRamp ramp, Object[] inputs, Object[] outputs) {
        for (int index = 0; index < inputs.length; index++) exact(outputs[index], Integer.valueOf(ramp.sample(inputs[index])), "query " + index);
    }
    private static void expectError(Action action, String code, String message) {
        try { action.run(); throw new AssertionError(message + " missing error"); }
        catch (StopRamp.StopRampException error) { check(code.equals(error.code), message); }
    }
%s
%s
    public static void main(String[] args) {
        %s%s
        System.out.println("{\\"status\\":\\"passed\\",\\"fixture_cases\\":%d,\\"assertions\\":" + assertions + "}");
    }
}
""" % ("\n".join(methods), "\n".join(query_methods), "".join(calls), "".join(query_calls), len(fixture["cases"]))


def benchmark_source() -> str:
    return """package org.procedurals.color;

public final class StopRampBenchmark {
    private static StopRamp ramp(int count) {
        double[] positions = new double[count];
        int[] colors = new int[count];
        for (int index = 0; index < count; index++) {
            positions[index] = (double) index / (double) (count - 1);
            colors[index] = (index * 1103515245) & 0xFFFFFF;
        }
        return StopRamp.create(positions, colors);
    }
    public static void main(String[] args) {
        int[] counts = {4, 1024};
        for (int count : counts) {
            StopRamp ramp = ramp(count);
            for (int warmup = 0; warmup < 2; warmup++) for (int query = 0; query < 4096; query++) ramp.sample((double) query / 4095.0);
            long start = System.nanoTime();
            long checksum = 0L;
            for (int repetition = 0; repetition < 8; repetition++) {
                for (int query = 0; query < 4096; query++) checksum = checksum * 31L + (long) ramp.sample((double) query / 4095.0);
            }
            System.out.println(count + ",8,2," + (System.nanoTime() - start) + "," + Long.toUnsignedString(checksum));
        }
    }
}
"""


def execute(command: list[str], timeout: int = 180) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=True, timeout=timeout)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/stop-ramp-java-final.json")
    args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get("catalog_sha256") != digest(CATALOG):
        raise RuntimeError("fixture/catalog binding mismatch")

    java = args.java_home / "bin/java"
    javac = args.java_home / "bin/javac"
    modules = args.java_home / "lib/modules"
    release = args.java_home / "release"
    for required in (java, javac, modules, release):
        if not required.exists():
            raise RuntimeError("missing JDK runtime input: " + str(required))

    bound = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__), java, javac, modules, release]
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    report: dict[str, object] = {
        "operation": "color.stop-ramp",
        "fixture_cases": len(fixture["cases"]),
        "valid_cases_both_entrypoints": sum("output" in case for case in fixture["cases"]),
        "static_invalid_cases": sum("error" in case for case in fixture["cases"]),
        "query_error_cases": len(fixture["query_cases"]),
        "source_sha256_before": before,
        "javac_release": "8",
        "subprocess_timeout_seconds": 180,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    (ROOT / ".work/build").mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="stop-ramp-", dir=ROOT / ".work/build"))
    try:
        vectors = build / "StopRampVectors.java"
        vectors.write_text(vector_source(fixture))
        execute([str(javac), "--release", "8", "-d", str(build), str(CORE), str(NATIVE), str(vectors)])
        vector_result = json.loads(execute([str(java), "-cp", str(build), "org.procedurals.color.StopRampVectors"]).stdout)
        native_result = json.loads(execute([str(java), "-cp", str(build), "org.procedurals.color.StopRampNative"]).stdout)

        benchmark = build / "StopRampBenchmark.java"
        benchmark.write_text(benchmark_source())
        execute([str(javac), "--release", "8", "-cp", str(build), "-d", str(build), str(benchmark)])
        timings = []
        for line in execute([str(java), "-cp", str(build), "org.procedurals.color.StopRampBenchmark"]).stdout.splitlines():
            count, repetitions, warmups, elapsed, checksum = line.split(",")
            timings.append({
                "stops": int(count), "repetitions": int(repetitions), "warmups": int(warmups),
                "queries_per_repetition": 4096, "elapsed_ns_sampling_plus_checksum": int(elapsed),
                "checksum_unsigned64": checksum,
                "retained_core_bytes_estimate": {"positions": int(count) * 8, "colors": int(count) * 4},
            })
        after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
        if before != after:
            raise RuntimeError("bound input changed during check")
        report.update({
            "status": "passed", "vectors": vector_result, "native": native_result,
            "source_sha256_after": after, "runtime": execute([str(java), "-version"]).stderr.strip(),
            "benchmark_timing_scope": "typed scalar sample plus checksum; retained bytes are estimates, not allocation measurement",
            "benchmarks": timings,
            "scope": "Java core exact vectors/native evidence only; no renderer or support claim.",
        })
    except Exception as error:
        report.update({"status": "failed", "error": str(error)})
        args.output.write_text(json.dumps(report, indent=2) + "\n")
        raise
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "report": str(args.output)}))


if __name__ == "__main__":
    main()
