#!/usr/bin/env python3
"""Copy the publishable survey evidence into this repository."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

TOP_LEVEL_REPORTS = ("catalog.md", "index.jsonl", "loop-status.jsonl")
METHODOLOGY_FILES = {
    "README.md": "SURVEY_README.md",
    "AGENTS.md": "SURVEY_AGENT_BRIEF.md",
    "NOTES_TEMPLATE.md": "NOTES_TEMPLATE.md",
    "PROMPT.md": "PROMPT.md",
}
UPSTREAM_FILES = {
    "README.md": "UPSTREAM_README.md",
    "LICENSE": "ALLSKETCHS_LICENSE.txt",
}


def revision(path: Path) -> str | None:
    completed = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "HEAD"],
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def replacements(survey_root: Path, corpus_root: Path) -> dict[str, str]:
    return {
        str(survey_root): "${GENART_SURVEY_ROOT}",
        str(corpus_root): "${PROCESSING_SKETCHES_ROOT}",
        "~/dev/genart-survey": "${GENART_SURVEY_ROOT}",
        "~/dev/processing_sketches": "${PROCESSING_SKETCHES_ROOT}",
        str(Path.home()): "${HOME}",
    }


def copy_text(
    source: Path,
    destination: Path,
    substitutions: dict[str, str],
    *,
    trim_trailing: bool = False,
) -> None:
    text = source.read_text(encoding="utf-8", errors="replace")
    for original, replacement in substitutions.items():
        text = text.replace(original, replacement)
    if trim_trailing:
        trailing_newline = text.endswith("\n")
        text = "\n".join(line.rstrip() for line in text.splitlines())
        if trailing_newline:
            text += "\n"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding="utf-8")


def selected_evidence(out_root: Path) -> list[Path]:
    selected = [out_root / name for name in TOP_LEVEL_REPORTS if (out_root / name).is_file()]
    selected.extend(out_root.glob("**/notes.md"))
    selected.extend(out_root.glob("**/baseline/result.json"))
    selected.extend(out_root.glob("**/variants/*/result.json"))
    return sorted(set(selected))


def write_snapshot_readme(destination: Path, counts: dict[str, int]) -> None:
    destination.write_text(
        "\n".join(
            [
                "# Survey evidence snapshot",
                "",
                "This directory is a publishable snapshot of the in-progress `genart-survey` output used",
                "to design Procedurals. It contains the human-readable sketch reports, render metadata,",
                "parameter-variant measurements, run index, and the exact survey methodology.",
                "",
                (
                    f"Current snapshot: **{counts['notes']} sketch reports**, "
                    f"**{counts['baseline_results']} baseline result records**, and "
                    f"**{counts['variant_results']} variant result records**."
                ),
                "",
                "Rendered PNG/PDF files, worker logs, temporary builds, copied sketch assets, and Python",
                "environments are deliberately excluded. They total several gigabytes and are not needed",
                "for corpus queries or API clustering. Visual-conformance work still requires a separate",
                "full survey-output checkout supplied via `--reference-root` or `GENART_SURVEY_ROOT`.",
                "",
                "Paths embedded by the original local renderer are replaced with",
                "`${GENART_SURVEY_ROOT}` and `${PROCESSING_SKETCHES_ROOT}`. Measurements and report text",
                "are otherwise retained.",
                "",
                "- `out/**/notes.md`: per-sketch reports and parameter experiments",
                "- `out/**/baseline/result.json`: baseline render facts",
                "- `out/**/variants/*/result.json`: substitutions and measured pixel differences",
                "- `out/index.jsonl`: mechanical render inventory",
                "- `out/loop-status.jsonl`: survey run status history",
                "- `methodology/`: original survey brief, prompt, and notes schema",
                "- `provenance/`: upstream corpus README and MIT license",
                "- `snapshot.json`: revisions, capture time, counts, and exclusions",
                "",
                "Refresh from sibling checkouts:",
                "",
                "```sh",
                "uv run python tools/sync_survey.py",
                "uv run python tools/ingest.py",
                "uv run python tools/report.py",
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )


def sync(survey_root: Path, corpus_root: Path, destination: Path) -> dict[str, int]:
    survey_root = survey_root.expanduser().resolve()
    corpus_root = corpus_root.expanduser().resolve()
    destination = destination.expanduser().resolve()
    out_root = survey_root / "out"
    if not out_root.is_dir():
        raise SystemExit(f"survey output not found: {out_root}")

    substitutions = replacements(survey_root, corpus_root)
    with tempfile.TemporaryDirectory(prefix="survey-snapshot-", dir=destination.parent) as temporary:
        staged = Path(temporary) / destination.name
        staged.mkdir()

        evidence = selected_evidence(out_root)
        for source in evidence:
            copy_text(source, staged / "out" / source.relative_to(out_root), substitutions)

        for source_name, destination_name in METHODOLOGY_FILES.items():
            source = survey_root / source_name
            if not source.is_file():
                raise SystemExit(f"survey methodology file not found: {source}")
            copy_text(source, staged / "methodology" / destination_name, substitutions)

        for source_name, destination_name in UPSTREAM_FILES.items():
            source = corpus_root / source_name
            if not source.is_file():
                raise SystemExit(f"upstream provenance file not found: {source}")
            copy_text(
                source,
                staged / "provenance" / destination_name,
                substitutions,
                trim_trailing=destination_name == "UPSTREAM_README.md",
            )

        counts = {
            "notes": sum(path.name == "notes.md" for path in evidence),
            "baseline_results": sum(path.name == "result.json" and path.parent.name == "baseline" for path in evidence),
            "variant_results": sum(path.name == "result.json" and path.parent.parent.name == "variants" for path in evidence),
        }
        metadata = {
            "schema_version": 1,
            "captured_at_utc": datetime.now(UTC).isoformat(),
            "survey_revision": revision(survey_root),
            "source_corpus": {
                "name": "Manolo Gamboa Naon's AllSketchs",
                "url": "https://github.com/manoloide/AllSketchs",
                "revision": revision(corpus_root),
                "license": "MIT",
            },
            "counts": counts,
            "included": [
                "out/**/notes.md",
                "out/**/baseline/result.json",
                "out/**/variants/*/result.json",
                *[f"out/{name}" for name in TOP_LEVEL_REPORTS],
                "methodology/*",
                "provenance/*",
            ],
            "excluded": [
                "rendered PNG/PDF files",
                "worker logs and errors",
                "temporary builds and environments",
                "copied sketch assets and preview output",
            ],
        }
        (staged / "snapshot.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        write_snapshot_readme(staged / "README.md", counts)

        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(staged, destination)
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--survey-root", type=Path, default=PROJECT_ROOT.parent / "genart-survey")
    parser.add_argument("--corpus-root", type=Path, default=PROJECT_ROOT.parent / "processing_sketches")
    parser.add_argument("--destination", type=Path, default=PROJECT_ROOT / "survey")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    counts = sync(args.survey_root, args.corpus_root, args.destination)
    print(
        "synced survey snapshot: "
        f"notes={counts['notes']}, baseline_results={counts['baseline_results']}, "
        f"variant_results={counts['variant_results']}"
    )


if __name__ == "__main__":
    main()
