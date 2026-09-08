#!/usr/bin/env python3
"""Build a provenance-preserving inventory for Phase 2 evidence review.

The inventory is deliberately an evidence index rather than a clustering result.  A
candidate is identified by its notes-directory sketch path and source ordinal.  The
SQLite database is opened read-only; the checked-in notes and index remain the source
of truth for paths and hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:  # Works both as ``uv run python tools/...`` and as an imported module in tests.
    from tools.ingest import TECHNIQUES, parse_frontmatter
except ModuleNotFoundError:  # pragma: no cover - exercised by the CLI invocation
    from ingest import TECHNIQUES, parse_frontmatter


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())


def portable_path(path: Path, label: str) -> str:
    """Represent repository paths portably and external inputs without host paths."""
    try:
        return path.resolve().relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return f"${{{label}}}"


def result_file_summary(path: Path, survey_root: Path, *, variant: str | None = None) -> dict[str, Any]:
    """Capture a result file's hash and small metadata, including malformed files."""
    raw = path.read_bytes()
    entry: dict[str, Any] = {
        "result_path": path.relative_to(survey_root).as_posix(),
        "source_sha256": sha256_bytes(raw),
    }
    if variant is not None:
        entry["variant"] = variant
    try:
        payload = json.loads(raw.decode("utf-8", errors="replace"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        entry.update({"status": "invalid_json", "error": str(error)})
        return entry
    if not isinstance(payload, dict):
        entry.update({"status": "invalid_root", "error": "result JSON root is not an object"})
        return entry
    diff = payload.get("diff_vs_baseline") if isinstance(payload.get("diff_vs_baseline"), dict) else {}
    entry.update({
        "status": payload.get("status"),
        "detail": payload.get("detail"),
        "diff_label": diff.get("label"),
        "diff_mean": diff.get("mean"),
        "diff_changed_fraction": diff.get("changed_fraction"),
        "substitutions": payload.get("subs_applied") or payload.get("subs") or [],
    })
    if variant is None:
        entry.update({
            "display": payload.get("display"), "uses_shader": payload.get("uses_shader"),
            "deterministic": payload.get("deterministic"), "animated": payload.get("animated"),
            "frame_count": len(payload.get("frames", [])) if isinstance(payload.get("frames"), list) else None,
        })
    return entry


def published_result_files(survey_root: Path) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], list[str]]:
    """Index all baseline and variant result files, including files ingestion skipped."""
    out_root = survey_root / "out"
    baselines: dict[str, dict[str, Any]] = {}
    variants: dict[str, list[dict[str, Any]]] = defaultdict(list)
    errors: list[str] = []
    for path in sorted(out_root.glob("**/baseline/result.json")):
        try:
            sketch = path.parent.parent.relative_to(out_root).as_posix()
            baselines[sketch] = result_file_summary(path, survey_root)
        except OSError as error:
            errors.append(f"{path}: {error}")
    for path in sorted(out_root.glob("**/variants/*/result.json")):
        try:
            sketch = path.parent.parent.parent.relative_to(out_root).as_posix()
            variants[sketch].append(result_file_summary(path, survey_root, variant=path.parent.name))
        except OSError as error:
            errors.append(f"{path}: {error}")
    return baselines, variants, errors


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return None


def compact_json(value: Any) -> Any:
    """Decode JSON columns while retaining malformed values as text."""
    if value is None or not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def is_target_record(record: dict[str, Any]) -> bool:
    """Use the published target flags, never infer membership from folder spelling."""
    return record.get("generative") is True and record.get("status") == "ok"


def load_index(path: Path) -> tuple[list[str], list[str], int]:
    """Return sorted successful generative target identities, errors, duplicates."""
    identities: list[str] = []
    errors: list[str] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            errors.append(f"line {line_number}: {error}")
            continue
        sketch = record.get("sketch") if isinstance(record, dict) else None
        if not isinstance(sketch, str) or not sketch:
            errors.append(f"line {line_number}: missing string sketch identity")
            continue
        if is_target_record(record):
            identities.append(sketch)
    duplicates = len(identities) - len(set(identities))
    return sorted(set(identities)), errors, duplicates


