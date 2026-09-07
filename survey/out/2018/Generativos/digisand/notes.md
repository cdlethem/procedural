---
sketch: 2018/Generativos/digisand
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1666
animated: false
techniques: [noise-field, grid, particles, polar]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#FFFCF7", "#FDDA02", "#EE78AC", "#3155A3", "#028B88"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: det, default: 0.0018, tried: [0.006], change: subtle, effect: "slightly finer variation in the two-tone yellow mosaic; overall look unchanged (0.0 fraction of pixels)"}
  - {name: sep, default: 10, tried: [20], change: subtle, effect: "mosaic cells double in size (coarser dither); ant step size doubles too; small pixel diff because the two tones are close"}
  - {name: speckleCount, default: 10990, tried: [3000], change: moderate, effect: "faint white dust much sparser; background reads cleaner and ant traces stand out more"}
  - {name: antCount, default: 20, tried: [60], change: moderate, effect: "meandering traces about 3x denser, covering much more of the canvas"}
  - {name: dashH, default: 30, tried: [80], change: subtle, effect: "dashes clearly taller (10x80 bars instead of 10x30); thin and sparse so overall diff small"}
  - {name: circleCount, default: 30, tried: [80], change: moderate, effect: "about 3x more circles; composition busier with heavy overlap"}
reusable_candidates:
  - {name: noiseMosaic, signature: "noiseMosaic(cell, det, threshold) -> void", note: "grid of cells filled with one of two colors where 2-D noise crosses a threshold (lines 35-41)"}
  - {name: randomWalkAnts, signature: "randomWalks(count, stepSize, len) -> void", note: "random-walk polylines snapped to a grid with a dot at the head (lines 54-73)"}
  - {name: annulus, signature: "annulus(x, y, r, band) -> void", note: "two-pass circular shape, outer then inner radius wound back (lines 132-146)"}
---

## What it draws
A full-bleed yellow pixel-mosaic background: a 10 px grid of squares in two yellow tones forming soft noise-defined patches. Over it sit scattered flat geometric shapes — solid circles in teal, pink, blue and off-white, several with a contrasting ring/annulus around them or a squarish rounded body, small colored dashes (vertical and horizontal bars), a few faint white speckles, and thin dark "ant" traces: short random-walk polylines with a dot at the end. The overall feel is a collage of Bauhaus-style marks on a sandy dithered field.

## How the code works
Static sketch: `setup()` calls `generate()` once, `draw()` is empty (lines 3-11). `generate()` (lines 21-130) seeds random and noise from a single `seed` (lines 23-25) and draws in five layers, back to front:
1. **Background mosaic** (lines 27-41): background and foreground colors come from `getColor(random(200))` (lines 180-185), a lerp between adjacent palette entries; a double loop over 10 px cells (`sep = 10`, line 34) fills each cell with one of the two colors where `noise(des + i*det, des + j*det) < 0.5` (line 37), with `det = 0.0018` (line 32) controlling the patch scale. This produces the two-tone yellow dithered field.
2. **White speckles** (lines 44-51): 10990 tiny 8x8 rects at random positions snapped to a 10 px grid, filled `fill(255, 40)` — a sparse dust of faint white squares.
3. **Ant random walks** (lines 54-73): 20 walkers, each taking 600 steps of `int(random(-2,2))*sep` in x and y (grid-snapped), drawing a `stroke(col, 80)` segment and a 2x2 dot at each step. Colors from `rcol()` (random palette pick, lines 174-176). These are the thin meandering traces.
4. **Dashes** (lines 76-85): 100 rects of fixed size `w=10, h=30` snapped to a 10x30 grid, random palette colors — the small bars.
5. **Big circles** (lines 87-129): 30 circles, each up to `0.2*width` in size, snapped to its own size grid. Most get a body in a color lerped toward white (lines 97-99) plus an occasional squarish `beginShape` outline (lines 101-110); all get an `aro()` annulus (lines 132-146: outer circle path then inner radius wound back), a small center dot (line 118), an `arc2()` ring of black quads at alpha 12 (lines 148-166, lines 119) and, 10% of the time, a ring of small dots at radius `0.6*s` (lines 123-128).

Randomness enters through the seeded `random`/`noise` (seed 42 in the baseline). P2D renderer, 960x960.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.006 | `float det = 0.0018;` -> `float det = 0.006;` | subtle (mean 0.0148, 0.0 fraction) | the yellow mosaic is slightly finer/more varied; overall look unchanged | variants/det_0.006/frame_00001.png |
| sep_20 | `int sep = 10;` -> `int sep = 20;` | subtle (mean 0.0133, 0.038 fraction) | background cells visibly double in size (coarser dither); shapes unchanged | variants/sep_20/frame_00001.png |
| speckle_3000 | `for (int i = 0; i < 10990; i++)` -> `... i < 3000 ...` | moderate (mean 0.1433, 0.449 fraction) | white speckles much sparser; background cleaner, ant traces more visible | variants/speckle_3000/frame_00001.png |
| ants_60 | `for(int i = 0; i < 20; i++){` -> `for(int i = 0; i < 60; i++){` | moderate (mean 0.1289, 0.428 fraction) | meandering traces ~3x denser, covering more of the canvas | variants/ants_60/frame_00001.png |
| dashH_80 | `float h = 30;` -> `float h = 80;` | subtle (mean 0.0143, 0.037 fraction) | dashes clearly taller (10x80 instead of 10x30); sparse so overall diff small | variants/dashH_80/frame_00001.png |
| circles_80 | `for (int i = 0; i < 30; i++)` -> `... i < 80 ...` | moderate (mean 0.1002, 0.3 fraction) | ~3x more circles; busier, heavy overlap | variants/circles_80/frame_00001.png |

## Modularisation notes
- **Generic / library-ready**: the noise mosaic (threshold of 2-D noise over a cell grid), the grid-snapped random-walk tracer, the annulus/arc-ring circle builder, and the "random palette lerp color" (`getColor`) are all self-contained and parameterized.
- **One-off art decisions**: the fixed 5-color palette and its two commented alternates (line 172-173), the specific layer order and counts (10990 speckles, 20 ants x 600 steps, 100 dashes, 30 circles), the 0.5 noise threshold, and the 10%/20% probability gates in the circle layer.
- A clean parameter object: `{seed, palette[], cell, noiseDetail, threshold, speckleCount, antCount, antSteps, antStep, dashW, dashH, dashCount, circleCount, circleMaxSize}`.
