#!/usr/bin/env python3
"""Validate draft exact-rational simple-polygon segment-clipping fixtures.

This is intentionally a direct draft checker.  It binds the fixture to its staged
catalog and oracle sources, and recomputes successful vectors with exact Fractions.
It does not establish constructor-error precedence or register the draft with
``check_catalog.py``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from tools.diagnostics.clipping.exact_clip_study import clip  # noqa: E402
from tools.diagnostics.clipping.check_error_draft import evaluate


OPERATION_ID = "geometry.clip-segments-simple-polygon-2d"
FIXTURE_FORMAT = "segment-clipping-output"
SUCCESS_KEYS = {"id", "input", "output", "output_bits"}
REQUIRED_BINDINGS = {
    "tools/diagnostics/clipping/build_fixture_draft.py",
    "tools/diagnostics/clipping/exact_clip_study.py",
}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
HEX64 = re.compile(r"^[0-9a-f]{16}$")


def _error(prefix: str, message: str) -> str:
    return f"{prefix}: {message}" if prefix else message


def _finite(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(float(value))
    except OverflowError:
        return False


def _canonical(value: Any) -> bool:
    return _finite(value) and (value != 0 or math.copysign(1.0, float(value)) > 0)


def _integer(value: Any, low: int | None = None, high: int | None = None) -> bool:
    if not _finite(value) or not float(value).is_integer():
        return False
    return (low is None or value >= low) and (high is None or value <= high)


def _bits(value: Any) -> str | None:
    if not _canonical(value):
        return None
    return struct.pack(">d", float(value)).hex()


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_path(root: Path, raw: Any) -> Path | None:
    if not isinstance(raw, str) or not raw.strip() or Path(raw).is_absolute():
        return None
    path = (root / raw).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    return path


def _catalog_path(root: Path, op: dict[str, Any]) -> Path | None:
    staged = op.get("_catalog_path")
    if staged is not None:
        return _safe_path(root, staged)
    return root / "catalog" / ("operations" if op.get("status") == "reviewed" else "drafts") / "clip-segments-simple-polygon-2d.json"


def _schema_errors(schema: Any, value: Any) -> list[str]:
    if not isinstance(schema, dict):
        return ["operation lacks a schema"]
    try:
        return [item.message for item in Draft202012Validator(schema).iter_errors(value)]
    except Exception as exc:
        return [f"invalid schema: {exc}"]


def _recursive_finite(value: Any) -> bool:
    if isinstance(value, dict):
        return all(_recursive_finite(item) for item in value.values())
    if isinstance(value, list):
        return all(_recursive_finite(item) for item in value)
    return not isinstance(value, (int, float)) or isinstance(value, bool) or _finite(value)


def _input_semantic_errors(value: Any) -> list[str]:
    """Check finite carriers and integer domains outside the JSON schema."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    if not _recursive_finite(value):
        errors.append("input contains a nonfinite number")
    for name, upper in (("maxWork", 9_007_199_254_740_991), ("maxOutputSegments", 536_870_911)):
        if name in value and not _integer(value[name], 0, upper):
            errors.append(f"{name} must be a finite non-boolean integer in domain")
    return errors


def _fraction_pair(row: Any) -> tuple[Fraction, Fraction] | None:
    if not isinstance(row, list) or len(row) != 2 or not all(_finite(item) for item in row):
        return None
    return Fraction(float(row[0])), Fraction(float(row[1]))


def _cross(a: tuple[Fraction, Fraction], b: tuple[Fraction, Fraction]) -> Fraction:
    return a[0] * b[1] - a[1] * b[0]


def _sub(a: tuple[Fraction, Fraction], b: tuple[Fraction, Fraction]) -> tuple[Fraction, Fraction]:
    return a[0] - b[0], a[1] - b[1]


def _on_segment(a: tuple[Fraction, Fraction], b: tuple[Fraction, Fraction], p: tuple[Fraction, Fraction]) -> bool:
    return (_cross(_sub(b, a), _sub(p, a)) == 0
            and min(a[0], b[0]) <= p[0] <= max(a[0], b[0])
            and min(a[1], b[1]) <= p[1] <= max(a[1], b[1]))


