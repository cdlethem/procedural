---
sketch: 2019/generativos/galon
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1526
animated: false
techniques: [subdivision, blend-modes]
primitives: [shape]
palette:
  colors: ["#BF0505", "#F7B72E", "#A6BED8", "#EA529B", "#DDDAC9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 8000, tried: [4000], change: large, effect: "fewer splits -> larger blocks; ADD saturates whole regions to white"}
  - {name: skipProbability, default: 0.8, tried: [0.5], change: large, effect: "skipping half the rects -> darker, sparser, more black gaps"}
  - {name: alp, default: 30, tried: [100], change: large, effect: "halo bands much stronger; blocks read as outlined glowing slabs"}
  - {name: amp, default: random(20), tried: [random(50)], change: large, effect: "halos spread further; image blooms, glow wider, dark core softer"}
  - {name: edgeAlpha, default: 200, tried: [100], change: subtle, effect: "blocks slightly darker, highlights weaker; structure unchanged"}
  - {name: palette, default: "warm 5 (red/yellow/blue/pink/cream)", tried: ["cool 5 (navy/cyan/indigo/green/slate)"], change: large, effect: "identical structure in cool cyan/teal/blue/green tones"}
reusable_candidates:
  - {name: splitRects, signature: "splitRects(seed, iterations, minRatio, maxRatio) -> Rect[]", note: "iteratively split random rectangles into 3-4 children, biased toward large ones"}
  - {name: gradientQuad, signature: "gradientQuad(x, y, w, h, edge, color, alpha, fade) -> shape", note: "quad opaque at one edge fading to alpha 0 at 40-60% across"}
  - {name: rcol, signature: "rcol(colors) -> color", note: "uniform random pick from a color list"}
---

## What it draws
A full-bleed mosaic of hundreds of semi-transparent rectangular blocks in warm tones —
dominantly golden yellow, red, magenta-pink and cream, over black. Blocks range from large
slabs to hairline slivers and overlap additively, so intersections glow bright white-yellow.
A large near-black region sits center-right where few blocks overlap. Many blocks carry soft
gradients fading out toward their edges, plus faint halo bands spilling beyond their borders.

## How the code works
- `setup()` calls `generate()` once (galon.pde:21-23); `draw()` is empty, so the piece is static
  (frames 10/60 are identical and flat).
- Partition (galon.pde:44-82): start with one full-canvas rect (line 54). Loop `sub = 8000`
  times: pick a rect with index biased toward the large/early ones (`random(rects.size()*random(0.2,1))`,
  line 58), split it into 3-4 children with random ratios in [0.2, 0.8] along one axis (lines 61-79),
  remove the parent (line 81). This is an iterative, non-uniform quadtree-like subdivision.
- Draw (galon.pde:84-177): 20% of rects are skipped (line 87). Each drawn rect is one
  `beginShape(QUADS)` of up to 8 quads: up to four edge quads filled `col` at alpha 200 fading to 0
  at the 0.4/0.6 mark of the rect (lines 105-137), and up to four "halo" quads that extend one edge
  outward by `amp = random(20)` at low alpha `alp = 30` (lines 139-174).
- Colour: `rcol()` picks uniformly from the 5-colour list (lines 194-197); each quad group may
  re-pick a colour.
- `blendMode(ADD)` over `background(0)` (lines 46, 51) is what makes overlaps glow; alpha values
  (200 for edge quads, 30 for halos) control how much each layer contributes.
- `toxi` is imported (`SimplexNoise`) but never actually used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_4000 | `int sub = 8000;` -> `int sub = 4000;` | large (mean 0.186, 0.656) | fewer, larger blocks; broad regions saturate to bright white under ADD, especially upper-left; coarser grain overall | variants/sub_4000/frame_00001.png |
| skip_0.5 | `if (random(1) > 0.8) continue;` -> `if (random(1) > 0.5) continue;` | large (mean 0.2122, 0.683) | noticeably darker and sparser: half the rects skipped, so black shows through more and the dark center region grows | variants/skip_0.5/frame_00001.png |
| alp_100 | `float alp = 30;` -> `float alp = 100;` | large (mean 0.3925, 0.939) | halo quads 3x stronger: blocks gain visible glowing outlines and the whole image reads more luminous; same layout | variants/alp_100/frame_00001.png |
| amp_50 | `float amp = random(20);` -> `float amp = random(50);` | large (mean 0.2666, 0.954) | halos extend much further past block edges; image blooms brighter, glow fields merge, the dark center's edges soften | variants/amp_50/frame_00001.png |
| edgeAlpha_100 | `fill(col, 200);` -> `fill(col, 100);` (all 4 edge quads) | subtle (mean 0.0412, 0.175) | subtle: blocks slightly darker and hotspots weaker; composition and texture otherwise unchanged | variants/edgeAlpha_100/frame_00001.png |
| palette_cool | warm 5-colour list -> navy/cyan/indigo/green/slate | large (mean 0.1721, 0.726) | same structure recoloured: cyan, teal, blue, green and pale grey with the same dark center and additive glows | variants/palette_cool/frame_00001.png |

## Modularisation notes
- The subdivision loop (lines 44-82) is fully generic: iterations, ratio range, and the pick-bias
  are the only knobs; returns a plain `Rect` list. Strong library candidate.
- The per-rect quad drawing (lines 103-176) is the art decision: 4 edge-fade quads + 4 halo quads,
  each 50% likely, with fixed 0.4/0.6 fade marks and random amp. Parameterise as
  (fadeMark, edgeAlpha, haloAlpha, haloAmp, perQuadProbability).
- A clean parameter object: `{seed, iterations, ratioMin, ratioMax, skipProbability, fadeMark,
  edgeAlpha, haloAlpha, haloAmpMin, haloAmpMax, colors, blendMode}`.
- `getColor(float)` (lines 201-206) is an unused lerp-between-list helper — also generic.
