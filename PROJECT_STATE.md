# Project state

## Current phase

Phase 1 is complete for the checked-in survey snapshot. Phase 0 chose and proved the
reference form; Phase 1 produced the re-runnable SQLite corpus and analysis artifacts.
Cross-language architecture, corpus visual benchmarking, and MCP/web requirements are
recorded without choosing the gated API. Work is paused at the Phase 2 gate until the
maintainer publishes all 901 target reports.

## Survey status

Checked 2026-09-06:

- Upstream survey status: 855 completed reports including 26 stubs, 144 pending retry,
  75 of 901 targets remaining, and 826 `notes.md` files written.
- The checked-in `survey/` snapshot contains those 826 reports plus 2,127 baseline and
  4,584 variant result files.
- Three survey workers were active when the snapshot was captured.
- Do not start Phase 2.

## Decisions

- Reference implementation: Processing 4 native Java library distributed as a JAR. Required ports: p5.js, py5, and Processing for Android/Android Mode. Java is not the behavioral specification. Rationale: `docs/target-form.md`; portability contract: `docs/portability.md`.
- PDE files remain the example/template format, not the reusable implementation format. Portable algorithms use JSON-compatible values and renderer-neutral geometry/command streams; host types remain in thin adapters.
- Phase 1 storage: normalized SQLite with atomic full-database replacement. This prevents stale rows and duplicate accumulation as notes arrive.
- Ingestion uses only Python's standard library. Its YAML-subset parser handles the survey schema, recovers known malformed notes, preserves raw frontmatter, and emits provenance-linked diagnostics rather than silently discarding a sketch.
- Controlled-vocabulary normalization is explicit in the `normalizations` table. Unknown values become null or are dropped from normalized join tables while the raw frontmatter remains available.
- Phase 2 candidate clustering and public API signatures remain deliberately undecided until the corpus is complete.
- MCP server and companion web app are required delivery targets. Natural-language planning must produce a validated, portable sketch recipe from one operation catalog shared by language adapters, MCP schemas, documentation, UI controls, and exporters. Details: `docs/mcp-web.md`.
- The exact operation catalog, recipe schema, MCP tools, and prompt-suite cases remain Phase 2 decisions because they depend on complete-corpus clustering.
- Implementation workflow is now codified as gated skills: approved operation contract; deterministic semantics where applicable; portable core plus four claimed target adapters; explicit capability boundaries; motivating corpus reproduction. These workflows do not permit Phase 2 work before survey completion.

## Completed artifacts

- `tools/sync_survey.py` and `survey/`: idempotent, allowlisted publication of reports,
  render-result metadata, methodology, and upstream provenance. Machine-local paths are
  replaced; multi-gigabyte images, logs, builds, environments, and copied assets are excluded.
- `docs/target-form.md`: Processing 4 native JAR reference decision and Phase 0
  feasibility result. The observable behavior remains language-neutral.
- `tools/ingest.py`: discovers every `survey/out/**/notes.md`, normalizes it, adds
  baseline and variant facts, validates relational constraints, runs
  `PRAGMA integrity_check`, and atomically replaces `data/corpus.sqlite`.
- `data/corpus.sqlite`: 826 sketches, 3,560 parameter records, 1,934 reusable-candidate
  records, 4,578 variant records, and provenance views for parameters and candidates.
- `tools/report.py`: generates technique frequency/co-occurrence/association tables,
  candidate-name distribution, parameter sensitivity, objective variant-diff summaries,
  applied normalizations, and diagnostics.
- `reports/corpus.md`: Phase 1 corpus-shape report for the public snapshot.
- `reports/parameter-sensitivity.csv`: all 3,560 parameter records with defaults, tried
  values, measured score, effect, provenance, signal band, and evidence warnings.
- `tools/build_benchmarks.py` and `benchmarks/corpus.json`: corpus-wide manifest for
  externally stored baseline frames, with explicit p5.js, py5, Android, and Java targets.
  Current snapshot: 980 required cases across 800 sketches; 26 stubs are excluded.
- `tools/benchmark.py`: objective cross-renderer metrics, profile gates, missing-case
  failures, coverage, per-technique/renderer breakdowns, JSON output, and concise Markdown.
