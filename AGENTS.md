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

## Recreation coverage — maintainer revision

Evaluate marginal original-sketch recreation coverage alongside API clarity and upkeep.
Follow docs/recreation-coverage.md: distinguish demonstrated recreation, plausible complete
composition, known algorithmic gaps and unassessed evidence. Ordinary artistic drawing/glue
is allowed; hidden one-off algorithms are not coverage. Do not equate starter counts,
technique tags or near-duplicate frequency with recreated sketches. Root retains final
admission judgment; no full-corpus re-audit is required before each bounded capability.

## Architectural priority — maintainer revision, 2026-09-07

Capability and clarity take priority over completeness. Root is the main architect:
personally read decisive evidence, select artist-facing entry points, decide the public
boundaries and review complete examples. Follow `docs/artist-capabilities.md` before
assigning further candidate batches. Start from an artistic task and the algorithmic
burden the package removes; report frequency and ledger throughput do not establish value.

Use a more capable architecture subagent (gpt-5.6-sol, high reasoning) for independent
challenge of consequential boundaries. Root makes the final decision. Luna/Terra should
handle bounded evidence retrieval, mechanical checks and implementation against frozen
contracts, not independently determine the public API from bulk candidate summaries.
No model's authority substitutes for checking the report and exact candidate identity.

The first artist milestone is a complete independent field-oriented mark sketch (CP1),
with an integrated-path counterexample (CP2) reviewed alongside it. Triangle sampling is
an optional engineering experiment. Provide working native examples and meaningful editing
tasks early; do not defer the artist's experience until after a complete function inventory.
Useful compound conveniences are permitted when they preserve clear substitution points
and compose shared operations. Tiny primitives alone are not an adequate artist toolkit.

## Delivery priority — maintainer revision, Java first

After closing the in-flight CP3 contract/fixture review, prioritize additional reusable
operations and complete artist workflows on Processing Java. CP1 and CP2 already proved
the four-target route. CP3 implementation and subsequent capability expansion may ship
validated Java-only slices; batch p5.js, py5 and Android ports later. Do not require three
new ports before admitting the next useful artist capability. Preserve language-neutral
contracts and shared fixtures, record deferred targets explicitly, and claim support only
where native evidence exists. Porting remains part of the overall roadmap, not cancelled.
Root owns architecture and workflow breadth; delegate bounded Java implementation and
evidence retrieval. This revision supersedes earlier four-target-per-slice scheduling.
During this buildout sprint, pause Sol/external review assignments. Root directly reviews
architecture, contracts, implementation and artist examples; shared fixtures and meaningful
native validation still apply. This supersedes earlier mandatory independent-review
scheduling for the sprint. Resume reviewer assignments only when the maintainer requests
it or the sprint is explicitly closed.

## Sustainable development — maintainer revision

The maintainer reports roughly60% of weekly quota consumed and requests a lower-cost
workflow after the current logical stopping point. Do not start CP11 or broader research
while closing CP10. The existing Java0.9 package remains a usable accepted delivery;
CP10 core and staged sketch are a valid resumable checkpoint if finishing its visual
validation would require substantial new infrastructure. Do not keep an automatic root
continuation doing speculative work merely to occupy available capacity.

Keep the full project objective; change execution economics, not completion claims.
Luna handles bounded evidence retrieval, docs, routine fixes and established test runners.
Terra owns coherent implementation/example slices against approved behavior, including
first-pass debugging and validation. Root selects artist capabilities and reviews public
contracts, numeric/state/ownership risks, representative evidence and final integration.
Root need not author all helpers, probes, packaging scripts or routine test glue.

Use short task-specific briefs with exact files and relevant contracts, not repeated
full-history forks. Reuse established harnesses and packaging workflows. Run focused
checks once per meaningful change; repeat only for a failure, changed inputs or a specific
unresolved concern. Do not introduce a new checker, dossier or render matrix by default.
For each new operation choose a small set of acceptance scenarios that distinguish likely
semantic bugs and demonstrate a useful editable sketch. Numerical robustness, provenance,
real target execution and honest support claims remain required. Count scenarios and
capabilities in progress reports, not loop-expanded assertions.

