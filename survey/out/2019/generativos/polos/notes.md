---
sketch: 2019/generativos/polos
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1524
animated: false
techniques: [noise-field, grid, distortion]
primitives: [shape]
palette:
  colors: ["#EBE2D5", "#fc8e19", "#F7F2DD", "#f2271d", "#4a2768", "#1A7DB6", "#E14998"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "int(random(60,120)*random(0.2))  # small int 0-24", tried: [12], change: large, effect: "more, smaller blobs scattered across the whole canvas"}
  - {name: stampProb(size-2.0 circle), default: 0.3, tried: [0.9], change: moderate, effect: "big circles appear more often; blobs grow and cover more of the canvas"}
  - {name: noiseAmp, default: 80, tried: [200], change: subtle, effect: "subtle: edges slightly wavier, layout unchanged"}
  - {name: detAng, default: "random(0.0008)", tried: ["random(0.008)"], change: subtle, effect: "subtle: red blob edges slightly spikier, layout unchanged"}
  - {name: palette, default: "[#fc8e19,#F7F2DD,#f2271d,#4a2768,#1A7DB6,#E14998]", tried: ["[#E1E8E0,#F5CE4B,#FC5801,#025DC4,#02201A,#489B4D]"], change: moderate, effect: "identical shapes; colours swapped to green/orange/dark-green"}
  - {name: desform, signature: "desform(x, y, angOffset, angScale, ampOffset, ampScale, amp) -> PVector", note: "warp a point by 2-D simplex noise: one sample for angle (x TAU*8), one for amplitude"}
  - {name: noiseBlob, signature: "noiseBlob(cx, cy, size) -> void (filled shape)", note: "triangle fan of ~size*PI/2 slices, every vertex and the centre passed through desform"}
---

## What it draws
On a warm cream background, two or three large amoeba-like blobs: a magenta/pink blob
upper-left, a bigger red blob dominating the centre-right, and one small steel-blue blob
tucked below the pink one. All blob edges are smooth and wavy, not circular. The lower
third of the canvas is empty background.

## How the code works
- `setup()` calls `generate()` (polos.pde:23,86). `draw()` calls it again every frame
  (line 34), but `generate()` re-seeds with `randomSeed(seed)` (line 88), so the picture
  is identical every frame — frames 10/60 were dropped as duplicates.
- Grid count `cc = int(random(60, 120)*random(0.2))` (line 109) is a small integer
  (0–24); cell size `ss = width/cc` (line 110) is therefore large.
- Double loop over interior grid points (lines 111–123): at each point, up to four
  concentric circles of diameter `ss*2.00 / 1.00 / 0.50 / 0.25` are drawn, each gated by
  a 30% probability (lines 115–121). With small `cc` only a few cells exist, and the
  big circles overlap and merge into the 2–3 visible blobs; the empty lower region is
  simply where no circles fired.
- `circle()` (lines 55–73) does not call `ellipse`: it builds a fan of
  `cc = max(8, r*PI)` triangles from the centre, with every vertex and the centre
  displaced by `desform()`.
- `desform()` (lines 80–84) samples 2-D simplex noise twice: an angle field
  (`SimplexNoise.noise(...)*TAU*8`, detail `detAng ≈ 0.0008`, lines 81, 93–94) and an
  amplitude field (`... * 80`, detail `detDes ≈ 0.003`, lines 82, 95–96). The point is
  shifted along the noisy angle by the noisy distance — this is what turns the circular
  fans into wavy organic blobs.
- Colour: `fill(rcol())` per circle, a uniform random pick from the six-colour palette
  (lines 157, 163–165). Background fixed at `#EBE2D5` (line 99), `noStroke()`, P2D +
  `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(60, 120)*random(0.2));` -> `int cc = 12;` | large | many small-to-medium wobbly blobs in all six palette colours (purple, red, orange, cream, blue, pink) scattered over the whole canvas, no empty region | variants/cc_12/frame_00001.png |
| prob2_0.9 | `if (random(1) < 0.3) circle(ss*i, ss*j, ss*2.00);` -> `< 0.9` | moderate | same three-blob layout as baseline, but an extra large orange blob fills the middle and the red blob is bigger | variants/prob2_0.9/frame_00001.png |
| amp_200 | `detDes)*80;` -> `detDes)*200;` | subtle | subtle: same three blobs in the same places, edges marginally wavier | variants/amp_200/frame_00001.png |
| detAng_0.008 | `detAng = random(0.0008);` -> `random(0.008);` | subtle | subtle: same layout; the red blob's outline is slightly more angular/spiky | variants/detAng_0.008/frame_00001.png |
| palette_green | active `int colors[] = {...}` line -> `{#E1E8E0, #F5CE4B, #FC5801, #025DC4, #02201A, #489B4D}` | moderate | shapes and layout identical to baseline; upper-left blob green, big right blob orange, small blob dark green | variants/palette_green/frame_00001.png |
## Modularisation notes
- Generic, library-worthy: `desform` (noise polar warp) and the `circle` fan construction
  (a "wobbly blob" primitive parameterised by centre, size, and the noise field). The
  grid + probability-stamping loop is also generic (a "stamped grid" generator).
- One-off art decisions: the exact palette, the 30% stamp probability, the four size
  ratios (2.0/1.0/0.5/0.25), the `TAU*8` angle amplification, the small `cc` range.
- Clean parameter object: `{gridCount, stampProbability, sizeRatios[], noiseAngleScale,
  noiseAngleDetail, noiseAmpScale, noiseAmpDetail, ampMax, palette[], background}`.
  Note the field names `desAng/detAng/desDes/detDes` are re-drawn globals; a library
  version should take them as arguments or a `NoiseField` object.
