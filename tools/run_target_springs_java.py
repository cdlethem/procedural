#!/usr/bin/env python3
"""Compile and run CP10 target-spring Java vectors and native ownership checks.

The generated vector consumer is deliberately produced from the checked-in shared
fixture.  It never asks the Java implementation to generate its own expectations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.check_spring_fixtures import static_valid, validate

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog/operations/target-springs-2d.json"
FIXTURE = ROOT / "fixtures/operations/target-springs-2d.json"
REVIEW = ROOT / "design/operations/cp10-contract-review.md"
CHECKER = ROOT / "tools/check_spring_fixtures.py"
REVIEW_BINDINGS = ROOT / "evidence/investigations/cp10-contract-review.json"
CORE = ROOT / "packages/java/src/main/java/org/procedurals/motion/TargetSprings2D.java"
NATIVE = ROOT / "tests/native/TargetSpringsNative.java"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CommandFailure(RuntimeError):
    def __init__(self, command: list[str], stdout: str, stderr: str, cause: BaseException) -> None:
        self.command, self.stdout, self.stderr = command, stdout, stderr
        super().__init__("command failed: " + " ".join(command) + "\nstdout:\n" + stdout + "\nstderr:\n" + stderr)
        self.__cause__ = cause


def invoke(command: list[Path | str], timeout: int = 180) -> subprocess.CompletedProcess[str]:
    rendered = [str(item) for item in command]
    try:
        return subprocess.run(
            rendered,
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
            timeout=timeout,
        )
    except subprocess.CalledProcessError as error:
        raise CommandFailure(rendered, error.stdout or "", error.stderr or "", error) from error
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout.decode() if isinstance(error.stdout, bytes) else (error.stdout or "")
        stderr = error.stderr.decode() if isinstance(error.stderr, bytes) else (error.stderr or "")
        raise CommandFailure(rendered, stdout, stderr, error) from error


def java_value(value: Any) -> str:
    """Render fixture JSON as passive Java Map/List values."""
    if value is None:
        return "null"
    if value is True:
        return "Boolean.TRUE"
    if value is False:
        return "Boolean.FALSE"
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    if isinstance(value, list):
        return "list(" + ", ".join(java_value(item) for item in value) + ")"
    if isinstance(value, dict):
        args: list[str] = []
        for key, item in value.items():
            args.extend((java_value(key), java_value(item)))
        return "map(" + ", ".join(args) + ")"
    raise TypeError(value)


def vector_case(case: dict[str, Any], ordinal: int) -> str | None:
    """Generate one case while keeping malformed outer wrappers runner-only."""
    value = case["input"]
    # The native API intentionally receives state and targets separately.  A
    # missing/extra transition-wrapper key is therefore checked by Python and
    # has no corresponding Java invocation.
    if not isinstance(value, dict) or set(value) != {"state", "targets"}:
        return None

    invocation = (
        "TargetSprings2D batch = TargetSprings2D.create(((Map<?, ?>) input).get(\"state\"));\n"
        "    Object targets = ((Map<?, ?>) input).get(\"targets\");\n"
    )
    if "output" in case:
        body = (
            "  private static void case%d() {\n"
            "    Object input = %s;\n"
            "    %s"
            "    batch.step(targets);\n"
            "    recursive(%s, batch.toValues(), %s);\n"
            "  }"
            % (
                ordinal,
                java_value(value),
                invocation,
                java_value(case["output"]),
                java_value(case["id"]),
            )
        )
        return body

    expected_code = case["error"]
    details = case.get("error_details", {})
    detail_checks = []
    for key, expected in details.items():
        detail_checks.append(
            "    equal(%s, field(error, %s), %s);"
            % (java_value(expected), java_value(key), java_value(case["id"] + "/" + key))
        )
    return (
        "  private static void case%d() {\n"
        "    Object input = %s;\n"
        "    Throwable error = null;\n"
        "    try {\n"
        "      TargetSprings2D batch = TargetSprings2D.create(((Map<?, ?>) input).get(\"state\"));\n"
        "      Object targets = ((Map<?, ?>) input).get(\"targets\");\n"
        "      batch.step(targets);\n"
        "    } catch (Throwable caught) { error = caught; }\n"
        "    check(error != null, %s + \" expected error\");\n"
        "    equal(%s, field(error, \"code\"), %s);\n"
        "%s"
        "  }"
        % (
            ordinal,
            java_value(value),
            java_value(case["id"]),
            java_value(expected_code),
            java_value(case["id"] + "/code"),
            "\n".join(detail_checks) + ("\n" if detail_checks else ""),
        )
    )


def vectors_source(fixture: dict[str, Any]) -> str:
    rendered = [(ordinal, vector_case(case, ordinal)) for ordinal, case in enumerate(fixture["cases"])]
    methods = [method for _, method in rendered if method is not None]
    calls = " ".join("case%d();" % ordinal for ordinal, method in rendered if method is not None)
    native_case_count = len(methods)
    sequence_methods: list[str] = []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for case in fixture["cases"]:
        if isinstance(case.get("sequence_id"), str):
            grouped.setdefault(case["sequence_id"], []).append(case)
    for name, sequence in grouped.items():
        sequence.sort(key=lambda item: item["sequence_index"])
        lines = [
            "  private static void sequence_%s() {" % name.replace("-", "_"),
            "    TargetSprings2D batch = TargetSprings2D.create(%s);" % java_value(sequence[0]["input"]["state"]),
        ]
        for case in sequence:
            lines.extend(
                [
                    "    batch.step(%s);" % java_value(case["input"]["targets"]),
                    "    recursive(%s, batch.toValues(), %s);"
                    % (java_value(case["output"]), java_value(case["id"] + "/continued")),
                ]
            )
        lines.append("  }")
        sequence_methods.append("\n".join(lines))
        calls += " sequence_%s();" % name.replace("-", "_")
    restore_methods: list[str] = []
    by_id = {case.get("id"): case for case in fixture["cases"]}
    for case in fixture["cases"]:
        original = by_id.get(case.get("restores_case"))
        if original is None:
            continue
        restore_name = "restore_" + str(case["id"]).replace("-", "_")
        restore_methods.append(
            "  private static void %s() {\n"
            "    TargetSprings2D batch = TargetSprings2D.create(%s);\n"
            "    batch.step(%s);\n"
            "    recursive(%s, batch.toValues(), %s);\n"
            "  }"
            % (
                restore_name,
                java_value(case["input"]["state"]),
                java_value(case["input"]["targets"]),
                java_value(case["output"]),
                java_value(case["id"] + "/restored"),
            )
        )
        calls += " %s();" % restore_name
    return """package org.procedurals.motion;
