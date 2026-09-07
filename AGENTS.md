# procedurals — build brief

This repository houses a reusable generative-art toolkit distilled from a 901-sketch
Processing corpus that has been systematically surveyed. This file is your standing brief.
Read it first on every resume.

# Mission

Turn a descriptive survey into a prescriptive library: composable functions, project
templates, helper scripts, and docs that let someone make work in these idioms without
re-deriving them from 901 .pde files.

This is a long-horizon task (many sessions). Optimize for a durable, resumable process and
for evidence-backed decisions over speed.

# The evidence base

The publishable survey snapshot lives in `survey/`. The upstream source corpus is Manolo
Gamboa Naon's MIT-licensed
[`AllSketchs`](https://github.com/manoloide/AllSketchs) repository. Source sketches are
provenance, not project-owned code.

- `survey/out/<sketch>/notes.md` — one report per surveyed sketch. YAML frontmatter uses
  the schema in `survey/methodology/NOTES_TEMPLATE.md`; prose covers the drawing, code,
  measured parameter experiments, and modularisation judgement.
- `survey/out/index.jsonl` — per-sketch renderer, size, import, determinism, animation,
  shader, timing, frame-hash, and year facts.
- `survey/out/<sketch>/baseline/result.json` — seeded baseline render metadata.
- `survey/out/<sketch>/variants/<variant>/result.json` — parameter substitutions and
  objective pixel-difference measurements.
- `survey/out/loop-status.jsonl` — survey run history.
- `survey/snapshot.json` — capture time, source revisions, counts, and explicit exclusions.
- `data/corpus.sqlite` — normalized query layer. `reports/corpus.md` and
  `reports/parameter-sensitivity.csv` are its generated human-facing analyses.

Rendered images are deliberately not tracked: the full survey output exceeds 9 GB. Visual
conformance requires a separate full survey-output checkout passed to the benchmark tool.
Corpus querying, parameter analysis, and Phase 2 clustering use the checked-in text and JSON.

Current checked-in snapshot: 826 reports, including 26 blank/unrenderable stubs; 3,560
parameter records; 1,934 reusable-candidate records; and 4,578 variant result records.
The final target is 901 reports.

## Known data quality

- Some frontmatter is malformed. `tools/ingest.py` recovers reachable records, preserves
  raw frontmatter, and emits provenance-linked diagnostics.
- Controlled vocabularies leaked during surveying. Every correction or dropped value is
  recorded in the `normalizations` table and reported in `reports/corpus.md`.
- A `none` or `subtle` measured change is evidence against exposing a parameter even when
  the code suggests otherwise.
- Non-deterministic renders weaken small-difference evidence.
- Headless shader renders marked with `display: xvfb` and `uses_shader: true` are suspect.

# Hard constraints

- Never copy source sketch code into the library without preserving the upstream MIT
  notice and explicit provenance. Prefer independently specified operations over copied
  implementation.
- Do not hand-edit generated files under `survey/`, `data/`, `reports/`, or
  `benchmarks/corpus.json`. Refresh them through the checked-in tools.
- Do not add rendered survey images, logs, temporary builds, environments, or copied
  assets to Git.
- Keep all new project work inside this repository.

# Phase gate

Phase 0 and Phase 1 are complete. Phase 2 is blocked until the maintainer publishes a
snapshot with all 901 target reports. The checked-in `survey/snapshot.json` is the public
source of truth; a contributor should not need access to the maintainer's services or
filesystem to determine the phase.

While the snapshot remains incomplete, useful work includes ingestion hardening, corpus
analysis, benchmark tooling, documentation corrections, and deeper reading of existing
evidence. Do not cluster candidates, design public signatures, or implement the drawing
library from a partial corpus.

# Phases

## Phase 0 — Complete: target form

Reference implementation: a Processing 4 native Java library distributed as a JAR.
Portable behavior is specified independently of Java and implemented for p5.js, py5, and
Processing for Android. PDE files remain examples and templates, not the reusable core.
Rationale: `docs/target-form.md`; portability contract: `docs/portability.md`.

## Phase 1 — Complete: queryable corpus

`tools/ingest.py` converts the publishable snapshot into an atomic normalized SQLite
database. `tools/report.py` produces technique associations, candidate distributions,
normalization diagnostics, and the complete parameter-sensitivity table. Rebuild with:

```sh
uv run python tools/ingest.py
uv run python tools/report.py
```

Every parameter and reusable candidate carries provenance back to a checked-in note.
Measured sensitivity remains the primary evidence for public parameters and ranges.

## Phase 2 — Cluster candidates into an API surface (GATED: full corpus only)

The completed corpus will contain roughly two thousand proposed candidates, mostly
near-duplicates. Cluster them by what they compute, not by name. For each cluster identify
the motivating sketches, observed parameter union, and minimal general signature.

For every cluster, make an explicit keep/merge/reject call and record the reason. Reject
aggressively: the notes' "Modularisation notes" sections already separate generic
machinery from one-off art decisions — honor that distinction. A one-off aesthetic choice
that appears in a single sketch is not a library function.

Deliver a written API design — module layout, naming conventions, composition story (how
functions combine: what's a generator, what's a transform, what's a sink), and the
parameter-object convention — BEFORE implementing. Include what you deliberately left out
and why. Target roughly 30-80 well-chosen functions, not 400; if you find yourself
approaching several hundred, you have failed to cluster.

Cover the long tail deliberately. Grid and noise-field dominate the current snapshot, but
flow-field, voronoi-delaunay, physics, l-system, and typography are rarer and often harder
to re-derive. Make an explicit in/out decision for every rare family.

## Phase 3 — Implement with reproduction as the test

Implement in dependency order and validate empirically. Rewrite a representative set of
surveyed sketches spanning renderers, techniques, 2D/3D, and static/animated work, then
render and diff against baselines from a full external survey-output checkout.

Pixel identity is not a universal target: random streams and non-deterministic sketches
can diverge. Define reproduction success up front (exact, structural/perceptual, or
technique-level) and apply it consistently. Treat reproduction failures as evidence that
the abstraction may be wrong.

Every public function needs a docstring that cites at least one motivating sketch path and
gives the observed-useful parameter ranges from the sensitivity data.

## Phase 4 — Templates, scripts, documentation

- Project templates: a small number of ready-to-run starting points, each a real working
  piece, derived from the dominant composition/technique clusters you found (full-bleed
  noise field, scattered/packed forms, polar/radial, grid-with-jitter, 3D mesh, etc.).
- Helper scripts: seeded render, parameter sweep, contact-sheet generation, and palette
  extraction/application.
- Documentation: a getting-started path; a per-module reference; and — the piece that
  makes this worth more than the sum of its functions — a "techniques" guide that explains
  each idiom, when it's used, which parameters actually matter, and what they do visually,
  with example images supplied by a full external survey-output checkout.

# Working discipline

- Keep a checkpoint/state file in this repo: current phase, decisions made (with
  rationale), open questions, what's next. Update it as you go and read it first on
  resume. Assume you will be interrupted.
- Ground every claim in the data. Cite sketch paths and notes when you assert that a
  technique or parameter behaves a certain way. Never invent a technique the corpus does
  not exhibit, and never describe a visual effect you have not seen in a render or read in
  a note.
- Distinguish what the corpus shows from what you think would be good design, explicitly
  and out loud, whenever they diverge.
- Prefer reading and reasoning over rendering. Render only when visual evidence is needed.
- Surface major technique-family rejections and any point where the survey data is too
  thin or dirty to support a decision. Otherwise keep moving without asking permission.

## Implementation workflow skills

These workflows do not relax the Phase 2 gate. Use them only at their stated lifecycle
point:

- Before exposing, defaulting, bounding, or documenting an inadequately evidenced
  parameter, follow
  [`skills/parameter-evidence/SKILL.md`](skills/parameter-evidence/SKILL.md).
- After a completed-corpus Phase 2 keep/merge decision, define the language-neutral
  operation through
  [`skills/operation-contract/SKILL.md`](skills/operation-contract/SKILL.md) before code.
- If its semantics consume RNG, noise, time, observable iteration order, or portable
  floating-point calculations, follow
  [`skills/deterministic-generative-semantics/SKILL.md`](skills/deterministic-generative-semantics/SKILL.md).
- Implement the portable core and every claimed target through
  [`skills/portable-operation-implementation/SKILL.md`](skills/portable-operation-implementation/SKILL.md).
- For renderer, shader, font, image, pixel, asset, lifecycle, or third-party behavior,
  apply
  [`skills/capability-and-adapter-boundaries/SKILL.md`](skills/capability-and-adapter-boundaries/SKILL.md).
- Validate each runnable operation and port against motivating survey work through
  [`skills/corpus-reproduction/SKILL.md`](skills/corpus-reproduction/SKILL.md).

Parallelize frozen-contract investigation and target-port work through available capacity.
Keep one integration owner for the catalog and shared fixtures. Serialize Processing
renders through one pausable executor and keep their multi-gigabyte output outside Git.

### Deferred skill creation gates

Add the following skills only when their real inputs and surfaces exist; record each in
`PROJECT_STATE.md` when added:

- At Phase 3 implementation kickoff, before the first per-frame, count-, resolution-, or
  mesh-sensitive operation, add `skills/generative-performance/SKILL.md`. It must cover
  allocation-free inner loops, bounded work, representative-range benchmarks, memory, and
  output-preserving optimization.
- As soon as the operation catalog has a generated or mirrored consumer—and before the
  first MCP schema, web control, exporter, or duplicated target metadata—add
  `skills/catalog-surface-synchronization/SKILL.md`. It must make the catalog the only
  authority and verify every derived surface.
- After Phase 2 defines the recipe schema and before accepting the first persisted recipe,
  executor, or exporter, add `skills/recipe-execution-and-validation/SKILL.md`. It must
  cover schema/type/capability validation, explicit environment, deterministic execution,
  round-trip serialization, and all claimed targets.
- After the catalog and recipe executor work, but before implementing natural-language MCP
  planning or its first prompt benchmark, add
  `skills/prompt-to-recipe-evaluation/SKILL.md`. It must score semantic predicates,
  provenance, execution, cross-target behavior, visual results, and coverage rather than
  one exact recipe syntax tree.

# Done means

A package a competent Processing user can install, read for twenty minutes, and use to
build a new piece in any of the corpus's major idioms — with each function traceable back
to the sketches that justify it, and each documented parameter range backed by a measured
visual-change score rather than a guess.
