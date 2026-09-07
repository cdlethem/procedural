---
sketch: 2018/Generativos/citydatacity
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1533
animated: false
techniques: [subdivision, recursion, blend-modes]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#FF0000", "#FF6C06", "#EF9FE2", "#0045D8", "#152300"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(20)*random(0.1,1)) (0-19)", tried: [60], change: large, effect: "many more coarse regions -> ~8 big coloured ellipses instead of ~4, each with its own fine-cell interior"}
  - {name: sub2, default: "int(random(400)*random(1)) (0-399)", tried: [50], change: large, effect: "far coarser fine cells: large rectangular blocks with 1-4 subdivisions, ragged gaps mostly gone"}
  - {name: alp, default: "random(256)", tried: [80], change: large, effect: "lower alpha -> quads more transparent, colours mix muddily and black shows through more; less opaque 'solid block' look"}
  - {name: ss, default: 1, tried: [6], change: moderate, effect: "corner marks grow from 1px dots to 6px squares, adding a visible multicoloured stippled scatter at every cell corner"}
  - {name: palette, default: "FF0000/FF6C06/EF9FE2/0045D8/152300", tried: ["greyscale FFFFFF/CCCCCC/888888/444444/000000"], change: large, effect: "same structure in monochrome; white edge glow blends into white cells, gradients read as smooth greys"}
  - {name: "bb (glow width)", default: "min(w,h)*0.1", tried: ["min(w,h)*0.3"], change: moderate, effect: "3x wider white bottom/right edge glow -> strong bevelled, raised 3D-block appearance on every cell"}
reusable_candidates:
  - {name: recursiveSubdivide, signature: "recursiveSubdivide(rect, iterations, minSize, keepProb) -> Rect[]", note: "stochastic quadtree: repeatedly pick a rect, split 30-70% in each axis into 4 children"}
  - {name: gradientQuad, signature: "gradientQuad(x, y, w, h, c1, c2, alpha, glow) -> void", note: "two-colour alpha-blended quad with white bottom/right edge glow (rect2)"}
---

## What it draws
A full-bleed black canvas tiled by recursively subdivided rectangles. The
composition is dominated by a few large elliptical masses (a red one top-left,
a blue one right, an orange one centre, a red/pink one bottom-right) built up
from hundreds of small gradient-filled quads; between them, finer black regions
hold tiny multi-coloured cells. Each quad fades from one palette colour to
another (red, orange, pink, blue, dark green) and carries a faint white glow
along its bottom and right edges plus 1px corner dots, giving a lit "city
block" / circuit-board look.

## How the code works
- `setup()` (L3-9): 960x960 P2D, `smooth(8)`, then one `generate()` call;
  `draw()` is empty, so the image is static. `keyPressed()` (L14-20)
  regenerates with a new random `seed`.
- Pass 1 (L38-53): start with the full canvas rect; `sub =
  int(random(20)*random(0.1,1))` (0-19) stochastic quadtree splits: pick a
  random rect, split it at 30-70% in both axes into 4 children (skipped if a
  fragment would be < `max = 20` px, L47). This yields a coarse patchwork of
  ~5-40 large regions.
- Pass 2 (L56-99): for each coarse rect, draw a full-rect `ellipse()` (L64)
  in a random palette colour — these are the large elliptical masses (the
  ellipses are not clipped, so they bleed over neighbours and merge). Then the
  same rect is subdivided again, this time `sub2 = int(random(400))` splits
  (L68) down to `max2 = 4` px, with each of the 4 children kept only with
  probability `1 - p1..p4` where `pi = random(1)*random(1)*0.2` (L57-60, 75-79)
  — a biased, incomplete subdivision that leaves ragged gaps of black.
- Every fine cell is drawn by `rect2()` (L113-152): a 4-vertex quad whose two
  triangles each get a different random palette colour at `alpha = random(256)`
  (L115), oriented horizontal or vertical at random — the gradient fill. On
  top it draws white quads fading to transparent along the bottom edge and
  right edge (glow width `bb = min(w,h)*0.1`, L135), and `generate()` adds
  four `ss = 1` px corner dots per cell (L92-96).
- Colour: `rcol()` (L183-185) picks uniformly from the 5-colour `colors[]`
  array (L179). `getColor()`/`lerpColor` (L186-194) is defined but unused.
- Randomness enters only via `randomSeed(seed)` + `random()`; P2D renderer.

## Experiments
| variant | substitution | change score | observation | image |
| sub_60 | `int sub = int(random(20)*random(0.1, 1));` -> `int sub = 60;` | large (mean 0.2949, 0.886) | ~8 large coloured ellipses (orange, red, blue, pink) each packed with its own fine-cell texture, on a black grid of tiny cells; baseline had ~4 masses | variants/sub_60/frame_00001.png |
| sub2_50 | `int sub2 = int(random(400)*random(1));` -> `int sub2 = 50;` | large (mean 0.2551, 0.824) | fine cells far coarser: big rectangular blocks of 1-4 sub-splits, ragged black gaps mostly gone; same elliptical masses | variants/sub2_50/frame_00001.png |
| alp_80 | `float alp = random(256);` -> `float alp = 80;` | large (mean 0.1926, 0.667) | quads more transparent: colours mix muddily where cells overlap, black shows through more; masses look flatter, less solid | variants/alp_80/frame_00001.png |
| ss_6 | `float ss = 1;` -> `float ss = 6;` | moderate (mean 0.0573, 0.179) | 1px corner dots become 6px multicoloured squares at every cell corner; visible stippled scatter, structure otherwise unchanged | variants/ss_6/frame_00001.png |
| palette_greyscale | `int colors[] = {#FF0000, #FF6C06, #EF9FE2, #0045D8, #152300};` -> `{#FFFFFF, #CCCCCC, #888888, #444444, #000000};` | large (mean 0.187, 0.712) | identical structure in monochrome; white edge glow blends into white cells, gradients read as smooth greys | variants/palette_greyscale/frame_00001.png |
| bb_0.3 | `bb = min(w, h)*0.1;` -> `bb = min(w, h)*0.3;` | moderate (mean 0.0793, 0.27) | white bottom/right edge glow 3x wider; every cell reads as a raised, bevelled 3D block | variants/bb_0.3/frame_00001.png |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-ready: the stochastic quadtree (L42-53 and L69-80 are the
  same split routine with different budgets/min-sizes/probabilities — one
  `recursiveSubdivide(rect, iterations, minSize, keepProb)` function covers
  both passes), and `rect2`'s gradient quad + edge glow.
- One-off art decisions: the 5-colour palette (L179, with 3 commented-out
  alternates), drawing the coarse regions as unclipped ellipses (L64), the
  1px corner dots, and the per-child keep probabilities `p1..p4`.
- A clean parameter object would need: canvas size, top-level split count,
  per-region split count, min cell size, split ratio range (0.3-0.7), child
  keep probability, alpha range, palette, glow fraction (0.1), corner-dot
  size, and whether regions are rendered as ellipses or rects.
