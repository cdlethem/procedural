---
name: prompt-to-recipe-evaluation
description: Design or evaluate natural-language generation of Procedurals studio layers, compositions, recipes and isolated code artifacts, including blind visual-description recreation benchmarks.
---

# Prompt-to-recipe evaluation

Read the current studio binding and executor status before choosing an output format.
Use [the harness design](../../docs/prompt-studio-harness.md) for the proposed tool and
benchmark boundary. Design status is not executable support. Existing catalog/executor
work permits this evaluation design; a runtime claim still needs its own acceptance.

## Generation contract

Freeze prompt, target, editing scope, canvas, seeds, time, assets, capability snapshot
and attempt/work budgets before a run. Preserve manual edits outside that scope.
Distinguish existing studio workflows, catalog recipes and target-specific code artifacts.
Code is never an expression or escape hatch inside the portable recipe evaluator.
Use catalog identities, schema references and actual execution bindings; native method
availability does not imply recipe binding, browser support or target acceptance.

## Evaluation

Record separate outcomes for:

- Semantic predicates: requested objects, layout, palette, density, layering, motion and
  forbidden features. Accept equivalent programs and layer decompositions. Do not require
  a particular operation unless the prompt explicitly requires it.
- Provenance: catalog/runtime hashes, retrieved documentation, model configuration,
  tool transcript, code/assets and dependencies. Distinguish ordinary drawing glue,
  project operations and custom algorithms; code fallback cannot close package coverage gaps.
- Execution: structural/type admission, capability preflight, resource limits, actual
  compile/render, errors, deterministic replay and meaningful parameter edits.
- Cross-target behavior: evaluate each claimed target in its runtime. Mark unattempted
  targets unassessed; a Java raster displayed in a browser is not a p5 implementation.
- Visual behavior: declare exact, structural/perceptual or technique scope before rendering.
  Use reviewed prompt-specific predicates alongside metrics and independent visual review.
  Record missing outputs and failures; do not score a failed render as a successful image.
- Coverage: name selected cases, technique families, exclusions, evidence revision and
  assessed/full denominators. Separate demonstrated, plausible, unsupported and unassessed.

Use recorded outputs for deterministic harness regression; live model runs measure quality
distributions. Record first attempt and final bounded attempt, resource use and failures.
Do not tune on the test split or accept one exact recipe/source string as ground truth.

## Blind recreation

Use an isolated generator workspace and tool service with no survey sources, notes,
images, examples, Git history or benchmark answers. A prompt saying “do not peek” is
insufficient. Audit transitive retrieval, library examples and provenance links for leaks.
Preserve full provenance privately while exposing a sanitized catalog view to the generator.
Record residual prior exposure; do not claim model-training decontamination.

An image-only describer freezes visual text without source-derived algorithm hints.
The generator sees that text and its own output images, never the reference image or
hidden evaluator feedback in the primary track. A privileged evaluator receives the frozen
submission afterward. Separate image-conditioned and feedback-assisted tracks explicitly.
Compare visible behavior first; source/algorithm resemblance is a post-submission diagnostic
because visual descriptions cannot uniquely identify code.

Native renders use the shared machine lease. Register meaningful images in the existing
visual gallery, label review stage, and keep images/logs/builds in ignored `.work/`.
Do not promote benchmark results into shared operation support automatically.
