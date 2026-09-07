---
sketch: 2017/Generativos/grids
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [grid, lines-hatching]
primitives: [shape]
palette:
  colors: ["#FFAAC5", "#01D6B2", "#E0C200", "#B3A749", "#EB4E33", "#041A1B", "#F7EFF4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(100, 800)", tried: ["random(100, 200)"], change: large, effect: "lines per family; fewer = wider bands, coarser grid, much larger cells"}
  - {name: d, default: "width*8", tried: ["width*3"], change: large, effect: "chord radius from the far centre; too small = chords never reach the canvas, nearly blank output"}
  - {name: x, default: "width*random(-5, 5)", tried: ["width*random(-1, 1)"], change: large, effect: "family centre range; closer to canvas = denser, more vertical bands covering the whole canvas"}
  - {name: w, default: "random(0.2, 0.8)", tried: ["random(0, 1)"], change: none, effect: "shading-facet position; no visible change at the low alphas used (10-40)"}
  - {name: colors, default: "7-colour coolors.co palette", tried: ["7-step grayscale #111..#DDD"], change: large, effect: "identical geometry, fully grayscale rendering"}
reusable_candidates:
  - {name: linesIntersection, signature: "linesIntersection(x1,y1,x2,y2,x3,y3,x4,y4) -> PVector|null", note: "segment/line intersection test (xor half-plane check + explicit solve); the whole sketch is built on it"}
  - {name: clipLineToRect, signature: "clipLineToRect(x1,y1,x2,y2,rect) -> [PVector,PVector]|null", note: "keep a line only if it crosses two opposite-ish edges of a (possibly off-canvas) rect"}
  - {name: quadGridFill, signature: "quadGridFill(linesA, linesB, fill) -> void", note: "adjacent pairs from two line families bound a quad; fill it and add translucent shading facets"}
---

## What it draws
Broad diagonal bands sweeping from lower-left to upper-right, formed by two
families of near-parallel lines that cross at a shallow angle, so the canvas is
tiled into long parallelogram cells. Each cell is filled with a flat colour
drawn from a 7-colour palette (pink, teal, gold, olive, red-orange, very dark
teal, off-white) and gets two soft translucent facets (a blackish wedge and a
whitish wedge) that give the bands a faceted, low-poly shading. Background is
off-white.

## How the code works
`setup()` -> `generate()` (grids.pde:3-8); `draw()` is empty, so the piece is
static (the regenerate-on-key is at 16-19).

- Two line families, `lines1` and `lines2`, built in the `for i < 2` loop
  (26-63). Each family shares one random centre `(x, y)` far outside the canvas
  (`width*random(-5,5)`, 32-33) and one base angle `a` (35); `sub`
  (100-800) lines are spread over a fan of `PI` radians (37-38), each drawn as
  a long chord through the centre of radius `d = width*8` (34, 41-43). Because
  the centre is far away, each family looks like a tight bundle of roughly
  parallel lines; the two bundles cross, making the grid.
- Each candidate line is clipped to the canvas: it is kept only if it intersects
  exactly two of the four edges of the (slightly off-canvas, `bb = -200`)
  rectangle (44-61), using `linesIntersection` (144-159).
- The 66-73 loop records every intersection of lines1 x lines2 on the Line
  objects (`l.points`), but these stored points are never used for drawing —
  the drawing recomputes intersections itself.
- The fill loop (76-130) takes *adjacent* lines within each family (i, i+1).
  Two adjacent lines from each family bound up to 4 intersection points = one
  cell; when all 4 exist it fills the quad with `rcol()` — a random palette
  colour from the 7-entry `colors[]` (176-179).
- The faceted shading (102-127): a random point `cx,cy` inside the quad
  (bilinear lerp with random weights `w`,`h` in 0.2-0.8), then two quads
  overlaid — `fill(0,20)`/`fill(0,40)` black with low alpha over one corner and
  `fill(255,20)`/`fill(255,10)` white over another — producing the soft
  dark/light facets visible in the image.
- `getColor` (180-186) is a lerp-between-palette-colours helper, commented out
  at the call site (94) in favour of `rcol()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_200 | `int sub = int(random(100, 800));` -> `int sub = int(random(100, 200));` | large | far coarser grid: only ~6-8 wide bands cross the canvas, cells are much larger, same palette and faceted shading | variants/sub_200/frame_00001.png |
| d_3 | `float d = width*8;` -> `float d = width*3;` | large | canvas nearly blank: chords too short to reach the canvas from the far centres; only a faint sliver of bands in the bottom-right corner | variants/d_3/frame_00001.png |
| xRange_1 | `float x = width*random(-5, 5);` -> `float x = width*random(-1, 1);` | large | centres near/inside the canvas: denser, more vertical bands, whole canvas tiled with many cells, same palette | variants/xRange_1/frame_00001.png |
| wRange_1 | `float w = random(0.2, 0.8);` -> `float w = random(0, 1);` | none | no visible change (facet point moves only imperceptibly at alphas 10-40) | variants/wRange_1/frame_00001.png |
| colors_gray | `int colors[] = {#FFAAC5, ...}` -> 7-step grayscale | large | identical geometry, all cells grayscale from near-black to light gray | variants/colors_gray/frame_00001.png |

## Modularisation notes
Generic, reusable: `linesIntersection` (pure geometry, 144-159); the
clip-to-rectangle logic (44-61, currently inlined four times); the
adjacent-pairs-quad-cell builder (76-99). One-off art decisions: the two far
off-canvas centres + single angle per family (what makes "bundles crossing at a
shallow angle"), the fixed 7-colour coolors.co palette, the low-alpha black/white
facet trick, and the `bb = -200` bleed. A clean parameter object would hold:
{lineCount per family (sub), centre distance multiplier (the `8` in `width*8`
and the `random(-5,5)`), angle spread (PI), palette, facet alpha pair, bleed
(bb)}.
