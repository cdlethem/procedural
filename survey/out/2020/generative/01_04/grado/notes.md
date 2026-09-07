---
sketch: 2020/generative/01_04/grado
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2426
animated: false
techniques: [noise-field, particles, polar, lines-hatching]
primitives: [line, pgraphics]
palette:
  colors: ["#FE829C", "#000000", "#BB6633", "#3B382B", "#DF9BFB"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(3,8)", tried: [20], change: moderate, effect: "more clusters per cell; denser busier composition, bigger overlapping tangles and spiky feathery forms"}
  - {name: amp, default: 1.2, tried: [0.4], change: moderate, effect: "fewer spiral turns; looser larger open sweeping loops instead of tight tangles"}
  - {name: sub, default: 0.6, tried: [0.3], change: moderate, effect: "half the arcs per cluster; sparser, individual rings and balls more distinct"}
  - {name: det, default: 0.002, tried: [0.01], change: moderate, effect: "5x noise detail; finer more fragmented spiky arcs, elements look smaller and break apart"}
  - {name: oscAmp, default: "random(5,16)", tried: [0], change: moderate, effect: "removes radius oscillation; clusters become smoother denser filled disc-like balls with fewer wavy petals"}
  - {name: colors, default: "{#FE829C,#000000,#BB6633,#3B382B,#DF9BFB}", tried: ["{#A1A7F4,#EA77BA,#EA0071,#F70D04,#301156}"], change: moderate, effect: "palette swapped to pink/red/violet; structure unchanged"}
---

## What it draws
A 5×5 grid of small, roughly circular line clusters on a light gray background. Each cluster is a tangle of many thin, low-opacity arcs and partial circles in pinks, purples, burnt orange, dark olive and near-black, with the centre cells larger and denser than the corners. The lines are wavy and irregular, giving a sketched, hand-drawn feel; some clusters look like small flowers or scribbled balls.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the piece is static (grado.pde:23-36).
- `generate()` (grado.pde:46-145): `background(226)` light gray; a double loop `jj,ii = -2..2` (grado.pde:66-67) lays out the 5×5 grid, translating each cell to `width*(0.5+ii*0.16)` and scaling it by `0.8+random(0.4)` (grado.pde:71-72), so the centre cell is biggest.
- Per cell, `cc = int(random(3,8))` clusters are drawn (grado.pde:75). Each cluster picks two colours `c1,c2` by lerping a random palette colour (`rcol()`, random from the 5-colour list at grado.pde:178) toward white by a small random amount (grado.pde:81-82).
- Each cluster draws `sub = int(random(4000,8000)*0.6*amp)` line segments along a spiral (grado.pde:86, 101-139): radius `r = pow(lerp(r1,r2,v), pwrR)` grows along `v = i/sub` (grado.pde:88, 104), angle `a = da*i` accumulates `rot = amp*TAU` total turns (grado.pde:84-85, 105).
- Distortion: two simplex-noise samples offset the arc endpoints' angles `a1,a2` by up to 4·TAU (grado.pde:116-118); the point position gets an extra `cos(xx*2.01)*1.8` wobble (grado.pde:129-130); `osc = 1+sin(pow(v,2.4)*TAU*oscAmp)*0.24+sin(a*6)*0.2` modulates the radius (grado.pde:125).
- Each segment is a short arc via `arc2()` (grado.pde:147-165): size `s = pow(lerp(s1,s2,v), pwrS)`, angle span from the noise-perturbed `a1..a2`, and the arc radius itself wobbled by `1+sin(v*PI)*alt` (grado.pde:160).
- Stroke: `strokeWeight(1.2*pow(sin(PI*v),1.2))` thins at both ends of the spiral, alpha `26*sin(PI*v)-random(2)` fades in/out (grado.pde:108-110) — hence the faint, layered look.
- P3D renderer with `hint(DISABLE_DEPTH_TEST)` (grado.pde:48); the triangulate import is unused in the final code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(random(3, 8));` -> `int cc = int(random(3, 20));` | moderate (mean 0.1314, 0.456) | denser, busier: more clusters per cell, large overlapping tangles in the centre, many spiky feathery forms | variants/cc_20/frame_00001.png |
| amp_low | `float amp = random(1, random(2.5, 3.5)*0.8)*1.2;` -> `... *0.4;` | moderate (mean 0.1003, 0.314) | fewer spiral turns: clusters become looser, larger open sweeping loops with big empty centres | variants/amp_low/frame_00001.png |
| sub_low | `float sub = int(random(4000, 8000)*0.6*amp);` -> `... *0.3*amp);` (first attempt failed bad_sub on wrong OLD text) | moderate (mean 0.1051, 0.348) | half the arcs: sparser, individual rings and scribble balls clearly separated, cleaner circular outlines | variants/sub_low/frame_00001.png |
| det_high | `float det = 0.002*v;` -> `float det = 0.01*v;` | moderate (mean 0.0654, 0.244) | 5x noise detail: finer, more fragmented spiky arcs; elements break apart into smaller pieces | variants/det_high/frame_00001.png |
| oscAmp_0 | `float oscAmp = random(5, 16)*random(1);` -> `float oscAmp = 0;` | moderate (mean 0.1087, 0.357) | no radius oscillation: clusters become smoother, denser, filled disc-like balls (solid orange/purple discs) with fewer wavy petals | variants/oscAmp_0/frame_00001.png |
| palette_alt | `int colors[] = {#FE829C, #000000, #BB6633, #3B382B, #DF9BFB};` -> `{#A1A7F4, #EA77BA, #EA0071, #F70D04, #301156};` | moderate (mean 0.0525, 0.216) | palette swapped to pink/red/violet with a dark-purple ink; structure and layout unchanged | variants/palette_alt/frame_00001.png |

## Modularisation notes
- `arc2()` is generic: a size/alpha/angle-parametrisable arc with a wobble term — directly reusable.
- The per-cluster "scribble ball" (spiral + noise-perturbed short arcs + fade-in/out alpha) is a reusable generator parameterised by (centre, scale, turns, subdivisions, noise scale/z, colour pair).
- The grid-of-clusters layout (5×5, random per-cell scale) is a one-off composition choice; a library version would take a grid size and per-cell scale function.
- A clean parameter object: {grid: 5, cellSpacing: 0.16, perCellScale: [0.8, 1.2], clustersPerCell: [3, 8], turns: [1, 3.5*0.8*1.2], subdivisions: [4000, 8000]*0.6*amp, noiseDetail: 0.002, arcSize: [0.012, 0.032]*width, oscAmp: [5, 16], alpha: 26, weight: 1.2, palette: 5-colour list, background: 226}.
