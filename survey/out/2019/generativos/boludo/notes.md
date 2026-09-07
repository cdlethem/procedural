---
sketch: 2019/generativos/boludo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [noise-field, packing, grid, voronoi-delaunay, curves, dots-stippling]
primitives: [ellipse, rect, shape, line]
palette:
  colors: ["#ED61DA", "#200C2B", "#0029BF", "#FFE760", "#DBD1CB"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 90, tried: [200], change: large, effect: "more and larger organic blobs; canvas nearly fully covered, little grid ground left"}
  - {name: forms grid, default: 400, tried: [700], change: large, effect: "blob cell (grid/4); larger = fewer, much bigger blobs, more ground visible at edges"}
  - {name: blob noise detail, default: 0.001, tried: [0.003], change: large, effect: "higher = rougher, spikier blob outlines, same layout"}
  - {name: globos noise threshold, default: 1.9, tried: [0.9], change: none, effect: "no visible change; balloons sit under the blobs and are barely visible already"}
  - {name: lar (ribbon walk steps), default: 500, tried: [150], change: subtle, effect: "ribbons shorter, spread less across the canvas; everything else unchanged"}
  - {name: colors[0], default: "#ED61DA", tried: ["#14B8A6"], change: large, effect: "pink -> teal: background and every pink fill changes colour, rest identical"}
reusable_candidates:
  - {name: noiseBlob, signature: "noiseBlob(x, y, radius, detail) -> PVector[]", note: "closed noise-steered random walk, rescaled so first-last chord equals walk length; produces the large organic blobs"}
  - {name: packedNoiseBubbles, signature: "packedNoiseBubbles(count, noiseScale, maxR) -> PVector[]", note: "simplex-noise-sized dots with distance rejection (z_i+z_j)*1.1 -> density-packed bubbles"}
  - {name: noiseRibbon, signature: "noiseRibbon(x1,y1,x2,y2, steps, turns) -> line pair", note: "two simplex-steered walkers drawn as LINES pairs with lerped palette stroke"}
---

## What it draws
A flat, full-bleed collage on a pink (magenta) ground. Large soft-edged organic
blobs in yellow, dark blue, grey and near-black purple overlap across the whole
canvas. The lower half shows a faint white grid: thin triangulation lines, a fine
dot lattice, and translucent horizontal bands. Scattered on top: small dark/white
squares, concentric circle clusters, tiny "skyline" groups of thin bars under a
white arc, and a few thin wavy ribbons (blue/yellow) crossing the mid-left.

Dominant colours seen: pink/magenta (dominant background), yellow, dark blue, grey.

## How the code works
Everything runs once in `setup() -> generate()` (`boludo.pde`); `draw()` is empty,
so the piece is static (frames 10/60 identical to frame 1). Seed 42 drives both
`randomSeed` and `noiseSeed` (boludo.pde:47-48).

1. `grid(60)` (grid.pde:1-131) — background and the "blueprint" layer:
   - `background(rcol())` picks a random palette colour (pink for seed 42);
     a second `rect` covers everything below `hor = 300` (grid.pde:6-11).
   - 60 random grid-aligned squares (size up to `60*12`), stroked at alpha 60,
     some faintly filled, each with a tiny centre dot (grid.pde:17-39). Their
     centres are passed to `Triangulate.triangulate`; ~20% of triangles are
     stroked white alpha 40 -> the faint white mesh lines (grid.pde:41-52).
   - Translucent white gradients top and below the horizon (grid.pde:59-78),
     then a run of thin horizontal white stripes of random alpha
     (grid.pde:81-92).
   - A 1px dot lattice every 10px at alpha 90 in a palette colour
     (grid.pde:99-103) -> the fine dotted texture.
   - 1000 white 2x2 dots at alpha 20-70; with 1% probability a small
     "target" mark: concentric ellipses plus 5 short vertical lines
     (grid.pde:105-131) -> the little ring/crosshair marks.
2. `globos()` (globos.pde:1-53) — "balloons": 1500 random points, each given
   radius `z = pow(constrain(simplex(x*det,y*det)*3.5-1.9, 0, 1), 1.2)*40`;
   a point is kept only if it is >= `(z_i+z_j)*1.1` from every kept point
   (globos.pde:14-23) -> a distance packing that clusters where the simplex
   field is high. Each kept point draws a palette-filled ellipse (z x 1.1z)
   with a small white highlight top-right and a short noise-wobbled "string"
   line bottom-left (globos.pde:25-51). Low-noise areas give z=0, so balloons
   appear as small dot clusters / ring marks.
