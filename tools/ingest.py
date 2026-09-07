#!/usr/bin/env python3
"""Ingest genart-survey notes and render facts into an atomic SQLite dataset."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import sqlite3
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]

TECHNIQUES = {
    "noise-field", "flow-field", "particles", "agents", "recursion", "subdivision",
    "grid", "polar", "spiral", "voronoi-delaunay", "packing", "shader", "image-source",
    "typography", "physics", "l-system", "3d-pointcloud", "3d-mesh", "lines-hatching",
    "dots-stippling", "blend-modes", "pixel-ops", "symmetry", "distortion", "curves",
}
PRIMITIVES = {"point", "line", "ellipse", "rect", "shape", "pixels", "pgraphics", "text", "image"}
PALETTE_SELECTIONS = {"random-from-list", "lerp-between", "noise-driven", "image-sampled", "fixed"}
COMPOSITIONS = {"centered", "tiled", "full-bleed", "margins", "radial", "scattered"}
RENDERERS = {"JAVA2D", "P2D", "P3D", "PDF"}
CHANGE_SCORES = {"none", "subtle", "moderate", "large"}

SCHEMA = """
PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE sketches (
    id INTEGER PRIMARY KEY,
    sketch TEXT NOT NULL UNIQUE,
    notes_path TEXT NOT NULL UNIQUE,
    source_sha256 TEXT NOT NULL,
    frontmatter_parsed INTEGER NOT NULL CHECK (frontmatter_parsed IN (0, 1)),
    skipped TEXT,
    year INTEGER,
    renderer TEXT CHECK (renderer IS NULL OR renderer IN ('JAVA2D', 'P2D', 'P3D', 'PDF')),
    width INTEGER,
    height INTEGER,
    deterministic INTEGER CHECK (deterministic IS NULL OR deterministic IN (0, 1)),
    ms_first_frame INTEGER,
    animated INTEGER CHECK (animated IS NULL OR animated IN (0, 1)),
    composition TEXT CHECK (composition IS NULL OR composition IN ('centered', 'tiled', 'full-bleed', 'margins', 'radial', 'scattered')),
    palette_selection TEXT CHECK (palette_selection IS NULL OR palette_selection IN ('random-from-list', 'lerp-between', 'noise-driven', 'image-sampled', 'fixed')),
    raw_frontmatter TEXT,
    normalized_frontmatter_json TEXT NOT NULL,
    baseline_path TEXT,
    baseline_status TEXT,
    baseline_display TEXT,
    uses_shader INTEGER CHECK (uses_shader IS NULL OR uses_shader IN (0, 1)),
    baseline_result_json TEXT
);

CREATE TABLE sketch_libraries (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    library TEXT NOT NULL,
    PRIMARY KEY (sketch_id, ordinal),
    UNIQUE (sketch_id, library)
) WITHOUT ROWID;

CREATE TABLE sketch_techniques (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    technique TEXT NOT NULL CHECK (technique IN ('noise-field', 'flow-field', 'particles', 'agents', 'recursion', 'subdivision', 'grid', 'polar', 'spiral', 'voronoi-delaunay', 'packing', 'shader', 'image-source', 'typography', 'physics', 'l-system', '3d-pointcloud', '3d-mesh', 'lines-hatching', 'dots-stippling', 'blend-modes', 'pixel-ops', 'symmetry', 'distortion', 'curves')),
    PRIMARY KEY (sketch_id, ordinal),
    UNIQUE (sketch_id, technique)
) WITHOUT ROWID;

CREATE TABLE sketch_primitives (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    primitive TEXT NOT NULL CHECK (primitive IN ('point', 'line', 'ellipse', 'rect', 'shape', 'pixels', 'pgraphics', 'text', 'image')),
    PRIMARY KEY (sketch_id, ordinal),
    UNIQUE (sketch_id, primitive)
) WITHOUT ROWID;

CREATE TABLE palette_colors (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    color TEXT NOT NULL,
    PRIMARY KEY (sketch_id, ordinal)
) WITHOUT ROWID;

