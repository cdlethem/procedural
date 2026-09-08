#!/usr/bin/env python3
"""Measure binary64 behaviours relevant to a possible CP5 triangle mapping.

This private, no-render diagnostic compares two explicitly spelled arithmetic
orders.  It neither selects public semantics nor supplies a conformance oracle.
"""

from __future__ import annotations

import hashlib
import json
import math
import platform
import struct
import sys
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "evidence/investigations/cp5-mapping-numerics.json"
MAX = float.fromhex("0x1.fffffffffffffp+1023")
MIN_SUBNORMAL = float.fromhex("0x0.0000000000001p-1022")
MIN_NORMAL = float.fromhex("0x1p-1022")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bits(value: float) -> str:
    return f"{struct.unpack('>Q', struct.pack('>d', value))[0]:016x}"


def describe(value: float) -> dict[str, str]:
    if math.isnan(value):
        text = "NaN"
    elif math.isinf(value):
        text = "-Infinity" if value < 0 else "Infinity"
    else:
        text = value.hex()
    return {"value": text, "bits": bits(value)}


def weights(u: float, v: float) -> tuple[float, float, float, float]:
    """The separate weight arithmetic proposed for investigation."""
    root = math.sqrt(u)
    return root, 1.0 - root, (1.0 - v) * root, v * root


def direct(a: float, b: float, c: float, u: float, v: float) -> float:
    """((w0*a) + (w1*b)) + (w2*c), in that exact binary64 order."""
    _, w0, w1, w2 = weights(u, v)
    return (w0 * a + w1 * b) + w2 * c


def canonical_zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def proposed_lerp(a: float, b: float, t: float) -> float:
    """Root's candidate endpoint-aware convex lerp, spelled without FMA.

    Same-sign (and zero/nonzero) endpoints use a + (b-a)*t.  Strictly opposite
    signs use weighted products so b-a cannot overflow.  Endpoint branches are
    evaluated before an arithmetic path, then exact zero is canonicalized to +0.
    """
    if t == 0.0:
        return canonical_zero(a)
    if t == 1.0:
        return canonical_zero(b)
    if (a < 0.0 < b) or (b < 0.0 < a):
        result = a * (1.0 - t) + b * t
    else:
        result = a + (b - a) * t
    return canonical_zero(result)


def nested(a: float, b: float, c: float, u: float, v: float) -> float:
    root = math.sqrt(u)
    return proposed_lerp(a, proposed_lerp(b, c, v), root)


def naive_nested(a: float, b: float, c: float, u: float, v: float) -> float:
    """The unguarded a + t*(b-a) form, shown only as a contrast."""
    root = math.sqrt(u)
    q = b + v * (c - b)
    return a + root * (q - a)


def coord_case(identifier: str, abc: tuple[float, float, float], u: float, v: float) -> dict[str, object]:
    a, b, c = abc
    root, w0, w1, w2 = weights(u, v)
    return {
        "id": identifier,
        "inputs": {
            "vertices": [describe(value) for value in abc],
            "u": describe(u),
            "v": describe(v),
        },
        "separate_weights": {
            "sqrt_u": describe(root),
            "w0": describe(w0),
            "w1": describe(w1),
            "w2": describe(w2),
            "left_associated_sum": describe((w0 + w1) + w2),
        },
        "direct_weighted_sum": describe(direct(a, b, c, u, v)),
        "nested_endpoint_aware_lerp": describe(nested(a, b, c, u, v)),
        "naive_nested_difference_lerp": describe(naive_nested(a, b, c, u, v)),
        "component_bounds": [describe(min(abc)), describe(max(abc))],
    }


