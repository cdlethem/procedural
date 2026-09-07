---
sketch: 2019/generativos/cece
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1499
animated: false
techniques: [grid]
primitives: [rect, line]
palette:
  colors: ["#4703BC", "#CC8BE0", "#EA1E3D", "#F9CD07", "#E5E5E5"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 100, tried: [200], change: large, effect: "denser skyline: ~2x buildings, more overlap, more windowed facades"}
  - {name: windowProb, default: 0.6, tried: [1.0], change: large, effect: "every building gets a window grid (baseline ~60% do); much more punched-out look"}
  - {name: div, default: "random(20,30)..40", tried: ["random(6,10)..14"], change: moderate, effect: "coarser grid: fewer, larger window glyphs per building"}
  - {name: w, default: "80+random(4)*40", tried: ["80+random(8)*40"], change: moderate, effect: "wider buildings (up to ~360 px), blockier skyline, fewer columns"}
  - {name: colors, default: "#4703BC #CC8BE0 #EA1E3D #F9CD07 #E5E5E5", tried: ["#EF3621 #295166 #C9E81E #0F190C #F5FFFF"], change: large, effect: "fully recoloured: red-orange, dark teal, chartreuse, near-black green, near-white; same composition"}
reusable_candidates:
  - {name: gradientRect, signature: "gradientRect(x, y, w, h, base, top) -> void", note: "solid base fill plus a top-band shape fading from a second colour to alpha 0 (70% of height)"}
  - {name: windowGrid, signature: "windowGrid(x, y, w, h, div, prob, types) -> void", note: "subdivide rect into div x div cells, draw black window glyphs (4 cross-bar variants) at interior intersections"}
---

## What it draws
A flat, toy-like city skyline: many overlapping rectangles on a black background,
each reading as a building. Most buildings show a vertical gradient — a saturated
top (purple, red, yellow, or light purple) fading to a pale grey/white body — and
about half carry a grid of small black windows with white outlines, some of the
windows cross-hatched. Lower buildings are drawn on top of higher ones, giving the
impression of a street-level skyline. Dominant colours: purple, red/crimson,
yellow, pale grey; black background and window fills.

## How the code works
`setup()` calls `generate()` once and `draw()` is empty, so the image is static
(cece.pde#25-38). `generate()` (cece.pde#63):
- Seeds `randomSeed`/`noiseSeed` with `seed`; `background(0)` gives the black
  canvas (line 65-68).
- 100 rectangles: x, y snapped to a 40 px grid (`x -= x%40`, lines 76-77),
  width `80+random(4)*40` (80–200 px), height `80+random(8)*40` (80–400 px)
  (lines 72-82).
- `Collections.sort(rects)` orders by centre-y ascending (cece.pde#58-60), so
  rectangles whose centre is lower on the canvas are drawn last and appear in
  front — that's the depth/layering of the skyline.
- Per rect (lines 86-141): the base body is `fill(rcol())` (a uniform pick from
  the 5-colour palette, line 177). Then a `beginShape` polygon spans the top
  edge to 70% of the height, filled `rcol()` at the top vertex and `rcol(), 0`
  at the bottom (lines 97-104) — that is the vertical fade from one random
  palette colour to the base body colour. (The `stroke`/`noFill` lines 88-92
  are dead: `noStroke()` is called before the rect.)
- With probability 0.6 (line 127) the rect is divided into `div` ≈ 20–40 cells
  (line 106); at every interior grid intersection a `windows()` glyph is drawn
  (line 137): a black rect with a 1.2 px white stroke (lines 145-148) plus white
  cross bars depending on `type` 0–3 (lines 150-163) — the "window" details.
- The toxi/triangulate imports (lines 1-2) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_200 | `for (int i = 0; i < 100; i++)` -> `i < 200` | large | skyline roughly twice as dense: more, more tightly overlapping buildings; more windowed facades visible | variants/count_200/frame_00001.png |
| windowProb_1.0 | `if (random(1) < 0.6)` -> `if (random(1) < 1.0)` | large | every building now carries a window grid (in the baseline ~40% have none); heavily punched-out facades | variants/windowProb_1.0/frame_00001.png |
| div_coarse | `int div = int(random(random(20, 30), 40))` -> `int(random(random(6, 10), 14))` | moderate | same buildings, but window grids are coarser: fewer, larger black window glyphs | variants/div_coarse/frame_00001.png |
| w_wider | `float w = 80+int(random(4)*40)` -> `int(random(8)*40)` | moderate | buildings up to ~360 px wide instead of ~200; blockier skyline with fewer, broader slabs | variants/w_wider/frame_00001.png |
| palette_alt | `int colors[] = {#4703BC, ...}` -> `{#EF3621, #295166, #C9E81E, #0F190C, #F5FFFF}` | large | same layout recoloured: red-orange, dark teal, chartreuse, near-black green, near-white | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic blocks: the depth sort by centre-y (cece.pde#58-60) is a reusable
  "painter's order for skyline" helper; `gradientRect` (base fill + top fade
  band, lines 94-104) is a self-contained primitive; `windows` + the div grid
  loop (lines 127-139, 144-164) form a `windowGrid` primitive; `rcol`
  (line 178-180) is a generic random-palette pick.
- One-off art decisions: the specific 5-colour palette (line 177), the 0.6
  window probability, the div range 20–40, the size ranges, and the 40 px
  snap grid.
- Clean parameter object: `{count, snap, wMin/wStep/wSteps, hMin/hStep/hSteps,
  windowProb, divRange, palette, windowTypes}`; everything else (sort,
  gradient, glyphs) stays fixed.
