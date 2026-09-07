---
sketch: 2019/generativos/colidion
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2135
animated: false
techniques: [packing, noise-field, dots-stippling, distortion]
primitives: [shape, point]
palette:
  colors: ["#FAFAFA", "#8395FF", "#FD674E", "#FCC8FF", "#1CB377", "#FCD500"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: detSize, default: "random(0.0008,0.001)*3", tried: ["random(0.0008,0.001)*6"], change: large, effect: "finer noise field: big green/yellow blobs become more numerous, smaller and spread evenly across the canvas"}
  - {name: maxSize, default: "width*0.5", tried: ["width*0.25"], change: large, effect: "all circles half the size; no big blobs remain; dense field of small coral/red circles with violet dots"}
  - {name: sizePow, default: 1.8, tried: [3.0], change: large, effect: "steeper size distribution: few isolated large blobs, many more mid-size pink circles and small dots"}
  - {name: flattenLerp, default: 0.45, tried: [0.8], change: subtle, effect: "same layout; cell edges slightly flatter at contacts; no visible change overall"}
  - {name: stippleDensity, default: "PI*0.4", tried: ["PI*0.8"], change: subtle, effect: "denser, grainier stippled fills; layout and colours unchanged"}
reusable_candidates:
  - {name: circlePacking, signature: "circlePacking(w, h, attempts, sizeFn, reject) -> Point[]", note: "stochastic circle placement with pluggable size distribution and reject predicate; two passes (noise-sized then random-sized)"}
  - {name: flattenCircle, signature: "flattenCircle(p, neighbors, pull) -> float[]vertices", note: "deforms a disc's outline by pulling vertices inside overlapping neighbors toward their boundaries; produces Voronoi-like cell edges"}
  - {name: stippleFill, signature: "stippleFill(cx, cy, r, density, colorFn) -> void", note: "1-px dots at random angles, edge-biased radius sqrt(random(random(1),1)), colour as a function of normalized radius"}
---

## What it draws

A full-bleed 960×960 image on a near-white background, completely covered by packed
circles of very unequal sizes. Large soft blobs in greens, olive and yellow dominate
the top and left; mid-size pink circles with pale yellow rims fill much of the middle
and right; small periwinkle/violet dots crowd the gaps; coral-red circles are
scattered throughout. Neighbouring circles bulge into each other and flatten where
they meet, so the composition reads as a mosaic of touching cells. Every circle has a
faint grey outline and a soft, grainy stippled fill whose hue shifts from its centre
towards its rim.

## How the code works

- `setup()` calls `generate()` once; `draw()` is empty, so the image is a single
  static composition (colidion.pde:21-32). P3D renderer, 960×960, `smooth(8)`.
- **Pass 1 (lines 66-90):** 10,000 candidate positions at random `(x, y)`. Size
  `s = pow(noise(x*detSize, y*detSize, seed*0.01) * random(0.8,1), 1.8) * width*0.5`
  (lines 63, 70-72) — 3-D Perlin noise drives *size*, not position, so big circles
  cluster where noise is high. The reject test (lines 77-87) compares distance against
  `o.s+s`, which is *twice* the visual radii, so heavy overlap is allowed; a point is
  dropped only when its centre lands within `radius*(0.4-(n+o.n)*0.1)` of an existing
  circle.
- **Pass 2 (lines 92-113):** 1,000,000 more candidates, but size is now pure random:
  `random(1)*random(0.5,1)*maxSize` (line 95). Reject threshold is `(o.s+s)*0.4`
  (line 105), i.e. much tighter, so this pass fills the gaps with smaller circles.
- The removal loop (lines 115-118) computes `cc = size()*0.1` but the `remove` call is
  commented out — nothing is removed.
- **Neighbour graph (lines 120-131):** O(n²) pairwise pass; circles with
  `dist < o.s+p.s` (again twice the visual radii) record each other as "brothers".
- **Drawing (lines 133-192):** for each point the fill is `getColor(p.s*0.02)` — a
  palette index proportional to size (line 138), which is why large blobs and small
  dots sit in different parts of the palette. Each circle is a polygon with
  `int(s*PI)+2` vertices (line 140); every vertex that lies inside a brother's disc is
  lerped 45% towards that brother's boundary (lines 154-161), then 12% back outwards
  (lines 163-164) — this is the flattening that gives the cell-like edges. Outlined
  with `stroke(0,60)` (line 143).
- **Stippling (lines 170-182):** `int(r²*PI*0.4)` dots per circle (area-proportional).
  Each dot: random angle, radius `max*sqrt(random(random(1),1))` — biased towards the
  rim (line 175); colour `getColor(col + pow(val,1.8)*2.2)` at alpha 220 (line 180),
  i.e. the hue shifts ~2 palette steps from centre to rim; drawn as 1-px `point()`.
- **Palette (line 205):** {#8395FF, #FD674E, #FCC8FF, #1CB377, #FCD500};
  `getColor(v)` wraps cyclically and lerps between adjacent entries with
  `pow(v%1, 1.2)` (lines 217-222). Background is 250 (line 59).
- Randomness is fully seeded: `randomSeed(seed)` / `noiseSeed(seed)` at the top of
  `generate()` (lines 57-58).

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detSize_x6 | `random(0.0008, 0.001)*3` -> `random(0.0008, 0.001)*6` | large | noise field is twice as fine: the single giant green/yellow blobs are gone; many more, smaller green/yellow blobs spread evenly across the whole canvas and the mid-size circles are re-placed | variants/detSize_x6/frame_00001.png |
| maxSize_0.25 | `float maxSize = width*0.5;` -> `float maxSize = width*0.25;` | large | every circle is ~half the size: no large blobs, a dense mosaic of small coral/red circles packed with violet dots | variants/maxSize_0.25/frame_00001.png |
| sizePow_3.0 | `n = pow(n, 1.8);` -> `n = pow(n, 3.0);` | large | steeper size distribution: only a few isolated big blobs (yellow top-left, greens bottom-left), many more mid-size pink circles and small violet dots, more uniform overall | variants/sizePow_3.0/frame_00001.png |
| flatten_0.8 | `x = lerp(x, b.x+cos(ang)*b.s*0.5, 0.45);` -> `... 0.8);` (x component only) | subtle | placement and colours identical to baseline; the flattened cell edges read as marginally sharper where circles touch; no visible change overall | variants/flatten_0.8/frame_00001.png |
| stipple_0.8 | `int ccc = int(r*r*PI*0.4);` -> `int ccc = int(r*r*PI*0.8);` | subtle | same layout and colours; the stippled fills are visibly denser and grainier | variants/stipple_0.8/frame_00001.png |

## Modularisation notes

- **Generic (library candidates):** the two-pass stochastic circle placement with a
  pluggable size function and reject predicate is the core reusable piece; the
  neighbour-driven disc flattening (`flattenCircle`) and the radial, edge-biased
  stipple fill (`stippleFill`) are both cleanly separable.
- **One-off art decisions:** size→colour mapping `p.s*0.02`, the 5-colour palette,
  the 0.45 / 0.12 lerp constants in the outline deformation, the `0.4-(n+o.n)*0.1`
  fudge in pass 1's reject test, the 10,000 / 1,000,000 attempt counts, and the
  `+2.2` rim hue shift.
- **Clean parameter object:** `{width, height, seed, pass1Attempts, pass2Attempts,
  maxSize, noiseScale, sizePow, rejectFudge1, rejectFactor2, flattenLerp,
  outlinePull, stippleDensity, rimHueShift, palette}`.
