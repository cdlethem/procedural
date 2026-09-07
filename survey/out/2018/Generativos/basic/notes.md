---
sketch: 2018/Generativos/basic
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1503
animated: false
techniques: [grid, polar]
primitives: [rect, shape, ellipse]
palette:
  colors: ["#CD0181", "#F56E99", "#F4AFB2", "#85D4D1", "#0055BF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "5..50", tried: ["15..25"], change: subtle, effect: "finer ~16x16 grid; shapes shrink and land in different cells"}
  - {name: gridStrokeAlpha, default: 12, tried: [90], change: none, effect: "no visible change per score; grid lines only fractionally darker"}
  - {name: ccc, default: "2..cc^1.4", tried: ["2..6*cc^1.4"], change: subtle, effect: "still two visible sectors, with different orientations/gradients"}
  - {name: sweepQuanta, default: "0..3 quarter turns", tried: ["0..7 quarter turns"], change: subtle, effect: "sectors take different sweeps; one near-invisible, one a half-disc"}
  - {name: colors, default: "pink/teal/blue 5-colour list", tried: ["grey/blue/orange 5-colour list"], change: moderate, effect: "light-grey background; sectors become navy/grey-blue and orange/blue-grey"}
reusable_candidates:
  - {name: gridLines, signature: "gridLines(cells, strokeAlpha) -> void", note: "faint full-bleed cell grid"}
  - {name: rectSha, signature: "rectSha(x, y, w, h, offset, color, alphaNear, alphaFar) -> void", note: "four trapezoids faking an extruded drop shadow"}
  - {name: arcc, signature: "arcc(x, y, size, band, a1, a2, c1, c2) -> void", note: "annular sector, per-segment lerpColor gradient between two colours"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alphaNear, alphaFar) -> void", note: "low-alpha shadow ring under a shape"}
---

## What it draws
A flat mint/teal field (one of the five palette colours) with a faint 6x6 grid of thin dark lines. Two
grid-aligned shapes float on it: a quarter-disc at the top centre whose fill blends smoothly from pale
pink to blue, and a larger 270-degree disc in the lower right whose fill blends from light pink to deep
magenta. Each shape carries a very soft dark shadow. The rest of the grid is empty.

## How the code works
`setup()` (basic.pde:3-8) sets 960x960 P2D, then calls `generate()` once; `draw()` is empty and the
regenerate line is commented out (line 11), so the image is static. All randomness comes from the global
`random()` stream, which the harness seeds via the `seed` field (line 1).

`generate()` (lines 22-89):
- Background: one colour drawn at random from the 5-entry `colors[]` list via `rcol()` (lines 177-180).
- Grid: `cc = int(random(5, random(5, 50)))` cells (line 25); `ss = width/cc`; nested loops draw `rect`
  outlines with `stroke(0, 12)` (lines 28-34) — the faint grid.
- Shapes: `ccc = int(random(2, pow(cc, 1.4)*random(1)))` pieces (line 36). Each gets a random size
  `w`,`h` in cells (lines 39-40, 2..cc/2), a grid-aligned origin `x`,`y` (lines 41-42), and two random
  colours `c1`,`c2` (lines 43-44). Then `rnd = int(random(3))` picks a style:
  - `rnd==0` (lines 48-74): a four-vertex `beginShape` quad whose two fills `c1`/`c2` interpolate
    across the quad, plus two `rectSha` shadow passes (offsets `ss*2` alpha 15 and `ss*0.5` alpha 20).
  - `rnd==1` (lines 75-81): `arcc(...)` — an annular sector centred in the cell block; the sweep is
    `a2 = a1 + int(random(4))*HALF_PI`, i.e. 0 to 270 degrees in quarter-turn steps; each of `res`
    segments is filled with `lerpColor(c1, c2, t)` (lines 91-110), which is what produces the smooth
    colour sweep inside the sector.
  - `rnd==2` (lines 82-87): `arc2` low-alpha black shadow ring, then a solid single-colour `ellipse`.
- `rectSha` (lines 112-149) builds a fake 3-D drop shadow from four trapezoids with two alphas;
  `arc2` (lines 152-170) is the same idea as a ring.

With seed 42 the draw produced `cc=6`, `ccc=2`, and both pieces landed on `rnd==1`, so the baseline
shows exactly two gradient sectors and no quads or solid ellipses.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_15_25 | `int cc = int(random(5, random(5, 50)));` -> `int cc = int(random(15, random(15, 25)));` | subtle | much finer (~16x16) faint grid; a pale near-background circle with soft shadow top right and a small pink half-disc bottom left | variants/cc_15_25/frame_00001.png |
| stroke_alpha_90 | `  stroke(0, 12);` -> `  stroke(0, 90);` | none | no visible change; grid lines only fractionally darker, shapes identical to baseline | variants/stroke_alpha_90/frame_00001.png |
| ccc_6 | `int ccc = int(random(2, pow(cc, 1.4)*random(1)));` -> `int ccc = int(random(2, pow(cc, 1.4)*random(6)));` | subtle | still only two visible sectors on the 6x6 grid; top sector and bottom-right sector have different orientations/gradient directions than baseline | variants/ccc_6/frame_00001.png |
| sweep_8 | `    float a2 = a1+int(random(4))*HALF_PI;` -> `    float a2 = a1+int(random(8))*HALF_PI;` | subtle | different sweeps: near-invisible pale circle (with shadow) top right, pink half-disc bottom left | variants/sweep_8/frame_00001.png |
| palette_alt | `int colors[] = {#CD0181, #F56E99, #F4AFB2, #85D4D1, #0055BF};` -> `int colors[] = {#1B263B, #415A77, #778DA9, #E0E1DD, #F4845F};` | moderate | light-grey background; top quarter-disc blends orange to blue-grey, bottom-right 270-degree disc blends dark navy to grey-blue | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: `gridLines` (cell count + stroke alpha), `arcc` (gradient annular sector: centre, radius,
  band, angle range, two colours), `rectSha` (extruded shadow), `arc2` (shadow ring). All are pure
  drawing helpers with no state — good library candidates as-is.
- One-off art decisions: the 5-colour list, the `pow(cc, 1.4)` density formula, the quarter-turn
  angle quantisation in `rnd==1`, and the per-vertex two-fill quad style.
- A clean parameter object would be: `{cells, pieces, maxPieceCells, strokeAlpha, palette[],
  angleQuantisation, shadowOffset, shadowAlpha}`.
