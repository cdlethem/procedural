---
sketch: 2018/Generativos/circles005
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1826
animated: false
techniques: [grid, polar, dots-stippling, noise-field]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#80CCE9", "#2C62B3", "#2EBF40", "#FDEB02", "#F84D1E", "#FFFFFF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cccc, default: "random(80, random(120, 200))*0.6", tried: [0.3], change: "", effect: ""}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, col, alpIn, alpOut)", note: "dashed radial ring of trapezoids (arc2) — tick-marked circle edges"}
  - {name: noiseGatedStipple, signature: "noiseGatedStipple(x, y, r, det, threshold, col)", note: "dots scattered in a disc, kept where 2-octave noise exceeds threshold"}
  - {name: gridShadowBoxes, signature: "gridShadowBoxes(grid, gs, col, alpha)", note: "rect grid + corner dot + 4 half-transparent offset quads faking a 3D box shadow"}
---

## What it draws
A flat, full-bleed composition on an orange-red field: many overlapping
circles in a bright six-colour palette (sky blue, navy, green, yellow,
orange-red, white), some large (up to half the canvas), some tiny. Each circle
is often ringed by a fine tick-marked arc and scattered with small dots of
mixed colours. A faint square grid of thin outlined cells covers the canvas;
grid intersections carry small coloured dots, and a few cells have translucent
offset quads suggesting a lifted box. A handful of small wireframe cubes float
in the background (P3D).

## How the code works
`generate()` (circles005.pde, called from `setup()`, line 12) draws once;
`draw()` is empty, so the piece is static. Randomness is seeded via
`randomSeed(seed)` / `noiseSeed(seed)` (lines 32-33); `seed` is a harness
field. Colours come from `rcol()` (line 242): uniform pick from the six-colour
`colors[]` list (line 241); background is one such pick (line 28).

Layers, in order:
1. **Wireframe cubes** (35-45): 60 unrotated boxes of width ~96px at
   z=-2000, random rotations — the small 3D boxes seen between the flat layers.
2. **Grid** (47-57): `grid = 960/2^k` for random k in ~7-9 (so 1-7 cells
   across), stroked in a colour != background with alpha 120 (line 51) — the
   faint cell outlines.
3. **Grid dots** (60-65): `grid^2*0.1` small filled ellipses at grid
   intersections — the little coloured dots.
4. **Main circles** (69-144): `cccc` (~48-120) circles. Each:
   - radius `s1` from `s*random(1)^3` (line 73, line 80); 40% snap to a grid
     cell (75-78).
   - filled disc (81-82), then a full-circle `arc2` ring (85) and 80 short
     tick segments just outside it (88-91) — the tick-marked rings.
   - **stipple** (93-113): `cc ~ s1^2` candidate dots at random angles/radii
     inside the disc; kept only where a 2-octave `noise()` sample exceeds
     `npv` (106-107) — the speckled texture, each dot a grey underlayer +
     coloured dot.
   - inner disc `s2` (116-121) and `ccc` partial arcs (135-143) — dashed
     concentric rings.
5. **Shadow boxes** (147-195): `grid*4` cells get a stroked rect, a centre
   dot, and four translucent quads offset by -0.2/+1.2 gs (alpha 40) faking a
   raised 3D box.

`arc`/`arc2` (197-233) build rings as many small filled trapezoids with two
alpha values (inner/outer edge), giving the ticked/gradient ring look.
A fragment shader (`noiseShadowFrag.glsl`) multiplies every pixel's alpha by
a per-pixel random value in [0.001, ~1], grainying edges. P3D renderer,
`smooth(8)`, `pixelDensity(2)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `arc2` is a clean generic: radial ring of trapezoids with two alphas —
  directly reusable as `arcRing(x, y, r1, r2, col, alpIn, alpOut)`.
- The noise-gated stipple (93-113) is self-contained: candidate disc sampling
  + 2-octave noise threshold — reusable as a texture primitive
  (`noiseGatedStipple`).
- The grid + corner dots + translucent offset quads (47-57, 147-195) are a
  "pseudo-3D grid box" pattern, one-off in art decisions (offset 0.2 gs,
  alphas 40/80/120) but separable.
- The wireframe cubes (35-45) are a throwaway depth layer; trivial to drop or
  parameterise by count.
- A clean parameter object: `{seed, count (cccc), sizeExp (cubes of random(1)
  in s), gridPow, gridAlpha, stippleThreshold (npv), stippleDensity, tickCount
  (80), palette[], useCubes, useShadowBoxes}`.
