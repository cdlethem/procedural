#!/usr/bin/env python3
"""Bounded no-render check of a final interval clamp for CP5 candidate lerp."""

from __future__ import annotations

import hashlib
import json
import math
import platform
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "evidence/investigations/cp5-lerp-clamp-supplement.json"
MASK64 = (1 << 64) - 1
MAX = float.fromhex("0x1.fffffffffffffp+1023")
MIN_SUBNORMAL = float.fromhex("0x0.0000000000001p-1022")
MIN_NORMAL = float.fromhex("0x1p-1022")
SEARCH_SEED = 0xD9B4BEF9A47C1D53


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def word(value: float) -> int:
    return struct.unpack(">Q", struct.pack(">d", value))[0]


def describe(value: float) -> dict[str, str]:
    if math.isnan(value):
        text = "NaN"
    elif math.isinf(value):
        text = "-Infinity" if value < 0 else "Infinity"
    else:
        text = value.hex()
    return {"value": text, "bits": f"{word(value):016x}"}


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def unclamped_lerp(a: float, b: float, t: float) -> float:
    """Candidate L with strict opposite-sign branch and no FMA."""
    if t == 0.0:
        return canonical_zero(a)
    if t == 1.0:
        return canonical_zero(b)
    if (a < 0.0 < b) or (b < 0.0 < a):
        result = a * (1.0 - t) + b * t
    else:
        result = a + (b - a) * t
    return canonical_zero(result)


def clamped_lerp(a: float, b: float, t: float) -> float:
    result = unclamped_lerp(a, b, t)
    lower, upper = min(a, b), max(a, b)
    # Finite a/b and t in [0,1] make NaN unreachable in the two candidate
    # branches. These comparisons also turn a hypothetical +/-Infinity raw
    # excursion into the appropriate endpoint.
    if result < lower:
        result = lower
    elif result > upper:
        result = upper
    return canonical_zero(result)


class SplitMix64:
    def __init__(self, state: int) -> None:
        self.state = state & MASK64

    def next(self) -> int:
        self.state = (self.state + 0x9E3779B97F4A7C15) & MASK64
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK64
        return (z ^ (z >> 31)) & MASK64


def finite_from_word(value: int) -> float:
    """Turn a deterministic word into an arbitrary finite binary64 pattern."""
    exponent = (value >> 52) & 0x7FF
    if exponent == 0x7FF:
        exponent = 0x7FE
    value = (value & ~(0x7FF << 52)) | (exponent << 52)
    return struct.unpack(">d", struct.pack(">Q", value))[0]


def run_case(a: float, b: float, t: float) -> tuple[float, float]:
    if not (math.isfinite(a) and math.isfinite(b) and 0.0 <= t <= 1.0):
        raise AssertionError("diagnostic generator produced invalid input")
    return unclamped_lerp(a, b, t), clamped_lerp(a, b, t)


