---
sketch: 2020/generative/01_04/humus
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: false
ms_first_frame: 1904
animated: false
techniques: [particles, noise-field, image-source]
primitives: [point]
palette:
  colors: ["#A1A7F4", "#EA77BA", "#EA0071", "#F70D04", "#301156"]
  selection: image-sampled
composition: centered
parameters:
  - {name: cc, default: 800000, tried: [200000], change: moderate, effect: "4x fewer points: sparse star-field, colours only faintly readable"}
  - {name: detCol, default: "random(0.01)", tried: [0.02], change: moderate, effect: "higher noise scale: smaller, finer colour patches; large coherent regions break up into mottling"}
  - {name: addProb, default: 0.1, tried: [0.5], change: subtle, effect: "no visible change (within the non-determinism rotation noise floor)"}
  - {name: strokeWeight, default: "random(1.2)", tried: [2.4], change: large, effect: "2x weight: brighter, denser, more saturated colour regions; disc reads as a solid wash"}
  - {name: radius, default: "width*0.6", tried: ["width*0.4"], change: moderate, effect: "smaller disc; dark margin visible at the top, same colour layout inside"}
  - {name: background, default: 20, tried: [255], change: large, effect: "white background: dots read as a dark dense disc on white; ADD points brighten towards white"}
reusable_candidates:
  - {name: discPointCloud, signature: "discPointCloud(count, radius, zCone) -> points in polar", note: "sqrt-uniform radius gives an evenly-filled disc with soft edge"}
  - {name: noiseWarpImageSampler, signature: "noiseWarpImageSampler(img, a, b, noiseScale) -> PColor", note: "sample a PImage at a point lerped between two random anchors by 2-D noise; photo colours remapped through a noise field"}
  - {name: stochasticBlend, signature: "stochasticBlend(probAdd)", note: "per-point random choice of ADD vs NORMAL blend for glints"}
---

## What it draws
A large centred disc of extremely dense, sub-pixel dots on a near-black background.
The dots form soft, photo-like colour regions: warm amber/orange in the upper right,
dusty mauve-grey across the middle, olive-green and muted purple in the lower left,
with a few brighter speckles. The overall look is a grainy, smudged photograph
reconstructed from ~800,000 tiny points.

## How the code works
- `setup()` loads `colors2.jpg` and calls `generate()` (humus.pde:28-29); `draw()` is
  empty, so the piece is static (humus.pde:39-41).
- `generate()` reseeds `randomSeed`/`noiseSeed` from the global `seed` (lines 69-70),
  fills with `background(20)` dark grey (line 72), moves to centre and applies a small
  random `rotateX`/`rotateY` tilt (lines 74-76).
- Two random image points `(ix,iy)` and `(fx,fy)` at least half the image width apart
  are chosen (lines 78-83); `detCol = random(0.01)` is the noise scale of the colour
  field (line 84).
- The main loop (lines 88-107) draws `cc = 800000` points as `POINTS` shape batches.
  Per point: angle `a = random(TAU) + time*0.01` (line 94), radius
  `d = sqrt(random(1))*width*0.6*random(0.5,1)` — sqrt-uniform so the disc is evenly
  filled with a soft outer edge (line 95); converted to cartesian (lines 99-100) and
  given depth `z = d*0.2`, a shallow cone (line 105).
- 10% of points switch to `blendMode(ADD)` (lines 101-102), producing the brighter
  glints; all points have `strokeWeight(random(1.2))`, i.e. sub-pixel (line 103).
- Colour: `getColor(x, y, detCol)` (lines 147-150) evaluates `noise(x*detCol,
  y*detCol)` and uses it to lerp between the two random image anchors, sampling a
  pixel from the JPEG. So the photo's colour regions are remapped through a 2-D noise
  field — this is what produces the organic amber/mauve/green blobs. The `colors[]`
  array (line 126) and the other `getColor` overloads are dead code, not used by this
  render path.
- Non-determinism: `time = millis()*0.001` (line 63) adds `time*0.01` to every point's
  angle, so each run is the same point set globally rotated by a few degrees. Baseline
  reports `deterministic: false`; variant diffs therefore contain a small rotation
  noise floor and only large differences are meaningful.

## Experiments
| variant | substitution | change score | observation | image |
| cc_200000 | `int cc = 800000;` -> `int cc = 200000;` | moderate | sparse, faint star-field of dots on near-black; colour regions only just readable | variants/cc_200000/frame_00001.png |
| detCol_0.02 | `float detCol = random(0.01);` -> `float detCol = 0.02;` | moderate | finer, busier texture: small orange/mauve/green mottled patches instead of large smooth regions | variants/detCol_0.02/frame_00001.png |
| addProb_0.5 | `if (random(1) < 0.1) blendMode(ADD);` -> `... < 0.5 ...` | subtle | no visible change vs baseline (score within the rotation noise floor of the non-deterministic sketch) | variants/addProb_0.5/frame_00001.png |
| strokeWeight_2.4 | `strokeWeight(random(1.2));` -> `strokeWeight(random(2.4));` | large | much brighter and denser; big saturated orange and mauve regions, green contour lines, disc nearly solid | variants/strokeWeight_2.4/frame_00001.png |
| radius_0.4 | `float d = sqrt(random(1))*width*0.6*random(0.5, 1);` -> `... *width*0.4* ...` | moderate | smaller centred disc with a visible dark margin at top; interior colour layout unchanged | variants/radius_0.4/frame_00001.png |
| background_255 | `background(20);` -> `background(255);` | large | white background; the dot cloud now reads as a dark dense disc on white with the same amber/mauve/green zones | variants/background_255/frame_00001.png |

## Modularisation notes
- Generic: `discPointCloud` (polar sampling with sqrt-uniform radius),
  `noiseWarpImageSampler` (PImage colour field warped by 2-D noise between two
  random anchors), `stochasticBlend` (per-point ADD/NORMAL probability).
- One-off art decisions: the specific photo `colors2.jpg`, the dark `background(20)`,
  the `width*0.6` disc radius, the small 3-D tilt, the `z = d*0.2` cone, and the
  800k point count (a density/quality decision).
- A clean parameter object would contain: `pointCount`, `radiusMultiplier`,
  `noiseScale` (detCol), `addProbability`, `strokeWeightRange`, `background`,
  `tiltRange`, `zCone`, `photoPath`.
