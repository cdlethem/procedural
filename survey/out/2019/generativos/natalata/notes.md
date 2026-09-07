---
sketch: 2019/generativos/natalata
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1904
animated: false
techniques: [noise-field, particles, dots-stippling, voronoi-delaunay, polar]
primitives: [ellipse, point, line, shape]
palette:
  colors: ["#F0C7C0", "#F65A5C", "#3080E9", "#50E2C6", "#F7D3C3", "#F41B9C"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseWalker, signature: "noiseWalker(pos, steps, detail, stepSize) -> PVector[]", note: "walk a point along a simplex-noise direction field, yielding a path of (pos, t) samples"}
  - {name: petalDot, signature: "petalDot(x, y, s, petals, petalSize, rot) -> void", note: "draw one dot as a ring of N rotated sub-ellipses (flower-cluster stipple)"}
  - {name: colorDrift, signature: "getColor(t) -> Color", note: "lerp between successive entries of a palette list by fractional t, quadratic easing"}
  - {name: softHalo, signature: "softHalo(x, y, r, inner, outer) -> void", note: "arc2(): concentric quad-strip radial gradient ring with per-ring alpha ramp"}
---

## What it draws
A full-bleed stipple composition of thousands of overlapping semi-transparent dots on a light gray ground:
large organic blobs of mint green and peach dominate the left half, coral orange fills the top-right,
a blue mass sits along the bottom, with pink and teal accents. Every dot is a small cluster of 4–7
petal-like ellipses, giving the texture a fuzzy, floral grain. A fine white point grid is visible in
the lighter areas, three large soft halo circles are barely perceptible as tonal washes, and a few very
faint thin lines cross the top-right corner.

## How the code works
Single tab `natalata.pde`. `generate()` (line 52) runs once in `setup()`; `draw()` is empty, so the
sketch is static (frames 10/60 identical). Layers, back to front:

1. **Background** (line 60): `background(240)`, light gray; an orange-lerped `back` color (line 57) is
   kept and used later for per-walker color lerp, not the fill.
2. **Grid-snapped speckle** (lines 63–71): 200 small ellipses, positions snapped to a 20px grid
   (`x -= x%20`), size `random(20)*random(0.4)` (≤8px), fill `rcol()` (random palette color) with low
   alpha (`random(180)*random(0.4,1)`).
3. **Three soft halos** (lines 74–86): 3 random large circles, fill `rcol()` alpha 90, each with three
   `arc2()` rings (lines 206–223): concentric quad strips at radii `ss`→`ss*0.96`, `ss`→`ss*0.8`,
   `ss`→`ss*1.4` in colors 60/40/240 with random low alpha — a radial gradient wash.
4. **Point grid** (lines 88–93): white points every 10px, alpha 60 — the visible fine mesh.
5. **30 noise walkers** (lines 99–179), the main layer. Per walker: start position random over
   ±20% off-canvas (102–103); two simplex-noise fields (offsets `des1/des2`, details
   `det1/det2 ≈ 0.001–0.002`) drive heading (line 125) and dot size (line 127); envelope
   `amp = 0.5+sin²(j·π/cc)·0.5` (line 126) fades the first/last quarter of each path.
   Per step (`cc = 2000–2800`, line 115):
   - dot color = `lerp(back, getColor(ic + dc·j), ...)` (line 128): palette index drifts along the
     path (`dc ≈ 0.0004–0.0016`), so one walker's blob shifts hue over its length; slightly pulled
     toward black (line 129); fill alpha 250 (line 130).
   - **petal cluster** (lines 167–177): on top of the dot, `ccc = 4–7` sub-ellipses (line 116) are
     placed on a circle of radius `r = s·(1−rrr/2)·2.4·scale·amp3` (amp3 random 0–10) at angle
     `ia + dd·k + da·j` — the ring slowly rotates along the path (`da`), petal size modulated by
     `pow(sin(j·π/cc), 0.4)·10.2`. This is what makes each dot a fuzzy flower cluster.
   - with prob 0.006 (146–165): a satellite dot + short line + occasional ring ("star" burst).
   - with prob 0.0001 (133–141): the position is saved for triangulation.
   - walker advances 0.4·scale px along the noise angle (143–144).
6. **Delaunay lines** (lines 182–194): the rare saved points are triangulated
   (`Triangulate.triangulate`) and each triangle edge is drawn as a faint line, alpha `random(40)`,
   color `rcol()` — the thin streaks in the top-right.
7. **White markers** (lines 198–203): 2px white dots, alpha 80, at the triangulated points.

Palette (line 232): 6 colors, selected by `getColor(v)` = quadratic-eased lerp between successive
entries (241–247), or uniformly random via `rcol()` (235–237).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic**: `noiseWalker` (heading from 2D simplex noise + envelope + size modulation), `petalDot`
  (N rotated sub-ellipses around a point with rotating offset), `getColor`/`rcol` palette helpers,
  `arc2` soft radial gradient, the 10px point grid, and the Delaunay-faint-edges pass are all
  portable.
- **Art-specific**: the layering order (speckle → halos → grid → walkers → triangulation), the
  particular 6-color palette, the 20px snap, the rare-event probabilities (0.006 star, 0.0001
  triangulation seed), and the ±20% off-canvas spawn margin.
- **Parameter object** would contain: walker count, steps per walker, noise detail ×2, step size,
  size range (min/max fractions of width), petal count, petal radius fraction, ring rotation speed,
  color drift rate, fill alpha, star probability, grid spacing.
