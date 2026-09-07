---
sketch: 2018/Generativos/vomito
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1675
animated: false
techniques: [noise-field, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#92C8FA", "#0321A1", "#07AE28", "#F94D21", "#FFFFFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 100000, tried: [25000], change: large, effect: "sparser: individual dots visible, orange background shows through"}
  - {name: det, default: "random(0.006)", tried: [0.001], change: large, effect: "lower = much larger, smoother colour/size patches"}
  - {name: haloAlpha, default: 100, tried: [255], change: moderate, effect: "opaque halos: flatter, patchier, one large solid blue region"}
  - {name: haloScale, default: 4, tried: [12], change: moderate, effect: "3x bigger halos: soft bokeh, fine grain blurred into clouds"}
  - {name: sizeScale, default: "width*0.01", tried: ["width*0.02"], change: moderate, effect: "coarser grain: bigger dots and halos, still dense"}
reusable_candidates:
  - {name: lerpPaletteColor, signature: "lerpPaletteColor(float v, int[] colors) -> color", note: "abs(v) mod palette length, lerp between adjacent palette entries"}
  - {name: noiseDotField, signature: "noiseDotField(count, sizeScale, detail, offset) -> void", note: "random 3-D points, size and halo colour modulated by 3-D Perlin noise, two ellipses per point (translucent noise-coloured halo + small solid random-coloured dot)"}
---

## What it draws
A full-bleed stipple of ~100,000 tiny dots that reads as a soft, grainy
texture. Dominant colours are light blue and white, with patches of deep
blue and green, and scattered orange-red flecks; the colour patches are
irregular and blotchy, following large smooth noise blobs rather than a
grid. The flat background (a random palette colour — orange #F94D21 for
seed 42) is completely hidden under the dense halos, which composite into
the pale blue-white tone.

## How the code works
`setup()` (line 3) opens a 960x960 P3D canvas and calls `generate()` once
(`draw()` at line 10 is empty, so the image is static; frames 10 and 60 are
identical to frame 1). `generate()` (line 22) reseeds with the (harness-
injected) `seed` (line 24) and paints the background with one random palette
colour via `rcol()` (line 26) — orange (#F94D21) for seed 42, invisible in
the dense baseline.

The main loop (lines 31-40) runs 100,000 times. Each iteration picks random
x, y, z in `[0, width)` (line 32-34) — z is used only as a noise coordinate,
never drawn. Size `s` (line 35) is `random(width*0.01)` scaled by 3-D Perlin
noise at `(des + x*det, des + y*det, des + z*det)`, so dot size swells and
thins in smooth noise-driven patches. Two ellipses are drawn at the same
point:
- a large translucent halo, diameter `s*4` (line 37), filled with
  `getColor(noise(...)*12.2)` at alpha 100 (line 36). `getColor(float)`
  (lines 56-63) takes the noise value, mods it by the palette length, and
  lerps between two adjacent palette entries — this is what creates the
  smooth blue/green/white colour blobs.
- a small solid dot, diameter `s` (line 39), filled with `rcol()`
  (lines 50-52), a uniformly random palette colour — this gives the crisp
  speckle of orange, green, dark blue over the halos.

`des = random(1000)` and `det = random(0.006)` (lines 29-30) randomise the
noise offset and detail. Randomness enters through the per-point x, y, z,
the per-dot `rcol()` choice, and the initial `des`/`det`. No blend modes;
the layering effect comes purely from drawing the translucent halos and
solid dots in the same random order.

## Experiments
| variant | substitution | change score | observation | image |
| count_25000 | `for (int i = 0; i < 100000; i++)` -> `for (int i = 0; i < 25000; i++)` | large | sparse confetti: each dot's halo+core clearly readable, flat orange background visible across the canvas, noise-driven density patches still there | variants/count_25000/frame_00001.png |
| det_0.001 | `float det = random(0.006);` -> `float det = random(0.001);` | large | much bigger, smoother colour/size patches: broad pale region, wide orange background band, corner green/blue patches; baseline grain lost | variants/det_0.001/frame_00001.png |
| alpha_255 | `fill(getColor(noise(des+x*det, des+y*det, des+z+det)*12.2), 100);` -> `..., 255);` | moderate | opaque halos: flatter look, large solid deep-blue region lower-left, pale speckle elsewhere; soft overlap gone | variants/alpha_255/frame_00001.png |
| halo_12 | `ellipse(x, y, s*4, s*4);` -> `ellipse(x, y, s*12, s*12);` | moderate | big soft translucent circles (bokeh) dominate; dot grain blurred into cloudy colour fields, tiny bright cores remain | variants/halo_12/frame_00001.png |
| size_0.02 | `float s = random(width*0.01)*noise(...)` -> `random(width*0.02)*noise(...)` | moderate | coarser grain: dots and halos ~2x, still dense and pale like baseline, slightly more mottled | variants/size_0.02/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `lerpPaletteColor` (noise-driven adjacent-entry
  palette lerp) and the overall "noise-modulated two-layer dot field"
  pattern (translucent noise-coloured halo + solid random-coloured core).
  A clean parameter object would be `{count, sizeScale (width fraction),
  detail, noiseOffset, haloScale, haloAlpha, palette}`.
- One-off art decisions: the 5-colour palette (line 49), the fixed
  100,000 count, the `*12.2` colour-frequency multiplier, and the
  background-colour-from-palette trick (line 26).
- The 3-D random z coordinate is a cheap way to decorrelate size and
  colour patches; worth keeping as an option (`useZNoise: bool`).