CREATE TABLE parameters (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    name TEXT,
    default_json TEXT,
    tried_json TEXT,
    change_score TEXT CHECK (change_score IS NULL OR change_score IN ('none', 'subtle', 'moderate', 'large')),
    effect TEXT,
    raw_json TEXT NOT NULL,
    PRIMARY KEY (sketch_id, ordinal)
) WITHOUT ROWID;

CREATE TABLE reusable_candidates (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    name TEXT,
    signature TEXT,
    note TEXT,
    raw_json TEXT NOT NULL,
    PRIMARY KEY (sketch_id, ordinal)
) WITHOUT ROWID;

CREATE TABLE variants (
    sketch_id INTEGER NOT NULL REFERENCES sketches(id) ON DELETE CASCADE,
    variant TEXT NOT NULL,
    result_path TEXT NOT NULL,
    status TEXT,
    diff_label TEXT CHECK (diff_label IS NULL OR diff_label IN ('none', 'subtle', 'moderate', 'large')),
    diff_mean REAL,
    diff_changed_fraction REAL,
    substitutions_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY (sketch_id, variant)
) WITHOUT ROWID;

CREATE TABLE normalizations (
    id INTEGER PRIMARY KEY,
    sketch_id INTEGER REFERENCES sketches(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    original_json TEXT NOT NULL,
    normalized_json TEXT,
    rule TEXT NOT NULL
);

CREATE TABLE ingest_issues (
    id INTEGER PRIMARY KEY,
    sketch_id INTEGER REFERENCES sketches(id) ON DELETE CASCADE,
    notes_path TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'error')),
    code TEXT NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX parameters_name_idx ON parameters(name);
CREATE INDEX parameters_change_idx ON parameters(change_score);
CREATE INDEX candidates_name_idx ON reusable_candidates(name);
CREATE INDEX variants_diff_idx ON variants(diff_label);

CREATE VIEW parameter_provenance AS
SELECT s.sketch, s.notes_path, p.ordinal, p.name, p.default_json, p.tried_json,
       p.change_score, p.effect, p.raw_json
FROM parameters p JOIN sketches s ON s.id = p.sketch_id;

