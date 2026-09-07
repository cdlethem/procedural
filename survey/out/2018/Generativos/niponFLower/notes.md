---
sketch: 2018/Generativos/niponFLower
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1584
animated: false
techniques: [noise-field, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#F19617", "#251207", "#15727F", "#CEAB81", "#BD3E36"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseColor, signature: "noiseColor(x, y, detail, cycles) -> color", note: "2-D noise sampled and mapped through a cyclic palette with lerp between neighbours (getColor, lines 122-128)"}
  - {name: powerDistribute, signature: "powerDistribute(i, n, lo, hi, exp) -> float", note: "pow(map(i,0,n,lo,hi), exp) packs most values near lo (line 33) — exponential density ramp"}
  - {name: petalo, signature: "petalo(s1, s2, pwr1, pwr2) -> closed shape", note: "super-ellipse-ish petal via sign*pow distortion of a unit circle (lines 81-98); defined but never called in this sketch"}
---

## What it draws
Full-bleed field of 960x960 stippled dots on a warm tan ground. A dense band across the top
~10% of the canvas: thousands of overlapping ~10px dots merge into soft blobs of orange,
teal, red and dark brown over cream. Below that the dots thin out into a sparse stipple that
fills the rest of the canvas, in mottled patches of the same colours (dominant: tan, orange,
teal). No strokes, no outlines.

## How the code works
Single tab, `niponFLower.pde`. `setup()` (lines 3-8) opens a 960x960 P2D window and calls
`generate()` once; `draw()` is empty, so the piece is static. Any key press regenerates with a
new `seed`.

`generate()` (lines 23-40):
- Background is one random palette colour (`rcol()`, line 24); seed 42 landed on the tan
  `#CEAB81`, which reads as the ground.
- Loops `cc = 20000` times (line 29). `x` is uniform-random (line 32).
- Vertical position: `dy = pow(map(i, 0, cc, 0.2, 1), 8)` (line 33) — an 8th-power ramp.
  ~70% of all dots have `dy < 0.11`, i.e. they land in the top ~10% of the canvas, where they
  overlap into the dense blob band; the rest scatter down the full height.
- Dot size `s = width*(0.01 + random(0.01)*dy)` (line 35): ~9.6px at the top, up to ~19px
  near the bottom, so the sparse lower dots are individually slightly larger.
- Colour: `getColor(noise(desc + x*detc, desc + y*detc) * colors.length * 4)` (line 37).
  `desc` is a random offset, `detc = random(0.01)` a small scale, so the noise field varies
  slowly over the canvas; the result is multiplied by 4 palette-cycles and passed through
  `getColor(float)` (lines 122-128), which lerps between adjacent palette entries — hence the
  smooth mottled colour patches rather than hard spots.
- `flower()`/`petalo()` (lines 43-98) build radial petal flowers with 3D tilt, but nothing
  calls them: dead code in this version of the sketch.

Palette (line 112): `#F19617 #251207 #15727F #CEAB81 #BD3E36`. Deterministic (harness seeds
`seed`); P2D, no shader.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `getColor(float)` noise-to-palette lerp (any noise-field piece), the `pow` density
  ramp (line 33) as a 1-D distribution utility, and the unused `petalo` super-ellipse petal —
  all separable with no sketch-specific state.
- One-off art decisions: the exact 8th-power exponent and `0.2` floor of the ramp, the 4-cycle
  colour multiplier, the 5-colour palette, and the tan background-as-palette-member trick.
- Clean parameter object: `{dotCount, rampExponent, rampFloor, dotSizeMin, dotSizeRange,
  noiseScale, colorCycles, palette, background}`.
