---
sketch: 2019/generativos/globologia
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2527
animated: false
techniques: [noise-field, voronoi-delaunay, particles, lines-hatching, blend-modes]
primitives: [ellipse, line, shape]
palette:
  colors: ["#B2354A", "#3A48A5", "#D69546", "#683910", "#46BCC9"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: delaunayWash, signature: "delaunayWash(points, maxAlpha) -> void", note: "faint per-vertex coloured Delaunay triangle wash drawn under ADD blend"}
  - {name: starburst, signature: "starburst(p, steps, alpha, colorIndex, drift) -> void", note: "1-px-step walk whose heading lerps to a fixed angle, stamping dense additive ellipses into a white-core fan"}
  - {name: noiseGlobe, signature: "noiseGlobe(p, curves, length, detail, alpha) -> void", note: "many 1-px walks restarted at p, each following an angular simplex-noise field, forming a circular disc of faint lines"}
---

## What it draws
On a black canvas, a dozen or so glowing "globes" are scattered, some overlapping. Each globe is a
circular disc of extremely fine, densely packed multi-coloured lines (crimson, indigo, cyan, amber)
fanning out from a small, saturated white starburst core; the cores read as bright stars with short
radiating tails. A few very faint, large thin arcs cross the canvas between the globes. Dominant
colours: white (cores), crimson/red and indigo/blue (line fans), with cyan and orange accents.

Note: baseline `frame_00010.png` and `frame_00060.png` (identical to each other) show a mostly white
canvas with a few angular black blobs and sparse thin coloured lines at the edges. The sketch is
static — `draw()` is empty (line 32-33) and `generate()` runs once in `setup()` — so this is a
P2D/GL framebuffer readback artifact on the GPU display, not temporal behaviour. Frame 1 is the
real artwork.

## How the code works
`setup()` calls `generate()` once (line 22-24); `draw()` is empty (32-33). Everything is drawn
additively: `background(0)` then `blendMode(ADD)` (38-40), so overlapping low-alpha strokes
accumulate and saturate to white at the densest points.

1. **Point placement** (44-76): 20 points at random positions, snapped onto a jittered staggered
   grid — cell size `sw = random(120)` × `sh = random(120)`, half-cell offset applied depending on
   grid-index parity (55-61); points closer than 1 px are rejected (64-70). Points may fall
   outside the canvas (positions drawn over `width+sw`), so fewer are visible.
2. **Delaunay wash** (78-91): points triangulated with the `triangulate` library; each triangle's
   three vertices get `fill(rcol(), random(50))` (max alpha 50, line 79-84) with `stroke(255, 10)`.
   Under ADD this is a faint coloured wash behind the globes — the source of the large faint arcs
   (triangle edges, line 79).
3. **Starburst core** (110-127): per point, a 2000-step walk (line 121): heading `ang` lerps
   toward 0 (line 122), each step moves 1 px perpendicular-ish (`ang+HALF_PI`), stamping a 2×1
   ellipse with `fill(getColor(ic+dc*k), 120)` (line 125). Colour index `ic` drifts slowly
   (`dc = random(0.01)`), so each tail passes through the palette. Alpha 120 × 2000 overlapping
   ellipses under ADD saturate the start point to white — the star core.
4. **Globe disc** (129-146): per point, `ss = random(80, 400) * random(0.4, 1)` (line 129) fixes
   the curve length; 2400 curves (line 130) each restart at the point (131-132), take a random
   start angle, and walk `ss` steps of 1 px in direction `noise(x*det, y*det)*TAU - ia + ang`
   (line 141), where `det = random(0.1, 0.2)*0.02` (line 108). Stroke `rcol(), 10` alpha (line 135),
   no fill. Because the heading is a smooth field of position, all curves follow the same
   coherent swirl, producing the circular line-fan discs. 2400 × up to 400 segments per point is
   the bulk of the render cost.

Randomness enters at: point positions (47-48), grid cell sizes (44-45), triangle alphas (84-88),
per-point starburst start colour/drift/angle (116-119), curve lengths (129), per-curve start
angle (137). `getColor` (174-180) lerps between adjacent palette entries and cycles; `rcol`
(168-170) picks a random palette entry. The palette (167) is crimson `#B2354A`, indigo `#3A48A5`,
amber `#D69546`, dark brown `#683910`, cyan `#46BCC9`; four earlier palettes are commented out
(163-166).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic (library candidates):** the Delaunay wash (78-91), the starburst walk (110-127) and
  the noise-globe disc (129-146) are all self-contained given a point list / point, a palette and
  a blend mode; each maps to one function (see `reusable_candidates`). The palette + `getColor`
  lerp (167-180) is a small reusable colour module. The point placement (44-76) is a jittered
  staggered-grid sampler — reusable but its 1-px dedupe is a no-op in practice.
- **One-off art decisions:** the exact step counts (2000 / 2400), alphas (50/120/10/10), the
  `ang+HALF_PI` perpendicular twist in the starburst, and the choice to run the globe curves
  through an angular (×TAU) noise field are stylistic knobs, not structure.
- **Parameter object:** `{points, palette, blendMode, washMaxAlpha, starburst: {steps, alpha, colorDrift}, globe: {curves, length, detail, alpha}}`.
