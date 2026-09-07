---
sketch: 2019/generativos/cuerpos
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1473
animated: false
techniques: [noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#EBE2D5", "#193FA9", "#000000"]
  selection: fixed
composition: centered
parameters:
  - {name: cc, default: 0, tried: [40], change: large, effect: "activates dormant scatter layer of tiny noise blobs; also shifts downstream RNG so the figures re-pose"}
  - {name: detDesMul, default: 0.125, tried: [1.0], change: none, effect: "10x magnitude-field detail: no visible change to silhouettes"}
  - {name: desMag, default: 50, tried: [120], change: subtle, effect: "stronger displacement: slightly wavier, thinner-looking limbs, same composition"}
  - {name: bodies, default: 3, tried: [1], change: moderate, effect: "number of figures; 1 reads as sparse on the 960px canvas"}
  - {name: tamMul, default: "0.5,0.6", tried: ["0.9,1.1"], change: large, effect: "figure scale ~2x: limbs fatten, figures overlap and bleed off-canvas"}
  - {name: torsoH, default: 0.5, tried: [0.25], change: none, effect: "first figure's torso only; silhouette nearly identical to baseline"}
reusable_candidates:
  - {name: noiseDistort, signature: "noiseDistort(x, y, detail, magnitude, seedOffset) -> PVector", note: "displace a point along an angle and magnitude sampled from two simplex-noise fields (desform, line 83)"}
  - {name: wobblyPoly, signature: "wobblyPoly(cx, cy, w, h, sides, rot) -> void", note: "regular n-gon whose vertices all pass through noiseDistort (poly, line 196)"}
  - {name: blob, signature: "blob(x, y, s) -> void", note: "circle approximated as a fan of noise-distorted triangles (circle, line 58)"}
  - {name: capsule, signature: "capsule(p1, p2, thickness) -> void", note: "stretched noise-distorted polygon between two joint points, used as a limb (lineToPoly, line 185)"}
---

## What it draws
Three abstract humanoid figures on a cream (#EBE2D5) background, clustered in the upper
half of the canvas. Each figure is built from thick, wobbly polygonal capsules: a
large head blob, a torso, two arms and two legs meeting at loose joints. Limbs are
coloured either royal blue (#193FA9) or black, chosen independently per limb, and
every outline is irregular and organic because each vertex is displaced by noise.
The figures read as rough stick figures / "cuerpos" (bodies) with a hand-drawn,
unstable silhouette.

## How the code works
`generate()` (line 89) is called once from `setup()`; `draw()` is empty, so the
sketch is static (frames 10/60 are identical and were dropped by the harness).

1. `randomSeed(seed)`/`noiseSeed(seed)` (91-92) make it deterministic; the harness
   sets the `seed` field (line 4) to 42.
2. Four noise-field parameters are rolled per run (96-99): `desAng`/`detAng` (angle
   field) and `desDes`/`detDes` (magnitude field). `detDes` is tiny
   (`random(0.006,0.001)*0.125`, line 99) so the displacement varies slowly over
   the canvas.
3. Background `#EBE2D5` (102). The `cc` points loop (108-132) draws nothing at
   default `cc = 0` — it would scatter noise-distorted blobs (`circle`, line 58)
   connected by a (commented-out) proximity line network.
4. The real drawing: `for (int k = 0; k < 3; k++)` (135) builds one figure. A hip
   point `c1` is placed in the upper-centre (line 138), a shoulder `c2` at a random
   length `tam` (136) and angle; knee/`rod` and foot/`pie` points chain outward
   (148-166), each offset by a fresh random angle — a two-bone kinematic chain per
   limb.
5. Each limb is drawn by `lineToPoly` (185): the segment between two joints is
   treated as a stretched polygon with width = length * thickness `h` (0.5 for the
   torso, 0.6 for the head blob, 0.12 for limbs) via `poly` (196), an 11-gon whose
   vertices all pass through `desform`.
6. `desform` (83-87) is the core effect: angle from simplex noise at
   `detAng` detail, magnitude from simplex noise at `detDes` detail scaled by 50
   (line 85); the point is pushed `cos/sin(ang)*des`. This is why every edge is
   wavy and the whole figure looks like it's vibrating.
7. Fill: `#193FA9`, 50% chance of black per figure (170-171); `noStroke()` (169).
   The `colors[]` array and `rcol()` (240-248) are unused (only commented-out
   `background(rcol())` calls).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = 0;` -> `int cc = 40;` | large (mean 0.1558, 0.23 of pixels) | tiny blue/black speck dots scattered over the whole canvas (previously dormant circle branch); the three figures also get different poses because the 40 extra random() calls shift the downstream RNG | variants/cc_40/frame_00001.png |
| detDesMul_1.0 | `random(0.006, 0.001)*0.125;` -> `random(0.006, 0.001)*1.0;` | none (mean 0.0086, 0.019 of pixels) | no visible change: 10x the magnitude-field noise detail leaves the silhouettes essentially the same | variants/detDesMul_1.0/frame_00001.png |
| desMag_120 | `*50;` -> `*120;` | subtle (mean 0.0379, 0.065 of pixels) | subtle: edges a bit wavier, limbs look slightly thinner and more contorted; same three-figure composition | variants/desMag_120/frame_00001.png |
| bodies_1 | `for (int k = 0; k < 3; k++) {` -> `for (int k = 0; k < 1; k++) {` | moderate (mean 0.0553, 0.078 of pixels) | one blue figure with black head instead of three; lots of empty canvas | variants/bodies_1/frame_00001.png |
| tamMul_1.1 | `float tam = width*random(0.3, 0.5)*random(0.5, 0.6);` -> `...random(0.9, 1.1);` | large (mean 0.1643, 0.248 of pixels) | figures roughly double in size: head blobs overlap in the upper half, thick limbs spill off the right and bottom edges | variants/tamMul_1.1/frame_00001.png |
| torsoH_0.25 | `lineToPoly(c1, c2, 0.5);` -> `lineToPoly(c1, c2, 0.25);` | none (mean 0.0085, 0.015 of pixels) | subtle: the centre figure's torso reads slightly thinner (more blue shows through) but overall silhouette is near-identical to baseline | variants/torsoH_0.25/frame_00001.png |

## Modularisation notes
- `desform` is the generic core: a 2-D simplex-noise displacement field
  (angle + magnitude channels). Clean signature: `noiseDistort(x, y, detail, magnitude, offset) -> PVector`.
  The per-run offsets (`desAng`, `detAng`, `desDes`, `detDes`) and the magnitude
  scale (50) are the parameters to expose.
- `poly`/`circle`/`lineToPoly` are generic "noise-distorted primitive" builders on
  top of `desform`: `wobblyPoly(cx, cy, w, h, sides, rot)`, `blob(x, y, s)`,
  `capsule(p1, p2, thickness)`.
- The figure rig (random chain of joint points at lines 138-166) and the limb
  thickness values (0.5/0.6/0.12), the blue/black coin flip, and the count of
  figures (3) are one-off art decisions.
- A clean parameter object: `{seed, bodies, bodyScale, limbThickness, headThickness,
  noiseDetail, noiseMagnitude, palette: [blue, black], background}`. The unused
  `cc` point-cloud branch could be re-enabled as a "scattered blobs + proximity
  links" layer (its link loop is currently commented out).
