#!/usr/bin/env python3
"""Compile and compare a headless PApplet scheduler probe with an independent model."""

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
MASK_48 = (1 << 48) - 1
MULTIPLIER = 0x5DEECE66D
ADDEND = 0xB


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def f32(value: float) -> float:
    return struct.unpack(">f", struct.pack(">f", value))[0]


class IndependentJavaRandom:
    """Independent Python implementation, deliberately separate from the first diagnostic."""

    def __init__(self, seed: int) -> None:
        self.state = (seed ^ MULTIPLIER) & MASK_48

    def next_float(self) -> float:
        self.state = (self.state * MULTIPLIER + ADDEND) & MASK_48
        return f32((self.state >> 24) / float(1 << 24))

    def random(self, high: float) -> float:
        high = f32(high)
        value = f32(self.next_float() * high)
        while value == high:
            value = f32(self.next_float() * high)
        return value


def reference_case(seed: int, fraction: float, split_count: int) -> dict[str, Any]:
    random = IndependentJavaRandom(seed)
    background = int(random.random(4.0))
    leaves = [0]
    selected: list[int] = []
    for _ in range(split_count):
        index = int(random.random(f32(len(leaves) * fraction)))
        if not 0 <= index < len(leaves):
            raise AssertionError("independent model generated an invalid selection")
        selected.append(index)
        depth = leaves[index]
        leaves.extend((depth + 1,) * 4)
        del leaves[index]
    counts = Counter(leaves)
    return {
        "background_palette_index": background,
        "selected_indices": selected,
        "depth_distribution": {str(key): counts[key] for key in sorted(counts)},
        "leaf_count": len(leaves),
    }


def parse_probe(output: str) -> dict[tuple[int, str], dict[str, Any]]:
    records: dict[tuple[int, str], dict[str, Any]] = {}
    for line in output.splitlines():
        fields = line.split("\t")
        if len(fields) != 5:
            raise RuntimeError(f"unexpected probe line: {line!r}")
        seed_text, fraction_text, background_text, indices_text, histogram_text = fields
        key = (int(seed_text), fraction_text)
        if key in records:
            raise RuntimeError(f"duplicate probe record: {key!r}")
        indices = [int(value) for value in indices_text.split(",") if value]
        histogram: dict[str, int] = {}
        for pair in histogram_text.split(","):
            depth, count = pair.split(":", 1)
            histogram[depth] = int(count)
        records[key] = {
            "background_palette_index": int(background_text),
            "selected_indices": indices,
            "depth_distribution": histogram,
            "leaf_count": sum(histogram.values()),
        }
    return records


def command_version(command: list[str]) -> str:
    completed = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return completed.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    parser.add_argument("--processing-core", type=Path, default=ROOT / ".work/toolchains/processing-4.5.6/core-4.5.6.jar")
    parser.add_argument("--numeric-report", type=Path, default=ROOT / "evidence/investigations/cp4-selection-numeric.json")
    parser.add_argument("--build-dir", type=Path, default=ROOT / ".work/cp4-selection-java-check")
    parser.add_argument("--output", type=Path, default=ROOT / "evidence/investigations/cp4-selection-java-check.json")
    args = parser.parse_args()

    numeric = json.loads(args.numeric_report.read_text(encoding="utf-8"))
    if numeric.get("status") != "completed-numeric-diagnostic":
        raise RuntimeError("numeric report is not a completed diagnostic")
    configuration = numeric.get("configuration")
    expected_seeds = [0, 1, 42, 123456, 999998]
    expected_fractions = [0.5, 1.0]
    if not isinstance(configuration, dict) or (
        configuration.get("seeds") != expected_seeds
        or configuration.get("fractions") != expected_fractions
        or configuration.get("split_count") != 100
    ):
        raise RuntimeError("numeric report configuration no longer matches the bound ten cases")
    probe = ROOT / "tools/diagnostics/cp4/SelectionScheduleProbe.java"
    javac = args.java_home / "bin/javac"
    java = args.java_home / "bin/java"
    args.build_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(javac), "-cp", str(args.processing_core), "-d", str(args.build_dir), str(probe)],
        check=True,
    )
    process = subprocess.run(
        [str(java), "-cp", f"{args.build_dir}:{args.processing_core}", "SelectionScheduleProbe"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if process.stderr:
        raise RuntimeError(f"headless probe emitted stderr: {process.stderr!r}")
    actual = parse_probe(process.stdout)
    expected_keys = {(seed, str(fraction)) for seed in expected_seeds for fraction in expected_fractions}
    if set(actual) != expected_keys:
        raise RuntimeError("probe did not emit exactly the bound ten cases")

    numeric_records = {row["seed"]: row["schedules"] for row in numeric["results"]}
    emitted_records: list[dict[str, Any]] = []
    compared_indices = 0
    for seed in expected_seeds:
        for fraction in expected_fractions:
            key = (seed, str(fraction))
            observed = actual[key]
            independent = reference_case(seed, fraction, 100)
            if observed != independent:
                raise RuntimeError(f"PApplet mismatch with independent model for seed={seed}, fraction={fraction}")
            prior = numeric_records.get(seed, {}).get(str(fraction))
            if not isinstance(prior, dict):
                raise RuntimeError(f"numeric report misses seed={seed}, fraction={fraction}")
            if observed["background_palette_index"] != prior.get("background_palette_index"):
                raise RuntimeError(f"PApplet background prelude mismatch in numeric report for {key}")
            if observed["depth_distribution"] != prior.get("depth_distribution"):
                raise RuntimeError(f"PApplet depth histogram mismatch in numeric report for {key}")
            if observed["leaf_count"] != prior.get("leaf_count"):
                raise RuntimeError(f"PApplet leaf count mismatch in numeric report for {key}")
            if observed["selected_indices"][:12] != prior.get("selected_index_prefix"):
                raise RuntimeError(f"PApplet selection prefix mismatch in numeric report for {key}")
            compared_indices += len(observed["selected_indices"])
            emitted_records.append({"seed": seed, "fraction": fraction, **observed})

    report = {
        "status": "completed-headless-papplet-check",
        "scope": "PApplet randomSeed/random plus equal-quadrant list scheduling; no renderer, session, or images",
        "configuration": {"seeds": expected_seeds, "fractions": expected_fractions, "split_count": 100},
        "comparison": {
            "independent_python_model": "passed",
            "existing_numeric_report": "passed for background prelude, all depth histograms, leaf counts, and 12-index stored prefixes",
            "indices_compared_against_independent_model": compared_indices,
            "depth_histograms_compared": len(emitted_records),
        },
        "records": emitted_records,
        "source_bindings": {
            "runner": "tools/diagnostics/cp4/run_selection_java_check.py",
            "runner_sha256": sha256_file(Path(__file__).resolve()),
            "probe": "tools/diagnostics/cp4/SelectionScheduleProbe.java",
            "probe_sha256": sha256_file(probe),
            "processing_core": str(args.processing_core.relative_to(ROOT)),
            "processing_core_sha256": sha256_file(args.processing_core),
            "numeric_report": str(args.numeric_report.relative_to(ROOT)),
            "numeric_report_sha256": sha256_file(args.numeric_report),
            "numeric_report_tool_sha256": numeric["source_bindings"]["tool_sha256"],
        },
        "runtime": {
            "java": command_version([str(java), "-version"]),
            "python": sys.version,
            "platform": platform.platform(),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "indices_compared": compared_indices, "output": str(args.output)}, sort_keys=True))


if __name__ == "__main__":
    main()
