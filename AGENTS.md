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

Survey data: ~/dev/genart-survey. Source corpus (READ-ONLY, never modify): ~/dev/processing_sketches
Your own work lives here, in ~/dev/procedurals.

- out/<sketch>/notes.md — one per surveyed sketch. YAML frontmatter (schema in
  NOTES_TEMPLATE.md; controlled vocabularies in AGENTS.md) plus four prose sections:
  "What it draws", "How the code works" (cites .pde line numbers), "Experiments"
  (parameter substitutions with measured pixel-diff scores), "Modularisation notes"
  (the surveying agent's own generic-vs-one-off judgement).
- out/index.jsonl — per-sketch render facts: renderer (P2D/P3D/JAVA2D), size, imports,
  jars, deterministic, animated, uses_shader, ms_first_frame, per-frame md5, year.
- out/<sketch>/baseline/frame_0000{1,10,60}.png + result.json — ground-truth renders (seed 42).
- out/<sketch>/variants/<param>_<value>/ — parameter experiments, each result.json
  carrying diff_vs_baseline (none | subtle | moderate | large, with mean + pixel fraction).
- out/loop-status.jsonl — run log; status ok | needs_retry per sketch.

Scale to expect at completion: ~901 notes, ~1,800 proposed reusable_candidates,
~3,400 parameter-sensitivity records.

Available libraries (jars in tools/libs, auto-copied into builds): toxiclibs 0021,
triangulate, PeasyCam, Minim. Nothing else is installable.

## Known data quality problems — handle these, don't be surprised by them

- tools/aggregate.py is BROKEN: its fallback YAML parser throws AttributeError and pyyaml
  is not in the uv env. Fixing/replacing it is your first concrete task.
- ~5 notes have unparseable frontmatter; ~26 sketches are stubs (blank/unrenderable);
  ~52 runs are needs_retry and may land later.
- Controlled vocabularies leaked: "scattered" appears as a technique (it's a composition
  value), "random-hsb" as a palette selection, "arc"/"box" as primitives. Normalize,
  and record every normalization you apply.
- Headless GLSL caveat: sketches rendered under xvfb (result.json display "xvfb" +
  uses_shader true) may have mis-rendered shaders. Those notes' visual claims are suspect;
  weight them accordingly and prefer sketches rendered on ":2".
- The survey is STILL RUNNING and notes keep arriving. Build ingestion to be idempotent
  and re-runnable; start work on the completed subset and re-ingest as the corpus grows.

# Hard constraints

- Never modify anything under ~/dev/processing_sketches. Read only.
- Do not stop, restart, or reconfigure the running survey (systemd user units
  genart-survey-0/1/2) or the shared model server (llama-qwen.service). Another session
  owns those.
- GPU/CPU contention is real: the 3 survey shards plus a 27B llama-server are using the
  machine. Any batch rendering you do must be throttled, run one at a time, and be
  pausable. Prefer reusing tools/render.py and the existing headless setup over inventing
  a second rendering path.
- Keep everything you produce inside ~/dev/procedurals. Do not scatter files into
  genart-survey/out.

# Phase gating — IMPORTANT

Do Phase 0 and Phase 1 NOW, on the sketches surveyed so far.

Then STOP and wait for the survey to finish before starting Phase 2. Clustering ~1,800
candidate functions is the decision that shapes the entire API, and doing it on a partial
corpus means redoing it. Rare techniques (flow-field, voronoi, physics, l-system) appear a
handful of times across the whole corpus and may not have landed yet at all.

The survey is complete when `cd ~/dev/genart-survey && uv run tools/status_report.py`
reports 0 remaining (target 901 generative sketches) and
`systemctl --user list-units --plain --no-legend 'genart-survey*'` shows no running units.
Check on resume; do not poll in a tight loop.

While waiting, useful work that does NOT commit you to an API shape: harden the ingestion,
extend corpus analysis and reporting, build and test the render/diff validation harness you
will need in Phase 3, and deepen your reading of notes as they arrive. Do not begin
clustering, do not design signatures, do not start implementing library functions.

# Phases

## Phase 0 — Orient and choose the target form (do this first, timebox it)

Read genart-survey's AGENTS.md, NOTES_TEMPLATE.md, tools/render.py, and 15-20 notes.md
spanning different years, renderers, and techniques (include at least one shader sketch,
one 3D, one animated, one non-deterministic).

Then decide and write down, with rationale, the deliverable's form. The corpus is
Processing/Java .pde; the user's rig renders Processing headlessly. Weigh at minimum:
(a) a Processing-native library — .java compiled to a jar, usable from the PDE;
(b) a set of .pde template tabs + a copy-in "core" tab, zero build step;
(c) py5 or another host language.
Recommend one, state the trade-offs in one page, proceed with it, and flag the decision
prominently in your first checkpoint so the user can veto cheaply. Do not silently
re-litigate this later.

Also produce a throwaway end-to-end spike: reproduce ONE surveyed sketch's baseline image
using your chosen form and diff it against out/<sketch>/baseline/frame_00001.png. If you
cannot close that loop, everything downstream is guesswork — solve it before Phase 1.

## Phase 1 — Build a queryable corpus, not a pile of markdown

Replace/repair aggregate.py into a robust ingestion that emits a single structured dataset
(SQLite or a well-shaped JSON/parquet — your call) containing, per sketch: all frontmatter
fields normalized against the controlled vocabularies, plus every parameter record
(name, default, values tried, change score, effect text) and every reusable_candidate
(name, signature, note), each carrying a provenance pointer back to sketch + notes path.

Keep your copy of the ingestion in this repo; do not edit genart-survey's tools in place.

Report the shape of the corpus once you can query it: technique co-occurrence, which
techniques cluster with which primitives/renderers/compositions, how candidate proposals
distribute, and — most importantly — which parameters actually produced "large"/"moderate"
visual change versus "none"/"subtle".

That last table is the highest-value artifact in the whole survey. A parameter that
repeatedly scored "none" is evidence AGAINST exposing it in an API. Treat measured
sensitivity as the primary signal for what belongs in your function signatures and what
the sane default ranges are.

Phase 1 output is a report and a re-runnable pipeline, not an API. End of phase: stop and
wait for survey completion (see Phase gating above).

## Phase 2 — Cluster candidates into an API surface (GATED: full corpus only)

~1,800 proposed candidates are mostly near-duplicates of each other. Cluster them by what
they actually compute (not by name), and for each cluster identify the sketches that
motivate it, the union of parameters observed, and the minimal general signature that
covers the real usages.

For every cluster, make an explicit keep/merge/reject call and record the reason. Reject
aggressively: the notes' "Modularisation notes" sections already separate generic
machinery from one-off art decisions — honor that distinction. A one-off aesthetic choice
that appears in a single sketch is not a library function.

Deliver a written API design — module layout, naming conventions, composition story (how
functions combine: what's a generator, what's a transform, what's a sink), and the
parameter-object convention — BEFORE implementing. Include what you deliberately left out
and why. Target roughly 30-80 well-chosen functions, not 400; if you find yourself
approaching several hundred, you have failed to cluster.

Cover the long tail deliberately: grid and noise-field are over-represented (94 and 92
sketches in the first quarter of the corpus), but flow-field, voronoi-delaunay, physics,
l-system and typography appear a handful of times each and are exactly the techniques a
user cannot re-derive easily. Decide explicitly whether each rare technique is in or out;
don't let it fall off the edge by accident.

## Phase 3 — Implement with reproduction as the test

Implement in dependency order, and validate empirically: pick a representative set of
surveyed sketches (spanning renderers, techniques, 2D/3D, static/animated) and rewrite
each on top of your library, then render and diff against its stored baseline using the
existing harness.

You will not get pixel-identical output — random streams differ, and 61 sketches are
non-deterministic anyway. Define up front what "successfully reproduced" means (structural
/ perceptual similarity, technique-level equivalence, human-judgeable side-by-side) and
apply it consistently. Reproduction failures are findings: they usually mean the
abstraction is wrong, not that the sketch is special.

Every public function needs a docstring that cites at least one motivating sketch path and
gives the observed-useful parameter ranges from the sensitivity data.

## Phase 4 — Templates, scripts, documentation

- Project templates: a small number of ready-to-run starting points, each a real working
  piece, derived from the dominant composition/technique clusters you found (full-bleed
  noise field, scattered/packed forms, polar/radial, grid-with-jitter, 3D mesh, etc.).
- Helper scripts: seeded render, parameter sweep (reuse the --sub/diff machinery that
  already exists), contact-sheet generation, palette extraction/application.
- Documentation: a getting-started path; a per-module reference; and — the piece that
  makes this worth more than the sum of its functions — a "techniques" guide that explains
  each idiom, when it's used, which parameters actually matter, and what they do visually,
  with example images. You have baseline and variant renders for all of it; use them.

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
- Prefer reading and reasoning over rendering. Renders are expensive and the machine is busy.
- Surface to the user: the Phase 0 form decision; any large rejection (a whole technique
  family you're dropping); and any point where the survey data is too thin or too dirty to
  support a decision. Otherwise keep moving without asking permission.

# Done means

A package a competent Processing user can install, read for twenty minutes, and use to
build a new piece in any of the corpus's major idioms — with each function traceable back
to the sketches that justify it, and each documented parameter range backed by a measured
visual-change score rather than a guess.
