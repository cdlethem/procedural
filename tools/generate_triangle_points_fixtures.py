#!/usr/bin/env python3
"""Generate draft CP5 triangle-point fixtures from an independent reference.

This is a fixture oracle only. It transcribes the reviewed binary64 mapping and
xoshiro protocol; it imports no target or future public implementation.
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
MAP_CATALOG = ROOT / "catalog/operations/triangle-coordinate-map.json"
SEEDED_CATALOG = ROOT / "catalog/operations/seeded-triangle-points.json"
MAP_OUTPUT = ROOT / "fixtures/operations/triangle-coordinate-map.json"
SEEDED_OUTPUT = ROOT / "fixtures/operations/seeded-triangle-points.json"
CP3_STREAM = ROOT / "evidence/investigations/cp3-stream-oracle.json"
CP3_FIXTURE = ROOT / "fixtures/operations/seeded-circle-placement.json"
MAX_COUNT = 1_073_741_823
MASK32 = (1 << 32) - 1
MASK64 = (1 << 64) - 1
GAMMA = 0x9E3779B97F4A7C15
MIX_A = 0xBF58476D1CE4E5B9
MIX_B = 0x94D049BB133111EB
UNIT_DENOMINATOR = float(1 << 32)
SEEDS = (0, 1, 42, 2_147_483_648, 4_294_967_295)
MAX = float.fromhex("0x1.fffffffffffffp+1023")
MIN_SUBNORMAL = float.fromhex("0x0.0000000000001p-1022")


class FixtureError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bits(value: float) -> str:
    return f"{struct.unpack('>Q', struct.pack('>d', value))[0]:016x}"


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


def bounded_integer(value: Any, maximum: int) -> int:
    result = number(value)
    if not result.is_integer() or result < 0.0 or result > maximum:
        raise FixtureError("INVALID_INPUT")
    return int(result)


def pair(value: Any, *, unit: bool = False) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise FixtureError("INVALID_INPUT")
    first, second = number(value[0]), number(value[1])
    if unit and (first < 0.0 or first > 1.0 or second < 0.0 or second > 1.0):
        raise FixtureError("INVALID_INPUT")
    return first, second


def triangle(value: Any) -> tuple[tuple[float, float], tuple[float, float], tuple[float, float]]:
    if not isinstance(value, list) or len(value) != 3:
        raise FixtureError("INVALID_INPUT")
    return pair(value[0]), pair(value[1]), pair(value[2])


def scalar_lerp(a: float, b: float, t: float) -> float:
    """Reviewed endpoint-aware, strict-opposite-sign, clamped binary64 L."""
    if t == 0.0:
        return canonical_zero(a)
    if t == 1.0:
        return canonical_zero(b)
    if (a < 0.0 < b) or (b < 0.0 < a):
        raw = a * (1.0 - t) + b * t
    else:
        raw = a + (b - a) * t
    lower, upper = min(a, b), max(a, b)
    if raw < lower:
        raw = lower
    elif raw > upper:
        raw = upper
    if not math.isfinite(raw):
        raise AssertionError("reviewed finite endpoint interpolation unexpectedly nonfinite")
    return canonical_zero(raw)


def map_pair(vertices: tuple[tuple[float, float], tuple[float, float], tuple[float, float]], unit_pair: tuple[float, float]) -> tuple[float, float]:
    u, v = unit_pair
    root = math.sqrt(u)
    return (
        scalar_lerp(vertices[0][0], scalar_lerp(vertices[1][0], vertices[2][0], v), root),
        scalar_lerp(vertices[0][1], scalar_lerp(vertices[1][1], vertices[2][1], v), root),
    )


def map_config(value: Any) -> tuple[tuple[tuple[float, float], tuple[float, float], tuple[float, float]], list[tuple[float, float]]]:
    if not isinstance(value, dict) or set(value) != {"triangle", "unitCoordinates"}:
        raise FixtureError("INVALID_INPUT")
    vertices = triangle(value["triangle"])
    units_value = value["unitCoordinates"]
    if not isinstance(units_value, list) or len(units_value) > MAX_COUNT:
        raise FixtureError("INVALID_INPUT")
    units: list[tuple[float, float]] = []
    for row in units_value:
        units.append(pair(row, unit=True))
    return vertices, units


def seeded_config(value: Any) -> tuple[int, int, tuple[tuple[float, float], tuple[float, float], tuple[float, float]]]:
    if not isinstance(value, dict) or set(value) != {"seed", "count", "triangle"}:
        raise FixtureError("INVALID_INPUT")
    seed = bounded_integer(value["seed"], MASK32)
    count = bounded_integer(value["count"], MAX_COUNT)
    return seed, count, triangle(value["triangle"])


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
    assert any(words), "specified expansion must not form the all-zero state"
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

    def unit(self) -> tuple[int, float]:
        output = self.next_u32()
        return output, output / UNIT_DENOMINATOR


def point_values(points: list[tuple[float, float]]) -> dict[str, Any]:
    return {
        "points": [[canonical_zero(x), canonical_zero(y)] for x, y in points],
    }


def point_bits(points: list[tuple[float, float]]) -> list[list[str]]:
    return [[bits(x), bits(y)] for x, y in points]


def reference_map(value: Any) -> tuple[dict[str, Any], list[tuple[float, float]]]:
    vertices, units = map_config(value)
    points = [map_pair(vertices, unit_pair) for unit_pair in units]
    return point_values(points), points


def reference_seeded(value: Any) -> tuple[dict[str, Any], list[tuple[float, float]], list[tuple[int, int]]]:
    seed, count, vertices = seeded_config(value)
    # Full static validation above is intentionally complete for count zero. Only
    # afterwards may zero return without constructing or consuming the stream.
    if count == 0:
        return point_values([]), [], []
    stream = Xoshiro128StarStar11(seed)
    units: list[tuple[float, float]] = []
    words: list[tuple[int, int]] = []
    points: list[tuple[float, float]] = []
    for _ in range(count):
        u_word, u = stream.unit()
        v_word, v = stream.unit()
        units.append((u, v))
        words.append((u_word, v_word))
        points.append(map_pair(vertices, (u, v)))
    return point_values(points), units, words


def map_success(case_id: str, config: dict[str, Any], *categories: str, **metadata: Any) -> dict[str, Any]:
    output, points = reference_map(copy.deepcopy(config))
    case: dict[str, Any] = {
        "id": case_id,
        "input": config,
        "output": output,
        "points_bits_hex": point_bits(points),
        "comparison": {"mode": "binary64-exact"},
        "categories": list(categories),
    }
    case.update(metadata)
    return case


def seeded_success(case_id: str, config: dict[str, Any], *categories: str, **metadata: Any) -> dict[str, Any]:
    output, units, words = reference_seeded(copy.deepcopy(config))
    points = [(point[0], point[1]) for point in output["points"]]
    case: dict[str, Any] = {
        "id": case_id,
        "input": config,
        "output": output,
        "points_bits_hex": point_bits(points),
        "generated_unit_coordinates": [[u, v] for u, v in units],
        "generated_unit_u32": [[u_word, v_word] for u_word, v_word in words],
        "comparison": {"mode": "binary64-exact"},
        "categories": list(categories),
    }
    case.update(metadata)
    return case


def failure(case_id: str, config: Any, *, seeded: bool, categories: list[str]) -> dict[str, Any]:
    try:
        (reference_seeded if seeded else reference_map)(copy.deepcopy(config))
    except FixtureError as error:
        if error.code != "INVALID_INPUT":
            raise AssertionError(f"{case_id}: unexpected {error.code}")
    else:
        raise AssertionError(f"{case_id}: expected INVALID_INPUT")
    return {"id": case_id, "input": config, "error": "INVALID_INPUT", "categories": categories}


def normal_triangle() -> list[list[float]]:
    return [[0.0, 0.0], [16.0, 0.0], [0.0, 8.0]]


def normal_map(**overrides: Any) -> dict[str, Any]:
    value: dict[str, Any] = {"triangle": normal_triangle(), "unitCoordinates": [[0.25, 0.5], [0.75, 0.25]]}
    value.update(overrides)
    return value


def normal_seeded(**overrides: Any) -> dict[str, Any]:
    value: dict[str, Any] = {"seed": 42, "count": 4, "triangle": normal_triangle()}
    value.update(overrides)
    return value


def shared_seed_vectors() -> list[dict[str, Any]]:
    report = json.loads(CP3_STREAM.read_text(encoding="utf-8"))
    placement = json.loads(CP3_FIXTURE.read_text(encoding="utf-8"))
    vectors = report.get("seed_vectors")
    if not isinstance(vectors, list) or [row.get("seed") for row in vectors] != list(SEEDS):
        raise RuntimeError("CP3 stream evidence does not contain the expected five seed vectors")
    if vectors != placement.get("seed_vectors"):
        raise RuntimeError("CP3 placement fixture seed vectors differ from the independent stream report")
    for row in vectors:
        stream = Xoshiro128StarStar11(row["seed"])
        if stream.words != row["initial_state"]:
            raise RuntimeError(f"initial state mismatch for seed {row['seed']}")
        for expected in row["first_10"]:
            output, unit = stream.unit()
            if output != expected["output_u32"] or unit != expected["unit"] or stream.words != expected["post_state"]:
                raise RuntimeError(f"stream mismatch for seed {row['seed']}")
    return vectors


def native_only(operation: str) -> list[dict[str, str]]:
    return [
        {
            "id": "nonfinite-and-overflowing-numeric-carriers",
            "description": f"For {operation}, NaN, +/-Infinity and numeric carriers that cannot convert to binary64 are INVALID_INPUT. Strict JSON cannot carry nonfinite literals.",
        },
        {
            "id": "passive-carriers-only",
            "description": "Recognized wrong carriers (Java arbitrary Number subclasses, JavaScript class/typed-array pairs, Python custom mapping/list containers) are INVALID_INPUT. Active getters/proxies/custom hooks are outside passive interchange and need not be read or universally detected.",
        },
    ]


def ownership_requirements() -> dict[str, Any]:
    return {
        "status": "required for future native ports; not executed by these pure JSON fixtures",
        "requirements": [
            "Mutating every caller config/triangle/pair container after success cannot alter retained points, pointAt or toValues output.",
            "pointAt and toValues return detached values; a failed fresh materialization leaves the completed result usable.",
            "pointInto validates index, destination, offset and both writable binary64 slots before writing; every failure preserves destination sentinels.",
            "Access error precedence is INVALID_INDEX, INDEX_OUT_OF_RANGE, then INVALID_OUTPUT; bool and unsafe numeric indices are INVALID_INDEX.",
            "Complete static validation precedes output-sized allocation and seeded RNG initialization. Controlled allocation failure, where executable, exposes no partial result; otherwise record source proof and explicit unexecuted status.",
            "Seeded inner loops retain packed scalar output without per-point objects; measure work/memory at native review rather than claiming it from these fixtures.",
        ],
    }


def generate() -> tuple[dict[str, Any], dict[str, Any]]:
    map_catalog = json.loads(MAP_CATALOG.read_text(encoding="utf-8"))
    seeded_catalog = json.loads(SEEDED_CATALOG.read_text(encoding="utf-8"))
    for catalog in (map_catalog, seeded_catalog):
        if catalog.get("status") not in {"draft", "reviewed"} or catalog.get("fixture_format") != "triangle-points-output":
            raise RuntimeError("generator requires draft/reviewed triangle-points-output catalog records")

    map_cases: list[dict[str, Any]] = [
        map_success("empty-ordinary", normal_map(unitCoordinates=[]), "empty", "ordinary"),
        map_success("empty-repeated-triangle", normal_map(triangle=[[3.0, -2.0], [3.0, -2.0], [3.0, -2.0]], unitCoordinates=[]), "empty", "repeated"),
        map_success("empty-tiny-noncollinear", normal_map(triangle=[[0.0, 0.0], [2.0**-600, 0.0], [0.0, 2.0**-600]], unitCoordinates=[]), "empty", "tiny-noncollinear"),
        map_success("endpoint-u-zero-extreme-and-negative-zero", normal_map(triangle=[[-MAX, -0.0], [MAX, 1.0], [MAX, -1.0]], unitCoordinates=[[0.0, 0.0], [0.0, 0.5], [0.0, 1.0]]), "endpoint", "opposite-sign", "negative-zero"),
        map_success("endpoint-u-one-v-zero", normal_map(triangle=[[-MAX, 4.0], [-MAX, -0.0], [MAX, 9.0]], unitCoordinates=[[1.0, 0.0]]), "endpoint", "opposite-sign", "negative-zero"),
        map_success("endpoint-u-one-v-one", normal_map(triangle=[[-MAX, 4.0], [-MAX, -0.0], [MAX, 9.0]], unitCoordinates=[[1.0, 1.0]]), "endpoint", "opposite-sign"),
        map_success("ordinary-quarter-half", normal_map(triangle=[[0.0, 0.0], [2.0, 0.0], [0.0, 2.0]], unitCoordinates=[[0.25, 0.5]]), "ordinary", "ordered-units"),
        map_success("duplicate-unit-pairs-retain-duplicates", normal_map(unitCoordinates=[[0.25, 0.5], [0.25, 0.5], [0.75, 0.5], [0.25, 0.5]]), "duplicate-pairs", "order"),
        map_success("reordered-vertices-change-coordinates", normal_map(triangle=[[16.0, 0.0], [0.0, 8.0], [0.0, 0.0]], unitCoordinates=[[0.25, 0.5], [0.75, 0.25]]), "vertex-order"),
        map_success("nested-rounding-one-ulp-adversary", normal_map(triangle=[[1.0, 2.0], [3.0, 6.0], [-2.0, 11.0]], unitCoordinates=[[1.0 / 16.0, 0.7]]), "rounding-order", "no-fma"),
        map_success("constant-one-affine-identity", normal_map(triangle=[[1.0, 1.0], [1.0, 3.0], [1.0, -2.0]], unitCoordinates=[[2.0**-53, 0.2]]), "constant-coordinate", "rounding"),
        map_success("constant-negative-max-interval", normal_map(triangle=[[-MAX, -MAX], [-MAX, -1.0], [-MAX, 1.0]], unitCoordinates=[[2.0**-53, 0.25]]), "constant-coordinate", "endpoint-interval"),
        map_success("minimum-subnormal-near-one-units", normal_map(triangle=[[-MIN_SUBNORMAL, MIN_SUBNORMAL], [MIN_SUBNORMAL, -MIN_SUBNORMAL], [MAX, -MAX]], unitCoordinates=[[math.nextafter(1.0, 0.0), math.nextafter(1.0, 0.0)]]), "extrema", "subnormal", "near-one"),
        map_success("tiny-noncollinear-underflowed-area", normal_map(triangle=[[0.0, 0.0], [2.0**-600, 0.0], [0.0, 2.0**-600]], unitCoordinates=[[0.25, 0.5]]), "tiny-noncollinear", "no-determinant"),
        map_success("tiny-exact-collinear", normal_map(triangle=[[0.0, 0.0], [2.0**-600, 2.0**-600], [2.0**-599, 2.0**-599]], unitCoordinates=[[0.25, 0.5]]), "collinear", "collapsed"),
        map_success("fully-repeated-positive-count", normal_map(triangle=[[3.0, -2.0], [3.0, -2.0], [3.0, -2.0]], unitCoordinates=[[0.0, 0.0], [1.0, 1.0]]), "repeated", "collapsed"),
        map_success("source-motivated-biased-caller-pairs", normal_map(unitCoordinates=[[0.125, 0.75], [0.5, 0.25], [0.0625, 0.9]]), "caller-biased-pairs", "no-rng", caller_pair_expression="The first coordinate values are caller materializations such as U*V; this transform consumes them as given and has no RNG."),
    ]
    map_cases.extend([
        failure("missing-unit-coordinates", {"triangle": normal_triangle()}, seeded=False, categories=["missing-key"]),
        failure("missing-triangle", {"unitCoordinates": []}, seeded=False, categories=["missing-key"]),
        failure("extra-property", {**normal_map(), "extra": 1}, seeded=False, categories=["extra-key"]),
        failure("triangle-wrong-length", normal_map(triangle=[[0.0, 0.0], [1.0, 0.0]]), seeded=False, categories=["triangle-shape"]),
        failure("empty-units-still-validates-triangle", normal_map(triangle=[[True, 0.0], [1.0, 0.0], [0.0, 1.0]], unitCoordinates=[]), seeded=False, categories=["empty", "triangle-validation", "bool-number"]),
        failure("boolean-triangle-coordinate", normal_map(triangle=[[True, 0.0], [1.0, 0.0], [0.0, 1.0]]), seeded=False, categories=["bool-number"]),
        failure("boolean-unit-coordinate", normal_map(unitCoordinates=[[True, 0.0]]), seeded=False, categories=["bool-number", "unit-domain"]),
        failure("unit-outer-wrong-carrier", normal_map(unitCoordinates={"u": 0.0}), seeded=False, categories=["units-carrier"]),
        failure("unit-row-wrong-shape", normal_map(unitCoordinates=[[0.2], [0.3, 0.4]]), seeded=False, categories=["unit-shape"]),
        failure("later-unit-row-invalid", normal_map(unitCoordinates=[[0.2, 0.3], [0.4, 1.1]]), seeded=False, categories=["later-validation", "unit-domain"]),
        failure("unit-u-below-zero", normal_map(unitCoordinates=[[-MIN_SUBNORMAL, 0.0]]), seeded=False, categories=["unit-domain"]),
        failure("unit-v-above-one", normal_map(unitCoordinates=[[0.0, math.nextafter(1.0, math.inf)]]), seeded=False, categories=["unit-domain"]),
    ])

    seeded_cases: list[dict[str, Any]] = [
        seeded_success("count-zero-validates-ordinary", normal_seeded(count=0), "count-zero", "ordinary"),
        seeded_success("count-zero-repeated-triangle", normal_seeded(count=0, triangle=[[3.0, -2.0], [3.0, -2.0], [3.0, -2.0]]), "count-zero", "repeated"),
        seeded_success("seed-zero-count-one", normal_seeded(seed=0, count=1), "seed", "count-one"),
        seeded_success("seed-one-count-one", normal_seeded(seed=1, count=1), "seed", "count-one"),
        seeded_success("seed-42-count-4", normal_seeded(seed=42, count=4), "seed", "prefix", "equivalence"),
        seeded_success("seed-42-count-8", normal_seeded(seed=42, count=8), "seed", "prefix"),
        seeded_success("seed-high-count-one", normal_seeded(seed=2_147_483_648, count=1), "seed-high", "count-one"),
        seeded_success("seed-max-count-one", normal_seeded(seed=MASK32, count=1), "seed-max", "count-one"),
        seeded_success("reordered-triangle-seed-one", normal_seeded(seed=1, count=4, triangle=[[16.0, 0.0], [0.0, 8.0], [0.0, 0.0]]), "vertex-order", "seed"),
        seeded_success("constant-vertices-consume-two-units-per-point", normal_seeded(seed=42, count=4, triangle=[[3.0, -2.0], [3.0, -2.0], [3.0, -2.0]]), "repeated", "stream-consumption"),
        seeded_success("tiny-collinear-consume-two-units-per-point", normal_seeded(seed=42, count=4, triangle=[[0.0, 0.0], [2.0**-600, 2.0**-600], [2.0**-599, 2.0**-599]]), "collinear", "stream-consumption"),
        seeded_success("tiny-noncollinear-underflowed-area", normal_seeded(seed=42, count=4, triangle=[[0.0, 0.0], [2.0**-600, 0.0], [0.0, 2.0**-600]]), "tiny-noncollinear", "no-determinant"),
        seeded_success("finite-extrema-opposite-sign", normal_seeded(seed=1, count=2, triangle=[[-MAX, -MIN_SUBNORMAL], [MAX, MIN_SUBNORMAL], [0.0, MAX]]), "extrema", "opposite-sign"),
        seeded_success("negative-zero-seed-count-and-vertices", normal_seeded(seed=-0.0, count=-0.0, triangle=[[-0.0, -0.0], [8.0, -0.0], [-0.0, 4.0]]), "negative-zero", "count-zero"),
    ]
    seeded_cases.extend([
        failure("missing-count", {"seed": 42, "triangle": normal_triangle()}, seeded=True, categories=["missing-key"]),
        failure("missing-triangle", {"seed": 42, "count": 0}, seeded=True, categories=["missing-key"]),
        failure("extra-property", {**normal_seeded(), "extra": 1}, seeded=True, categories=["extra-key"]),
        failure("boolean-seed", normal_seeded(seed=True), seeded=True, categories=["bool-number", "seed"]),
        failure("seed-over-uint32", normal_seeded(seed=MASK32 + 1), seeded=True, categories=["seed-domain"]),
        failure("seed-negative", normal_seeded(seed=-1), seeded=True, categories=["seed-domain"]),
        failure("count-boolean", normal_seeded(count=True), seeded=True, categories=["bool-number", "count-domain"]),
        failure("count-negative", normal_seeded(count=-1), seeded=True, categories=["count-domain"]),
        failure("count-fractional", normal_seeded(count=1.5), seeded=True, categories=["count-domain"]),
        failure("count-over-packed-limit", normal_seeded(count=MAX_COUNT + 1), seeded=True, categories=["count-domain"]),
        failure("triangle-wrong-length", normal_seeded(triangle=[[0.0, 0.0], [1.0, 0.0]]), seeded=True, categories=["triangle-shape"]),
        failure("boolean-triangle-coordinate", normal_seeded(triangle=[[True, 0.0], [1.0, 0.0], [0.0, 1.0]]), seeded=True, categories=["bool-number"]),
        failure("count-zero-still-validates-triangle", normal_seeded(count=0, triangle=[[True, 0.0], [1.0, 0.0], [0.0, 1.0]]), seeded=True, categories=["count-zero", "triangle-validation", "bool-number"]),
    ])

    equivalence_pairs = (
        ("seed-zero-count-one", "units-from-seed-zero-count-one"),
        ("seed-42-count-4", "units-from-seed-42-count-4"),
        ("seed-max-count-one", "units-from-seed-max-count-one"),
    )
    for seeded_id, mapping_id in equivalence_pairs:
        equivalence_seeded = next(case for case in seeded_cases if case["id"] == seeded_id)
        map_cases.append(map_success(
            mapping_id,
            {"triangle": copy.deepcopy(equivalence_seeded["input"]["triangle"]), "unitCoordinates": copy.deepcopy(equivalence_seeded["generated_unit_coordinates"])},
            "seeded-equivalence", "generated-units",
        ))
        equivalence_map = next(case for case in map_cases if case["id"] == mapping_id)
        if equivalence_map["output"] != equivalence_seeded["output"] or equivalence_map["points_bits_hex"] != equivalence_seeded["points_bits_hex"]:
            raise AssertionError(f"{seeded_id}: seeded and explicit mapping references diverged")
    short_case = next(case for case in seeded_cases if case["id"] == "seed-42-count-4")
    long_case = next(case for case in seeded_cases if case["id"] == "seed-42-count-8")
    if short_case["input"].keys() != long_case["input"].keys() or any(short_case["input"][key] != long_case["input"][key] for key in short_case["input"] if key != "count"):
        raise AssertionError("prefix inputs must differ only in count")
    count = short_case["input"]["count"]
    if long_case["generated_unit_coordinates"][:count] != short_case["generated_unit_coordinates"] or long_case["output"]["points"][:count] != short_case["output"]["points"] or long_case["points_bits_hex"][:count] != short_case["points_bits_hex"]:
        raise AssertionError("seeded extension must preserve generated/unit/output prefixes")

    seed_vectors = shared_seed_vectors()
    map_fixture = {
        "operation": map_catalog["id"],
        "version": map_catalog["version"],
        "fixture_format": "triangle-points-output",
        "fixture_status": "generated shared-contract vectors; native implementation validation is separate",
        "catalog_sha256": sha256(MAP_CATALOG),
        "generator": {"path": "tools/generate_triangle_points_fixtures.py", "sha256": sha256(Path(__file__).resolve()), "reference": "Independent Python binary64 nested endpoint-aware clamped interpolation; no public-core or target implementation import."},
        "mapping_provenance": {
            "arithmetic": "L(A,L(B,C,v),sqrt(u)) with strict opposite signs, endpoint branches, final interval clamp and canonical +0",
            "draws_per_pair": 0,
            "sqrt_scope": "This independent Python fixture oracle relies on host math.sqrt for expected binary64 bits; it is not an arbitrary-precision proof of correctly rounded sqrt. Future Java/other targets must meet the catalog's correctly-rounded binary64 sqrt requirement.",
        },
        "cases": map_cases,
        "cross_case_checks": [],
        "native_only_cases": native_only(map_catalog["id"]),
        "native_ownership_access_requirements": ownership_requirements(),
    }
    seeded_fixture = {
        "operation": seeded_catalog["id"],
        "version": seeded_catalog["version"],
        "fixture_format": "triangle-points-output",
        "fixture_status": "generated shared-contract vectors; native implementation validation is separate",
        "catalog_sha256": sha256(SEEDED_CATALOG),
        "generator": {"path": "tools/generate_triangle_points_fixtures.py", "sha256": sha256(Path(__file__).resolve()), "reference": "Independent Python xoshiro128**1.1 and binary64 nested endpoint-aware clamped interpolation; Python math.sqrt supplies fixture bits but is not an arbitrary-precision proof of correctly rounded sqrt; no public-core or target implementation import."},
        "rng_provenance": {
            "kind": "private-xoshiro128starstar-1-1",
            "shared_cp3_stream_evidence": str(CP3_STREAM.relative_to(ROOT)),
            "shared_cp3_stream_evidence_sha256": sha256(CP3_STREAM),
            "shared_cp3_fixture": str(CP3_FIXTURE.relative_to(ROOT)),
            "shared_cp3_fixture_sha256": sha256(CP3_FIXTURE),
            "draws_per_requested_replacement": 2,
            "draws_for_zero_replacements": 0,
        },
        "seed_vectors": seed_vectors,
        "cases": seeded_cases,
        "cross_case_checks": [
            {"id": "seed-42-count-4-is-raw-prefix-of-count-8", "kind": "raw-binary64-prefix", "prefix_case": "seed-42-count-4", "extended_case": "seed-42-count-8"},
            {"id": "seed-zero-count-one-equals-explicit-generated-units", "kind": "seeded-output-equals-explicit-map", "seeded_case": "seed-zero-count-one", "mapping_fixture": "fixtures/operations/triangle-coordinate-map.json", "mapping_case": "units-from-seed-zero-count-one"},
            {"id": "seed-42-count-4-equals-explicit-generated-units", "kind": "seeded-output-equals-explicit-map", "seeded_case": "seed-42-count-4", "mapping_fixture": "fixtures/operations/triangle-coordinate-map.json", "mapping_case": "units-from-seed-42-count-4"},
            {"id": "seed-max-count-one-equals-explicit-generated-units", "kind": "seeded-output-equals-explicit-map", "seeded_case": "seed-max-count-one", "mapping_fixture": "fixtures/operations/triangle-coordinate-map.json", "mapping_case": "units-from-seed-max-count-one"},
        ],
        "native_only_cases": native_only(seeded_catalog["id"]),
        "native_ownership_access_requirements": ownership_requirements(),
    }
    return map_fixture, seeded_fixture


def main() -> None:
    map_fixture, seeded_fixture = generate()
    MAP_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    MAP_OUTPUT.write_text(json.dumps(map_fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    SEEDED_OUTPUT.write_text(json.dumps(seeded_fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"mapping_cases": len(map_fixture["cases"]), "seeded_cases": len(seeded_fixture["cases"]), "outputs": [str(MAP_OUTPUT), str(SEEDED_OUTPUT)]}, sort_keys=True))


if __name__ == "__main__":
    main()
