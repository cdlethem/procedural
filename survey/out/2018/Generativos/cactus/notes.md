---
sketch: 2018/Generativos/cactus
year: 2018
renderer: P3D
size: [720, 720]
libraries: [peasy]
deterministic: true
ms_first_frame: 1501
animated: false
techniques: [polar, curves]
primitives: [shape]
palette:
  colors: ["#EA554F", "#FAC745", "#2760AB", "#369952", "#1E2326", "#FFF7F3"]
  selection: random-from-list
composition: radial
parameters: []
reusable_candidates:
  - {name: radialRings, signature: "radialRings(lobes, subdivisions, radius, ringCount, zSpan, cameraDist) -> void", note: "nested 3D closed loops with a per-angle radius profile, receding along z through a perspective camera"}
  - {name: lobeRadius, signature: "lobeRadius(theta, exponent, minScale, radius) -> float", note: "sharpened sin^exponent lobe profile: r*minScale at lobe boundaries, r at lobe peaks"}
---

## What it draws
On a dark grey background, thin light-grey unfilled line loops form a dense, tiny eight-pointed star at the center that expands outward into large nested wavy eight-lobed rings. The rings are packed very tightly near the center and increasingly far apart toward the edges; the outermost loops run off all four sides of the canvas. Monochrome: light grey lines on dark grey, no fills, no colour.

## How the code works
- `setup()` (cactus.pde:6-16): 720x720 P3D window, `PeasyCam` at z=1000 (line 8), `smooth(8)`, then `generate()`. `draw()` (18-20) calls `generate()` every frame, but `randomSeed(seed)` (line 34) fixes the stream and nothing downstream draws randomness, so every frame is identical (baseline frames 10/45 identical to frame 1).
- `generate()` (30-43): `background(80)` dark grey, `stroke(200)` light grey, `noFill()`, `translate(0,0,-200)` shifts the whole ring stack 200 units toward the camera, then `cactus(8, 50, 80)` (line 42).
- `cactus(sub=8, div=50, r=80)` (46-61): 40 nested rings; ring k sits at `z = map(k,0,40,0,r*20)` = 0..1600 (line 49), i.e. the rings recede along z away from the camera. Each ring is one closed `beginShape`/`endShape(CLOSE)` built from `sub` angular sectors of `div` subdivisions: radius `rr = map(pow(sin(theta),4), 0, 1, r*0.7, r)` (line 54). The 4th power of the single hump of sin per sector gives a sharp peak at each sector centre and a valley at sector boundaries, so every ring is a wavy 8-lobed loop of radius 56-80.
- The star-plus-full-bleed look is perspective projection: the camera sits 1000 units in front of the stack. Near rings (small h) project as the tiny dense central star; rings approaching the camera swell into the big wavy loops; rings beyond z=1000 pass behind the camera and wrap/clip as the outermost off-canvas lines. The density gradient (tight centre, sparse edge) is perspective foreshortening of the evenly spaced z-stacking.
- No blend modes, no shaders, no active randomness. Dead code: `displace()` (63-67, noise displacement, never called) and the 6-colour `colors[]` palette with `rcol()`/`getColor()` (74-88, never called) — the actual render is monochrome grey (stroke 200 on background 80); the palette is what the code *defines*, selected randomly from list but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic core: the nested 3D rings with a pluggable per-angle radius profile (`lobeRadius` above) plus a perspective camera. The profile (sin^4 lobes) is the one swappable ingredient; `radialRings` would take lobes, subdivisions, radius, ring count, z-span and camera distance.
- One-off art decisions: the specific relationship between camera distance (1000) and ring z-span (0..1600) that puts some rings *behind* the camera, producing the full-bleed wrapping outer loops; `sub=8, div=50, r=80`; the z-offset -200; monochrome `stroke(200)`/`background(80)`.
- Clean parameter object: `{ lobes: 8, subdivisions: 50, radius: 80, ringCount: 40, zSpan: radius*20, cameraDistance: 1000, zOffset: -200, lobeExponent: 4, radiusScale: [0.7, 1.0], stroke: 200, background: 80 }`.