def _segments_touch(a: tuple[Fraction, Fraction], b: tuple[Fraction, Fraction],
                    c: tuple[Fraction, Fraction], d: tuple[Fraction, Fraction]) -> bool:
    ab_c, ab_d = _cross(_sub(b, a), _sub(c, a)), _cross(_sub(b, a), _sub(d, a))
    cd_a, cd_b = _cross(_sub(d, c), _sub(a, c)), _cross(_sub(d, c), _sub(b, c))
    if ab_c == 0 and _on_segment(a, b, c):
        return True
    if ab_d == 0 and _on_segment(a, b, d):
        return True
    if cd_a == 0 and _on_segment(c, d, a):
        return True
    if cd_b == 0 and _on_segment(c, d, b):
        return True
    return ab_c * ab_d < 0 and cd_a * cd_b < 0


def _simple_polygon_errors(value: Any) -> list[str]:
    if not isinstance(value, dict) or not isinstance(value.get("polygon"), list):
        return []
    polygon = [_fraction_pair(row) for row in value["polygon"]]
    if any(point is None for point in polygon):
        return []
    points = polygon  # type: ignore[assignment]
    if len(set(points)) != len(points):
        return ["polygon has repeated vertices"]
    area = sum(points[index][0] * points[(index + 1) % len(points)][1]
               - points[index][1] * points[(index + 1) % len(points)][0]
               for index in range(len(points)))
    if area == 0:
        return ["polygon has zero signed area"]
    for index, current in enumerate(points):
        previous, following = points[index - 1], points[(index + 1) % len(points)]
        incoming, outgoing = _sub(current, previous), _sub(following, current)
        if _cross(incoming, outgoing) == 0 and incoming[0] * outgoing[0] + incoming[1] * outgoing[1] < 0:
            return [f"polygon backtracks at vertex {index}"]
    count = len(points)
    for first in range(count):
        for second in range(first + 1, count):
            if second == first + 1 or (first == 0 and second == count - 1):
                continue
            if _segments_touch(points[first], points[(first + 1) % count],
                               points[second], points[(second + 1) % count]):
                return [f"polygon nonadjacent edges {first} and {second} touch"]
    return []


def _work(input_data: dict[str, Any]) -> int | None:
    polygon, segments = input_data.get("polygon"), input_data.get("segments")
    if not isinstance(polygon, list) or not isinstance(segments, list):
        return None
    vertices, sources = len(polygon), len(segments)
    return vertices * vertices + sources * (8 * vertices * vertices + 16 * vertices + 8)


def _oracle_output(input_data: dict[str, Any]) -> dict[str, list[Any]] | None:
    polygon, segments = input_data.get("polygon"), input_data.get("segments")
    if not isinstance(polygon, list) or not isinstance(segments, list):
        return None
    result: dict[str, list[Any]] = {"segments": [], "sourceIndices": [], "intervals": []}
    for source_index, raw in enumerate(segments):
        if not isinstance(raw, list) or len(raw) != 4 or not all(_finite(item) for item in raw):
            return None
        start = (Fraction(float(raw[0])), Fraction(float(raw[1])))
        delta = (Fraction(float(raw[2])) - start[0], Fraction(float(raw[3])) - start[1])
        for lo, hi in clip(polygon, [raw[:2], raw[2:]]):
            result["segments"].append([
                float(start[0] + delta[0] * lo), float(start[1] + delta[1] * lo),
                float(start[0] + delta[0] * hi), float(start[1] + delta[1] * hi),
            ])
            result["sourceIndices"].append(source_index)
            result["intervals"].append([float(lo), float(hi)])
    return result


def _validate_bits(case: dict[str, Any], output: dict[str, Any], label: str, errors: list[str]) -> None:
    bits = case.get("output_bits")
    if not isinstance(bits, dict) or set(bits) != {"segments", "intervals"}:
        errors.append(_error(label, "output_bits must contain exactly segments,intervals"))
        return
    for name, width in (("segments", 4), ("intervals", 2)):
        rows, expected_rows = output.get(name), bits.get(name)
        if not isinstance(rows, list) or not isinstance(expected_rows, list) or len(rows) != len(expected_rows):
            errors.append(_error(label, f"output_bits.{name} must align with output.{name}"))
            continue
        for row_index, (row, bit_row) in enumerate(zip(rows, expected_rows)):
            if not isinstance(row, list) or not isinstance(bit_row, list) or len(row) != width or len(bit_row) != width:
                errors.append(_error(label, f"output_bits.{name}[{row_index}] must be a {width}-value row"))
                continue
            for column, (value, encoded) in enumerate(zip(row, bit_row)):
                if not isinstance(encoded, str) or not HEX64.fullmatch(encoded):
                    errors.append(_error(label, f"output_bits.{name}[{row_index}][{column}] must be lowercase binary64 hex"))
                elif _bits(value) != encoded:
                    errors.append(_error(label, f"output_bits.{name}[{row_index}][{column}] disagrees with output"))


