#!/usr/bin/env python3
"""Build a portable visual-conformance manifest from the ingested survey corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import struct
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

PROFILES = {
    "exact": {
        "description": "Reference-renderer equality gate",
        "gates": {"dimensions_match": True, "exact_sha256": True},
    },
    "portable-deterministic": {
        "description": "Cross-renderer gate for deterministic sketches",
        "gates": {
            "dimensions_match": True,
            "score_min": 75.0,
            "ssim_min": 0.70,
            "histogram_intersection_min": 0.70,
        },
    },
    "portable-nondeterministic": {
        "description": "Distribution/structure gate where the stored baseline is non-deterministic",
        "gates": {
            "dimensions_match": True,
            "score_min": 60.0,
            "histogram_intersection_min": 0.65,
            "edge_similarity_min": 0.35,
        },
    },
    "suspect-shader": {
        "description": "Informational only: reference shader rendered under Xvfb",
        "informational": True,
        "gates": {},
    },
}

TARGETS = {
    "processing-java": {
        "label": "Processing 4 desktop reference",
        "runtime": "Java / Processing 4",
        "adapter": "JAVA2D, P2D, and P3D",
    },
    "p5js": {
        "label": "p5.js web port",
        "runtime": "JavaScript or TypeScript in a browser",
        "adapter": "Canvas2D and WebGL",
    },
    "py5": {
        "label": "py5 Python port",
        "runtime": "Python with py5/JVM",
        "adapter": "py5 drawing surface",
    },
    "processing-android": {
        "label": "Processing for Android port",
        "runtime": "Android Mode / Processing for Android",
        "adapter": "Android 2D and OpenGL ES",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError("not a PNG with an IHDR header")
    return struct.unpack(">II", header[16:24])


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


def build_manifest(database: Path, survey_root: Path, database_label: str | None = None) -> dict[str, Any]:
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        metadata = dict(connection.execute("SELECT key, value FROM metadata"))
        technique_map: dict[int, list[str]] = defaultdict(list)
        for sketch_id, technique in connection.execute(
            "SELECT sketch_id, technique FROM sketch_techniques ORDER BY sketch_id, ordinal"
        ):
            technique_map[sketch_id].append(technique)
        rows = list(
            connection.execute(
                """SELECT id, sketch, notes_path, skipped, renderer, width, height, deterministic,
                          animated, composition, baseline_display, uses_shader, baseline_result_json
                   FROM sketches ORDER BY sketch"""
            )
        )
    finally:
        connection.close()

    cases: list[dict[str, Any]] = []
    excluded: list[dict[str, str]] = []
    for row in rows:
        if row["skipped"] is not None:
            excluded.append({"sketch": row["sketch"], "reason": f"survey stub: {row['skipped']}"})
            continue
        baseline_dir = survey_root / "out" / row["sketch"] / "baseline"
        frames = sorted(baseline_dir.glob("frame_*.png")) if baseline_dir.is_dir() else []
        if not frames:
            excluded.append({"sketch": row["sketch"], "reason": "no baseline frame"})
            continue
        baseline_result = json.loads(row["baseline_result_json"]) if row["baseline_result_json"] else {}
        suspect_shader = row["uses_shader"] == 1 and row["baseline_display"] == "xvfb"
        profile = "suspect-shader" if suspect_shader else (
            "portable-nondeterministic" if row["deterministic"] == 0 else "portable-deterministic"
        )
        for frame_path in frames:
            match = re.fullmatch(r"frame_(\d+)\.png", frame_path.name)
            if not match:
                continue
            try:
                width, height = png_size(frame_path)
            except ValueError as error:
                excluded.append({"sketch": row["sketch"], "reason": f"{frame_path.name}: {error}"})
                continue
            reference = frame_path.relative_to(survey_root).as_posix()
            candidate = (Path(row["sketch"]) / frame_path.name).as_posix()
            cases.append(
                {
                    "id": f"{row['sketch']}::{frame_path.stem}",
                    "sketch": row["sketch"],
                    "frame": int(match.group(1)),
                    "reference": reference,
                    "candidate": candidate,
                    "reference_sha256": sha256(frame_path),
                    "reference_bytes": frame_path.stat().st_size,
                    "width": width,
                    "height": height,
                    "seed": baseline_result.get("seed", 42),
                    "profile": profile,
                    "required": not PROFILES[profile].get("informational", False),
                    "metadata": {
                        "notes_path": row["notes_path"],
                        "renderer": row["renderer"],
                        "deterministic": None if row["deterministic"] is None else bool(row["deterministic"]),
                        "animated": None if row["animated"] is None else bool(row["animated"]),
                        "composition": row["composition"],
                        "techniques": technique_map[row["id"]],
                        "baseline_display": row["baseline_display"],
                        "uses_shader": None if row["uses_shader"] is None else bool(row["uses_shader"]),
                    },
                }
            )

    profile_counts = Counter(case["profile"] for case in cases)
    return {
        "schema_version": 1,
        "source": {
            "database": database_label or database.name,
            "database_schema_version": metadata.get("schema_version"),
            "database_generated_at_utc": metadata.get("generated_at_utc"),
            "survey_root_hint": None,
        },
        "path_contract": {
            "reference_root": "Pass --reference-root or set GENART_SURVEY_ROOT; reference paths are relative to it.",
            "candidate_root": "Pass --candidate-root; candidate paths are relative to it.",
            "candidate_layout": "<candidate-root>/<sketch>/frame_NNNNN.png",
        },
        "metric_version": 1,
        "targets": TARGETS,
        "profiles": PROFILES,
        "summary": {
            "cases": len(cases),
            "required_cases": sum(case["required"] for case in cases),
            "informational_cases": sum(not case["required"] for case in cases),
            "sketches": len({case["sketch"] for case in cases}),
            "excluded_sketches": len(excluded),
            "profiles": dict(sorted(profile_counts.items())),
        },
        "cases": cases,
        "excluded": excluded,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=Path("data/corpus.sqlite"))
    parser.add_argument("--survey-root", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=Path("benchmarks/corpus.json"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = args.database.expanduser().resolve()
    if not database.is_file():
        raise SystemExit(f"database not found: {database}; run tools/ingest.py first")
    survey_root = args.survey_root
    if survey_root is None:
        connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
        try:
            value = connection.execute("SELECT value FROM metadata WHERE key = 'survey_root'").fetchone()
        finally:
            connection.close()
        if value is None:
            raise SystemExit("database has no survey_root metadata; pass --survey-root")
        survey_root = Path(value[0])
    survey_root = survey_root.expanduser().resolve()
    manifest = build_manifest(database, survey_root, args.database.as_posix())
    output = args.output.expanduser().resolve()
    atomic_json(output, manifest)
    summary = manifest["summary"]
    print(
        f"wrote {output}: cases={summary['cases']}, required={summary['required_cases']}, "
        f"informational={summary['informational_cases']}, sketches={summary['sketches']}, "
        f"excluded={summary['excluded_sketches']}"
    )


if __name__ == "__main__":
    main()
