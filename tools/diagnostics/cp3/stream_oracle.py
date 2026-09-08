#!/usr/bin/env python3
"""Private CP3 xoshiro128** 1.1 stream oracle; not an operation implementation."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import struct
import sys
from pathlib import Path
from typing import Final

ROOT: Final = Path(__file__).resolve().parents[3]
MASK32: Final = (1 << 32) - 1
MASK64: Final = (1 << 64) - 1
GAMMA: Final = 0x9E3779B97F4A7C15
MIX_A: Final = 0xBF58476D1CE4E5B9
MIX_B: Final = 0x94D049BB133111EB
UNIT_DENOMINATOR: Final = float(1 << 32)
SEEDS: Final = (0, 1, 42, 2_147_483_648, 4_294_967_295)

# This is a bounded prototype configuration, not a public default or useful range.
BASELINE: Final = {
    "seed": 42,
    "attempts": 5_000,
    "centre_rectangle": {"origin": [64.0, 64.0], "size": [512.0, 512.0]},
    "radius_min": 4.0,
    "radius_max": 64.0,
}
SMALLER_MAX: Final = 32.0


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rotl32(value: int, count: int) -> int:
    value &= MASK32
    return ((value << count) | (value >> (32 - count))) & MASK32


def splitmix64_next(state: int) -> tuple[int, int]:
    """The published SplitMix64 step, expressed with explicit uint64 reduction."""
    state = (state + GAMMA) & MASK64
    mixed = state
    mixed = ((mixed ^ (mixed >> 30)) * MIX_A) & MASK64
    mixed = ((mixed ^ (mixed >> 27)) * MIX_B) & MASK64
    return state, (mixed ^ (mixed >> 31)) & MASK64


def expand_seed(seed: int) -> tuple[int, int, int, int]:
    """Project-selected scalar expansion, not part of canonical xoshiro128**."""
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= MASK32:
        raise ValueError("seed must be a uint32")
    sm_state = seed
    sm_state, first = splitmix64_next(sm_state)
    sm_state, second = splitmix64_next(sm_state)
    words = (
        first & MASK32,
        (first >> 32) & MASK32,
        second & MASK32,
        (second >> 32) & MASK32,
    )
    # Two consecutive SplitMix64 outputs make this unreachable for the stated expansion,
    # but never permit the forbidden xoshiro all-zero state to be repaired silently.
    assert any(words), "SplitMix64 expansion produced forbidden xoshiro all-zero state"
    return words


class Xoshiro128StarStar11:
    """Independent diagnostic transcription of the published 1.1 recurrence."""

    __slots__ = ("_state",)

    def __init__(self, seed: int) -> None:
        self._state = list(expand_seed(seed))

    def state(self) -> tuple[int, int, int, int]:
        return tuple(self._state)

    def next_u32(self) -> int:
        s0, s1, s2, s3 = self._state
        result = (rotl32((s1 * 5) & MASK32, 7) * 9) & MASK32
        transient = (s1 << 9) & MASK32
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= transient
        s3 = rotl32(s3, 11)
        self._state[:] = (s0 & MASK32, s1 & MASK32, s2 & MASK32, s3 & MASK32)
        return result

    def next_unit(self) -> float:
        return self.next_u32() / UNIT_DENOMINATOR


def vector_for_seed(seed: int) -> dict[str, object]:
    stream = Xoshiro128StarStar11(seed)
    initial_state = list(stream.state())
    outputs: list[dict[str, object]] = []
    for index in range(10):
        output = stream.next_u32()
        outputs.append(
            {
                "index": index,
                "output_u32": output,
                "unit": output / UNIT_DENOMINATOR,
                "post_state": list(stream.state()),
            }
        )
    return {"seed": seed, "initial_state": initial_state, "first_10": outputs}


def proposal(stream: Xoshiro128StarStar11, config: dict[str, object]) -> tuple[float, float, float]:
    rectangle = config["centre_rectangle"]
    assert isinstance(rectangle, dict)
    origin = rectangle["origin"]
    size = rectangle["size"]
    assert isinstance(origin, list) and isinstance(size, list)
    origin_x, origin_y = float(origin[0]), float(origin[1])
    width, height = float(size[0]), float(size[1])
    radius_min = float(config["radius_min"])
    radius_max = float(config["radius_max"])

    # Fixed consumption and stated binary64 evaluation order: x, y, u, v.
    unit_x = stream.next_unit()
    unit_y = stream.next_unit()
    unit_u = stream.next_unit()
    unit_v = stream.next_unit()
    x = (width * unit_x) + origin_x
    y = (height * unit_y) + origin_y
    span = radius_max - radius_min
    scaled = span * unit_u
    tapered = scaled * unit_v
    radius = tapered + radius_min
    return x, y, radius


def digest_candidates(candidates: list[tuple[float, float, float]], *, centres_only: bool) -> str:
    digest = hashlib.sha256()
    for x, y, radius in candidates:
        digest.update(struct.pack(">dd" if centres_only else ">ddd", x, y) if centres_only else struct.pack(">ddd", x, y, radius))
    return digest.hexdigest()


def proposal_reference(config: dict[str, object]) -> dict[str, object]:
    stream = Xoshiro128StarStar11(int(config["seed"]))
    attempts = int(config["attempts"])
    candidates = [proposal(stream, config) for _ in range(attempts)]
    return {
        "config": config,
        "draws_per_proposal": 4,
        "draw_order": ["x", "y", "u", "v"],
        "formula": {
            "x": "(width * ux) + originX",
            "y": "(height * uy) + originY",
            "radius": "((radiusMax - radiusMin) * u * v) + radiusMin",
            "radius_evaluation_order": ["span = radiusMax - radiusMin", "scaled = span * u", "tapered = scaled * v", "radius = tapered + radiusMin"],
        },
        "first_proposal": list(candidates[0]),
        "last_proposal": list(candidates[-1]),
        "candidates_sha256_struct_be_f64_xyz": digest_candidates(candidates, centres_only=False),
        "centres_sha256_struct_be_f64_xy": digest_candidates(candidates, centres_only=True),
        "final_state": list(stream.state()),
    }


def prefix_check(config: dict[str, object]) -> dict[str, object]:
    shorter = proposal_reference(config)
    stream = Xoshiro128StarStar11(int(config["seed"]))
    first = [proposal(stream, config) for _ in range(int(config["attempts"]))]
    state_after_first = list(stream.state())
    second = [proposal(stream, config) for _ in range(int(config["attempts"]))]
    return {
        "prefix_attempts": int(config["attempts"]),
        "extended_attempts": int(config["attempts"]) * 2,
        "first_prefix_sha256_struct_be_f64_xyz": digest_candidates(first, centres_only=False),
        "baseline_sha256_struct_be_f64_xyz": shorter["candidates_sha256_struct_be_f64_xyz"],
        "first_prefix_matches_baseline": digest_candidates(first, centres_only=False)
        == shorter["candidates_sha256_struct_be_f64_xyz"],
        "state_after_prefix": state_after_first,
        "baseline_final_state": shorter["final_state"],
        "state_after_prefix_matches_baseline": state_after_first == shorter["final_state"],
        "extended_sha256_struct_be_f64_xyz": digest_candidates(first + second, centres_only=False),
        "extended_centres_sha256_struct_be_f64_xy": digest_candidates(first + second, centres_only=True),
        "final_state_after_extended": list(stream.state()),
    }


def build_report() -> dict[str, object]:
    script = Path(__file__).resolve()
    rng_options = ROOT / "design/capabilities/cp3-rng-options.md"
    experiment = ROOT / "evidence/parameter-experiments/cp3-placement/experiment.json"
    baseline = dict(BASELINE)
    narrower = dict(BASELINE)
    narrower["radius_max"] = SMALLER_MAX
    report = {
        "schema": "cp3-stream-oracle/v1",
        "status": "completed-private-numeric-oracle",
        "scope": "Independent Python reference for the selected private xoshiro128** 1.1 stream and prototype candidate mapping. It generates no accepted geometry, renderer commands, or visual evidence.",
        "stream": {
            "algorithm": "xoshiro128** 1.1",
            "state": "four uint32 words; all-zero state forbidden",
            "seed": "uint32, expanded by two SplitMix64 outputs packed [low32(q0), high32(q0), low32(q1), high32(q1)]",
            "unit": "unsigned next_u32 / 2^32, binary64, [0,1)",
        },
        "runtime": {
            "implementation": platform.python_implementation(),
            "python": sys.version,
            "platform": platform.platform(),
        },
        "source_bindings": {
            "script": {"path": script.relative_to(ROOT).as_posix(), "sha256": sha256_file(script)},
            "rng_options": {"path": rng_options.relative_to(ROOT).as_posix(), "sha256": sha256_file(rng_options)},
            "prototype_experiment": {"path": experiment.relative_to(ROOT).as_posix(), "sha256": sha256_file(experiment)},
        },
        "provenance": {
            "xoshiro128starstar_1_1": "https://prng.di.unimi.it/xoshiro128starstar.c",
            "splitmix64": "https://prng.di.unimi.it/splitmix64.c",
            "notice": "The xoshiro and SplitMix sources describe their public-domain dedication; this diagnostic is an independent Python expression of their recurrence. The scalar word packing and proposal formula are project prototype choices.",
        },
        "seed_vectors": [vector_for_seed(seed) for seed in SEEDS],
        "prototype_candidates": {
            "baseline_5000": proposal_reference(baseline),
            "rmax_32_5000": proposal_reference(narrower),
            "baseline_prefix_10000": prefix_check(baseline),
        },
        "endpoint_analysis": {
            "unit_interval": "Each unit is exactly k/2^32 for k in 0..2^32-1, so the unit itself excludes 1.",
            "geometric_endpoint": "The final binary64 multiply/add that maps a unit into a geometric interval can round to its nominal upper endpoint for some narrow ranges or large origins. This oracle therefore makes no exclusive geometric-endpoint claim.",
        },
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "evidence/investigations/cp3-stream-oracle.json",
        help="JSON reference path (default: evidence/investigations/cp3-stream-oracle.json)",
    )
    args = parser.parse_args()
    output = args.output.resolve()
    if ROOT not in output.parents:
        raise SystemExit("output must remain inside the repository")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = build_report()
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": output.relative_to(ROOT).as_posix(), "status": report["status"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
