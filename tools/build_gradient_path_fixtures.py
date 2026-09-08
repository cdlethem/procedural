#!/usr/bin/env python3
"""Generate reviewed gradient-path goldens with the independent Fraction noise oracle.

This is a fixture oracle, never an implementation import: it reuses only the reviewed
field evaluator in build_noise_fixtures.py and uses host math.sin/cos as the reviewed path
contract requires. Sol approved these named-case tolerances; they are not universal bounds.
"""
from __future__ import annotations

import hashlib
import json
import math
import struct
from fractions import Fraction
from pathlib import Path
from typing import Any

from build_noise_fixtures import add, mul, sample

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog/operations/gradient-path.json"
OUTPUT = ROOT / "fixtures/operations/gradient-path.json"
CP2_NUMERICS = ROOT / "evidence/investigations/cp2-numerics.json"
FIELD_LIMIT = 9007199254740991.0
MAX_STEPS = 1073741822
KEYS = ("field", "start", "steps", "stepDistance", "fieldScale", "fieldOffset", "angleBase", "angleScale")


class FixtureError(ValueError):
    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def rounded_add(left: float, right: float) -> float:
    """Fraction oracle for finite results; IEEE host result when rounding overflows."""
    native = left + right
    if native == 0.0 or not math.isfinite(native):
        return native
    try:
        return add(left, right)
    except OverflowError:
        return native


def rounded_mul(left: float, right: float) -> float:
    native = left * right
    if native == 0.0 or not math.isfinite(native):
        return native
    try:
        return mul(left, right)
    except OverflowError:
        return native


def number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise FixtureError("INVALID_INPUT")
    try:
        result = float(value)
    except OverflowError as error:
        raise FixtureError("INVALID_INPUT") from error
    if not math.isfinite(result):
        raise FixtureError("INVALID_INPUT")
    return canonical_zero(result)


def count(value: Any) -> int:
    result = number(value)
    if result != math.floor(result) or result < 0 or result > MAX_STEPS:
        raise FixtureError("INVALID_INPUT")
    return int(result)


def pair(value: Any) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise FixtureError("INVALID_INPUT")
    return number(value[0]), number(value[1])


def configuration(input_value: Any) -> tuple[int, tuple[float, float], int, float, float, tuple[float, float], float, float]:
    if not isinstance(input_value, dict) or set(input_value) != set(KEYS):
        raise FixtureError("INVALID_INPUT")
    field = input_value["field"]
    if not isinstance(field, dict) or set(field) != {"seed"}:
        raise FixtureError("INVALID_INPUT")
    seed_value = number(field["seed"])
    if seed_value != math.floor(seed_value) or seed_value < 0 or seed_value > 4294967295:
        raise FixtureError("INVALID_INPUT")
    start = pair(input_value["start"])
    steps = count(input_value["steps"])
    distance = number(input_value["stepDistance"])
    if distance < 0:
        raise FixtureError("INVALID_INPUT")
    field_scale = number(input_value["fieldScale"])
    offset = pair(input_value["fieldOffset"])
    angle_base = number(input_value["angleBase"])
    angle_scale = number(input_value["angleScale"])
    return int(seed_value), start, steps, distance, field_scale, offset, angle_base, angle_scale


def invalid(code: str, step_index: int, stage: str) -> FixtureError:
    return FixtureError(code, {"stepIndex": step_index, "stage": stage})


def checked_query(value: float, step_index: int, stage: str) -> float:
    if not math.isfinite(value) or value < -FIELD_LIMIT or value >= FIELD_LIMIT:
        raise invalid("TRACE_QUERY_INVALID", step_index, stage)
    # Query signed zero is deliberately preserved. The contract canonicalizes completed
    # state, not intermediate field coordinates.
    return value


def checked_arithmetic(value: float, step_index: int, stage: str) -> float:
    if not math.isfinite(value):
        raise invalid("TRACE_ARITHMETIC_INVALID", step_index, stage)
    return value


