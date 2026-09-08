#!/usr/bin/env python3
"""Numerically compare the two ``mosaic02`` live-leaf selection fractions.

This is a source-bound diagnostic, not a renderer, port, or operation oracle.  It
models only the equal-quadrant list mutation in the pinned PDE and writes the
small evidence report consumed by the CP4 architecture investigation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import struct
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
PINNED_REVISION = "69bdd8513e4482a5e6018e36887d4bc208660eb5"
PDE_PATH = "2018/Generativos/mosaic02/mosaic02.pde"
EXPECTED_PDE_SHA256 = "d02a09f0179627ae7f358d26db41a5321555b11025959763da19162a40b7a2ff"
MASK_48 = (1 << 48) - 1
MULTIPLIER = 0x5DEECE66D
ADDEND = 0xB


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def f32(value: float) -> float:
    """Round exactly as a Java ``float`` operation for finite diagnostic inputs."""
    return struct.unpack(">f", struct.pack(">f", value))[0]


class JavaRandom:
    """Independent java.util.Random 48-bit LCG subset used by nextFloat()."""

    def __init__(self, seed: int) -> None:
        self.state = (seed ^ MULTIPLIER) & MASK_48

    def next(self, bits: int) -> int:
        self.state = (self.state * MULTIPLIER + ADDEND) & MASK_48
        return self.state >> (48 - bits)

    def next_float(self) -> float:
        return f32(self.next(24) / float(1 << 24))

    def processing_random(self, high: float) -> float:
        """PApplet.random(float): nextFloat() * high, with float multiplication."""
        high_f32 = f32(high)
        value = f32(self.next_float() * high_f32)
        # The pinned PApplet retries only if the rounded product equals high.
        while value == high_f32:
            value = f32(self.next_float() * high_f32)
        return value


def source_pde(repo: Path) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"{PINNED_REVISION}:{PDE_PATH}"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    source = result.stdout
    if sha256_bytes(source) != EXPECTED_PDE_SHA256:
        raise RuntimeError("pinned mosaic02 source hash differs from the audited source")
    text = source.decode("utf-8")
    required = (
        "randomSeed(seed);",
        "background(rcol());",
        "for (int i = 0; i < 100; i++)",
        "rects.get(int(random(rects.size()*0.5)))",
        "rects.add(new Rect(r.x, r.y, mw, mh));",
        "rects.add(new Rect(r.x+mw, r.y, r.w-mw, mh));",
        "rects.add(new Rect(r.x+mw, r.y+mh, r.w-mw, r.h-mh));",
        "rects.add(new Rect(r.x, r.y+mh, mw, r.h-mh));",
        "rects.remove(r);",
    )
    missing = [fragment for fragment in required if fragment not in text]
    if missing:
        raise RuntimeError(f"pinned PDE no longer has expected scheduler fragments: {missing!r}")
    return source


def inspect_processing_rng(javap: Path, processing_core: Path) -> dict[str, str]:
    output = subprocess.run(
        [str(javap), "-c", "-p", "-cp", str(processing_core), "processing.core.PApplet"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ).stdout
    required = (
        "public final float random(float);",
        "java/util/Random.nextFloat:()F",
        "fmul",
        "public final void randomSeed(long);",
        "java/util/Random.setSeed:(J)V",
    )
    missing = [fragment for fragment in required if fragment not in output]
    if missing:
        raise RuntimeError(f"PApplet bytecode did not verify the random model: {missing!r}")
    return {
        "core_jar": str(processing_core.relative_to(ROOT)),
        "core_jar_sha256": sha256_file(processing_core),
        "javap": str(javap.relative_to(ROOT)),
        "javap_sha256": sha256_file(javap),
        "bytecode_sha256": sha256_bytes(output.encode("utf-8")),
    }


def select_and_split(seed: int, fraction: float, split_count: int) -> dict[str, Any]:
    """Model only mosaic02's list: append four children, then remove its parent."""
    random = JavaRandom(seed)

    # The source immediately calls background(rcol()) after randomSeed(seed).  rcol()
    # consumes one random(colors.length) draw before the first selected leaf.
    background_palette_index = int(random.processing_random(4.0))
    leaves = [0]  # Equal splits make depth sufficient to calculate normalized area.
    selected_indices: list[int] = []
    for _ in range(split_count):
        index = int(random.processing_random(f32(len(leaves) * fraction)))
        if not 0 <= index < len(leaves):
            raise AssertionError(f"selection index {index} outside {len(leaves)} leaves")
        selected_indices.append(index)
        parent_depth = leaves[index]
        leaves.extend((parent_depth + 1,) * 4)
        del leaves[index]

    areas = [0.25**depth for depth in leaves]
    if len(leaves) != 1 + 3 * split_count:
        raise AssertionError("four-child replacement leaf count invariant failed")
    if abs(sum(areas) - 1.0) > 1e-12:
        raise AssertionError("normalized leaf areas do not sum to one")
    histogram = Counter(leaves)
    descending = sorted(areas, reverse=True)
    return {
        "background_palette_index": background_palette_index,
        "rng_state_after": f"{random.state:012x}",
        "selected_index_prefix": selected_indices[:12],
        "leaf_count": len(leaves),
        "depth_distribution": {str(depth): histogram[depth] for depth in sorted(histogram)},
        "minimum_leaf_area": min(areas),
        "maximum_leaf_area": max(areas),
        "area_concentration": {
            "herfindahl_index": sum(area * area for area in areas),
            "largest_10_leaves_area_share": sum(descending[:10]),
        },
    }