3. Ribbon block (boludo.pde:58-107) — 20 pairs of walkers: start from random
   positions pulled 0.6 towards their midpoint and snapped to the 60px grid;
   `SimplexNoise.noise(...) * TAU * 4` (4 full turns). Drawn as `LINES` vertex
   pairs, stroke `getColor((ic1+i*dc1)*5)` lerps slowly through the palette
   -> the thin wavy ribbons.
4. Big blobs (boludo.pde:112-120, 181-254) — `cc = int(90*random(0.8,1)*0.9)`
   (~65-80); two `forms()` batches with cell `grid/4 = 100`. Each blob:
   position snapped to 100px (50% of the time to 200px) + offset 50px
   (boludo.pde:190-203); `noiseCir2` walks `TAU*r` unit steps with heading
   `(noise-0.5)*3.8*pi` (boludo.pde:227-232), then rotates/scales all points so
   the first-last chord equals the walk length (boludo.pde:240-244) -> a large
   irregular closed shape, filled with `rcol()` (no stroke). These are the
   big yellow/blue/grey/purple masses; `det = 0.001*random(random(10))*3`
   controls outline roughness.
5. Scatter (boludo.pde:122-178) — 80 small squares (6.25 or 12.5px) snapped to
   a 50px grid, each with a nested smaller square in the same corner
   (boludo.pde:124-135); 20 concentric-circle groups, 20% chance of a big
   alpha-180 ring plus 25px and 10px circles (boludo.pde:136-147); 8 skyline
   clusters of 1-12 thin tapered rects, each capped by a translucent white
   arc (boludo.pde:150-178).

Palette: 5 hex colours (boludo.pde:262); `rcol()` = uniform random entry;
`getColor(v)` = lerp between adjacent entries (used by the ribbons).
`pixelDensity(2)` is requested but unavailable on this display (harmless).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `cc = int(90*random(0.8, 1)*0.9);` -> `cc = int(200*random(0.8, 1)*0.9);` | large | many more, larger blobs (yellow/blue/pink/grey/dark-purple) nearly covering the canvas; grid ground only at the edges | variants/cc_200/frame_00001.png |
| grid_700 | `grid = 400;` -> `grid = 700;` | large | fewer, much larger blobs (huge yellow and blue masses); more white grid/dot ground visible, esp. top and right | variants/grid_700/frame_00001.png |
| det_0.003 | `float det = 0.001*random(random(10))*dd;` -> `float det = 0.003*random(random(10))*dd;` | large | same blob layout but outlines far rougher and spikier (noisier edges) | variants/det_0.003/frame_00001.png |
| globos_0.9 | `noise = constrain(noise*3.5-1.9, 0, 1);` -> `noise = constrain(noise*3.5-0.9, 0, 1);` | none | no visible change (balloons are drawn under the blobs and are barely visible in the baseline) | variants/globos_0.9/frame_00001.png |
| lar_150 | `float lar = random(500)*random(0.2, 1);` -> `float lar = random(150)*random(0.2, 1);` | subtle | thin ribbons are shorter and spread less; change is scattered over the whole canvas, blobs/ground unchanged | variants/lar_150/frame_00001.png |
| palette_14B8A6 | `#ED61DA` -> `#14B8A6` (in `int colors[] = {...}`) | large | pink becomes teal: background and every pink fill turn teal; all other colours and layout identical | variants/palette_14B8A6/frame_00001.png |

## Modularisation notes
- Generic, reusable: `noiseCir2` (noise-steered closed walk + chord
  normalisation) is a self-contained blob generator; `globos` is a
  generic "noise-sized packing" (radius field + distance rejection) usable
  for any density field; the ribbon walker (noise angle * turns, 1px steps)
  is a generic 2D noise-flow line; the grid.pde blueprint layer (triangulated
  squares + dot lattice + stripes) is a reusable "technical grid background".
- One-off art decisions: the fixed 5-colour palette and `rcol()`/`getColor`
  scheme; the specific counts/sizes (60 squares, 1500 balloon samples, 80
  squares, 20 circle groups, 8 skylines); the skyline-arc and "target mark"
  motifs; the lerp-0.6-towards-centre start positions for ribbons.
- A clean parameter object would contain: palette list, blob count, blob cell
  size, blob noise detail, ribbon count / steps / turns, balloon sample count
  / noise scale / max radius / rejection factor, grid cell, square/circle/
  skyline counts.
- Note: the folder contains a byte-identical duplicate tab
  `Copia de boludo.pde`; the render is unaffected by it.
