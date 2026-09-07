---
sketch: 2018/Generativos/OP/op_011
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1458
animated: false
techniques: [polar, symmetry]
primitives: [shape]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: div, default: "random(2,10) (int 2..9)", tried: [5], change: large, effect: "exactly 5 bold spiral arms; triangles grow large and separated, chevron bands become thick blocks"}
  - {name: twist (da), default: "random(TWO_PI)*random(1)", tried: [0.02], change: large, effect: "little per-ring rotation: few broad blocky spiral arms, coarse checkerboard texture instead of a dense whirlpool"}
  - {name: sizeScale (ss factor), default: 160, tried: [40], change: large, effect: "triangles 1/4 size: sparse small white triangles on black, chevron bands break apart, black background dominates"}
  - {name: aperture, default: "HALF_PI*0.25", tried: ["HALF_PI*0.5"], change: large, effect: "triangle opening doubled: triangles merge into wide continuous zigzag chevron bands, banded rather than spiky"}
  - {name: circleScale, default: "width*1.42", tried: ["width*0.8"], change: large, effect: "field radius shrinks: outer triangles become huge radial bars at the edges, centre becomes a clear multi-armed fine-hatched spiral"}
reusable_candidates:
  - {name: spiralTriangleField, signature: "spiralTriangleField(cx, cy, radius, div, twist, sizeScale, aperture) -> void", note: "rings of triangles on a polar grid with per-ring angular twist and alternating black/white fill"}
---

## What it draws
A full-bleed black-and-white op-art vortex. Hundreds of thin triangles are arranged in concentric
rings around the centre; the rings twist into a spiral that funnels into a tiny dense whirlpool at
the middle. Alternating black and white fills on neighbouring triangles make each ring read as a
zigzag/chevron band, and the whole field has a hypnotic radial symmetry.

## How the code works
`setup()` sizes a 960x960 P2D canvas, calls `smooth(8)`, and runs `generate()` once (line 5);
`draw()` is empty, so the image is static (line 8-10). `generate()` (line 22) clears to black and
draws one giant `circle(width/2, height/2, width*1.42)` (line 28) — radius 0.71x the canvas width,
so it fully covers the frame. `circle()` (line 31) is the core: it draws `cc = s*PI/div`
concentric rings (`div` is a random spoke count in 2..9, line 34; `cc` scales with radius, line
35). Ring `i` sits at distance `dd = map(i,0,cc,0,r)` and each ring has `div` triangles placed at
angle `a = da*i + (TWO_PI/div)*j` (line 42). The `da*i` term is the twist: `da =
random(TWO_PI)*random(1)` (line 33) rotates each successive ring, producing the spiral. Triangle
size grows with radius: `ss = 160*dd/s` (line 39). Each triangle `tri()` (line 52) is a 3-vertex
shape with its tip at the ring point and base corners at `a ± HALF_PI*0.25` (lines 55-56), i.e. a
fixed 90° opening. Fill is strictly two-colour: `((i+j)%2==0) ? 0 : 255` (line 41) — the
alternating parity across rings and spokes creates the chevron zigzag. Randomness enters only
through `da` and `div` (and a commented-out grey fill, line 45). No blend modes; plain opaque
fill.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_5 | `int div = int(random(2, 10));` -> `int div = 5;` | large (0.488, 0.598) | 5 thick spiral arms of big separated triangles; coarse, blocky, reads as a bold pinwheel rather than a dense vortex | variants/div_5/frame_00001.png |
| twist_0.02 | `float da = random(TWO_PI)*random(1);` -> `float da = 0.02;` | large (0.4942, 0.67) | very few broad spiral arms of large blocky triangles; outer field looks like a coarse black/white checkerboard, small tight spiral left at the centre | variants/twist_0.02/frame_00001.png |
| size_40 | `float ss = 160*dd/s;` -> `float ss = 40*dd/s;` | large (0.2999, 0.39) | sparse field of small white triangles on mostly black; chevron bands dissolve into individual triangles, starburst look | variants/size_40/frame_00001.png |
| aperture_0.5 | both `HALF_PI*0.25` lines -> `HALF_PI*0.5` (2 subs) | large (0.2411, 0.358) | triangles merge into wide continuous zigzag chevron bands; dense, banded, less spiky than baseline (first attempt failed: bad_sub, wrong indent; retried once) | variants/aperture_0.5/frame_00001.png |
| scale_0.8 | `circle(width/2, height/2, width*1.42);` -> `width*0.8` | large (0.2291, 0.262) | smaller field: edges become huge radial bars, centre shows a clear multi-armed spiral of fine hatching | variants/scale_0.8/frame_00001.png |

## Modularisation notes
`circle()` + `tri()` together are a self-contained "twisted radial triangle field" generator:
inputs are centre, radius, spoke count `div`, twist `da`, size scale (the `160` factor), and the
`HALF_PI*0.25` aperture. The alternating parity fill is a one-off art decision but is trivially
parameterizable (e.g. a `fillFn(i,j)` or a palette + parity rule). A clean parameter object:
`{center, radius, div, twist, sizeScale, aperture, palette, fillRule}`. The commented-out block in
`generate()` (lines 25-27) is dead code; `saveImage()`/`keyPressed()` are harness glue, not art.
The experiments confirm all five parameters are visually dominant: every one of them alone
reshapes the whole composition, so a library function should expose all of them.
