---
sketch: 2018/Generativos/firezone
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2183
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [line]
palette:
  colors: ["#F6C9CC", "#119489", "#7AC3AB", "#F47AD4", "#6AC8EC", "#5BD5D4", "#1E4C5B", "#CF350A", "#F5A71C"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: line_count, default: 2200, tried: [600], change: large, effect: "much sparser; background shows through, individual strands and dashes become distinct"}
  - {name: size, default: 520, tried: [350], change: large, effect: "smaller cube packs lines denser; canvas corners (lower-right) go empty"}
  - {name: detAng_scale, default: "random(0.002,0.01)*0.5", tried: ["*3.0"], change: large, effect: "finer, tighter coil-like thread texture throughout"}
  - {name: strokeWeight_scale, default: "v*12", tried: ["v*30"], change: moderate, effect: "thick ribbon-like strokes; canvas more fully covered"}
  - {name: continuous_prob, default: 0.4, tried: [0.05], change: subtle, effect: "no visible change to overall structure; slightly more dashed/speckled texture"}
reusable_candidates:
  - {name: noiseDisplace3D, signature: "noiseDisplace3D(p, offset, detail, angleScale, amplitude) -> PVector", note: "displace a 3-D point with two simplex-noise angles and a noise amplitude (desform)"}
  - {name: paletteNoiseColor, signature: "paletteNoiseColor(v, colors) -> color", note: "map |v| mod 1 to a lerpColor between adjacent palette entries (getColor)"}
---

## What it draws
A full-bleed tangle of thousands of semi-transparent, wavy, tapering lines on a pale
lavender-white ground. A dense rust/orange mass dominates the lower-left quadrant,
teal/cyan and dark slate lines fill the centre and right, and a pink/magenta patch
sits in the upper right. Many lines are smooth wiggly strands; many are broken into
short tick-like dashed segments. Lines thicken and darken from one end to the other.

## How the code works
`setup()` (firezone.pde:6) calls `generate()` once; `draw()` (line 13) is empty, so the
sketch is static. `generate()` (line 24) seeds RNG/noise (26-27), paints the pale
background (28), then draws random 3-D rotations after translating to centre (39-42) —
the whole composition is a rotated 3-D cloud projected by P3D.

- Lines 32-35 pick random offsets (`desAng`, `desDes`) and noise scales (`detAng`,
  `detDes`); `noiseDetail(1)` (line 37) keeps the noise coarse.
- The main loop (47-48) issues 2200 calls to `lline()` with two random endpoints in a
  ±520 cube (line 44 `size`).
- `lline()` (54-68): `res = dist*2` points along the segment (55); with 40% probability
  it is one continuous shape, otherwise `beginShape(LINES)` pairs vertices into short
  segments — that is the dashed/tick look (56-57). Each point is lerped along the
  segment (60), displaced by `desform()` (61), coloured by 3-D simplex noise at the
  displaced point (62) → `getColor()` maps it through the 9-colour palette with
  `lerpColor` between adjacent entries (98-105). Alpha is `pow(v,1.4)*240` (63) and
  weight `v*12` (64), so every line is faint/thin at one end and bold at the other.
- `desform()` (70-75) is the distortion: two noise-driven angles (×TAU*5) and a
  noise-driven amplitude (×30) offset each point, turning straight segments into
  wiggly curled strands.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_600 | `for(int i = 0; i < 2200; i++){` -> `for(int i = 0; i < 600; i++){` | large (mean 0.1514, 0.567) | much sparser tangle; pale background shows through everywhere; same colour regions (orange lower-left, teal centre-right) but individual wiggly strands and dashes clearly separable | variants/count_600/frame_00001.png |
| size_350 | `float size = 520;` -> `float size = 350;` | large (mean 0.1854, 0.717) | lines packed into a smaller volume: denser, more interwoven tangle; orange/teal/pink regions compressed; canvas corners (esp. lower-right) left empty | variants/size_350/frame_00001.png |
| detAng_3.0 | `detAng = random(0.002, 0.01)*0.5;` -> `... *3.0;` | large (mean 0.1943, 0.785) | much finer, tighter coil-like thread texture; smooth bold strands become fine stitching; pink speckle appears lower-right | variants/detAng_3.0/frame_00001.png |
| weight_30 | `strokeWeight(v*12);` -> `strokeWeight(v*30);` | moderate (mean 0.1195, 0.485) | thick ribbon-like strokes; orange mass becomes near-solid ribbons, teal bands wider; far fewer background gaps | variants/weight_30/frame_00001.png |
| linemix_0.05 | `if(random(1) < 0.4) beginShape();` -> `if(random(1) < 0.05) beginShape();` | subtle (mean 0.0458, 0.146) | no visible change to overall structure or colour regions; texture slightly more dashed/speckled (fewer continuous strands) | variants/linemix_0.05/frame_00001.png |

## Modularisation notes
- Generic: `desform` (noise-displacement field, parameterised by offset/scale/angle
  scale/amplitude), `getColor` (palette lerp by scalar), and the tapered-stroke loop in
  `lline` (length, resolution, alpha curve `pow(v,1.4)`, weight scale, continuous-vs
  LINES mix probability).
- One-off art decisions: the 9-colour palette, the specific noise-scale multipliers
  (0.5/0.7, ×TAU*5, ×30), the ±520 cube, the 2200 count, the 3 random 3-D rotations.
- A clean parameter object: {count, boxSize, noiseDetail, distScale, distAmplitude,
  angleScale, alphaCurve, alphaMax, weightMax, dashedProbability, palette, rotations}.
