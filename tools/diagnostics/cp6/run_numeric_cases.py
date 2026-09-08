#!/usr/bin/env python3
"""Bounded CP6 arithmetic-case diagnostic; not a public operation implementation.

The diagnostic applies the arithmetic order selected in CP6 contract decisions to a
single root and one child rule.  It is deliberately small: it establishes reachable
finite-input precedence examples and records why dx/dy overflow cases are unavailable
under the stated bounded-trigonometry assumption.
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
OUT_DEFAULT = ROOT / "evidence/investigations/cp6-numeric-cases.json"
MASK32 = 0xFFFFFFFF
MASK64 = 0xFFFFFFFFFFFFFFFF
GAMMA = 0x9E3779B97F4A7C15
MIX_A = 0xBF58476D1CE4E5B9
MIX_B = 0x94D049BB133111EB
MAX = float.fromhex("0x1.fffffffffffffp+1023")
MIN_SUBNORMAL = float.fromhex("0x0.0000000000001p-1022")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bits(value: float) -> str:
    return f"{struct.unpack('>Q', struct.pack('>d', value))[0]:016x}"


def describe(value: float) -> dict[str, Any]:
    if math.isnan(value):
        text = "NaN"
    elif math.isinf(value):
        text = "Infinity" if value > 0 else "-Infinity"
    else:
        text = repr(value)
    return {"value": text, "bits_hex": bits(value), "finite": math.isfinite(value)}


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def splitmix64_next(state: int) -> tuple[int, int]:
    state = (state + GAMMA) & MASK64
    mixed = state
    mixed = ((mixed ^ (mixed >> 30)) * MIX_A) & MASK64
    mixed = ((mixed ^ (mixed >> 27)) * MIX_B) & MASK64
    return state, (mixed ^ (mixed >> 31)) & MASK64


def rotl32(value: int, count: int) -> int:
    value &= MASK32
    return ((value << count) | (value >> (32 - count))) & MASK32


class Xoshiro128StarStar:
    """Independent diagnostic expression of the CP3/CP5 private stream."""

    def __init__(self, seed: int) -> None:
        state, first = splitmix64_next(seed)
        _, second = splitmix64_next(state)
        self.words = [
            first & MASK32,
            (first >> 32) & MASK32,
            second & MASK32,
            (second >> 32) & MASK32,
        ]
        if not any(self.words):
            raise AssertionError("two-SplitMix64 expansion produced forbidden zero state")
        self.trace: list[dict[str, Any]] = []

    def next_u32(self, label: str) -> int:
        s0, s1, s2, s3 = self.words
        result = (rotl32((s1 * 5) & MASK32, 7) * 9) & MASK32
        t = (s1 << 9) & MASK32
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= t
        s3 = rotl32(s3, 11)
        self.words = [s0 & MASK32, s1 & MASK32, s2 & MASK32, s3 & MASK32]
        self.trace.append({"label": label, "word_u32": result, "unit": repr(result / 4294967296.0)})
        return result

    def unit(self, label: str) -> float:
        return self.next_u32(label) / 4294967296.0


def interval(a: float, b: float, unit: float) -> float:
    """The selected CP5 endpoint-aware, clamped binary64 interpolation law."""
    if unit == 0.0:
        return canonical_zero(a)
    if unit == 1.0:
        return canonical_zero(b)
    if (a < 0.0 < b) or (b < 0.0 < a):
        raw = a * (1.0 - unit) + b * unit
    else:
        raw = a + (b - a) * unit
    lower, upper = (a, b) if a <= b else (b, a)
    return canonical_zero(min(max(raw, lower), upper))


def finite_or_error(value: float, stage: str, calculations: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    calculations[stage] = describe(value)
    if math.isfinite(value):
        return True, {"status": "finite"}
    return False, {"status": "BRANCH_ARITHMETIC_INVALID", "stage": stage}


def root_segment(origin_x: float, origin_y: float, heading: float, length: float) -> tuple[dict[str, float], dict[str, Any]]:
    calculations: dict[str, Any] = {}
    dx = math.cos(heading) * length
    ok, error = finite_or_error(dx, "dx", calculations)
    if not ok:
        return {}, {"status": error["status"], "parentIndex": -1, "slotIndex": -1, "stage": error["stage"], "calculations": calculations}
    dy = math.sin(heading) * length
    ok, error = finite_or_error(dy, "dy", calculations)
    if not ok:
        return {}, {"status": error["status"], "parentIndex": -1, "slotIndex": -1, "stage": error["stage"], "calculations": calculations}
    end_x = origin_x + dx
    ok, error = finite_or_error(end_x, "end_x", calculations)
    if not ok:
        return {}, {"status": error["status"], "parentIndex": -1, "slotIndex": -1, "stage": error["stage"], "calculations": calculations}
    end_y = origin_y + dy
    ok, error = finite_or_error(end_y, "end_y", calculations)
    if not ok:
        return {}, {"status": error["status"], "parentIndex": -1, "slotIndex": -1, "stage": error["stage"], "calculations": calculations}
    return {
        "x0": canonical_zero(origin_x), "y0": canonical_zero(origin_y),
        "x1": canonical_zero(end_x), "y1": canonical_zero(end_y),
        "heading": canonical_zero(heading), "length": canonical_zero(length),
    }, {"status": "finite", "calculations": calculations}


def run_case(case: dict[str, Any]) -> dict[str, Any]:
    """Run exactly root -> one rule -> ordered slots; records the dynamic stopping point."""
    seed = case.get("seed", 42)
    rng = Xoshiro128StarStar(seed)
    root_input = case["root"]
    root, root_outcome = root_segment(**root_input)
    if root_outcome["status"] != "finite":
        raise AssertionError(f"diagnostic root must be finite: {case['id']}: {root_outcome}")
    scale_unit = rng.unit("parent[0].scale")
    scale = interval(case["lengthScale"][0], case["lengthScale"][1], scale_unit)
    children: list[dict[str, Any]] = []
    for slot_index, slot in enumerate(case["slots"]):
        gate = rng.unit(f"parent[0].slot[{slot_index}].gate")
        if not gate < slot["probability"]:
            continue
        if len(children) + 1 >= case["maxSegments"]:
            return {
                "id": case["id"],
                "input": case,
                "root": {key: describe(value) for key, value in root.items()},
                "scale": describe(scale),
                "rng_trace": rng.trace,
                "outcome": {"status": "SEGMENT_LIMIT_EXCEEDED", "parentIndex": 0, "slotIndex": slot_index},
                "children_appended": children,
            }
        turn_unit = rng.unit(f"parent[0].slot[{slot_index}].turn")
        turn = interval(slot["turn"][0], slot["turn"][1], turn_unit)
        calculations: dict[str, Any] = {
            "parent_length": describe(root["length"]),
            "shared_scale": describe(scale),
            "turn": describe(turn),
        }
        child_length = root["length"] * scale
        ok, error = finite_or_error(child_length, "length", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        child_heading = root["heading"] + turn
        ok, error = finite_or_error(child_heading, "heading", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        dx = math.cos(child_heading) * child_length
        ok, error = finite_or_error(dx, "dx", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        dy = math.sin(child_heading) * child_length
        ok, error = finite_or_error(dy, "dy", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        end_x = root["x1"] + dx
        ok, error = finite_or_error(end_x, "end_x", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        end_y = root["y1"] + dy
        ok, error = finite_or_error(end_y, "end_y", calculations)
        if not ok:
            return child_result(case, root, scale, rng, children, slot_index, calculations, error)
        children.append({"x0": root["x1"], "y0": root["y1"], "x1": canonical_zero(end_x), "y1": canonical_zero(end_y), "heading": canonical_zero(child_heading), "length": canonical_zero(child_length)})
    return {
        "id": case["id"],
        "input": case,
        "root": {key: describe(value) for key, value in root.items()},
        "scale": describe(scale),
        "rng_trace": rng.trace,
        "outcome": {"status": "success"},
        "children_appended": [{key: describe(value) for key, value in child.items()} for child in children],
    }


def child_result(case: dict[str, Any], root: dict[str, float], scale: float, rng: Xoshiro128StarStar, children: list[dict[str, Any]], slot_index: int, calculations: dict[str, Any], error: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": case["id"],
        "input": case,
        "root": {key: describe(value) for key, value in root.items()},
        "scale": describe(scale),
        "rng_trace": rng.trace,
        "outcome": {"status": error["status"], "parentIndex": 0, "slotIndex": slot_index, "stage": error["stage"], "calculations": calculations},
        "children_appended": children,
    }


def cases() -> list[dict[str, Any]]:
    # Constant endpoints still consume a stream unit; 0/1 probabilities still consume gates.
    return [
        {
            "id": "child-length-overflow",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": 0.0, "length": MAX},
            "lengthScale": [2.0, 2.0], "slots": [{"probability": 1.0, "turn": [0.0, 0.0]}], "maxSegments": 2,
            "expected": {"status": "BRANCH_ARITHMETIC_INVALID", "stage": "length", "parentIndex": 0, "slotIndex": 0},
        },
        {
            "id": "child-heading-overflow",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": MAX, "length": 0.0},
            "lengthScale": [0.0, 0.0], "slots": [{"probability": 1.0, "turn": [MAX, MAX]}], "maxSegments": 2,
            "expected": {"status": "BRANCH_ARITHMETIC_INVALID", "stage": "heading", "parentIndex": 0, "slotIndex": 0},
        },
        {
            "id": "child-end-x-overflow",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": 0.0, "length": MAX},
            "lengthScale": [0.5, 0.5], "slots": [{"probability": 1.0, "turn": [0.0, 0.0]}], "maxSegments": 2,
            "expected": {"status": "BRANCH_ARITHMETIC_INVALID", "stage": "end_x", "parentIndex": 0, "slotIndex": 0},
        },
        {
            "id": "child-end-y-overflow",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": math.pi / 2.0, "length": MAX},
            "lengthScale": [0.5, 0.5], "slots": [{"probability": 1.0, "turn": [0.0, 0.0]}], "maxSegments": 2,
            "expected": {"status": "BRANCH_ARITHMETIC_INVALID", "stage": "end_y", "parentIndex": 0, "slotIndex": 0},
        },
        {
            "id": "positive-underflow-collapses-child-geometry",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": 0.0, "length": MIN_SUBNORMAL},
            "lengthScale": [0.5, 0.5], "slots": [{"probability": 1.0, "turn": [0.0, 0.0]}], "maxSegments": 2,
            "expected": {"status": "success", "child_length_bits_hex": "0000000000000000", "child_end_x_bits_hex": "0000000000000001"},
        },
        {
            "id": "failed-gates-skip-hypothetical-length-overflow",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": 0.0, "length": MAX},
            "lengthScale": [2.0, 2.0], "slots": [{"probability": 0.0, "turn": [MAX, MAX]}, {"probability": 0.0, "turn": [MAX, MAX]}], "maxSegments": 3,
            "expected": {"status": "success", "rng_labels": ["parent[0].scale", "parent[0].slot[0].gate", "parent[0].slot[1].gate"]},
        },
        {
            "id": "capacity-precedes-angle-and-child-arithmetic",
            "seed": 42,
            "root": {"origin_x": 0.0, "origin_y": 0.0, "heading": 0.0, "length": MAX},
            "lengthScale": [2.0, 2.0], "slots": [{"probability": 1.0, "turn": [MAX, MAX]}], "maxSegments": 1,
            "expected": {"status": "SEGMENT_LIMIT_EXCEEDED", "parentIndex": 0, "slotIndex": 0, "rng_labels": ["parent[0].scale", "parent[0].slot[0].gate"]},
        },
    ]


def validate(results: list[dict[str, Any]]) -> None:
    for result in results:
        expected = result["input"]["expected"]
        outcome = result["outcome"]
        for key in ("status", "stage", "parentIndex", "slotIndex"):
            if key in expected and outcome.get(key) != expected[key]:
                raise AssertionError(f"{result['id']}: expected {key}={expected[key]!r}, got {outcome.get(key)!r}")
        labels = [entry["label"] for entry in result["rng_trace"]]
        if "rng_labels" in expected and labels != expected["rng_labels"]:
            raise AssertionError(f"{result['id']}: unexpected stream trace {labels}")
        if result["id"] == "positive-underflow-collapses-child-geometry":
            child = result["children_appended"][0]
            if child["length"]["bits_hex"] != expected["child_length_bits_hex"] or child["x1"]["bits_hex"] != expected["child_end_x_bits_hex"]:
                raise AssertionError(f"{result['id']}: collapse bits differ")


def add_counterfactual_witnesses(results: list[dict[str, Any]]) -> None:
    """Describe skipped calculations without treating them as executed operation work."""
    by_id = {result["id"]: result for result in results}
    for case_id, stopping_reason in (
        ("failed-gates-skip-hypothetical-length-overflow", "Both gates failed, so no angle draw or child arithmetic occurs."),
        ("capacity-precedes-angle-and-child-arithmetic", "The successful gate found maxSegments already full before the angle draw or child arithmetic."),
    ):
        result = by_id[case_id]
        root_length = result["input"]["root"]["length"]
        scale = result["input"]["lengthScale"][0]
        result["counterfactual_not_evaluated"] = {
            "reason": stopping_reason,
            "hypothetical_parent_length_times_scale": describe(root_length * scale),
            "note": "This is a diagnostic witness only. It was not evaluated by the traced operation path and must not determine the reported outcome.",
        }


def report() -> dict[str, Any]:
    results = [run_case(case) for case in cases()]
    validate(results)
    add_counterfactual_witnesses(results)
    source_paths = [
        Path("tools/diagnostics/cp6/run_numeric_cases.py"),
        Path("design/operations/cp6-branch-contract-decisions.md"),
        Path("design/operations/cp5-triangle-contract-decisions.md"),
        Path("tools/diagnostics/cp3/stream_oracle.py"),
    ]
    return {
        "schema": "cp6-numeric-cases/v1",
        "status": "completed-bounded-no-render-numeric-diagnostic",
        "scope": {
            "includes": "Finite-input arithmetic precedence examples for the selected CP6 child evaluation order and an independently transcribed CP3/CP5 private stream trace.",
            "excludes": ["public operation implementation", "catalog or fixture decision", "renderer behavior", "cross-runtime trigonometric conformance", "a proof of all host Math.sin/Math.cos implementations"],
        },
        "runtime": {"python": sys.version, "implementation": platform.python_implementation(), "platform": platform.platform()},
        "arithmetic_order": ["length", "heading", "dx", "dy", "end_x", "end_y"],
        "stream_control": {
            "algorithm": "xoshiro128** 1.1",
            "seed_expansion": "two SplitMix64 outputs packed [low32(q0), high32(q0), low32(q1), high32(q1)]",
            "unit_mapping": "uint32 / 2^32",
            "interval_law": "CP5 endpoint-aware clamped binary64 interpolation; each constant scale/turn interval still consumes its prescribed unit",
        },
        "finite_trigonometry_assumption": {
            "assumption": "For every finite heading, the host sin and cos calls return finite values in [-1,1].",
            "dx_dy_overflow": "unreachable under this assumption after length and heading have passed: |sin(heading)*length| and |cos(heading)*length| are bounded by finite |length| <= MAX.",
            "dx_dy_nonfinite": "not given a synthetic error case. A target whose trig implementation violates the assumption requires separate target evidence; it is outside this finite-input arithmetic diagnostic.",
            "underflow": "reachable and accepted: the positive-minimum-subnormal parent length multiplied by scale 0.5 rounds to canonical +0 child length.",
        },
        "results": results,
        "source_bindings": {path.as_posix(): sha256_file(ROOT / path) for path in source_paths},
        "limitations": [
            "The report uses Python binary64 and its same-runtime math.sin/math.cos values; non-axis trig values are not portable exact-coordinate assertions.",
            "The constant interval inputs simplify mapping while still exercising mandatory stream consumption. They are arithmetic witnesses, not recommended control values.",
            "The stream is transcribed for diagnostic trace accounting and does not import a public or prototype implementation.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUT_DEFAULT)
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(report(), indent=2, sort_keys=True, allow_nan=False) + "\n"
    output.write_text(encoded, encoding="utf-8")
    print(json.dumps({"status": "passed", "output": str(output), "sha256": hashlib.sha256(encoded.encode()).hexdigest()}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
