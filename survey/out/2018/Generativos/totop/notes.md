---
sketch: 2018/Generativos/totop
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1766
animated: false
techniques: [distortion, packing, grid, noise-field]
primitives: [line, shape]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cc (fine-grid line count), default: "random(300, 360)*0.8 (≈240-288 per direction)", tried: ["*0.3 (≈90-108)"], change: subtle, effect: "fine grid slightly sparser/softer; overall look nearly unchanged"}
  - {name: distAmp (desform magnitude 140*0.3), default: 0.3, tried: [1.0], change: moderate, effect: "grid bows into a more pronounced wavy pillow; blob edges wobble more"}
  - {name: packAttempts, default: 10000, tried: [3000], change: moderate, effect: "fewer, sparser blobs with larger gaps of bare background"}
  - {name: blobMax (width*random(0.05, X)), default: 0.25, tried: [0.5], change: large, effect: "much larger blobs, fewer of them (packing rejects more), bigger inner holes, canvas mostly covered"}
  - {name: ringRatio (inner circle p.z*X), default: 0.4, tried: [0.8], change: subtle, effect: "inner hole slightly larger, rings read thinner; rest identical"}
  - {name: desform, signature: "desform(x, y, angOffset, angScale, desOffset, desScale, amp) -> PVector", note: "2-D simplex-noise polar displacement field; used to wobble every line and circle edge"}
  - {name: circlePacking, signature: "circlePacking(nAttempts, minSize, maxSize, bounds) -> PVector[]", note: "rejection-sample circles until they no longer overlap; O(n^2)"}
  - {name: noiseRing, signature: "noiseRing(x, y, s, segments) -> void", note: "circle drawn as a triangle fan whose rim is passed through the displacement field, producing wobbly organic blobs"}
---

## What it draws
A light purple field (seed 42) with a dense, fine grid of very faint dark lines that is visibly
warped into a wavy, pillow-like sheet, its edges bowing in and out. Scattered over the central
~70% of the canvas are dozens of soft, wobbly oval blobs in deep blue, red-pink, mauve and
periwinkle; most read as rings because a smaller circle in the background colour is punched out
of their centre. A few nearly invisible thin diagonal strokes cross the field.

## How the code works
setup() (lines 6-11) opens a 960x960 P3D canvas and calls generate() once; draw() is empty
so the piece is static (frames 10/60 were dropped as identical to frame 1). Randomness is seeded
by the harness through the global `seed` (line 4) via `randomSeed`/`noiseSeed` (lines 29-30).
The background is one random palette colour via `rcol()` (line 31).

- **Wavy fine grid** (lines 33-42 and 70-77): two layers of straight lines. First layer: `cg`
  random 40-120 vertical+horizontal lines, `stroke(0, 9)` at weight 0.5 (lines 34-42), barely
  visible. Second layer: `cc` = random(300,360)*0.8 ≈ 240-290 lines each direction, weight 0.2,
  alpha 140 (lines 70-77). Both are drawn by `nline()` (lines 153-162), which samples each line
  once per pixel and pushes every sample through `desform()`.
- **Displacement field** (lines 169-173, `desform`): two independent 2-D SimplexNoise lookups
  (toxiclibs `SimplexNoise.noise`) give an angle and a magnitude; magnitude is scaled by
  `140*0.3` (~42 px max). This is what warps the grid and gives every blob edge its wobble.
  Angles/scales are re-drawn per run: `desAng`/`detAng` (lines 45-46) and `desDes`/`detDes`
  (lines 47-48); `noiseDetail(1)` (line 50) keeps the field smooth.
- **Faint diagonal strokes** (lines 59-67): 40 random endpoint pairs drawn with `nline()`,
  weight 0.8-1, colour from `getColor(ic+dc*j)` where `ic = random(1)` and `dc` is tiny, so the
  whole batch stays in one narrow slice of the palette and reads as ghost lines.
- **Blob packing** (lines 100-117): up to 10000 attempts; each candidate centre is random in the
  0.15-0.85 window, radius `width*random(0.05, 0.25)`/2; a candidate is rejected if it lies
  within half the sum of radii of any kept circle (circle packing by rejection).
- **Blob rendering** (lines 123-130, `circle` lines 133-151): each kept circle is drawn as a
  `beginShape(TRIANGLE)` fan of `max(8, r*PI)` triangles whose rim vertices pass through
  `desform()`, so the outline wobbles organically. Fill colour is
  `getColor(noise(...)*10)` (line 126): 2-D noise sampled per blob, mapped through the palette
  list with `lerpColor` (lines 188-195) — neighbouring blobs tend to get related hues. Then a
  smaller circle of radius `p.z*0.4` is painted over it with a fresh `rcol()` (line 128); when
  that matches the background it reads as a ring/hole.
- Palette (line 181): deep blue #2B00BE (doubled, so ~2x weight), red-pink #F73859, periwinkle
  #9896F1, and two light purples #D59BF6/#EDB1F0 that double as the background/inner-hole colour.
  The `triangulate` import (line 1) is unused in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.3 | `int cc = int(random(300, 360)*0.8);` -> `*0.3` | subtle | fine grid slightly sparser and softer; overall look nearly unchanged | variants/cc_0.3/frame_00001.png |
| amp_1.0 | `...noise(desDes+x*detDes, desDes+y*detDes)*140*0.3; ` -> `*140*1.0; ` | moderate | grid bows into a pronounced wavy pillow, blob edges wobble more strongly | variants/amp_1.0/frame_00001.png |
| attempts_3000 | `for (int i = 0; i < 10000; i++) {` -> `i < 3000` | moderate | fewer, sparser blobs; larger bare gaps | variants/attempts_3000/frame_00001.png |
| bsize_0.5 | `float s = width*random(0.05, 0.25);` -> `random(0.05, 0.5)` | large | much larger blobs, fewer of them, bigger inner holes, canvas mostly covered | variants/bsize_0.5/frame_00001.png |
| ring_0.8 | `circle(p.x, p.y, p.z*0.4);` -> `p.z*0.8` | subtle | inner hole slightly larger, rings read thinner; rest identical | variants/ring_0.8/frame_00001.png |

## Modularisation notes
- **Generic / library-ready**: `desform` (noise-driven polar displacement field), the `nline`
  pattern (polyline-through-field), the triangle-fan "wobbly circle" (`circle`), and the
  rejection circle packing. Together they form a small "organic grid + packed wobbly blobs"
  module.
- **One-off art decisions**: the two-layer grid with mismatched alpha/weight, the 40 ghost
  diagonals, the ring effect (inner `rcol()` circle), the noise*10 -> palette colour mapping,
  the doubled blue in the palette, and the 0.15-0.85 packing window.
- **Clean parameter object**: `{gridCount, gridAlpha, gridWeight, distAmp (140*0.3),
  angScale, desScale, blobAttempts (10000), blobMin (0.05), blobMax (0.25),
  packWindow (0.15), ringRatio (0.4), palette[]}`.
