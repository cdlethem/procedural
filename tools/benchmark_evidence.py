"""Public evidence identity and expected frames shared by manifest publication and release checks."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

try:
    from .ingest import normalize_frontmatter, parse_frontmatter
except ImportError:  # direct script invocation through tools/benchmark.py
    from ingest import normalize_frontmatter, parse_frontmatter


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def value_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False).encode()).hexdigest()


def frame_ids(record: dict[str, Any], label: str) -> set[int]:
    frames = record.get("frames", [])
    if not isinstance(frames, list):
        raise ValueError(f"{label}: frames must be an array")
    result: set[int] = set()
    for frame in frames:
        number = frame.get("frame") if isinstance(frame, dict) else None
        # Survey self-exports use -1 (and may repeat it); they are not frame_NNNNN.png
        # captures and have never belonged to the corpus benchmark path contract.
        if type(number) is int and number == -1:
            continue
        if type(number) is not int or number < 0 or number in result:
            raise ValueError(f"{label}: invalid or duplicate frame identity {number!r}")
        result.add(number)
    return result


def load_evidence(root: Path) -> dict[str, Any]:
    """Read text/JSON only. Missing reports are tracked; malformed identity fails closed."""
    snapshot_path = root / "snapshot.json"
    index_path = root / "out" / "index.jsonl"
    snapshot = json.loads(snapshot_path.read_text())
    index: dict[str, dict[str, Any]] = {}
    for line in index_path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        sketch = row.get("sketch")
        if not isinstance(sketch, str) or not sketch or sketch in index:
            raise ValueError(f"index: invalid or duplicate sketch identity {sketch!r}")
        index[sketch] = row
    targets = sorted(key for key, row in index.items()
                     if row.get("generative") is True and row.get("status") == "ok")
    notes: dict[str, str] = {}
    baselines: dict[str, dict[str, Any]] = {}
    expected: dict[str, dict[str, Any]] = {}
    stubs: dict[str, str] = {}
    records = {"snapshot.json": file_hash(snapshot_path), "out/index.jsonl": file_hash(index_path)}
    for path in sorted((root / "out").rglob("notes.md")):
        sketch = path.parent.relative_to(root / "out").as_posix()
        text = path.read_text(errors="replace")
        parsed = parse_frontmatter(text)
        if parsed.data is None:
            raise ValueError(f"{sketch}: unreadable note frontmatter")
        if str(parsed.data.get("sketch") or sketch) != sketch:
            raise ValueError(f"{sketch}: frontmatter identity differs from note path")
        normalized, _ = normalize_frontmatter(parsed.data)
        notes[sketch] = hashlib.sha256(text.encode()).hexdigest()
        records[path.relative_to(root).as_posix()] = file_hash(path)
        baseline_path = path.parent / "baseline" / "result.json"
        baseline = json.loads(baseline_path.read_text()) if baseline_path.is_file() else {}
        if not isinstance(baseline, dict):
            raise ValueError(f"{sketch}: baseline result must be an object")
        baselines[sketch] = baseline
        if baseline_path.is_file():
            records[baseline_path.relative_to(root).as_posix()] = file_hash(baseline_path)
        if normalized.get("skipped") is not None:
            stubs[sketch] = str(normalized["skipped"])
            continue
        frames = frame_ids(index.get(sketch, {}), f"{sketch} index") | frame_ids(baseline, f"{sketch} baseline")
        if not frames:
            raise ValueError(f"{sketch}: no expected baseline frame identities in public metadata")
        suspect = baseline.get("uses_shader") is True and baseline.get("display") == "xvfb"
        profile = "suspect-shader" if suspect else (
            "portable-nondeterministic" if normalized.get("deterministic") is False
            else "portable-deterministic"
        )
        for frame in sorted(frames):
            identifier = f"{sketch}::frame_{frame:05d}"
            expected[identifier] = {"sketch": sketch, "frame": frame, "profile": profile,
                                    "required": not suspect}
    if not targets:
        raise ValueError("public index has no target identities")
    declared_counts = snapshot.get("counts", {})
    observed_counts = {
        "notes": len(notes),
        "baseline_results": len(list((root / "out").rglob("baseline/result.json"))),
        "variant_results": len(list((root / "out").rglob("variants/*/result.json"))),
    }
    for field, observed in observed_counts.items():
        declared = declared_counts.get(field) if isinstance(declared_counts, dict) else None
        if declared is not None and declared != observed:
            raise ValueError(f"snapshot {field} count differs from published files ({declared} != {observed})")
    if snapshot.get("counts", {}).get("notes") != len(notes):
        raise ValueError("snapshot report count differs from actual note paths")
    extra = sorted(set(notes) - set(targets))
    if extra:
        raise ValueError(f"unexpected report identities outside target set: {extra[:5]}")
    return {
        "identity": {
            "survey_revision": snapshot.get("survey_revision"),
            "snapshot_sha256": records["snapshot.json"],
            "index_sha256": records["out/index.jsonl"],
            "evidence_sha256": value_hash(records),
            "target_ids_sha256": value_hash(targets),
            "target_count": len(targets),
            "report_count": len(notes),
            "missing_reports": sorted(set(targets) - set(notes)),
            "stub_count": len(stubs),
            "expected_cases_sha256": value_hash(expected),
            "expected_cases": len(expected),
        },
        "notes": notes, "baselines": baselines, "expected": expected, "stubs": stubs,
    }


def validate_manifest_evidence(manifest: dict[str, Any], evidence: dict[str, Any],
                               *, release: bool = False) -> None:
    """A selected or stale manifest cannot certify coverage of the public evidence."""
    if manifest.get("source", {}).get("evidence") != evidence["identity"]:
        raise ValueError("manifest evidence is missing or stale; regenerate against the public snapshot")
    if release and evidence["identity"]["missing_reports"]:
        raise ValueError("release requires the full target report set; use development mode for this snapshot")
    cases = manifest.get("cases", [])
    actual = {case.get("id"): case for case in cases}
    if len(actual) != len(cases) or set(actual) != set(evidence["expected"]):
        raise ValueError("manifest frame identities differ from public evidence")
    for identifier, expected in evidence["expected"].items():
        case = actual[identifier]
        if any(case.get(key) != value for key, value in expected.items()):
            raise ValueError(f"{identifier}: manifest frame/profile/required status differs from public evidence")
        stem = f"frame_{expected['frame']:05d}.png"
        if (case.get("reference") != f"out/{expected['sketch']}/baseline/{stem}"
                or case.get("candidate") != f"{expected['sketch']}/{stem}"):
            raise ValueError(f"{identifier}: reference/candidate path differs from frame identity")
    exclusions = {row.get("sketch"): row.get("reason") for row in manifest.get("excluded", [])}
    expected_exclusions = {sketch: f"survey stub: {reason}" for sketch, reason in evidence["stubs"].items()}
    if exclusions != expected_exclusions or len(exclusions) != len(manifest.get("excluded", [])):
        raise ValueError("manifest exclusions differ from public stub evidence")
    required = sum(case["required"] for case in evidence["expected"].values())
    if (manifest.get("summary", {}).get("cases") != len(actual)
            or manifest.get("summary", {}).get("required_cases") != required):
        raise ValueError("manifest summary differs from expected frame coverage")
