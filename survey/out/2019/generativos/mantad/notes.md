---
sketch: 2019/generativos/mantad
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1684
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#1100ff", "#FF2200", "#040404", "#ffcd19", "#e9edf0"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: hexShadowWedge, signature: "hexShadowWedge(x, y, radius, color, alpha) -> void", note: "tapering translucent quad cast from a point along a hex direction (radius x 6 reach)"}
  - {name: isoHexCube, signature: "isoHexCube(x, y, radius, color, rot) -> void", note: "isometric 'cube' = 3 rhombi from centre to 3 consecutive hex vertices, optionally lerped toward white"}
  - {name: hexGridSite, signature: "hexGridSite(dd, width, height) -> [x, y]", note: "random site on an offset hex grid (sqrt(3)*dd x-spacing, 1.5*dd y-spacing, parity offset)"}
---

## What it draws
A full-bleed isometric field (seed 42): a warm amber/orange glowing background built from many
overlapping translucent wedge streaks radiating in hex-grid directions, tinted with violet and
purple where shadows cross, plus scattered bright isometric "cubes" (hexagons of three rhombi) in
yellow, purple, white and orange at many different sizes and rotations. The whole surface has a
fine grainy noise texture.

## How the code works
- `settings()` (mantad.pde:17-22): 960x960 P2D, `smooth(8)`. `setup()` loads `noiseFrag.glsl`,
  calls `generate()` once; `draw()` is empty so the image is static (baseline frames 10/60 were
  dropped as identical).
- `generate()` (mantad.pde:48-97) seeds `random`/`noise` with the seed field, sets shader uniform
  `displace=543`, paints the background with one random palette colour (`rcol()`, mantad.pde:158-160,
  palette at mantad.pde:153), then translates to centre and rotates 30 degrees (`TAU/6*0.5`).
- The main loop (mantad.pde:62) iterates 180 times: `ss = 4*int(random(1, random(5, 14)))/1.3`
  gives a random size (roughly 3-42), and the site is a random cell of an offset hex grid
  (`dd=8`, x = `ix*dd*sqrt(3)` plus a parity-dependent offset, y = `dd*3*iy/2`, mantad.pde:66-75).
- Per site, `hexShadow(xx, yy, ss*18)` is called 6 times while the grain shader is active
  (mantad.pde:80-88). `hexShadow` (mantad.pde:116-138) draws a 4-vertex quad from the site: two
  edges at a random hex-multiple angle with alpha `random(120,220)*0.4`, then two vertices offset
  by 6x the radius in another random hex direction with alpha 0 — a long tapering translucent
  "shadow" wedge. Hundreds of overlapping low-alpha yellow/violet wedges accumulate into the
  amber glow background.
- Then with `blendMode(ADD)`, `hex(xx, yy, ss*4)` (mantad.pde:99-114) draws the bright cube:
  three 120-degree rhombi from centre to three consecutive hex vertices, each filled with a
  palette colour (first face lerped ~14% toward white), which is why the cubes glow and pop out
  of the background.
- The fragment shader (data/noiseFrag.glsl:18-26) hashes `gl_FragCoord + displace` at 0.001 scale,
  adds `noi*0.1` brightness and rewrites alpha as `pow(a, 1.8)*(0.7-noi*0.4)` — this produces the
  fine grain visible over everything (the grain is visible in the baseline, so the shader rendered
  correctly despite `uses_shader: true` under headless display `:2`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `hexGridSite` (offset hex lattice sampler), `isoHexCube` (isometric hex cube primitive),
  `hexShadowWedge` (directional tapering translucent quad), and the `displace` grain shader.
  These are all parameterisable and reusable.
- One-off art decisions: the 6x shadow reach, alpha range 120-220 * 0.4, the 14% white lerp on
  cube faces, the 30-degree global rotation, the specific palette line, and calling `hexShadow`
  exactly 6 times per site.
- A clean parameter object would contain: site count, grid spacing `dd`, size range (the
  `random(1, random(5,14))` band), shadows-per-site, shadow reach multiplier, shadow alpha
  range, cube scale multiplier, palette list, background mode (palette colour), grain `displace`
  and grain strength.
