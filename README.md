# Procedurals

Procedurals is an evidence-backed generative-art toolkit in development. It is being distilled
from a systematic survey of 901 Processing sketches into a small, composable set of generators,
transforms, drawing operations, templates, and tools.

The project is not a drawing library yet. Its implemented foundation is the survey evidence,
a normalized SQLite corpus, parameter-sensitivity analysis, and a cross-renderer visual
benchmark harness. The public operation catalog and language implementations are deliberately
waiting for the complete survey so that rare techniques are not designed out by a partial sample.

## Current status

The checked-in snapshot contains:

- **826** sketch reports: 800 analyzed sketches and 26 blank/unrenderable stubs;
- **3,560** parameter records, including 3,339 with a controlled visual-change score;
- **1,934** reusable-operation proposals;
- **4,578** parameter-variant render records, including 4,482 objective pixel-diff results;
- a 980-case baseline manifest spanning the 800 analyzed sketches.

The survey is still running. These are snapshot counts, not final-corpus claims. Read
[`PROJECT_STATE.md`](PROJECT_STATE.md) for the exact handoff state and [`AGENTS.md`](AGENTS.md)
for the phase gates and engineering rules.

## Why this exists

Large sketch archives contain repeated techniques, but copying their helpers directly produces
hundreds of overlapping, renderer-bound functions with arbitrary defaults. Procedurals takes a
different route:

1. render each source sketch with a fixed seed;
2. describe its techniques, primitives, composition, and implementation;
3. vary concrete parameters and measure the resulting pixel difference;
4. preserve reusable-function proposals with provenance back to the sketch report;
5. cluster those proposals only after the corpus is complete;
6. implement the surviving operations against a language-neutral behavioral contract.

Measured sensitivity is the primary signal for API parameters. A parameter that repeatedly causes
no visible change is evidence against exposing it, even if it looks important in source code.

## Planned product

Processing 4 is the reference implementation, packaged as a native Java library. The behavioral
specification remains renderer-neutral so the same operations and portable recipes can be
implemented for:

- Processing 4 desktop;
- p5.js;
- py5;
- Processing for Android.

A later MCP server and companion web application will turn natural-language requests into
validated portable recipes, preview them in p5.js, and export projects for supported targets.
The rationale and system boundaries are documented in
[`docs/target-form.md`](docs/target-form.md), [`docs/portability.md`](docs/portability.md), and
[`docs/architecture.md`](docs/architecture.md).

## Repository map

| Path | Purpose |
|---|---|
| `survey/` | Publishable survey snapshot: reports, render metadata, methodology, and upstream provenance |
| `data/corpus.sqlite` | Normalized, queryable corpus with provenance views |
| `reports/corpus.md` | Corpus shape, associations, candidate distribution, normalizations, and diagnostics |
| `reports/parameter-sensitivity.csv` | Parameter-level defaults, trials, measured changes, effects, and evidence warnings |
| `tools/ingest.py` | Idempotent survey ingestion and normalization |
| `tools/report.py` | Rebuilds the human-readable and CSV analyses |
| `benchmarks/corpus.json` | Portable visual-conformance case manifest and reference hashes |
| `tools/benchmark.py` | Image metrics, profile gates, and coverage reporting |
| `tools/sync_survey.py` | Maintainer tool for refreshing the checked-in survey snapshot |
| `tests/` | Behavioral contracts for ingestion and visual benchmarking |
| `skills/` | Gated workflows for evidence, operation design, portability, and reproduction |
| `docs/` | Architecture, target-form decision, portability contract, and MCP/web requirements |

## Start here

Prerequisites: Python 3.11 or newer and [uv](https://docs.astral.sh/uv/).

Rebuild the database and reports from the checked-in snapshot:

```sh
uv run python tools/ingest.py
uv run python tools/report.py
```

Run the retained pipeline contracts:

```sh
uv run python -m unittest discover -s tests -v
```

The database exposes `parameter_provenance` and `candidate_provenance` views. Every row points back
to an `out/.../notes.md` path under `survey/`. The full report is readable without SQLite tooling:
start with [`reports/corpus.md`](reports/corpus.md) and then use
[`reports/parameter-sensitivity.csv`](reports/parameter-sensitivity.csv) for API evidence.

Do **not** begin candidate clustering or freeze public signatures from this snapshot. Phase 2 starts
only after all 901 target sketches have reports and the maintainer has published the completed
snapshot. Until then, useful work is limited to ingestion hardening, analysis, benchmark tooling,
and deeper evidence review.

## Survey snapshot and images

The repository includes report text and JSON render measurements, but excludes rendered PNG/PDF
files, worker logs, temporary builds, environments, and copied sketch assets. The omitted survey
output is several gigabytes and is not suitable for ordinary Git history.

This means corpus queries, report generation, and API-evidence review work from a normal clone.
Visual-conformance runs additionally require a full survey-output checkout:

```sh
uv run python tools/benchmark.py \
  --manifest benchmarks/corpus.json \
  --reference-root /path/to/genart-survey \
  --candidate-root /path/to/rendered-cases \
  --target p5js
```

Maintainers with sibling `genart-survey` and `processing_sketches` checkouts can refresh the public
snapshot and derived artifacts with:

```sh
uv run python tools/sync_survey.py
uv run python tools/ingest.py
uv run python tools/report.py
uv run python tools/build_benchmarks.py --survey-root ../genart-survey
```

The sync is allowlisted and idempotent. It copies only reports, result metadata, methodology, and
provenance; it also replaces machine-local paths with portable placeholders. See
[`survey/README.md`](survey/README.md) and [`survey/snapshot.json`](survey/snapshot.json).

## Source material and credit

Procedurals is grounded in [Manolo Gamboa Naon's `AllSketchs`](https://github.com/manoloide/AllSketchs),
a long-running public archive of Processing sketches, experiments, tools, and generative works.
The archive is copyright Manolo ide and distributed under the MIT License. Its original README and
license are preserved verbatim under [`survey/provenance/`](survey/provenance/).

The source sketches remain Manolo Gamboa Naon's work. This repository does not include their source
code or rendered images. It includes machine-assisted analytical reports and measurement metadata
derived from them, with sketch-relative provenance throughout. The survey used deterministic
headless renders where possible and a local language model to draft structured notes; the original
prompt, schema, and agent brief are retained under [`survey/methodology/`](survey/methodology/) so
the evidence-generation process is inspectable.

Known data-quality limitations are reported rather than hidden: malformed frontmatter is recovered
with diagnostics, unsupported vocabulary values are normalized explicitly, non-deterministic
renders are marked, and shader output produced under Xvfb is treated as suspect. See the final
sections of [`reports/corpus.md`](reports/corpus.md) for the current normalization and warning tables.
