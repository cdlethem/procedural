---
sketch: 2018/Generativos/design
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2115
animated: false
techniques: [grid, dots-stippling, curves]
primitives: [ellipse, line, shape]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD", "#000000"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(12,100)", tried: ["random(12,28)"], change: subtle, effect: "lower max = coarser, visibly larger dot grid; shapes unchanged"}
  - {name: sss, default: "ddd*random(0.1,0.8)", tried: ["ddd*random(0.1,1.6)"], change: none, effect: "no visible change; dots at most 2x larger, negligible pixel fraction"}
  - {name: shapeCount, default: 200, tried: [600], change: large, effect: "3x count = much busier scatter, heavy overlap, dot grid nearly hidden"}
  - {name: shapeSize, default: "width*random(0.02,random(0.2))", tried: "width*random(0.02,random(0.5))", change: large, effect: "higher nested top end = a few huge shapes covering most of the canvas"}
  - {name: colors, default: "6 vivid hues", tried: ["6 muted hues"], change: large, effect: "full recolour: background and all shapes take the new palette, geometry identical"}
  - {name: shadowOffset, default: "s*0.2 (circle branch only)", tried: ["s*0.6"], change: subtle, effect: "only circles' black shadows detach further down-right; other types unaffected"}
reusable_candidates:
  - {name: dotGrid, signature: "dotGrid(cellCount, dotScale, shadowOffset) -> void", note: "regular grid of two-tone dots (black shadow dot offset by cell*0.1) as background texture"}
  - {name: scatterShapes, signature: "scatterShapes(count, sizeRange, types, shadow) -> void", note: "N random flat shapes of 4 types (circle, straight line, 3-6-gon, sine squiggle), each with an offset black shadow copy"}
  - {name: lineSine, signature: "lineSine(x1,y1,a1,x2,y2,a2,amp) -> void", note: "open polyline whose vertices oscillate sinusoidally around the chord"}
  - {name: shadowCopy, signature: "shadowCopy(draw, dx, dy) -> void", note: "the recurring idiom: draw shape at (x+off,y+off) in black, then at (x,y) in palette colour"}
---

## What it draws
A flat, Memphis-style scatter on a teal-green (#00B187) background. The background carries a fine
even grid of tiny dots. Over it, ~200 flat geometric shapes are scattered edge to edge: circles
(some with a ring stroke), straight line segments, 3-to-6-sided polygons, and wavy sine lines in
yellow, orange, pink, purple, green and cyan. Almost every shape carries a solid black drop shadow
offset down-right, giving a cut-paper look. Density is higher in the lower-left half but coverage
is full-bleed; the image is static (frames 10/60 identical to frame 1).

## How the code works
`setup()` (design.pde:3-9) creates a 960x960 P2D window and calls `generate()` once; `draw()` is
empty, so the piece is static. Any key press regenerates with a new random seed (14-20).

`generate()` (22-118):
1. **Colours** (23-25): background and a second colour are each picked randomly from the 6-hue
   palette at line 227 via `rcol()` (228-230); a retry loop guarantees they differ. With seed 42
   the background lands on green #00B187.
2. **Dot grid** (30-42): `cc = random(12,100)` cells, cell size `ddd = width/cc`, dot size
   `sss = ddd*random(0.1,0.8)`. A double loop draws, per cell, a black dot at
   `(i+0.1, j+0.1)*ddd` then the palette-colour dot at `(i,j)*ddd` — the shadow-dot dot grid that
   reads as a subtle textured background.
3. **Scattered shapes** (45-117): 200 iterations, each with random `x,y` and size
   `s = width*random(0.02, random(0.2))` (nested random biases sizes small). `rnd = int(random(4))`
   picks one of four types, each drawn as black shadow copy then coloured copy:
   - **rnd 0, circles** (51-61): shadow ellipse at `(x+s*0.2, y+s*0.2)`, then filled ellipse; with
     20% probability it also gets a ring stroke of weight `random(s*0.1)`.
   - **rnd 1, straight lines** (62-78): chord length `ss = width*random(0.02,0.1)` at random angle
     `a`; shadow line offset by `dd = ss*0.04`, then coloured line with `strokeWeight(s)`.
   - **rnd 2, polygons** (79-100): `c = random(3,6)` vertices via `poly()` (120-129), shadow then
     fill (or, 20% of the time, stroke-only outline).
   - **rnd 3, sine squiggles** (101-116): `lineSine()` (205-219) draws a polyline whose vertices
     oscillate by `cos(t)*amp` around the chord, with `amp = ss*random(0.05,0.3)` — the wavy
     ribbon lines.
   The offset black copy in every branch is what creates the uniform hard drop shadow.

No blend modes, no noise field; all structure is grid + pure random placement. Unused helpers
`baston()`, `arc2()`, `lineRulo()` and the `getColor()` lerp ramp are dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_28 | `int cc = int(random(12, 100));` -> `int cc = int(random(12, 28));` | subtle | dot grid visibly coarser: larger, more spaced shadow-dot pairs; scattered shapes identical | variants/cc_28/frame_00001.png |
| sss_1.6 | `float sss = ddd*random(0.1, 0.8);` -> `float sss = ddd*random(0.1, 1.6);` | none | no visible change; grid dots at most double in size but occupy a tiny pixel fraction | variants/sss_1.6/frame_00001.png |
| shapeCount_600 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 600; i++) {` | large | 3x shape density: much busier, lots of overlap, dot grid mostly obscured | variants/shapeCount_600/frame_00001.png |
| shapeSize_0.5 | `float s = width*random(0.02, random(0.2));` -> `float s = width*random(0.02, random(0.5));` | large | shapes much larger, several huge; background and dot grid almost fully covered | variants/shapeSize_0.5/frame_00001.png |
| colors_muted | `int colors[] = {#FACD00, #FB4F00, #F277C5, #7D57C6, #00B187, #3DC1CD};` -> `{#1D3557, #E63946, #F4A261, #2A9D8F, #E9C46A, #264653};` | large | whole scheme swapped: warm mustard background (also a palette pick), shapes in navy/teal/red/sand/mustard; geometry unchanged | variants/colors_muted/frame_00001.png |
| shadowOffset_0.6 | `ellipse(x+s*0.2, y+s*0.2, s, s);` -> `ellipse(x+s*0.6, y+s*0.6, s, s);` | subtle | only circles' black shadows shift, now clearly detached down-right; line/poly/squiggle shadows unchanged | variants/shadowOffset_0.6/frame_00001.png |

## Modularisation notes
- **Generic (library candidates):** the shadow-copy idiom (draw black at offset, colour at origin)
  is the sketch's core visual and is trivially a helper; `dotGrid` (cellCount, dotScale) is a
  self-contained background texture; `lineSine` is a standalone stroke primitive; `scatterShapes`
  with a pluggable set of 4 shape generators (circle / line / ngon / sine) would cover the whole
  foreground.
- **One-off art decisions:** the exact 6-hue palette (line 227), the fixed black shadow colour,
  the 0.2 shadow offset, the 20% ring-stroke probability, the nested `random(0.2)` size bias, and
  the 4-type / 200-count balance are taste choices, not mechanics.
- **Clean parameter object:** `{palette: int[], bg: int, dotCells: 12..100, dotScale: 0.1..0.8,
  count: int, sizeMin: 0.02, sizeMax: 0.02..0.2 (nested), shadowOffset: float, ringProb: 0.2,
  typeWeights: [0.25,0.25,0.25,0.25], seed: int}`. A `typeWeights` array would let the scatter
  emphasis (circles vs squiggles) be tuned without touching the loop.
