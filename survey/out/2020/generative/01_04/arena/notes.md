---
sketch: 2020/generative/01_04/arena
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 6381
animated: false
techniques: [noise-field, particles, distortion, dots-stippling]
primitives: [point]
palette:
  colors: ["#F4EFA1", "#E8E165", "#DC4827", "#5779A2", "#031A01"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: pointCount, default: 7200000, tried: [4500000], change: large, effect: "sparser field: ribbons break up into grainy speckle, central white core weakens"}
  - {name: radialStrength, default: 220, tried: [80], change: moderate, effect: "implosion weakens: dark mottled patches spread across canvas instead of concentrated vortex"}
  - {name: strokeAlpha, default: "random(180,240)*0.5", tried: ["random(180,240)"], change: moderate, effect: "higher contrast: dense areas saturate to pure white, dark masses deepen, less mid-grey"}
  - {name: weightScale, default: 1.2, tried: [0.3], change: large, effect: "dots thinner (0.1-0.4px): whole image much fainter, washed grey speckle, structure barely visible"}
  - {name: des2Max, default: 160, tried: [60], change: moderate, effect: "cloud masses collapse into thin bright filament/web lines on dark ground"}
reusable_candidates:
  - {name: radialImplosion, signature: "radialImplosion(x, y, cx, cy, strength) -> [x', y']", note: "displace a point away from centre proportionally to its distance (line 78-81)"}
  - {name: flowOffset, signature: "flowOffset(x, y, angScale, desScale, maxDes) -> [x', y']", note: "two-stage noise angle+distance displacement (lines 69-76)"}
---

## What it draws
A dense full-bleed stipple of tiny monochrome dots (white to grey on near-black).
The dots are organised into organic cloud-like masses with a bright, swirling
implosion toward the centre: dense white ribbons spiral into a dark central
void, while the corners and edges are a sparser grey speckle. No colour is
visible — the image is entirely grayscale despite a 5-colour palette defined
in the code.

## How the code works
Single static pass in `setup() -> generate()` (arena.pde:21-95); `draw()` is
empty, so the image never changes (frames 10/60 were dropped as blank).

- 7.2M iterations (`180000*40`, line 62); each draws one `point()` (line 92),
  plus a 2% chance of a second point (line 93).
- Position starts random in a `bb=20` inset box (lines 63-66).
- Two-stage flow displacement: a noise angle + constrained noise distance,
  first with small scale `detAng`/`detDes` (max 40 px, lines 69-72), then with
  `detAng2`/`detDes2` (max 160 px, lines 73-76).
- Radial implosion: `dd` proportional to distance from centre
  (line 78) pushes each point outward along the angle to the centre
  (lines 79-81) — this creates the swirling centre; the point is then lerped
  back toward its original position by `abs(v*2-1)` (lines 83-84), which
  biases the effect and produces the vortex arms.
- Colour: the palette array (line 104) and `getColor()` are effectively dead
  code — line 88 overwrites the chosen colour with grayscale
  `color(255-ang)`, then line 89 lerps it toward black by a random 0.58-0.68,
  so dots are dim white/grey.
- `blendMode(ADD)` (line 51) over `background(8)` (line 53) accumulates the
  ~90-120 alpha strokes (line 90) into the bright saturated white regions.
- Stroke weight varies with noise: `noise*1.2+0.5` (line 91).
- Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (lines 46-47);
  with a fixed seed the output is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_4500000 | `for (int i = 0; i < 180000*40; i++) {` -> `... 180000*25 ...` | large | same implosion structure but much sparser: white ribbons break into grainy speckle, central core weaker, overall lighter/greyer | variants/count_4500000/frame_00001.png |
| dd_80 | `float dd = dist(x, y, width*0.5, height*0.5)*220./width;` -> `*80./width;` | moderate | vortex less concentrated: dark mottled patches outlined in white spread over the whole canvas instead of a central dark void | variants/dd_80/frame_00001.png |
| alpha_2x | `stroke(col, random(180, 240)*0.5);` -> `stroke(col, random(180, 240));` | moderate | much higher contrast: dense areas saturate to pure white, large dark masses, little mid-grey | variants/alpha_2x/frame_00001.png |
| weight_thin | `strokeWeight(noise(x*detWei, y*detWei)*1.2+0.5);` -> `*0.3+0.1);` | large | dots so thin the ADD accumulation nearly vanishes: faint washed-out grey speckle, structure only barely legible | variants/weight_thin/frame_00001.png |
| des2_60 | `des = constrain((noise(x*detDes2, y*detDes2)-0.2)*3, 0, 1)*160;` -> `*60;` | moderate | cloud masses collapse into thin bright white filaments (lightning/web) on a near-black ground, high contrast | variants/des2_60/frame_00001.png |

## Modularisation notes
- Generic, reusable: the two-stage noise flow offset (lines 69-76) and the
  radial distance-displacement (lines 78-81) are both parameterisable
  point-displacement functions; the lerp-back-to-origin step (83-84) is a
  nice "vortex bias" knob.
- One-off art decisions: the exact displacement scales (40/160 px, *220./width),
  the grayscale-overrides-palette hack (line 88), the 2% double-point, and the
  ADD blend with near-black background.
- A clean parameter object would hold: pointCount, inset, flowScale1/2,
  flowMaxDes1/2, radialStrength, lerpBack, weightScale, strokeAlpha,
  background, palette + blendMode (so the dead palette could actually be used).
