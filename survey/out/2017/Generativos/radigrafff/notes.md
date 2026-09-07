---
sketch: 2017/Generativos/radigrafff
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 615
animated: false
techniques: [grid, polar, symmetry, lines-hatching]
primitives: [rect, line, ellipse]
palette:
  colors: ["#efcebf", "#e94c20", "#0057BB"]
  selection: lerp-between
composition: tiled
parameters:
  - {name: sub, default: 4, tried: [8], change: large, effect: "denser 8x8 mosaic with mixed tile sizes (2x2, 3x3, 4x4 blocks); packing no longer fills a uniform grid"}
  - {name: background, default: "#efcebf", tried: ["#d8e3dc"], change: moderate, effect: "pale sage background; SUBTRACT makes tile fills lighter and less saturated"}
  - {name: "colors[1]", default: "#0057BB", tried: ["#2f9e44"], change: moderate, effect: "rosette and grid lines go dark brown (green subtracted from warm fills); tile fills shift but stay in muted olive/teal family"}
  - {name: bb, default: 2, tried: [12], change: subtle, effect: "larger rounded-corner radius on tiles; everything else identical"}
  - {name: "arc count", default: 10000, tried: [40000], change: none, effect: "no visible change; 4x more low-alpha speckle arcs is indistinguishable"}
reusable_candidates:
  - {name: rosetteRings, signature: "rosetteRings(x, y, s, seg, oscRange) -> void", note: "two wavy concentric rings drawn as seg line segments, modulated by cos oscillators and small drift offsets"}
  - {name: randomSquarePack, signature: "randomSquarePack(grid) -> Quad[]", note: "greedy packing of random squares into an occupancy grid until full"}
---

## What it draws
A full-bleed 4×4 grid of rounded-square tiles on a pale peach background. Each tile has a flat
muted fill (orange, olive-tan, dusty teal, pale pink) and a single centred radial rosette of
fine dark-red/orange lines: two wavy concentric rings crossed by radial spokes, giving a
sunburst or flower look. A faint fine grid of thin lines crosses the whole canvas and 10000
tiny random arcs add a soft speckled texture.

## How the code works
`generate()` (radigrafff.pde:24) redraws everything once; `draw()` is empty (lines 10-12), so the
piece is static. Flow:

1. Background `#efcebf` (line 27), then `blendMode(SUBTRACT)` (line 29) so tile fills subtract
   from the background — the muted teal/olive tones are what remains after subtraction.
2. A `sub`×`sub` occupancy grid (line 44); a while-loop (lines 47-73) greedily packs random
   squares (size 1..`sub*random(0.5,1)`, forced square via `w = h`, line 50) until the grid is
   full (`fress`). With seed 42, `sub` = 4 and the packing fills the 16 cells as single
   unit squares, giving the regular 4×4 tile layout.
3. Each packed quad is drawn as a rounded rect inset by `bb = 2` (line 80), filled with
   `getColor(random(2))` — a lerp between `colors[0] = #e94c20` and `colors[1] = #0057BB`
   (lines 78, 143-153) — plus a call to `form()` at its centre sized `min(w,h)*0.8*ss` (line 85).
4. `form()` (lines 156-193) draws the rosette: `seg = 1200` line segments between two points on
   concentric wavy circles. Each ring's radius is `s*random(0.3,0.5)`/`s*random(0.5)` minus a
   small drift, multiplied by a cosine oscillator `map(cos(osc*i), -1, 1, mr, 1)` with
   `osc = TWO_PI/seg*int(random(1,14))`, producing the petal-like lobes; a second small
   `cos(dd*i)*d` term adds wobble. Stroke is `colors[1]` at alpha `random(30,60)` (line 82).
5. A canvas-wide hairline grid (lines 90-96): vertical/horizontal lines every `sss = ss/div`
   pixels, slightly heavier every `div`-th line, in `colors[1]` alpha 40-50.
6. 10000 random speckle arcs (lines 127-136): small arcs (diameter up to 12, sweep up to
   0.3·PI) at random positions, grey strokes at near-random low alpha — the soft grainy
   texture over everything.

The second `for` block (lines 101-109) is fully commented out inside; the `cross()` helper and
the cross block (lines 111-124) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_8 | `  int sub = int(random(4, 14));` -> `  int sub = 8;` | large | 8x8 mosaic of mixed-size tiles (2x2 olive, 3x3 teal, 4x4 blue blocks among 1x1 tiles), each with its own rosette; rosette shapes vary more | variants/sub_8/frame_00001.png |
| bg_slate | `  background(#efcebf);` -> `  background(#d8e3dc);` | moderate | same 4x4 layout on a pale sage background; tile fills lighter and desaturated (pale green, off-white, teal, tan), rosettes still dark red | variants/bg_slate/frame_00001.png |
| colors_green | `int colors[] = {#e94c20, #0057BB};` -> `int colors[] = {#e94c20, #2f9e44};` | moderate | rosette strokes and grid lines darken to brown (green subtracted via SUBTRACT); tile fills shift toward tan/olive but stay in the same muted family | variants/colors_green/frame_00001.png |
| bb_12 | `  float bb = 2;` -> `  float bb = 12;` | subtle | tile corners noticeably more rounded; fills, rosettes, grid unchanged | variants/bb_12/frame_00001.png |
| arcs_40000 | `  for (int i = 0; i < 10000; i++) {` -> `  for (int i = 0; i < 40000; i++) {` | none | no visible change | variants/arcs_40000/frame_00001.png |

## Modularisation notes
Generic, library-ready:
- `rosetteRings` (the `form()` function): pure parametric line art, no globals besides stroke.
  Signature: `form(x, y, s, seg, oscMin, oscMax, alpha)`. Good candidate as a "wavy ring pair"
  primitive.
- `randomSquarePack`: greedy square packing into an occupancy grid; generic algorithm, returns
  a list of quads. Note `w = h` (line 50) forces squares; without it the same loop packs
  rectangles.
- `getColor` (lines 143-153): lerp between adjacent palette colours; trivially reusable.
- The SUBTRACT-blend tile-fill step is an art decision tied to the palette; the hairline grid
  (step 5) is a generic overlay (spacing + emphasis every N lines).
- One-off art decisions: the 10000-arc grain (step 6), the specific palette {#e94c20, #0057BB}
  on #efcebf, `bb = 2` corner radius, rosette size factor 0.8.
A clean parameter object: `{ grid: sub, palette, bg, rosetteScale, bb, gridLineDiv, grainCount }`.
