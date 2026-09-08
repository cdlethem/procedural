#!/usr/bin/env python3
"""Run a bounded, no-render comparison of three triangle-coordinate mappings.

This is a private CP5 investigation.  It deliberately uses a diagnostic xoshiro
stream, rather than Processing's ``random`` implementation, because it measures
the mappings and their raw-draw order, not source pixel replay or a public RNG.
"""

from __future__ import annotations

import hashlib
import json
import math
import platform
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "evidence/investigations/cp5-grain-distributions.json"
UPSTREAM = ROOT / ".work/investigations/cp3-source/repo"
REVISION = "69bdd8513e4482a5e6018e36887d4bc208660eb5"
MASK32 = 0xFFFFFFFF
MASK64 = 0xFFFFFFFFFFFFFFFF
SEEDS = (0, 1, 42, 2_147_483_648, 4_294_967_295)
SAMPLES_PER_SEED = 100_000
VERTEX_THRESHOLD = 0.9
EDGE_THRESHOLD = 0.05


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def upstream_sha256(relative_path: str) -> str:
    """Hash a pinned blob even when this sparse checkout did not materialize it."""
    completed = subprocess.run(
        ["git", "-C", str(UPSTREAM), "show", f"{REVISION}:{relative_path}"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return hashlib.sha256(completed.stdout).hexdigest()


class Xoshiro128StarStar:
    """The separately specified CP3 diagnostic stream, used only for repeatability."""

    def __init__(self, seed: int) -> None:
        if not 0 <= seed <= MASK32:
            raise ValueError("seed must be uint32")
        state = seed
        words: list[int] = []
        for _ in range(2):
            state = (state + 0x9E3779B97F4A7C15) & MASK64
            z = state
            z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
            z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK64
            z ^= z >> 31
            words.extend((z & MASK32, (z >> 32) & MASK32))
        if not any(words):
            raise AssertionError("SplitMix64 expansion must not create an all-zero state")
        self.s0, self.s1, self.s2, self.s3 = words
        self.draws = 0

    def unit(self) -> float:
        result = (self.s1 * 5) & MASK32
        result = (((result << 7) | (result >> 25)) & MASK32)
        result = (result * 9) & MASK32
        t = (self.s1 << 9) & MASK32
        self.s2 ^= self.s0
        self.s3 ^= self.s1
        self.s1 ^= self.s2
        self.s0 ^= self.s3
        self.s2 ^= t
        self.s3 = (((self.s3 << 11) | (self.s3 >> 21)) & MASK32)
        self.draws += 1
        return result / 4_294_967_296.0


@dataclass
class Summary:
    count: int = 0
    sums: list[float] | None = None
    square_sums: list[float] | None = None
    minimum: float = math.inf
    max_sum_error: float = 0.0
    containment_violations: int = 0
    near_vertex: list[int] | None = None
    near_edge: list[int] | None = None
    coordinate_sums: list[float] | None = None
    coordinate_square_sums: list[float] | None = None

    def __post_init__(self) -> None:
        self.sums = [0.0, 0.0, 0.0]
        self.square_sums = [0.0, 0.0, 0.0]
        self.near_vertex = [0, 0, 0]
        self.near_edge = [0, 0, 0]
        self.coordinate_sums = [0.0, 0.0]
        self.coordinate_square_sums = [0.0, 0.0]

    def add(self, sample: tuple[float, float, float, float, float]) -> None:
        weights = sample[:3]
        first, second = sample[3:]
        self.count += 1
        total = sum(weights)
        self.max_sum_error = max(self.max_sum_error, abs(total - 1.0))
        for index, weight in enumerate(weights):
            self.sums[index] += weight
            assert self.square_sums is not None
            self.square_sums[index] += weight * weight
            self.minimum = min(self.minimum, weight)
            if weight >= VERTEX_THRESHOLD:
                self.near_vertex[index] += 1
            if weight <= EDGE_THRESHOLD:
                self.near_edge[index] += 1
        if any(weight < 0.0 or weight > 1.0 for weight in weights) or abs(total - 1.0) > 2e-15:
            self.containment_violations += 1
        assert self.coordinate_sums is not None and self.coordinate_square_sums is not None
        self.coordinate_sums[0] += first
        self.coordinate_sums[1] += second
        self.coordinate_square_sums[0] += first * first
        self.coordinate_square_sums[1] += second * second

    def result(self) -> dict[str, object]:
        assert self.sums is not None and self.square_sums is not None
        assert self.near_vertex is not None and self.near_edge is not None
        assert self.coordinate_sums is not None and self.coordinate_square_sums is not None
        return {
            "samples": self.count,
            "barycentric_means": [value / self.count for value in self.sums],
            "barycentric_second_moments": [value / self.count for value in self.square_sums],
            "coordinate_moments": {
                "first_radicand": {
                    "mean": self.coordinate_sums[0] / self.count,
                    "second_moment": self.coordinate_square_sums[0] / self.count,
                },
                "second_coordinate": {
                    "mean": self.coordinate_sums[1] / self.count,
                    "second_moment": self.coordinate_square_sums[1] / self.count,
                },
            },
            "containment": {
                "violations": self.containment_violations,
                "minimum_weight": self.minimum,
                "maximum_abs_weight_sum_error": self.max_sum_error,
            },
            "concentration_thresholds": {
                "near_vertex_weight_gte": VERTEX_THRESHOLD,
                "near_opposite_edge_weight_lte": EDGE_THRESHOLD,
            },
            "near_vertex": {
                "counts": self.near_vertex,
                "fractions": [value / self.count for value in self.near_vertex],
            },
            "near_opposite_edge": {
                "counts": self.near_edge,
                "fractions": [value / self.count for value in self.near_edge],
            },
        }


def uniform_helper(rng: Xoshiro128StarStar) -> tuple[float, float, float, float, float]:
    first = rng.unit()
    second = rng.unit()
    root = math.sqrt(first)
    return (1.0 - root, (1.0 - second) * root, second * root, first, second)


def puntis_active(rng: Xoshiro128StarStar) -> tuple[float, float, float, float, float]:
    first = rng.unit() * rng.unit()
    second = rng.unit()
    root = math.sqrt(first)
    return (1.0 - root, (1.0 - second) * root, second * root, first, second)


def puntis3_source_pattern(rng: Xoshiro128StarStar) -> tuple[float, float, float, float, float]:
    # Exact source-pattern ordering: three overwritten brightness draws, dd,
    # two r2-product draws, then the fresh coordinate r1 draw.
    _brightness = (0.1 + rng.unit() * 0.9) * rng.unit() * (0.5 + rng.unit() * 0.5)
    dd = int(rng.unit() * 2.0)
    second = (dd * 0.8 + rng.unit() * (1.0 - dd * 0.8)) * (0.4 + rng.unit() * 0.6)
    first = rng.unit()
    root = math.sqrt(first)
    return (1.0 - root, (1.0 - second) * root, second * root, first, second)


PATTERNS: tuple[tuple[str, Callable[[Xoshiro128StarStar], tuple[float, float, float, float, float]], dict[str, object]], ...] = (
    (
        "uniform_helper",
        uniform_helper,
        {
            "raw_unit_draws_per_sample": 2,
            "draw_order": ["r1", "r2"],
            "analytic_expected_barycentric_means": [1.0 / 3.0] * 3,
            "analytic_expected_barycentric_second_moments": [1.0 / 6.0] * 3,
            "source_relation": "The unused randInTri helper in puntis/puntis2.",
        },
    ),
    (
        "puntis_active",
        puntis_active,
        {
            "raw_unit_draws_per_sample": 3,
            "draw_order": ["r1_product_left", "r1_product_right", "r2"],
            "analytic_expected_barycentric_means": [5.0 / 9.0, 2.0 / 9.0, 2.0 / 9.0],
            "analytic_expected_barycentric_second_moments": [13.0 / 36.0, 1.0 / 12.0, 1.0 / 12.0],
            "source_relation": "The executed puntis/puntis2 stipple coordinate expression.",
        },
    ),
    (
        "puntis3_source_pattern",
        puntis3_source_pattern,
        {
            "raw_unit_draws_per_sample": 7,
            "draw_order": [
                "brightness_low_high",
                "brightness_unit",
                "brightness_half_one",
                "dd",
                "r2_lower_to_one",
                "r2_point_four_to_one",
                "coordinate_r1",
            ],
            "analytic_expected_barycentric_means": [1.0 / 3.0, 17.0 / 50.0, 49.0 / 150.0],
            "analytic_expected_barycentric_second_moments": [1.0 / 6.0, 1193.0 / 7500.0, 559.0 / 3750.0],
            "analytic_expected_second_coordinate_second_moment": 559.0 / 1875.0,
            "analytic_derivation": (
                "The overwritten brightness draws do not enter coordinates. "
                "E[sqrt(r1)]=2/3; dd makes E[first r2 factor]=(1/2)(1/2)+(1/2)(9/10)=7/10; "
                "E[second r2 factor]=7/10; E[r2]=49/100."
            ),
            "source_relation": "The executed puntis3 grain loop, including its overwritten brightness draws.",
        },
    ),
)


def source_bindings() -> dict[str, str]:
    bindings = {
        "design/capabilities/grain-evidence-audit.md": sha256(ROOT / "design/capabilities/grain-evidence-audit.md"),
        "survey/out/2018/Generativos/puntis/notes.md": sha256(ROOT / "survey/out/2018/Generativos/puntis/notes.md"),
        "survey/out/2018/Generativos/puntis2/notes.md": sha256(ROOT / "survey/out/2018/Generativos/puntis2/notes.md"),
        "survey/out/2018/Generativos/puntis3/notes.md": sha256(ROOT / "survey/out/2018/Generativos/puntis3/notes.md"),
        "survey/out/2018/Generativos/puntis/variants/stipple_4.0/result.json": sha256(ROOT / "survey/out/2018/Generativos/puntis/variants/stipple_4.0/result.json"),
        "survey/out/2018/Generativos/puntis2/variants/density_0.4/result.json": sha256(ROOT / "survey/out/2018/Generativos/puntis2/variants/density_0.4/result.json"),
        "survey/out/2018/Generativos/puntis3/variants/stipple_6/result.json": sha256(ROOT / "survey/out/2018/Generativos/puntis3/variants/stipple_6/result.json"),
        "upstream/2018/Generativos/puntis/puntis.pde": upstream_sha256("2018/Generativos/puntis/puntis.pde"),
        "upstream/2018/Generativos/puntis2/puntis2.pde": upstream_sha256("2018/Generativos/puntis2/puntis2.pde"),
        "upstream/2018/Generativos/puntis3/puntis3.pde": upstream_sha256("2018/Generativos/puntis3/puntis3.pde"),
    }
    return bindings


def measured_variant_facts() -> list[dict[str, object]]:
    selected = (
        ("2018/Generativos/puntis", "stipple_4.0"),
        ("2018/Generativos/puntis2", "density_0.4"),
        ("2018/Generativos/puntis3", "stipple_6"),
    )
    facts: list[dict[str, object]] = []
    for sketch, variant in selected:
        path = ROOT / "survey/out" / sketch / "variants" / variant / "result.json"
        result = json.loads(path.read_text())
        facts.append({
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256(path),
            "substitution": result["subs_applied"],
            "diff_vs_baseline": result["diff_vs_baseline"],
        })
    return facts


def main() -> int:
    tool_sha_before = sha256(Path(__file__))
    input_bindings_before = source_bindings()
    results: dict[str, object] = {}
    for name, sampler, metadata in PATTERNS:
        aggregate = Summary()
        per_seed: list[dict[str, object]] = []
        for seed in SEEDS:
            rng = Xoshiro128StarStar(seed)
            summary = Summary()
            for _ in range(SAMPLES_PER_SEED):
                weights = sampler(rng)
                summary.add(weights)
                aggregate.add(weights)
            expected_draws = SAMPLES_PER_SEED * int(metadata["raw_unit_draws_per_sample"])
            if rng.draws != expected_draws:
                raise AssertionError(f"{name} seed {seed}: {rng.draws} draws, expected {expected_draws}")
            per_seed.append({"seed": seed, "raw_unit_draws": rng.draws, **summary.result()})
        results[name] = {**metadata, "per_seed": per_seed, "aggregate": aggregate.result()}

    tool_hash = sha256(Path(__file__))
    input_bindings_after = source_bindings()
    report = {
        "status": "completed-no-render-numeric-diagnostic",
        "scope": {
            "claim": "Finite-stream numeric comparison of coordinate mappings and their raw-unit consumption.",
            "excluded": [
                "Processing random replay",
                "rendering or image evidence",
                "a public operation, signature, default, range, or stochastic contract",
            ],
        },
        "configuration": {
            "diagnostic_stream": "xoshiro128**1.1 with the CP3 two-SplitMix64 expansion; private reproducibility aid only",
            "unit_mapping": "uint32 / 2^32",
            "seeds": list(SEEDS),
            "samples_per_seed": SAMPLES_PER_SEED,
            "total_samples_per_pattern": len(SEEDS) * SAMPLES_PER_SEED,
            "triangle_barycentric_mapping": "(1-sqrt(first), (1-second)*sqrt(first), second*sqrt(first))",
        },
        "patterns": results,
        "numeric_interpretation": [
            "The ideal uniform helper and puntis3 have similar first barycentric means, but their second moments and near-vertex/edge counts remain distinct finite-stream measurements.",
            "The active puntis first-coordinate product produces a materially different first-vertex mean and concentration from the ideal helper.",
            "These are numeric mapping observations, not visual evidence or a decision to preserve any source stream in a public operation.",
        ],
        "source_pattern_overhead": {
            "puntis_and_puntis2": {
                "per_triangle_before_dots_raw_draws": 1,
                "per_dot_raw_draws": 3,
                "per_triangle_draw": "rcol() palette selection after the randomSeed(seed) reset",
            },
            "puntis3": {
                "per_triangle_before_dots_raw_draws": 1,
                "per_dot_raw_draws": 7,
                "per_triangle_draw": "rcol() base-fill palette selection after the randomSeed(seed) reset",
                "brightness_draws_consumed_before_coordinates": 3,
            },
        },
        "variant_measurements": {
            "interpretation": (
                "The audit table's changed fractions are stored renderer diff measurements in these result files, "
                "not fractions asserted by the prose notes. The notes provide qualitative descriptions and substitutions."
            ),
            "records": measured_variant_facts(),
        },
        "provenance": {
            "upstream_revision": REVISION,
            "upstream_license": "MIT (upstream source is provenance only)",
            "input_bindings_before": input_bindings_before,
            "input_bindings_after": input_bindings_after,
            "input_bindings_match": input_bindings_before == input_bindings_after,
            "tool": Path(__file__).relative_to(ROOT).as_posix(),
            "tool_sha256_before": tool_sha_before,
            "tool_sha256_after": tool_hash,
            "tool_sha256_match": tool_sha_before == tool_hash,
            "runtime": {"python": sys.version, "platform": platform.platform()},
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": report["status"], "output": OUT.relative_to(ROOT).as_posix()}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
