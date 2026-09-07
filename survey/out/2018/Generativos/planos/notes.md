---
sketch: 2018/Generativos/planos
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1479
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#F8F8F8", "#000000", "#F0F0F0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(80)) (0-79, seed-dependent)", tried: [30, 150], change: large, effect: "30 = coarser (top half two giant blocks); 150 = finer, more rects, bigger dense clusters"}
  - {name: div, default: "int(random(2, 4)) (2 or 3)", tried: [2], change: large, effect: "2 only = coarser mosaic, larger blocks and larger min cell in fine clusters"}
  - {name: bb, default: 4, tried: [16], change: moderate, effect: "same layout; white gutters visibly thicker (4 -> 16 px total gap)"}
  - {name: "stroke 2nd arg", default: 6, tried: [14], change: none, effect: "no visible change: it is stroke alpha (6/255 ~ invisible), not width; default weight is 1 px. The visible grid lines are the gutters, not the stroke"}
  - {name: fill, default: "(random(1) < 0.5) ? 248 : 0, alpha 220", tried: ["always 0, alpha 220"], change: large, effect: "all rects near-black; layout unchanged, only white gutters remain"}
reusable_candidates:
---

## What it draws
A monochrome mosaic that tiles the whole 960x960 canvas with axis-aligned rectangles of
very different sizes, from ~100 px blocks down to tiny ~10 px specks. The left third is
densely subdivided into clusters of small black and near-white squares with visible white
gutters between them; the right and bottom areas are dominated by a few large black and
white blocks. Overall it reads as an irregular black-and-white grid with heavy regions of
fine subdivision against flat regions.

## How the code works
`setup()` (planos.pde:4-11) sizes the canvas 960x960 P2D, loads `post.glsl` into `post`,
and calls `generate()` once; `draw()` (13-14) is empty, so the piece is static. A key press
regenerates with a new `seed` (16-22).

`generate()` (24-62):
1. `randomSeed(seed)`; `background(240)` — the off-white canvas (line 27).
2. Starts with one rect covering the full width (PVector stores x, y, size in `.z`), lines 29-30.
3. Subdivision loop (34-47): `sub = int(random(80))` iterations (0-79). Each iteration picks
   a random existing rect (36), splits it into `div = int(random(2, 4))` (i.e. 2 or 3) so
   into a div x div grid (38-45), removes the parent and adds the div^2 children (43, 46).
   Splits smaller than 5 px are skipped (39-40). Because parents are chosen uniformly at
   (alpha 220). The visible grid lines are the background(240) showing through the 4 px gutters:
 we change only the fill, the random stream changes... no wait: in fill_black I replaced the entire fill call including `random(1)` — so the random stream after that point... the fill loop is the last random consumer, so no downstream effect. Layout is identical. Confirmed visually.

For a "fill alpha" experiment: `fill((random(1) < 0.5)?248:0, 220);` → `fill((random(1) < 0.5)?248:0, 80);` — semi-transparent fill, background shows through. That's a good 6th variant. I've used 6 renders so far; the cap is 8. I can run one more: fill_alpha_80.

Actually, let me count: 6 renders used. Max 8. One more experiment (fill alpha 80) is doable. That's a different aspect (transparency) from the fill-black test. Let's do it — total 7, still under 8.

Also worth noting: `random(2, 4)` gives 2.x or 3.x → int is 2 or 3. Correct.

Let's run the 7th render, then write the notes.
</think>

One more experiment within budget (7/8): fill alpha 80 to test translucency.

<tool_call>
<function=bash>
<parameter=command>
cd ${GENART_SURVEY_ROOT} && uv run tools/render.py 2018/Generativos/planos --out out/2018/Generativos/planos/variants/fill_alpha_80 --seed 42 --snaps 1,10,60 --budget 30 --sub 'fill((random(1) < 0.5)?248:0, 220);' 'fill((random(1) < 0.5)?248:0, 80);'
   while others stay as large blocks.
4. Drawing loop (49-58): each final rect is inset by `bb = 4` total (2 px per side, 51-54),
   stroked black width 6 (55), filled with 248 (near-white) or 0 (black) chosen 50/50 per
   rect at alpha 220 (56). The gutters plus strokes create the visible grid lines.
5. `filter(post)` is commented out (61), so the GLSL shader in `data/post.glsl` is never
   applied and has no visual effect.

Randomness enters only via `randomSeed(seed)`: iteration count, which rect is split, split
factor, and each rect's fill. No noise, no transforms, no blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the subdivision loop (34-47) is a clean "random quadtree-ish" generator — a
  function taking canvas size, iteration count, split range, and min size, returning a list
  of rects. The drawing loop (49-58) is a separate "draw guttered rect list with random
  two-value fills" pass.
- One-off art decisions: the specific 50/50 black/near-white fill, 4 px gutter, 6 px stroke,
  off-white background, and the fixed 960 px square canvas.
- Clean parameter object: `{iterations, divMin, divMax, minSize, gutter, strokeWeight,
  fills: [c1, c2], fillProb, background}`.
