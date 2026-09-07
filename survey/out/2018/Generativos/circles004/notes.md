---
sketch: 2018/Generativos/circles004
year: 2018
renderer: P3D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 3087
animated: false
techniques: [noise-field, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#191F5A", "#5252C1", "#9455F9", "#FFA1FB", "#FFFFFF", "#51C3C4", "#EE4764", "#E472E8", "#FFB452"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: det, default: "random(0.01)", tried: [0.05], change: none, effect: "no visible change; stipple dots are <=~6.5px so noise scale is imperceptible"}
  - {name: stippleCount, default: 1000000, tried: [200000], change: large, effect: "grain visibly sparser AND whole circle layout shifts (loop consumes fewer random() calls)"}
  - {name: cccc, default: "int(random(80, random(120, 200))*0.6) (48-120)", tried: ["*2.0 (160-400)"], change: large, effect: "much denser, heavily overlapping circle coverage"}
  - {name: sizeExp, default: "random(1)^3", tried: ["random(1)"], change: large, effect: "circles much larger, canvas nearly covered; downstream layout also shifts"}
  - {name: stippleAlpha, default: 80, tried: [200], change: subtle, effect: "grain slightly darker/denser; identical composition"}
  - {name: strokeWeight, default: 2, tried: [8], change: subtle, effect: "thin arc outlines thicker; nothing else changes"}
reusable_candidates:
  - {name: noiseStippleField, signature: "noiseStippleField(n, det, offset, sizeScale, alpha)", note: "n random points whose radius is 2-D noise, gives grainy ground"}
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "annular sector approximated by triangles (arc2)"}
  - {name: circleCluster, signature: "circleCluster(x, y, size, colors, nArcs)", note: "filled ellipse + inner ellipse + faint annulus + stroked arc segments"}
---

## What it draws
On a speckled off-white ground, dozens of overlapping flat circles in purple, teal,
pink, red, orange and dark navy. Many circles carry a smaller concentric circle inside
(target-like), and thin arc outlines and faint ring fragments are scattered across the
whole image. The background grain is a dense field of tiny colored dots.

## How the code works
`setup()` sizes a 3250x3250 P3D canvas, loads a noise-shadow shader (never applied),
and calls `generate()`. `generate()` fills with light gray (`background(238)`, line 31),
seeds noise and random with `seed` (lines 33-34).

- Stipple field (lines 43-49): 1,000,000 random points; each radius is
  `width*0.002*noise(des+x*det, des+y*det)` with `det = random(0.01)` (line 38),
  so noise clusters dots into the grainy texture; each dot uses `fill(rcol(), 80)`
  (line 47) - a random palette color at low alpha.
- Circle clusters (lines 52-100): `cccc = int(random(80, random(120, 200))*0.6)`
  clusters (roughly 48-120). Each cluster size is `width*random(1)^3` (line 56),
  biased toward small. It draws: a big filled ellipse `s1` (lines 58-60), a faint
  full annulus `arc2(...,30,0)` (line 63), 10 small arc2 wedges at alpha 130
  (lines 65-69), a smaller inner filled ellipse `s2 = random(s1)` (lines 72-74)
  with another faint annulus (line 77), and 2-60 stroked `arc` segments of the
  full size `s` (lines 90-99).
- `rcol()` (lines 148-150) picks a random color from the 10-color list
  (line 147); every fill/stroke picks independently, which is why circles mix
  unrelated hues.
- `arc`/`arc2` (lines 102-138) approximate arc sectors as small filled triangles
  with a two-color alpha ramp; that is why rings look dashed/fragmented.
- Randomness enters only through `randomSeed(seed)`; the run is deterministic.
  `draw()` is empty; the harness snapshot of frame 1 is the final image.
- The stipple loop consumes 2 random() calls per dot and the cluster loop consumes
  several per cluster, all from the same seeded sequence. Any substitution that
  changes how many times random() is called before a given cluster (stippleCount,
  the extra random() terms in `s`) shifts every downstream position/scale; that is
  why those variants change far more than the parameter itself.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.05 | `float det = random(0.01);` -> `float det = random(0.05);` | none | no visible change (mean 0.0084, 0.9% of pixels); composition identical since the same random calls are consumed | variants/det_0.05/frame_00001.png |
| stippleCount_200000 | `for (int i = 0; i < 1000000; i++) {` -> `for (int i = 0; i < 200000; i++) {` | large | grain visibly sparser, flat gray ground shows through in open areas; all circles in different positions (verified by region diff: 92% of pixels differ even inside circle interiors) | variants/stippleCount_200000/frame_00001.png |
| cccc_2.0 | `int cccc = int(random(80, random(120, 200))*0.6);` -> `... *2.0);` | large | ~4x more clusters: canvas densely covered with heavily overlapping circles in the same target/arc style | variants/cccc_2.0/frame_00001.png |
| sizeExp_1 | `float s = width*random(1)*random(1)*random(1);` -> `float s = width*random(1);` | large | circles much larger, covering nearly the whole canvas with little ground visible; placement also shifted (one fewer random() per cluster) | variants/sizeExp_1/frame_00001.png |
| stippleAlpha_200 | `fill(rcol(), 80);` -> `fill(rcol(), 200);` | subtle | grain slightly darker/denser in open areas; identical composition | variants/stippleAlpha_200/frame_00001.png |
| strokeWeight_8 | `strokeWeight(2);` -> `strokeWeight(8);` | subtle | thin arc outlines around circles are thicker; nothing else changes | variants/strokeWeight_8/frame_00001.png |

## Modularisation notes
- Generic: the noise stipple field (dot count, noise detail/offset, size scale,
  alpha are all parameters) and `arc2` (two-radius annular sector with alpha ramp)
  are reusable library functions.
- One-off art decisions: the `random(1)^3` size bias, the exact cluster recipe
  (big ellipse + inner ellipse + annulus + arc count), and the fixed 10-color
  list.
- A clean parameter object would hold: `stippleCount`, `noiseDetail`, `noiseOffset`,
  `stippleSizeScale`, `stippleAlpha`, `clusterCount`, `sizeBias` (exponent),
  `innerCircleProbability`, `annulusAlpha`, `arcSegmentRange`, `colors`.
