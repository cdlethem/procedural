---
sketch: 2019/generativos/orderCurveOp
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1691
animated: false
techniques: [grid, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#EAE5E5", "#F7EB04", "#7332AD", "#000000", "#92A7D3"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, ampScale) -> PVector", note: "simplex-noise polar displacement: angle from one noise field, amplitude from another, offset = (cos,sin)*noise*amp"}
  - {name: warpedChecker, signature: "warpedChecker(cw, ch, powRange, scatter, colorProb) -> void", note: "checkerboard grid with per-cell pow() spacing, random position scatter, noise-warped corners, 20% palette-coloured cells"}
---

## What it draws
Full-bleed abstract composition on a muted blue-grey ground. A black-and-white checkerboard has been
stretched into large angular slabs: broad near-vertical black bands run down the middle, white
rectangles of varying size are scattered at angles across the canvas, and the edges of the cells are
warped, not straight. A few cells are tinted from the palette — a yellow sliver, a purple quad at the
left edge, pale blue rectangles — and overlapping translucent cells produce darker blue-grey tones.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static (lines 21-32).
- `generate()` seeds both RNGs (lines 44-45), fills the background with a random palette lerp colour
  (`getColor()`, line 47), then `translate(-width*0.2, -height*0.2); scale(1.4)` (lines 49-50) so the
  content overflows the canvas on every side (full bleed).
- Grid size: `cw = int(random(12,20)*20*0.5)` (line 59) gives ~120-199 columns, `ch` ~90-225 rows
  (line 60) — a fine checkerboard, black/white by `(i+j)%2` (lines 94-95).
- Non-uniform spacing: each corner sits at `pow(i*ww, pwrw)*width` where the exponent varies across the
  grid (`map(i,0,cw,pw1,pw2)`, pw1/pw2 random in ~0.5-2, lines 64-72, 87-92) — cells widen/narrow
  progressively, producing the stretched slabs.
- Scatter: per-cell `mult = random(120)*random(0.5,1)` (line 97) multiplies each corner's grid position,
  so every cell is thrown to a random distance from the origin at a random scale — this is what turns a
  regular grid into scattered rectangles.
- Corner warp: `def(x,y)` (lines 207-212) offsets each point by simplex noise: an angle field, an
  amplitude field (×500), and a second noise field scaled by that amplitude, applied as
  `(cos(ang),sin(ang))*des`. This bends the cell edges.
- Colour: 80% of cells are forced to pure white/black checker (lines 125-128); the other 20% keep
  `rcol()`, a random entry of the 5-colour palette (line 124, 233-235). The two noise-lerped palette
  colours `c1`/`c2` (lines 111-112) are computed but only used in commented-out code.
- Each quad is drawn with `beginShape()`/`endShape()`: edges p4→p1→p2 filled at full alpha, edges
  p2→p3→p4 at alpha 120 (lines 114-144). The half-translucent halves stack over the background and each
  other, creating the blue-grey and near-black tonal steps.
- Renderer P3D with `smooth(8)` (lines 16-17); `pixelDensity(2)` unavailable on the headless display
  (warning in stderr). `line()` (the midpoint-bisecting variant, lines 177-193) is unused; only `line2`
  (plain vertex pairs) is called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` is a reusable noise-displacement field (angle + amplitude + detail params); the
  pow-exponent grid spacing (lines 87-92) is a generic "non-uniform grid warp"; the per-cell random
  scatter `mult` is a one-line reusable effect.
- One-off art decisions: the 80/20 black-white-vs-palette coin flip, the alpha-120 on half the edges,
  the translate/scale full-bleed framing, the specific palette list.
- Clean parameter object: `{cw, ch, pwRange (exponent min/max), phRange, scatterMult (max), ampScale
  (noise displacement), colorProb (fraction of palette cells), edgeAlpha, background: bool}`.
