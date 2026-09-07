---
sketch: 2018/Generativos/toalla
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1514
animated: false
techniques: [noise-field, grid, distortion]
primitives: [line, shape]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(300,360)*0.3)", tried: [~216], change: large, effect: "2x lines: mesh becomes dense fine hatching that blends into a smooth colour gradient; circles merge into one cream blob"}
  - {name: hStrokeWeight, default: 5, tried: [1], change: large, effect: "1px horizontals: grid reads as fine square mesh; per-line palette gradient (yellow-orange-green-blue) visible across canvas; circles more distinct"}
  - {name: desformAmp, default: 30, tried: [90], change: large, effect: "3x displacement: lines bow into big waves and thin out, exposing palette colour; circle centres shifted far from centre"}
  - {name: circleCount, default: 10, tried: [30], change: moderate, effect: "centre more crowded; large circles overlap each other more"}
  - {name: noiseDetail, default: 2, tried: [5], change: none, effect: "pixel-identical: Processing noiseDetail() does not affect toxi SimplexNoise used in desform"}
  - {name: circleSizeMax, default: 0.5, tried: [0.15], change: moderate, effect: "all circles small, scattered dots; grid/gradient dominates the centre"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, angOffset, angDetail, desOffset, desDetail, amp) -> PVector", note: "2-D simplex noise displacing a point by noise-driven angle and magnitude"}
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, desformFn)", note: "polyline of ~1pt-spaced samples passed through a displacement field"}
  - {name: paletteLerp, signature: "getColor(v) -> int", note: "wrapping lerp through a fixed colour list"}
---

## What it draws
A full-bleed grid of fine white lines (horizontal lines ~5px thick, vertical ~2px) that wavers
organically, like a woven towel seen up close, on a black background. Ten large flat-coloured
circles (orange, green, blue, cream, teal) cluster in the centre. The additive blend mode makes
the lines glow brighter where they cross the circles, so the circles read as soft coloured patches
behind a luminous mesh.

## How the code works
Static one-shot sketch: `setup()` calls `generate()` once; `draw()` is empty (lines 13-14).
- `generate()` sets `blendMode(ADD)` (line 26) so everything is added onto the near-black
  background (line 31), seeded from `seed` (lines 29-30).
- Line count: `cc = int(random(300, 360)*0.3)` (line 40) ≈ 90-108 lines; spacing
  `ss = (width-2*bb)/cc` with a 20px margin `bb` (lines 41-42).
- Horizontal pass (lines 44-52): `strokeWeight(5)`, then for each of `cc+1` rows a stroke sampled
  through the palette with alpha 240 (`getColor(ic+dc*j), 240`, line 50) is drawn as a
  noise-displaced polyline `nline` (line 51). The per-row colour walks the palette by index j, so
  the lines are actually a yellow→orange→cream→blue→green gradient; at the baseline's 5px weight
  and ~90 lines, ADD blending sums the dense overlap to near-white, which is why the grid reads as
  white. The `stroke(255, 20)` on line 45 is immediately overwritten and never used.
- Vertical pass (lines 54-58): same, `strokeWeight(2)`, `cc+1` columns.
- Circles (lines 60-64): 10 no-stroke filled circles, positions in the central 25-75% square,
  sizes 5-50% of width, colours picked randomly from the 7-colour palette via `rcol()`
  (lines 114-117).
- Displacement: `desform(x, y)` (lines 103-107) returns a point pushed by `des` = simplex noise
  (offset `desDes`, detail `detDes`) × 30 px along angle = simplex noise (offset `desAng`, detail
  `detAng`) × TAU×3. Both fields are toxi `SimplexNoise.noise` static calls — Processing's
  `noiseDetail(2)` (line 38) does not apply to them (confirmed by the pixel-identical detail_5
  variant).
- `nline` (lines 87-96) samples the segment at ~1px steps and runs every sample through
  `desform`, so a straight line becomes a wavy polyline.
- `circle` (lines 67-85) builds a filled disc as a fan of triangles (TRIANGLE mode, one vertex at
  the displaced centre), so the circle edges are also noise-wobbled.
- Randomness enters through `randomSeed(seed)` / `noiseSeed(seed)`; the toxi noise offsets
  (`desAng`, `desDes`) come from `random`, so the whole displacement pattern is seed-driven.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.6 | `int cc = int(random(300, 360)*0.3);` -> `*0.6` | large (mean 0.3158, 0.821 of pixels) | no visible individual lines: dense fine hatching blends into a smooth colour gradient (yellow/orange top, green right, blue bottom); circles mostly merge into a large cream/white blob, only yellow, green, orange edges remain | variants/cc_0.6/frame_00001.png |
| hweight_1 | `strokeWeight(5);` -> `strokeWeight(1);` | large (mean 0.1612, 0.52 of pixels) | horizontal lines drop to 1px: grid becomes a crisp fine square mesh; the per-line palette gradient is now visible across the background (yellow→orange→green→blue); circles read more distinctly (orange, green, blue, teal, cream) | variants/hweight_1/frame_00001.png |
| desamp_90 | `desDes+y*detDes)*30` -> `*90` | large (mean 0.2526, 0.71 of pixels) | displacement 3x stronger: lines bow into large waves and cross, thinning in places so the palette colour shows through; circle centres are displaced far from the centre (orange top, green right, small cluster bottom-left, cream mid-right) | variants/desamp_90/frame_00001.png |
| circles_30 | `for(int i = 0; i < 10; i++){` -> `i < 30` | moderate (mean 0.0653, 0.159 of pixels) | ~3x more circles: the central region is crowded and heavily overlapped (large orange, green, blue, teal, cream); grid otherwise unchanged | variants/circles_30/frame_00001.png |
| detail_5 | `noiseDetail(2);` -> `noiseDetail(5);` | none (mean 0.0, 0.0 of pixels) | no visible change, pixel-identical to baseline: Processing's noiseDetail() has no effect because the wobble comes from toxi's SimplexNoise (static call, no octave argument) | variants/detail_5/frame_00001.png |
| csize_0.15 | `width*random(0.05, 0.5)` -> `width*random(0.05, 0.15)` | moderate (mean 0.1034, 0.221 of pixels) | all 10 circles small (≤15% of width), scattered as dots in the centre (orange, green, yellow, blue, teal, white); the grid and its colour gradient now dominate the centre instead of large solid shapes | variants/csize_0.15/frame_00001.png |

## Modularisation notes
- `desform` is the reusable core: a 2-D simplex-noise displacement (angle + magnitude from two
  noise samples) — a library `noiseDisplace(x, y, amp, detail, offset) -> PVector`.
- `nline` is generic: any segment resampled at ~1px through an arbitrary displacement function;
  could be `displacedLine(x1, y1, x2, y2, f)`.
- `getColor(v)` (wrapping palette lerp) and `rcol()` (random palette pick) are standard palette
  helpers.
- The triangle-fan `circle` is a one-off: with a normal `ellipse()` the same look is achievable;
  the fan exists only so the centre/edge vertices pass through `desform`.
- A clean parameter object: `{seed, lineCount, hStrokeWeight, vStrokeWeight, margin, lineAlpha,
  noiseAmp, noiseScale, circleCount, circleSizeRange, circleArea, palette, blendMode}`.
- Art decisions specific to this piece: ADD blend on black, the towel-like dense grid, 10 circles
  in the central square, the 7-colour palette.
