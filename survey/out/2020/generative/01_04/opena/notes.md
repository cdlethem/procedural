---
sketch: 2020/generative/01_04/opena
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1608
animated: false
techniques: [noise-field, grid, distortion]
primitives: [shape]
palette:
  colors: ["#F4EFA1", "#E8E165", "#DC4827", "#5779A2", "#031A01"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: pushFactor, default: 220.0, tried: [550.0], change: large, effect: "stronger center push blows stripes off the edges, leaving a dark central mass with wide white margins"}
  - {name: des2, default: 160.0, tried: [320.0], change: large, effect: "bigger folds: more white gaps torn open and more violent ribbon sweeps"}
  - {name: sub, default: "random(60,90)*2", tried: ["random(120,150)*2"], change: large, effect: "twice as many, thinner stripes; denser moire"}
  - {name: angMult, default: 3.0, tried: [6.0], change: subtle, effect: "no visible change: fine jitter angle doubled, barely noticeable"}
  - {name: des, default: 40.0, tried: [80.0], change: subtle, effect: "no visible change: fine jitter doubled, lost in the coarse fold"}
reusable_candidates:
  - {name: warpPoint, signature: "warpPoint(x, y, angScale, desScale, maxDes, push) -> PVector", note: "per-vertex displacement: two noise-driven polar perturbations + radial push away from centre"}
  - {name: warpStrip, signature: "warpStrip(col, colWidth, rows, warpFn) -> void", note: "one QUAD_STRIP of per-row warped vertices, alternating fill per column"}
  - {name: radialPush, signature: "radialPush(x, y, cx, cy, factor, w) -> PVector", note: "push a point away from (cx,cy) proportional to its distance"}
---

## What it draws
A full-bleed black-and-white image of fine vertical stripes that bend, fold and sweep into
thick ribbon-like flows, as if a sheet of hatching were warped over a 3D surface. Where the
distortion is strong (a diagonal S-shaped valley through the middle, plus the upper-left and
lower-right corners) the stripes are pulled apart and white background shows through, so the
dark bands look like moiré ribbons with white gaps. The whole field reads as a single
continuous warped grid rather than separate objects.

## How the code works
- `generate()` (opena.pde:44) seeds `randomSeed`/`noiseSeed` from `seed`, sets
  `noiseDetail(4)`, paints `background(255)`, and draws the whole image once; `draw()` is
  empty, so the piece is static (frames 10/60 dropped as identical).
- Stripe count: `int sub = int(random(60, 90))*2` (line 59) gives an even number of columns
  between 120 and 180; each column is `ss = width/sub` pixels wide (line 60).
- The loop `for (int i = -20; i < sub+20; i++)` (line 63) draws one vertical strip per column
  as a `QUAD_STRIP` (lines 66-75): rows sampled every 2 px from `y=-100` to `height+100`,
  with both the left (`x1=i*ss`) and right (`x1+ss`) edges warped through `def()` before
  becoming vertices.
- Colour: `fill(((i+200)%2)*255)` (line 64) alternates pure black and pure white per column
  index, producing the stripe pattern. The `colors[]` palette (line 114) and `getColor()`
  are defined but never called by `generate()` — the rendered piece is monochrome.
- `def(x, y)` (lines 85-105) is the displacement function:
  1. First noise pass: angle from `noise(x*detAng, y*detAng)*TAU*3` (detAng ~0.001, line 53)
     and distance `constrain((noise(...detDes...)-0.6)*4, 0, 1)*40` (detDes ~0.02, line 54) —
     a small (<=40 px) high-frequency jitter.
  2. Second noise pass: `detAng2` ~0.001 and `des2 = constrain((noise(...)-0.2)*3, 0, 1)*160`
     (line 92) — a much larger (<=160 px), sparser displacement; this is the dominant
     ribbon/fold effect and also opens the white gaps where a whole band is pushed sideways.
  3. Radial push (lines 96-99): distance to the canvas centre scaled by `220./width`, added
     along the radial angle — pushes everything away from the centre, magnifying the warp
     toward the corners and edges.
- Randomness enters only via `randomSeed(seed)`: the four `det*` constants (lines 53-56) and
  the stripe count (line 59). Same seed -> same image (`deterministic: true`).
- Renderer is P3D (line 16) though only 2D shapes are drawn; `smooth(8)` + `pixelDensity(2)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| push_550 | `float dd = ...*220./width;` -> `...*550./width;` | large | stripes blown hard away from centre: dark bumpy central mass, fine striped fringe, wide white margins around the canvas edges | variants/push_550/frame_00001.png |
| des2_320 | `...)-0.2)*3, 0, 1)*160;` -> `...)*320;` | large | bigger, more violent folds; white gaps torn wider, ribbons sweep more, more dark pooled patches | variants/des2_320/frame_00001.png |
| sub_240 | `int sub = int(random(60, 90))*2;` -> `int(random(120, 150))*2;` | large | roughly twice the columns: visibly thinner, denser stripes, finer moire texture, same overall warp shape | variants/sub_240/frame_00001.png |
| detAng_TAU6 | `noise(x*detAng, y*detAng)*TAU*3;` -> `...*TAU*6;` | subtle | no visible change: overall shape and stripe structure unchanged (mean 0.017) | variants/detAng_TAU6/frame_00001.png |
| des_80 | `...)-0.6)*4, 0, 1)*40;` -> `...)*80;` | subtle | no visible change: fine jitter doubled but dominated by the 160 px coarse fold (mean 0.016) | variants/des_80/frame_00001.png |

## Modularisation notes
- Generic, library-ready: `warpPoint` (two noise-driven polar perturbations + radial push) is
  a reusable per-vertex distortion; `radialPush` is a trivial standalone helper; `warpStrip`
  (alternating-fill QUAD_STRIP with a pluggable warp function) generalises the whole stripe
  field.
- One-off art decisions: the specific two-scale noise structure (fine jitter 40 px + coarse
  fold 160 px), the alternating black/white fill per column, the `random(60,90)*2` column
  count, and the fixed `220./width` push factor.
- A clean parameter object: `{columns, rowStep, jitter: {angScale, desScale, maxDes}, fold:
  {angScale, desScale, maxDes, threshold}, push: {factor, center}}` — the fold stage is what
  makes or breaks the look, the push factor tunes how hard it blows toward the edges.
