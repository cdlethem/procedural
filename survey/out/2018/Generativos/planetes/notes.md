---
sketch: 2018/Generativos/planetes
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1557
animated: false
techniques: [packing, polar, 3d-mesh]
primitives: [ellipse]
palette:
  colors: ["#000000", "#FFFFFF", "#807DDB", "#ED829D", "#E8D84E", "#F23E35", "#4B13C4", "#6D915F"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: attempts, default: 1800, tried: [5000], change: moderate, effect: "more rejection attempts fill gaps with extra small/mid spheres; dominant spheres unchanged (same seed)"}
  - {name: maxSize, default: 0.8, tried: [0.3], change: moderate, effect: "caps diameter at ~288 px; giant sphere disappears, field becomes uniform small/mid balls"}
  - {name: ringStep, default: 4, tried: [8], change: moderate, effect: "rings 2x further apart; spheres read as sparse concentric-line stacks with visible gaps"}
  - {name: bgTint, default: 0.2, tried: [0.6], change: large, effect: "background shifts from pale pink to saturated coral/salmon; sphere layout unchanged"}
  - {name: overlapFactor, default: 1.0, tried: [0.8], change: moderate, effect: "spheres may overlap (clusters in upper left); overall layout shifts since rejection decisions change"}
  - {name: strokeWeight, default: 1, tried: [3], change: subtle, effect: "subtle: ring lines visibly thicker, small spheres read as bolder stripes, composition unchanged"}
reusable_candidates:
  - {name: poissonPack3D, signature: "poissonPack3D(boxSize, maxAttempts, sizeFn, overlap) -> Sphere[]", note: "rejection-sampled non-overlapping spheres in a 3-D box (collide() at line 32)"}
  - {name: latheSphere, signature: "latheSphere(radius, step, colorFn) -> void", note: "sine-profile stack of rotated ellipses approximating a wireframe sphere (lines 81-86)"}
---

## What it draws
A pale pink full-bleed field scattered with dozens of "wireframe planets" of very different
sizes, from tiny dots to one huge sphere dominating the right half. Each planet is a stack of
thin concentric elliptical outlines in random bright colors (purple, red, yellow, pink, black,
white, olive), randomly oriented in 3-D so some read as near-circular rings and others as
elongated striped discs. The packing is non-overlapping: planets cluster loosely and leave
large empty pink gaps.

## How the code works
`setup()` calls `generate()` once; `draw()` (planetes.pde:11-13) calls it every frame but
`generate()` re-seeds with the fixed `seed` (line 42), so every frame is identical — the scene
is static. `generate()` (lines 38-91):
1. Background: `lerpColor(color(240), rcol(), 0.2)` (line 44) — near-white grey blended 20%
   toward a random palette color, giving the pale pink tint (seed 42 draws a pinkish one).
2. Packing: up to 1800 attempts (line 48). Each candidate sphere gets a random position in a
   cube `width*random(-1,1)` on all axes (lines 49-51) and a random diameter
   `width*random(0.8)*random(0.5,1)` (line 52, up to ~768 px). It is accepted only if
   `collide()` (line 32) finds no existing sphere within `(s+other.s)*1` — a 3-D
   Poisson-disk-style rejection pack; most attempts are rejected, so density is limited.
3. Drawing: for each accepted sphere (lines 68-88) a `pushMatrix()` translates it into the 3-D
   cube, applies three random full rotations (lines 73-75), then builds the body as a lathe:
   a loop `j = 0..ss step 4` (lines 81-86) draws an `ellipse` of diameter
   `ss*sin(map(j,0,ss,0,PI))` — a sine profile that bulges to the full radius mid-stack and
   tapers to zero at both ends — advancing 4 px along local z per ring. Each ring's stroke is
   a fresh `rcol()` pick from the 8-color `colors[]` array (line 118), which is why every
   sphere is a multicolored striped ball. No fills, no stroke weight change (P3D default 1).
   The cube is not re-centered (the `translate(width*0.5, height*0.5)` at line 66 is
   commented out), so the whole packing sits offset, explaining the big empty corners.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_5000 | `  for (int i = 0; i < 1800; i++) {` -> `  for (int i = 0; i < 5000; i++) {` | moderate | denser field: gaps fill with extra small/mid striped balls; the same giant sphere and main layout survive (same seed) | variants/count_5000/frame_00001.png |
| maxsize_0.3 | `    float s = width*random(0.8)*random(0.5, 1);` -> `    float s = width*random(0.3)*random(0.5, 1);` | moderate | giant sphere gone; uniform field of small/mid balls, largest ~230 px, more even coverage | variants/maxsize_0.3/frame_00001.png |
| step_8 | `    int step = 4;` -> `    int step = 8;` | moderate | rings twice as far apart: spheres read as sparse concentric-line stacks with clear gaps between rings | variants/step_8/frame_00001.png |
| bglerp_0.6 | `  background(lerpColor(color(240), rcol(), 0.2));` -> `  background(lerpColor(color(240), rcol(), 0.6));` | large | background turns saturated coral/salmon pink; sphere layout identical to baseline | variants/bglerp_0.6/frame_00001.png |
| collide_0.8 | `    return (dist < (s+other.s)*1);` -> `    return (dist < (s+other.s)*0.8);` | moderate | spheres may overlap (big overlapping cluster upper left); overall layout shifts because acceptance decisions change | variants/collide_0.8/frame_00001.png |
| strokeWeight_3 | `    noFill();` -> `    noFill();\n    strokeWeight(3);` | subtle | subtle: ring lines visibly thicker, small spheres read as bolder stripes; composition unchanged | variants/strokeWeight_3/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy**: the 3-D rejection pack (`Sphere` + `collide()` + the attempt
  loop, lines 23-63) is a clean `poissonPack3D(box, attempts, sizeFn, overlap)`; the lathe
  wireframe sphere (lines 71-87) is a clean `latheSphere(radius, ringStep, colorFn)`; `rcol()`
  is a standard random-palette sampler.
- **One-off art decisions**: the 8-color palette, the 20% background tint, the sine radius
  profile, the ring step of 4, the un-centered 3-D cube, and the per-ring (rather than
  per-sphere) color re-pick, which is what makes the stripes.
- **Clean parameter object**: `{ boxHalfSize, attempts, sizeRange, overlapFactor, ringStep,
  bgTint, palette, strokeWeight }`.
