# Java completion reconciliation after CP25

Root review, Java0.28 main eb9278b3deeb6272e5147a252e39ee18d7cd2371.
This is a remaining-work decision, not feature-completeness acceptance. The original five
requirements in java-completion-plan.md remain unchanged.

| Requirement | Inspected evidence | Current conclusion / remaining action |
|---|---|---|
| Install and edit extracted distribution | cp25-java-review.json and placement-consumer report: all29 PDEs compile, actual8-state native consumer | Strong evidence for delivered package; finish guide/reference consistency audit across current entry points. |
| Major idioms and explicit family boundaries | Current workflow map plus decisive notes below | Image-to-control-field and active postprocessing remain concrete gaps. Typography/Voronoi extensions require accurate dispositions, not tag-based support claims. |
| Reviewed admitted operation semantics and native use | Catalog checker passed at CP25; placement root probe/workflow/distribution reviewed | Current milestone is scoped accepted; new computation needs its own boundary/evidence. Missing Javadocs still limit self-contained discovery. |
| Composability and assessed originals | CP23–25 regions/layers/masks/placement, actual content/fit/crop/mask edits | Spatial composition demonstrably improved. Image-driven parameters and filters must reuse these boundaries. No increase in original-recreation count follows automatically. |
| Coherent docs/tooling/licensing/performance | Source-bundle checks, unchanged113 core/7 prior adapter classes, explicit native scope | Final documentation reconciliation and representative performance summary remain; no broad rerender needed for unchanged code. |

## Next bounded batch: image attributes and postprocessing

D1 — Image attributes (root architecture, Terra implementation only after freeze).
Artist task: use a photograph or retained drawing to control the size/color/visibility of
marks at existing positions, then substitute a different image without changing the layout.
crb#0 explicitly sizes rejection candidates from image brightness; crb#1 also gates strokes
by brightness. This is stronger direct evidence than the earlier bounded search found.
No parameters were experimentally isolated: do not promote its size multipliers, thresholds,
noise settings or1.4million candidate count into library defaults. Its prose says a walk
stops when brightness differs by≤30 while interpreting this as an edge; source inspection
is required before any edge-following/stopping operation. Do not admit that algorithm now.

First implementation decision: whether an immutable image snapshot with explicit color,
alpha and named scalar sampling can reuse RasterRemap2D without silently changing its
straight-channel semantics. Distinguish Processing brightness(max RGB) from weighted
luminance; alpha is independent of both. Define coordinates/bounds/interpolation explicitly.
Demonstrate image-driven sizes and a second consumer (mask or mark visibility) with supplied
layout. Sampling and size mapping must stay separate; no giant image-to-art monolith.

D2 — Postprocessing (root source investigation, frozen implementation afterward).
Artist task: soften or directionally smear a retained drawing and mix the filtered result
with its source using the existing masks/crossfade. cityPink3d#2 actively chains blur,
scanlines and vignette; rgblur#0 actively chains horizontal/vertical shader blur, with a
mask coupling described in the note. These prove a gap beyond raster coordinate warping.
Separate generic filtering from specific orange/black vignette colors and fixed pass counts.
The notes do not isolate useful filter settings, and headless shader evidence is suspect.
Read the actual filter arithmetic and inspect a small direct before/after before choosing
a portable convolution or native shader adapter. Do not copy a shader without MIT notice
and explicit provenance. Do not invent a blur radius range from source constants.

Stop this batch at one integrated image-control workflow and one evidenced filter workflow,
with exact required parameter/alpha/capability contracts. Independent evidence retrieval may
run alongside implementation once boundaries freeze; native rendering remains serialized.
Package the accepted batch together. Root reviews complete tests, not worker summaries:
CP25 exposed repeated omissions in claimed probe coverage, corrected by direct root work.

## Rare-family boundaries under review

Typography: numbers and textureGridText demonstrate repeated native glyph drawing. Existing
GlyphMarks supplies font-backed placement. These notes do not require font-outline extraction
or complex shaping. Do not claim those capabilities; keep them outside the currently
supported surface pending an explicit motivating case. This is not a corpus-absence claim.

Voronoi: triangularGradient uses Delaunay triangles; colidion deforms overlapping discs and
calls the result Voronoi-like. Delaunay support does not cover that deformation or nearest-site
cells. The former is a separate geometry gap to assess; the latter is not established by
these notes. Do not add a Voronoi API merely to clear a technique tag or classify colidion
as already recreated. A final family disposition must account for actual deformation too.

General grammar rewriting, glyph outlines and arbitrary solid modeling remain unsupported;
the existing branching, glyph and profile-mesh entry points must be described specifically.
A bounded screen cannot certify absence across826 reports or the missing75 reports.

## Evidence bindings

- `survey/out/2019/generativos/crb/notes.md` SHA256 `54b121c67aa97560449bac46cf72b5c91d595f0ed3ad982895b89b17e1a4645b`
- `survey/out/2015/Generativos/cityPink3d/notes.md` SHA256 `9961e1604c367d4f621a74a8302fed188d23f52e79d1164f58e1dad8c54d4533`
- `survey/out/2020/generative/01_04/rgblur/notes.md` SHA256 `f28e3eba6bce0695066ca569ecc51f6d248c24f23b8b030185269dc36b89d7a2`
- `survey/out/2018/Generativos/numbers/notes.md` SHA256 `94398ace5397871e0c9665232bd360e518c03c9d21da64c6fe0f128c2ced6508`
- `survey/out/2016/Generativos/textureGridText/notes.md` SHA256 `4bc549badde9c8b5e9efcbd4155f47bd8da3e420c06016942525b565759889ba`
- `survey/out/2019/generativos/colidion/notes.md` SHA256 `83b2b257c17bbedb28aa89ccb71ceddf6637712c2202f681a3ef8412a97613e0`
- `survey/out/2017/Generativos/triangularGradient/notes.md` SHA256 `a98eaf0e7d134069c543f85c5cb5caf2f22bb0b14246f6d305704b6c9db29dd2`
