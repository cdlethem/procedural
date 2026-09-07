---
sketch: 2018/Generativos/tabla
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1529
animated: false
techniques: [grid, lines-hatching]
primitives: [rect, shape, line, ellipse]
palette:
  colors: ["#92C8FA", "#0321A1", "#EFFF43", "#F94D21"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc (grid cells per side), default: "int(random(4, 17))", tried: [4], change: moderate, effect: "coarse 4x4 checkerboard of big squares; fewer, larger triangles and coarser hatching lines"}
  - {name: triangleCount, default: 80, tried: [16], change: large, effect: "sparse facets; underlying checkerboard grid clearly visible across the canvas"}
  - {name: triangleFillAlpha, default: "random(160, 256)", tried: [256], change: moderate, effect: "triangles fully opaque: soft fade to the transparent vertex is lost, harder flat stained-glass facets"}
  - {name: hatchLineAlpha, default: 180, tried: [255], change: subtle, effect: "hatch lines slightly stronger; otherwise nearly identical"}
  - {name: gridStrokeAlpha, default: 80, tried: [255], change: none, effect: "no visible change: grid strokes are overpainted by the adjacent cells' fills (dead parameter)"}
reusable_candidates:
  - {name: hatchedTriangle, signature: "tl(x1,y1,x2,y2,x3,y3) -> void", note: "fills a triangle with a family of parallel lerp-interpolated lines, count proportional to side length, colour from palette lerp"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "lerps between adjacent palette entries indexed by abs(v) mod len"}
  - {name: snapToGrid, signature: "snap(v, cell) -> float", note: "v -= v % cell; snaps a random coordinate onto grid intersections"}
---

## What it draws
A full-bleed 960×960 mosaic built from a coarse grid of flat-coloured squares (light blue,
deep blue, yellow, orange) whose thin dark grid lines are visible in the gaps. On top, a
scattering of large translucent triangles in the same palette, some nearly opaque, many with
fine families of parallel lines inside them (hatching that fades across the triangle), and
tiny dots marking the triangle vertices. The overall read is a stained-glass "table" of
angular facets over a checkerboard of colour.

## How the code works
`setup()` (line 3) calls `generate()` once; `draw()` does nothing, so the piece is static
(frames 10/60 were dropped as identical). `generate()` (line 22):
1. Background is one random palette colour (line 26).
2. Grid: `cc = int(random(4, 17))` cells per side (line 28), cell size `ss = width/cc`;
   every cell gets a `rect` filled with `rcol()` — a uniform random pick from the 4-entry
   `colors[]` array (line 102) — with a dark low-alpha stroke `stroke(0, 80)` (line 30).
3. Triangles: 80 iterations (line 38); each corner coordinate is `random(width+ss)` snapped
   to the grid via `x -= x % ss` (lines 39–50), so vertices always sit on grid
   intersections. The shape is a `beginShape` triangle whose first two vertices get
   `fill(rcol(), random(160, 256))` and the third gets `fill(rcol(), 0)` (lines 52–58) —
   that transparent vertex makes the triangle fade out along one edge, giving the soft
   gradient look.
4. For every triangle edge, `tl()` (line 80) draws `cc = min(neighbouring side lengths)*0.5`
   with `getColor(ic)` (palette lerp, lines 109–116) at alpha 180 — this is the fine
   hatching visible inside the triangles, denser on longer triangles.
5. Three small ellipses (`ss*0.02`) mark the vertices (lines 64–67).

Randomness enters via `randomSeed(seed)` (line 24): grid count, cell colours, triangle
corners, fill alphas, and hatch colours. No noise, no shaders, no blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_4 | `int cc = int(random(4, 17));` -> `int cc = 4;` | moderate | coarse 4x4 checkerboard of large squares (yellow, deep blue, orange, light blue); only ~4 large triangles with big hatching lines, most of the mosaic showing | variants/cc_4/frame_00001.png |
| triangles_16 | `for(int i = 0; i < 80; i++){` -> `for(int i = 0; i < 16; i++){` | large | sparse overlay: 16 big triangles over the now clearly visible fine checkerboard; large flat colour areas with strong hatching | variants/triangles_16/frame_00001.png |
| fillAlpha_256 | `fill(rcol(), random(160, 256));` -> `fill(rcol(), 256);` | moderate | triangles fully opaque: crisp hard-edged facets, the soft gradient fade to the third vertex is gone; more contrasty, less glassy | variants/fillAlpha_256/frame_00001.png |
| hatchAlpha_255 | `stroke(getColor(ic), 180);` -> `stroke(getColor(ic));` | subtle | hatch lines marginally more distinct inside triangles; composition and colours essentially unchanged | variants/hatchAlpha_255/frame_00001.png |
| gridStroke_255 | `stroke(0, 80);` -> `stroke(0);` | none | no visible change — the grid stroke is completely covered by the fills of the cells drawn after it (each rect overpaints its neighbours' strokes), so the alpha has no effect | variants/gridStroke_255/frame_00001.png |

## Modularisation notes
- Generic / library candidates: `snapToGrid` (coordinate quantisation), `rcol` (random
  palette pick), `getColor(v)` (continuous palette lerp), and `tl` (edge-interpolation
  hatching of a triangle, fully generic in colours/alpha/line count).
- One-off art decisions: the 80-triangle overlay count, the 160–256 fill-alpha range, the
  transparent third vertex (a deliberate gradient trick), the 4-colour palette itself, the
  vertex dots.
- A clean parameter object: `{seed, cells, triangleCount, gridStrokeAlpha, fillAlphaRange,
  hatchAlpha, palette, dotSize}`.
