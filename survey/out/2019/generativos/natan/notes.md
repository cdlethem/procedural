---
sketch: 2019/generativos/natan
year: 2019
renderer: JAVA2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2345
animated: false
techniques: [noise-field, particles, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#E1E8E0", "#F5CE4B", "#FC5801", "#025DC4", "#02201A", "#489B4D"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 600, tried: [200], change: large, effect: "fewer walkers: no dominant central ring, canvas covered by smaller scattered striped clusters"}
  - {name: cc, default: 800, tried: [200], change: large, effect: "shorter trails: many small rings instead of long curved trails, denser packing"}
  - {name: ccc, default: "random(2,7)", tried: ["random(1,2) i.e. 1"], change: subtle, effect: "one satellite per step: finer, sparser hatched rings, colour bands much weaker"}
  - {name: rrr, default: "random(0.04,0.12)", tried: ["random(0.15,0.35)"], change: moderate, effect: "fatter satellites: thicker, more saturated stripes and broader soft colour washes"}
  - {name: dc, default: 0.012, tried: [0.05], change: large, effect: "faster per-step palette cycling: finer multicolour bands inside rings, streakier colour washes"}
  - {name: minSize, default: "width*random(0.04,0.2)", tried: ["width*random(0.12,0.4)"], change: large, effect: "larger base dot size: bigger fatter striped blobs and broader washes"}
reusable_candidates:
  - {name: cyclicPaletteLerp, signature: "cyclicPaletteLerp(palette[], v) -> color", note: "wrapping lerp between adjacent palette entries, pow(v%1,2) bias"}
  - {name: noiseWalkTrail, signature: "noiseWalkTrail(x, y, steps, noiseOffset, noiseDetail, stepLen) -> void", note: "random walk steered by 2-D noise, per-step dot + orbiting satellite ring with sin^2 taper"}
---

## What it draws
The whole canvas is covered edge to edge by hundreds of overlapping zebra-like striped blobs: concentric rings of
alternating colour bands (dominant yellow, orange, blue, green and near-black on a pale grey-green ground). Some
walkers leave broad, soft, translucent washes of single colours (cream, orange, blue) behind the dense striped
clusters, so the image reads as a chaotic field of animal-print rings of many sizes.

## How the code works
`setup()` calls `generate()` once and `draw()` is empty, so the image is static (natan.pde:20-31,51).
Background is `#E1E8E0` lerped toward a random palette colour by a tiny factor (lines 56-58).
`generate()` seeds random and noise with `seed` (lines 53-54), then spawns `count = 600` walkers (line 65),
each starting at a random point extended to -20..120 % of the canvas (lines 67-68).
Per walker: two independent 2-D noise fields with random offsets/scales (~0.001) for path and size
(lines 72-75); a colour index `ic` and per-step advance `dc` (lines 76-77); a slow orbital drift `da`
(line 78); satellite count `ccc = random(2,7)` (line 81); satellite size ratio `rrr` (line 85); small
darkening factor (line 87).
The inner loop runs `cc = 800` steps (line 80): the heading angle `a` comes from noise sampled at the walker
position, so each trail follows a flow field (lines 90, 98-99), advancing 0.4 px x walker scale per step.
Dot size `s` is a noise-driven lerp between `minSize` and `maxSize`, multiplied by
`amp = 0.5 + sin(j*PI/cc)^2 * 0.5`, which tapers each trail to zero at both ends (line 91).
Fill = background lerped toward the cycling palette colour `getColor(ic + dc*j)` with an alpha ramp that
grows along the trail, optionally darkened, at alpha 250 (lines 93-96). Then `ccc` satellite dots are placed
on a circle of radius ~0.8*s around the walker, the circle rotating by `da` each step; satellite size is
`s*rrr*sin^0.4` (lines 104-110). Because the palette index advances by `dc` every step while the satellites
orbit, the orbiting dots lay down the concentric colour stripes that produce the zebra-ring look.
`getColor(v)` wraps `v` around the 6-colour palette and lerps between the two adjacent entries with
`pow(v%1, 2)` (lines 127, 135-141).
The final loop (lines 114-119) draws 2 px black dots for `points`, but that list is never populated, so it
has no visible effect. The `triangulate` import (line 1) is also unused by the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_200 | `int count = 600;` -> `int count = 200;` | large (mean 0.2725, 0.823 of pixels) | the big central striped ring is gone; canvas is now covered by smaller, more evenly scattered striped clusters with thinner soft colour washes | variants/count_200/frame_00001.png |
| cc_200 | `int cc = 800;` -> `int cc = 200;` | large (mean 0.2718, 0.818 of pixels) | trails are 4x shorter: long curved trails replaced by many small tight rings packed densely across the canvas | variants/cc_200/frame_00001.png |
| ccc_1 | `int ccc = int(random(2, 7));` -> `int ccc = int(random(1, 2));` | subtle (mean 0.0411, 0.143 of pixels) | subtle per the diff score: the dense zebra rings thin out into finer, sparser grey hatched rings; colour survives only as sparse accents (yellow/orange top-left, blue mid, scattered dots) | variants/ccc_1/frame_00001.png |
| rrr_0.3 | `float rrr = random(0.04, 0.12);` -> `float rrr = random(0.15, 0.35);` | moderate (mean 0.0993, 0.35 of pixels) | satellites are 3-5x fatter: stripes are thicker and more saturated, and broad soft washes of yellow, green, blue and cream stand out more | variants/rrr_0.3/frame_00001.png |
| dc_0.05 | `float dc = random(0.012)*random(0.2, 1)*random(0.1, 1)*90;` -> `float dc = random(0.05)*random(0.2, 1)*random(0.1, 1)*90;` | large (mean 0.2239, 0.795 of pixels) | palette cycles ~4x faster per step: rings get finer, busier multicolour bands and the colour washes become streaky (yellow, orange, blue, green streaks) | variants/dc_0.05/frame_00001.png |
| minSize_0.4 | `float minSize = width*random(0.04, 0.2)*scale;` -> `float minSize = width*random(0.12, 0.4)*scale;` | large (mean 0.2751, 0.854 of pixels) | base dot size 2-4x larger: much bigger, fatter striped blobs and broader colour washes fill the canvas, small rings mostly gone | variants/minSize_0.4/frame_00001.png |

## Modularisation notes
Generic / library-worthy: the wrapping palette lerp (`cyclicPaletteLerp`) and the tapered noise-walk trail
(`noiseWalkTrail` — heading from 2-D noise, sin^2 size envelope, per-step colour advance, optional orbiting
satellite ring). One-off art decisions: the specific 6-colour palette, satellite count 2-6, the `rrr` ratio,
the small black darkening, and the background tint toward a random palette colour. A clean parameter object
would hold: walker count, steps per walker, size range, satellite count, satellite ratio, per-step colour
advance `dc`, orbital drift `da`, noise detail, step length, and alpha.
