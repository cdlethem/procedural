---
sketch: 2019/generativos/fibra
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1742
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [line]
palette:
  colors: ["#F8AE23", "#FF5721", "#161B55", "#015D87", "#EF67B4"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: strands, default: 8, tried: [4], change: moderate, effect: "half as many bundles; each bundle is denser and thicker"}
  - {name: strokesPerStrand, default: "random(60,200)*18", tried: ["random(20,60)*18"], change: moderate, effect: "sparser, thinner hair-like bundles"}
  - {name: amp, default: "random(0.4)", tried: ["random(1.5)"], change: moderate, effect: "fork splay widens to near-90deg; feathery, fan-like strokes"}
  - {name: alpha, default: 80, tried: [220], change: moderate, effect: "much more opaque; saturated orange mass with dark maroon overlaps"}
  - {name: distScale, default: 60, tried: [200], change: moderate, effect: "bundles break apart into large chaotic radial fans"}
  - {name: strokeScale, default: 250, tried: [100], change: moderate, effect: "shorter bristlier strokes; narrower bundles with visible central spine"}
reusable_candidates:
  - {name: fbm2, signature: "fbm2(x, y, octaves) -> float", note: "4-octave value-noise FBM built on a hash (fbm.pde)"}
  - {name: fbmDisplace, signature: "fbmDisplace(x, y, angDetail, angScale, distDetail, distScale) -> PVector", note: "dis(): fbm-driven angle + magnitude displacement field (fibra.pde:105)"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "getColor(): sqrt-eased lerp between adjacent palette entries (fibra.pde:132)"}
---

## What it draws
Eight diagonal bundles of thread-like strands run from the top edge to the bottom edge of a light
off-white canvas, crossing and braiding over each other. Each bundle is hundreds of short,
semi-transparent strokes, dominated by warm orange/amber with dense patches of teal-blue,
magenta-pink and dark indigo, giving a woven fibrous texture. A few sparse thick lines (a dark
line and a grey band near the top right) sit under the strands.

## How the code works
`setup()` calls `generate()` once (fibra.pde:23); `draw()` is empty (fibra.pde:31), so the image is
static. `generate()` (fibra.pde:57):

- `background(230)` light grey (line 67).
- Loop of 8 strands (line 68): each picks a random top x (line 69) and bottom x (line 71), and draws
  one thick background line `strokeWeight(random(4))` in a random palette colour `rcol()` (lines
  76-78) — the few thick sparse lines visible in the image.
- Each strand then draws `sub = random(60,200)*18` ≈ 1080–3600 short strokes (line 80). For each
  `j`, the point is lerped along the strand (lines 90-92), displaced by `dis()` (line 95), then two
  lines are drawn from it at angles `ang±amp` (lines 97-98) — the forked, hatched strokes.
- `dis()` (lines 105-109): angle = `fbm(...)*PI*6`, magnitude = `fbm(...)*60`, so the straight
  strand is bent into the weaving curves by the FBM noise field.
- Stroke length `ss = cos(v*j*0.2+xx*0.2)*250` (line 93) oscillates along each strand, producing the
  thick/thin variation.
- Colour: `getColor(noise(ic+dc*j)*colors.length*4)` (line 94) — noise sampled along the strand
  walks the 5-colour palette (line 121), lerped between adjacent entries with a sqrt ease
  (line 137), at alpha 80 (line 94).
- Randomness: the global seed (line 4, set by the harness) plus per-strand randoms for endpoints,
  angles, `amp` (line 86) and the thick-line colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| strands_4 | `for(int i = 0; i < 8; i++){` -> `for(int i = 0; i < 4; i++){` | moderate | half as many bundles; bundles are denser and thicker, the thick seed lines stand out more | variants/strands_4/frame_00001.png |
| sub_1080 | `int sub = int(random(60, 200))*18;` -> `int sub = int(random(20, 60))*18;` | moderate | sparser, thinner hair-like bundles; the strand's central line and a wide fan of strokes become individually legible | variants/sub_1080/frame_00001.png |
| amp_1.5 | `float amp = random(0.4);` -> `float amp = random(1.5);` | moderate | forked strokes splay out to nearly 90deg; the bundles read as wide feathery fans instead of tight threads | variants/amp_1.5/frame_00001.png |
| alpha_220 | `stroke(getColor(noise(ic+dc*j)*colors.length*4), 80);` -> `... , 220);` | moderate | much more opaque: a heavy saturated orange mass with dark maroon where strands overlap; the woven weave is lost to solid blocks | variants/alpha_220/frame_00001.png |
| dist_200 | `float des = fbm(desDes+xx*detDes, seed+desDes+yy*detDes)*60;` -> `...*200;` | moderate | displacement 3x larger: bundles break apart into large chaotic radial fans sweeping across most of the canvas | variants/dist_200/frame_00001.png |
| ss_100 | `float ss = cos(v*j*0.2+xx*0.2)*250;` -> `...*100;` | moderate | strokes ~2.5x shorter: bristlier, more compact bundles; the straight central spine and zigzag oscillation are clearly visible | variants/ss_100/frame_00001.png |

## Modularisation notes
- `fbm.pde` is a self-contained noise utility (hash `random2`, bilinear `noise2`, `fbm`,
  `ridgedMF`): generic, directly reusable as `fbm2`/`ridgedMF`.
- `dis()` is a generic fbm displacement field — the core reusable primitive (angle and magnitude
  from independent fbm samples).
- `getColor(float)` is a generic palette-lerp with sqrt easing.
- One-off art decisions: the specific palette, background 230, the 8 strands, the thick seed lines,
  the `cos(v*j*0.2+xx*0.2)*250` stroke-length oscillation, and the forked double-line per point.
- A clean parameter object: `{strands: 8, strokesPerStrand: [1080, 3600], forkAngle: 0.4,
  strokeScale: 250, angScale: PI*6, distScale: 60, alpha: 80, palette: [5 colors]}`.
