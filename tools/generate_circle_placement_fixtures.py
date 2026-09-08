#!/usr/bin/env python3
"""Generate candidate CP3 circle-placement fixtures from an independent binary64 kernel.

This is a fixture oracle, not a public implementation. It does not import Java or the
frozen CP3 stream oracle; the selected SplitMix64/xoshiro recurrence is transcribed here
from the shared seeded-placement specification and records its provenance in generated fixtures.
"""
from __future__ import annotations

import hashlib
import json
import math
import struct
from fractions import Fraction
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[1]
ORDERED_CATALOG = ROOT / "catalog/operations/ordered-circle-filter.json"
SEEDED_CATALOG = ROOT / "catalog/operations/seeded-circle-placement.json"
ORDERED_OUTPUT = ROOT / "fixtures/operations/ordered-circle-filter.json"
SEEDED_OUTPUT = ROOT / "fixtures/operations/seeded-circle-placement.json"
ACCEPTANCE = ROOT / "evidence/investigations/cp3-acceptance.json"
MAX_ATTEMPTS = 1_073_741_823
MASK32 = (1 << 32) - 1
MASK64 = (1 << 64) - 1
GAMMA = 0x9E3779B97F4A7C15
MIX_A = 0xBF58476D1CE4E5B9
MIX_B = 0x94D049BB133111EB
UNIT_DENOMINATOR = float(1 << 32)
SEEDS = (0, 1, 42, 2_147_483_648, 4_294_967_295)


class FixtureError(ValueError):
    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


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


def count(value: Any) -> int:
    result = number(value)
    if not result.is_integer() or result < 0 or result > MAX_ATTEMPTS:
        raise FixtureError("INVALID_INPUT")
    return int(result)


def uint32(value: Any) -> int:
    result = number(value)
    if not result.is_integer() or result < 0 or result > MASK32:
        raise FixtureError("INVALID_INPUT")
    return int(result)


def pair(value: Any, *, positive_values: bool = False) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise FixtureError("INVALID_INPUT")
    convert = positive if positive_values else number
    return convert(value[0]), convert(value[1])


def rotl32(value: int, count_value: int) -> int:
    value &= MASK32
    return ((value << count_value) | (value >> (32 - count_value))) & MASK32


def splitmix64_next(state: int) -> tuple[int, int]:
    state = (state + GAMMA) & MASK64
    mixed = state
    mixed = ((mixed ^ (mixed >> 30)) * MIX_A) & MASK64
    mixed = ((mixed ^ (mixed >> 27)) * MIX_B) & MASK64
    return state, (mixed ^ (mixed >> 31)) & MASK64


def expand_seed(seed: int) -> tuple[int, int, int, int]:
    state = seed
    state, first = splitmix64_next(state)
    state, second = splitmix64_next(state)
    words = (first & MASK32, (first >> 32) & MASK32, second & MASK32, (second >> 32) & MASK32)
    assert any(words), "selected SplitMix64 expansion must never form the forbidden all-zero state"
    return words


class Xoshiro128StarStar11:
    def __init__(self, seed: int) -> None:
        self.words = list(expand_seed(seed))

    def state(self) -> list[int]:
        return list(self.words)

    def next_u32(self) -> int:
        s0, s1, s2, s3 = self.words
        result = (rotl32((s1 * 5) & MASK32, 7) * 9) & MASK32
        transient = (s1 << 9) & MASK32
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= transient
        s3 = rotl32(s3, 11)
        self.words[:] = [s0 & MASK32, s1 & MASK32, s2 & MASK32, s3 & MASK32]
        return result

    def unit(self) -> float:
        return self.next_u32() / UNIT_DENOMINATOR


def checked(value: float, candidate_index: int, stage: str) -> float:
    if not math.isfinite(value):
        raise FixtureError("PLACEMENT_ARITHMETIC_INVALID", {"candidateIndex": candidate_index, "stage": stage})
    return value