def trace(input_value: Any) -> dict[str, Any]:
    seed, (x, y), steps, distance, field_scale, (offset_x, offset_y), angle_base, angle_scale = configuration(input_value)
    positions: list[list[float]] = [[x, y]]
    headings: list[float] = []
    for index in range(steps):
        query_x = checked_query(rounded_add(rounded_mul(x, field_scale), offset_x), index, "query_x")
        query_y = checked_query(rounded_add(rounded_mul(y, field_scale), offset_y), index, "query_y")
        value = sample(seed, query_x, query_y)
        mapped = checked_arithmetic(rounded_mul(angle_scale, value), index, "heading")
        heading = canonical_zero(checked_arithmetic(rounded_add(angle_base, mapped), index, "heading"))
        cosine = math.cos(heading)
        delta_x = checked_arithmetic(rounded_mul(distance, cosine), index, "delta_x")
        sine = math.sin(heading)
        delta_y = checked_arithmetic(rounded_mul(distance, sine), index, "delta_y")
        x = canonical_zero(checked_arithmetic(rounded_add(x, delta_x), index, "position_x"))
        y = canonical_zero(checked_arithmetic(rounded_add(y, delta_y), index, "position_y"))
        headings.append(heading)
        positions.append([x, y])
    return {"positions": positions, "headings": headings}


def input_value(**overrides: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "field": {"seed": 42}, "start": [0.25, 0.75], "steps": 3,
        "stepDistance": 0.4, "fieldScale": 0.002, "fieldOffset": [0.0, 0.0],
        "angleBase": -20.0, "angleScale": 40.0,
    }
    result.update(overrides)
    return result


def comparison(exact: bool) -> dict[str, float | str]:
    if exact:
        return {"positions_abs": 0.0, "headings_abs": 0.0, "status": "reviewed-named-case"}
    return {"positions_abs": 1e-9, "headings_abs": 1e-9, "status": "reviewed-named-case"}


def output_case(case_id: str, input_data: dict[str, Any], exact: bool = False) -> dict[str, Any]:
    return {"id": case_id, "input": input_data, "output": trace(input_data), "comparison": comparison(exact)}


def error_case(case_id: str, input_data: Any) -> dict[str, Any]:
    try:
        trace(input_data)
    except FixtureError as error:
        result: dict[str, Any] = {"id": case_id, "input": input_data, "error": error.code}
        if error.detail is not None:
            result["error_detail"] = error.detail
        return result
    raise AssertionError(case_id + " unexpectedly completed")


def binary64(hex_value: str) -> float:
    """Decode the Java diagnostic's raw IEEE-754 binary64 record, exactly."""
    if not isinstance(hex_value, str) or len(hex_value) != 16:
        raise ValueError("expected a 16-hex-digit binary64 record")
    return struct.unpack(">d", bytes.fromhex(hex_value))[0]


def binary64_bits(value: float) -> str:
    return struct.pack(">d", value).hex()


def cp2_input(case: dict[str, Any]) -> dict[str, Any]:
    """Translate the private diagnostic's names to this reviewed catalog's names."""
    if case["mode"] == "field":
        return input_value(
            field={"seed": case["seed"]}, start=case["start"], steps=case["count"],
            stepDistance=case["step"], fieldScale=case["coordinate_scale"], fieldOffset=[0.0, 0.0],
            angleBase=case["angle_base"], angleScale=case["angle_scale"],
        )
    if case["mode"] == "constant":
        # The diagnostic did not call a field in this mode. A valid inert field config
        # makes that fact explicit: angleScale=0 and fieldScale=0 leave heading=angleBase.
        return input_value(
            field={"seed": 0}, start=case["start"], steps=case["count"],
            stepDistance=case["step"], fieldScale=0.0, fieldOffset=[0.0, 0.0],
            angleBase=case["heading"], angleScale=0.0,
        )
    raise ValueError("unexpected CP2 diagnostic mode")