Batch independent routine changes for one root integration review. Escalate actual API
ambiguity, conflicting evidence or persistent substantive failures; workers resolve ordinary
implementation bugs without root reviewing every iteration. Before the next buildout batch,
record a prioritized bounded deliverable list, model ownership and stopping conditions.
Do not invent quota balances, prices or a reliable finish-date estimate.

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
- `analysis/phase2/` and `design/phase2/candidate-triage.json` are also generated; use
  their inventory/triage tools. `design/phase2/cluster-decisions.json` is authored review
  state: never overwrite it with generated suggestions when evidence changes.
- Do not add rendered survey images, logs, temporary builds, environments, or copied
  assets to Git.
- Keep all new project work inside this repository.

# Phase policy

Phase 0 and Phase 1 are complete. The maintainer authorized Phase 2 to begin from the
current 826/901-report snapshot (91.7% complete), superseding the original full-corpus
gate. Clustering and public API design may proceed now. Implementation may follow a
written API design and complete, reviewed operation contracts without waiting for 901
reports. An evidence gap blocks the affected decision, not the entire project.

The checked-in `survey/snapshot.json` and target identities in `survey/out/index.jsonl`
are the public evidence authority. Record the evidence revision and source-note hashes
for decisions. On each published snapshot, reconcile added, changed, and removed records;
review affected clusters, rejections, parameter choices, and target claims. Do not carry
a contract approval across changed evidence without recording that review. Never infer
family absence from missing reports.

Follow `docs/roadmap.md` and `docs/agent-briefs.md`. Delivery is library-first: the initial four-target proof is complete; expand artist
capabilities on Processing Java now, then batch the deferred ports before their support claims.
Deliver scoped capability milestones with declared semantic, edit/transfer and reproduction
acceptance. A useful scoped package need not reproduce the whole corpus. Full-corpus
certification remains a separate strict claim; never represent a selected suite as that
claim. Four-target support still requires evidence on all four targets.

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

## Phase 2 — Cluster candidates into an API surface (ACTIVE: incremental evidence)

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
and why. The earlier 30-80 estimate is not a quota or minimum. Keep the public surface
small enough to learn; every operation and convenience must add a named artist capability.
Candidate-wide adjudication is research progress, not a prerequisite for a scoped package.

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

These workflows preserve operation-level evidence and contract prerequisites. They do
not require all 901 reports. Use them at their stated lifecycle point:

- Before exposing, defaulting, bounding, or documenting an inadequately evidenced
  parameter, follow
  [`skills/parameter-evidence/SKILL.md`](skills/parameter-evidence/SKILL.md).
- After a reviewed, evidence-versioned Phase 2 keep/merge decision or explicit capability-dependency
  admission (without falsely merging its composite consumers), define the language-neutral
  operation through
  [`skills/operation-contract/SKILL.md`](skills/operation-contract/SKILL.md) before code.
  First pass `tools/check_phase2_design.py --contract-cluster <id>` for recorded architecture
  and member-audit prerequisites. That structural check does not replace semantic review.
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

## Baseline publishing and independent ports — maintainer revision

Root may commit reviewed project-owned milestones and push to main without further approval.
Check remote state first; integrate safely, never force-push or discard another worker's work.
Track necessary implementation/contracts/fixtures/docs/evidence and clearly identified drafts;
exclude renders, toolchains, environments, temporary builds, logs and copied assets.

The separate porting agent works on a branch/check-out pinned to root's pushed baseline.
Root continues Java architecture/buildout and retains final integration authority. Porting
workers may propose patches and native evidence but must not author root acceptance records
or update shared support attestations as accepted. Root reviews semantic choices, patches and
representative native results before merging or accepting target support.

Every native render on this machine, from EVERY checkout, must run through:
`python3 tools/with_native_render_lock.py -- <existing native command>`.
The common lease is `/home/colin/dev/procedural/.work/native-render-machine.lock`.
It deliberately does not follow checkout location. Existing checkout-local locks remain
subordinate; do not bypass the shared lease or delete its file to resolve contention.