def pair_accept(kept: list[tuple[float, float, float, int]], x: float, y: float, radius: float,
                scale: float, candidate_index: int) -> bool:
    for old_x, old_y, old_radius, _ in kept:
        dx = checked(x - old_x, candidate_index, "difference_x")
        dy = checked(y - old_y, candidate_index, "difference_y")
        xx = checked(dx * dx, candidate_index, "square_x")
        if dx != 0.0 and xx == 0.0:
            raise FixtureError("PLACEMENT_ARITHMETIC_INVALID", {"candidateIndex": candidate_index, "stage": "square_x"})
        yy = checked(dy * dy, candidate_index, "square_y")
        if dy != 0.0 and yy == 0.0:
            raise FixtureError("PLACEMENT_ARITHMETIC_INVALID", {"candidateIndex": candidate_index, "stage": "square_y"})
        squared = checked(xx + yy, candidate_index, "distance_squared")
        sum_radius = checked(radius + old_radius, candidate_index, "radius_sum")
        threshold = checked(sum_radius * scale, candidate_index, "threshold")
        if threshold <= 0.0:
            raise FixtureError("PLACEMENT_ARITHMETIC_INVALID", {"candidateIndex": candidate_index, "stage": "threshold"})
        limit_squared = checked(threshold * threshold, candidate_index, "threshold_squared")
        if limit_squared == 0.0:
            raise FixtureError("PLACEMENT_ARITHMETIC_INVALID", {"candidateIndex": candidate_index, "stage": "threshold_squared"})
        if squared < limit_squared:
            return False
    return True


def values_from_kept(kept: list[tuple[float, float, float, int]], attempts: int) -> dict[str, Any]:
    return {
        "centres": [[canonical_zero(x), canonical_zero(y)] for x, y, _, _ in kept],
        "radii": [radius for _, _, radius, _ in kept],
        "sourceIndices": [index for _, _, _, index in kept],
        "attempts": attempts,
    }


def filter_reference(input_value: Any) -> dict[str, Any]:
    if not isinstance(input_value, dict) or set(input_value) != {"centres", "radii", "separationScale"}:
        raise FixtureError("INVALID_INPUT")
    centres_value = input_value["centres"]
    radii_value = input_value["radii"]
    if not isinstance(centres_value, list) or len(centres_value) > MAX_ATTEMPTS:
        raise FixtureError("INVALID_INPUT")
    if not isinstance(radii_value, list) or len(radii_value) != len(centres_value):
        raise FixtureError("INVALID_INPUT")
    scale = positive(input_value["separationScale"])
    proposals: list[tuple[float, float, float]] = []
    # Complete static validation precedes any pair work, including candidates later rejected.
    for centre, radius in zip(centres_value, radii_value):
        x, y = pair(centre)
        proposals.append((x, y, positive(radius)))
    kept: list[tuple[float, float, float, int]] = []
    for index, (x, y, radius) in enumerate(proposals):
        if pair_accept(kept, x, y, radius, scale, index):
            kept.append((x, y, radius, index))
    return values_from_kept(kept, len(proposals))


def seeded_config(input_value: Any) -> tuple[int, int, tuple[float, float], tuple[float, float], tuple[float, float], float]:
    expected = {"seed", "attempts", "origin", "extent", "radiusRange", "separationScale"}
    if not isinstance(input_value, dict) or set(input_value) != expected:
        raise FixtureError("INVALID_INPUT")
    seed = uint32(input_value["seed"])
    attempts = count(input_value["attempts"])
    origin = pair(input_value["origin"])
    extent = pair(input_value["extent"], positive_values=True)
    radius_range = pair(input_value["radiusRange"], positive_values=True)
    if radius_range[0] > radius_range[1]:
        raise FixtureError("INVALID_INPUT")
    scale = positive(input_value["separationScale"])
    return seed, attempts, origin, extent, radius_range, scale


