---
sketch: 2018/Generativos/fabri
year: 2018
renderer: P2D
size: [2048, 2048]
libraries: []
deterministic: true
ms_first_frame: 1642
animated: false
techniques: [subdivision, grid, lines-hatching, curves]
primitives: [rect, shape]
palette:
  colors: ["#000000", "#FAFAFA", "#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: fixed
composition: full-bleed
  - {name: sub, default: "int(random(20))", tried: [5], change: large, effect: "fewer splits: much coarser partition, only a few large rects...r.w, ...h);`

Watch out for the sub in `int sub = int(random(20));` — is it unique? The only line containing `int sub = ` is line 40. Yes, unique.

`fill(255);` appears only on line 63 (line 58 is `fill(0);`). Unique.

I'll chain all five commands together and run them in a single bash invocation.
</think>

<tool_call>
<function=bash>
<parameter=command>
cd ${GENART_SURVEY_ROOT} && \
uv run tools/render.py 2018/Generativos/fabri --out out/2018/Generativos/fabri/variants/sub_5 --seed 42 --snaps 1,10,60 --budget 30 --sub 'int sub = int(random(20));' 'int sub = 5;' ; \
uv run tools/render.py 2018/Generativos/fabri --out out/2018/Generativos/fabri/variants/sep_256 --seed 42 --snaps 1,10,60 --budget 30 --sub 'int sep = 128;' 'int sep = 256;' ; \
uv run tools/render.py 2018/Generativos/fabri --out out/2018/Generativos/fabri/variants/freq_3 --seed 42 --snaps 1,10,60 --budget 30 --sub 'float freq = random(random(0.5), 10);' 'float freq = random(random(0.5), 3);' ; \
uv run tools/render.py 2018/Generativos/fabri --out out/2018/Generativos/fabri/variants/hor_true --seed 42 --snaps 1,10,60 --budget 30 --sub 'boolean hor = false;//random(1) < 0.5;' 'boolean hor = true;' ; \
uv run tools/render.py 2018/Generativos/fabri --out out/2018/Generativos/fabri/variants/alpha_128 --seed 42 --snaps 1,10,60 --budget 30 --sub 'fill(255);' 'fill(255, 128);'
reusable_candidates:
  - {name: rectPartition, signature: "rectPartition(seed, splits, cell) -> Rect[]", note: "recursive 1->4 splits of a rect at cell-snapped random points; returns a full-canvas partition"}
  - {name: cosineBand, signature: "cosineBand(x, y, w, h, freq, vertical) -> shape", note: "closed per-pixel cosine curve across a rect, filled; self-overlapping lobes at low freq, moire scanlines at high freq"}
---

## What it draws
Full-bleed, essentially black-and-white. The canvas is tiled by axis-aligned rectangles of very different
sizes (a large smooth area left of centre, a busy strip of small rects on the right). Every rect is
covered in a texture of extremely fine horizontal lines: in high-frequency rects the lines are so dense
they read as flat light grey; in low-frequency rects the same construction resolves into broad
self-overlapping lobes — a vertical chain of grey lens/ellipse shapes, and in one small rect a white
zigzag of triangles on black. Top-left corner is solid black. No colour is visible.

## How the code works
`setup()` (fabri.pde:3-8) is 2048x2048 P2D; `draw()` is empty (regen-on-keypress commented out, line 11),
so the image is static. `generate()` (lines 32-78):

1. `background(250)` (line 33) — never visible, the rects below cover everything.
2. Partition (lines 35-52): start from the whole-canvas rect (line 38); `sub = int(random(20))`
   iterations (line 40). Each iteration picks a random surviving rect (line 42) and replaces it with 4
   children split at a random point snapped to the `sep = 128` grid (lines 45-51). Randomness enters
   only here and in the wave frequencies below.
3. Fill loop (lines 56-77): each rect is painted solid black (`fill(0)`, lines 58-59) with a near
   invisible `stroke(0, 10)` (line 55). Then a white shape (line 63): `freq = random(random(0.5), 10)`
   (line 61) — double-random, biased to low values. `hor` is hard-coded `false` (line 62), so the
   curve runs top-to-bottom: one vertex per pixel row, `x = (cos(freq*j)+1)/2 * r.w` (lines 71-74),
   closed with `endShape(CLOSE)` (line 76). The self-intersecting closed curve fills with nonzero
   winding: low freq gives the overlapping lens/lobe chains, high freq gives the dense horizontal
   moire scanlines.
4. Dead code: `arc2()` (lines 80-98) and the 5-colour palette `colors[]` / `rcol()` / `getColor()`
   (lines 105-117) are never called from `generate()`; only black and white actually render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `rectPartition` (lines 35-52) is generic: a seeded recursive 1->4 rect splitter with cell snapping;
  parameters: split count, cell size, optional minimum child size (the `sep` guard is commented out,
  line 44).
- `cosineBand` (lines 61-76) is generic: (x, y, w, h, freq, vertical) -> filled per-pixel cosine band;
  the fill colour/alpha and the frequency distribution are the only art decisions.
- One-off art decisions: the black-under/white-over two-tone scheme, the double-random frequency
  `random(random(0.5), 10)`, `hor` hard-coded false, the 2048 px canvas and 128 px snap.
- A clean parameter object: `{splits, cell, freqMin, freqMax, vertical, fillTop, fillBottom, seed}`.
- The unused palette and `arc2` can be dropped in a library port.