def main() -> int:
    source_before = sha256(Path(__file__))
    values = (
        -MAX,
        math.nextafter(-MAX, 0.0),
        -1.0,
        -MIN_NORMAL,
        -MIN_SUBNORMAL,
        -0.0,
        0.0,
        MIN_SUBNORMAL,
        MIN_NORMAL,
        1.0,
        math.nextafter(MAX, 0.0),
        MAX,
    )
    units = (0.0, MIN_SUBNORMAL, MIN_NORMAL, 2.0**-53, 2.0**-52, 1.0 / 16.0, 0.25, 0.5, 0.7, math.nextafter(1.0, 0.0), 1.0)
    total = raw_nonfinite = raw_out_of_bounds = clamped_nonfinite = clamped_out_of_bounds = differences = 0
    first_difference: dict[str, object] | None = None
    first_raw_excursion: dict[str, object] | None = None
    stream_digest = hashlib.sha256()

    def inspect(a: float, b: float, t: float, origin: str) -> None:
        nonlocal total, raw_nonfinite, raw_out_of_bounds, clamped_nonfinite, clamped_out_of_bounds, differences
        nonlocal first_difference, first_raw_excursion
        total += 1
        raw, clamped = run_case(a, b, t)
        lower, upper = min(a, b), max(a, b)
        stream_digest.update(struct.pack(">QQQ", word(a), word(b), word(t)))
        raw_bad = (not math.isfinite(raw)) or raw < lower or raw > upper
        clamp_bad = (not math.isfinite(clamped)) or clamped < lower or clamped > upper
        if not math.isfinite(raw):
            raw_nonfinite += 1
        if raw_bad:
            raw_out_of_bounds += 1
            if first_raw_excursion is None:
                first_raw_excursion = {"origin": origin, "a": describe(a), "b": describe(b), "t": describe(t), "raw": describe(raw), "bounds": [describe(lower), describe(upper)]}
        if not math.isfinite(clamped):
            clamped_nonfinite += 1
        if clamp_bad:
            clamped_out_of_bounds += 1
        if word(raw) != word(clamped):
            differences += 1
            if first_difference is None:
                first_difference = {"origin": origin, "a": describe(a), "b": describe(b), "t": describe(t), "unclamped": describe(raw), "clamped": describe(clamped)}

    for a in values:
        for b in values:
            for t in units:
                inspect(a, b, t, "deterministic-extreme-grid")
    grid_cases = total

    # Keep the whole supplement bounded to exactly 200,000 scalar lerps.
    random_cases = 200_000 - total
    rng = SplitMix64(SEARCH_SEED)
    for _ in range(random_cases):
        a = finite_from_word(rng.next())
        b = finite_from_word(rng.next())
        t = rng.next() / 18_446_744_073_709_551_616.0
        inspect(a, b, t, "deterministic-finite-bit-pattern-stream")

    report = {
        "status": "completed-no-render-bounded-numeric-supplement",
        "scope": {
            "compares": "The strict-opposite-sign endpoint-aware candidate L against the same L followed by interval clamp.",
            "excluded": ["public contract choice", "renderer behavior", "a proof over all binary64 inputs"],
        },
        "candidate_lerp": {
            "endpoint_order": "if t==0 return canonical(a); if t==1 return canonical(b)",
            "strict_opposite_sign": "a < 0 < b or b < 0 < a",
            "same_sign_or_zero_branch": "a + (b-a)*t",
            "opposite_sign_branch": "a*(1-t) + b*t",
            "fma": "not used",
            "clamp": "after raw result, clamp to [min(a,b), max(a,b)] then canonicalize exact zero",
        },
        "search": {
            "maximum_scalar_lerps": 200_000,
            "scalar_lerps_executed": total,
            "deterministic_extreme_grid_cases": grid_cases,
            "deterministic_finite_bit_pattern_cases": random_cases,
            "bit_pattern_stream": {"generator": "private SplitMix64", "seed_hex": f"{SEARCH_SEED:016x}", "input_word_sha256": stream_digest.hexdigest()},
            "extreme_endpoint_values": [describe(value) for value in values],
            "extreme_unit_values": [describe(value) for value in units],
        },
        "results": {
            "unclamped": {"nonfinite": raw_nonfinite, "outside_closed_endpoint_interval": raw_out_of_bounds},
            "clamped": {"nonfinite": clamped_nonfinite, "outside_closed_endpoint_interval": clamped_out_of_bounds},
            "bitwise_differences": differences,
            "first_raw_excursion": first_raw_excursion,
            "first_clamp_difference": first_difference,
            "interpretation": "No clamp difference was observed only if the two null fields remain null; this finite search cannot establish absence of a rare raw excursion.",
        },
        "provenance": {
            "tool": Path(__file__).relative_to(ROOT).as_posix(),
            "tool_sha256_before": source_before,
            "runtime": {"python": sys.version, "platform": platform.platform()},
        },
    }
    report["provenance"]["tool_sha256_after"] = sha256(Path(__file__))
    report["provenance"]["tool_sha256_match"] = report["provenance"]["tool_sha256_before"] == report["provenance"]["tool_sha256_after"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": report["status"], "output": OUT.relative_to(ROOT).as_posix(), "cases": total}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