def long_cases_from_cp2() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Read, but never rerun, the accepted independent Java-loop diagnostic."""
    source_bytes = CP2_NUMERICS.read_bytes()
    report = json.loads(source_bytes)
    if report.get("status") != "completed_diagnostic":
        raise RuntimeError("CP2 numerical diagnostic is not an accepted completed record")
    records = report.get("results")
    if not isinstance(records, list) or len(records) != 20:
        raise RuntimeError("expected the 20 CP2 field/constant diagnostic records")
    source = {
        "kind": "independent-private-loop-diagnostic",
        "path": CP2_NUMERICS.relative_to(ROOT).as_posix(),
        "sha256": hashlib.sha256(source_bytes).hexdigest(),
        "authority": "Java selected_records_bits; not the Fraction short-case oracle",
        "record_encoding": "IEEE-754 binary64 hex decoded by this builder",
    }
    long_cases: list[dict[str, Any]] = []
    for result in records:
        case = result.get("case")
        selected = result.get("selected_records_bits", {}).get("java")
        if not isinstance(case, dict) or not isinstance(selected, list) or not selected:
            raise RuntimeError("CP2 diagnostic record lacks Java selected values")
        converted = cp2_input(case)
        expected = [{"pointIndex": 0, "position": [float(case["start"][0]), float(case["start"][1])]}]
        previous_index = -1
        for record in selected:
            index = record.get("index")
            if not isinstance(index, int) or index <= previous_index or index >= converted["steps"]:
                raise RuntimeError("invalid CP2 selected index")
            position = [binary64(record["x"]), binary64(record["y"])]
            heading = binary64(record["heading"])
            if not all(math.isfinite(value) for value in position + [heading]):
                raise RuntimeError("non-finite CP2 selected record")
            expected.append({"headingIndex": index, "pointIndex": index + 1,
                             "position": position, "heading": heading})
            previous_index = index
        long_cases.append({
            "id": "cp2-" + case["id"], "source": "cp2-numerics-java-selected-records",
            "input": converted, "selected": expected,
            "comparison": comparison(False),
        })
    return source, long_cases


def assert_invariants(cases: list[dict[str, Any]], errors: list[dict[str, Any]], long_cases: list[dict[str, Any]]) -> None:
    by_id = {case["id"]: case for case in cases}
    for case in cases:
        assert len(case["output"]["positions"]) == int(case["input"]["steps"]) + 1
        assert len(case["output"]["headings"]) == int(case["input"]["steps"])
        for point in case["output"]["positions"]:
            assert len(point) == 2 and all(math.isfinite(value) and math.copysign(1.0, value) > 0 if value == 0.0 else math.isfinite(value) for value in point)
        assert all(math.isfinite(value) and (math.copysign(1.0, value) > 0 if value == 0.0 else True) for value in case["output"]["headings"])
    evolving = by_id["evolving-field"]
    assert evolving["output"]["headings"][1] != evolving["output"]["headings"][0], "second heading used a frozen initial sample"
    cardinal = by_id["cardinal-zero-heading"]
    assert cardinal["output"] == {"positions": [[0.0, 0.0], [1.0, 0.0]], "headings": [0.0]}
    assert by_id["integral-float-steps"]["output"]["headings"] and by_id["integral-float-steps"]["input"]["steps"] == 2.0
    zero_distance = by_id["zero-step-distance"]
    assert len({tuple(point) for point in zero_distance["output"]["positions"]}) == 1
    assert zero_distance["comparison"]["positions_abs"] == 0.0
    assert zero_distance["comparison"]["headings_abs"] == 0.0
    prefix_positions = by_id["prefix-4"]["output"]["positions"]
    longer_positions = by_id["prefix-5"]["output"]["positions"][:-1]
    prefix_headings = by_id["prefix-4"]["output"]["headings"]
    longer_headings = by_id["prefix-5"]["output"]["headings"][:-1]
    assert [[binary64_bits(value) for value in point] for point in prefix_positions] == [[binary64_bits(value) for value in point] for point in longer_positions]
    assert [binary64_bits(value) for value in prefix_headings] == [binary64_bits(value) for value in longer_headings]
    adversarial = by_id["separate-multiply-add-stationary"]
    separate_query_x = rounded_add(rounded_mul(1e16, 1.0000000000000002), -1e16)
    fused_query_x = float(Fraction.from_float(1e16) * Fraction.from_float(1.0000000000000002) + Fraction.from_float(-1e16))
    assert separate_query_x == 2.0 and fused_query_x == 2.220446049250313
    assert sample(42, separate_query_x, 0.375) != sample(42, fused_query_x, 0.375), "FMA discriminator must select a different field sample"
    assert adversarial["output"]["headings"] == [sample(42, separate_query_x, 0.375)]
    assert adversarial["comparison"]["headings_abs"] == 0.0
    error_ids = {case["id"] for case in errors}
    required = {"query-invalid-at-zero", "query-invalid-late", "query-y-invalid-angle-scale-zero",
                "query-multiply-overflow", "heading-overflow", "endpoint-overflow", "endpoint-y-overflow"}
    assert required <= error_ids
    details = {case["id"]: case["error_detail"] for case in errors if "error_detail" in case}
    assert details["query-invalid-at-zero"] == {"stepIndex": 0, "stage": "query_x"}
    assert details["query-invalid-late"] == {"stepIndex": 1, "stage": "query_x"}
    assert details["query-y-invalid-angle-scale-zero"] == {"stepIndex": 0, "stage": "query_y"}
    assert details["query-multiply-overflow"] == {"stepIndex": 0, "stage": "query_x"}
    assert details["heading-overflow"] == {"stepIndex": 0, "stage": "heading"}
    assert details["endpoint-overflow"] == {"stepIndex": 0, "stage": "position_x"}
    assert details["endpoint-y-overflow"] == {"stepIndex": 0, "stage": "position_y"}
    assert len(long_cases) == 20
    for case in long_cases:
        selected = case["selected"]
        assert selected[0]["pointIndex"] == 0 and "headingIndex" not in selected[0]
        assert [entry["headingIndex"] for entry in selected[1:]] == sorted(entry["headingIndex"] for entry in selected[1:])
        assert all(entry["pointIndex"] == entry["headingIndex"] + 1 for entry in selected[1:])
        assert selected[-1]["headingIndex"] == case["input"]["steps"] - 1


def main() -> None:
    contract_bytes = CATALOG.read_bytes()
    contract = json.loads(contract_bytes)
    if (contract.get("id"), contract.get("version"), contract.get("fixtures")) != ("path.gradient-trace-2d", "0.1.0", "fixtures/operations/gradient-path.json"):
        raise RuntimeError("gradient-path catalog identity/fixture binding changed; review this oracle")
    cases = [
        output_case("zero-count-huge-finite", input_value(start=[1e308, -1e308], steps=0, fieldScale=1e-308, fieldOffset=[1e308, -1e308], angleBase=-0.0, angleScale=0.0), True),
        output_case("canonical-negative-zero", input_value(start=[-0.0, -0.0], steps=0, fieldScale=-0.0, fieldOffset=[-0.0, 0.0], angleBase=-0.0, angleScale=-0.0), True),
        output_case("cardinal-zero-heading", input_value(start=[0.0, 0.0], steps=1, stepDistance=1.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0), True),
        output_case("integral-float-steps", input_value(steps=2.0, start=[0.0, 0.0], stepDistance=1.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0), True),
        output_case("evolving-field", input_value(start=[60.0, 80.0], steps=4, stepDistance=0.4, fieldScale=0.002, fieldOffset=[0.0, 0.0], angleBase=-20.0, angleScale=40.0)),
        output_case("translated-negative-start", input_value(start=[-3.5, 4.25], steps=3, stepDistance=0.75, fieldScale=0.125, fieldOffset=[7.25, -5.5], angleBase=-1.0, angleScale=3.5)),
        output_case("reflected-field", input_value(start=[2.0, -1.0], steps=3, stepDistance=0.5, fieldScale=-0.25, fieldOffset=[0.75, -0.5], angleBase=0.3, angleScale=-2.0)),
        output_case("zero-step-distance", input_value(start=[0.25, 0.75], steps=3, stepDistance=0.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.2, angleScale=2.0), True),
        output_case("separate-multiply-add-stationary", input_value(start=[1e16, 0.0], steps=1, stepDistance=0.0, fieldScale=1.0000000000000002, fieldOffset=[-1e16, 0.375], angleBase=0.0, angleScale=1.0), True),
        output_case("prefix-4", input_value(start=[-0.25, 0.5], steps=4, stepDistance=0.4, fieldScale=0.01, fieldOffset=[0.125, -0.25], angleBase=-0.7, angleScale=2.5)),
        output_case("prefix-5", input_value(start=[-0.25, 0.5], steps=5, stepDistance=0.4, fieldScale=0.01, fieldOffset=[0.125, -0.25], angleBase=-0.7, angleScale=2.5)),
        output_case("final-endpoint-not-sampled", input_value(start=[FIELD_LIMIT - 1.0, 0.0], steps=1, stepDistance=1.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0), True),
    ]
    for seed in (0, 1, 2147483648, 4294967295):
        case = output_case(f"seed-{seed}", input_value(field={"seed": seed}, start=[60.0, 80.0], steps=4))
        baseline = next(item for item in cases if item["id"] == "evolving-field")
        assert case["output"]["headings"] != baseline["output"]["headings"], "seed was ignored"
        cases.append(case)
    missing = input_value(); missing.pop("angleScale")
    errors = [
        error_case("static-missing", missing),
        error_case("static-extra", input_value(extra=1)),
        error_case("static-bool", input_value(steps=True)),
        error_case("static-negative-count", input_value(steps=-1)),
        error_case("static-fractional-count", input_value(steps=1.5)),
        error_case("static-count-overflow", input_value(steps=MAX_STEPS + 1)),
        error_case("static-negative-distance", input_value(stepDistance=-0.1)),
        error_case("static-bad-field-seed", input_value(field={"seed": -1})),
        error_case("static-malformed-start", input_value(start=[0.0])),
        error_case("query-invalid-at-zero", input_value(start=[FIELD_LIMIT, 0.0], steps=1, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0)),
        error_case("query-invalid-late", input_value(start=[FIELD_LIMIT - 1.0, 0.0], steps=2, stepDistance=1.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0)),
        error_case("query-y-invalid-angle-scale-zero", input_value(start=[0.0, FIELD_LIMIT], steps=1, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0)),
        error_case("query-multiply-overflow", input_value(start=[1e308, 0.0], steps=1, fieldScale=1e308, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0)),
        error_case("heading-overflow", input_value(start=[0.25, 0.75], steps=1, stepDistance=0.0, fieldScale=1.0, fieldOffset=[0.0, 0.0], angleBase=1.7e308, angleScale=1e308)),
        error_case("endpoint-overflow", input_value(start=[1e308, 0.0], steps=1, stepDistance=1e308, fieldScale=0.0, fieldOffset=[0.0, 0.0], angleBase=0.0, angleScale=0.0)),
        error_case("endpoint-y-overflow", input_value(start=[0.0, 1e308], steps=1, stepDistance=1e308, fieldScale=0.0, fieldOffset=[0.0, 0.0], angleBase=math.pi / 2.0, angleScale=0.0)),
    ]
    cp2_source, long_cases = long_cases_from_cp2()
    assert_invariants(cases, errors, long_cases)
    fixture = {
        "operation": contract["id"], "version": contract["version"],
        "status": "reviewed fixtures; named-case tolerances approved by Sol",
        "catalog_sha256": hashlib.sha256(contract_bytes).hexdigest(),
        "oracle": "tools/build_gradient_path_fixtures.py using tools/build_noise_fixtures.py Fraction field oracle; host math.sin/cos; no native path evaluator imported",
        "arithmetic": "binary64 operations separately rounded in documented order; completed heading/positions zeros canonicalized positive while raw intermediate query signed zeros are preserved; no FMA/reassociation",
        "comparison_policy": "exact cases use 0; named non-cardinal position/heading cases use approved 1e-9 per value; no universal bound",
        "cases": cases + errors,
        "cross_case_checks": [
            {
                "id": "prefix-4-5-raw-binary64",
                "kind": "raw-binary64-prefix",
                "prefix_case": "prefix-4",
                "extended_case": "prefix-5",
                "positions": "prefix-4 positions equal prefix of prefix-5 positions by raw binary64 bits",
                "headings": "prefix-4 headings equal prefix of prefix-5 headings by raw binary64 bits",
            }
        ],
        "long_cases_source": cp2_source,
        "long_cases": long_cases,
        "native_only_checks": [
            "Path owns detached packed arrays/configuration; getters/export must not resample or recompute.",
            "Dynamic failure discards partial arrays and returns no path; host allocation failure is not INVALID_INPUT or partial success.",
            "pointAt/headingAt index validation order and pointInto writable Float64/double buffer ownership/unchanged-on-error require native tests.",
            "Every completed zero coordinate and heading must have positive-zero raw IEEE-754 binary64 sign; comparison equality alone is insufficient.",
            "No renderer, command-object retention, or external mutable field callback is authorized by these pure fixtures."
        ]
    }
    OUTPUT.write_text(json.dumps(fixture, indent=2, allow_nan=False) + "\n")
    print(f"wrote {len(cases)} output cases, {len(errors)} errors, and {len(long_cases)} sparse CP2 long cases to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
