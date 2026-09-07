#!/usr/bin/env python3
"""Generate evidence-backed corpus and parameter-sensitivity reports from corpus.sqlite."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

SCORE_ORDER = {"large": 0, "moderate": 1, "subtle": 2, "none": 3, None: 4}


def md(value: Any) -> str:
    if value is None or value == "":
        return "—"
    return str(value).replace("|", "\\|").replace("\n", " ")


def markdown_table(headers: list[str], rows: Iterable[Iterable[Any]]) -> list[str]:
    rendered = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    rendered.extend("| " + " | ".join(md(value) for value in row) + " |" for row in rows)
    return rendered


def decode_json(value: str | None) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def compact_json(value: str | None) -> str:
    decoded = decode_json(value)
    if decoded is None:
        return ""
    if isinstance(decoded, str):
        return decoded
    return json.dumps(decoded, ensure_ascii=False, separators=(",", ":"))


def canonical_parameter_name(name: str | None) -> str:
    if not name:
        return "(unnamed)"
    value = re.sub(r"\s*\([^)]*\)\s*", " ", name.lower())
    value = re.sub(r"[^a-z0-9]+", " ", value).strip()
    return value or "(unnamed)"


def top_associations(connection: sqlite3.Connection, table: str, value_column: str) -> dict[str, list[tuple[str, int]]]:
    rows = connection.execute(
        f"""SELECT st.technique, related.{value_column}, count(DISTINCT st.sketch_id)
            FROM sketch_techniques st
            JOIN {table} related ON related.sketch_id = st.sketch_id
            WHERE related.{value_column} IS NOT NULL
            GROUP BY st.technique, related.{value_column}
            ORDER BY st.technique, count(DISTINCT st.sketch_id) DESC, related.{value_column}"""
    )
    grouped: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for technique, value, count in rows:
        grouped[technique].append((value, count))
    return grouped


def format_top(values: list[tuple[str, int]], limit: int = 3) -> str:
    return ", ".join(f"{value} ({count})" for value, count in values[:limit]) or "—"


def sensitivity_rows(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    columns = [
        "sketch", "notes_path", "name", "default_json", "tried_json", "change_score", "effect",
        "deterministic", "baseline_display", "uses_shader",
    ]
    rows = connection.execute(
        """SELECT s.sketch, s.notes_path, p.name, p.default_json, p.tried_json, p.change_score,
                  p.effect, s.deterministic, s.baseline_display, s.uses_shader
           FROM parameters p JOIN sketches s ON s.id = p.sketch_id
           ORDER BY s.sketch, p.ordinal"""
    )
    return [dict(zip(columns, row)) for row in rows]


def write_sensitivity_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "sketch", "notes_path", "parameter", "canonical_parameter", "default", "tried",
        "change_score", "signal", "effect", "deterministic", "baseline_display", "uses_shader",
        "evidence_warning",
    ]
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            score = row["change_score"]
            warning = ""
            if row["deterministic"] == 0:
                warning = "non-deterministic baseline; only large changes are reliable"
            if row["uses_shader"] == 1 and row["baseline_display"] == "xvfb":
                warning = (warning + "; " if warning else "") + "shader rendered under Xvfb; visual evidence is suspect"
            writer.writerow(
                {
                    "sketch": row["sketch"],
                    "notes_path": row["notes_path"],
                    "parameter": row["name"] or "",
                    "canonical_parameter": canonical_parameter_name(row["name"]),
                    "default": compact_json(row["default_json"]),
                    "tried": compact_json(row["tried_json"]),
                    "change_score": score or "",
                    "signal": "high" if score in {"large", "moderate"} else "low" if score in {"none", "subtle"} else "unscored",
                    "effect": row["effect"] or "",
                    "deterministic": "" if row["deterministic"] is None else str(bool(row["deterministic"])).lower(),
                    "baseline_display": row["baseline_display"] or "",
                    "uses_shader": "" if row["uses_shader"] is None else str(bool(row["uses_shader"])).lower(),
                    "evidence_warning": warning,
                }
            )


def generate_report(connection: sqlite3.Connection, sensitivity: list[dict[str, Any]], csv_path: Path) -> str:
    metadata = dict(connection.execute("SELECT key, value FROM metadata"))
    summary = connection.execute(
        """SELECT count(*) AS notes,
                  sum(skipped IS NULL) AS analyzed,
                  sum(skipped IS NOT NULL) AS stubs,
                  sum(deterministic = 0) AS nondeterministic,
                  sum(animated = 1) AS animated,
                  sum(uses_shader = 1 AND baseline_display = 'xvfb') AS suspect_shaders
           FROM sketches"""
    ).fetchone()
    parameters = connection.execute("SELECT count(*), sum(change_score IS NOT NULL) FROM parameters").fetchone()
    candidates = connection.execute("SELECT count(*), count(DISTINCT name) FROM reusable_candidates WHERE name IS NOT NULL").fetchone()
    variants = connection.execute("SELECT count(*), sum(diff_label IS NOT NULL) FROM variants").fetchone()
    issue_counts = dict(connection.execute("SELECT severity, count(*) FROM ingest_issues GROUP BY severity"))

    lines = [
        "# Corpus analysis",
        "",
        f"Snapshot generated from `{md(metadata.get('survey_root'))}` at `{md(metadata.get('generated_at_utc'))}`. "
        "The survey is incomplete; all counts describe this snapshot, not the final 901-sketch corpus.",
        "",
        "## Corpus shape",
        "",
    ]
    lines += markdown_table(
        ["measure", "count"],
        [
            ("notes discovered / ingested", f"{metadata.get('notes_discovered')} / {summary[0]}"),
            ("analyzed notes", summary[1]),
            ("blank/unrenderable stubs", summary[2]),
            ("animated sketches", summary[4]),
            ("non-deterministic sketches", summary[3]),
            ("parameter records (scored)", f"{parameters[0]} ({parameters[1]})"),
            ("candidate records (distinct exact names)", f"{candidates[0]} ({candidates[1]})"),
            ("variant result records (with objective diff)", f"{variants[0]} ({variants[1]})"),
            ("Xvfb shader baselines flagged suspect", summary[5]),
            ("ingestion diagnostics", f"{issue_counts.get('error', 0)} errors, {issue_counts.get('warning', 0)} warnings"),
        ],
    )

    technique_counts = list(
        connection.execute(
            """SELECT technique, count(*) FROM sketch_techniques
               GROUP BY technique ORDER BY count(*) DESC, technique"""
        )
    )
    lines += ["", "## Technique frequency", ""]
    lines += markdown_table(["technique", "sketches"], technique_counts)

    cooccurrence = list(
        connection.execute(
            """SELECT a.technique, b.technique, count(*) AS sketches
               FROM sketch_techniques a
               JOIN sketch_techniques b ON b.sketch_id = a.sketch_id AND b.technique > a.technique
               GROUP BY a.technique, b.technique
               ORDER BY sketches DESC, a.technique, b.technique
               LIMIT 30"""
        )
    )
    lines += ["", "## Strongest technique co-occurrences", ""]
    lines += markdown_table(["technique A", "technique B", "shared sketches"], cooccurrence)

    primitive_assoc = top_associations(connection, "sketch_primitives", "primitive")
    renderer_rows = connection.execute(
        """SELECT st.technique, s.renderer, count(DISTINCT s.id)
           FROM sketch_techniques st JOIN sketches s ON s.id = st.sketch_id
           WHERE s.renderer IS NOT NULL
           GROUP BY st.technique, s.renderer
           ORDER BY st.technique, count(DISTINCT s.id) DESC, s.renderer"""
    )
    composition_rows = connection.execute(
        """SELECT st.technique, s.composition, count(DISTINCT s.id)
           FROM sketch_techniques st JOIN sketches s ON s.id = st.sketch_id
           WHERE s.composition IS NOT NULL
           GROUP BY st.technique, s.composition
           ORDER BY st.technique, count(DISTINCT s.id) DESC, s.composition"""
    )
    renderer_assoc: dict[str, list[tuple[str, int]]] = defaultdict(list)
    composition_assoc: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for technique, renderer, count in renderer_rows:
        renderer_assoc[technique].append((renderer, count))
    for technique, composition, count in composition_rows:
        composition_assoc[technique].append((composition, count))
    lines += ["", "## Technique associations", ""]
    lines += markdown_table(
        ["technique", "sketches", "top primitives", "renderers", "top compositions"],
        [
            (technique, count, format_top(primitive_assoc[technique]), format_top(renderer_assoc[technique], 4),
             format_top(composition_assoc[technique]))
            for technique, count in technique_counts
        ],
    )

    top_candidates = list(
        connection.execute(
            """SELECT name, count(*) AS proposals, count(DISTINCT sketch_id) AS sketches
               FROM reusable_candidates WHERE name IS NOT NULL
               GROUP BY name ORDER BY proposals DESC, name LIMIT 40"""
        )
    )
    lines += [
        "",
        "## Reusable-candidate proposal distribution",
        "",
        "Names are exact survey proposals, not Phase 2 semantic clusters. Near-duplicates remain deliberately unmerged.",
        "",
    ]
    lines += markdown_table(["candidate name", "proposals", "sketches"], top_candidates)

    score_counts = Counter(row["change_score"] for row in sensitivity)
    scored_total = sum(score_counts[score] for score in ("large", "moderate", "subtle", "none"))
    lines += [
        "",
        "## Parameter sensitivity",
        "",
        f"The complete parameter-level artifact is `{csv_path.as_posix()}`. It contains every parameter record, "
        "its provenance, default/tried values, score, effect, signal band, and reliability warning.",
        "",
    ]
    lines += markdown_table(
        ["change score", "records", "share of scored"],
        [
            (score, score_counts[score], f"{score_counts[score] / scored_total:.1%}" if scored_total else "—")
            for score in ("large", "moderate", "subtle", "none")
        ] + [("unscored/invalid", score_counts[None], "—")],
    )

    grouped: dict[str, Counter[str]] = defaultdict(Counter)
    examples: dict[str, list[str]] = defaultdict(list)
    for row in sensitivity:
        name = canonical_parameter_name(row["name"])
        score = row["change_score"]
        grouped[name][score or "unscored"] += 1
        if len(examples[name]) < 3:
            examples[name].append(row["sketch"])
    repeated = []
    for name, counts in grouped.items():
        scored = sum(counts[score] for score in ("large", "moderate", "subtle", "none"))
        if scored < 2:
            continue
        high = counts["large"] + counts["moderate"]
        low = counts["subtle"] + counts["none"]
        repeated.append((name, scored, counts["large"], counts["moderate"], counts["subtle"], counts["none"], high / scored, ", ".join(examples[name])))
    repeated.sort(key=lambda row: (-row[1], -row[6], row[0]))
    lines += [
        "",
        "### Repeated parameter names",
        "",
        "Names are conservatively canonicalized for case, punctuation, and parenthetical descriptions only. "
        "Same-name parameters may still have different semantics; Phase 2 must inspect provenance before merging.",
        "",
    ]
    lines += markdown_table(
        ["parameter", "scored", "large", "moderate", "subtle", "none", "high-impact rate", "example sketches"],
        [(*row[:6], f"{row[6]:.0%}", row[7]) for row in repeated[:50]],
    )

    reliable = [
        row for row in sensitivity
        if row["change_score"] in {"large", "moderate"}
        and (row["deterministic"] != 0 or row["change_score"] == "large")
        and not (row["uses_shader"] == 1 and row["baseline_display"] == "xvfb")
    ]
    reliable.sort(key=lambda row: (SCORE_ORDER[row["change_score"]], row["sketch"], row["name"] or ""))
    lines += [
        "",
        "### Large and moderate observed changes",
        "",
        "Non-deterministic moderate changes and shader baselines rendered under Xvfb are omitted from this concise table; "
        "they remain in the CSV with warnings.",
        "",
    ]
    lines += markdown_table(
        ["score", "sketch", "parameter", "default → tried", "observed effect"],
        [
            (
                row["change_score"], row["sketch"], row["name"],
                f"{compact_json(row['default_json'])} → {compact_json(row['tried_json'])}", row["effect"],
            )
            for row in reliable[:60]
        ],
    )

    low_signal = [row for row in sensitivity if row["change_score"] in {"none", "subtle"}]
    low_signal.sort(key=lambda row: (SCORE_ORDER[row["change_score"]], row["sketch"], row["name"] or ""))
    lines += [
        "",
        "### None and subtle observed changes",
        "",
        "These records are evidence against exposing a parameter by default, subject to the effect text and reliability flags. "
        "A `none` score can also reveal a harness timing problem or an occluded layer rather than an inert parameter.",
        "",
    ]
    lines += markdown_table(
        ["score", "sketch", "parameter", "default → tried", "observed effect"],
        [
            (
                row["change_score"], row["sketch"], row["name"],
                f"{compact_json(row['default_json'])} → {compact_json(row['tried_json'])}", row["effect"],
            )
            for row in low_signal[:60]
        ],
    )

    variant_scores = list(
        connection.execute(
            """SELECT coalesce(diff_label, 'unscored'), count(*), round(avg(diff_mean), 4),
                      round(avg(diff_changed_fraction), 4)
               FROM variants GROUP BY diff_label
               ORDER BY CASE diff_label WHEN 'large' THEN 0 WHEN 'moderate' THEN 1 WHEN 'subtle' THEN 2 WHEN 'none' THEN 3 ELSE 4 END"""
        )
    )
    lines += ["", "## Objective variant-diff records", ""]
    lines += markdown_table(["label", "variants", "mean RGB difference", "mean changed fraction"], variant_scores)

    normalizations = list(
        connection.execute(
            """SELECT field, original_json, coalesce(normalized_json, 'null'), rule, count(*)
               FROM normalizations GROUP BY field, original_json, normalized_json, rule
               ORDER BY field, original_json"""
        )
    )
    lines += [
        "",
        "## Applied normalizations",
        "",
        "Every normalization is retained in the database with sketch provenance. Raw frontmatter is also preserved.",
        "",
    ]
    lines += markdown_table(["field", "original", "normalized", "rule", "uses"], normalizations)

    diagnostics = list(
        connection.execute(
            """SELECT severity, code, count(*), group_concat(notes_path, ', ')
               FROM ingest_issues GROUP BY severity, code ORDER BY severity, code"""
        )
    )
    lines += ["", "## Ingestion diagnostics", ""]
    lines += markdown_table(["severity", "code", "count", "source notes"], diagnostics)
    lines += [""]
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=Path("data/corpus.sqlite"))
    parser.add_argument("--output", type=Path, default=Path("reports/corpus.md"))
    parser.add_argument("--sensitivity-csv", type=Path, default=Path("reports/parameter-sensitivity.csv"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database = args.database.expanduser().resolve()
    output = args.output.expanduser().resolve()
    csv_path = args.sensitivity_csv.expanduser().resolve()
    if not database.is_file():
        raise SystemExit(f"database not found: {database}; run tools/ingest.py first")
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    try:
        sensitivity = sensitivity_rows(connection)
        write_sensitivity_csv(csv_path, sensitivity)
        report = generate_report(connection, sensitivity, args.sensitivity_csv)
    finally:
        connection.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report)
    print(f"wrote {output} and {csv_path} ({len(sensitivity)} parameter records)")


if __name__ == "__main__":
    main()
