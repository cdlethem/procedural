---
sketch: 2018/Generativos/notdata
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2241
animated: false
techniques: [subdivision, grid, distortion]
primitives: [rect, line, ellipse, arc, image, pgraphics]
palette:
  colors: ["#92C8FA", "#0321A1", "#07AE28", "#F94D21", "#FFFFFF"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: quadtreeSubdivide, signature: "quadtreeSubdivide(seed, iterations, minSize) -> {x, y, size}[]", note: "random 3x3 quadtree: repeatedly pick a random cell and replace it with 9 children of size/3 until minSize"}
  - {name: perspGlyph, signature: "perspGlyph(size, palette) -> PGraphics", note: "P3D buffer: random-FOV perspective camera + random XYZ rotations, filled quad with a smaller ellipse + cross in front, palette-lerped background"}
  - {name: rcol, signature: "rcol(colors[]) -> color", note: "uniform random pick from a palette array"}
---

## What it draws
On a flat light-grey (sampled #CCCCCC) 3250x3250 canvas, most of the surface is empty. A 3x3
grid of large square tiles (about 360 px each) sits near the centre; more, smaller clusters of
the same tiles (down to ~30 px) are scattered in the lower-left. Each tile has a pale pastel
background (light blue, pink-salmon, pale green or white) with a strongly perspective-warped
coloured quad (orange, green, blue or white) — often a thin "fin" or a large blob — plus a small
ellipse with a plus-shaped cross in front of it, and very faint dark/light quarter-circle rings
around the tile centre.

## How the code works
`setup()` (notdata.pde:3-11): `size(3250, 3250, P2D)`, `pixelDensity(2)` (rejected by this
display per stderr), then `generate()` once, save, exit. `draw()` is empty, so the sketch is
static — only `frame_00001.png` exists.

`generate()` (notdata.pde:25-119):
1. `background(0)` and `randomSeed(seed)` — every `random()` after is deterministic (seed 42 here).
2. Quadtree (32-44): start with one cell covering the whole canvas (`PVector(0,0,width)`, z=size).
   `sub = int(random(100))` iterations: pick a random cell; skip if `r.z/3 <= width/273` (min
   size ~12 px); otherwise replace it with a 3x3 grid of 9 children of size `r.z/3` (38-43).
   The list always tiles the canvas exactly.
3. Draw loop (50-118), per leaf cell:
   - tile background: `rect(cx, cy, r.z-1, r.z-1, 1)` filled with `lerpColor(rcol(), color(255), 0.9)`
     — a random palette colour pushed 90% toward white (57-58).
   - 3D glyph (60-86): a `PGraphics` buffer of `0.8*ss` pixels created with **P3D**, given a random
     perspective camera (`fov = PI/random(1.4, 3.6)`, 64), a background lerped from a random palette
     colour toward white by `random(1)` (68), random `rotateX/Y/Z` (70-72), then a filled quad in
     `rcol()` (75-76), and in front of it (`translate(0,0,1)`, 80) an ellipse of size
     `ss*random(0.6)` with a small cross of two lines (77-83). Blitted with `image(gra, cx, cy)` (86).
     The random FOV/rotations produce the warped "fin"/blob shapes visible on the tiles.
   - Faint centre marks (102-117): four quarter-arcs at radius `ss*0.1` and four at `ss*0.06`,
     alternating `fill(0, 30)` / `fill(255, 30)` — the barely visible concentric quarter-rings.

Colour comes from `rcol()` (139-141): uniform random pick from the 5-colour array at line 138
(light blue, dark blue, green, orange-red, white). A commented-out alternative dark-blue palette
sits at line 137. The `trap()` quad helper (121-130) is only used in commented-out code (88-99).

**Render discrepancy:** the algorithm provably tiles the whole canvas, yet the rendered frame
shows large flat #CCCCCC regions and `background(0)` also reads #CCCCCC instead of black. This
looks like a headless P2D/P3D software-GL artefact (possibly late `image(gra, ...)` blits
overwriting the surface). Relative differences between variants remain comparable; the `bg_255`
experiment below checks the background behaviour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `quadtreeSubdivide` (the 32-44 block is a clean random-quadtree generator;
  parameterise split factor 3, iteration count, and min size); `rcol`/palette array; the
  quarter-arc centre marks (102-117) are a self-contained "registration-mark" decoration.
- One-off art decisions: the specific 5-colour palette; the 0.9 lerp-to-white for tile
  backgrounds; the exact glyph recipe (quad + ellipse + cross, z-offset 1); fov range
  1.4-3.6; the alpha-30 arcs.
- Suggested parameter object: `{seed, size, iterations (sub), splitFactor (3), minCell,
  palette[], tileLerpToWhite (0.9), fovRange [1.4, 3.6], glyphScaleRange (0.6),
  arcScales [0.1, 0.06], arcAlpha (30), background}`.
- Caveat: the P3D-buffer-per-tile approach is the expensive part (one GL buffer per cell) and is
  the likely source of the headless rendering artefact; a Java2D-only variant (affine transform
  instead of perspective) would be the robust library version of `perspGlyph`.
