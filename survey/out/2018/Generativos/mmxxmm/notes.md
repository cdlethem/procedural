---
sketch: 2018/Generativos/mmxxmm
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: false
ms_first_frame: 7185
animated: false
techniques: [grid, symmetry]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#F19617", "#251207", "#15727F", "#CEAB81", "#BD3E36"]
  selection: random-from-list
composition: margins
parameters: []
reusable_candidates:
  - {name: rectShadow, signature: "rectShadow(size, alpha1, alpha2)", note: "4 soft triangular shadow wedges around the current origin"}
  - {name: star, signature: "star(x, y, size, angle, innerRatio)", note: "10-point star polygon, alternating outer/inner radii"}
  - {name: triLine, signature: "triLine(x1, y1, x2, y2, segments)", note: "row of triangles along a line, tips offset perpendicular (border trim)"}
  - {name: rcol, signature: "rcol() -> color", note: "uniform random pick from the palette array"}
---

## What it draws
A full-bleed mosaic of overlapping diamonds (45°-rotated squares) on a red background, with a plain red
margin around the edge. Each diamond is faceted into four triangles of different random palette colours
(orange, dark brown, teal, cream, brick red) and carries a soft diagonal drop-shadow, so the grid reads
like a woven quilt. Every cell has a small dark diamond at its centre, and about a hundred tiny 10-point
stars in palette colours are sprinkled sparsely over the pattern.

## How the code works
`setup()` (mmxxmm.pde:3-12) calls `generate()` 10 times, each followed by `saveImage()` (the `self_*.png`
files in the output dir); `draw()` is empty, so the piece is static.

`generate()` (25-118):
1. `background(rcol())` (28) picks a random palette colour for the ground — red/teal/brown depending on the run.
2. Cell size `ss = random(40, 320)` (30); `cc = width/ss - 1` cells (31); `bb` centres the grid (32).
3. Faint overlay grid (37-54): over a finer grid `gc = (cc+2)*4`, each point gets a 45°-rotated square
   `gs*0.6` in `fill(255, 8)` (near-invisible white, line 42/48), a tiny dark square `gs*0.25` in
   `fill(0, 6)` (51) and a small ellipse offset by `(gs*0.5, gs*0.5)` (52). These alphas are so low the
   layer is barely visible.
4. Border trim (56-60): `triLine` draws `gc` triangles of one random colour along each of the four edges;
   they sit in the margin and are largely hidden by the pattern, so the margin reads as plain background.
5. Main cells (64-105): each cell is translated to its centre and rotated 45° (`rotate(HALF_PI*0.5)`, 68).
   Per cell: `rectShadow(ss*1.25, 140, 0)` (71) draws the soft 4-wedge shadow; a square of side `ss` is
   built as one `beginShape` whose four vertices each set a *different* `fill(rcol())` (73-80) — Processing
   renders this as four triangles, which is the source of the 4-colour facet per diamond; a two-facet
   overlay (left half `fill(0,0)`, right half `fill(0,80)`, 89-96) adds the diagonal shading;
   `rectShadow(ss*0.25, 80, 0)` in black (98-99) plus a small `ss*0.2` square in `rcol()` (101-102) make
   the centre diamond.
6. Stars (107-117): 100 iterations, each a 10-point star (`star`, 120-130) of radius `random(6)*0.5` at this time, I've used 18219 tokens, I've used 18219 tokens, I renders:
1. ss_200
2. lightAlpha_40
3. shadow_0
4. stars_0
5. rot_0
6. palette_alt
</think>

<tool_call>
<function=bash>
<parameter=command>
cd ${GENART_SURVEY_ROOT} && uv run tools/render.py 2018/Generativos/mmxxmm --out out/2018/Generativos/mmxxmm/variants/ss_200 --seed 42 --snaps 1,10,60 --budget 30 --sub 'float ss = random(40, 320);' 'float ss = 200;'; echo "=== EXIT ss_200: $? ==="