CREATE VIEW candidate_provenance AS
SELECT s.sketch, s.notes_path, c.ordinal, c.name, c.signature, c.note, c.raw_json
FROM reusable_candidates c JOIN sketches s ON s.id = c.sketch_id;
"""


@dataclass
class ParsedFrontmatter:
    data: dict[str, Any] | None
    raw: str | None
    warnings: list[str] = field(default_factory=list)


def split_top(value: str) -> list[str]:
    """Split a YAML flow collection at top-level commas."""
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    escaped = False
    for char in value:
        if quote:
            current.append(char)
            if escaped:
                escaped = False
            elif char == "\\" and quote == '"':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
            current.append(char)
        elif char in "[{(":
            depth += 1
            current.append(char)
        elif char in "]})":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if current or value.strip():
        parts.append("".join(current).strip())
    return parts


def split_mapping_entry(value: str) -> tuple[str, str] | None:
    depth = 0
    quote: str | None = None
    escaped = False
    for index, char in enumerate(value):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\" and quote == '"':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char in "[{(":
            depth += 1
        elif char in "]})":
            depth -= 1
        elif char == ":" and depth == 0:
            return value[:index].strip(), value[index + 1 :].strip()
    return None


def strip_yaml_comment(line: str) -> str:
    quote: str | None = None
    escaped = False
    for index, char in enumerate(line):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\" and quote == '"':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char == "#" and (index == 0 or line[index - 1].isspace()):
            return line[:index].rstrip()
    return line.rstrip()


def parse_scalar(value: str) -> Any:
    value = value.strip()
    if not value:
        return None
    if value.startswith("[") and value.endswith("]"):
        body = value[1:-1].strip()
        return [] if not body else [parse_scalar(part) for part in split_top(body)]
    if value.startswith("{") and value.endswith("}"):
        body = value[1:-1].strip()
        result: dict[str, Any] = {}
        if not body:
            return result
        for part in split_top(body):
            entry = split_mapping_entry(part)
            if entry is None:
                raise ValueError(f"invalid inline mapping entry: {part!r}")
            key, nested = entry
            result[str(parse_scalar(key)) if key[:1] in "\"'" else key] = parse_scalar(nested)
        return result
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        try:
            return ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return value[1:-1]
    lowered = value.lower()
    if lowered in {"null", "~"}:
        return None
    if lowered in {"true", "false"}:
        return lowered == "true"
    if re.fullmatch(r"[-+]?\d+", value):
        return int(value)
    if re.fullmatch(r"[-+]?(?:\d+\.\d*|\.\d+)(?:[eE][-+]?\d+)?", value):
        return float(value)
    return value


def _parse_frontmatter_body(raw: str, line_offset: int) -> ParsedFrontmatter:
    data: dict[str, Any] = {}
    current_key: str | None = None
    warnings: list[str] = []
    recovered_parameter_list = False
    for relative_line, original in enumerate(raw.splitlines(), 1):
        line_number = line_offset + relative_line
        line = strip_yaml_comment(original)
        if not line.strip():
            continue
        if not line[0].isspace():
            entry = split_mapping_entry(line)
            if entry is None:
                warnings.append(f"line {line_number}: expected top-level key/value")
                current_key = None
                continue
            key, value = entry
            current_key = key
            try:
                data[key] = parse_scalar(value) if value else None
            except ValueError as error:
                warnings.append(f"line {line_number}: {error}")
                data[key] = value
            continue
        if current_key is None:
            warnings.append(f"line {line_number}: orphaned indented value")
            continue
        stripped = line.strip()
        try:
            if stripped.startswith("- ") or stripped == "-":
                item = parse_scalar(stripped[1:].strip())
                if data[current_key] is None:
                    data[current_key] = []
                if not isinstance(data[current_key], list):
                    parameter_keys = {"name", "default", "tried", "change", "effect"}
                    if isinstance(item, dict) and parameter_keys.intersection(item):
                        if not recovered_parameter_list:
                            warnings.append(
                                f"line {line_number}: recovered parameter list missing 'parameters:' key"
                            )
                            recovered_parameter_list = True
                        data.setdefault("parameters", [])
                        if isinstance(data["parameters"], list):
                            data["parameters"].append(item)
                        continue
                    warnings.append(f"line {line_number}: list item under non-list {current_key!r}")
                    continue
                data[current_key].append(item)
            else:
                entry = split_mapping_entry(stripped)
                if entry is None:
                    warnings.append(f"line {line_number}: expected nested key/value")
                    continue
                if data[current_key] is None:
                    data[current_key] = {}
                if not isinstance(data[current_key], dict):
                    warnings.append(f"line {line_number}: mapping entry under non-mapping {current_key!r}")
                    continue
                key, value = entry
                data[current_key][key] = parse_scalar(value)
        except ValueError as error:
            warnings.append(f"line {line_number}: {error}")
    return ParsedFrontmatter(data, raw, warnings)


def parse_frontmatter(text: str) -> ParsedFrontmatter:
    text = text.lstrip("\ufeff").replace("\r\n", "\n")
    lines = text.splitlines()
    delimiters = [index for index, line in enumerate(lines) if re.fullmatch(r"---[ \t]*", line)]
    candidates: list[tuple[int, ParsedFrontmatter]] = []
    for index in range(len(delimiters) - 1):
        start, end = delimiters[index], delimiters[index + 1]
        if end <= start + 1:
            continue
        parsed = _parse_frontmatter_body("\n".join(lines[start + 1 : end]), start + 1)
        core_fields = {
            "sketch", "year", "renderer", "size", "techniques", "primitives",
            "palette", "composition", "parameters", "reusable_candidates",
        }
        score = 10 * len(core_fields.intersection(parsed.data or {})) - 3 * len(parsed.warnings)
        candidates.append((score, parsed))
    if candidates:
        best_index = max(range(len(candidates)), key=lambda index: candidates[index][0])
        parsed = candidates[best_index][1]
        if best_index > 0:
            parsed.warnings.append("selected later valid frontmatter block after malformed content")
        return parsed

    if delimiters and delimiters[0] == 0:
        heading = next((index for index, line in enumerate(lines[1:], 1) if line.startswith("## ")), len(lines))
        if heading > 1:
            parsed = _parse_frontmatter_body("\n".join(lines[1:heading]), 1)
            parsed.warnings.append("unterminated frontmatter recovered through first Markdown heading")
            return parsed
    return ParsedFrontmatter(None, None, ["missing YAML frontmatter"])


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def optional_bool(value: Any) -> int | None:
    return int(value) if isinstance(value, bool) else None


def optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def load_json(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    if not path.is_file():
        return None, None
    try:
        value = json.loads(path.read_text(errors="replace"))
        return (value, None) if isinstance(value, dict) else (None, "JSON root is not an object")
    except (OSError, json.JSONDecodeError) as error:
        return None, str(error)


def normalize_frontmatter(data: dict[str, Any]) -> tuple[dict[str, Any], list[tuple[str, Any, Any, str]]]:
    normalized = dict(data)
    changes: list[tuple[str, Any, Any, str]] = []

    raw_techniques = as_list(data.get("techniques"))
    techniques: list[str] = []
    scattered_leak = False
    for raw in raw_techniques:
        value = str(raw)
        if value == "scattered":
            scattered_leak = True
            changes.append(("techniques", value, None, "remove composition value from technique list"))
        elif value in TECHNIQUES:
            if value not in techniques:
                techniques.append(value)
        else:
            changes.append(("techniques", value, None, "drop value outside controlled vocabulary"))
    normalized["techniques"] = techniques

    raw_primitives = as_list(data.get("primitives"))
    primitives: list[str] = []
    primitive_aliases = {"arc": "shape", "box": "shape"}
    for raw in raw_primitives:
        value = str(raw)
        mapped = primitive_aliases.get(value, value)
        if mapped != value:
            changes.append(("primitives", value, mapped, "map Processing convenience primitive to shape"))
        if mapped in PRIMITIVES:
            if mapped not in primitives:
                primitives.append(mapped)
        else:
            changes.append(("primitives", value, None, "drop value outside controlled vocabulary"))
    normalized["primitives"] = primitives

    composition = data.get("composition")
    composition_aliases = {"grid": "tiled"}
    mapped_composition = composition_aliases.get(composition, composition)
    if mapped_composition != composition:
        changes.append(("composition", composition, mapped_composition, "map layout synonym to controlled vocabulary"))
    if mapped_composition not in COMPOSITIONS:
        if mapped_composition is not None:
            changes.append(("composition", mapped_composition, None, "drop value outside controlled vocabulary"))
        mapped_composition = None
    if scattered_leak and mapped_composition is None:
        mapped_composition = "scattered"
        changes.append(("composition", composition, mapped_composition, "recover leaked composition from techniques"))
    elif scattered_leak and mapped_composition != "scattered":
        changes.append(("composition", "scattered", mapped_composition, "preserve explicit valid composition over leaked technique"))
    normalized["composition"] = mapped_composition

    palette = data.get("palette") if isinstance(data.get("palette"), dict) else {}
    normalized_palette = dict(palette)
    selection = palette.get("selection")
    if selection not in PALETTE_SELECTIONS:
        if selection is not None:
            changes.append(("palette.selection", selection, None, "drop value outside controlled vocabulary"))
        selection = None
    normalized_palette["selection"] = selection
    colors = [str(color) for color in as_list(palette.get("colors")) if color is not None]
    normalized_palette["colors"] = colors
    normalized["palette"] = normalized_palette

    renderer = data.get("renderer")
    if renderer not in RENDERERS:
        if renderer is not None:
            changes.append(("renderer", renderer, None, "drop value outside controlled vocabulary"))
        normalized["renderer"] = None

    parameters = []
    for parameter in as_list(data.get("parameters")):
        if not isinstance(parameter, dict):
            changes.append(("parameters", parameter, None, "drop non-mapping parameter record"))
            continue
        record = dict(parameter)
        score = record.get("change")
        if score not in CHANGE_SCORES:
            if score is not None:
                changes.append(("parameters.change", score, None, "drop value outside controlled vocabulary"))
            record["change"] = None
        parameters.append(record)
    normalized["parameters"] = parameters

    candidates = []
    for candidate in as_list(data.get("reusable_candidates")):
        if isinstance(candidate, dict):
            candidates.append(dict(candidate))
        else:
            changes.append(("reusable_candidates", candidate, None, "drop non-mapping candidate record"))
    normalized["reusable_candidates"] = candidates
    return normalized, changes


def insert_issue(connection: sqlite3.Connection, sketch_id: int | None, path: str,
                 severity: str, code: str, message: str) -> None:
    connection.execute(
        "INSERT INTO ingest_issues(sketch_id, notes_path, severity, code, message) VALUES (?, ?, ?, ?, ?)",
        (sketch_id, path, severity, code, message),
    )


def ingest_note(connection: sqlite3.Connection, notes_path: Path, survey_root: Path) -> None:
    text = notes_path.read_text(errors="replace")
    parsed = parse_frontmatter(text)
    relative_notes = notes_path.relative_to(survey_root).as_posix()
    inferred_sketch = notes_path.parent.relative_to(survey_root / "out").as_posix()
    source_hash = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
    source = parsed.data or {}
    normalized, changes = normalize_frontmatter(source)
    sketch = str(source.get("sketch") or inferred_sketch)

    baseline_path = notes_path.parent / "baseline" / "result.json"
    baseline, baseline_error = load_json(baseline_path)
    baseline = baseline or {}
    size = normalized.get("size")
    width = optional_int(size[0]) if isinstance(size, list) and len(size) >= 2 else None
    height = optional_int(size[1]) if isinstance(size, list) and len(size) >= 2 else None
    palette = normalized.get("palette") if isinstance(normalized.get("palette"), dict) else {}

    cursor = connection.execute(
        """INSERT INTO sketches(
               sketch, notes_path, source_sha256, frontmatter_parsed, skipped, year, renderer,
               width, height, deterministic, ms_first_frame, animated, composition,
               palette_selection, raw_frontmatter, normalized_frontmatter_json, baseline_path,
               baseline_status, baseline_display, uses_shader, baseline_result_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sketch, relative_notes, source_hash, int(parsed.data is not None),
            str(normalized.get("skipped")) if normalized.get("skipped") is not None else None,
            optional_int(normalized.get("year")), normalized.get("renderer"), width, height,
            optional_bool(normalized.get("deterministic")), optional_int(normalized.get("ms_first_frame")),
            optional_bool(normalized.get("animated")), normalized.get("composition"),
            palette.get("selection"), parsed.raw, canonical_json(normalized),
            baseline_path.relative_to(survey_root).as_posix() if baseline_path.is_file() else None,
            baseline.get("status"), baseline.get("display"), optional_bool(baseline.get("uses_shader")),
            canonical_json(baseline) if baseline else None,
        ),
    )
    sketch_id = int(cursor.lastrowid)

    for warning in parsed.warnings:
        insert_issue(connection, sketch_id, relative_notes, "error" if parsed.data is None else "warning", "frontmatter", warning)
    if baseline_error:
        insert_issue(connection, sketch_id, relative_notes, "warning", "baseline_json", baseline_error)

    if source.get("sketch") and str(source["sketch"]) != inferred_sketch:
        insert_issue(connection, sketch_id, relative_notes, "warning", "sketch_path_mismatch",
                     f"frontmatter sketch {source['sketch']!r} differs from notes directory {inferred_sketch!r}")

    for field_name, original, replacement, rule in changes:
        connection.execute(
            "INSERT INTO normalizations(sketch_id, field, original_json, normalized_json, rule) VALUES (?, ?, ?, ?, ?)",
            (sketch_id, field_name, canonical_json(original), canonical_json(replacement), rule),
        )

    def insert_ordered(table: str, column: str, values: list[Any]) -> None:
        seen: set[str] = set()
        ordinal = 0
        for raw in values:
            value = str(raw)
            if value in seen:
                continue
            seen.add(value)
            connection.execute(
                f"INSERT INTO {table}(sketch_id, ordinal, {column}) VALUES (?, ?, ?)",
                (sketch_id, ordinal, value),
            )
            ordinal += 1

    insert_ordered("sketch_libraries", "library", [value for value in as_list(normalized.get("libraries")) if value is not None])
    insert_ordered("sketch_techniques", "technique", normalized.get("techniques", []))
    insert_ordered("sketch_primitives", "primitive", normalized.get("primitives", []))
    insert_ordered("palette_colors", "color", palette.get("colors", []))

    for ordinal, record in enumerate(normalized.get("parameters", [])):
        connection.execute(
            """INSERT INTO parameters(sketch_id, ordinal, name, default_json, tried_json, change_score, effect, raw_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                sketch_id, ordinal, str(record.get("name")) if record.get("name") is not None else None,
                canonical_json(record.get("default")) if "default" in record else None,
                canonical_json(record.get("tried")) if "tried" in record else None,
                record.get("change"), str(record.get("effect")) if record.get("effect") is not None else None,
                canonical_json(record),
            ),
        )
        if not record.get("name"):
            insert_issue(connection, sketch_id, relative_notes, "warning", "empty_parameter", f"parameter {ordinal} has no name")

    for ordinal, record in enumerate(normalized.get("reusable_candidates", [])):
        connection.execute(
            """INSERT INTO reusable_candidates(sketch_id, ordinal, name, signature, note, raw_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                sketch_id, ordinal, str(record.get("name")) if record.get("name") is not None else None,
                str(record.get("signature")) if record.get("signature") is not None else None,
                str(record.get("note")) if record.get("note") is not None else None,
                canonical_json(record),
            ),
        )
        if not record.get("name"):
            insert_issue(connection, sketch_id, relative_notes, "warning", "empty_candidate", f"candidate {ordinal} has no name")

    variants_dir = notes_path.parent / "variants"
    if variants_dir.is_dir():
        for result_path in sorted(variants_dir.glob("*/result.json")):
            result, error = load_json(result_path)
            if error or result is None:
                insert_issue(connection, sketch_id, relative_notes, "warning", "variant_json",
                             f"{result_path.relative_to(survey_root)}: {error}")
                continue
            diff = result.get("diff_vs_baseline") if isinstance(result.get("diff_vs_baseline"), dict) else {}
            label = diff.get("label") if diff.get("label") in CHANGE_SCORES else None
            connection.execute(
                """INSERT INTO variants(sketch_id, variant, result_path, status, diff_label, diff_mean,
                                          diff_changed_fraction, substitutions_json, result_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    sketch_id, result_path.parent.name, result_path.relative_to(survey_root).as_posix(),
                    result.get("status"), label,
                    diff.get("mean") if isinstance(diff.get("mean"), (int, float)) else None,
                    diff.get("changed_fraction") if isinstance(diff.get("changed_fraction"), (int, float)) else None,
                    canonical_json(result.get("subs_applied") or result.get("subs") or []), canonical_json(result),
                ),
            )


def build_database(survey_root: Path, destination: Path) -> dict[str, int]:
    notes = sorted((survey_root / "out").glob("**/notes.md"))
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = tempfile.NamedTemporaryFile(prefix=destination.name + ".", suffix=".tmp", dir=destination.parent, delete=False)
    temporary_path = Path(temporary.name)
    temporary.close()
    try:
        connection = sqlite3.connect(temporary_path)
        try:
            connection.executescript(SCHEMA)
            connection.execute("BEGIN")
            metadata = {
                "schema_version": "1",
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "survey_root": "survey" if survey_root == (PROJECT_ROOT / "survey").resolve() else str(survey_root),
                "notes_discovered": str(len(notes)),
            }
            connection.executemany("INSERT INTO metadata(key, value) VALUES (?, ?)", metadata.items())
            for notes_path in notes:
                ingest_note(connection, notes_path, survey_root)
            connection.commit()
            integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity != "ok":
                raise RuntimeError(f"SQLite integrity check failed: {integrity}")
            counts = {
                table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                for table in ("sketches", "parameters", "reusable_candidates", "variants", "normalizations", "ingest_issues")
            }
        finally:
            connection.close()
        os.replace(temporary_path, destination)
        return counts
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--survey-root", type=Path, default=PROJECT_ROOT / "survey")
    parser.add_argument("--database", type=Path, default=PROJECT_ROOT / "data" / "corpus.sqlite")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    survey_root = args.survey_root.expanduser().resolve()
    database = args.database.expanduser().resolve()
    if not (survey_root / "out").is_dir():
        raise SystemExit(f"survey output not found: {survey_root / 'out'}")
    counts = build_database(survey_root, database)
    rendered = ", ".join(f"{key}={value}" for key, value in counts.items())
    print(f"wrote {database}: {rendered}")


if __name__ == "__main__":
    main()
