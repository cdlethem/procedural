---
sketch: 2019/generativos/margaritas
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1797
animated: true
techniques: [voronoi-delaunay, 3d-pointcloud, polar, packing]
primitives: [ellipse, shape]
palette:
  colors: ["#1279F6", "#8BD5F4", "#FF9600", "#F5C019", "#FFFFFF", "#0A8C14", "#EB4313", "#E9CA54", "#684C61", "#749AB2"]
  selection: fixed
composition: scattered
parameters:
  - {name: sub, default: 20, tried: [40], change: moderate, effect: "petals per flower (daisy rosette density); higher = fuller, finer rosettes"}
  - {name: s, default: "random(14,28)", tried: ["random(28,56)"], change: large, effect: "per-flower size; higher = bigger, overlapping, denser field"}
  - {name: minDist, default: 40, tried: [80], change: moderate, effect: "minimum spacing between flowers; higher = sparser scatter, longer/more visible web stems"}
  - {name: webAlpha, default: 60, tried: [200], change: subtle, effect: "opacity of the Delaunay web lines; higher = marginally more visible web"}
  - {name: fov, default: "PI/3.0", tried: ["PI/5.0"], change: large, effect: "perspective field-of-view; narrower = telephoto, larger uniform flowers, flatter depth"}
  - {name: tilt, default: "random(0.15,0.3)", tried: ["random(0.0,0.05)"], change: subtle, effect: "per-flower rotateX tilt; lower = flatter, more face-on flowers"}
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(x0,y0,z0,area,attempts,minDist) -> PVector[]", note: "blue-noise/Poisson-style even scatter via min-distance rejection"}
  - {name: drawFlower, signature: "drawFlower(PVector pos, size, petalCount, coreColors, petalColor) -> void", note: "radial petal rosette + dotted lerp-color core"}
  - {name: drawTriWeb, signature: "drawTriWeb(PVector[] pts, alpha) -> void", note: "Delaunay triangulation of points drawn as a faint connected line web"}
---

## What it draws
A field of stylized daisy / margarita flowers scattered over a vertical blue gradient (deep
blue at the top fading to pale blue at the bottom). Each flower is a rosette of thin white
oval petals radiating from a fuzzy orange-yellow center made of many tiny dots. The flowers
appear at many sizes and depths — large and prominent near the bottom, small and clustered
near the top — as if viewed through a 3D perspective camera. Faint thin white lines form a
web connecting the flower centers across the whole canvas. The scene is near-static: it
regenerates the same composition every frame, so frames 1/10/60 look almost identical with
only minor per-frame pixel jitter.

## How the code works
- `settings()` (14–19): P3D 960×960 canvas, `smooth(8)`, `pixelDensity(2)`.
- `generate()` (54–217) is called from `setup()` once and from `draw()` every frame; it
  re-seeds `randomSeed`/`noiseSeed` each call (56–57), so the scene is reproducible per frame.
- **Background** (59–70): with the depth mask disabled, one `beginShape` quad filled
  `#1279F6` (top triangle) then `#8BD5F4` (bottom triangle) → the blue vertical gradient.
- **Camera** (73–80): `perspective(fov = PI/3)`, then `translate(width/2, height*0.7)` plus
  small random X/Y/Z rotations and `scale(random(1,3))`. This gives the 3D depth and pushes the
  vanishing point into the lower area, so distant flowers read small/high, near ones large/low.
- **Flower placement** (94–115): 400 random attempts in a thin 3D slab (`z` within ±`width*0.01`),
  snapped to a 10px grid, kept only if >40 units from every earlier flower → a blue-noise /
  Poisson-style even scatter (the `packing` behaviour).
- **Each flower** (117–188): size `s = random(14,28)`; translated to its position and tilted with
  `rotateX(PI*random(0.15,0.3))`.
  - Core (134–143): `s*20` tiny 5px dots at random spherical positions,
    `fill(lerpColor(#FF9600, #F5C019, cos(a1)*random(0.8)))` → the fuzzy orange-yellow center.
  - Petals (147–172): `sub = 20` (sometimes ×2–6) white ellipses (`s × s*0.4`), each rotated
    `da = TAU/sub` around the center with slight random X/Y/Z tilts → the daisy rosette.
- **Connecting web** (189–199): `noFill()`, `stroke(255,60)`; `Triangulate.triangulate(flowers)`
  computes a Delaunay triangulation of the flower points; ~80% of the triangle vertices are drawn
  as one connected open `beginShape` → the faint white line web between flowers.
- The palette array `colors[]` / `getColor` (231–244) is defined but **never called** in
  `generate()` — it is dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_40 | `int sub = 20;` -> `int sub = 40;` | moderate | each flower has ~twice the petals — fuller, finer-fringed rosettes; field layout and size unchanged | variants/sub_40/frame_00001.png |
| size_28_56 | `float s = random(14, 28);` -> `random(28, 56);` | large | flowers roughly twice as big and overlapping — much denser, busier field | variants/size_28_56/frame_00001.png |
| minDist_80 | `dist(...) < 40` -> `... < 80` | moderate | sparser scatter (fewer flowers, bigger gaps); Delaunay web gains longer, more visible stems | variants/minDist_80/frame_00001.png |
| webAlpha_200 | `stroke(255, 60);` -> `stroke(255, 200);` | subtle | connecting web lines marginally more visible; flower field unchanged | variants/webAlpha_200/frame_00001.png |
| fov_PI5 | `float fov = PI/3.0;` -> `float fov = PI/5.0;` | large | telephoto: flowers larger and more uniform in size, flatter perspective, fills the frame | variants/fov_PI5/frame_00001.png |
| tilt_flat | `rotateX(PI*random(0.15, 0.3));` -> `rotateX(PI*random(0.0, 0.05));` | subtle | flowers slightly flatter / more face-on (less 3D tilt); minor change | variants/tilt_flat/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy:**
  - The Poisson/blue-noise scatter (attempt loop + min-distance rejection, 96–115) →
    `poissonScatter(area, attempts, minDist) -> PVector[]`.
  - The radial petal rosette with dotted lerp-color core (117–188) →
    `drawFlower(pos, size, petalCount, coreColors, petalColor)`.
  - The Delaunay web overlay (189–199) → `drawTriWeb(points, alpha)`.
- **One-off art decisions:** the two-tone blue gradient, the specific orange lerp core color,
  the perspective camera params (fov, translate to 0.7h), the per-petal random tilts, and the
  0.8 sampling probability of the web.
- **Clean parameter object:** `{ canvas, bgTop, bgBottom, attempts, minDist, sizeMin, sizeMax,
  petalCount, coreColors[2], petalColor, webAlpha, fov, globalScale, tiltRange }`.
