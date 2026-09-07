---
sketch: 2018/Generativos/onduwave
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1838
animated: false
techniques: [noise-field, grid, 3d-mesh, shader]
primitives: [shape]
palette:
  colors: ["#000000", "#0D0D52", "#401972", "#FF55A7", "#F59CD4", "#4CFDC6"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(60,80)*0.4 (~24-32)", tried: [60], change: moderate, effect: "more ribbons per direction; canvas fills with a dense woven grid instead of sparse threads"}
  - {name: strMax, default: 20, tried: [40], change: subtle, effect: "ribbon edges slightly thicker and more continuous; same layout"}
  - {name: zAmp, default: 12, tried: [24], change: subtle, effect: "ripples along each thread more pronounced, sharper peaks"}
  - {name: fillAlpha, default: 240, tried: [120], change: none, effect: "no visible change; per-vertex fill(getColor()) in wline() overrides the initial fill(rcol(), 240)"}
  - {name: det, default: "random(0.006,0.008)", tried: [0.02-0.03], change: subtle, effect: "finer, more broken/grainy width modulation along ribbons"}
reusable_candidates:
  - {name: wavyRibbon, signature: "wavyRibbon(x1, y1, x2, y2, waves, waveAmp, widthNoise) -> quad-strip", note: "3-D ribbon along a line: width modulated by 2-D noise, z modulated by cos() wave"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "wrap v through palette, lerp between adjacent entries"}
---

## What it draws
A full-bleed woven grid of thin, undulating ribbons running horizontally and
vertically across a flat pink background. The threads waver like hand-drawn
lines, vary in thickness along their length (some segments nearly vanish), and
are rendered in mint green, dark purple/black, pale pink and whitish tones, all
semi-transparent so crossings show overlap.

## How the code works
`setup()` (onduwave.pde:5-13) opens a 960x960 P3D window, loads a fragment
shader that dithers vertex alpha with a per-pixel hash (noiseShadowFrag.glsl:21,
`displace` uniform randomised at line 62), and calls `generate()` once;
`draw()` is empty, so the piece is static.

`generate()` (lines 26-69): background is a random palette colour (line 28,
`rcol()`); noise and random seeds are fixed from `seed` (30-31). A perspective
camera with near-random fov (35-37) and tiny random X/Y/Z rotations (40-43)
tilt the plane, which is what bends the straight grid into the wavy,
perspective-warped look. Then `cc = int(random(60,80)*0.4)` (line 53, ~24-32)
ribbons are drawn per direction: the loop at 64-68 draws one vertical and one
horizontal ribbon per iteration, spanning `size = width*2.2` (line 55) so the
grid overflows the canvas, alternating the z-phase of the wave via the `inv`
flag (line 66-67, `j%2`).

Each ribbon is built by `wline()` (lines 71-104) as a `QUAD_STRIP`: it is
subdivided into `dist*2.2` segments (line 72); the two edge vertices of each
segment are offset perpendicular to the line by `str = lerp(1, 20, noise(...)*sin(v*PI))`
(lines 76, 97) so the ribbon is pinched at both ends and its width follows a
noise field sampled at `det ~ 0.006-0.008`; `z = cos(v*c*PI)*12` (line 94)
adds the visible waviness along the length (the `amp`/`ang` parameters passed
at 66-67 are declared but unused). Colour per segment is `getColor(noise(...)*10)`
(line 98-99), which lerps between adjacent palette colours; the base fill alpha
is 240 (line 61) and the shader further dithers it per pixel. `lights()` at
line 33 is set but the shader ignores lighting (it only passes vertex colour
through with hashed alpha).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1.0 | `int cc = int(random(60, 80)*0.4)*1;` -> `... *1.0 ...;` | moderate | far denser woven grid; threads fill the canvas edge-to-edge | variants/cc_1.0/frame_00001.png |
| str_40 | `float str = lerp(1, 20, ...)` -> `lerp(1, 40, ...)` | subtle | ribbons slightly thicker/more continuous, same layout | variants/str_40/frame_00001.png |
| zamp_24 | `float z = cos(v*c*PI+...)*12;` -> `... *24;` | subtle | ripples along threads more pronounced, sharper peaks | variants/zamp_24/frame_00001.png |
| fillalpha_120 | `fill(rcol(), 240);` -> `fill(rcol(), 120);` | none | no visible change (per-vertex `fill(getColor())` overrides it) | variants/fillalpha_120/frame_00001.png |
| det_0.02 | `float det = random(0.006, 0.008)*1;` -> `random(0.02, 0.03)*1;` | subtle | finer, more broken/grainy width modulation along ribbons | variants/det_0.02/frame_00001.png |

## Modularisation notes
- Generic: `wline()` as a "noisy ribbon" primitive (line endpoints + wave
  count/amplitude + width-noise scale/lerp range -> quad strip); `getColor()`
  palette lerp; the alpha-dither fragment shader.
- One-off art decisions: the 6-colour palette, the woven horizontal+vertical
  layout with alternating z-phase, the random perspective tilt (fov + 0.002
  rotations), fill alpha 240, stroke `255, 8`.
- A clean parameter object would hold: line count `cc`, grid size factor
  (2.2x), wave count/amplitude (c, 12), width noise scale (0.006-0.008) and
  width range (1-20), colour noise scale (0.001), fill alpha, dither
  `displace`, palette.
