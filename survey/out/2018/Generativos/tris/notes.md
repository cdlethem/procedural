---
sketch: 2018/Generativos/tris
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1627
animated: false
techniques: [subdivision]
primitives: [shape]
palette:
  colors: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub1, default: "int(random(10))", tried: [0], change: large, effect: "disables the first quad-splitting phase; tiling reorganises (score also confounded by non-deterministic sub2/time)"}
  - {name: sub2, default: "int(random(random(200)))", tried: [0, 150], change: large, effect: "0 = only a few large flat quads; 150 = very fine, dense triangle tiling"}
  - {name: strokeAlpha, default: 5, tried: [0], change: subtle, effect: "no visible change; seams were already barely perceptible at alpha 5"}
  - {name: shadeMaxAlpha, default: 60, tried: [0], change: moderate, effect: "per-face radial shading removed, faces become flat colours (score includes non-deterministic layout noise)"}
  - {name: colors, default: "#FF5722", tried: ["#2196F3"], change: moderate, effect: "orange faces become blue; tiling structure unchanged"}
reusable_candidates:
  - {name: fanSubdivide, signature: "fanSubdivide(form, interiorPoint) -> Form[]", note: "splits a polygon into one triangle per edge, fanned to an interior point (Form.sub)"}
  - {name: edgeMidpointSubdivide, signature: "edgeMidpointSubdivide(form, interiorPoint) -> Form[]", note: "inserts a random 40-60% point on each edge then fans to interior point, yielding quads (Form.subRect)"}
  - {name: radialShade, signature: "radialShade(shape, center, frequency, phase, maxAlpha)", note: "second fill pass: black overlay with per-vertex alpha from cos(angle*freq + phase) mapped to 0..maxAlpha"}
---

## What it draws
A full-bleed mosaic of sharp triangles and quadrilaterals tiling the whole 960x960
canvas, in four colours: dark navy, off-white, warm cream, and bright orange. Thin
dark seams separate the shapes. Some faces carry a subtle radial shading that
darkens toward one side of each face, giving a faceted, paper-cut / origami look.
Seed 42 produced a busy, small-featured tiling with large flat cream areas on the
left and dense fan clusters on the right.

## How the code works
- `setup()` (L4-12): `size(960,960,P2D)`, `noiseDetail(1)`, calls `generate()`;
  `draw()` (L14-16) is empty, so the piece is static (regenerated only on keypress,
  L18-24).
- `generate()` (L26-61): near-black `background(20)` (L30), `randomSeed(seed)` (L31).
  Starts from a single form covering the whole canvas (L33-39).
- Phase 1 (L41-46): `sub1 = int(random(10))` iterations; each picks a form from the
  first half of the list and replaces it with `subRect()` — a point is inserted on
  every edge at a random 40-60% position (L150-153), then each edge pair is fanned
  to a noise-perturbed interior point `randCenter()` (L110-124), producing one quad
  per original edge.
- Phase 2 (L48-53): `sub2 = int(random(random(200)))` (sqrt-of-uniform, so small
  values, max ~14) iterations; each replaces a form with `sub()` (L126-139): one
  triangle per edge fanned to a `randCenter()` interior point. `randCenter()`
  interpolates a random edge point toward the form center by a 2-D Perlin noise
  amount (L115-123), so split points cluster irregularly.
- Drawing (L56-60): `stroke(80, 5)` gives the faint dark seams. Each form is drawn
  twice in `show()`: first with a flat random palette colour `rcol()` (L176-178,
  random from the 4-colour list at L175), then a second pass filling black with
  per-vertex alpha `map(cos(ang*10 + time*2), -1, 1, 0, 60)` (L81-83), where `ang`
  is the vertex angle around the form center — this radial cosine shading produces
  the faceted look.
- Non-deterministic: `time = millis()*0.001` (L28) feeds both `randCenter()` noise
  and the shading phase, so the same seed can yield slightly different images.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub1_0 | `int sub1 = int(random(10));` -> `int sub1 = 0;` | large | entirely different tiling; first quad phase off, fewer large quads visible (score confounded: baseline sub2 count and `millis()` time also re-rolled) | variants/sub1_0/frame_00001.png |
| sub2_0 | `int sub2 = int(random(random(200)));` -> `int sub2 = 0;` | large | triangle-fan phase off: coarse mosaic of a handful of large flat quads/triangles, mostly cream/off-white with orange and navy blocks | variants/sub2_0/frame_00001.png |
| sub2_150 | `int sub2 = int(random(random(200)));` -> `int sub2 = 150;` | large | many more fan subdivisions: very fine, dense tiling of small triangles, noticeably busier than baseline | variants/sub2_150/frame_00001.png |
| strokeAlpha_0 | `stroke(80, 5);` -> `stroke(80, 0);` | subtle | no visible change; the 5-alpha seam was already nearly invisible | variants/strokeAlpha_0/frame_00001.png |
| shade_0 | `float val = map(cos(ang*10+time*2), -1, 1, 0, 60);` -> `... 0, 0);` | moderate | flat faces: the radial darkening per face is gone, colours are now flat (layout also differs from baseline due to non-determinism) | variants/shade_0/frame_00001.png |
| colors_blue | `#FF5722` -> `#2196F3` | moderate | orange faces become blue; same tiling structure, palette now navy/cream/blue | variants/colors_blue/frame_00001.png |

## Modularisation notes
Generic: the two subdivision strategies (`sub` fan-triangulation and `subRect`
edge-midpoint quads) plus the interior-point sampler `randCenter` are reusable as
`fanSubdivide` / `edgeMidpointSubdivide` operating on any convex-ish polygon; the
`Form` point list + cached center is a small clean data structure. The
`radialShade` second pass (angle-driven alpha over a shape) is a generic finishing
effect. One-off art decisions: the fixed 4-colour palette, the two-phase
subdivision schedule (sub1 small quads, then sub2 triangles with
sqrt-biased counts), the 0.4-0.6 edge split range, and the `cos(ang*10 + time*2)`
shading frequency/phase. A clean parameter object: `{sub1, sub2, edgeMixRange,
palette, strokeAlpha, shadeFrequency, shadeMaxAlpha, noiseSeed, time}`.
