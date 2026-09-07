# Survey evidence snapshot

This directory is a publishable snapshot of the in-progress `genart-survey` output used
to design Procedurals. It contains the human-readable sketch reports, render metadata,
parameter-variant measurements, run index, and the exact survey methodology.

Current snapshot: **826 sketch reports**, **2127 baseline result records**, and **4584 variant result records**.

Rendered PNG/PDF files, worker logs, temporary builds, copied sketch assets, and Python
environments are deliberately excluded. They total several gigabytes and are not needed
for corpus queries or API clustering. Visual-conformance work still requires a separate
full survey-output checkout supplied via `--reference-root` or `GENART_SURVEY_ROOT`.

Paths embedded by the original local renderer are replaced with
`${GENART_SURVEY_ROOT}` and `${PROCESSING_SKETCHES_ROOT}`. Measurements and report text
are otherwise retained.

- `out/**/notes.md`: per-sketch reports and parameter experiments
- `out/**/baseline/result.json`: baseline render facts
- `out/**/variants/*/result.json`: substitutions and measured pixel differences
- `out/index.jsonl`: mechanical render inventory
- `out/loop-status.jsonl`: survey run status history
- `methodology/`: original survey brief, prompt, and notes schema
- `provenance/`: upstream corpus README and MIT license
- `snapshot.json`: revisions, capture time, counts, and exclusions

Refresh from sibling checkouts:

```sh
uv run python tools/sync_survey.py
uv run python tools/ingest.py
uv run python tools/report.py
```
