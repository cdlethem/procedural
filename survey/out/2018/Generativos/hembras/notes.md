---
sketch: 2018/Generativos/hembras
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3592
animated: false
techniques: [subdivision, lines-hatching, 3d-mesh]
primitives: [line]
palette:
  colors: ["#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subs, default: "int(random(2000))", tried: [800], change: large, effect: "fewer splits = larger, coarser facets; strong diagonal bundles and plate-like slabs, less fine detail"}
  - {name: cc, default: 120, tried: [30], change: large, effect: "fewer hatch lines per box = much sparser, whiter image; individual boxes read as distinct grids"}
  - {name: strokeAlpha, default: "random(16, 70)", tried: ["random(16, 140)"], change: large, effect: "heavier alpha = darker, more solid wash; same composition, denser overlapping texture"}
  - {name: scale, default: 0.6, tried: [1.0], change: moderate, effect: "structure zoomed to fill the frame, cropped at edges; same look, larger bands"}
  - {name: strokeWeight, default: 0.2, tried: [1.0], change: large, effect: "5x thicker lines fuse into near-black masses; structure barely distinguishable, strong vertical banding"}
reusable_candidates:
  - {name: bisectBoxes, signature: "bisectBoxes(seed, nSplits, splitRange) -> Box[]", note: "start with one box, repeatedly pick a box and replace it by 8 children split at random ratios (3 axes, biased pick)"}
  - {name: boxHatch, signature: "boxHatch(w, h, d, lines, alphaRange) -> void", note: "draw axis-parallel random lines inside a box volume, called per box"}
---

## What it draws
A monochrome (black on white) dense web of very fine translucent lines forming a faceted,
crystalline relief that fills the frame. Large faceted plates sweep across the upper half;
the lower half is a coarser, blockier mass of overlapping line bundles. Dark patches appear
where line bundles overlap (centre, right edge); open areas read as pale grey. The overall
impression is a wireframe/etching of stacked boxes, slightly rotated, seen through
perspective.

## How the code works
Static sketch: `setup()` -> `generate()`, empty `draw()` (hembras.pde:3-15); any key press
re-seeds and regenerates (17-23).

- `generate()` (25-110): seeds RNG, white background, then camera setup: translate to
  (width*0.5, height*0.55, -200), `rotateX(HALF_PI)` (look straight down a floor plane),
  small random rotateY/rotateZ (33-34), `scale(0.6)`, `strokeWeight(0.2)`.
- Subdivision (61-97): starts with one box (0,0,0, width*2, height*3, width*2). For
  `subs = int(random(2000))` iterations (64): picks a random existing box (index biased
  toward the front of the list via `boxes.size()*random(0.2,1)`, 66), splits it along all
  three axes at random ratios w1/h1/d1 in [0.3,0.7] (68-73), removes the parent and inserts
  the 8 children (86-96). Net +7 boxes per iteration, so ~14,000 boxes at the end; split
  ratios mean small slivers and slabs accumulate.
- Drawing (99-109): for every remaining box, calls `modulo1(w,h,d)` three times.
  `modulo1` (116-139) sets `stroke(0, random(16,70))` — black at low random alpha — and in a
  loop of `cc = 120` iterations draws up to 10 axis-parallel chords at random positions
  inside the box (each line drawn with probability 0.5): 6 lines parallel to the width axis
  (124-129), 2 parallel to height (130-131), 2 parallel to depth (134-135). The 3 calls per
  box triple the density. No fills are used (fill calls are commented out, 103-104), so the
  7-colour palette (158) and `rcol()`/`getColor()` (159-172) are dead code; the image is
  purely black lines at alpha 16-70 over white.
- Randomness enters only through the RNG (seed field `seed`); deterministic per seed
  (baseline result.json: deterministic true). Density variation (dark vs pale zones) comes
  from how subdivision leaves large unsplit boxes next to heavily split ones, plus
  perspective foreshortening.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subs_800 | `int subs = int(random(2000));` -> `int subs = 800;` | large (mean 0.256, 0.76 of pixels) | coarser, larger facets: strong diagonal line bundles, big plate-like slabs in the upper-left, far less fine detail; the blocky structure of the subdivision reads clearly | variants/subs_800/frame_00001.png |
| cc_30 | `int cc = 120;` -> `int cc = 30;` | large (mean 0.182, 0.79 of pixels) | much sparser and whiter: individual boxes read as distinct wireframe grids (upper-left), dark boxy cluster in the centre, large white gaps | variants/cc_30/frame_00001.png |
| alpha_140 | `stroke(0, random(16, 70));` -> `stroke(0, random(16, 140));` | large (mean 0.172, 0.93 of pixels) | same composition but a darker, more solid wash: lines overlap into uniform grey texture, plates still visible but softer edges | variants/alpha_140/frame_00001.png |
| scale_1.0 | `scale(0.6);` -> `scale(1.0);` | moderate (mean 0.126, 0.53 of pixels) | structure zoomed ~1.7x so it fills and is cropped by the frame edges; same hatched-plate look with larger bands, less white margin at top | variants/scale_1.0/frame_00001.png |
| strokeWeight_1.0 | `strokeWeight(0.2);` -> `strokeWeight(1.0);` | large (mean 0.192, 0.76 of pixels) | 5x thicker lines fuse into near-black masses: left half almost solid black, strong vertical banding, structure barely distinguishable | variants/strokeWeight_1.0/frame_00001.png |

## Modularisation notes
- Generic: the box bisection loop (61-97) is a reusable "recursive random bisection"
  generator: given a seed, iteration count, split-ratio range and pick bias, it returns a
  partition of an initial AABB into ~7n+1 boxes. Independent of rendering.
- Generic: `modulo1` (116-139) as `boxHatch(w,h,d,lines,alphaRange)`: axis-parallel
  probabilistic chords inside a box; the per-line 0.5 probability and 3x call count are
  the density knobs.
- One-off art decisions: the specific camera rig (rotateX(HALF_PI), z=-200, scale 0.6),
  the pick-bias `random(0.2,1)`, split range [0.3,0.7], and the 3 calls per box.
- Clean parameter object: {seed, subs, splitRange: [0.3,0.7], pickBias, linesPerCall: cc,
  strokeAlpha: [16,70], strokeWeight, scale, callsPerBox}.