def note_sketch(note_path: Path, out_root: Path) -> str:
    return note_path.parent.relative_to(out_root).as_posix()


def open_readonly(database: Path) -> sqlite3.Connection:
    # URI mode prevents an accidental inventory run from creating or changing a DB.
    connection = sqlite3.connect(f"file:{database.resolve()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone() is not None


def note_metadata(survey_root: Path) -> tuple[dict[str, dict[str, Any]], list[str]]:
    out_root = survey_root / "out"
    notes: dict[str, dict[str, Any]] = {}
    errors: list[str] = []
    for path in sorted(out_root.glob("**/notes.md")):
        sketch = note_sketch(path, out_root)
        try:
            raw = path.read_bytes()
            text = raw.decode("utf-8", errors="replace")
        except OSError as error:
            errors.append(f"{path}: {error}")
            continue
        parsed = parse_frontmatter(text)
        notes[sketch] = {
            "notes_path": path.relative_to(survey_root).as_posix(),
            "source_sha256": sha256_bytes(raw),
            "frontmatter": parsed.data,
            "frontmatter_warnings": parsed.warnings,
        }
    return notes, errors


def _db_sketch_rows(connection: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    if not table_exists(connection, "sketches"):
        return {}
    rows = connection.execute("SELECT * FROM sketches").fetchall()
    result: dict[str, sqlite3.Row] = {}
    for row in rows:
        notes_path = row["notes_path"]
        if isinstance(notes_path, str) and notes_path.startswith("out/") and notes_path.endswith("/notes.md"):
            result[notes_path[4:-9]] = row
    return result


def _json_record(value: Any) -> Any:
    return compact_json(value) if isinstance(value, str) else value


def build_inventory(
    survey_root: Path,
    database: Path,
    previous: Path | None = None,
) -> dict[str, Any]:
    """Build the complete serializable evidence inventory."""
    survey_root = survey_root.resolve()
    snapshot_path = survey_root / "snapshot.json"
    snapshot = read_json(snapshot_path)
    snapshot_error: str | None = None
    if not isinstance(snapshot, dict):
        snapshot_error = "snapshot JSON is missing or not an object"
        snapshot = {}
    snapshot_revision = str(snapshot.get("survey_revision") or sha256_bytes(snapshot_path.read_bytes() if snapshot_path.is_file() else b""))
    index_path = survey_root / "out" / "index.jsonl"
    index_identities, index_errors, index_duplicates = load_index(index_path)
    notes, note_errors = note_metadata(survey_root)
    baselines, published_variants, result_file_errors = published_result_files(survey_root)

    db_rows: dict[str, sqlite3.Row] = {}
    db_issues: dict[str, list[dict[str, Any]]] = defaultdict(list)
    db_normalizations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    parameter_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    variant_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    technique_rows: dict[str, list[str]] = defaultdict(list)
    db_metadata: dict[str, str] = {}
    database_error: str | None = None
    db_table_counts: dict[str, int] = {}
    db_missing_tables: list[str] = []
    required_tables = ("metadata", "sketches", "parameters", "reusable_candidates", "variants", "normalizations", "ingest_issues")
    try:
        connection = open_readonly(database)
    except (OSError, sqlite3.Error) as error:
        connection = None
        database_error = str(error)
    if connection is not None:
        try:
            db_missing_tables = [table for table in required_tables if not table_exists(connection, table)]
            db_table_counts = {
                table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                for table in required_tables if table not in db_missing_tables
            }
            db_rows = _db_sketch_rows(connection)
            if table_exists(connection, "metadata"):
                db_metadata = dict(connection.execute("SELECT key, value FROM metadata"))
                if db_metadata.get("survey_root", "").startswith("/"):
                    db_metadata["survey_root"] = "${SURVEY_ROOT}"
            if table_exists(connection, "ingest_issues"):
                for row in connection.execute(
                    "SELECT notes_path, severity, code, message FROM ingest_issues ORDER BY notes_path, id"
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9] if path.startswith("out/") and path.endswith("/notes.md") else path
                    db_issues[sketch].append({"severity": row["severity"], "code": row["code"], "message": row["message"]})
            if table_exists(connection, "normalizations"):
                for row in connection.execute(
                    """SELECT s.notes_path, n.field, n.original_json, n.normalized_json, n.rule
                       FROM normalizations n JOIN sketches s ON s.id=n.sketch_id ORDER BY s.notes_path, n.id"""
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9] if path.startswith("out/") and path.endswith("/notes.md") else path
                    db_normalizations[sketch].append({
                        "field": row["field"], "original": _json_record(row["original_json"]),
                        "normalized": _json_record(row["normalized_json"]), "rule": row["rule"],
                    })
            if table_exists(connection, "parameters"):
                for row in connection.execute(
                    """SELECT s.notes_path, p.ordinal, p.name, p.default_json, p.tried_json,
                              p.change_score, p.effect, p.raw_json
                       FROM parameters p JOIN sketches s ON s.id=p.sketch_id ORDER BY s.notes_path, p.ordinal"""
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9:] if path.startswith("out/") and path.endswith("/notes.md") else path
                    parameter_rows[sketch].append({
                        "ordinal": row["ordinal"], "name": row["name"],
                        "default": _json_record(row["default_json"]), "tried": _json_record(row["tried_json"]),
                        "change": row["change_score"], "effect": row["effect"],
                        "raw_record": _json_record(row["raw_json"]),
                    })
            if table_exists(connection, "sketch_techniques"):
                for row in connection.execute(
                    """SELECT s.notes_path, t.ordinal, t.technique
                       FROM sketch_techniques t JOIN sketches s ON s.id=t.sketch_id
                       ORDER BY s.notes_path, t.ordinal"""
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9:] if path.startswith("out/") and path.endswith("/notes.md") else path
                    technique_rows[sketch].append(row["technique"])
            if table_exists(connection, "variants"):
                for row in connection.execute(
                    """SELECT s.notes_path, v.variant, v.result_path, v.status, v.diff_label,
                              v.diff_mean, v.diff_changed_fraction, v.substitutions_json
                       FROM variants v JOIN sketches s ON s.id=v.sketch_id ORDER BY s.notes_path, v.variant"""
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9:] if path.startswith("out/") and path.endswith("/notes.md") else path
                    variant_rows[sketch].append({
                        "variant": row["variant"], "result_path": row["result_path"], "status": row["status"],
                        "diff_label": row["diff_label"], "diff_mean": row["diff_mean"],
                        "diff_changed_fraction": row["diff_changed_fraction"],
                        "substitutions": _json_record(row["substitutions_json"]),
                    })
            # Candidate rows are consumed below while the connection is open.
            candidate_rows: dict[str, list[sqlite3.Row]] = defaultdict(list)
            if table_exists(connection, "reusable_candidates"):
                for row in connection.execute(
                    """SELECT s.notes_path, c.ordinal, c.name, c.signature, c.note, c.raw_json
                       FROM reusable_candidates c JOIN sketches s ON s.id=c.sketch_id
                       ORDER BY s.notes_path, c.ordinal"""
                ):
                    path = row["notes_path"]
                    sketch = path[4:-9:] if path.startswith("out/") and path.endswith("/notes.md") else path
                    candidate_rows[sketch].append(row)
            connection.close()
        except Exception:
            connection.close()
            raise
    else:
        candidate_rows = defaultdict(list)

    # The normalized DB intentionally omits malformed result JSON.  Reconcile its
    # rows with the published files so that skipped/invalid evidence remains visible.
    db_variants_by_sketch = {
        sketch: {entry["variant"]: entry for entry in entries}
        for sketch, entries in variant_rows.items()
    }
    for sketch, files in published_variants.items():
        merged: list[dict[str, Any]] = []
        db_for_sketch = db_variants_by_sketch.get(sketch, {})
        for file_entry in files:
            db_entry = db_for_sketch.get(file_entry["variant"], {})
            merged_entry = dict(file_entry)
            # The DB is the normalized interpretation; file hash/status remains the
            # source-level evidence and is always retained.
            for key in ("diff_label", "diff_mean", "diff_changed_fraction", "substitutions"):
                if key in db_entry and db_entry[key] is not None and file_entry.get(key) in (None, [], ""):
                    merged_entry[key] = db_entry[key]
            merged.append(merged_entry)
        for variant, db_entry in db_for_sketch.items():
            if not any(item.get("variant") == variant for item in merged):
                missing_entry = dict(db_entry)
                missing_entry.update({"source_sha256": None, "error": "database row has no published result file"})
                merged.append(missing_entry)
        variant_rows[sketch] = sorted(merged, key=lambda item: item.get("variant", ""))
    for sketch, db_for_sketch in db_variants_by_sketch.items():
        if sketch not in published_variants:
            variant_rows[sketch] = [
                dict(entry, source_sha256=None, error="database row has no published result file")
                for entry in db_for_sketch.values()
            ]

    candidate_dossiers: list[dict[str, Any]] = []
    sketch_contexts: dict[str, dict[str, Any]] = {}
    families: dict[str, dict[str, int]] = {family: {"sketches": 0, "candidates": 0} for family in sorted(TECHNIQUES)}
    all_sketches = sorted(set(index_identities) | set(notes) | set(db_rows) | set(candidate_rows) | set(baselines) | set(published_variants))
    for sketch in all_sketches:
        note = notes.get(sketch)
        frontmatter = note.get("frontmatter") if note else None
        techniques = technique_rows.get(sketch) or (frontmatter.get("techniques", []) if isinstance(frontmatter, dict) else [])
        if not isinstance(techniques, list):
            techniques = [techniques]
        techniques = [str(value) for value in techniques]
        db_sketch = db_rows.get(sketch)
        stale_hash = bool(db_sketch and note and db_sketch["source_sha256"] != note["source_sha256"])
        warnings = list(note.get("frontmatter_warnings", [])) if note else ["notes file missing"]
        warnings.extend(issue["code"] + ": " + issue["message"] for issue in db_issues.get(sketch, []))
        if stale_hash:
            warnings.append("stale_database_hash: SQLite source_sha256 differs from current notes.md")
        if sketch not in index_identities:
            warnings.append("extra_notes_identity: not present in index.jsonl")
        if sketch in index_identities and sketch not in notes:
            warnings.append("missing_notes_file: index identity has no notes.md")
        baseline = baselines.get(sketch)
        deterministic = db_sketch["deterministic"] if db_sketch else baseline.get("deterministic") if baseline else None
        if deterministic is False or deterministic == 0:
            warnings.append("reliability: baseline is non-deterministic; small visual changes are weak evidence")
        elif deterministic is None:
            warnings.append("reliability: deterministic status unknown")
        if baseline and baseline.get("uses_shader") is True and baseline.get("display") == "xvfb":
            warnings.append("reliability: shader baseline rendered under Xvfb; visual evidence is suspect")
        if db_sketch and db_sketch["skipped"] is not None:
            warnings.append(f"reliability: stub/unrenderable report ({db_sketch['skipped']})")
        rows = candidate_rows.get(sketch, [])
        candidate_like_parameters: list[dict[str, Any]] = []
        if isinstance(frontmatter, dict):
            raw_parameters = frontmatter.get("parameters", [])
            if not isinstance(raw_parameters, list):
                raw_parameters = [raw_parameters]
            for ordinal, parameter in enumerate(raw_parameters):
                if isinstance(parameter, dict) and any(key in parameter for key in ("signature", "note", "reusable_candidate", "candidate")):
                    candidate_like_parameters.append({"ordinal": ordinal, "name": parameter.get("name"), "keys": sorted(parameter)})
                    warnings.append(f"data_quality: parameter {ordinal} contains candidate-like fields (signature/note); review placement")
        if any(entry.get("change") is None for entry in parameter_rows.get(sketch, [])):
            warnings.append("reliability: one or more parameter measurements are invalid or unscored")
        if any(not entry.get("tried") for entry in parameter_rows.get(sketch, [])):
            warnings.append("reliability: one or more parameter records have no trials; a change label alone is not measured sensitivity")
        if not baseline:
            warnings.append("reliability: baseline result metadata is missing")
        if any(entry.get("status") in {"invalid_json", "invalid_root"} for entry in variant_rows.get(sketch, [])):
            warnings.append("data_quality: one or more published variant result files are malformed")
        context_hash = sha256_json({
            "notes_sha256": note.get("source_sha256") if note else None,
            "baseline": baseline,
            "parameters": parameter_rows.get(sketch, []),
            "variants": variant_rows.get(sketch, []),
            "warnings": sorted(set(warnings)),
            "normalizations": db_normalizations.get(sketch, []),
        })
        sketch_contexts[sketch] = {
            "notes_path": note.get("notes_path") if note else db_sketch["notes_path"] if db_sketch else None,
            "notes_sha256": note.get("source_sha256") if note else None,
            "database_source_sha256": db_sketch["source_sha256"] if db_sketch else None,
            "frontmatter_parsed": bool(db_sketch["frontmatter_parsed"]) if db_sketch else bool(frontmatter),
            "skipped": db_sketch["skipped"] if db_sketch else None,
            "context_hash": context_hash,
            "baseline": baseline,
            "techniques": techniques,
            "parameters": parameter_rows.get(sketch, []),
            "parameter_association": "sketch-level only; no direct candidate-to-parameter link is asserted",
            "variants": variant_rows.get(sketch, []),
            "warnings": sorted(set(warnings)),
            "normalizations": db_normalizations.get(sketch, []),
            "candidate_like_parameters": candidate_like_parameters,
        }
        for row in rows:
            ordinal = int(row["ordinal"])
            raw_record = _json_record(row["raw_json"])
            content_hash = sha256_json(raw_record)
            dossier_hash = sha256_json({
                "sketch": sketch, "ordinal": ordinal, "candidate": raw_record,
                "notes_sha256": note.get("source_sha256") if note else None,
                "context_hash": context_hash,
            })
            candidate_dossiers.append({
                "identity": f"{sketch}#{ordinal}",
                "snapshot_revision": snapshot_revision,
                "sketch": sketch,
                "ordinal": ordinal,
                "dossier_hash": dossier_hash,
                "candidate_content_hash": content_hash,
                "notes_path": note.get("notes_path") if note else db_sketch["notes_path"] if db_sketch else None,
                "notes_sha256": note.get("source_sha256") if note else None,
                "database_source_sha256": db_sketch["source_sha256"] if db_sketch else None,
                "context_hash": context_hash,
                "name": row["name"], "signature": row["signature"], "note": row["note"],
                "raw_record": raw_record,
                # Preserve the database's original JSON record text alongside the
                # decoded convenience object; the full notes prose stays referenced
                # by notes_path and notes_sha256 rather than duplicated per candidate.
                "raw_record_json": row["raw_json"],
                "techniques": techniques,
                "context_ref": sketch,
                "parameter_association": "sketch-level only; see sketch_contexts[context_ref]; no direct candidate-to-parameter link is asserted",
                "warnings": sorted(set(warnings)),
            })
            for family in techniques:
                if family in families:
                    families[family]["candidates"] += 1

        for family in techniques:
            if family in families:
                families[family]["sketches"] += 1

    candidate_dossiers.sort(key=lambda item: (item["sketch"], item["ordinal"]))
    current_by_identity = {item["identity"]: item for item in candidate_dossiers}
    note_records = {
        sketch: {"notes_path": context.get("notes_path"), "source_sha256": context.get("notes_sha256"), "context_hash": context.get("context_hash")}
        for sketch, context in sketch_contexts.items() if context.get("notes_sha256")
    }
    delta: dict[str, Any] = {"available": bool(previous), "snapshot_changed": False, "added": [], "changed": [], "removed": [], "ordinal_drift": [], "notes": {"added": [], "changed": [], "removed": []}}
    previous_data = read_json(previous) if previous else None
    previous_entries = previous_data.get("candidates", []) if isinstance(previous_data, dict) else []
    previous_by_identity = {
        item.get("identity"): item for item in previous_entries
        if isinstance(item, dict) and item.get("identity")
    }
    if previous:
        delta["snapshot_changed"] = previous_data.get("snapshot", {}).get("survey_revision") != snapshot_revision if isinstance(previous_data, dict) else True
        delta["added"] = sorted(set(current_by_identity) - set(previous_by_identity))
        delta["removed"] = sorted(set(previous_by_identity) - set(current_by_identity))
        delta["changed"] = sorted(
            identity for identity in set(current_by_identity) & set(previous_by_identity)
            if current_by_identity[identity].get("dossier_hash") != previous_by_identity[identity].get("dossier_hash")
        )
        previous_note_records = previous_data.get("note_records", {}) if isinstance(previous_data, dict) else {}
        if not previous_note_records and isinstance(previous_data, dict):
            previous_note_records = {
                sketch: context for sketch, context in previous_data.get("sketch_contexts", {}).items()
                if isinstance(context, dict) and context.get("notes_sha256")
            }
        delta["notes"]["added"] = sorted(set(note_records) - set(previous_note_records))
        delta["notes"]["removed"] = sorted(set(previous_note_records) - set(note_records))
        delta["notes"]["changed"] = sorted(
            sketch for sketch in set(note_records) & set(previous_note_records)
            if note_records[sketch].get("source_sha256") != previous_note_records[sketch].get("source_sha256")
            or note_records[sketch].get("context_hash") != previous_note_records[sketch].get("context_hash")
        )
    if previous:
        prior_by_content: dict[str, list[tuple[str, int]]] = defaultdict(list)
        for item in previous_entries:
            if isinstance(item, dict) and item.get("candidate_content_hash"):
                prior_by_content[item["candidate_content_hash"]].append((item.get("sketch", ""), int(item.get("ordinal", -1))))
        for item in candidate_dossiers:
            if not item["notes_sha256"]:
                continue
            matches = prior_by_content.get(item["candidate_content_hash"], [])
            for prior_sketch, prior_ordinal in matches:
                if prior_sketch == item["sketch"] and prior_ordinal != item["ordinal"]:
                    prior_item = previous_by_identity.get(f"{prior_sketch}#{prior_ordinal}", {})
                    if prior_item.get("notes_sha256") != item["notes_sha256"]:
                        delta["ordinal_drift"].append({
                            "sketch": item["sketch"], "previous_ordinal": prior_ordinal,
                            "current_ordinal": item["ordinal"], "candidate_content_hash": item["candidate_content_hash"],
                        })
    delta["ordinal_drift"] = sorted(delta["ordinal_drift"], key=lambda item: (item["sketch"], item["current_ordinal"]))

    expected = set(index_identities)
    actual = set(notes)
    db_identity_set = set(db_rows)
    coverage = {
        "index_targets": len(index_identities), "index_duplicate_lines": index_duplicates,
        "index_parse_errors": index_errors, "notes_files": len(notes),
        "reports_present": len(expected & actual), "missing_reports": len(expected - actual),
        "missing_report_identities": sorted(expected - actual),
        "extra_report_files": len(actual - expected), "extra_report_identities": sorted(actual - expected),
        "stub_reports": sum(1 for sketch in expected & db_identity_set if db_rows[sketch]["skipped"] is not None),
        "stub_identities": sorted(sketch for sketch in expected & db_identity_set if db_rows[sketch]["skipped"] is not None),
        "database_sketches": len(db_rows),
        "database_missing_identities": len(expected - db_identity_set),
        "database_extra_identities": len(db_identity_set - expected),
        "stale_database_hashes": sum(1 for sketch in expected & set(notes) & db_identity_set if db_rows[sketch]["source_sha256"] != notes[sketch]["source_sha256"]),
    }
    diagnostics = Counter()
    for issues in db_issues.values():
        for issue in issues:
            diagnostics[f"{issue['severity']}:{issue['code']}"] += 1
    for path in note_errors:
        diagnostics["error:note_read"] += 1
    for path in result_file_errors:
        diagnostics["error:result_read"] += 1
    diagnostics["error:index_parse"] += len(index_errors)

    snapshot_count_names = {"notes": len(notes), "baseline_results": len(baselines), "variant_results": sum(len(items) for items in published_variants.values())}
    snapshot_count_mismatches = {
        key: {"declared": snapshot.get("counts", {}).get(key), "observed": observed}
        for key, observed in snapshot_count_names.items()
        if isinstance(snapshot.get("counts", {}).get(key), int) and snapshot["counts"][key] != observed
    }
    db_variant_keys = {(sketch, entry["variant"]) for sketch, entries in db_variants_by_sketch.items() for entry in entries.values()}
    file_variant_keys = {(sketch, entry["variant"]) for sketch, entries in published_variants.items() for entry in entries}
    validation_errors: list[str] = []
    if index_errors:
        validation_errors.append("index_parse_errors")
    if index_duplicates:
        validation_errors.append("duplicate_target_identities")
    if not expected:
        validation_errors.append("empty_target_inventory")
    if actual - expected:
        validation_errors.append("unexpected_report_identities")
    if db_identity_set != actual:
        validation_errors.append("database_note_identity_mismatch")
    if coverage["stale_database_hashes"]:
        validation_errors.append("stale_database_note_hashes")
    if previous and (not isinstance(previous_data, dict)
                     or not isinstance(previous_data.get("candidates"), list)):
        validation_errors.append("previous_inventory_invalid")
    if database_error:
        validation_errors.append("database_read_error")
    if db_missing_tables:
        validation_errors.append("database_missing_tables:" + ",".join(db_missing_tables))
    if not db_rows and not database_error:
        validation_errors.append("database_contains_no_sketches")
    if snapshot_count_mismatches:
        validation_errors.append("snapshot_count_mismatch")
    if result_file_errors:
        validation_errors.append("result_file_read_error")
    valid_file_variant_keys = {
        (sketch, entry["variant"])
        for sketch, entries in published_variants.items()
        for entry in entries if entry.get("status") not in {"invalid_json", "invalid_root"}
    }
    expected_db_variant_keys = {(sketch, variant) for sketch, variant in valid_file_variant_keys if sketch in notes}
    database_missing_variant_keys = expected_db_variant_keys - db_variant_keys
    database_extra_variant_keys = db_variant_keys - valid_file_variant_keys
    if database_missing_variant_keys:
        validation_errors.append("database_missing_variant_rows")
    if database_extra_variant_keys:
        validation_errors.append("database_extra_variant_rows")
    if snapshot_error:
        validation_errors.append("snapshot_read_error")
    if db_rows and db_table_counts.get("sketches") != len(notes):
        validation_errors.append("database_sketch_count_mismatch")

    return {
        "schema_version": 1,
        "generated_from": {"survey_root": portable_path(survey_root, "SURVEY_ROOT"), "snapshot": "survey/snapshot.json", "index": "survey/out/index.jsonl", "database": portable_path(database, "DATABASE")},
        "snapshot": {"survey_revision": snapshot_revision, "captured_at_utc": snapshot.get("captured_at_utc"), "counts": snapshot.get("counts", {})},
        "coverage": coverage,
        "database": {"metadata": db_metadata, "table_counts": db_table_counts, "missing_tables": db_missing_tables, "diagnostics": dict(sorted(diagnostics.items())), "read_error": database_error},
        "observed_counts": snapshot_count_names,
        "snapshot_count_mismatches": snapshot_count_mismatches,
        "validation_errors": validation_errors,
        "snapshot_error": snapshot_error,
        "published_results": {
            "baseline_files": len(baselines), "variant_files": len(file_variant_keys),
            "variant_db_rows": len(db_variant_keys), "variant_files_not_in_database": len(file_variant_keys - db_variant_keys),
            "variant_db_rows_without_file": len(db_variant_keys - file_variant_keys),
            "database_missing_variant_rows": len(database_missing_variant_keys),
            "database_extra_variant_rows": len(database_extra_variant_keys),
            "variant_malformed_files": sum(1 for entries in published_variants.values() for entry in entries if entry.get("status") in {"invalid_json", "invalid_root"}),
        },
        "family_coverage": families,
        "note_records": note_records,
        "sketch_contexts": sketch_contexts,
        "candidate_count": len(candidate_dossiers),
        "delta": delta,
        "candidates": candidate_dossiers,
    }


def markdown(inventory: dict[str, Any]) -> str:
    coverage = inventory["coverage"]
    database = inventory["database"]
    delta = inventory["delta"]
    lines = [
        "# Phase 2 evidence inventory", "",
        f"Evidence revision: `{inventory['snapshot']['survey_revision']}`. Candidate dossiers are keyed by sketch path and source ordinal; this artifact does not cluster or choose public API signatures.", "",
        "## Target/report coverage", "",
        "| measure | count |", "|---|---:|",
        f"| index targets | {coverage['index_targets']} |",
        f"| duplicate index lines | {coverage['index_duplicate_lines']} |",
        f"| reports present | {coverage['reports_present']} |",
        f"| missing reports | {coverage['missing_reports']} |",
        f"| extra report files | {coverage['extra_report_files']} |",
        f"| stub reports | {coverage['stub_reports']} |",
        f"| candidate dossiers | {inventory['candidate_count']} |",
        f"| stale database hashes | {coverage['stale_database_hashes']} |",
        f"| snapshot count mismatches | {len(inventory.get('snapshot_count_mismatches', {}))} |",
        "",
        "Missing and extra identities are listed in `evidence.json`; stubs remain report identities but are flagged as unusable visual evidence.", "",
        "## Technique-family coverage", "",
        "| family | sketches | candidate records |", "|---|---:|---:|",
    ]
    for family, values in inventory["family_coverage"].items():
        lines.append(f"| {family} | {values['sketches']} | {values['candidates']} |")
    lines += ["", "## Existing diagnostics", "", "| diagnostic | count |", "|---|---:|"]
    for key, count in database["diagnostics"].items():
        lines.append(f"| {key} | {count} |")
    lines += ["", "## Reconciliation", "", f"Compared with: `{inventory.get('previous') or 'none'}`.", "", "| change | count |", "|---|---:|", f"| snapshot changed | {str(bool(delta.get('snapshot_changed'))).lower()} |", f"| candidates added | {len(delta['added'])} |", f"| candidates changed | {len(delta['changed'])} |", f"| candidates removed | {len(delta['removed'])} |", f"| ordinal drift after note change | {len(delta['ordinal_drift'])} |", f"| note records added | {len(delta['notes']['added'])} |", f"| note records changed | {len(delta['notes']['changed'])} |", f"| note records removed | {len(delta['notes']['removed'])} |", "", "See `evidence.json` for complete dossiers, raw candidate records, provenance hashes, sketch-level parameter/variant context, and warnings.", ""]
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--survey-root", type=Path, default=PROJECT_ROOT / "survey")
    parser.add_argument("--database", type=Path, default=PROJECT_ROOT / "data" / "corpus.sqlite")
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--output-json", type=Path, default=PROJECT_ROOT / "analysis" / "phase2" / "evidence.json")
    parser.add_argument("--output-markdown", type=Path, default=PROJECT_ROOT / "analysis" / "phase2" / "inventory.md")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    inventory = build_inventory(args.survey_root, args.database, args.previous)
    if args.previous:
        inventory["previous"] = portable_path(args.previous, "PREVIOUS_INVENTORY")
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_markdown.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.output_markdown.write_text(markdown(inventory), encoding="utf-8")
    print(f"wrote {args.output_json} and {args.output_markdown}: candidates={inventory['candidate_count']}, missing={inventory['coverage']['missing_reports']}, extra={inventory['coverage']['extra_report_files']}")
    if inventory["validation_errors"]:
        print("validation failed: " + ", ".join(inventory["validation_errors"]), file=__import__("sys").stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
