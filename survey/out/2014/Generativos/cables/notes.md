---
sketch: 2014/Generativos/cables
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 214
animated: false
techniques: [particles, noise-field, grid]
primitives: [arc, line, rect]
palette:
  colors: ["#FF4646", "#512C81", "#474848", "#DEE3E2", "#2C2E2E", "#F6FF0A"]
  selection: random-from-list
composition: centered
parameters:
  - {name: amount, default: "int(random(2,8))", tried: [1], change: subtle, effect: "1 cable instead of 3-4: single thin multicolour strand from left edge to mid-canvas, rest of canvas empty"}
  - {name: angleDrift, default: "random(-0.2,0.2)", tried: [0.6], change: subtle, effect: "higher drift makes cables loop and tangle into a dense spiky mass around the centre instead of smooth long tendrils"}
  - {name: arcSize, default: 60, tried: [120], change: subtle, effect: "doubles the strand width: noticeably thicker ribbon with longer, more prominent barbs along the curves"}
  - {name: steps, default: 500, tried: [1000], change: subtle, effect: "cables run twice as long: meander further from the centre, reach the canvas edges and loop back on themselves"}
  - {name: gridSpacing, default: 14, tried: [7], change: none, effect: "no visible change: cross-hatch is too faint (grey 40-50 on grey 30, 1.75px) for halving the spacing to show"}
reusable_candidates:
  - {name: cruceGrid, signature: "cruceGrid(spacing, phase, alphaRange) -> void", note: "offset cross-hatch grid, two sizes on a checkerboard of cells"}
  - {name: arcWalk, signature: "arcWalk(x, y, startAngle, steps, drift, arcSize, colorFn) -> void", note: "random walk of 1-px steps, drawing a rotated filled half-arc at each step (cable/strand effect)"}
---

## What it draws
On a near-black charcoal background (grey 30) with a very faint, slightly-offset dark cross-hatch grid, 3–4 thin multicoloured "cables" grow out of the exact centre of the canvas and wander in long curved tendrils. Each cable looks like a bundle of fine spiky filaments — vivid red, yellow-green, purple, off-white and grey strands interleaved — fringing out in little barbs as the walk curves. A medium-grey rectangular frame (stroke ~14 px, grey 80) lines all four edges.

## How the code works
`setup()` (cables.pde:3) sets 600×600, builds the 6-colour `paleta` array (cables.pde:5-11: red, purple, mid-grey, off-white, dark-grey, chartreuse) and calls `generar()` once; `draw()` is empty, so the piece is static (frames 10/60 identical to frame 1).

`generar()` (cables.pde:22) fills the background with grey 30, then calls `crucez()` (cables.pde:69-88): a double loop over a 14 px grid draws an X (two diagonal `line`s) at every cell; cells on the even `(i+j)%2` checkerboard get a shorter X (`tt2`), and the whole grid is randomly shifted by up to `des` px in both axes (`desx`, `desy`), which gives the slight offset look. Stroke grey is mapped 40–50 across the height, weight 1.75 — barely visible against the grey-30 background.

Then (cables.pde:26-51) it spawns `amount = int(random(2,8))` cables. Each starts at the exact centre (`width/2, height/2`), with an initial angle drawn from the left half of the circle (`random(PI+PI/2, TWO_PI-PI/2)`), and walks 500 steps. Per step (cables.pde:37-50): the angle is jittered by `random(-0.2, 0.2)`, the position advances 1 px along the angle (`x += cos(ang); y += sin(ang)`), and a filled semicircle `arc(0,0,60,2,0,PI)` is drawn — rotated to the walk direction via `pushMatrix/translate/rotate`. Because each 60 px-wide half-arc overlaps the previous one almost fully, the result reads as a thick spiky strand: the arc's flat chord hides under the body while its rounded tips poke out as barbs, especially around curves. `fill(rcol())` picks a fresh random palette colour for every single arc (cables.pde:60-62), which is what produces the multi-coloured fringing; the `stroke(90)/strokeWeight(0.6)` at cables.pde:33-34 is dead code (overridden by `noStroke()` on the next line).

Randomness enters only through: cable count, starting angle, per-step angle drift, and per-arc colour — all seeded by the harness (`deterministic: true`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| amount_1 | `int amount = int(random(2,8));` -> `int amount = 1;` | subtle | one thin multicolour strand crossing from the left edge toward mid-canvas; rest of the canvas is empty dark background with the faint grid | variants/amount_1/frame_00001.png |
| drift_0.6 | `ang += random(-0.2, 0.2);` -> `ang += random(-0.6, 0.6);` | subtle | cables no longer make smooth long tendrils: they turn sharply, loop and pile into a dense tangle of long spiky barbs around the centre | variants/drift_0.6/frame_00001.png |
| arcsize_120 | `arc(0,0,60,2,0,PI);` -> `arc(0,0,120,2,0,PI);` | subtle | strand is visibly thicker (about double the body width) with longer, spikier fringes along the whole path | variants/arcsize_120/frame_00001.png |
| steps_1000 | `for (int j = 0; j < 500; ++j) {` -> `for (int j = 0; j < 1000; ++j) {` | subtle | cables are twice as long: they meander much further, cross the left edge, and loop back over themselves in the lower half | variants/steps_1000/frame_00001.png |
| grid_7 | `float des = 14;` -> `float des = 7;` | none | no visible change; the cross-hatch stays at the threshold of visibility either way (grey 40-50 lines on a grey-30 background) | variants/grid_7/frame_00001.png |

## Modularisation notes
- `crucez()` is a clean, self-contained reusable "offset cross-hatch" background: parameterise spacing (`des`), the two X sizes (`tt`, `tt2` factors), the random phase offsets, and the stroke range.
- The cable walk (cables.pde:27-51) is a generic "strand walker": given a start point, angle, step count, angle drift, and arc size, it emits a spiky filled-arc ribbon. The per-step random fill is the art-specific choice; a `colorFn(step) -> color` hook (or a single fixed colour) would make it reusable for hatching, hair, or thread effects.
- The border frame is a one-off compositional decision, trivial to parameterise (colour, weight).
- A clean parameter object: `{cables: int, steps: int, drift: float, arcSize: float, startAngleRange: [min,max], palette: color[], gridSpacing: float, gridAlpha: [min,max], frameWeight: float}`.
