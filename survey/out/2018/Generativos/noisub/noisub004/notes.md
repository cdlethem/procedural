---
sketch: 2018/Generativos/noisub/noisub004
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1508
animated: false
techniques: [grid, subdivision, noise-field]
primitives: [rect, shape]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 5, tried: [10], change: large, effect: "finer starting grid; tiles uniformly smaller, big-block structure weaker"}
  - {name: sub, default: 1000000, tried: [10000], change: large, effect: "less subdivision; much coarser mosaic of large blocks, few slivers"}
  - {name: noiseDetail, default: "2, 0.45", tried: ["5, 0.9"], change: large, effect: "finer subdivision-gating noise; big-tile patches break up into smaller, more uniform tiling"}
  - {name: alp, default: "random(60, 80)", tried: ["random(0, 15)"], change: subtle, effect: "corner shading nearly vanishes; tiles read as flat, structure unchanged"}
  - {name: colors, default: "DAAC80/FCC9D2/FC2E1D/235F3F/02272D", tried: ["1D3557/457B9D/A8DADC/F1FAEE/E63946"], change: large, effect: "same structure, hue shift to navy/steel/cyan/off-white with red accents"}
reusable_candidates:
  - {name: noiseQuadtreeSubdivide, signature: "subdivideRects(rects, iters, noiseScale, offset, minSize) -> List<Rect>", note: "randomly subdivide rects into quarters while a noise field at the rect centre allows it"}
  - {name: cornerShade, signature: "cornerShade(x, y, w, h, corner, alpha) -> void", note: "soft black gradient wedge from a chosen corner, drawn as two QUADS strips"}
---

## What it draws
A full-bleed mosaic of squares in red, dark green, light pink, tan and dark teal, packed
edge-to-edge with no gaps. Square sizes vary across a wide range, from large blocks down to
tiny slivers, with the coarseness varying in blotchy regions. Each tile carries a soft dark
gradient shading that falls off from one of its four corners, so the mosaic reads as a field
of beveled, embossed tiles.

## How the code works
- `setup()` (L3-9) sizes 960x960 P2D, then `generate()`; `draw()` is empty, so the piece is
  a single static frame (L11-12). Regeneration happens on any key press with a fresh seed
  (L14-20).
- `generate()` (L37): seeds `randomSeed`/`noiseSeed` from `seed` (L39-40), grey-white
  background (L42), `noiseDetail(2, 0.45)` (L43).
- A 5x5 grid of 192px rects is created from `cc = 5` (L53-59), giving base cell size
  `ss = width/cc` (L54).
- Subdivision loop (L61-77): `sub = 1000000` times, a random rect is picked (L63). Perlin
  noise sampled at the rect centre with a random offset `desSize` and scale `detSize`
  (L66) is mapped to a minimum allowed size `min = map(noi, 0, 1, 2, ss*0.5)` (L67). If the
  rect's half-size is below `min` it is skipped (L71); otherwise it is replaced by four
  quadrant rects (L72-76). High-noise areas get a larger `min`, so subdivision stops early
  there (big tiles), while low-noise areas subdivide down to ~2px (the tiny sliver patches).
- Fill pass (L79-190): each final rect is painted `rcol()` (L82), a uniform random pick from
  the 5-colour `colors[]` array (L213-216). `type = int(random(3))` (L83) chooses between a
  plain `rect` or two quad variants (L84-104) whose vertices all trace the same full square,
  so the fill is always the whole tile in one colour.
- Corner shading (L106-189): `shw = int(noise(desDir + centre*detDir)*4)` (L110) picks, via a
  *second* independent noise field, one of four corner styles. Each style draws two QUADS
  strips: a black fill at alpha `random(60, 80)` (L106) at the corner fading to alpha 0
  towards an inner point at (s1=0.2, s2=0.8) of the tile (L107-108). This is the soft dark
  wedge visible at a random corner of nearly every tile.
- `arc2` (L193-211) is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_10 | `int cc = 5;` -> `int cc = 10;` | large (0.842) | much finer mosaic; tiles uniformly smaller, the large-block blotches are weaker, same palette and corner shading | variants/cc_10/frame_00001.png |
| sub_10000 | `int sub = 1000000;` -> `int sub = 10000;` | large (0.83) | far coarser mosaic; mostly large blocks, the tiny-sliver regions almost gone | variants/sub_10000/frame_00001.png |
| noiseDetail_5_0.9 | `noiseDetail(2, 0.45);` -> `noiseDetail(5, 0.9);` | large (0.862) | subdivision-gating noise is finer-grained; big-tile patches break into many smaller ones, tiling looks more uniform, fewer big blocks | variants/noiseDetail_5_0.9/frame_00001.png |
| alp_0_15 | `float alp = random(60, 80);` -> `float alp = random(0, 15);` | subtle (0.079) | corner shading nearly vanishes; tiles read as flat single colours, layout and palette unchanged | variants/alp_0_15/frame_00001.png |
| colors_cool | `int colors[] = {#DAAC80, #FCC9D2, #FC2E1D, #235F3F, #02272D};` -> `int colors[] = {#1D3557, #457B9D, #A8DADC, #F1FAEE, #E63946};` | large (0.979) | identical structure; every tile recoloured to navy/steel-blue/light-cyan/off-white with red accents | variants/colors_cool/frame_00001.png |

## Modularisation notes
- Generic, reusable: the noise-gated quadtree subdivision (L61-77) is a self-contained
  algorithm parameterised by iteration count, noise scale/offset and min-size mapping; the
  corner-shade wedge (L111-189) is a small shading primitive parameterised by corner index
  and alpha.
- One-off art decisions: the 5-colour palette and per-tile random colour assignment; the
  two independent noise fields (one gates subdivision depth, one picks the shading corner);
  the dead `arc2`/`getColor` helpers.
- A clean parameter object would be: `{gridN (cc), iterations (sub), noiseDetail,
  subNoise {offset, scale, minFrac}, shadeNoise {offset, scale}, alphaRange, palette,
  cornerMode (noise|random|fixed)}`.