def _validate_output_invariants(input_data: dict[str, Any], output: dict[str, Any],
                                label: str, errors: list[str]) -> None:
    segments, sources, intervals = (output.get(name) for name in ("segments", "sourceIndices", "intervals"))
    if not all(isinstance(value, list) for value in (segments, sources, intervals)):
        return
    if len(segments) != len(sources) or len(sources) != len(intervals):
        errors.append(_error(label, "output arrays must have equal length"))
        return
    cap = input_data.get("maxOutputSegments")
    if _integer(cap, 0) and len(segments) > int(cap):
        errors.append(_error(label, "output exceeds maxOutputSegments"))
    source_count = len(input_data.get("segments", [])) if isinstance(input_data.get("segments"), list) else 0
    previous_source = -1
    last_end: dict[int, float] = {}
    for index, (segment, source, interval) in enumerate(zip(segments, sources, intervals)):
        if not _integer(source, 0, source_count - 1):
            errors.append(_error(label, f"sourceIndices[{index}] is outside input segment domain"))
            continue
        source_value = int(source)
        if source_value < previous_source:
            errors.append(_error(label, "output must be ordered by source index"))
        previous_source = source_value
        if (not isinstance(segment, list) or len(segment) != 4
                or not all(_canonical(value) for value in segment)):
            errors.append(_error(label, f"segments[{index}] must be four finite canonical coordinates"))
        elif _bits(segment[0]) == _bits(segment[2]) and _bits(segment[1]) == _bits(segment[3]):
            errors.append(_error(label, f"segments[{index}] endpoints must differ"))
        if (not isinstance(interval, list) or len(interval) != 2
                or not all(_canonical(value) for value in interval)):
            errors.append(_error(label, f"intervals[{index}] must be two finite canonical parameters"))
            continue
        lo, hi = float(interval[0]), float(interval[1])
        if not (0 <= lo < hi <= 1):
            errors.append(_error(label, f"intervals[{index}] must be within [0,1] with t0<t1"))
        if source_value in last_end and not last_end[source_value] < lo:
            errors.append(_error(label, f"intervals for source {source_value} must be strictly ordered and disjoint"))
        last_end[source_value] = hi


def _same_bits(expected: Any, actual: Any) -> bool:
    if isinstance(expected, list):
        return isinstance(actual, list) and len(expected) == len(actual) and all(_same_bits(a, b) for a, b in zip(expected, actual))
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return _bits(expected) is not None and _bits(expected) == _bits(actual)
    return type(expected) is type(actual) and expected == actual


