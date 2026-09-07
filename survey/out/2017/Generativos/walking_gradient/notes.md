---
sketch: 2017/Generativos/walking_gradient
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 203
animated: true
techniques: [dots-stippling, grid]
primitives: [ellipse]
palette:
  colors: ["#DB7654", "#893D60", "#D6241E", "#F2AC2A", "#3D71B7", "#FFEEED", "#85749D", "#21232E", "#5FA25A", "#5D8EB4"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cc, default: "int(random(1200))", tried: ["int(random(400))"], change: none, effect: "no visible change at frame 1; dot count is itself a per-run random, so density varies between renders anyway"}
  - {name: div, default: "int(random(4, 80))", tried: ["int(random(4, 20))"], change: subtle, effect: "coarser lattice (fewer, larger cells); subtle at frame 1, dominated by per-run random seed"}
  - {name: sizeScale, default: 1, tried: [3], change: none, effect: "no visible change at frame 1 (dots are still tiny at t~0.2 s)"}
  - {name: alpha, default: "random(20, 90)", tried: ["random(80, 255)"], change: none, effect: "no visible change at frame 1; opacity only matters once dots grow in later frames"}
  - {name: background, default: "getColor(random(colors.length))", tried: ["colors[7]"], change: large, effect: "background becomes near-black (#21232E); every pixel changes, dots look muted on the dark ground"}
reusable_candidates:
  - {name: paletteLerp, signature: "paletteLerp(colors[][], index) -> color", note: "wrap-around lerp between adjacent palette entries, index may drift non-integer"}
  - {name: gridScatter, signature: "gridScatter(div, n) -> (x,y)[]", note: "snap n random points to a div×div grid of cell size width/div"}
---

## What it draws
Frame 1 (t≈0.2 s): a flat muted red background (one of the palette's reds/oranges, desaturated by overlap) sprinkled with a sparse, even dust of small semi-transparent dots in many hues — orange, blue, green, pink, cream — like confetti. By frame 60 the same dots have grown and overlapped until the canvas is a dense, busy field of multicoloured dots and short horizontal/vertical streaks; the red ground is only partly visible. Because `deterministic` is false, the background hue (and the inner seed) differ between runs; only large structural changes are comparable.

## How the code works
- `setup()` (lines 3–8): 960×960, `smooth(8)`, then `generate()` (lines 50–53) sets the background to a random palette colour.
- `draw()` (lines 10–38) runs every frame:
  - `time = millis()/1000.` (line 11) drives all motion; `randomSeed(seed)` (line 12) makes per-dot choices reproducible within a run.
  - `cc = int(random(1200))` (line 13): up to ~1200 dots per frame; `div = int(random(4,80))` (line 14) sets a grid, cell `ss = width/div` (line 15).
  - Each dot snaps to a grid intersection (lines 19–20). With 50% probability it moves along x, else y, by `dd = time*random(0.1,1)*60*(±1)` (line 21) — a constant per-dot speed that grows with `time`, i.e. every dot walks across the canvas; modulo wrap-around (lines 25–26, 29–30) makes the motion toroidal, so the field never empties.
  - Size `s = ss*random(1)*(1-cos(time*random(1))*random(1))` (line 32) pulses 0…2× the cell size, which is why dots are tiny early and large/overlapping later.
  - Colour: index `c = random(colors.length)+time*random(-1,1)` (line 33) drifts over time; `getColor` (lines 59–65) lerps between adjacent palette entries with wrap-around, so hue slowly walks around the 10-colour palette. Alpha `random(20,90)` (line 35) keeps everything semi-transparent; the red background shows through the overlaps.
  - Drawn as `ellipse` (line 36).
- Randomness: the field initializer `int seed = int(random(999999))` (line 1) and the background pick (line 52) use the *unseeded* RNG, so each run gets a different base seed and background — this is why `deterministic` is false.
- `keyPressed` (lines 40–43): `s` saves a frame, any other key regenerates the background.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_400 | `int cc = int(random(1200));` -> `int cc = int(random(400));` | none | no visible change | variants/cc_400/frame_00001.png |
| div_4_20 | `int div = int(random(4, 80));` -> `int div = int(random(4, 20));` | subtle | subtle: dots land on a coarser lattice; per-run random seed dominates | variants/div_4_20/frame_00001.png |
| size_3x | `float s = ss*random(1)*(1-cos(time*random(1))*random(1));` -> `ss*random(1)*3*(...)` | none | no visible change at frame 1 | variants/size_3x/frame_00001.png |
| alpha_80_255 | `fill(getColor(c), random(20, 90));` -> `fill(getColor(c), random(80, 255));` | none | no visible change at frame 1 | variants/alpha_80_255/frame_00001.png |
| bg_dark | `background(getColor(random(colors.length)));` -> `background(colors[7]);` | large | near-black background, all pixels change; dots muted on dark ground | variants/bg_dark/frame_00001.png |

Note: because `deterministic` is false, the inner seed (`int seed = int(random(999999))`, line 1) and the background are re-rolled on every run, so dot positions and density differ between renders even with no substitution. Only the large bg_dark change is unambiguous.

## Modularisation notes
Generic, library-ready:
- `getColor`/palette wrap-around lerp (lines 59–65) — a pure function of a colour array and a floating index; reusable as `paletteLerp`.
- Grid-snapped scatter (lines 14–15, 19–20) — `gridScatter(div, n)` returning snapped positions.
- Toroidal wrap of a position with a margin (lines 25–26, 29–30) — small `wrapAxis(pos, span, margin)` helper.

One-off art decisions: the specific 10-colour palette; the `1-cos(time*r)*r` size-pulsing formula; the per-run unseeded base seed (an accidental property, not a feature); the alpha range 20–90; the 50/50 axis split.

A clean parameter object would contain: `nDots` (cc), `gridDiv` (div), `speedScale` (the 60 in `dd`), `sizeScale` (multiplier on `ss`), `alphaMin/alphaMax`, `palette`, `backgroundIndex`, `seed`, `timeOffset`.
