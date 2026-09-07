---
sketch: 2018/Generativos/flowwers/flowwers_002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1586
animated: false
techniques: [noise-field, grid]
primitives: [rect, shape]
palette:
  colors: ["#DECFB4", "#C0B394", "#B0AA7C", "#9DA575", "#A2A879", "#66775D", "#45523A", "#606B5A", "#232D29", "#0B0B0B", "#837954", "#00963C"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: c, default: 20, tried: [40], change: large, effect: "more leaf batches, opaque tone rects and pie flowers; dark background mostly covered, leaf field denser"}
  - {name: cd, default: 100, tried: [300], change: none, effect: "no visible change; thin arc specks at alpha <= 20 stay invisible at 3x count"}
  - {name: rectAlpha, default: 40, tried: [100], change: none, effect: "no visible change; the per-vertex-fill quad wash is not visible in the P2D render"}
  - {name: ss, default: 60, tried: [30], change: subtle, effect: "grid-snapped rects and pies reposition/requantise to a 30px grid; tone-block mosaic rearranges, leaf field unchanged"}
  - {name: pb, default: 0.7, tried: [0.4], change: none, effect: "no visible change; leaf width-profile exponent not visible at this leaf size"}
reusable_candidates:
  - {name: noiseScatterLeaves, signature: "noiseScatterLeaves(count, maxSizeFn, detail, offset) -> void", note: "per-point 2-D noise gates + sizes + angles + palette colour, drawing a parametric leaf at each kept point"}
  - {name: parametricLeaf, signature: "parametricLeaf(x, y, size, angle, colour, widthPow, lengthPow) -> void", note: "two mirrored triangle strips (beginShape) tracing a sin-profiled, power-eased leaf outline"}
  - {name: noisePalette, signature: "noisePalette(values[] , v) -> colour", note: "index-lerp through a colour list by a scalar (noise-driven palette sampling)"}
---

## What it draws
Near-black canvas broken up by several large flat, grid-snapped rectangles in sage green,
grey-green and beige tones: a big sage block fills the lower-right, another sage block the
lower-left, grey-green blocks sit top-right and top-left, a small beige square holds one pie in
the top-left, and a small dark square sits at the bottom. Scattered over everything are small
teardrop leaves in the beige-to-olive palette (beige on the dark ground, dark olive on the light
blocks), densest in the upper-left. Six bright green pie shapes (circles with a ~36-degree wedge
cut out) appear at a few sizes, plus faint thin arc specks around them.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (line 3-12).
`generate()` (line 22):
1. Fills the background near-black, then draws a full-canvas quad whose two triangles carry
   different fills (transparent black, and `#837954` at alpha 40) — intended as a diagonal olive
   wash, but effectively invisible in the render (see rectAlpha experiment, lines 23-31).
2. `noiseSeed`/`randomSeed` from the harness seed (lines 33-34).
3. First loop, `c = 20` iterations (lines 37-51): each call to `hojas(...)` (line 94) scatters up to
   `random(80, 400)` leaves, with `maxSize` growing from `width*0.04*0.2` to `width*0.04` as the
   index advances (line 40). Inside `hojas`, each candidate point is rejected when
   `noise(des4+x*det4, ...) < 0.5` (line 107 — noise gate, ~half the points survive); size is
   `maxSize*pow(noise(...), 1.6)` (line 108); angle is `noise(...)*TAU*4` (line 109); colour comes
   from `getColor(noise(...)*colors.length*2)` (line 110), which index-lerps through the 9-colour
   beige/olive palette (lines 205-215). `hoja()` (line 115) builds each leaf as two mirrored
   triangle strips: for `i` in `0..h` it draws a `beginShape` quad whose width follows
   `sin(pow(t, 0.7)*PI)*w` and whose vertical position is `pow(t, 2.2)*h`, so the leaf tapers to a
   point at the tip; each quad is `lerpColor(col, rcol(), ...)` so the leaf shimmers with random palette neighbours (lines 126-158).
   The same loop also draws one opaque grid-snapped rectangle `fill(rcol())` per iteration
   (lines 42-50) — these are the large flat tone blocks, snapped to the `ss = 60` grid via
   `x -= x%ss`, sized `width*random(0.7)*random(0.2,1)` (120-960 px) and centred at random points.
4. Second loop, again `c = 20` (lines 54-76): for each grid-snapped point a flower: a bright green
   `arc(x, y, s, s, a, a+PI*1.8)` (lines 67-68) — a circle missing a wedge, i.e. the pie shapes —
   then `cd = 100` thin arcs of `fill(rcol(), random(20))` at random sub-angles (lines 69-75),
   which are the faint arc specks. The ellipse variant (lines 61-65) is commented out.

Randomness enters via `random()` (positions, leaf counts, angle offsets `des1..des4`, quad
colour-lerp) and Perlin `noise()` (point gating, size, angle, palette). No blend modes, no
shaders; P2D + `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_40 | `int c = 20;` -> `int c = 40;` | large | dark region shrinks to a top-left square; extra tone rects cover most of the canvas, ~double the green pies and a denser leaf field | variants/c_40/frame_00001.png |
| cd_300 | `int cd = 100;` -> `int cd = 300;` | none | no visible change | variants/cd_300/frame_00001.png |
| rectAlpha_100 | `fill(#837954, 40);` -> `fill(#837954, 100);` | none | no visible change — confirms the per-vertex-fill quad wash is not rendered visibly; the big sage/grey blocks are the opaque rcol() rects | variants/rectAlpha_100/frame_00001.png |
| ss_30 | `float ss = 60;` -> `float ss = 30;` | subtle | rects and pies snap to a finer 30px grid and land at different positions/sizes, rearranging the tone-block mosaic; the leaf field is identical | variants/ss_30/frame_00001.png |
| pb_0.4 | `float pb = 0.7;` -> `float pb = 0.4;` | none | no visible change | variants/pb_0.4/frame_00001.png |

## Modularisation notes
Generic: `hojas()`/`hoja()` pair is a reusable "noise-gated scattered parametric leaf" — the noise
details/offsets, gate threshold, size pow, angle multiplier and the leaf profile exponents
(`pb = 0.7`, `px = 2.2`) are all clean parameters. `getColor()`/`rcol()` are a generic
noise-driven/random palette sampler. `arc2()` (lines 180-198, currently only used in commented
code) is a reusable radial-gradient arc-ring.
One-off art decisions: the per-vertex-fill diagonal wash quad (invisible in the render); the
`PI*1.8` pie wedge; the grid-snapping of rects and flowers (`ss = 60`); the two-loop structure
(leaves then flowers).
A clean parameter object: `{seed, leafBatches, leavesPerBatch, maxSize, gridCell, noiseDetail,
noiseOffsets, gateThreshold, leafWidthPow, leafLengthPow, pieWedge, pieRings, rectAlpha, palette[]}`.
