---
sketch: 2019/generativos/cirbuil
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1788
animated: false
techniques: [polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#E0DBD5", "#F0C729", "#E33526", "#5557A0", "#2C2B27", "#000000"]
  selection: random-from-list
composition: radial
parameters:
  - {name: div, default: 80, tried: [24], change: large, effect: "coarser sectors: 24 wide radial slabs instead of 80 thin pillars, same vortex shape"}
  - {name: sub, default: 150, tried: [60], change: large, effect: "fewer rings: rings ~2.5x thicker radially, pillars become wide beams with large flat tops"}
  - {name: ss, default: 260, tried: [130], change: large, effect: "half max height: flatter vortex, outer pillars clearly lower, more black visible between tops"}
  - {name: rot, default: 0.11, tried: [0.0], change: large, effect: "no tilt: perfectly centered, symmetric starburst; baseline's off-center tilt and asymmetric edge disappear"}
  - {name: camZ, default: 710, tried: [400], change: large, effect: "camera closer: much stronger perspective, smaller deeper center, outer ring leaves frame leaving black corners"}
reusable_candidates:
  - {name: radialPillarRings, signature: "radialPillarRings(rings, sectors, outerR, heightScale, heightMinFrac, tilt, camZ, palette) -> void", note: "concentric polar rings of radial box-pillars with random heights, top face bright / sides darkened, under a wide-fov perspective camera"}
---

## What it draws
On a black background, a 3D "radial city": many concentric rings of flat-topped box pillars
radiating from the centre, seen from a slightly tilted, near-overhead wide-angle view so the
rings converge into a vortex at the middle. Each pillar's top face is a flat random colour —
dominantly mustard yellow, red, off-white/cream, muted indigo, near-black — and its four side
faces are a slightly darker (10% toward black) version of the same colour. Pillar heights are
random and grow toward the outer rings; gaps between rings and between pillars let the black
background show through.

## How the code works
`settings()` (L14-19): P3D 960×960, `smooth(8)`, `pixelDensity(2)` (warns unavailable on this display).
`setup()` (L21-29) calls `generate()` once; `draw()` is empty, so the sketch is static.
`generate()` (L52-200):

- Seeds `randomSeed`/`noiseSeed` from `seed` (L54-55), black background (L57).
- Camera: `fov = PI/random(1.14, 1.3)` ≈ 140–158°, `cameraZ = (height/2)/tan(fov/2)` (L60-61),
  `perspective(fov, 1, cameraZ/100, cameraZ*100)` (L62-63). This only sets the projection matrix;
  the camera stays at its default position (z ≈ 831 for height 960).
- `translate(width/2, height/2, 710)` (L65) puts the structure ~120 units in front of the camera —
  the proximity plus the wide FOV creates the strong central vortex. Small ±4 random jitter, then
  `rotateX/Y/Z(random(-0.11, 0.11))` (L66-69) tilts the view up to ~6.3° per axis.
- `lights()` + `noStroke()` (L78-80). Outer radius `size = width*1.8` (L73).
- Double loop: `j = 0..sub-1` with `sub = 300/2 = 150` rings (L75, L83): `r1/r2` = ring inner/outer
  radius from `map(j, 0, sub, 0, size)` with a 0.2 gap (L84-85); `v = (j/sub)²`, `v2 = 0.8 + 0.2v`
  (L86-87) — a height factor that grows toward the outside.
- Inner loop `i = 0..div-1` with `div = 80` sectors (L76, L89): sector angles `a1/a2` (L90-91);
  pillar height `hh = random(v*ss*v2, ss*v2)*random(1)*random(random(0.6, 2))*0.35` with `ss = 260`
  (L88, L92) — max ≈ 91 at the outer ring, ~0 at the centre (4 random draws per pillar, all seeded).
- `col = rcol()` picks a uniform random palette entry (L93, L212-214); `shw = lerpColor(col, 0, 0.1)`
  is the darkened side colour (L94).
- First `beginShape(QUAD)` (L105-147) contains only a dead `k` loop over `cc = 10`
  pushMatrix/translate/popMatrix with no vertices — it draws nothing.
- Second `beginShape(QUAD)` (L155-197) emits 5 quads: the top face at `z = hh` with radius `r+2`
  (L157-162, fill `col`), then 4 side faces running from `z = hh` down to `z = 0` (L167-195, fill `shw`).
  The `+2` radius overpaint means neighbouring pillars' tops slightly overlap.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_24 | `int div = 80;` -> `int div = 24;` | large (mean 0.2231, 0.717) | pillars merge into 24 thick radial slabs; vortex structure and palette unchanged, just much coarser | variants/div_24/frame_00001.png |
| sub_60 | `int sub = 300/2;` -> `int sub = 60;` | large (mean 0.2548, 0.78) | rings are far thicker; each pillar is a wide beam with a large flat top face; looks like a coarse mosaic tunnel | variants/sub_60/frame_00001.png |
| ss_130 | `float ss = 260;` -> `float ss = 130;` | large (mean 0.2057, 0.65) | overall flatter: outer pillars about half as tall, central plateau lower, more black background visible between pillar tops | variants/ss_130/frame_00001.png |
| rot_0.0 | `float rot = 0.11;` -> `float rot = 0.0;` | large (mean 0.2313, 0.794) | view is perfectly axis-aligned: center exactly in the middle, clean symmetric starburst, no tilted horizon offset | variants/rot_0.0/frame_00001.png |
| camz_400 | `translate(width*0.5+random(-4, 4), height*0.5+random(-4, 4), 710);` -> `..., 400);` | large (mean 0.2218, 0.763) | camera closer to the structure: strong perspective compression, center shrinks into a deep small vortex, outer ring runs off-frame leaving black corners | variants/camz_400/frame_00001.png |

## Modularisation notes
- Generic core: the polar ring-of-pillars generator. A clean parameter object would be
  `{rings (150), sectors (80), outerR (1.8*width), gap (0.2), heightScale (ss=260),
  heightFalloff (v²·(0.8+0.2v)), heightJitter (0.6–2), heightMul (0.35), tilt (±0.11 rad),
  camZ (710), fov (PI/1.14..1.3), palette (5 colours), sideDarken (0.1)}`.
- Reusable as `radialPillarRings(...)`; the top+4-sides quad group is a small "box pillar"
  primitive worth extracting on its own.
- One-off art decisions: the specific 5-colour palette, the `v²` height falloff, the `+2`
  overpaint trick, the exact camera distance.
- Dead code to drop on refactor: the `cc = 10` inner loop (L106-146, no vertices emitted),
  the commented-out `stroke`/`box` lines, the unused `getColor()` variants (L215-223),
  the unused `SimplexNoise` and `triangulate` imports (both jars are loaded but nothing in the
  code uses them).
