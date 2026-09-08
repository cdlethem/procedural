#!/usr/bin/env python3
"""Generate draft CP4 quadrant-partition contract fixtures.

This independent binary64/RNG reference is fixture evidence only.  It reads the CP3
stream evidence for shared seed vectors, but imports no library or target implementation.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import struct
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog/operations/seeded-quadrant-partition.json"
OUTPUT = ROOT / "fixtures/operations/seeded-quadrant-partition.json"
CP3_STREAM = ROOT / "evidence/investigations/cp3-stream-oracle.json"
CP3_FIXTURE = ROOT / "fixtures/operations/seeded-circle-placement.json"
MAX_REPLACEMENTS = 178_956_970
MASK32 = (1 << 32) - 1
MASK64 = (1 << 64) - 1
GAMMA = 0x9E3779B97F4A7C15
MIX_A = 0xBF58476D1CE4E5B9
MIX_B = 0x94D049BB133111EB
UNIT_DENOMINATOR = float(1 << 32)


class FixtureError(ValueError):
    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def bits(value: float) -> str:
    return f"{struct.unpack('>Q', struct.pack('>d', value))[0]:016x}"


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


def positive(value: Any) -> float:
    result = number(value)
    if result <= 0.0:
        raise FixtureError("INVALID_INPUT")
    return result


def bounded_integer(value: Any, maximum: int) -> int:
    result = number(value)
    if not result.is_integer() or result < 0 or result > maximum:
        raise FixtureError("INVALID_INPUT")
    return int(result)


def pair(value: Any, *, positive_values: bool = False) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise FixtureError("INVALID_INPUT")
    convert = positive if positive_values else number
    return convert(value[0]), convert(value[1])


def rotl32(value: int, count: int) -> int:
    value &= MASK32
    return ((value << count) | (value >> (32 - count))) & MASK32


def splitmix64_next(state: int) -> tuple[int, int]:
    state = (state + GAMMA) & MASK64
    mixed = state
    mixed = ((mixed ^ (mixed >> 30)) * MIX_A) & MASK64
    mixed = ((mixed ^ (mixed >> 27)) * MIX_B) & MASK64
    return state, (mixed ^ (mixed >> 31)) & MASK64


def expand_seed(seed: int) -> tuple[int, int, int, int]:
    state, first = splitmix64_next(seed)
    state, second = splitmix64_next(state)
    words = (first & MASK32, first >> 32, second & MASK32, second >> 32)
    assert any(words), "the specified expansion must not create the forbidden all-zero state"
    return words


class Xoshiro128StarStar11:
    def __init__(self, seed: int) -> None:
        self.words = list(expand_seed(seed))

    def next_u32(self) -> int:
        s0, s1, s2, s3 = self.words
        output = (rotl32((s1 * 5) & MASK32, 7) * 9) & MASK32
        transient = (s1 << 9) & MASK32
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= transient
        s3 = rotl32(s3, 11)
        self.words[:] = [s0 & MASK32, s1 & MASK32, s2 & MASK32, s3 & MASK32]
        return output

    def next_unit(self) -> tuple[int, float, list[int]]:
        output = self.next_u32()
        return output, output / UNIT_DENOMINATOR, list(self.words)


def checked_root(origin: tuple[float, float], extent: tuple[float, float]) -> tuple[float, float, float, float]:
    left, top = origin
    width, height = extent
    right = left + width
    bottom = top + height
    if not (math.isfinite(right) and math.isfinite(bottom) and right > left and bottom > top):
        raise FixtureError("INVALID_RECTANGLE")
    represented_width = right - left
    represented_height = bottom - top
    if not (
        math.isfinite(represented_width)
        and math.isfinite(represented_height)
        and represented_width > 0.0
        and represented_height > 0.0
    ):
        raise FixtureError("INVALID_RECTANGLE")
    return canonical_zero(left), canonical_zero(top), canonical_zero(right), canonical_zero(bottom)


def parse_config(value: Any) -> tuple[int, int, tuple[float, float], tuple[float, float], float]:
    expected = {"seed", "replacements", "origin", "extent", "selectionFraction"}
    if not isinstance(value, dict) or set(value) != expected:
        raise FixtureError("INVALID_INPUT")
    seed = bounded_integer(value["seed"], MASK32)
    replacements = bounded_integer(value["replacements"], MAX_REPLACEMENTS)
    origin = pair(value["origin"])
    extent = pair(value["extent"], positive_values=True)
    fraction = positive(value["selectionFraction"])
    if fraction > 1.0:
        raise FixtureError("INVALID_INPUT")
    return seed, replacements, origin, extent, fraction


def values(leaves: list[tuple[float, float, float, float, int]], replacements: int) -> dict[str, Any]:
    output_bounds = [[canonical_zero(component) for component in leaf[:4]] for leaf in leaves]
    output_ids = [leaf[4] for leaf in leaves]
    if output_ids != sorted(output_ids) or len(set(output_ids)) != len(output_ids):
        raise AssertionError("append/remove construction must retain strictly increasing unique creation IDs")
    return {
        "bounds": output_bounds,
        "ids": output_ids,
        "replacements": replacements,
    }


def reference(config: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    seed, replacements, origin, extent, fraction = parse_config(config)
    root = checked_root(origin, extent)
    leaves: list[tuple[float, float, float, float, int]] = [(*root, 0)]
    if replacements == 0:
        return values(leaves, replacements), []
    stream = Xoshiro128StarStar11(seed)
    next_id = 1
    trace: list[dict[str, Any]] = []
    for replacement_index in range(replacements):
        output, unit, post_state = stream.next_unit()
        live_count = len(leaves)
        limit = live_count * fraction
        product = unit * limit
        selected = math.floor(product)
        if not 0 <= selected < live_count:
            raise AssertionError("specified unit mapping and finite selection arithmetic must select a live leaf")
        left, top, right, bottom, parent_id = leaves[selected]
        midpoint_x = left + ((right - left) * 0.5)
        trace_row = {
            "replacementIndex": replacement_index,
            "liveCount": live_count,
            "unit_u32": output,
            "unit": unit,
            "limit": limit,
            "selected": selected,
            "parentId": parent_id,
            "post_state": post_state,
        }
        if not (left < midpoint_x < right):
            trace.append(trace_row)
            error = FixtureError("PARTITION_ARITHMETIC_INVALID", {"replacementIndex": replacement_index, "stage": "midpoint_x"})
            error.selection_trace = trace
            raise error
        midpoint_y = top + ((bottom - top) * 0.5)
        if not (top < midpoint_y < bottom):
            trace.append(trace_row)
            error = FixtureError("PARTITION_ARITHMETIC_INVALID", {"replacementIndex": replacement_index, "stage": "midpoint_y"})
            error.selection_trace = trace
            raise error
        trace_row["midpoint_bits_hex"] = [bits(midpoint_x), bits(midpoint_y)]
        trace.append(trace_row)
        leaves.extend(
            (
                (left, top, midpoint_x, midpoint_y, next_id),
                (midpoint_x, top, right, midpoint_y, next_id + 1),
                (midpoint_x, midpoint_y, right, bottom, next_id + 2),
                (left, midpoint_y, midpoint_x, bottom, next_id + 3),
            )
        )
        next_id += 4
        del leaves[selected]
    return values(leaves, replacements), trace


def bound_bits(output: dict[str, Any]) -> list[list[str]]:
    return [[bits(value) for value in row] for row in output["bounds"]]


def success(case_id: str, config: dict[str, Any], **metadata: Any) -> dict[str, Any]:
    output, trace = reference(copy.deepcopy(config))
    case: dict[str, Any] = {
        "id": case_id,
        "input": config,
        "output": output,
        "comparison": {"mode": "binary64-exact"},
        "bounds_bits_hex": bound_bits(output),
        "selection_trace": trace,
    }
    case.update(metadata)
    return case


def failure(case_id: str, config: Any, expected_code: str, expected_detail: dict[str, Any] | None = None) -> dict[str, Any]:
    selection_trace: list[dict[str, Any]] | None = None
    try:
        reference(copy.deepcopy(config))
    except FixtureError as error:
        if error.code != expected_code or error.detail != expected_detail:
            raise AssertionError(
                f"{case_id}: got {error.code}/{error.detail!r}, expected {expected_code}/{expected_detail!r}"
            )
        selection_trace = getattr(error, "selection_trace", None)
    else:
        raise AssertionError(f"{case_id}: expected an error")
    case: dict[str, Any] = {"id": case_id, "input": config, "error": expected_code}
    if expected_detail is not None:
        case["error_detail"] = expected_detail
        if selection_trace is not None:
            case["selection_trace"] = selection_trace
    return case


def normal_config(**overrides: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "seed": 42,
        "replacements": 4,
        "origin": [0.0, 0.0],
        "extent": [16.0, 8.0],
        "selectionFraction": 0.5,
    }
    result.update(overrides)
    return result


def shared_seed_vectors() -> list[dict[str, Any]]:
    stream_report = json.loads(CP3_STREAM.read_text(encoding="utf-8"))
    placement_fixture = json.loads(CP3_FIXTURE.read_text(encoding="utf-8"))
    vectors = stream_report.get("seed_vectors")
    if not isinstance(vectors, list) or len(vectors) != 5:
        raise RuntimeError("CP3 stream report does not expose the expected five seed vectors")
    fixture_vectors = placement_fixture.get("seed_vectors")
    if vectors != fixture_vectors:
        raise RuntimeError("CP3 fixture seed vectors no longer match its independent stream report")
    for vector in vectors:
        seed = vector["seed"]
        stream = Xoshiro128StarStar11(seed)
        if list(stream.words) != vector["initial_state"]:
            raise RuntimeError(f"seed expansion differs from CP3 vector for seed {seed}")
        for expected in vector["first_10"]:
            output, unit, state = stream.next_unit()
            if output != expected["output_u32"] or unit != expected["unit"] or state != expected["post_state"]:
                raise RuntimeError(f"stream recurrence differs from CP3 vector for seed {seed}")
    return vectors


def generate() -> dict[str, Any]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if catalog.get("status") not in {"draft", "reviewed"} or catalog.get("fixture_format") != "partition-output":
        raise RuntimeError("fixture generator requires the CP4 partition contract in draft or reviewed status")
    cases: list[dict[str, Any]] = []
    cases.extend(
        [
            success("zero-replacements-root", normal_config(replacements=0)),
            success(
                "zero-replacements-canonicalizes-signed-zero-inputs",
                normal_config(seed=-0.0, replacements=-0.0, origin=[-0.0, -0.0], extent=[8.0, 4.0], selectionFraction=1.0),
            ),
            success(
                "zero-replacements-unsplittable-positive-root",
                normal_config(replacements=0, origin=[1.0, 0.0], extent=[2.0**-52, 1.0]),
            ),
            success(
                "zero-replacements-minimum-subnormal-root",
                normal_config(replacements=0, origin=[0.0, 0.0], extent=[float.fromhex("0x0.0000000000001p-1022"), 1.0]),
            ),
            success(
                "one-split-tl-tr-br-bl-and-canonical-zero",
                normal_config(replacements=1, seed=0, origin=[-0.0, -0.0], extent=[8.0, 4.0], selectionFraction=1.0),
            ),
            success(
                "fractional-odd-live-count-last-fractional-index",
                normal_config(replacements=3, seed=4, origin=[0.0, 0.0], extent=[32.0, 32.0], selectionFraction=0.5),
                source_order_distinction="at replacement 2, L=7 and unit*3.5 selects index 3; floor(L*fraction)=3 would exclude it",
            ),
            success(
                "selected-middle-parent-live-list-order",
                normal_config(replacements=5, seed=0, origin=[0.0, 0.0], extent=[32.0, 16.0], selectionFraction=1.0),
                source_order_distinction="selected parents include neither first nor last live-list positions; exact final order detects removal of a wrong parent, sorting by size, breadth-first or recursive depth-first traversal, and altered child order. Creation IDs remain monotonic under append/remove, so sorting by ID is intentionally not claimed distinguishing.",
            ),
            success(
                "longer-replacement-history-not-final-prefix",
                normal_config(replacements=6, seed=0, origin=[0.0, 0.0], extent=[32.0, 16.0], selectionFraction=1.0),
                source_order_distinction="shares early replay history with the five-replacement case but intentionally has no final-output prefix guarantee",
            ),
            success(
                "large-finite-root-specified-midpoint",
                normal_config(replacements=1, seed=1, origin=[1e308, -1e308], extent=[1e307, 1e307], selectionFraction=1.0),
            ),
            success(
                "large-finite-root-no-area-predicate",
                normal_config(replacements=1, seed=1, origin=[0.0, 0.0], extent=[1e308, 1e308], selectionFraction=1.0),
                arithmetic_distinction="each endpoint, represented span and midpoint is finite even though a mathematical width*height area would overflow; the contract never computes or validates area",
            ),
            success(
                "midpoint-separate-rounding-order",
                normal_config(
                    replacements=1,
                    seed=1,
                    origin=[724561829.0940151, 0.0],
                    extent=[42035933441.00085, 8.0],
                    selectionFraction=1.0,
                ),
                arithmetic_distinction={
                    "specified_midpoint_x_bits_hex": "42143fd2a09660b4",
                    "wrong_left_plus_right_over_two_bits_hex": "42143fd2a09660b5",
                },
            ),
        ]
    )
    # Root endpoint validation is distinct from requested midpoint work.
    cases.extend(
        [
            failure("root-x-endpoint-collapse", normal_config(replacements=0, origin=[1.0, 0.0], extent=[2.0**-53, 1.0]), "INVALID_RECTANGLE"),
            failure("root-y-endpoint-collapse", normal_config(replacements=0, origin=[0.0, 1.0], extent=[1.0, 2.0**-53]), "INVALID_RECTANGLE"),
            failure("root-endpoint-overflow", normal_config(replacements=0, origin=[1e308, 0.0], extent=[1e308, 1.0]), "INVALID_RECTANGLE"),
            failure("midpoint-x-collapse-index-zero", normal_config(replacements=1, origin=[1.0, 0.0], extent=[2.0**-52, 1.0]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 0, "stage": "midpoint_x"}),
            failure("midpoint-y-collapse-index-zero", normal_config(replacements=1, origin=[0.0, 1.0], extent=[1.0, 2.0**-52]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 0, "stage": "midpoint_y"}),
            failure("midpoint-x-precedes-y-index-zero", normal_config(replacements=1, origin=[1.0, 1.0], extent=[2.0**-52, 2.0**-52]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 0, "stage": "midpoint_x"}),
            failure("midpoint-x-collapse-index-one", normal_config(replacements=2, origin=[1.0, 0.0], extent=[2.0**-51, 1.0]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 1, "stage": "midpoint_x"}),
            failure("minimum-subnormal-midpoint-x", normal_config(replacements=1, origin=[0.0, 0.0], extent=[float.fromhex("0x0.0000000000001p-1022"), 1.0]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 0, "stage": "midpoint_x"}),
            failure("minimum-subnormal-midpoint-y", normal_config(replacements=1, origin=[0.0, 0.0], extent=[1.0, float.fromhex("0x0.0000000000001p-1022")]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 0, "stage": "midpoint_y"}),
            failure("twice-subnormal-child-midpoint-index-one", normal_config(replacements=2, origin=[0.0, 0.0], extent=[float.fromhex("0x0.0000000000002p-1022"), 1.0]), "PARTITION_ARITHMETIC_INVALID", {"replacementIndex": 1, "stage": "midpoint_x"}),
        ]
    )
    # Passive JSON validation representatives. Native nonfinite/access/ownership cases live below.
    cases.extend(
        [
            failure("missing-selection-fraction", {key: value for key, value in normal_config().items() if key != "selectionFraction"}, "INVALID_INPUT"),
            failure("extra-property", {**normal_config(), "extra": 1}, "INVALID_INPUT"),
            failure("boolean-seed", normal_config(seed=True), "INVALID_INPUT"),
            failure("seed-over-uint32", normal_config(seed=MASK32 + 1), "INVALID_INPUT"),
            failure("replacements-negative", normal_config(replacements=-1), "INVALID_INPUT"),
            failure("replacements-fractional", normal_config(replacements=1.5), "INVALID_INPUT"),
            failure("replacements-over-packed-limit", normal_config(replacements=MAX_REPLACEMENTS + 1), "INVALID_INPUT"),
            failure("origin-wrong-shape", normal_config(origin=[0.0]), "INVALID_INPUT"),
            failure("extent-zero", normal_config(extent=[0.0, 1.0]), "INVALID_INPUT"),
            failure("extent-negative", normal_config(extent=[-1.0, 1.0]), "INVALID_INPUT"),
            failure("fraction-boolean", normal_config(selectionFraction=True), "INVALID_INPUT"),
            failure("fraction-zero", normal_config(selectionFraction=0.0), "INVALID_INPUT"),
            failure("fraction-over-one", normal_config(selectionFraction=1.0000000000000002), "INVALID_INPUT"),
        ]
    )
    shared_vectors = shared_seed_vectors()
    odd_case = next(case for case in cases if case["id"] == "fractional-odd-live-count-last-fractional-index")
    if odd_case["selection_trace"][2]["selected"] != 3:
        raise AssertionError("odd-list fractional vector no longer distinguishes the required last interval")
    one_split = next(case for case in cases if case["id"] == "one-split-tl-tr-br-bl-and-canonical-zero")
    if one_split["output"]["ids"] != [1, 2, 3, 4]:
        raise AssertionError("one split must assign child IDs 1 through 4 in creation order")
    middle_case = next(case for case in cases if case["id"] == "selected-middle-parent-live-list-order")
    if not any(0 < row["selected"] < row["liveCount"] - 1 for row in middle_case["selection_trace"]):
        raise AssertionError("live-list order vector no longer selects a middle parent")
    long_case = next(case for case in cases if case["id"] == "longer-replacement-history-not-final-prefix")
    short_bounds = middle_case["output"]["bounds"]
    if long_case["output"]["bounds"][:len(short_bounds)] == short_bounds:
        raise AssertionError("longer final output unexpectedly became a prefix of the shorter final output")
    midpoint_case = next(case for case in cases if case["id"] == "midpoint-separate-rounding-order")
    if midpoint_case["selection_trace"][0]["midpoint_bits_hex"][0] != midpoint_case["arithmetic_distinction"]["specified_midpoint_x_bits_hex"]:
        raise AssertionError("specified midpoint adversary no longer binds its expected binary64 bit pattern")
    midpoint_input = midpoint_case["input"]
    left = float(midpoint_input["origin"][0])
    right = left + float(midpoint_input["extent"][0])
    wrong_midpoint_bits = bits((left + right) * 0.5)
    if wrong_midpoint_bits != midpoint_case["arithmetic_distinction"]["wrong_left_plus_right_over_two_bits_hex"]:
        raise AssertionError("midpoint adversary no longer binds the wrong reassociated bit pattern")
    if wrong_midpoint_bits == midpoint_case["arithmetic_distinction"]["specified_midpoint_x_bits_hex"]:
        raise AssertionError("midpoint adversary no longer distinguishes specified arithmetic from reassociation")
    no_area_case = next(case for case in cases if case["id"] == "large-finite-root-no-area-predicate")
    if not all(math.isfinite(value) for bound in no_area_case["output"]["bounds"] for value in bound):
        raise AssertionError("large finite root vector must not depend on an overflowing area calculation")
    return {
        "operation": catalog["id"],
        "version": catalog["version"],
        "fixture_format": "partition-output",
        "fixture_status": "generated shared-contract vectors; native implementation validation is separate",
        "catalog_sha256": sha256_file(CATALOG),
        "generator": {
            "path": "tools/generate_quadrant_partition_fixtures.py",
            "sha256": sha256_file(Path(__file__).resolve()),
            "reference": "Independent Python binary64 endpoint/midpoint and xoshiro128**1.1 reference; no public-core or target implementation import.",
        },
        "rng_provenance": {
            "kind": "private-xoshiro128starstar-1-1",
            "shared_cp3_stream_evidence": str(CP3_STREAM.relative_to(ROOT)),
            "shared_cp3_stream_evidence_sha256": sha256_file(CP3_STREAM),
            "shared_cp3_fixture": str(CP3_FIXTURE.relative_to(ROOT)),
            "shared_cp3_fixture_sha256": sha256_file(CP3_FIXTURE),
            "draws_per_requested_replacement": 1,
            "draws_for_zero_replacements": 0,
        },
        "seed_vectors": shared_vectors,
        "cases": cases,
        "cross_case_checks": [
            {
                "id": "zero-replacements-no-rng-draw",
                "case": "zero-replacements-root",
                "kind": "empty-selection-trace",
            },
            {
                "id": "one-unit-before-each-requested-split",
                "cases": ["selected-middle-parent-live-list-order", "midpoint-x-collapse-index-one"],
                "kind": "selection-trace-count-equals-attempted-replacements-including-failing-draw",
            },
            {
                "id": "child-ids-are-birth-identities-not-live-indices",
                "case": "selected-middle-parent-live-list-order",
                "kind": "stable-ids-in-mutation-ordered-result",
            },
            {
                "id": "longer-history-is-not-final-output-prefix",
                "short_case": "selected-middle-parent-live-list-order",
                "long_case": "longer-replacement-history-not-final-prefix",
                "kind": "explicit-non-prefix",
            },
        ],
        "native_only_cases": [
            {
                "id": "nonfinite-and-overflowing-numeric-carriers",
                "description": "NaN, +/-Infinity and arbitrary-size Python integer values whose binary64 conversion fails are INVALID_INPUT. Literal nonfinite JSON is intentionally absent.",
            },
            {
                "id": "passive-input-carriers-only",
                "description": "Recognized wrong carriers (Java BigInteger/BigDecimal/custom Number, JavaScript class instances or typed-array pairs, and Python custom mapping/list containers) are INVALID_INPUT. JavaScript active getters/proxies and analogous custom hooks are outside passive interchange and need not be universally detected or read.",
            },
        ],
        "native_ownership_access_requirements": {
            "status": "required for future native ports; not executed by these pure JSON fixtures",
            "requirements": [
                "Mutating every caller input pair/config container after generation cannot alter retained bounds, ids or toValues output.",
                "boundsAt returns a fresh detached four-double carrier; toValues is detached and a failed export leaves the retained result usable.",
                "boundsInto validates index, bound, offset and all four writable binary64 slots before writing; every failure leaves destination slots untouched.",
                "idAt, boundsAt and boundsInto enforce INVALID_INDEX before INDEX_OUT_OF_RANGE before INVALID_OUTPUT, with bool and unsafe numeric indices rejected.",
                "Where a controlled fresh export/allocation failure can be exercised, it leaves a completed result unchanged and usable; otherwise record source proof and an explicit unexecuted marker. No partial result is exposed after generation failure.",
            ],
        },
    }


def main() -> None:
    fixture = generate()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"operation": fixture["operation"], "cases": len(fixture["cases"]), "output": str(OUTPUT)}, sort_keys=True))


if __name__ == "__main__":
    main()
