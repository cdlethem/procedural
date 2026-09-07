---
name: parameter-evidence
description: Gather reproducible visual evidence before exposing, defaulting, or documenting a generative-art parameter. Use when corpus evidence is sparse, unreliable, conflicting, or does not bound an implementation decision.
---

# Parameter evidence investigations

## Purpose

A parameter is public only when its effect and useful range are defensible. Existing survey
records are the first source of truth; new experiments close a specific evidence gap. Do
not substitute an intuitive default, a source-code literal, or a pixel-diff label for that
evidence.

Use this skill before changing any public parameter's existence, default, validation bounds,
recommended range, or documentation when the decision is not supported by at least two
relevant, reliable corpus observations. Also use it when the observations conflict, the
only evidence is unscored or from a non-deterministic sketch, a shader was rendered under
Xvfb, or the proposed range extends beyond values actually tested.

Do not investigate merely to add data. State the decision the result could change. If the
existing corpus already answers it, cite that evidence and proceed.

## Evidence ladder

1. Query `data/corpus.sqlite`, `reports/parameter-sensitivity.csv`, source notes, baseline
   metadata, and stored variants. Compare semantics, not just canonical parameter names.
2. Prefer reliable records: deterministic sketches; matching renderer and technique; valid
   baseline frames; and non-shader or GPU-display shader output. Treat Xvfb shader images,
   non-deterministic comparisons, blank/partial frames, and harness warnings as weakened
   evidence.
3. Reconcile the code with the render and note what the parameter controls: count, spatial
   scale, noise frequency/amplitude, temporal rate, opacity, stroke width, palette choice,
   angular span, or another concrete mechanism.
4. If a bounded decision remains unresolved, create an experiment brief. The brief must say
   what result would cause the parameter to be retained, hidden, bounded, or rejected.

A `moderate` or `large` pixel difference establishes that output changed, not that the
value is visually useful. Conversely, `none` or `subtle` is evidence against exposing a
parameter only after checking that the edited path ran, was visible in the captured frame,
and was not masked by timing or randomness.

## Experiment brief

Before rendering, write `evidence/parameter-experiments/<id>/experiment.json`. Keep new
artifacts in this repository; never modify the checked-in survey snapshot or upstream
source corpus.

Use this minimum schema (additional fields are allowed):

```json
{
  "id": "2026-09-04-noise-detail",
  "question": "Does noise detail need a public range for the proposed field operation?",
  "decision": "retain-and-bound | retain-unbounded | internalize | reject",
  "hypothesis": "Increasing detail creates a visibly finer field before aliasing dominates.",
  "source_sketches": ["2016/Generativos/noiseGrids"],
  "parameter": {"name": "detail", "default": 0.1, "unit": "normalized"},
  "baseline": {
    "path": "${GENART_SURVEY_ROOT}/out/2016/Generativos/noiseGrids/baseline",
    "deterministic": true,
    "renderer": "P2D"
  },
  "values": [0.025, 0.05, 0.2, 0.4],
  "comparison": "frame_00001.png, fixed seed 42, objective diff plus visual inspection",
  "constraints": ["one edited parameter per render", "at most eight attempted variants"],
  "provenance": ["reports/parameter-sensitivity.csv:..."],
  "status": "planned"
}
```

Choose two to six values, normally bracketing the observed default. Test a coarse low and
high first, then use the remaining budget to locate the useful transition or failure
boundary. Vary exactly one causal parameter in a render. Couple values only when the
public API would expose the pair as one inseparable parameter object; record the reason.

For count-like parameters, include a low readable value and a density/overlap limit. For
scale, frequency, amplitude, opacity, and stroke width, include the first visibly useful
value and the first value that causes clipping, aliasing, saturation, or loss of the
intended structure. For periodic values, test a meaningful fraction of the period as well
as the source default. Do not infer a continuous range from a single successful endpoint.

## Safe execution and scalable delegation

Investigation is parallelizable; rendering is not. Separate analysis workers from the one
render executor:

- Fan out independent evidence reads, source-line identification, and experiment-brief
  reviews to available external or remote agent capacity. Do not restrict evidence research
  to local child-agent slots when a configured external task runner is available.
- Give each investigator one parameter/question and require a compact result containing:
  semantic mechanism, reliable provenance paths, candidate values, risks, and the exact
  source line to substitute. They must not render or modify either corpus.
- Merge the findings into one brief before any render. Different investigators must not
  choose values against different baselines or silently redefine the parameter.
- Submit render work through a single, pausable executor. It consumes approved briefs one
  variant at a time; it must never run two Processing renders concurrently.
- Rendering requires maintainer access to the external full survey output, source corpus,
  and renderer. Confirm that the renderer is idle before using its shared build area.
  Public contributors without those inputs should submit the completed experiment brief
  rather than inventing results.

Use the external survey renderer only through its temporary-copy substitution flow. From
`${GENART_SURVEY_ROOT}`, a single corpus-source variant has this shape:

```sh
uv run tools/render.py '<sketch-relative-path>' \
  --out '${PROCEDURALS_ROOT}/evidence/parameter-experiments/<id>/variants/<parameter>_<value>' \
  --seed 42 --snaps 1,10,60 --budget 30 --timeout 90 \
  --sub '<entire unique original source line>' '<replacement line>'
```

`--sub` takes two separate arguments. Use a whole unique line; a missing or ambiguous
substitution invalidates that experiment. Do not re-render the baseline. Count failed
renders toward the eight-attempt cap. On timeout, try one cheaper value once only when it
still tests the question; otherwise mark the boundary unmeasured. Never alter the source
corpus, and never modify the survey's output directories.

For a library implementation experiment, retain the same seed, frame, renderer, and
comparison target, but use the repository's candidate render/benchmark path. Record the
implementation revision, recipe/configuration, and baseline case in `experiment.json`.

## Recording and deciding

For every attempted value, append a result to `experiment.json` with:

```json
{
  "value": 0.2,
  "status": "ok",
  "render_path": "evidence/parameter-experiments/<id>/variants/detail_0.2",
  "frame": "frame_00001.png",
  "diff": {"label": "moderate", "mean": 0.0, "pixel_fraction": 0.0},
  "observation": "Field becomes visibly finer while cell structure remains legible.",
  "warnings": [],
  "acceptable": true
}
```

Read the rendered image for every successful variant; do not report the intended code
behavior as an observation. Capture `result.json` warnings and status. For animated work,
compare every stored changing frame; for static work, compare frame 1 only. Do not use a
numerical acceptance threshold without a visual reason.

Finish with `decision.md` in the same directory:

- question and pre-registered decision rule;
- exact baseline, seed, frames, source substitution or candidate configuration;
- every attempted value and objective diff;
- visual observations and reliability warnings;
- recommended default, inclusive encouraged range, and hard validation bound when each is
  independently justified; or an explicit decision to internalize/reject the parameter;
- provenance links to both prior corpus records and new artifacts.

A recommended range is the observed region that preserves the intended visual mechanism;
a hard bound is only for values known to fail, become degenerate, or exceed a documented
resource constraint. Leave either absent when the experiment did not establish it. If the
result remains ambiguous, retain that uncertainty and queue a narrower follow-up rather
than inventing precision.

Update the operation documentation and `PROJECT_STATE.md` only after the decision is
recorded. Every public range must cite the decision artifact and motivating survey paths.