import java.lang.reflect.Field;
import java.util.*;

/** Generated from fixtures/operations/target-springs-2d.json; exact recursive output checks. */
public final class TargetSpringsVectors {
  private static int assertions;
  private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
  private static void equal(Object expected, Object actual, String message) {
    check(expected == null ? actual == null : expected.equals(actual), message);
  }
  private static void equal(Number expected, Object actual, String message) {
    check(actual instanceof Number, message + " type");
    check(Double.doubleToRawLongBits(expected.doubleValue()) ==
          Double.doubleToRawLongBits(((Number) actual).doubleValue()), message);
  }
  private static Object field(Throwable error, String name) {
    try { Field field = error.getClass().getField(name); return field.get(error); }
    catch (ReflectiveOperationException failure) { throw new AssertionError(error.toString(), failure); }
  }
  private static void recursive(Object expected, Object actual, String path) {
    if (expected instanceof Number) { equal((Number) expected, actual, path); return; }
    if (expected instanceof Map) {
      check(actual instanceof Map, path + " map");
      Map<?, ?> e = (Map<?, ?>) expected, a = (Map<?, ?>) actual;
      check(e.keySet().equals(a.keySet()), path + " keys");
      for (Object key : e.keySet()) recursive(e.get(key), a.get(key), path + "/" + key);
      return;
    }
    if (expected instanceof List) {
      check(actual instanceof List, path + " list");
      List<?> e = (List<?>) expected, a = (List<?>) actual;
      check(e.size() == a.size(), path + " size");
      for (int i = 0; i < e.size(); i++) recursive(e.get(i), a.get(i), path + "/" + i);
      return;
    }
    equal(expected, actual, path);
  }
  private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  private static Map<String,Object> map(Object... values) {
    Map<String,Object> result = new LinkedHashMap<String,Object>();
    for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
    return result;
  }
%s
%s
  public static void main(String[] args) {
    %s
    System.out.println("{\\\"status\\\":\\\"passed\\\",\\\"fixture_cases\\\":%d,\\\"native_cases\\\":%d,\\\"assertions\\\":" + assertions + "}");
  }
}
""" % ("\n".join(methods), "\n".join(sequence_methods + restore_methods), calls, len(fixture["cases"]), native_case_count)


def java_home(value: str | None) -> Path:
    if value:
        return Path(value)
    candidates = sorted((ROOT / ".work/toolchains").glob("jdk-17*"))
    if len(candidates) != 1:
        raise RuntimeError("pass --java-home; expected exactly one .work/toolchains/jdk-17*")
    return candidates[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--output", type=Path, default=ROOT / ".work/conformance/cp10-target-springs-java.json")
    args = parser.parse_args()
    output = args.output.resolve()
    work_root = (ROOT / ".work").resolve()
    if output.exists():
        raise RuntimeError("refusing existing output path: " + str(output))
    if output != work_root and work_root not in output.parents:
        raise RuntimeError("output must be inside repository .work: " + str(output))
    home = java_home(args.java_home)

    bindings = json.loads(REVIEW_BINDINGS.read_text())
    if bindings.get("status") != "accepted" or not isinstance(bindings.get("bindings"), dict):
        raise RuntimeError("cp10 contract review bindings are not accepted")
    expected_bindings = bindings["bindings"]
    for relative, expected_hash in expected_bindings.items():
        path = ROOT / relative
        if not path.is_file() or expected_hash != sha(path):
            raise RuntimeError("binding mismatch for " + relative)
    catalog = json.loads(CATALOG.read_text())
    fixture = json.loads(FIXTURE.read_text())
    errors = validate(ROOT, "spring", catalog, fixture)
    if errors:
        raise RuntimeError("fixture validation failed:\n" + "\n".join(errors))

    # Explicitly account for wrapper cases because Java's factory receives only
    # the state object and cannot validate the transition envelope.
    schema_only = []
    for case in fixture["cases"]:
        value = case.get("input")
        if not isinstance(value, dict) or set(value) != {"state", "targets"}:
            schema_only.append(case["id"])
            if static_valid(value) or case.get("error") != "INVALID_INPUT" or "output" in case:
                raise RuntimeError("wrapper schema case was not independently rejected: " + case["id"])

    bound = [ROOT / relative for relative in expected_bindings]
    bound.extend([REVIEW_BINDINGS, CORE, NATIVE, Path(__file__).resolve()])
    bound = list(dict.fromkeys(bound))
    before = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    build_root = ROOT / ".work/build"
    build_root.mkdir(parents=True, exist_ok=True)
    build = Path(tempfile.mkdtemp(prefix="cp10-target-springs-", dir=build_root))
    generated = build / "TargetSpringsVectors.java"
    generated.write_text(vectors_source(fixture))
    try:
        invoke([home / "bin/javac", "--release", "8", "-d", build, CORE, generated])
        vectors = json.loads(invoke([home / "bin/java", "-cp", build, "org.procedurals.motion.TargetSpringsVectors"]).stdout)
        invoke([home / "bin/javac", "--release", "8", "-cp", build, "-d", build, NATIVE])
        native = json.loads(invoke([home / "bin/java", "-cp", build, "org.procedurals.motion.TargetSpringsNative"], 300).stdout)
        if vectors.get("status") != "passed" or native.get("status") != "passed":
            raise RuntimeError("target-spring Java vector/native checks failed")
    except Exception as error:
        failure: dict[str, Any] = {"status": "failed", "build": str(build), "error": str(error)}
        if isinstance(error, CommandFailure):
            failure.update(command=error.command, stdout=error.stdout, stderr=error.stderr)
        elif isinstance(error, json.JSONDecodeError):
            failure["output"] = getattr(error, "doc", "")
        (build / "failure.json").write_text(json.dumps(failure, indent=2, sort_keys=True) + "\n")
        print(json.dumps(failure), file=sys.stderr)
        raise SystemExit(1)
    after = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    if before != after:
        raise RuntimeError("catalog, fixture, checker, core, native or runner changed during conformance")

    report = {
        "operation": catalog["id"],
        "scope": "Java core fixture/native ownership evidence only; no renderer, package or other-target claim.",
        "contract_sha256": {str(CATALOG.relative_to(ROOT)): sha(CATALOG)},
        "fixture_sha256": {str(FIXTURE.relative_to(ROOT)): sha(FIXTURE)},
        "contract_review_bindings": expected_bindings,
        "contract_review_bindings_sha256": sha(REVIEW_BINDINGS),
        "runner_schema_only_cases": schema_only,
        "fixture_case_count": len(fixture["cases"]),
        "native_case_count": vectors.get("native_cases"),
        "source_sha256_before": before,
        "source_sha256_after": after,
        "vectors": vectors,
        "native": native,
        "runtime": invoke([home / "bin/java", "-version"]).stderr.strip(),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "cases": len(fixture["cases"]), "report": str(output)}))


if __name__ == "__main__":
    main()