def seeded_proposals(seed: int, attempts: int, origin: tuple[float, float], extent: tuple[float, float],
                     radius_range: tuple[float, float]) -> Iterator[tuple[float, float, float]]:
    """Lazily map one candidate at a time before the shared filter consumes it."""
    stream = Xoshiro128StarStar11(seed)
    minimum, maximum = radius_range
    for index in range(attempts):
        ux, uy, u, v = stream.unit(), stream.unit(), stream.unit(), stream.unit()
        x_product = extent[0] * ux
        # Given the validated public domain and units in [0, 1), these are not public
        # dynamic branches. Retain assertions so this independent oracle cannot silently
        # produce a nonfinite candidate if its stated stream/domain invariant is broken.
        assert math.isfinite(x_product)
        x = canonical_zero(checked(x_product + origin[0], index, "proposal_x"))
        y_product = extent[1] * uy
        assert math.isfinite(y_product)
        y = canonical_zero(checked(y_product + origin[1], index, "proposal_y"))
        span = maximum - minimum
        assert math.isfinite(span)
        first = span * u
        assert math.isfinite(first)
        second = first * v
        assert math.isfinite(second)
        radius = minimum + second
        assert math.isfinite(radius) and radius > 0.0
        yield x, y, radius


def seeded_reference(input_value: Any) -> dict[str, Any]:
    seed, attempts, origin, extent, radius_range, scale = seeded_config(input_value)
    kept: list[tuple[float, float, float, int]] = []
    for index, (x, y, radius) in enumerate(seeded_proposals(seed, attempts, origin, extent, radius_range)):
        if pair_accept(kept, x, y, radius, scale, index):
            kept.append((x, y, radius, index))
    return values_from_kept(kept, attempts)


