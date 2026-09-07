---
sketch: 2018/Generativos/marca
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1876
animated: false
techniques: [polar, 3d-mesh, packing]
primitives: [shape]
palette:
  colors: ["#F8C43D", "#023390", "#6AA6E2", "#F35076", "#F6F6F6", "#191919"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 50, tried: [15], change: large, effect: "fewer objects, sparse scatter, dark background visible between clusters"}
  - {name: sizeMax, default: 0.4, tried: [0.6], change: large, effect: "much larger rings, thicker bands, background almost fully covered"}
  - {name: gradPhase, default: 0.25, tried: [0.5], change: moderate, effect: "same layout, highlight position on each gradient ring rotated, bands read as differently lit tori"}
  - {name: haloAlpha, default: 10, tried: [60], change: moderate, effect: "strong dark disc around every object, rings more separated, higher contrast against near-black"}
  - {name: polySeg, default: [3, 7], tried: [[5, 10]], change: large, effect: "gems become rounder 5-10 sided pinwheel/flower shapes with many fine facets"}
  - {name: palette[0], default: "#F8C43D", tried: ["#2ECC71"], change: subtle, effect: "gold replaced by green throughout (verified by pixel count); composition unchanged"}
reusable_candidates:
  - {name: cgrad, signature: "cgrad(x, y, s1, s2, c1, c2, phase) — angular gradient ring band", note: "ring of quads, fill lerped between two colours by cos(angle + TAU*phase) — fakes a 3D torus highlight; phase rotates the highlight"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alpha1, alpha2)", note: "annulus built from quads between two radii, per-side alpha shading; used for the soft dark halo and a mid-tone ring"}
  - {name: poly, signature: "poly(x, y, s, seg, angle, c1)", note: "faceted star/gem: seg triangles from centre to two adjacent points on a circle, alternating random fills, fakes a cut gemstone"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a 5-colour palette array"}
---

## What it draws
A dense scatter of 3D-looking "gems and rings" on a near-black charcoal background. Each object is a set of concentric ring bands whose colours sweep around the circle (a cosine gradient) so they read as shiny tori, plus a central faceted polygon that reads as a cut gemstone. Dominant colours are gold, pink-red, and blue, with white rings and occasional near-white highlights; objects overlap heavily and range from small to roughly a third of the canvas.

## How the code works
`setup()` (line 2) calls `generate()` once; `draw()` (line 10) is a no-op, so the piece is static. `generate()` (line 32) fills with `background(25)` (near-black) then loops 50 times (line 35): each iteration picks a random centre (lines 36-37) and a size `s = width*random(0.02, 0.4)` (line 38). For each object it stacks, back to front (lines 45-51):

1. `arc2(x, y, s, s*3, ..., color(0), 10, 0)` (line 46) — a large faint black annulus (alpha 10) that darkens the background around the object, giving a soft halo.
2. `arc2(x, y, s, s*1.8, ..., rcol(), 20, 0)` (line 47) — a single random palette colour, alpha 20, another soft tinted ring.
3. Two `cgrad()` calls (lines 48-49) — the visible shiny bands: an outer ring from radius `s*0.8` to `s` lerping `c1`→`c2`, and an inner ring from `s*0.6` to `s*0.8` lerping `c2`→`c1`. In `cgrad` (line 72) the ring is divided into `max(8, s2*PI)` angular quads (line 76); each quad's fill is `lerpColor(c1, c2, cos(map(i,0,seg,0,TAU)+TAU*a)*0.5+0.5)` (lines 82-86), so brightness sweeps once around the circle and `a` (0.25) rotates where the highlight sits. That cosine sweep is what makes flat rings read as 3D tori.
4. `poly(x, y, s*0.4, int(random(3, 7)), random(TAU), c1)` (line 51) — the gemstone core: `seg` (3-6) triangles from the centre to adjacent points on a circle of radius `s*0.2`, each triangle's two outer vertices filled with independent random palette colours and the centre vertex with `c1` (lines 61-68). Random per-face colours + a `stroke(255, 10)` outline (line 50) fake faceted gem shading.

Randomness: object count/positions/sizes (lines 36-38), the two distinct band colours `c1`/`c2` (lines 41-43, re-rolled if equal), the mid-ring colour (line 47), gem segment count (line 51), gem rotation (line 51), and every gem face colour (lines 62, 64). The seed field `seed` (line 1) is set by the harness but the sketch itself re-rolls `random()` freely. No noise, no blend modes, no transforms beyond the per-vertex polar math; P2D + `smooth(8)` for antialiasing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_15 | `for (int i = 0; i < 50; i++) {` -> `... i < 15 ...` | large (0.678) | sparse: 15 objects, dark background clearly visible between ring clusters | variants/count_15/frame_00001.png |
| sizeMax_0.6 | `float s = width*random(0.02, 0.4);` -> `random(0.02, 0.6)` | large (0.857) | rings and gems much larger, thick bands, near-black background almost fully covered | variants/sizeMax_0.6/frame_00001.png |
| gradPhase_0.5 | `cgrad(x, y, s*0.8, s, c1, c2, 0.25);` -> `..., 0.5);` | moderate (0.263) | same objects/layout, but the bright highlight band on each ring sits at a different angle; tori look lit from another direction | variants/gradPhase_0.5/frame_00001.png |
| haloAlpha_60 | `arc2(x, y, s, s*3, 0, TAU, color(0), 10, 0);` -> `..., 60, 0);` | moderate (0.562) | dark halo discs around objects now strong and opaque, objects pop off the background, more visible black between rings | variants/haloAlpha_60/frame_00001.png |
| polySeg_5_10 | `poly(x, y, s*0.4, int(random(3, 7)), ...)` -> `int(random(5, 10))` | large (0.789) | gem cores are rounder many-sided pinwheels/flowers instead of 3-6 point stars | variants/polySeg_5_10/frame_00001.png |
| palette_green | `int colors[] = {#F8C43D, ...}` -> `{#2ECC71, ...}` | subtle (0.134) | gold fully replaced by green (pixel count: 32,793 gold px -> 0; 33,114 green px); same composition, green now the dominant hue with pink/blue/white | variants/palette_green/frame_00001.png |

## Modularisation notes
- `cgrad` is the key reusable block: an "angular gradient ring" (torus look) parameterised by inner/outer radius, two colours, and a highlight phase. Generalise `phase` to a per-object random value and it becomes a drop-in primitive.
- `arc2` is a generic shaded annulus; its two per-side alpha channels are only ever used as (low, 0) here, so a simpler `ring(x, y, rIn, rOut, col, alpha)` covers this sketch.
- `poly` is a generic faceted-polygon/gem primitive (segments + rotation + per-face colour source); the random-face-colour behaviour is the one-off art decision, a `colourFn(angle) -> colour` callback would make it reusable.
- `rcol`/`colors[]` is a standard palette helper (random pick + `getColor` for noise-driven lookup).
- A clean parameter object for this sketch: `{count, sizeRange: [min, max], palette, bandCount: 2, haloAlpha, midRingAlpha, gemSegments: [3, 7], gemRadiusFactor: 0.4, highlightPhase: 0.25, background}`. The stacking order (halo → mid ring → two gradient bands → gem) is the one-off composition.
