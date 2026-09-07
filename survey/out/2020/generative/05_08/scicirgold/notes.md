---
sketch: 2020/generative/05_08/scicirgold
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 12971
animated: false
techniques: [flow-field, noise-field]
primitives: [line]
palette:
  colors: ["#D7CEA9", "#7E845A", "#232319", "#303B4D", "#362D17"]
  selection: lerp-between
composition: margins
parameters: []
reusable_candidates:
  - {name: poissonFlowField, signature: "poissonFlowField(count, minDist, detAng, len, alpha, palette) -> void", note: "rejection-sampled points with noise-driven line orientation, drawn as LINES shape"}
  - {name: noiseAngleField, signature: "noiseAngleField(x, y, detAng) -> float", note: "angle from 2-D simplex noise at a point"}
---

## What it draws
Thousands of short hair-like line segments on a black background, in muted gold, olive, dark navy and near-black tones. The lines are dense and fibrous, oriented by a noise field that produces several visible swirling vortex regions. The strokes fill the central ~80 % of the canvas, leaving a black margin.

## How the code works
`generate()` is called from `setup()`; `draw()` is empty so the sketch is static.

1. **Seed** (lines 42–43): `noiseSeed(seed)` and `randomSeed(seed)` make the run deterministic.
2. **Background** (line 45): solid black.
3. **Noise scales** (lines 47–48): `detSize = random(0.01)*random(1)` and `detDis = random(0.01)` are seeded-random values in [0, 0.01). They control the spatial frequency of the placement-noise and the distance-check-noise respectively.
4. **Point placement** (lines 50–72): 60 000 candidate points are drawn uniformly from the inner 80 % of the canvas. Each candidate's size `s` is `1 + noise(x·detSize, y·detSize)²·5·random(0.8,1)`. A rejection loop (lines 58–66) discards any point whose Chebyshev and Euclidean distance to every already-accepted point is less than a noise-modified minimum gap `(s+other.z)*(0.7+noise(x·detDis,y·detDis)*0.5)*0.8`. This is a loose Poisson-like rejection sampling, so accepted points are more spread out where the noise is higher.
5. **Line orientation** (lines 78–93): a single `beginShape(LINES)` batch draws all accepted points as pairs of vertices. For each point, angle `a = noise(x·detAng, y·detAng)·2·TAU` and a second angle `a2 = noise(a·0.8, x·detAng, y·detAng)·2·TAU` are taken from 2-D simplex noise at detail scale `detAng` (seeded-random in [0, 0.001)). The line runs from `(x, y)` to `(x + cos(a2)·s·6, y + sin(a2)·s·6)`, with a small `random(-1,1)` jitter on the start point.
6. **Colour** (lines 89, 119–125): `getColor(v)` takes a continuous value `v`, wraps it into the 5-colour palette, and `lerpColor`s between adjacent palette entries with a `pow(v%1, 0.6)` ease, giving smooth transitions through the palette. Alpha is fixed at 120.
7. **Renderer**: P2D, `smooth(8)`, `pixelDensity(2)` (ignored on this display).

The triangulate library is imported but never used in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic**: the rejection-sampling loop (lines 50–72) is a parameterisable Poisson-disc-like sampler — the minimum-gap function is the art decision, the structure is reusable.
- **Generic**: `noiseAngleField` (lines 81–82) — mapping a 2-D noise value to an angle in [0, 2π) is a standard flow-field primitive.
- **Generic**: `getColor(float v)` (lines 119–125) — continuous palette interpolation via lerpColor with a power ease is a reusable colour utility.
- **One-off**: the specific 5-colour muted gold/olive palette, the `s*6` line-length multiplier, the alpha value 120, and the three independent noise-detail scales (detSize, detDis, detAng) are art decisions tied to this particular look.
- **Parameter object**: `{count, innerFraction, detSize, detDis, detAng, lenMult, alpha, palette[]}`.