def geometry_digest(values: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    digest.update(b"cp3-retained-circles-v1\0")
    indices = values["sourceIndices"]
    digest.update(struct.pack(">I", len(indices)))
    for index, centre, radius in zip(indices, values["centres"], values["radii"]):
        digest.update(struct.pack(">I", index))
        digest.update(struct.pack(">d", centre[0]))
        digest.update(struct.pack(">d", centre[1]))
        digest.update(struct.pack(">d", radius))
    return digest.hexdigest()


def float64_bits(value: float) -> str:
    return struct.pack(">d", value).hex()


def comparison() -> dict[str, str]:
    return {"mode": "binary64-exact"}


def output_case(case_id: str, input_value: dict[str, Any], evaluator: Any) -> dict[str, Any]:
    return {"id": case_id, "input": input_value, "output": evaluator(input_value), "comparison": comparison()}


def error_case(case_id: str, input_value: dict[str, Any], evaluator: Any,
               *, expected_code: str = "INVALID_INPUT",
               expected_detail: dict[str, Any] | None = None) -> dict[str, Any]:
    """Materialize an asserted failure rather than deriving its intended stage."""
    try:
        evaluator(input_value)
    except FixtureError as error:
        assert error.code == expected_code, (
            f"{case_id}: expected {expected_code}, got {error.code} ({error.detail!r})"
        )
        assert error.detail == expected_detail, (
            f"{case_id}: expected {expected_detail!r}, got {error.detail!r}"
        )
        result: dict[str, Any] = {"id": case_id, "input": input_value, "error": error.code}
        if error.detail is not None:
            result["error_detail"] = error.detail
        return result
    raise AssertionError(f"{case_id}: unexpectedly completed")


def arithmetic_error_case(case_id: str, input_value: dict[str, Any], evaluator: Any,
                          candidate_index: int, stage: str) -> dict[str, Any]:
    return error_case(case_id, input_value, evaluator,
                      expected_code="PLACEMENT_ARITHMETIC_INVALID",
                      expected_detail={"candidateIndex": candidate_index, "stage": stage})

def ordered_input(centres: list[list[float]], radii: list[float], scale: float = 1.0) -> dict[str, Any]:
    return {"centres": centres, "radii": radii, "separationScale": scale}


def seeded_input(**changes: Any) -> dict[str, Any]:
    value: dict[str, Any] = {
        "seed": 42,
        "attempts": 8,
        "origin": [64.0, 64.0],
        "extent": [512.0, 512.0],
        "radiusRange": [4.0, 64.0],
        "separationScale": 1.0,
    }
    value.update(changes)
    return value


def seeded_materialized_filter_input() -> dict[str, Any]:
    """Independently map a small seeded stream to the filter's explicit proposal form."""
    value = seeded_input(attempts=8)
    seed, attempts, origin, extent, radius_range, scale = seeded_config(value)
    proposals = list(seeded_proposals(seed, attempts, origin, extent, radius_range))
    return ordered_input([[x, y] for x, y, _ in proposals], [radius for _, _, radius in proposals], scale)


def seed_vectors() -> list[dict[str, Any]]:
    vectors = []
    for seed in SEEDS:
        stream = Xoshiro128StarStar11(seed)
        first_ten = []
        initial = stream.state()
        for index in range(10):
            output = stream.next_u32()
            first_ten.append({"index": index, "output_u32": output, "unit": output / UNIT_DENOMINATOR,
                              "post_state": stream.state()})
        vectors.append({"seed": seed, "initial_state": initial, "first_10": first_ten})
    return vectors


def mapping_vectors() -> list[dict[str, Any]]:
    unit_max = MASK32 / UNIT_DENOMINATOR
    vectors = []
    for vector_id, units, config in [
        ("zero-units", [0.0, 0.0, 0.0, 0.0], seeded_input(attempts=1)),
        ("max-u32-units", [unit_max, unit_max, unit_max, unit_max], seeded_input(attempts=1)),
        ("constant-radius-units", [0.25, 0.75, 0.125, 0.875], seeded_input(attempts=1, radiusRange=[7.0, 7.0])),
        ("centre-separate-rounding-no-fma", [0.9999999925494194, 0.5, 0.5, 0.5], seeded_input(
            attempts=1, origin=[-1.0, 0.0], extent=[1.0000000074505806, 1.0], radiusRange=[1.0, 2.0])),
        ("radius-left-associated-order", [0.25, 0.75, 0.9999999925494194, 0.2750293218996376], seeded_input(
            attempts=1, origin=[0.0, 0.0], extent=[1.0, 1.0],
            radiusRange=[9.5367431640625e-7, 1.000000961124897])),
    ]:
        ux, uy, u, v = units
        origin = config["origin"]
        extent = config["extent"]
        minimum, maximum = config["radiusRange"]
        x = canonical_zero((extent[0] * ux) + origin[0])
        y = canonical_zero((extent[1] * uy) + origin[1])
        span = maximum - minimum
        radius = minimum + ((span * u) * v)
        if vector_id == "centre-separate-rounding-no-fma":
            fused = float(Fraction.from_float(extent[0]) * Fraction.from_float(ux)
                          + Fraction.from_float(origin[0]))
            assert float64_bits(x) == "0000000000000000"
            assert float64_bits(fused) == "bc90000000000000"
            assert x != fused
        if vector_id == "radius-left-associated-order":
            reassociated = minimum + span * (u * v)
            assert float64_bits(radius) == "3fd19a1895c00000"
            assert float64_bits(reassociated) == "3fd19a1895bfffff"
            assert radius != reassociated
        vectors.append({"id": vector_id, "units": units, "config": config,
                        "mapped": {"centre": [x, y], "radius": radius}})
    return vectors


def ordered_fixture() -> dict[str, Any]:
    materialized_seeded = seeded_materialized_filter_input()
    materialized_seeded_output = filter_reference(materialized_seeded)
    assert materialized_seeded_output == seeded_reference(seeded_input(attempts=8))
    cases = [
        output_case("empty", ordered_input([], [], 1.0), filter_reference),
        error_case("empty-still-validates-scale", ordered_input([], [], 0.0), filter_reference),
        output_case("ordinary-tangent", ordered_input([[0.0, 0.0], [2.0, 0.0]], [1.0, 1.0]), filter_reference),
        output_case("ordinary-one-ulp-inside", ordered_input([[0.0, 0.0], [math.nextafter(2.0, 0.0), 0.0]], [1.0, 1.0]), filter_reference),
        output_case("first-tiny-positive-circle", ordered_input([[-0.0, 0.0]], [math.nextafter(0.0, 1.0)]), filter_reference),
        output_case("rejected-index-and-later-accept", ordered_input([[0.0, 0.0], [1.0, 0.0], [4.0, 0.0]], [1.0, 1.0, 1.0]), filter_reference),
        output_case("order-big-first", ordered_input([[0.0, 0.0], [12.0, 0.0]], [10.0, 4.0]), filter_reference),
        output_case("order-small-first", ordered_input([[12.0, 0.0], [0.0, 0.0]], [4.0, 10.0]), filter_reference),
        output_case("duplicate-centres-below-one-scale-still-rejects", ordered_input([[0.0, 0.0], [0.0, 0.0]], [1.0, 1.0], 0.5), filter_reference),
        output_case("below-one-scale-allows-separated-overlap", ordered_input([[0.0, 0.0], [1.5, 0.0]], [1.0, 1.0], 0.5), filter_reference),
        output_case("mixed-signed-zero", ordered_input([[-0.0, 0.0], [2.0, -0.0]], [1.0, 1.0]), filter_reference),
        {"id": "seeded-42-8-materialized-proposals", "input": materialized_seeded,
         "output": materialized_seeded_output, "comparison": comparison()},
        error_case("late-invalid-radius-all-or-error", ordered_input([[0.0, 0.0], [4.0, 0.0], [8.0, 0.0]], [1.0, 1.0, 0.0]), filter_reference),
        error_case("static-validation-beats-earlier-pair-arithmetic", ordered_input(
            [[0.0, 0.0], [math.ldexp(1.0, 512), 0.0], [0.0, 0.0]], [1.0, 1.0, 0.0]), filter_reference),
        error_case("negative-radius", ordered_input([[0.0, 0.0]], [-1.0]), filter_reference),
        error_case("zero-separation-scale", ordered_input([[0.0, 0.0]], [1.0], 0.0), filter_reference),
        error_case("negative-separation-scale", ordered_input([[0.0, 0.0]], [1.0], -1.0), filter_reference),
        error_case("boolean-separation-scale", ordered_input([[0.0, 0.0]], [1.0], True), filter_reference),
        error_case("mismatched-centres-and-radii", ordered_input([[0.0, 0.0]], [1.0, 2.0]), filter_reference),
        error_case("unknown-key", {**ordered_input([], []), "extra": 1}, filter_reference),
        arithmetic_error_case("threshold-product-underflow", ordered_input([[0.0, 0.0], [0.0, 0.0]], [1e-200, 1e-200], 1e-200), filter_reference, 1, "threshold"),
        arithmetic_error_case("square-x-underflow", ordered_input([[0.0, 0.0], [math.ldexp(1.0, -540), 0.0]], [1.0, 1.0]), filter_reference, 1, "square_x"),
        arithmetic_error_case("square-y-underflow", ordered_input([[0.0, 0.0], [0.0, math.ldexp(1.0, -540)]], [1.0, 1.0]), filter_reference, 1, "square_y"),
        arithmetic_error_case("difference-x-overflow", ordered_input([[math.ldexp(1.0, 1023), 0.0], [-math.ldexp(1.0, 1023), 0.0]], [1.0, 1.0]), filter_reference, 1, "difference_x"),
        arithmetic_error_case("difference-y-overflow", ordered_input([[0.0, math.ldexp(1.0, 1023)], [0.0, -math.ldexp(1.0, 1023)]], [1.0, 1.0]), filter_reference, 1, "difference_y"),
        arithmetic_error_case("difference-x-before-difference-y-overflow", ordered_input([[math.ldexp(1.0, 1023), math.ldexp(1.0, 1023)], [-math.ldexp(1.0, 1023), -math.ldexp(1.0, 1023)]], [1.0, 1.0]), filter_reference, 1, "difference_x"),
        arithmetic_error_case("difference-y-before-square-x-overflow", ordered_input([[0.0, math.ldexp(1.0, 1023)], [math.ldexp(1.0, 512), -math.ldexp(1.0, 1023)]], [1.0, 1.0]), filter_reference, 1, "difference_y"),
        arithmetic_error_case("square-x-overflow", ordered_input([[0.0, 0.0], [math.ldexp(1.0, 512), 0.0]], [1.0, 1.0]), filter_reference, 1, "square_x"),
        arithmetic_error_case("square-y-overflow", ordered_input([[0.0, 0.0], [0.0, math.ldexp(1.0, 512)]], [1.0, 1.0]), filter_reference, 1, "square_y"),
        arithmetic_error_case("square-x-underflow-before-square-y-overflow", ordered_input([[0.0, 0.0], [math.ldexp(1.0, -540), math.ldexp(1.0, 512)]], [1.0, 1.0]), filter_reference, 1, "square_x"),
        arithmetic_error_case("distance-squared-overflow", ordered_input([[0.0, 0.0], [1.5 * math.ldexp(1.0, 511), 1.5 * math.ldexp(1.0, 511)]], [1.0, 1.0]), filter_reference, 1, "distance_squared"),
        arithmetic_error_case("distance-squared-before-radius-sum-overflow", ordered_input([[0.0, 0.0], [1.5 * math.ldexp(1.0, 511), 1.5 * math.ldexp(1.0, 511)]], [math.ldexp(1.0, 1023), math.ldexp(1.0, 1023)]), filter_reference, 1, "distance_squared"),
        arithmetic_error_case("radius-sum-overflow", ordered_input([[0.0, 0.0], [0.0, 0.0]], [math.ldexp(1.0, 1023), math.ldexp(1.0, 1023)]), filter_reference, 1, "radius_sum"),
        arithmetic_error_case("threshold-product-overflow", ordered_input([[0.0, 0.0], [0.0, 0.0]], [1.0, 1.0], 1e308), filter_reference, 1, "threshold"),
        arithmetic_error_case("threshold-squared-underflow", ordered_input([[0.0, 0.0], [0.0, 0.0]], [1e-200, 1e-200], 1.0), filter_reference, 1, "threshold_squared"),
        arithmetic_error_case("threshold-squared-overflow", ordered_input([[0.0, 0.0], [0.0, 0.0]], [math.ldexp(1.0, 511), math.ldexp(1.0, 511)], 1.0), filter_reference, 1, "threshold_squared"),
        output_case("rejection-skips-later-threshold-squared-underflow", ordered_input(
            [[0.0, 0.0], [4.0, 0.0], [0.0, 0.0]], [1.0, 1e-200, 1e-200]), filter_reference),
    ]
    return fixture_header("sampling.ordered-circle-filter-2d", ORDERED_CATALOG, cases, {"kind": "explicit-ordered-kernel"})


def seeded_fixture() -> dict[str, Any]:
    baseline_5000 = seeded_input(attempts=5_000)
    baseline_10000 = seeded_input(attempts=10_000)
    base_output = seeded_reference(baseline_5000)
    extended_output = seeded_reference(baseline_10000)
    acceptance = json.loads(ACCEPTANCE.read_text(encoding="utf-8"))
    expected_base_hash = acceptance["profiles"]["base-rings"]["accepted_sha256"]
    expected_extended_hash = acceptance["extended_baseline"]["accepted_sha256"]
    assert geometry_digest(base_output) == expected_base_hash, "independent 5000 baseline hash differs from accepted CP3 evidence"
    assert geometry_digest(extended_output) == expected_extended_hash, "independent 10000 baseline hash differs from accepted CP3 evidence"
    assert base_output["centres"] == extended_output["centres"][:len(base_output["centres"])]
    assert base_output["radii"] == extended_output["radii"][:len(base_output["radii"])]
    assert base_output["sourceIndices"] == extended_output["sourceIndices"][:len(base_output["sourceIndices"])]

    cases = [
        output_case("zero-attempts", seeded_input(attempts=0), seeded_reference),
        output_case("zero-attempts-huge-finite-domain", seeded_input(attempts=0, origin=[1e308, -1e308], extent=[1e308, 1e308]), seeded_reference),
        error_case("zero-attempts-still-validates-reversed-radius", seeded_input(attempts=0, radiusRange=[64.0, 4.0]), seeded_reference),
        error_case("boolean-seed", seeded_input(seed=True), seeded_reference),
        error_case("seed-over-uint32", seeded_input(seed=4_294_967_296), seeded_reference),
        error_case("attempts-negative", seeded_input(attempts=-1), seeded_reference),
        error_case("attempts-fractional", seeded_input(attempts=1.5), seeded_reference),
        error_case("attempts-over-cap", seeded_input(attempts=MAX_ATTEMPTS + 1), seeded_reference),
        error_case("zero-radius", seeded_input(radiusRange=[0.0, 4.0]), seeded_reference),
        error_case("negative-radius", seeded_input(radiusRange=[-1.0, 4.0]), seeded_reference),
        error_case("zero-extent", seeded_input(extent=[0.0, 1.0]), seeded_reference),
        error_case("negative-extent", seeded_input(extent=[-1.0, 1.0]), seeded_reference),
        error_case("unknown-key", {**seeded_input(), "extra": 1}, seeded_reference),
        output_case("seed-0-first", seeded_input(seed=0, attempts=1), seeded_reference),
        output_case("seed-1-first", seeded_input(seed=1, attempts=1), seeded_reference),
        output_case("seed-42-first", seeded_input(seed=42, attempts=1), seeded_reference),
        output_case("seed-high-bit-first", seeded_input(seed=2_147_483_648, attempts=1), seeded_reference),
        output_case("seed-max-first", seeded_input(seed=4_294_967_295, attempts=1), seeded_reference),
        output_case("negative-origin-positive-extent", seeded_input(origin=[-3.5, 4.25], extent=[7.25, 5.5], attempts=4), seeded_reference),
        output_case("constant-radius-endpoints", seeded_input(radiusRange=[7.0, 7.0], attempts=4), seeded_reference),
        output_case("min-radius-8", seeded_input(radiusRange=[8.0, 64.0], attempts=16), seeded_reference),
        output_case("huge-origin-finite-absorption", seeded_input(origin=[1e308, -1e308], extent=[1.0, 1.0], attempts=1), seeded_reference),
        output_case("ordinary-8", seeded_input(attempts=8), seeded_reference),
        output_case("ordinary-16", seeded_input(attempts=16), seeded_reference),
        output_case("rmax-32", seeded_input(radiusRange=[4.0, 32.0], attempts=16), seeded_reference),
        output_case("separation-1-2", seeded_input(separationScale=1.2, attempts=16), seeded_reference),
        {"id": "representative-5000", "input": baseline_5000, "output": base_output, "comparison": comparison()},
        {"id": "representative-10000", "input": baseline_10000, "output": extended_output, "comparison": comparison()},
        arithmetic_error_case("pair-failure-precedes-later-proposal-overflow", seeded_input(
            seed=1, attempts=4, origin=[1e308, 0.0], extent=[1e308, 1.0], radiusRange=[1.0, 1.0]),
            seeded_reference, 1, "square_x"),
        arithmetic_error_case("first-proposal-nonfinite-centre-x", seeded_input(seed=0, attempts=1, origin=[1e308, 0.0], extent=[1e308, 1.0]), seeded_reference, 0, "proposal_x"),
        arithmetic_error_case("first-proposal-nonfinite-centre-y", seeded_input(seed=42, attempts=1, origin=[0.0, 1e308], extent=[1.0, 1e308]), seeded_reference, 0, "proposal_y"),
    ]
    fixture = fixture_header("sampling.seeded-circle-placement-2d", SEEDED_CATALOG, cases, {
        "kind": "private-xoshiro128starstar-1-1",
        "seed_vectors": seed_vectors(),
        "mapping_vectors": mapping_vectors(),
        "baseline_hash_binding": {
            "evidence_path": ACCEPTANCE.relative_to(ROOT).as_posix(),
            "evidence_sha256": sha256_file(ACCEPTANCE),
            "base_rings_5000_accepted_sha256": expected_base_hash,
            "extended_baseline_10000_accepted_sha256": expected_extended_hash,
            "verified": True,
        },
        "cross_case_checks": [
            {"id": "ordinary-8-prefix-ordinary-16", "kind": "accepted-binary64-prefix", "prefix_case": "ordinary-8", "extended_case": "ordinary-16"},
            {"id": "representative-5000-prefix-representative-10000", "kind": "accepted-binary64-prefix", "prefix_case": "representative-5000", "extended_case": "representative-10000"},
            {
                "id": "ordinary-8-materialized-proposals-share-filter-output",
                "kind": "independently-materialized-proposals-share-filter-output",
                "seeded_case": "ordinary-8",
                "filter_fixture": "fixtures/operations/ordered-circle-filter.json",
                "filter_case": "seeded-42-8-materialized-proposals",
            },
        ],
    })
    return fixture


def fixture_header(operation: str, catalog: Path, cases: list[dict[str, Any]], extra: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "operation": operation,
        "version": "0.1.0",
        "status": "Generated shared-contract vectors from an independent Python binary64 reference; contract review authority is design/operations/circle-placement-contract-review.md and native implementation validation is separate.",
        "fixture_format": "circle-placement-output",
        "catalog_sha256": sha256_file(catalog),
        "generator": {
            "path": Path(__file__).relative_to(ROOT).as_posix(),
            "sha256": sha256_file(Path(__file__)),
            "reference": "Independent Python binary64 kernel; no Java prototype/oracle import. Seeded recurrence transcribed from the shared specification with published xoshiro128**1.1/SplitMix64 provenance.",
        },
        "layout_boundary": {
            "proposal_count_max": MAX_ATTEMPTS,
            "reason": "Metadata only: 2*P fits signed 32-bit packed coordinate indexing. No fixture allocates this cardinality.",
        },
        "native_only_cases": native_only_cases(operation),
        "native_ownership_access_requirements": {
            "status": "required for future native ports; not executed by these pure JSON fixtures",
            "requirements": [
                "Mutate every caller-owned input container after construction and every toValues materialization container; retained result geometry and indices must remain unchanged.",
                "Exercise size, attempts, scalar coordinate/radius/source-index accessors, pointAt, pointInto and toValues with valid and invalid indices/destinations according to the operation's explicit native conventions.",
                "For every pointInto failure class, leave the supplied destination untouched and preserve the result's usability.",
                "Where a controlled host allocation failure is available, failed fresh pointAt-pair or toValues materialization leaves the retained result usable and unchanged.",
            ],
        },
        "cases": cases,
    }
    result.update(extra)
    return result


def native_only_cases(operation: str) -> list[dict[str, str]]:
    """Record only target-carrier inputs meaningful for the named operation."""
    shared = [
        {"id": "custom-numeric-carrier", "description": "Native custom numeric carrier/accessor is INVALID_INPUT; JSON fixtures cover only passive JSON values."},
    ]
    if operation == "sampling.ordered-circle-filter-2d":
        return [
            {"id": "nonfinite-explicit-coordinate-or-radius", "description": "Native NaN/+Infinity explicit centre coordinate, radius, or separationScale is INVALID_INPUT. Literal NaN/Infinity is intentionally forbidden in JSON fixtures."},
            {"id": "huge-integer-explicit-domain", "description": "A Python arbitrary-size integer in a centre coordinate, radius or separationScale whose finite binary64 conversion fails must raise INVALID_INPUT, never leak OverflowError."},
            *shared,
        ]
    if operation == "sampling.seeded-circle-placement-2d":
        return [
            {"id": "nonfinite-seeded-domain", "description": "Native NaN/+Infinity origin, extent, radiusRange, or separationScale is INVALID_INPUT. Literal NaN/Infinity is intentionally forbidden in JSON fixtures."},
            {"id": "huge-seed-integer-domain", "description": "A Python arbitrary-size seed integer outside uint32 is INVALID_INPUT; range-check before narrowing."},
            {"id": "huge-integer-seeded-domain", "description": "A Python arbitrary-size integer in origin, extent, radiusRange or separationScale whose finite binary64 conversion fails must raise INVALID_INPUT, never leak OverflowError."},
            *shared,
        ]
    raise AssertionError(f"unexpected circle placement operation {operation}")


def write(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")


def main() -> int:
    ordered = ordered_fixture()
    seeded = seeded_fixture()
    write(ORDERED_OUTPUT, ordered)
    write(SEEDED_OUTPUT, seeded)
    print(json.dumps({
        "ordered": ORDERED_OUTPUT.relative_to(ROOT).as_posix(),
        "ordered_cases": len(ordered["cases"]),
        "seeded": SEEDED_OUTPUT.relative_to(ROOT).as_posix(),
        "seeded_cases": len(seeded["cases"]),
        "representative_5000_accepted": len(next(case for case in seeded["cases"] if case["id"] == "representative-5000")["output"]["radii"]),
        "representative_10000_accepted": len(next(case for case in seeded["cases"] if case["id"] == "representative-10000")["output"]["radii"]),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