def _validate_success(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    if set(case) != SUCCESS_KEYS:
        errors.append(_error(label, "successful case must contain exactly id,input,output,output_bits"))
    input_data = case.get("input")
    input_errors = _schema_errors(op.get("input_schema"), input_data) + _input_semantic_errors(input_data)
    if input_errors:
        errors.extend(_error(label, f"successful input invalid: {message}") for message in input_errors)
        return
    assert isinstance(input_data, dict)
    polygon_errors = _simple_polygon_errors(input_data)
    if polygon_errors:
        errors.extend(_error(label, f"successful polygon invalid: {message}") for message in polygon_errors)
        return
    work = _work(input_data)
    if work is None or work > int(input_data["maxWork"]):
        errors.append(_error(label, "success must fit maxWork"))
        return
    output = case.get("output")
    output_errors = _schema_errors(op.get("output_schema"), output)
    if output_errors:
        errors.extend(_error(label, f"output schema: {message}") for message in output_errors)
        return
    assert isinstance(output, dict)
    _validate_output_invariants(input_data, output, label, errors)
    _validate_bits(case, output, label, errors)
    expected = _oracle_output(input_data)
    if expected is None or not _same_bits(expected, output):
        errors.append(_error(label, "output differs from independent exact Fraction clipping oracle"))


def _validate_error(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    if set(case) - {"id", "input", "error", "error_detail"}:
        errors.append(_error(label, "error case has unsupported fields"))
    actual = evaluate(case.get("input"), op["input_schema"])
    if actual != (case.get("error"), case.get("error_detail")):
        errors.append(_error(label, "error outcome differs from ordered exact evaluator"))
    code = case.get("error")
    declared = op.get("errors")
    if not isinstance(code, str) or not isinstance(declared, dict) or code not in declared:
        errors.append(_error(label, "error must name a declared operation error"))
    if code != "INVALID_INPUT":
        schema_errors = _schema_errors(op.get("input_schema"), case.get("input"))
        semantic_errors = _input_semantic_errors(case.get("input"))
        if schema_errors or semantic_errors:
            errors.append(_error(label, f"{code} requires schema-valid finite input"))


def validate(root: Path | str, prefix: str, op: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    """Return draft fixture-integrity failures without registering catalog support."""
    root = Path(root)
    errors: list[str] = []
    if not isinstance(op, dict):
        return [_error(prefix, "operation must be an object")]
    if not isinstance(fixture, dict):
        return [_error(prefix, "fixture must be an object")]
    required = {"operation", "version", "fixture_status", "fixture_format", "catalog_sha256", "source_bindings", "cases"}
    if set(fixture) != required:
        errors.append(_error(prefix, "fixture top-level shape differs"))
    if fixture.get("operation") != OPERATION_ID or fixture.get("operation") != op.get("id"):
        errors.append(_error(prefix, "operation must identify simple-polygon segment clipping"))
    if fixture.get("version") != op.get("version"):
        errors.append(_error(prefix, "fixture version must equal operation version"))
    if fixture.get("fixture_status") != op.get("status"):
        errors.append(_error(prefix, "fixture_status must match contract status"))
    if fixture.get("fixture_format") != FIXTURE_FORMAT:
        errors.append(_error(prefix, "fixture_format must be segment-clipping-output"))
    catalog = _catalog_path(root, op)
    catalog_hash = fixture.get("catalog_sha256")
    if not isinstance(catalog_hash, str) or not SHA256.fullmatch(catalog_hash):
        errors.append(_error(prefix, "catalog_sha256 must be lowercase sha256"))
    elif catalog is None or not catalog.is_file():
        errors.append(_error(prefix, "catalog source is unavailable for hash binding"))
    elif _sha256(catalog) != catalog_hash:
        errors.append(_error(prefix, "catalog_sha256 does not bind current operation source"))
    bindings = fixture.get("source_bindings")
    if not isinstance(bindings, dict) or set(bindings) != REQUIRED_BINDINGS:
        errors.append(_error(prefix, "source_bindings must contain exactly the draft generator and exact oracle"))
    elif all(isinstance(raw, str) for raw in bindings):
        for raw, bound_hash in bindings.items():
            path = _safe_path(root, raw)
            if not isinstance(bound_hash, str) or not SHA256.fullmatch(bound_hash):
                errors.append(_error(prefix, f"source binding {raw!r} must have lowercase sha256"))
            elif path is None or not path.is_file():
                errors.append(_error(prefix, f"source binding {raw!r} is missing or outside repository"))
            elif _sha256(path) != bound_hash:
                errors.append(_error(prefix, f"source binding {raw!r} is stale"))
    cases = fixture.get("cases")
    if not isinstance(cases, list) or not cases:
        return errors + [_error(prefix, "cases must be a nonempty list")]
    identifiers: set[str] = set()
    for ordinal, case in enumerate(cases):
        label = f"{prefix}.cases[{ordinal}]"
        if not isinstance(case, dict):
            errors.append(_error(label, "case must be an object"))
            continue
        identifier = case.get("id")
        if not isinstance(identifier, str) or not identifier.strip() or identifier in identifiers:
            errors.append(_error(label, "case id must be unique and nonempty"))
        else:
            identifiers.add(identifier)
            label = f"{prefix}/{identifier}"
        has_output, has_error = "output" in case, "error" in case
        if "input" not in case or has_output == has_error:
            errors.append(_error(label, "case must provide input and exactly one of output,error"))
        elif has_output:
            _validate_success(case, op, label, errors)
        else:
            _validate_error(case, op, label, errors)
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("catalog/operations/clip-segments-simple-polygon-2d.json"))
    parser.add_argument("--fixture", type=Path, default=Path("fixtures/operations/clip-segments-simple-polygon-2d.json"))
    args = parser.parse_args(argv)
    catalog_path = args.catalog if args.catalog.is_absolute() else ROOT / args.catalog
    fixture_path = args.fixture if args.fixture.is_absolute() else ROOT / args.fixture
    try:
        op = json.loads(catalog_path.read_text(encoding="utf-8"))
        op["_catalog_path"] = str(catalog_path.relative_to(ROOT))
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "failed", "errors": [str(exc)]}, sort_keys=True))
        return 2
    errors = validate(ROOT, "segment-clipping", op, fixture)
    print(json.dumps({"status": "passed" if not errors else "failed", "errors": errors}, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