- `tests/test_ingest.py`: parser recovery, vocabulary normalization, atomic rerun,
  provenance, and database-integrity contracts.
- `tests/test_benchmark.py`: exact metrics, divergent-image failure, dimension mismatch,
  missing-case coverage failure, all-frame discovery, target registration, and stub exclusion.
- `docs/architecture.md`: high-level system/data/runtime/MCP diagrams, repository map,
  verification model, and contribution workflows.
- `docs/mcp-web.md`: MCP/server, portable recipe, companion p5.js preview, four-target
  export, safety, and objective prompt-benchmark requirements.
- `skills/`: gated workflows for parameter evidence, operation contracts, deterministic
  semantics, portable implementation, capability boundaries, and corpus reproduction.

Rebuild the public snapshot and derived data:

```sh
# Maintainers with sibling source checkouts only
uv run python tools/sync_survey.py

# Works from any normal clone
uv run python tools/ingest.py
uv run python tools/report.py
uv run python -m unittest discover -s tests -v

# Requires the external full survey output containing baseline PNGs
uv run python tools/build_benchmarks.py --survey-root ../genart-survey
uv run python tools/benchmark.py \
  --reference-root /path/to/genart-survey \
  --candidate-root /path/to/rendered-cases \
  --target p5js
```

## Evidence read

Survey brief, notes schema, render methodology, and 17 reports spanning 2014–2020. The
set includes JAVA2D/P2D/P3D, static and animated sketches, deterministic and
non-deterministic output, shader work, typography, recursion, subdivision, noise
displacement, flow fields, Delaunay geometry, physics, and two blank-baseline stubs.

Representative paths:

- `survey/out/2014/Generativos/Arboles/notes.md`
- `survey/out/2014/Generativos/circulos2/notes.md`
- `survey/out/2014/Generativos/circulosFormas/notes.md`
- `survey/out/2014/Generativos/Helvetica/helve1/notes.md`
- `survey/out/2015/Generativos/cityPink3d/notes.md`
- `survey/out/2015/Generativos/dataBall/notes.md`
- `survey/out/2015/Generativos/triangulitos/notes.md`
- `survey/out/2016/Generativos/noiseGrids/notes.md`
- `survey/out/2016/Generativos/circlesquads/notes.md`
- `survey/out/2018/Generativos/ailan/notes.md`
- `survey/out/2018/Generativos/araniaaas/notes.md`
- `survey/out/2018/Generativos/arbolito4/notes.md`
- `survey/out/2018/Generativos/mapFly/notes.md`
- `survey/out/2019/generativos/flowwers/notes.md`
- `survey/out/2020/generative/01_04/fieldop/notes.md`
- `survey/out/2020/generative/01_04/fractal001/notes.md`
- `survey/out/2020/generative/05_08/scicirgold/notes.md`

## Data-quality findings to preserve

- 26 reports are blank/unrenderable stubs.
- One empty parameter map remains in the dataset with an `empty_parameter` warning.
- The current ingestion emits 54 warnings and no errors; malformed records remain linked
  to their source report.
- Parameter values mix scalars, lists, expressions, and quoted ranges, so defaults and
  tried values are JSON rather than coerced numeric columns.
- The snapshot records 148 explicit normalization events, including vocabulary mappings,
  invalid change scores, and structurally malformed parameter/candidate rows.
- Shader visual evidence rendered under Xvfb must be treated as suspect. This snapshot
  contains no such baseline among the analyzed reports.

## Next

1. When the maintainer publishes more survey work, run `tools/sync_survey.py`, ingestion,
   reporting, and benchmark-manifest generation; commit the snapshot and derived artifacts
   together.
2. If and only if `survey/snapshot.json` reaches all 901 target reports, begin Phase 2
   candidate clustering and API design.
3. Preserve the portable-core/adapter boundary and define the language-neutral operation
   catalog and recipe schema before implementation.
4. After each Phase 2 keep/merge decision, apply the gated implementation skills listed in
   `AGENTS.md`.
5. Add deferred skills only at the lifecycle gates recorded in `AGENTS.md`.
