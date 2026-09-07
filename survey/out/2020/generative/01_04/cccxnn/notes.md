---
sketch: 2020/generative/01_04/cccxnn
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]   # both imported but never used in the code
deterministic: true
ms_first_frame: 2072
animated: false
techniques: [grid, blend-modes]
primitives: [rect, shape]
palette:
  colors: ["#240118", "#6402F7", "#F7A4EF", "#F62C64", "#00DACA", "#D1CCC2"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 220, tried: [100], effect: "half the bars: ground shows through, individual sheets readable"}
  - {name: wMax, default: 0.14, tried: [0.05], effect: "max bar width 14%->5%: thin needle-like strips, airy composition"}
  - {name: hRange, default: "[0.1, 0.34]", tried: ["[0.5, 0.9]"], effect: "tall full-height slabs: denser mosaic, ground almost covered"}
  - {name: gridStep, default: "20*random(1,3)", tried: [10], effect: "finer 10px snap: bars pack tighter, alignment less visible"}
  - {name: baseAlpha, default: 200, tried: [100], effect: "more translucent base rects: colors mute and mix, glassier overlaps"}
  - {name: palette, default: "plum/violet/pink/red/teal", tried: ["#354998,#D0302B,#F76684,#FCFAEF,#FDC400 (commented-out warm set)"], effect: "same composition, hue shifts to warm yellow/red with navy accents"}
reusable_candidates:
  - {name: stackedBar, signature: "stackedBar(x, y, w, h, col, alpha, shadowSide) -> void", note: "base rect + offset gradient shadow parallelogram + ADD-blend corner gradient facet, one call per bar"}
  - {name: cornerGrad, signature: "cornerGrad(x, y, w, h, col1, a1, col2, a2, skipCorner) -> void", note: "3-4 vertex shape whose per-vertex fill alpha makes a linear gradient from col1 to col2 (alpha 0)"}
  - {name: gridSnap, signature: "gridSnap(value, step) -> float", note: "snap a coordinate/dimension down to a grid step (x -= x % step)"}
---

## What it draws
A full-bleed stack of tall, narrow translucent bars over a warm gray (#d1ccc2) ground,
seed 42. The bars run mostly vertical, snap to a coarse 20/40 px grid, and overlap
heavily; each bar carries a hard-edged dark shadow slab on one side and a diagonal
gradient facet that fades to transparent, so the overlaps glow into bright magentas,
cyans and near-whites (ADD blending). The palette is dark plum, violet, pink,
red-pink and teal. The result reads as an abstract cityscape of translucent glass
sheets. The later frames (10, 60) come back as flat white from the harness — a P2D
capture artifact, the sketch itself is static (empty draw()).

## How the code works
`setup()` -> `generate()` (lines 21-31, 85-124); `draw()` is empty so the image is
composed once. Per bar in the 220-iteration loop (line 92):

- Size: width 1-14% of canvas, height 10-34% (lines 95-96), snapped down to a grid
  of 20 or 40 px (lines 94, 100-101); position snapped to 2x the grid then offset by
  one cell (lines 103-109) — this is the visible coarse alignment of the bars.
- `shadow()` (lines 126-163) draws a 4-vertex parallelogram on one random side,
  filled black at alpha 60 fading to alpha 0, offset by 2x the bar width/height
  (line 130) — the hard drop-shadow slabs.
- Base rect: random palette color at alpha 200 (lines 119-120).
- `grad()` (lines 165-177) is drawn with `blendMode(ADD)` (line 121): it emits 3 or 4
  vertices (one corner skipped by `val`, line 167-175), first vertices filled col1 at
  alpha 200-250 (line 112), the rest col2 at alpha 0 (line 114) — Processing
  interpolates per-vertex alpha, giving a linear gradient facet. ADD is what makes
  overlapping facets blow out to bright magenta/white.

Colour: `rcol()` picks uniformly from the 5-color array (lines 187, 189-191); the
`getColor()` lerp helper (lines 197-203) is defined but never called. The
`triangulate`/`toxi` imports and the `Quad`/`vertices`/`quads` members
(lines 45-81) are dead code from an earlier triangulation approach.

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| count_100 | `for (int i = 0; i < 220; i++)` -> `i < 100` | half as many bars; gray ground visible between sheets, single bars readable | variants/count_100/frame_00001.png |
| wmax_0.05 | `width*random(0.01, 0.14)` -> `random(0.01, 0.05)` | bars collapse to thin vertical needles; airier, more ground | variants/wmax_0.05/frame_00001.png |
| hmin_0.5 | `height*random(0.1, 0.34)` -> `random(0.5, 0.9)` | tall near-full-height slabs; dense mosaic, ground mostly hidden | variants/hmin_0.5/frame_00001.png |
| grid_10 | `grid = 20*int(random(1, 3))` -> `grid = 10` | finer 10 px snap; bars pack tighter, coarse alignment no longer reads | variants/grid_10/frame_00001.png |
| basealpha_100 | `fill(rcol(), 200)` -> `fill(rcol(), 100)` | base rects far more transparent; overlaps blend softly, colors mute | variants/basealpha_100/frame_00001.png |
| palette_warm | `colors[] = {#240118, #6402F7, #F7A4EF, #F62C64, #00DACA}` -> commented-out `#354998, #D0302B, #F76684, #FCFAEF, #FDC400` | identical geometry; warm yellow/red cast with navy and off-white | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `gridSnap`, `cornerGrad` (per-vertex-alpha gradient
  shape with a skippable corner), and `stackedBar` as a composite (shadow + base
  fill + gradient facet). The per-side shadow selection is a trivial 4-way branch
  over edge normals.
- One-off art decisions: the exact 5-color palette, the 220 bar count, the
  width/height ratio ranges (tall thin bars), the 2x shadow amplification, and
  choosing ADD for the facet (swapping to NORMAL would kill the glow).
- Clean parameter object: `{ count, wMin, wMax, hMin, hMax, gridStep, baseAlpha,
  facetAlphaMin, facetAlphaMax, shadowAlpha, shadowAmp, palette, blendMode,
  groundColor }`.
