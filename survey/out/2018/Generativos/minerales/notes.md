---
sketch: 2018/Generativos/minerales
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3567
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [rect, shape]
palette:
  colors: ["#DDD3C9", "#EE9A02", "#EB526E", "#0169B3", "#024E2C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(2, 17*random(0.2,1))", tried: [17], change: large, effect: "finer 17x17 swatch grid; dense diagonal flow-line streaks now veil most swatches"}
  - {name: c, default: "random(1,13)", tried: [5], change: large, effect: "fixing c=5 shifts the RNG stream; larger 5x5 dots and flow lines reroute into big spirals/vortices"}
  - {name: det, default: "random(0.002)", tried: [0.0005], change: moderate, effect: "lower det = broader, smoother, more coherent diagonal streaks; flat swatch quadrants show"}
  - {name: flowLines, default: 5000, tried: [1500], change: moderate, effect: "sparser overlay; swatches and dots read more clearly through the gaps"}
  - {name: lineAlpha, default: "random(250)", tried: [60], change: moderate, effect: "fainter overlay; underlying dotted swatch grid shows through most of the canvas"}
reusable_candidates:
  - {name: flowLines, signature: "flowLines(n, len, det, alpha) -> void", note: "k noise-driven polylines over a 2-D Perlin angle field"}
  - {name: dotCellGrid, signature: "dotCellGrid(cells, sub, amp, palette) -> void", note: "grid of filled squares each tiled with small arc dots"}
---

## What it draws
A 960x960 canvas filled edge to edge with a coarse square grid; every cell is a solid
swatch pulled at random from a 5-colour mineral palette (cream, amber, pink-red,
blue, deep green). Inside each swatch a smaller square sub-grid of tiny dots is
stamped, and over the whole thing run thousands of thin, semi-transparent lines that
follow a 2-D noise field, sweeping in a broad diagonal direction. The line overlay is
the dominant texture, veiling the underlying swatches into a streaked, marbled surface;
wherever a line is dense the swatch colour shows through as a flat patch between the
streaks.

## How the code works
`setup()` (minerales.pde#3-8) sets a P2D 960x960 buffer and calls `generate()` once;
`draw()` is empty, so the sketch is static. Randomness is seeded from `seed`
(line 25) so the run is deterministic for a given seed.

`generate()` works in two passes:
1. **Swatch grid** (lines 27-101). `cc` (line 27) is the number of cells per side,
   so cell size `ss = width/cc`. For each cell a background `rect` is filled with
   `rcol()` (lines 35-36). Then a sub-count `c` (line 38, 1-12) splits the cell into a
   `c x c` sub-grid; `des` (line 41) picks whether dots are offset to the cell corners
   or centred. For each sub-cell an `arc2()` (lines 45-68) draws a shaded ring (two
   radii, black at low alpha) and a second loop (lines 70-99) stacks a filled `arc`
   in a new random colour `col2` plus a smaller `arc` of yet another colour — the
   tiny dots.
2. **Flow-field line overlay** (lines 104-125). 5000 seeds are scattered over a
   slightly oversized canvas; each seeds a polyline of 20 sub-steps x 200 vertices
   (lines 115-123). At every vertex the heading is the Perlin noise angle
   `noise(des + x*det, des + y*det) * TWO_PI * 2` (line 118) and the point advances by
   one unit along that heading. `det` (line 105, ~0-0.002) sets the spatial scale of
   the field, so the lines curl and stay coherent over long distances, producing the
   diagonal streaks. `noiseDetail(1)` (line 108) keeps it smooth. Line colour is
   `rcol()` at a random alpha up to ~250 (line 114), so the swatches read through.

Palette: 5 fixed hex colours in `colors[]` (line 193); `rcol()` picks one uniformly
(line 195). No blending modes, no image sources.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_17 | `int cc = int(random(2, 17*random(0.2, 1)));` -> `int cc = 17;` | large (0.179, 0.80) | finer 17x17 swatch grid; dense diagonal streaks veil most swatches | variants/cc_17/frame_00001.png |
| c_5 | `int c = int(random(1, 13));` -> `int c = 5;` | large (0.190, 0.81) | big 5x5 dots; flow lines reroute into large spirals/vortices | variants/c_5/frame_00001.png |
| det_0.0005 | `float det = random(0.002);` -> `float det = 0.0005;` | moderate (0.147, 0.70) | broader smoother diagonal streaks; flat swatch quadrants visible | variants/det_0.0005/frame_00001.png |
| flowLines_1500 | `for (int i = 0; i < 5000; i++) {` -> `for (int i = 0; i < 1500; i++) {` | moderate (0.125, 0.57) | sparser lines; swatches/dots read through gaps | variants/flowLines_1500/frame_00001.png |
| lineAlpha_60 | `stroke(rcol(), random(250));` -> `stroke(rcol(), 60);` | moderate (0.117, 0.56) | fainter overlay; dotted swatch grid shows through most of canvas | variants/lineAlpha_60/frame_00001.png |

## Modularisation notes
- **Generic:** the flow-field overlay (lines 104-125) is a self-contained
  `flowLines(n, len, det, alpha, palette)` routine — the noise angle field, the
  1-unit step, and per-line random colour are the only art decisions. `arc2()`
  (line 133) is also a reusable shaded-arc primitive. The swatch+dot grid
  (lines 27-101) could be a `dotCellGrid(cells, sub, amp, palette)` block.
- **One-off art decisions:** the two-pass layering order (swatches under lines),
  the corner-vs-centred `des` dot placement, and the specific 5-colour palette.
- **Clean parameter object:** `{ cells (cc), sub (c), amp, dotPalette, lineCount,
  lineLen, det, lineAlpha }`.