def make_report(repo: Path, javap: Path, processing_core: Path) -> dict[str, Any]:
    pde = source_pde(repo)
    rng_bytecode = inspect_processing_rng(javap, processing_core)
    seeds = [0, 1, 42, 123456, 999998]
    fractions = [0.5, 1.0]
    split_count = 100
    comparisons: list[dict[str, Any]] = []
    for seed in seeds:
        schedules = {
            str(fraction): select_and_split(seed, fraction, split_count)
            for fraction in fractions
        }
        # Both policies consume exactly one source-prelude draw and one index draw per
        # split, so their PRNG states deliberately remain aligned after 100 selections.
        if schedules["0.5"]["rng_state_after"] != schedules["1.0"]["rng_state_after"]:
            raise AssertionError("selection policies unexpectedly consumed unequal RNG draws")
        comparisons.append({"seed": seed, "schedules": schedules})
    return {
        "status": "completed-numeric-diagnostic",
        "scope": "equal-quadrant appended-child/removed-parent scheduler only; no rendering",
        "not_a_claim": [
            "not a public API or operation decision",
            "not a visual reproduction or interpretation of the survey image",
            "not a general partitioning conformance result",
        ],
        "source": {
            "repository": ".work/investigations/cp3-source/repo",
            "revision": PINNED_REVISION,
            "path": PDE_PATH,
            "sha256": sha256_bytes(pde),
            "source_prelude": "randomSeed(seed); background(rcol()); then the 100 split loop",
            "selection_expression": "int(random(rects.size()*fraction))",
            "child_mutation_order": "append top-left, top-right, bottom-right, bottom-left; remove selected parent",
        },
        "rng_model": {
            "purpose": "independent numeric model of the pinned Processing prelude and selection draws",
            "random_seed": "PApplet.randomSeed(long) delegates to java.util.Random.setSeed(long)",
            "random_high": "PApplet.random(float) calls java.util.Random.nextFloat() then float multiplication, retrying an exact high result",
            "prelude_draws": "one random(4) draw for background(rcol()) before selection",
            "independent_model": "48-bit java.util.Random LCG, next(24)/2^24, binary32 high/product, int truncation",
            "bytecode_verification": rng_bytecode,
        },
        "configuration": {
            "seeds": seeds,
            "fractions": fractions,
            "split_count": split_count,
            "root_normalized_area": 1.0,
            "metrics": {
                "depth_distribution": "counts of retained leaves by equal-split depth",
                "minimum_leaf_area": "minimum retained normalized area (4^-depth)",
                "maximum_leaf_area": "maximum retained normalized area (4^-depth)",
                "herfindahl_index": "sum of squared retained normalized leaf areas",
                "largest_10_leaves_area_share": "sum of the ten largest retained normalized leaf areas",
            },
        },
        "results": comparisons,
        "source_bindings": {
            "tool": "tools/diagnostics/cp4/run_selection_numeric.py",
            "tool_sha256": sha256_file(Path(__file__).resolve()),
            "cp4_source_audit": "design/capabilities/cp4-partition-source-audit.md",
            "mosaic02_note": "survey/out/2018/Generativos/mosaic02/notes.md",
            "mosaic02_note_sha256": sha256_file(ROOT / "survey/out/2018/Generativos/mosaic02/notes.md"),
        },
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        type=Path,
        default=ROOT / ".work/investigations/cp3-source/repo",
        help="pinned upstream source checkout",
    )
    parser.add_argument(
        "--processing-core",
        type=Path,
        default=ROOT / ".work/toolchains/processing-4.5.6/core-4.5.6.jar",
    )
    parser.add_argument(
        "--javap",
        type=Path,
        default=ROOT / ".work/toolchains/jdk-17.0.20.1+1/bin/javap",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "evidence/investigations/cp4-selection-numeric.json",
    )
    args = parser.parse_args()
    report = make_report(args.repo.resolve(), args.javap.resolve(), args.processing_core.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "output": str(args.output), "cases": len(report["results"])}, sort_keys=True))


if __name__ == "__main__":
    main()
