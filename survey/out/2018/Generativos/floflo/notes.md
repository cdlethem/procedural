---
sketch: 2018/Generativos/floflo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2905
animated: false
techniques: [noise-field, polar, spiral, recursion, distortion]
primitives: [shape]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(300,1000)", tried: [1500], change: large, effect: "higher count = denser, finer, busier small-rosette field (more overlap, smaller apparent stars)"}
  - {name: sub, default: "random(80,260)", tried: [20, 40], change: large, effect: "fewer petals = thicker, bolder, chunkier spikes with wider dark gaps; coarser texture (largest pixel change of the set)"}
  - {name: ma, default: "random(0.2,0.9)", tried: [0.6, 0.95], change: large, effect: "higher shrink = more nested concentric rings per rosette (deeper spiral, busier cores)"}
  - {name: dis, default: "random(0.5,0.8)", tried: [0.05, 0.15], change: large, effect: "smaller per-ring offset = rings stay more concentric/centred (less off-axis spiral); large spirals more circular"}
  - {name: bigcc, default: "random(1,random(1,4))", tried: [3, 6], change: large, effect: "more large central spirals; they cluster/overlap in the central band into one dominant spiral; lowest pixel-fraction change (small field unchanged)"}
reusable_candidates:
  - {name: rosette, signature: "rossette(x, y, radius, shrink, petals, noiseDetail, palette) -> void", note: "one flo(): nested noisy polar ring of triangular petals, each ring offset -> spiral"}
  - {name: scatter, signature: "scatter(count, placeFn, radiusFn, drawFn) -> void", note: "generate()'s loop: place many shapes at random positions with a decaying radius"}
  - {name: pickColor, signature: "pickColor(palette[]) -> int", note: "rcol(): uniform random colour from a fixed list"}
---

## What it draws
A full-bleed 960x960 field of tiny multi-coloured pinwheels/rosettes covering the entire canvas. Each rosette is a ring of thin triangular petals in random bright colours (red, blue, amber/orange, green, cream, near-black) with a pale off-white background showing through the gaps. Most rosettes are small and scattered like stars; a few much larger ones spiral outward through several nested rings — most prominently one big multi-ring spiral in the lower-left. The overall texture is a dense, busy mosaic of radiating coloured spikes.

## How the code works
- `setup()` (line 3) creates a 960x960 P2D canvas, `smooth(8)`, then calls `generate()` once; `draw()` (line 11) is empty, so the sketch renders a single static frame (frames 10/60 are identical to frame 1).
- `generate()` (line 22) paints the background with one random palette colour (line 23 via `rcol()`), then draws two groups:
  - **Small field:** `cc = random(300,1000)` iterations (line 27). Each rosette gets a random position (lines 30-31), a radius that shrinks as `i` grows (`mm = map(i,0,cc,0.1,0.0)`, line 29) plus a noise term (lines 32-33), and a random shrink `ma = random(0.2,0.9)` (line 34), then calls `flo()`.
  - **Large central spirals:** `cc = random(1..3)` (line 39), placed in the central 0.2-0.8 region (lines 42-43) with a large radius 0.4-1.0x width (line 44) and a slow shrink `ma = random(0.8,0.9)` (line 41), so they accumulate many nested rings -> the big spirals.
- `flo(x,y,rad,ma)` (line 48) builds one rosette. A `while (r > 2)` loop (line 53) shrinks `r *= ma` (line 99). Each ring:
  - is offset from the previous ring's centre by a random angle/distance (`an`, `dis`, lines 56-59, translated line 70) — this successive offset is what produces the spiral.
  - has `sub = random(80,260)` petals (line 61) laid evenly around 2pi (`da = TWO_PI/sub`, line 62).
  - For each petal (line 71), two edge angles `a1`/`a2` (lines 72-73) are pushed through 2-D noise (`n1`/`n2`, lines 74-75) to modulate the tip radii `r1`/`r2` between `r` and `r*ma^2` (lines 76-77). A coloured triangle from the centre to the two arc points is drawn (lines 90-96); a thin dark translucent band (`fill(0,50)`) is drawn just outside it (lines 79-88) -> the dark seams between petal rings.
  - Petal colour is a uniform random pick from the 7-colour palette via `rcol()` (lines 79/90 -> 110-112). The `getColor()`/`ic`/`dc` gradient path is commented out (lines 80, 91).
- Randomness enters at: the seed field (line 1), background colour, every flower position/radius/shrink, per-ring offset, petal count, petal noise, and each petal's colour.
- Renderer P2D + `smooth(8)` antialiases the dense triangles; no blend modes, no shaders.

## Experiments
| variant | substitution | change score | observation | image |
| cc_1500 | `int cc = int(random(300, 1000));` -> `int cc = 1500;` | large (0.261, 0.878 px) | denser, finer, busier field: tiny rosettes pack the whole canvas much more tightly with heavy overlap; large spirals still present (big one upper-left, large spiral centre-left) | variants/cc_1500/frame_00001.png |
| sub_20_40 | `int sub = int(random(80, 260));` -> `int sub = int(random(20, 40));` | large (0.340, 0.928 px) | coarser, bolder: each rosette has fewer, much thicker coloured blades with wider dark gaps, so the field reads as chunky pinwheels; large spirals also have fat blades (largest pixel change) | variants/sub_20_40/frame_00001.png |
| ma_0.6_0.95 | `float ma = random(0.2, 0.9);` -> `float ma = random(0.6, 0.95);` | large (0.276, 0.894 px) | every rosette shows more nested concentric rings / a tighter spiral core instead of a flat single-ring star; large centre-left spiral has many clear concentric rings | variants/ma_0.6_0.95/frame_00001.png |
| dis_0.05_0.15 | `float dis = random(0.5, 0.8);` -> `float dis = random(0.05, 0.15);` | large (0.273, 0.853 px) | rings stay near-centred rather than offset, so large spirals (upper-right) read as more circular/concentric; small rosettes are tighter concentric stars | variants/dis_0.05_0.15/frame_00001.png |
| bigcc_3_6 | `cc = int(random(1, random(1, 4)));` -> `cc = int(random(3, random(3, 6)));` | large (0.212, 0.573 px) | small-rosette field identical in character; the 3-6 large spirals overlap in the central band into one dominant large spiral (centre-left); lowest pixel-fraction change of the set since only the central region differs | variants/bigcc_3_6/frame_00001.png |

## Modularisation notes
- **Generic / library-ready:** `flo(x,y,rad,ma)` (line 48) is the core reusable unit — "draw a nested noisy polar rosette". Parameterising its `sub` (petals), `ma` (shrink/rings), the per-ring offset `dis`, and the noise `det`/`des` yields a `rossette()` primitive. `generate()`'s two-loop "many small + a few large" placement is a `scatter()`/composition pattern. `rcol()` (line 110) is a generic `pickColor(palette)`.
- **One-off art decisions:** the specific 7-colour list (line 109), the dark `fill(0,50)` seam band (lines 79-88), the exact random ranges for counts/sizes, and the large-spiral placement band (0.2-0.8).
- **Clean parameter object:** `{smallCount, smallRadiusMax, smallShrink:[lo,hi], bigCount, bigRadiusMax, bigShrink:[lo,hi], petals:[lo,hi], ringOffset:[lo,hi], petalNoiseDetail, palette[]}`.
