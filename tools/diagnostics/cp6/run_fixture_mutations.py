#!/usr/bin/env python3
"""Mutation check for the private CP6 draft fixture oracle.

This consumes draft fixture values as the baseline and imports only the draft oracle's
validation, xoshiro stream, and scalar interval helper.  The evaluators below are local,
bounded deliberately wrong traversal/consumption variants; they are not public code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import struct
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.generate_branch_tree_fixtures import Xoshiro128StarStar11, scalar_lerp, validate  # noqa: E402


FIXTURE = ROOT / "fixtures/operations/seeded-endpoint-branches.json"
OUT_DEFAULT = ROOT / "evidence/investigations/cp6-fixture-mutations.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value: float) -> float:
    return 0.0 if value == 0.0 else value


def bits(value: float) -> str:
    return struct.pack(">d", value).hex()


def output_bits(output: dict[str, list[Any]]) -> dict[str, list[Any]]:
    return {
        "segments": [[bits(float(v)) for v in row] for row in output["segments"]],
        "headings": [bits(float(v)) for v in output["headings"]],
        "lengths": [bits(float(v)) for v in output["lengths"]],
        "parents": output["parents"],
        "generations": output["generations"],
        "childCounts": output["childCounts"],
    }


class MutationError(RuntimeError):
    def __init__(self, code: str, detail: dict[str, Any], trace: list[dict[str, Any]]) -> None:
        super().__init__(code)
        self.code, self.detail, self.trace = code, detail, trace


def run_mutant(value: dict[str, Any], mutation: str) -> tuple[dict[str, list[Any]], list[dict[str, Any]]]:
    """Evaluate one named wrong behavior, using only imported oracle helper laws."""
    seed, origin, heading, length, rules, limit = validate(value)
    stream = Xoshiro128StarStar11(seed)
    trace: list[dict[str, Any]] = []
    out = {key: [] for key in ("segments", "headings", "lengths", "parents", "generations", "childCounts")}

    def unit(parent: int, slot: int, role: str) -> float:
        word, result = stream.unit()
        trace.append({"parentIndex": parent, "slotIndex": slot, "role": role, "word": word, "state": list(stream.words)})
        return result

    def sample(a: float, b: float, parent: int, slot: int, role: str) -> float:
        if mutation == "skip-constant-interval-units" and a == b:
            return canonical(a)
        return scalar_lerp(a, b, unit(parent, slot, role))

    def finite(result: float, parent: int, slot: int, stage: str) -> float:
        if not math.isfinite(result):
            raise MutationError("BRANCH_ARITHMETIC_INVALID", {"parentIndex": parent, "slotIndex": slot, "stage": stage}, trace)
        return canonical(result)

    def append(start: tuple[float, float], angle: float, size: float, parent: int, slot: int, generation: int) -> int:
        dx = finite(math.cos(angle) * size, parent, slot, "delta_x")
        dy = finite(math.sin(angle) * size, parent, slot, "delta_y")
        x = finite(start[0] + dx, parent, slot, "position_x")
        y = finite(start[1] + dy, parent, slot, "position_y")
        out["segments"].append([*start, x, y])
        out["headings"].append(angle)
        out["lengths"].append(size)
        out["parents"].append(parent)
        out["generations"].append(generation)
        out["childCounts"].append(0)
        return len(out["segments"]) - 1

    append(origin, heading, length, -1, -1, 0)

    def gate(parent: int, slot: int, probability: float) -> bool:
        if mutation == "skip-probability-zero-gates" and probability == 0.0:
            return False
        if mutation == "skip-probability-one-gates" and probability == 1.0:
            return True
        return unit(parent, slot, "gate") < probability

    def expand(parent: int, recurse: bool) -> None:
        generation = out["generations"][parent]
        if generation >= len(rules):
            if mutation == "terminal-shrink-unit":
                unit(parent, -1, "terminal_scale")
            return
        scale_range, slots = rules[generation]
        shared_scale: float | None = None
        if mutation != "per-child-scale":
            shared_scale = sample(*scale_range, parent, -1, "scale")
        for slot, (probability, turn_range) in enumerate(slots):
            turn: float | None = None
            if mutation == "unconditional-angle-units":
                turn = sample(*turn_range, parent, slot, "turn")
            if not gate(parent, slot, probability):
                continue
            if len(out["segments"]) >= limit:
                raise MutationError("SEGMENT_LIMIT_EXCEEDED", {"parentIndex": parent, "slotIndex": slot}, trace)
            if mutation == "per-child-scale":
                shared_scale = sample(*scale_range, parent, slot, "scale")
            if turn is None:
                turn = sample(*turn_range, parent, slot, "turn")
            child_length = finite(out["lengths"][parent] * shared_scale, parent, slot, "length")
            child_heading = finite(out["headings"][parent] + turn, parent, slot, "heading")
            child = append(tuple(out["segments"][parent][2:]), child_heading, child_length, parent, slot, generation + 1)
            out["childCounts"][parent] += 1
            if recurse:
                expand(child, True)

    if mutation == "depth-first-traversal":
        expand(0, True)
    else:
        parent = 0
        while parent < len(out["segments"]):
            expand(parent, False)
            parent += 1
    return out, trace


def first_difference(expected: Any, actual: Any, path: str = "") -> dict[str, Any] | None:
    if type(expected) is not type(actual):
        return {"path": path, "expected": expected, "actual": actual}
    if isinstance(expected, dict):
        for key in sorted(set(expected) | set(actual)):
            if key not in expected or key not in actual:
                return {"path": f"{path}/{key}", "expected": expected.get(key), "actual": actual.get(key)}
            result = first_difference(expected[key], actual[key], f"{path}/{key}")
            if result:
                return result
        return None
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return {"path": path + "/length", "expected": len(expected), "actual": len(actual)}
        for index, (left, right) in enumerate(zip(expected, actual)):
            result = first_difference(left, right, f"{path}/{index}")
            if result:
                return result
        return None
    return None if expected == actual else {"path": path, "expected": expected, "actual": actual}


def trace_words(trace: list[dict[str, Any]]) -> list[int]:
    return [entry["word"] for entry in trace]


MUTATIONS = {
    "depth-first-traversal": "Recursively expand a successful child before visiting its next sibling, while retaining the same local slot logic.",
    "per-child-scale": "Skip the parent shared scale unit and draw a fresh scale after each successful gate, before that child turn.",
    "skip-probability-zero-gates": "Treat probability 0 as a failed gate without consuming its mandatory gate unit.",
    "skip-probability-one-gates": "Treat probability 1 as a successful gate without consuming its mandatory gate unit.",
    "skip-constant-interval-units": "Return a constant scale or turn endpoint without consuming its mandatory interval unit.",
    "unconditional-angle-units": "Consume a turn unit before every gate, including failed slots.",
    "terminal-shrink-unit": "Consume an unused scale-like unit for every terminal parent after its rules are exhausted.",
}


def verify_fixture_bindings(fixture: dict[str, Any]) -> dict[str, str]:
    bindings = fixture.get("source_bindings")
    if not isinstance(bindings, dict):
        raise RuntimeError("canonical draft fixture lacks source bindings")
    checked: dict[str, str] = {}
    for relative, expected in bindings.items():
        path = ROOT / relative
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(f"canonical fixture binding stale for {relative}: {actual} != {expected}")
        checked[relative] = actual
    return checked


def mutation_report(fixture: dict[str, Any], mutation: str) -> dict[str, Any]:
    successful = [case for case in fixture["cases"] if "output" in case and "rng_trace" in case]
    distinguished: list[dict[str, Any]] = []
    survivors: list[str] = []
    for case in successful:
        expected_output = output_bits(case["output"])
        expected_trace = trace_words(case["rng_trace"])
        try:
            output, trace = run_mutant(case["input"], mutation)
        except MutationError as error:
            trace_delta = first_difference(expected_trace, trace_words(error.trace), "/rng_words")
            entry: dict[str, Any] = {
                "case": case["id"],
                "differences": ["error"],
                "mutant_error": {"status": error.code, "detail": error.detail},
            }
            if trace_delta is not None:
                entry["differences"].append("rng_trace")
                entry["first_rng_word_difference"] = trace_delta
            distinguished.append(entry)
            continue
        actual_output = output_bits(output)
        output_delta = first_difference(expected_output, actual_output, "/output")
        actual_trace = trace_words(trace)
        trace_delta = first_difference(expected_trace, actual_trace, "/rng_words")
        if output_delta is None and trace_delta is None:
            survivors.append(case["id"])
        else:
            entry: dict[str, Any] = {"case": case["id"], "differences": []}
            if output_delta is not None:
                entry["differences"].append("output")
                entry["first_output_difference"] = output_delta
            if trace_delta is not None:
                entry["differences"].append("rng_trace")
                entry["first_rng_word_difference"] = trace_delta
            distinguished.append(entry)
    return {
        "mutation": mutation,
        "definition": MUTATIONS[mutation],
        "successful_canonical_cases_evaluated": len(successful),
        "distinguished_by": distinguished,
        "surviving_success_cases": survivors,
        "distinguished": bool(distinguished),
    }


def control_report(fixture: dict[str, Any]) -> dict[str, Any]:
    """Prove the local evaluator agrees before interpreting its mutant deltas."""
    successful = [case for case in fixture["cases"] if "output" in case and "rng_trace" in case]
    failures: list[dict[str, Any]] = []
    for case in successful:
        try:
            output, trace = run_mutant(case["input"], "control")
        except MutationError as error:
            failures.append({"case": case["id"], "kind": "error", "actual": {"status": error.code, "detail": error.detail}})
            continue
        output_delta = first_difference(output_bits(case["output"]), output_bits(output), "/output")
        trace_delta = first_difference(case["rng_trace"], trace, "/rng_trace")
        if output_delta is not None or trace_delta is not None:
            failure: dict[str, Any] = {"case": case["id"], "kind": "raw_mismatch"}
            if output_delta is not None:
                failure["first_output_difference"] = output_delta
            if trace_delta is not None:
                failure["first_rng_trace_difference"] = trace_delta
            failures.append(failure)
    if failures:
        raise RuntimeError(f"unmutated control disagrees with canonical fixture: {failures}")
    return {"mutation": "control", "successful_canonical_cases_evaluated": len(successful), "raw_output_and_trace_equal": True}


def build() -> dict[str, Any]:
    fixture = json.loads(FIXTURE.read_text())
    checked_fixture_bindings = verify_fixture_bindings(fixture)
    control = control_report(fixture)
    reports = [mutation_report(fixture, mutation) for mutation in MUTATIONS]
    targeted_ids = {
        "zero-gate-before-probabilistic-slot",
        "constant-scale-before-probabilistic-slots",
        "constant-turn-before-later-gates",
    }
    public_observability: dict[str, dict[str, list[str]]] = {}
    for report in reports:
        output_cases = [entry["case"] for entry in report["distinguished_by"]
                        if entry["case"] in targeted_ids and "output" in entry["differences"]]
        trace_only_cases = [entry["case"] for entry in report["distinguished_by"]
                            if entry["case"] in targeted_ids and entry["differences"] == ["rng_trace"]]
        public_observability[report["mutation"]] = {
            "materialized_output_difference_cases": output_cases,
            "trace_only_cases": trace_only_cases,
        }
    return {
        "schema": "cp6-fixture-mutations/v1",
        "status": "completed-bounded-private-draft-fixture-mutation-diagnostic",
        "scope": {
            "includes": "Existing successful canonical draft-fixture cases evaluated against seven intentionally wrong traversal or stream-consumption variants.",
            "excludes": ["public operation implementation", "catalog or shared fixture edit", "draft fixture regeneration", "renderer behavior", "native conformance claim"],
        },
        "runtime": {"python": sys.version, "implementation": platform.python_implementation(), "platform": platform.platform()},
        "canonical_draft_fixture": {"path": FIXTURE.relative_to(ROOT).as_posix(), "sha256": sha256(FIXTURE), "case_count": len(fixture["cases"]), "successful_cases_used": sum("output" in c and "rng_trace" in c for c in fixture["cases"])},
        "verified_fixture_source_bindings": checked_fixture_bindings,
        "unmutated_control": control,
        "mutations": reports,
        "new_targeted_public_observability": {
            "meaning": "These are differences in materialized successful output. The three new targeted cases are successful, so no error-result comparison applies to them.",
            "by_mutation": public_observability,
        },
        "missing_coverage": [
            "The three canonical targeted cases now cover a p0 gate before a later probabilistic slot, a constant scale before probabilistic slots, and constant turns before later gates. They do not cover every mixed p0/p1 or mixed constant/nonconstant schedule.",
            "The mutation set does not model every wrong schedule, such as drawing scale after an angle, capacity after an angle, or consuming terminal source-style colour draws. It only evaluates the seven named variants.",
            "Error-only cases are intentionally excluded from output/trace mutation comparison. Static-validation order, arithmetic precedence, capacity failure, ownership, and target carrier behavior require their separate fixture and native checks.",
            "A terminal shrink after the final generation is intrinsically unobservable in returned tree data because no later operation uses the discarded stream state. Its source-review and trace-only obligation should remain precise; public accessors cannot prove it.",
            "The empty-slots case likewise leaves only discarded stream state, so it is trace-only and cannot by itself establish public output behavior.",
            "Coordinate comparisons are same-Python raw-binary64 comparisons of the draft oracle output; they do not establish cross-runtime trigonometric agreement.",
        ],
        "source_bindings": {
            "tools/diagnostics/cp6/run_fixture_mutations.py": sha256(Path(__file__).resolve()),
            "tools/generate_branch_tree_fixtures.py": sha256(ROOT / "tools/generate_branch_tree_fixtures.py"),
            "tools/generate_triangle_points_fixtures.py": sha256(ROOT / "tools/generate_triangle_points_fixtures.py"),
            "design/operations/cp6-branch-contract-decisions.md": sha256(ROOT / "design/operations/cp6-branch-contract-decisions.md"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT_DEFAULT)
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(build(), indent=2, sort_keys=True) + "\n"
    output.write_text(payload, encoding="utf-8")
    print(json.dumps({"status": "passed", "output": str(output), "sha256": hashlib.sha256(payload.encode()).hexdigest()}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
