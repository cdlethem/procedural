# Ciscis002: root composition walkthrough

Status: plausibly supported at structural fidelity, not demonstrated. Root read the full
source at upstream revision `69bdd8513e4482a5e6018e36887d4bc208660eb5`, PDE SHA-256
`d657226f831d9676144e2f63edd1b3d314eb4b20db1a7a0a067b6ba6d502015a`, and
`survey/out/2019/generativos/ciscis002/notes.md` (identity in cohort evidence map).

## Complete active composition

1. QuadrantPartition2D with 100 replacements, centered 960-square, selectionFraction .5
   represents the ordered first-half selection and TL/TR/BR/BL subdivision. Exactly 301
   leaves. Caller averages bounds to produce sites; Delaunay2D supplies all triangle faces.
2. A retained per-face random decision selects about 80% for grayscale ground triangles.
   The source computes a teal colour then immediately overwrites it with grayscale: no
   teal ground algorithm is required. Source draws every face as a building regardless.
3. Each building has height `200*u*v`, a cyclic palette sample, one horizontal roof and
   three vertical quad walls. These are explicit drawing primitives, not a copied
   triangulator or general solid-mesh algorithm. The source starts a ground triangle then
   calls beginShape again without closing it; implement balanced roof/wall primitives and
   the separate ground pass, not this ambiguous lifecycle. No closed-bottom claim.
4. Each building selects two counts from integers 16 through 22. Each wall selects its
   own lit probability `(.2+.6*u)*v`, width fraction `.2+.7*u`, height fraction `.2+.7*v`,
   and one retained uniform variate per window. RegularGrid supplies normalized cell
   centers. To preserve source j-outer/i-inner order use columns=sub1 (vertical), rows=sub2
   (horizontal), origin=(.5/sub1,.5/sub2), spacing=(1/sub1,1/sub2). For output (v,u), map
   x,y along wall edge with u and z=height*(1-v). This is affine wall placement, not a
   missing general quad mesher. Box width=edgeLength/sub2*widthFraction, depth=.1,
   height=buildingHeight/sub1*heightFraction; rotate around Z by edge atan2.
5. CyclicPalette samples normalized phases in [0,1); the source's positive palette-index
   value divided by five maps to this phase. Keep the five source RGB colours. Package
   channel quantization may differ from Processing lerpColor; exact pixels are excluded.
6. Native P3D supplies black background, orthographic camera, source-like directional and
   ambient lights, oblique rotation, scale 2.1, outlined buildings and window boxes. The
   imported simplex noise is unused and shader application commented out. Neither is a
   dependency. Window box geometry stays real P3D, not a replacement texture.

## Architectural decision

Four existing operations cover the defining reusable computations: partition, Delaunay,
regular grid, cyclic palette. Height distributions, lit decisions and wall coordinate mapping
are explicit example policies. Do not add per-sketch switches or a facade operation for
these policies. The report suggests a generic arbitrary-quad facade helper; this source
only exercises vertical planar walls. That broader API is not justified by this recreation.
Keep the candidate ledger unchanged: this is composition support, not bulk adjudication.

Use private example randomness and retain style samples separately from topology. Library
xoshiro/binary64 subdivision, canonical Delaunay ordering and palette quantization diverge
from source replay. Fixed documented oblique camera and density1 are allowed design choices;
source camera jitter, float stream and density2 pixel equivalence are not claimed.

## Cost and validation implication

The source's 301 sites have at most 597 planar triangles; with three walls and at most
22*22 windows each, the conservative ceiling is 866,844 boxes per frame. Do not launch a
large multi-state rendering campaign blindly or reduce the default counts just to pass.
Retain compact per-wall parameters and per-window samples; avoid PVector/object allocation
inside drawing loops. First measure one source-density frame with an explicit timeout.
If too costly, record the limitation and optimize output-preservingly before accepting.

The note reports strong changes for splits100→30, height200→80, zoom2.1→1.2, and the
vertical count expression16..22→6..9. These are observed example presets, not general
library ranges. Keep height and window edits independent of sites/topology and random
samples so artist comparisons are meaningful. Demonstrated coverage requires actual PDE
execution, visible facades/roofs, repeatable reset/save and root image review. No renderer
run or implementation acceptance follows from this walkthrough alone.
