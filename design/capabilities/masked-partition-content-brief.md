# Irregular partitions with replaceable content — root investigation brief

Status: architectural investigation, not an admitted API or delivered capability.
Baseline: Java0.33.0, 30 operations and 35 workflows. Repository documentation checkpoint
27fae895 adds direct-use guidance without changing the accepted distribution.

## User task and admission test

Generate a layout, then independently select what appears in each partition: a window onto
one retained larger drawing, a local composition, or a selected image crop. Change the
layout without changing the content algorithm; change content without changing the layout.
The rectangular version already exists in Java2DRegions. The remaining usability question
is whether irregular masks can use the same callback experience without repeated manual
layer-render/composite loops. Do not add another partition generator for this purpose.

Root's preferred direction is a rendering-adapter convenience over the existing
Java2DLayers.render/alphaMask/composite primitives. Partition identity and coordinate bounds
remain distinct from raster coverage. A coverage mask is visibility data, not geometry
that can constrain simulation, triangulation or path tracing. Keep the existing rectangular
API and its accepted pixel behavior intact. Public signatures remain to be frozen after
the implementation/reuse audit.

## Semantics to settle before implementation

- Preserve CANVAS and LOCAL: the latter translates to supplied bounds, without implicit
  normalization or scaling. A mask lives in destination pixels in both modes.
- Stable caller-supplied IDs and ordered invocation support retained content selection.
  No automatic seed derivation, simulation update or hidden randomness.
- A mask may contain holes or disconnected regions. Do not silently intersect it with its
  coordinate frame: bounds provide placement information, whereas coverage determines
  visibility. Name these roles clearly rather than calling the frame an exact boundary.
- Coverage must be finite [0,1], row-major and dimension-matched. Alpha extraction already
  exists; opaque grayscale is not an alpha mask. Reuse existing encoded premultiplied
  source-over arithmetic. Adjacent masks do not imply normalized crossfading.
- Preflight invalid descriptors and coverage before content callbacks. Decide mask ownership
  and capture time explicitly so later callbacks cannot alter later region masks. Full
  snapshots cost O(regions*pixels); evaluate that cost before choosing an eager array API.
  Do not introduce a mask-producer callback merely to hide unbounded allocation or weaken
  validation ordering. An immutable retained mask representation is an alternative to assess.
- Preserve borrowed-target lifecycle, once/in-order calls, detached output, unchanged
  destination on failure and primary-exception cleanup behavior. External callback effects
  remain the caller's responsibility. No rectangle optimization may skip a callback whose
  mask is empty.

## Evidence and scope

The maintainer's composition request motivates this extension. Corpus evidence supports
replacing image content and constructing spatial masks, not this exact general API:

- survey/out/2017/Generativos/Eyes/eyes002/notes.md: modularisation describes image or drawing
  callback substitution in stamping patterns; the particular eye is an artistic choice.
- survey/out/2015/Generativos/circuloss/notes.md: mask construction and brightness-gated
  drawing occur in code, but the final opaque mask hides the colored drawing. This report
  supplies no measured useful soft-mask range and no visible masked-color reproduction.

JAVA2D, density one, RGB/ARGB input transport only for the initial adapter. No other-target
attestation, vector clipping, automatic object recognition, new filter, general effect graph,
or whole-corpus recreation claim follows from this work.

## Bounded implementation and review batch

1. Terra: read-only audit of existing adapters/examples/native harnesses; report reuse and
   hazards. Root decides whether added convenience materially removes repeated glue and
   freezes ownership, bounds/mask relation and public naming before implementation.
2. Implement only that boundary using existing kernels and lifecycle infrastructure.
   Avoid unrelated cleanup of already accepted adapters.
3. One native workflow: the same irregular partition layout shows continuous retained
   paths, independent local marks and a selected raster crop. A layout edit must retain
   source content; a content edit must retain mask data. Root views each distinct result.
4. Focused native assertions: mask-zero destination preservation, holes/disconnected areas,
   fractional-alpha source-over, CANVAS/LOCAL placement, ordered overlapping regions,
   invalid late mask before any content, throwing callback followed by successful render,
   input immutability and retained content reuse. Measure representative memory and runtime.
5. Only after root review: documentation, central visual gallery, catalog/adapter evidence
   as required and extracted-distribution acceptance. Keep drafts distinct from support.
