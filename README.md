# Procedurals

Procedurals is an evidence-backed generative-art toolkit in development. It is being distilled
from a systematic survey of 901 Processing sketches into a small, composable set of generators,
transforms, drawing operations, templates, and tools.

Eighteen editable starters begin from artistic decisions: place independent marks, trace paths,
scatter differently sized forms, divide a surface into cells, give shapes grain, grow branches,
build a 3D form from an axial radius profile, use letters as repeated marks along paths,
turn point arrangements into connected facets, wire and grain, or give an arrangement
explicit target-driven spring motion, route occupied lattice paths, build clustered 3D relief, compose a faceted city, layer a banded night landscape, grow fine branches by cutting an initial stroke, warp a captured pattern through a field, position color transitions independently of geometry, or constrain wandering lines to a noise-value band.
FieldMarks and PathMarks have scoped native validation across their declared targets.
PlacementMarks, RegionMarks, GrainMarks and BranchMarks have accepted Processing Java/JAVA2D starter
reviews. ProfileMarks has accepted scoped Processing P3D validation. GlyphMarks has accepted
JAVA2D validation with its bundled DejaVu font. FacetMarks has accepted scoped JAVA2D
validation for retained triangulation and region-centre/grain transfer. SpringMarks has
accepted JAVA2D validation for explicit stepping, replay, retained styling and fixed-mesh
deformation.
LatticeMarks adds occupied orthogonal paths with independent restyling and scoped JAVA2D acceptance.
ReliefMarks composes subdivision and triangulation into a reviewed structural recreation of `momito`.
CityMarks adds a reviewed structural recreation of `ciscis002` using four existing operations.
LandscapeMarks adds a reviewed structural recreation of `parapara`, also without a new core operation.
CutBranchMarks adds mutable interior-cut branching with retained geometry and scoped P2D acceptance.
WarpMarks adds reusable raster remapping with retained sources and scoped JAVA2D edit/save validation.
RampMarks adds unequal noncyclic color stops with geometry-preserving edits and radial transfer.
BandMarks adds retained noise-band paths with tolerance edits and independent perpendicular marks.
Ports of these newer workflows to JavaScript, py5 and Android are deferred. The local Java 0.18.0 source bundle
contains all eighteen starters and eighteen reusable operations. It is not a published registry
release. An experimental [Java recipe preview](docs/java-recipe-preview.md) exports FieldMarks,
PathMarks, placement-bars and region-panels as editable standalone projects. General portable recipes, MCP and web tools
remain in the roadmap.

Choose an example by what you want to make in [the Java starting-point guide](docs/choosing-java-workflow.md).
Build from a fresh checkout with [the Java source-bundle instructions](docs/building-java-from-source.md).

Open [BandMarks](docs/band-marks.md) to keep winding lines near a noise level.
Open [RampMarks](docs/ramp-marks.md) to control where colors transition.
Open [WarpMarks](docs/warp-marks.md) to bend a captured pattern through noise or an analytic field.
The accepted local archive is identified in [the Java0.18 review](evidence/distribution/cp15-java-review.json).

Start with [a field of independent marks](docs/getting-started.md),
[paths and their marks](docs/path-marks.md),
[differently sized placements](docs/placement-marks.md),
[regions and their content](docs/region-marks.md),
[grain inside shapes](docs/grain-marks.md),
[branches and their marks](docs/branch-marks.md),
[forms built from profiles](docs/profile-marks.md),
[letters along paths](docs/glyph-marks.md), or
[facets from point arrangements](docs/facet-marks.md), or
[responsive arrangements](docs/spring-marks.md),
[occupied lattice paths](docs/lattice-marks.md), or
[clustered 3D relief](docs/relief-marks.md), or
[faceted cities](docs/city-marks.md), or
[banded landscapes](docs/landscape-marks.md).
[Build and install Java 0.18.0](docs/building-java-from-source.md) for all eighteen starters.
[Build the Android restoration patches](docs/installing-android-restoration.md) for the six
ported starters, preserving their existing core versions.

Earlier scoped artifacts retain their installation instructions:
[FieldMarks 0.1](docs/installing.md), [PathMarks 0.2](docs/installing-path-marks.md),
[PlacementMarks 0.3](docs/installing-placement-marks.md),
[RegionMarks 0.4](docs/installing-region-marks.md), [GrainMarks 0.5](docs/installing-grain-marks.md),
and [BranchMarks 0.6](docs/installing-branch-marks.md), now packaged for all four targets.
The survey, parameter analysis and
benchmark tools provide the evidence behind the library's decisions. Phase 2 remains
active; decisions are versioned against their evidence and revisited as reports arrive.

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
5. cluster those proposals by computation, recording the supporting evidence revision;
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
| `tools/phase2_inventory.py` | Candidate dossiers, evidence diagnostics, and snapshot reconciliation |
| `tools/check_phase2_design.py` | Non-destructive triage refresh and authored decision validation |
| `analysis/phase2/` | Generated evidence inventory, including missing reports and raw-record provenance |
| `design/phase2/` | Authored provisional candidate decisions and parameter investigation questions |
| `docs/roadmap.md` | Dependency-ordered Phase 2–4 work packets and acceptance gates |
| `docs/agent-briefs.md` | Bounded Luna/Terra assignments and integration ownership |
| `tests/` | Behavioral contracts for ingestion and visual benchmarking |
| `skills/` | Gated workflows for evidence, operation design, portability, and reproduction |
| `docs/` | Architecture, target-form decision, portability contract, and MCP/web requirements |

## Start here

To make artwork, use the [field-marks guide](docs/getting-started.md). It explains the
length, palette and mark edits and points to the native examples and installable starters.

For corpus analysis, install Python 3.11 or newer and [uv](https://docs.astral.sh/uv/).

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

Phase 2 may proceed on this snapshot under the maintainer’s revised policy. Read
[`docs/roadmap.md`](docs/roadmap.md) and [`docs/agent-briefs.md`](docs/agent-briefs.md) for
work packets and ownership. Drawing implementation still requires the written API design,
a reviewed keep/merge decision, and a complete portable operation contract. Evidence gaps
block affected decisions; incoming reports trigger explicit reconciliation.

Regenerate the Phase 2 evidence inventory and check the authored decisions with:

```sh
uv run python tools/phase2_inventory.py
uv run python tools/check_phase2_design.py
```

The regular-grid, scalar gradient-noise and cyclic-palette cores now run in Java, JavaScript and Python. See the
[core development guide](docs/core-development.md) for verified examples and the JAR build.
Start with the [editable field-marks example](docs/getting-started.md). Its actual Java
drawing tab and three edit tasks pass JAVA2D checks. Other hosts and portable drawing
commands remain in development.

The [artist capability direction](docs/artist-capabilities.md) explains the entry points,
first field-of-marks milestone and capability-first review process. The [API design](docs/api-design.md) is a draft. The [evidence review](docs/phase2-evidence-review.md)
distinguishes automated triage, assessed records, and remaining work. A normal checker pass
means structural consistency; `--require-reviewed` additionally requires dispositions for
every candidate and intentionally fails while review remains incomplete.
The [decision audit](docs/audits/phase2-architecture-review.md) records corrected memberships
and component-aware exclusions. `--contract-cluster <id>` checks one operation's recorded
architecture and member-audit prerequisites; it does not approve its semantics or contract.

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

## License

Procedurals is released under the [MIT License](LICENSE). The upstream `AllSketchs`
material remains copyright Manolo ide under its separately preserved MIT notice.
