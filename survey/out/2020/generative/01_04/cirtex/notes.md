---
sketch: 2020/generative/01_04/cirtex
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1983
animated: false
techniques: [noise-field, image-source, distortion]
primitives: [image]
palette:
  colors: ["#08070A", "#0F6489", "#96C4CB", "#EBD15B", "#F28A0E", "#DD2404", "#4E1706"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: patchCount, default: 100, tried: [300], change: large, effect: "more low-alpha ground patches: image overall darker, broad colour regions diluted, more black ground visible"}
  - {name: fibreCount, default: 100000, tried: [20000], change: moderate, effect: "sparser fur: individual strokes and dark gaps visible, colour masses unchanged"}
  - {name: fibreScale, default: "random(16,24)*1.4", tried: ["random(4,8)*1.4"], change: large, effect: "shorter, finer strokes, more open see-through texture"}
  - {name: warpAmp, default: 500, tried: [150], change: moderate, effect: "weaker position warp: fine colour composition rearranged (large pale blue/cream mass centre, red/yellow at edges), same density"}
  - {name: detCol, default: "random(0.0008,0.002)", tried: ["random(0.0001,0.0003)"], change: large, effect: "smoother, broader noise colour bands in the fine field, less mottling"}
  - {name: fibreAlpha, default: 255, tried: [80], change: moderate, effect: "translucent strokes: overall darker and more muted, more black ground shows through"}
reusable_candidates:
  - {name: noiseWarpStampField, signature: "noiseWarpStampField(count, image[], warpAmp, angleDetail, sizeDetail, palette) -> void", note: "stamps images at noise-displaced positions with noise-driven angle, scale and palette colour"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "lerp between adjacent palette entries with pow(v%1, 0.6) easing (getColor, line 138)"}
---

## What it draws
Full-bleed dark texture that reads like fur or hair. Broad soft patches of
orange/amber, cream and steel blue sit on a near-black brown ground, and the
whole surface is covered in short, hair-like strokes that fan and swirl in
noisy, locally aligned directions. The strokes are denser and brighter in the
central orange region and fade into dark brown/black at the edges.

## How the code works
`setup()` (cirtex.pde:24) loads 4 hair/fibre brush PNGs (`brush01..04`) and
calls `generate()` once; `draw()` is empty, so the piece is static
(frames 10/60 were identical to frame 1 in the baseline run).

- `generate()` (line 68) seeds random/noise, paints a black background, and
  runs two loops:
  1. **Large colour patches** (line 77): 100 stamps of a random brush, scaled
     to 0.5–1.2 of the canvas width, randomly rotated/translated, tinted by
     `lerpColor(color(0), rcol(), random(0.3))` (line 79) — a darkened random
     palette colour at low alpha. This creates the broad orange/blue/cream
     regions on the black ground.
  2. **Fibre field** (line 99): 100,000 tiny stamps. Position is random over
     the canvas extended by 20% on each side, then displaced by a 3-D noise
     field with a 500 px amplitude (lines 104–105), which clumps fibres into
     swirling clusters. Colour is `getColor(noise(...)*colors.length*5 +
     random(2))` (line 108): `getColor` (line 138) lerps between adjacent
     entries of the 7-colour palette with a `pow(v%1, 0.6)` ease, giving
     smooth noise-driven colour bands; alpha is fully random `random(255)`.
     Each stamp is rotated by `HALF_PI + (noise(...)*2-1)*TAU` (line 111) —
     a noise angle field, so neighbours align and the hair swirls. Anisotropic
     size: `ww = random(4,12)*0.2` (line 102) stretched by `random(0.1..1.2)`
     factors (line 103), then scaled by `(3+random(1)) * random(16,24)*1.4 *
     amp` where `amp = simplexNoise(xx*0.002, yy*0.002)+1` (line 113) — the
     simplex amplitude field makes fibre length vary smoothly across the
     canvas.
- The `forms[]` array is never loaded (`loadForms()` is commented out at line
  31) and the ternary at line 118 always picks a brush (`random(1) < 1`), so
  `forms` is dead code. The `triangulate` import (line 1) is unused; toxi
  provides only `SimplexNoise`.
- `pixelDensity(2)` is requested but unavailable on the headless display
  (stderr warning in the baseline run).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| patches_300 | `  for (int i = 0; i < 100; i++) {` -> `... i < 300 ...` | large | darker overall; broad colour regions diluted by extra dark low-alpha patches, more black ground visible, same fibre swirl | variants/patches_300/frame_00001.png |
| fibres_20000 | `  for (int i = 0; i < 100000; i++) {` -> `... i < 20000 ...` | moderate | sparser fur; individual hair strokes and dark gaps clearly visible, colour masses (orange centre, blue right, cream top-left) unchanged | variants/fibres_20000/frame_00001.png |
| sca_4_8 | `    sca *= random(16, 24)*1.4;` -> `random(4, 8)` | large | shorter, finer strokes; more open, see-through texture, colour masses unchanged | variants/sca_4_8/frame_00001.png |
| warp_150 | `    xx -= (noise(...)*2-1)*500;` -> `*150` | moderate | fine-field colour composition rearranged: large pale blue/cream mass centre, red and yellow at edges; density and stroke size unchanged | variants/warp_150/frame_00001.png |
| detCol_0.0003 | `  float detCol = random(0.0008, 0.002);` -> `random(0.0001, 0.0003)` | large | much smoother, broader colour bands in the fine field; orange mass blends into cream/blue with far less mottling | variants/detCol_0.0003/frame_00001.png |
| alpha_80 | `random(255)*random(1)` -> `random(80)*random(1)` | moderate | more translucent strokes: overall darker, colours muted, more black ground between fibres | variants/alpha_80/frame_00001.png |

## Modularisation notes
- Generic, reusable: the two-loop "stamped field" pattern — a coarse pass of
  large, dark, low-alpha stamps to lay down a colour composition, then a fine
  pass of many small anisotropic stamps whose position is noise-warped, whose
  orientation is a noise angle field, and whose scale is a noise amplitude
  field. A clean parameter object would be
  `{count, image[], patchCount, patchScale, warpAmp, angleDetail, sizeDetail,
  colorDetail, palette, alphaRange, anisotropy}`.
- One-off art decisions: the specific 7-colour warm/cool palette, the 4 brush
  PNGs, the 20% canvas overhang, the 500 px warp amplitude, and the
  `pow(v%1, 0.6)` colour easing.
- `getColor(float)` is a self-contained palette-lerp worth extracting on its
  own; `loadForms()`/`forms` should be dropped (dead code).