def float_cross(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def exact_cross(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> Fraction:
    ax, ay = map(Fraction.from_float, a)
    bx, by = map(Fraction.from_float, b)
    cx, cy = map(Fraction.from_float, c)
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)


def determinant_case(identifier: str, vertices: tuple[tuple[float, float], tuple[float, float], tuple[float, float]], exact_label: str) -> dict[str, object]:
    result = float_cross(*vertices)
    exact = exact_cross(*vertices)
    return {
        "id": identifier,
        "vertices": [[describe(x), describe(y)] for x, y in vertices],
        "float_cross": describe(result),
        "exact_binary64_rational_sign": "zero" if exact == 0 else ("positive" if exact > 0 else "negative"),
        "exact_binary64_rational_value": exact_label,
    }


def bounded_grid() -> dict[str, object]:
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
    units = (0.0, MIN_SUBNORMAL, MIN_NORMAL, 2.0**-53, 1.0 / 16.0, 0.25, 0.5, 0.7, math.nextafter(1.0, 0.0), 1.0)
    tested = 0
    direct_nonfinite = direct_out_of_bounds = nested_nonfinite = nested_out_of_bounds = divergences = 0
    first_direct_out_of_bounds: dict[str, object] | None = None
    for a in values:
        for b in values:
            for c in values:
                lower, upper = min(a, b, c), max(a, b, c)
                for u in units:
                    for v in units:
                        tested += 1
                        raw = direct(a, b, c, u, v)
                        safe = nested(a, b, c, u, v)
                        if not math.isfinite(raw):
                            direct_nonfinite += 1
                        elif raw < lower or raw > upper:
                            direct_out_of_bounds += 1
                            if first_direct_out_of_bounds is None:
                                first_direct_out_of_bounds = {
                                    "vertices": [describe(value) for value in (a, b, c)],
                                    "u": describe(u),
                                    "v": describe(v),
                                    "result": describe(raw),
                                    "bounds": [describe(lower), describe(upper)],
                                }
                        if not math.isfinite(safe):
                            nested_nonfinite += 1
                        elif safe < lower or safe > upper:
                            nested_out_of_bounds += 1
                        if bits(raw) != bits(safe):
                            divergences += 1
    return {
        "not_a_proof": "A bounded adversarial grid, not universal verification.",
        "coordinate_values": [describe(value) for value in values],
        "unit_values": [describe(value) for value in units],
        "coordinate_evaluations": tested,
        "direct_weighted_sum": {"nonfinite": direct_nonfinite, "outside_component_bounds": direct_out_of_bounds},
        "nested_endpoint_aware_lerp": {"nonfinite": nested_nonfinite, "outside_component_bounds": nested_out_of_bounds},
        "bitwise_divergences_between_orders": divergences,
        "first_direct_out_of_bounds": first_direct_out_of_bounds,
    }


def main() -> int:
    tool_before = sha256(Path(__file__))
    cases = [
        coord_case("ordinary-one-ulp-order-divergence", (1.0, 3.0, -2.0), 1.0 / 16.0, 0.7),
        coord_case("constant-coordinate-affine-rounding", (1.0, 1.0, 1.0), 2.0**-53, 0.2),
        coord_case("constant-negative-max-outside-direct-bound", (-MAX, -MAX, -MAX), 2.0**-53, 0.25),
        coord_case("u-zero-opposite-extremes", (-MAX, MAX, MAX), 0.0, 0.5),
        coord_case("u-one-v-zero-opposite-extremes", (0.0, -MAX, MAX), 1.0, 0.0),
        coord_case("all-negative-zero", (-0.0, -0.0, -0.0), 0.25, 0.5),
    ]
    determinants = [
        determinant_case(
            "noncollinear-area-underflows", ((0.0, 0.0), (2.0**-600, 0.0), (0.0, 2.0**-600)), "2^-1200",
        ),
        determinant_case(
            "finite-coordinate-subtraction-overflows", ((-MAX, 0.0), (MAX, 0.0), (0.0, 1.0)), "positive exact binary64 rational",
        ),
        determinant_case(
            "exact-collinear-tiny", ((0.0, 0.0), (2.0**-600, 2.0**-600), (2.0**-599, 2.0**-599)), "0",
        ),
        determinant_case("repeated-vertex", ((0.0, 0.0), (0.0, 0.0), (1.0, 1.0)), "0"),
    ]
    report = {
        "status": "completed-no-render-numeric-diagnostic",
        "scope": {
            "investigates": "Finite binary64 arithmetic for a possible supplied-triangle barycentric mapper.",
            "does_not_decide": [
                "public mapping arithmetic",
                "triangle validity policy",
                "degenerate-triangle semantics",
                "a numerical tolerance or public input bounds",
            ],
        },
        "arithmetic_orders": {
            "direct_weighted_sum": "sqrt_u=sqrt(u); w0=1-sqrt_u; w1=(1-v)*sqrt_u; w2=v*sqrt_u; ((w0*a)+(w1*b))+(w2*c)",
            "nested_endpoint_aware_lerp": "L(a,L(b,c,v),sqrt(u)); L returns endpoint for t=0/1, uses a+(b-a)*t except strictly opposite signs use a*(1-t)+b*t, then canonicalizes zero to +0.",
            "naive_nested_difference_lerp": "a + sqrt(u) * ((b + v*(c-b)) - a); contrast only, without endpoint or opposite-sign safeguards.",
            "fma": "No fused multiply-add is used by this tool.",
        },
        "coordinate_cases": cases,
        "determinant_cases": determinants,
        "bounded_adversarial_grid": bounded_grid(),
        "rationale": [
            "Nonnegative separately rounded weights do not make the direct arithmetic order affine-identical for every constant coordinate.",
            "A floating cross product equal to zero can represent either exact collinearity or an underflowed nonzero binary64-rational determinant.",
            "An exact binary64-rational orientation predicate can distinguish those two cases without an epsilon, while a later policy can still choose to accept collapsed mappings.",
        ],
        "provenance": {
            "tool": Path(__file__).relative_to(ROOT).as_posix(),
            "tool_sha256_before": tool_before,
            "runtime": {"python": sys.version, "platform": platform.platform()},
        },
    }
    report["provenance"]["tool_sha256_after"] = sha256(Path(__file__))
    report["provenance"]["tool_sha256_match"] = report["provenance"]["tool_sha256_before"] == report["provenance"]["tool_sha256_after"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": report["status"], "output": OUT.relative_to(ROOT).as_posix()}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
