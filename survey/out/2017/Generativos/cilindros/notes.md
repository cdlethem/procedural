---
sketch: 2017/Generativos/cilindros
year: 2017
renderer: P3D
size: [920, 920]
libraries: []
deterministic: true
ms_first_frame: 1748
animated: false
techniques: [3d-mesh]
primitives: [shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: count, default: 20, tried: [8, 40], change: moderate, effect: "fewer = sparse scene with large black areas; more = overlapping rods filling the frame"}
  - {name: scale, default: "random(360,500)*1.6", tried: [3.0], change: large, effect: "thicker rods; ~2x diameter, foreground dominated by fat cylinders"}
  - {name: depth, default: "random(3,20)", tried: ["8,40"], change: moderate, effect: "objects pushed farther back and scattered wider; sparser, smaller, more black space"}
  - {name: mw/mf, default: "random(-0.1,0.1)*...", tried: [0], change: moderate, effect: "zeroing removes the colour bands along the length; each rod reads as a single colour"}
  - {name: colors, default: "6-colour coolors.co set", tried: ["blue ramp"], change: moderate, effect: "same composition recoloured; only the palette's hue range changes the look"}
reusable_candidates:
  - {name: waveShape, signature: "waveShape(wave, freq) -> float", note: "cycles through 4 blends of sine/square/triangle/sawtooth, mixing by wave%1"}
  - {name: cylinderMesh, signature: "cylinderMesh(radius, height, resAround, resAlong, colorFn) -> mesh", note: "parametric cylinder of quads with a per-quad colour function plus two end caps"}
  - {name: getColor, signature: "getColor(palette, v) -> Color", note: "wraps v into the palette and lerps between adjacent entries by v%1"}
---

## What it draws
About twenty 3-D cylinders floating in space on a black background, in random
orientations. A few large rods fill the foreground (one fat coral-to-blue one
dominates the lower centre); most are thinner sticks receding into the distance,
some reduced to small slivers at the top. Colours are muted pastels and
corals: red, pale blue-grey, pink-lilac, peach, and touches of pale gold. Some
cylinders show banded colour transitions along their length (e.g. yellow-to-red
stripes on a stick in the upper left), others read as near-solid. Flat elliptical
end caps and soft shading from scene lights confirm true 3-D volume.

## How the code works
- `setup()` (lines 3-8): `size(920, 920, P3D)`, `smooth(8)`, `pixelDensity(2)`,
  then one call to `generate()`. `draw()` (lines 10-17) is empty — the
  regenerate-per-frame line is commented out (line 11) — so the image is static.
- `generate()` (lines 29-55): black background; perspective camera with
  `fov = PI/2.5` and `cameraZ` derived from the height (lines 32-35); camera
  centred and pushed back with `translate(width/2, height/2, -400)` (line 37);
  `lights()` (line 38). Loop of 20 (line 39): per-cylinder depth
  `rd = random(3, 20)` (line 40); x/y position scaled by
  `width/height * random(-1,1) * rd * random(0.4, 1.2)` so farther cylinders
  also scatter farther sideways (lines 41-42); `z = -width*rd` pushes them
  back (lines 43, 47); diameter `s = random(360, 500)*1.6` (line 44); three
  full random rotations X/Y/Z (lines 48-50); a base fill from the palette
  (line 51); then `cilindro(s, s*8)` — a fixed 8:1 length-to-diameter ratio
  (line 52).
- `cilindro(d, h)` (lines 57-101): builds the mesh manually: 128 segments
  around (`res1`, line 59), 32 along the height (`res2`, line 60). Each of the
  res1*res2 quads gets a fill from
  `getColor(waveShape(wave+mw*j, freq+mf*j)*colors.length+4)` (lines 74-81):
  the random per-cylinder `wave`/`freq` (lines 62-63) pick a point in the
  wave palette, and `mw`/`mf` (lines 64-65, typically very small) drift it
  along the length — producing the banded stripes when non-zero. Two end caps
  are closed polygons with a single colour each (lines 87-100).
- `waveShape(wave, freq)` (lines 103-130): `int(wave%4)` selects one of four
  pairs (sine->square, square->triangle, triangle->sawtooth, sawtooth->sine)
  and `lerp`s between the two by `wave%1`; negative freq is mirrored
  (line 104).
- `getColor(v)` (lines 138-144): `v % 6` wraps into the 6-colour palette
  (line 133, a coolors.co set) and `lerpColor`s between the entry and its
  neighbour by `v%1` — so colour selection is a smooth wrap around the palette.
- Randomness enters once, during the single `generate()` pass: positions,
  sizes, rotations, and per-cylinder wave parameters. The global
  `int seed = int(random(999999))` (line 1) is the field the harness pins to
  the chosen seed, making runs deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_40 | `for (int i = 0; i < 20; i++) {` -> `i < 40` | moderate | denser scene: overlapping rods in every corner, black reduced to small gaps | variants/count_40/frame_00001.png |
| count_8 | `for (int i = 0; i < 20; i++) {` -> `i < 8` | moderate | sparse: ~7 visible cylinders, large black areas | variants/count_8/frame_00001.png |
| scale_3.0 | `float s = random(360, 500)*1.6;` -> `*3.0;` | large | cylinders roughly twice as thick; a fat pink/red rod and wide blue ones dominate the frame | variants/scale_3.0/frame_00001.png |
| depth_8_40 | `float rd = random(3, 20);` -> `random(8, 40);` | moderate | scene recedes: smaller, more widely scattered rods, mostly black foreground | variants/depth_8_40/frame_00001.png |
| banding_0 | `float mw = random(...)` and `float mf = random(...)` -> `0` (2 subs, one logical param) | moderate | banded colour transitions along rods disappear; each rod is a single colour with flat end caps | variants/banding_0/frame_00001.png |
| palette_blue | 6-colour palette line -> 6-colour navy-to-periwinkle ramp | moderate | identical composition recoloured: all cylinders now blues, near-black navy to pale periwinkle | variants/palette_blue/frame_00001.png |

## Modularisation notes
- `cilindro()` is a self-contained parametric-cylinder builder (radius, height,
  ring/stack resolution, per-quad colour function) — a clean library candidate,
  though the per-quad `fill()` mid-`beginShape` trick is Processing-specific
  and would become a per-quad colour array elsewhere.
- `waveShape()` is a generic 1-D wave-palette (sine/square/triangle/sawtooth
  crossfades indexed by an unbounded parameter) — reusable for any colour or
  displacement field.
- `getColor()` (wrap + lerp between adjacent palette entries) is the generic
  "cyclic palette sampler".
- One-off art decisions: the 8:1 cylinder aspect ratio (line 52), the 3-20
  depth range with lateral spread proportional to depth (lines 40-43), the
  `z=-400` camera push (line 37), and the specific 6-colour palette (line 133).
- A clean parameter object: `{count, sizeRange, aspectRatio, depthRange,
  cameraZ, palette, waveDrift (mw/mf scale), resolution (res1, res2)}`.
