---
sketch: 2018/Generativos/zzpptt
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2238
animated: false
techniques: [grid, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#01903B", "#FEE643", "#F3500A", "#0066B8", "#583106", "#F4EEE0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(8, random(20, 120))", tried: [], change: TBD, effect: "TBD"}
  - {name: c (quad count factor), default: "cc*cc*random(0.1, 1)", tried: [], change: TBD, effect: "TBD"}
  - {name: dot diameter, default: "ss*0.5", tried: [], change: TBD, effect: "TBD"}
  - {name: bar length hh, default: "random(2, cc*0.5)*ss", tried: [], change: TBD, effect: "TBD"}
  - {name: palette, default: "6 colors", tried: [], change: TBD, effect: "TBD"}
reusable_candidates:
  - {name: dotGrid, signature: "dotGrid(cellSize, dotDiameter, colorFn) -> void", note: "(cc+1)^2 solid ellipses at every grid point"}
  - {name: gradientQuad, signature: "gradientQuad(gridX, gridY, cardinalDir, lenCells, diagStep, c1, c2) -> void", note: "quad with two per-vertex fills => flat bar with a smooth two-colour gradient"}
---

## What it draws
A dense, busy full-bleed field of straight bars, mostly horizontal or vertical,
interlocked with diagonal trapezoid connectors, in a bold six-colour palette
(green, yellow, orange-red, blue, dark brown, cream). Many bars carry a smooth
two-colour gradient along their length. A lattice of small solid dots of the
same palette shows through at the margins where the bars are sparse (most
visible bottom-left). No strokes, no background colour visible in most areas —
the bars cover nearly everything.

## How the code works
- `setup()` (L3-10): 3250x3250 P2D, calls `generate()` once, saves, exits.
  `draw()` is empty (L12-14) and only `frame_00001.png` exists, so the sketch
  is static; regeneration is keyed on keypress (L16-22).
- `generate()` (L24-60):
  1. Background = `rcol()` (L25), a random pick from the 6-colour array (L88).
  2. `cc` = random grid divisions between 8 and 20-120 (L27); `ss` = width/cc (L28).
  3. Dot layer (L30-41): double loop draws (cc+1)^2 no-stroke ellipses of
     diameter `ss*0.5` at every grid point, each filled with an independent
     `rcol()`. This is the dot lattice, almost fully covered by layer 2.
  4. Bar layer (L43-59): `c = cc*cc*random(0.1, 1)` quads (L44). Each quad
     starts at a random grid point (L46-47), takes one diagonal step of
     `dd = ss*sqrt(2)` at angle `a1 ± 45°` (L49-50, L54), then extends
     `hh = random(2, cc/2)` cells in a cardinal direction `a1 ∈ {0, 90, 180, 270}°`
     (L48, L56-57). Two `fill(rcol())` calls *inside* `beginShape/endShape`
     (L52, L55) give per-vertex colours, so each bar is a smooth gradient
     between two random palette colours. The diagonal step + cardinal run is
     what makes the trapezoid/step connectors.
- Colour choice is always `rcol()`: uniform random from the fixed list (L89-91).
  `getColor`/`getColor(v)` (L92-101) is unused. `arc2` (L63-81) is dead code,
  never called.
- Randomness enters at: cc (L27), every dot fill (L36), quad count (L44), every
  quad origin/angle/length (L46-50) and both per-quad fills (L52, L55). The
  harness seeds via the `seed` field, so seed 42 is reproducible.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic (library-worthy): `dotGrid` (grid of dots with a colour function);
  `gradientQuad` (grid-anchored bar: cardinal run + optional diagonal step,
  two per-vertex fills for the gradient); a `randomPaletteColor` helper.
- One-off art decisions: the specific 6-colour palette; the nested random for
  cc (8..120); the fixed 45° diagonal step; the 0.1-1.0 density factor for bar
  count; the 0.5-cell dot diameter.
- A clean parameter object: `{ cc, barDensity (fraction of cc^2), dotDiameter
  (fraction of cell), barLenMin, barLenMax (cells), palette[] }`.
