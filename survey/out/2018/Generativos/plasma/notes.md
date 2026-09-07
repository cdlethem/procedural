---
sketch: 2018/Generativos/plasma
year: 2018
renderer: P3D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1519
animated: false
techniques: [packing, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: attempts, default: 100, tried: [50, 300], change: subtle, effect: "50 -> fewer, sparser spheres; 300 -> identical to baseline (packing saturates at 100 attempts, extra attempts all rejected)"}
  - {name: sizeRange, default: "width*random(0.1, 0.3)", tried: ["width*random(0.2, 0.5)"], change: large, effect: "much larger spheres; fewer fit, canvas nearly covered by a few big ones"}
  - {name: palette, default: "{#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E}", tried: ["{#687FA1, #AFE0CD, #FDECB4, #F63A49, #FE8141}"], change: moderate, effect: "same geometry, new colours (mint/teal, red, orange, pale yellow); no near-invisible black spheres"}
  - {name: overlapFactor, default: 0.5, tried: [0.25], change: moderate, effect: "spheres may approach/overlap; denser, clustered coverage with more small spheres"}
  - {name: sphereDetail, default: "default (sphere(float))", tried: [12], change: none, effect: "compile error: sphere(float,int,int) not available in this Processing build; detail not adjustable"}

## What it draws
Full-bleed black canvas with roughly two dozen scattered 3D spheres of varying size.
Each sphere is rendered as a visible latitude/longitude mesh (wireframe-like grid of quads),
coloured from a small palette of orange, red, light blue, dark blue, and near-black.
One or two near-black spheres are barely distinguishable from the background. The spheres
do not overlap; they are packed at random positions and sizes.

## How the code works
`generate()` (lines 21-52):
- Seeds `random`/`noise` with `seed` (lines 23-24), sets black background (line 26) and enables
  `lights()` (line 27) for the P3D renderer.
- Loops 100 placement attempts (line 30). Each attempt picks a random position (lines 31-32) and a
  random size `s` in `[0.1*width, 0.3*width]` (line 33).
- Rejection test (lines 34-41): the candidate is kept only if its distance to every previously
  accepted sphere is at least `(s + p.z) * 0.5` (line 37), i.e. non-overlapping circles of half the
  drawn diameter. This is the packing constraint that produces the scattered, non-overlapping look.
- Accepted spheres are stored with their size as `p.z` (line 43), filled with a random palette
  colour from `rcol()` (line 44, lines 60-62, palette at line 58), and drawn as `sphere(s*0.5)`
  (line 47) at the candidate position via `translate` (line 46).
- The visible mesh grid is the default-segment sphere geometry showing through: under P3D with
  `smooth(8)` (line 4), the seams between the sphere's quads render as a grid.
- Colour is per-sphere random from the 5-colour list; `#090D0E` is nearly black, which is why some
  spheres almost vanish into the background. The unused `getColor(float)` (lines 63-71) lerp-picks
  between adjacent palette entries but is never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_50 | `for (int i = 0; i < 100; i++) {` -> `... i < 50 ...` | subtle | ~10 scattered spheres vs ~24; same style and sizes, sparser layout | variants/count_50/frame_00001.png |
| count_300 | `for (int i = 0; i < 100; i++) {` -> `... i < 300 ...` | none | no visible change; packing already saturated at 100 attempts | variants/count_300/frame_00001.png |
| size_0.2_0.5 | `float s = width*random(0.1, 0.3);` -> `random(0.2, 0.5)` | large | far fewer, much larger spheres; a handful of big spheres nearly cover the canvas | variants/size_0.2_0.5/frame_00001.png |
| palette_alt | `int colors[] = {#FF3D20, ... #090D0E};` -> `{#687FA1, #AFE0CD, #FDECB4, #F63A49, #FE8141};` | moderate | identical layout; colours now mint/teal, red, orange, pale yellow; no near-black spheres | variants/palette_alt/frame_00001.png |
| overlap_0.25 | `(s+p.z)*0.5` -> `(s+p.z)*0.25` in rejection test | moderate | spheres cluster and overlap; denser coverage, more small spheres wedged in | variants/overlap_0.25/frame_00001.png |
| mesh_12 | `sphere(s*0.5);` -> `sphere(s*0.5, 12, 12);` | n/a | compile error: only `sphere(float)` exists in this build; skipped | - |

## Modularisation notes
- Generic: the rejection-sampled packing loop (lines 29-51) is a clean `packSpheres(attempts,
  sizeMin, sizeMax, overlapFactor)` that returns a list of (x, y, r); the drawing and colouring are
  separate concerns.
- One-off art decisions: the 5-colour palette, the `overlapFactor` of 0.5 (allows touching but not
  overlapping), the sphere radius being half of `s`, and the P3D mesh rendering.
- A clean parameter object: `{attempts, sizeMin, sizeMax, overlapFactor, palette, seed}`.
