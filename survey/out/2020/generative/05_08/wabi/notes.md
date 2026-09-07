---
sketch: 2020/generative/05_08/wabi
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]   # both imported, no class from either is actually used
deterministic: true
ms_first_frame: 4184
animated: false
techniques: [3d-pointcloud, noise-field]
primitives: [point]
palette:
  colors: ["#FF350D", "#E90510", "#FCA700", "#A7AFFF", "#2116C7"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: cyclicLerp, signature: "cyclicLerp(int[] palette, float v) -> color", note: "cyclic palette interpolation: index floor(v), t = pow(frac(v), 0.6), lerp adjacent entries, wraps at palette length (lines 97-103)"}
  - {name: noiseGatedPointCloud, signature: "noiseGatedPointCloud(n, box, oscFreq, amp, noiseDetail, zGate, colorFn, alphaRange) -> void", note: "n points per layer; z = max(cos(x*fx), sin(y*fy)) * amp * noise(x*nd, y*nd); colour sampled from a noise-driven palette index (lines 68-76)"}
---

## What it draws
A flat orange-red field (#FF350D) covered by a very dense cloud of semi-transparent
points in red, orange, periwinkle blue and deep indigo. The points stack into
undulating, ribbon-like sheets whose crests and troughs form a coarse grid-like
lattice across the whole canvas. Where the sheets cross, the translucent colours
overlap into a moiré-like weave; a bright starburst of dense blue-and-white points
sits at the canvas centre, and the density thins toward the corners, which stay
mostly bare background.

## How the code works
`setup()` calls `generate()`; `draw()` calls it again every frame, but with a
fixed seed the output is identical each frame (static). `generate()` (lines 45-79):

- Reseeds `randomSeed(seed)` / `noiseSeed(seed)`, paints the background `#FF350D` (line 50).
- Samples control values once: `det = random(0.01)` (noise detail for the z-gate),
  `osc1` (line 54) a large x-oscillation frequency (~0-20), `osc2` (line 56, half the
  time `random(0.5, 2)`), `amp = random(300, 800)` (z amplitude), `detCol` and `des`
  (noise frequencies for the colour index).
- Outer loop, 14 layers (line 63): each layer gets a random offset
  `dx, dy ∈ ±30%` of width/height. Inside, 200 000 points (line 68):
  - `x, y` are uniform in `[0.3, 0.7]` of the canvas plus the layer offset, so each
    layer's points spread across the whole canvas (lines 69-70); `y += cos(x*10)`
    adds a fine wobble (line 71).
  - `dep = noise(x*det, y*det)` (line 72) is a smooth 0-1 envelope;
    `z = max(cos(x*osc1), sin(y*osc2)) * amp * dep` (line 73) — the high-frequency
    oscillation times the noise envelope produces the undulating sheets, with the
    `max()` of the two oscillators making the grid-like crest pattern.
  - Colour (line 74): `getColor(y*detCol*5 + noise(x*des, y*des)*6)` — a
    noise-driven scalar index into the 4-colour palette `{#E90510, #FCA700, #A7AFFF,
    #2116C7}` (line 88), interpolated cyclically with `pow(frac, 0.6)` easing
    (lines 97-103); alpha is `random(40, 170)`, so points are always translucent.
- All points are drawn with `beginShape(POINTS)` in P3D; 14 × 200 000 = 2.8 M points
  per frame. The central starburst is the overlap of all 14 random layer offsets,
  which coincide near the canvas centre, so density (and brightness) peaks there.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-ready: the cyclic palette lerp (lines 97-103) is a standalone
  `cyclicLerp(palette, v)`; the point-generation loop (lines 68-76) is a generic
  "oscillation field gated by 2-D noise" — `z = max(cos(x*fx), sin(y*fy)) * amp *
  noise(...)` — with the colour index and alpha range injectable as functions.
- One-off art decisions: the specific palette and the #FF350D background, 14 layers
  with ±30% random offsets, 200 000 points per layer, the `y += cos(x*10)` wobble,
  the `pow(frac, 0.6)` easing, and the `random(40, 170)` alpha window.
- Clean parameter object: `{layers: 14, pointsPerLayer: 200000, amp: [300, 800],
  oscX: (line 54 distribution), oscY: (line 56 distribution), noiseDetail: 0.01,
  colorDetail: 0.01, colorNoise: 0.008, alpha: [40, 170], offsetRange: 0.3,
  palette: [4 colors], background: #FF350D}`.
