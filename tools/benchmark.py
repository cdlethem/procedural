#!/usr/bin/env python3
"""Compare a language port's rendered corpus against the portable benchmark manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter, ImageStat

try:
    from .benchmark_evidence import load_evidence, validate_manifest_evidence
except ImportError:
    from benchmark_evidence import load_evidence, validate_manifest_evidence

METRIC_VERSION = 1
THUMBNAIL_SIZE = (256, 256)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def block_ssim(reference: Image.Image, candidate: Image.Image, block: int = 8) -> float:
    left = reference.convert("L")
    right = candidate.convert("L")
    width = min(left.width, right.width)
    height = min(left.height, right.height)
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    values: list[float] = []
    for top in range(0, height, block):
        for x in range(0, width, block):
            box = (x, top, min(x + block, width), min(top + block, height))
            a = list(left.crop(box).get_flattened_data())
            b = list(right.crop(box).get_flattened_data())
            count = len(a)
            if not count:
                continue
            mean_a = sum(a) / count
            mean_b = sum(b) / count
            variance_a = sum((value - mean_a) ** 2 for value in a) / count
            variance_b = sum((value - mean_b) ** 2 for value in b) / count
            covariance = sum((va - mean_a) * (vb - mean_b) for va, vb in zip(a, b)) / count
            numerator = (2 * mean_a * mean_b + c1) * (2 * covariance + c2)
            denominator = (mean_a * mean_a + mean_b * mean_b + c1) * (variance_a + variance_b + c2)
            values.append(numerator / denominator if denominator else 1.0)
    return clamp01(sum(values) / len(values)) if values else 1.0


def histogram_intersection(reference: Image.Image, candidate: Image.Image) -> float:
    left = reference.convert("RGB").histogram()
    right = candidate.convert("RGB").histogram()
    denominator = reference.width * reference.height * 3
    return clamp01(sum(min(a, b) for a, b in zip(left, right)) / denominator) if denominator else 1.0


def edge_similarity(reference: Image.Image, candidate: Image.Image) -> float:
    left = list(reference.convert("L").filter(ImageFilter.FIND_EDGES).get_flattened_data())
    right = list(candidate.convert("L").filter(ImageFilter.FIND_EDGES).get_flattened_data())
    dot = sum(a * b for a, b in zip(left, right))
    norm_left = math.sqrt(sum(value * value for value in left))
    norm_right = math.sqrt(sum(value * value for value in right))
    if norm_left == 0 and norm_right == 0:
        return 1.0
    if norm_left == 0 or norm_right == 0:
        return 0.0
    return clamp01(dot / (norm_left * norm_right))


def difference_hash(image: Image.Image) -> int:
    values = list(image.convert("L").resize((9, 8), Image.Resampling.LANCZOS).get_flattened_data())
    result = 0
    bit = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            if values[offset + column] > values[offset + column + 1]:
                result |= 1 << bit
            bit += 1
    return result


def compare_images(reference_path: Path, candidate_path: Path) -> dict[str, Any]:
    reference_sha = sha256(reference_path)
    candidate_sha = sha256(candidate_path)
    with Image.open(reference_path) as reference_source, Image.open(candidate_path) as candidate_source:
        reference_size = reference_source.size
        candidate_size = candidate_source.size
        dimensions_match = reference_size == candidate_size
        reference = reference_source.convert("RGB")
        candidate = candidate_source.convert("RGB")
        if not dimensions_match:
            candidate = candidate.resize(reference_size, Image.Resampling.LANCZOS)
        reference.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        candidate.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if candidate.size != reference.size:
            candidate = candidate.resize(reference.size, Image.Resampling.LANCZOS)

        difference = ImageChops.difference(reference, candidate)
        channel_means = ImageStat.Stat(difference).mean
        rgb_mae = sum(channel_means) / len(channel_means) / 255.0
        diff_pixels = list(difference.get_flattened_data())
        changed_fraction = sum(max(pixel) > 25 for pixel in diff_pixels) / len(diff_pixels) if diff_pixels else 0.0
        ssim = block_ssim(reference, candidate)
        histogram = histogram_intersection(reference, candidate)
        edge = edge_similarity(reference, candidate)
        dhash_distance = (difference_hash(reference) ^ difference_hash(candidate)).bit_count()
        score = 100 * (
            0.40 * ssim
            + 0.20 * (1 - rgb_mae)
            + 0.15 * histogram
            + 0.15 * edge
            + 0.10 * (1 - dhash_distance / 64)
        )
    return {
        "reference_size": list(reference_size),
        "candidate_size": list(candidate_size),
        "dimensions_match": dimensions_match,
        "exact_sha256": reference_sha == candidate_sha,
        "reference_sha256": reference_sha,
        "candidate_sha256": candidate_sha,
        "rgb_mae": round(rgb_mae, 6),
        "changed_fraction_10pct": round(changed_fraction, 6),
        "ssim": round(ssim, 6),
        "histogram_intersection": round(histogram, 6),
        "edge_similarity": round(edge, 6),
        "dhash_distance": dhash_distance,
        "score": round(score, 3),
    }


def evaluate_gates(metrics: dict[str, Any], gates: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    for gate, expected in gates.items():
        if gate.endswith("_min"):
            metric = gate[:-4]
            actual = metrics.get(metric)
            if not isinstance(actual, (int, float)) or actual < expected:
                failures.append(f"{metric}={actual!r} < {expected}")
        elif gate.endswith("_max"):
            metric = gate[:-4]
            actual = metrics.get(metric)
            if not isinstance(actual, (int, float)) or actual > expected:
                failures.append(f"{metric}={actual!r} > {expected}")
        elif metrics.get(gate) != expected:
            failures.append(f"{gate}={metrics.get(gate)!r}, expected {expected!r}")
    return failures


def merge_gates(profile: dict[str, Any], case: dict[str, Any]) -> dict[str, Any]:
    gates = dict(profile.get("gates", {}))
    gates.update(case.get("gates", {}))
    return gates


def run_benchmark(manifest: dict[str, Any], reference_root: Path, candidate_root: Path,
                  target: str, match: str | None = None, *, mode: str = "development",
                  evidence_root: Path | None = None) -> dict[str, Any]:
    if mode not in {"development", "release"}:
        raise ValueError(f"unknown benchmark mode {mode!r}")
    if mode == "release":
        if match is not None:
            raise ValueError("release mode forbids --match; evaluate the complete manifest")
        if evidence_root is None:
            raise ValueError("release mode requires the public evidence root")
        validate_manifest_evidence(manifest, load_evidence(evidence_root), release=True)
    if manifest.get("metric_version") != METRIC_VERSION:
        raise ValueError(
            f"unsupported metric_version {manifest.get('metric_version')!r}; runner supports {METRIC_VERSION}"
        )
    profiles = manifest.get("profiles")
    cases = manifest.get("cases")
    targets = manifest.get("targets", {})
    if not isinstance(profiles, dict) or not isinstance(cases, list):
        raise ValueError("manifest must contain object 'profiles' and array 'cases'")
    identifiers = [case.get("id") for case in cases]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("manifest contains duplicate case identities")
    if targets and target not in targets:
        raise ValueError(f"unknown target {target!r}; expected one of {', '.join(sorted(targets))}")
    pattern = re.compile(match) if match else None
    selected = [case for case in cases if not pattern or pattern.search(str(case.get("id", "")))]
    results: list[dict[str, Any]] = []
    for case in selected:
        profile_name = case.get("profile")
        profile = profiles.get(profile_name)
        if not isinstance(profile, dict):
            raise ValueError(f"case {case.get('id')!r} names unknown profile {profile_name!r}")
        required = bool(case.get("required", True))
        informational = bool(profile.get("informational", False)) or not required
        reference_path = reference_root / case["reference"]
        candidate_path = candidate_root / case["candidate"]
        result: dict[str, Any] = {
            "id": case.get("id"),
            "sketch": case.get("sketch"),
            "frame": case.get("frame"),
            "profile": profile_name,
            "required": required,
            "reference": str(reference_path),
            "candidate": str(candidate_path),
            "metadata": case.get("metadata", {}),
        }
        if not reference_path.is_file():
            result.update(status="invalid-reference", failures=["reference image missing"], metrics=None)
        elif sha256(reference_path) != case.get("reference_sha256"):
            result.update(status="invalid-reference", failures=["reference SHA-256 differs from manifest"], metrics=None)
        elif not candidate_path.is_file():
            result.update(
                status="informational-missing" if informational else "missing",
                failures=[] if informational else ["candidate image missing"], metrics=None,
            )
        else:
            try:
                metrics = compare_images(reference_path, candidate_path)
                failures = evaluate_gates(metrics, merge_gates(profile, case))
                status = "informational" if informational else ("passed" if not failures else "failed")
                result.update(status=status, failures=failures, metrics=metrics)
            except Exception as error:
                result.update(
                    status="informational-error" if informational else "error",
                    failures=[f"image comparison failed: {error}"], metrics=None,
                )
        results.append(result)

    required_results = [result for result in results if result["required"]]
    full_required_count = sum(bool(case.get("required", True)) for case in cases)
    present_results = [result for result in results if result["metrics"] is not None]
    required_present = [result for result in required_results if result["metrics"] is not None]
    required_passed = [result for result in required_results if result["status"] == "passed"]
    required_failed = [result for result in required_results if result["status"] != "passed"]
    scores = [result["metrics"]["score"] for result in required_present]

    by_profile: dict[str, Counter[str]] = defaultdict(Counter)
    by_renderer: dict[str, Counter[str]] = defaultdict(Counter)
    by_technique: dict[str, Counter[str]] = defaultdict(Counter)
    for result in results:
        by_profile[result["profile"]][result["status"]] += 1
        metadata = result.get("metadata") or {}
        by_renderer[str(metadata.get("renderer") or "unknown")][result["status"]] += 1
        for technique in metadata.get("techniques") or []:
            by_technique[str(technique)][result["status"]] += 1

    def counter_map(values: dict[str, Counter[str]]) -> dict[str, dict[str, int]]:
        return {key: dict(sorted(counter.items())) for key, counter in sorted(values.items())}

    summary = {
        "selected_cases": len(results),
        "required_cases": len(required_results),
        "informational_cases": len(results) - len(required_results),
        "present_candidates": len(present_results),
        "missing_candidates": sum(result["status"] in {"missing", "informational-missing"} for result in results),
        "required_passed": len(required_passed),
        "required_failed": len(required_failed),
        "coverage": round(len(required_present) / len(required_results), 6) if required_results else 0.0,
        "pass_rate": round(len(required_passed) / len(required_results), 6) if required_results else 0.0,
        "full_manifest_cases": len(cases),
        "full_manifest_required_cases": full_required_count,
        "full_manifest_coverage": round(len(required_present) / full_required_count, 6) if full_required_count else 0.0,
        "full_manifest_pass_rate": round(len(required_passed) / full_required_count, 6) if full_required_count else 0.0,
        "mean_score_present_required": round(sum(scores) / len(scores), 3) if scores else None,
        "passed": bool(required_results) and not required_failed,
        "evaluation_failures": [] if required_results else ["no required cases selected"],
    }
    summary["release_certified"] = mode == "release" and summary["passed"]
    return {
        "schema_version": 1,
        "metric_version": METRIC_VERSION,
        "mode": mode,
        "evidence": manifest.get("source", {}).get("evidence"),
        "target": target,
        "target_contract": targets.get(target),
        "manifest_summary": manifest.get("summary", {}),
        "selection": match,
        "reference_root": str(reference_root),
        "candidate_root": str(candidate_root),
        "summary": summary,
        "by_profile": counter_map(by_profile),
        "by_renderer": counter_map(by_renderer),
        "by_technique": counter_map(by_technique),
        "cases": results,
    }


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(mode="w", prefix=path.name + ".", suffix=".tmp", dir=path.parent, delete=False)
    temporary = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Visual benchmark result",
        "",
        f"Target: `{report['target']}`",
        "",
        f"Mode: **{report['mode']}**; selection: `{report['selection'] or 'all cases'}`",
        "",
        f"Selected evaluation: **{'PASS' if summary['passed'] else 'FAIL'}**; "
        f"release certified: **{'yes' if summary['release_certified'] else 'no'}**",
        "",
        f"Evaluation failures: {'; '.join(summary['evaluation_failures']) or 'none'}",
        "",
        "| measure | value |",
        "|---|---:|",
        f"| selected cases | {summary['selected_cases']} |",
        f"| required cases | {summary['required_cases']} |",
        f"| candidates present | {summary['present_candidates']} |",
        f"| missing candidates | {summary['missing_candidates']} |",
        f"| required passed | {summary['required_passed']} |",
        f"| required failed | {summary['required_failed']} |",
        f"| selected required coverage | {summary['coverage']:.1%} |",
        f"| full manifest required cases | {summary['full_manifest_required_cases']} |",
        f"| evaluated coverage of full manifest | {summary['full_manifest_coverage']:.1%} |",
        f"| evaluated pass rate of full manifest | {summary['full_manifest_pass_rate']:.1%} |",
        f"| pass rate | {summary['pass_rate']:.1%} |",
        f"| mean score, present required | {summary['mean_score_present_required'] if summary['mean_score_present_required'] is not None else '—'} |",
        "",
        "## Non-passing required cases",
        "",
        "| case | status | score | failures |",
        "|---|---|---:|---|",
    ]
    failures = [case for case in report["cases"] if case["required"] and case["status"] != "passed"]
    if failures:
        for case in failures:
            score = case["metrics"]["score"] if case["metrics"] else "—"
            reasons = "; ".join(case["failures"]).replace("|", "\\|")
            lines.append(f"| {case['id']} | {case['status']} | {score} | {reasons} |")
    else:
        lines.append("| — | — | — | — |")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("benchmarks/corpus.json"))
    parser.add_argument("--reference-root", type=Path, default=None)
    parser.add_argument("--candidate-root", type=Path, required=True)
    parser.add_argument("--target", choices=("processing-java", "p5js", "py5", "processing-android"), required=True)
    parser.add_argument("--output", type=Path, default=Path("reports/benchmark-result.json"))
    parser.add_argument("--markdown", type=Path, default=Path("reports/benchmark-result.md"))
    parser.add_argument("--match", help="run only case IDs matching this regular expression")
    parser.add_argument("--mode", choices=("development", "release"), default="development")
    parser.add_argument("--evidence-root", type=Path, default=Path("survey"),
                        help="public snapshot for release identity/completeness checks")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest_path = args.manifest.expanduser().resolve()
    manifest = json.loads(manifest_path.read_text())
    reference_root = args.reference_root
    if reference_root is None:
        configured = os.environ.get("GENART_SURVEY_ROOT") or manifest.get("source", {}).get("survey_root_hint")
        if not configured:
            raise SystemExit("reference root unavailable; pass --reference-root or set GENART_SURVEY_ROOT")
        reference_root = Path(configured)
    reference_root = reference_root.expanduser().resolve()
    candidate_root = args.candidate_root.expanduser().resolve()
    try:
        report = run_benchmark(manifest, reference_root, candidate_root, args.target, args.match,
                               mode=args.mode, evidence_root=args.evidence_root.expanduser().resolve())
    except (ValueError, OSError) as error:
        raise SystemExit(str(error)) from error
    output = args.output.expanduser().resolve()
    markdown = args.markdown.expanduser().resolve()
    atomic_json(output, report)
    markdown.parent.mkdir(parents=True, exist_ok=True)
    markdown.write_text(markdown_report(report))
    summary = report["summary"]
    print(
        f"{args.mode}: {'PASS' if summary['passed'] else 'FAIL'}: {summary['required_passed']}/{summary['required_cases']} "
        f"required cases, coverage={summary['coverage']:.1%}, "
        f"full-manifest coverage={summary['full_manifest_coverage']:.1%}, "
        f"release-certified={summary['release_certified']}, "
        f"mean_score={summary['mean_score_present_required']}"
    )
    raise SystemExit(0 if summary["passed"] else 1)


if __name__ == "__main__":
    main()
