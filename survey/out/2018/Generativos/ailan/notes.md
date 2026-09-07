---
sketch: 2018/Generativos/ailan
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1666
animated: false
techniques: [noise-field, grid, distortion, dots-stippling]
primitives: [line, shape]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#231F20"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(300,360)*0.8", tried: [120], change: moderate, effect: "coarser mesh (about 120 lines vs about 260), cells about 2x larger; discs look proportionally larger"}
  - {name: detDes, default: "random(0.002,0.01)*0.8", tried: [2.4], change: large, effect: "3x displacement distance: big folds, lines bundle into bright ridges, discs elongate"}
  - {name: detAng, default: "random(0.002,0.01)*0.02", tried: [0.08], change: large, effect: "4x angle detail: fine chaotic swirls, mesh bundles into dense woven ribbons"}
  - {name: colors, default: "warm 6-colour list", tried: ["cool 6-colour list"], change: subtle, effect: "discs shift from warm to cool (teal/blue/purple); grid lines stay mostly white"}
  - {name: c, default: 40, tried: [16], change: moderate, effect: "16x16 discs about 2.5x larger (radius scales with 1/c); small random dots remain, mesh unchanged"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, desAng, detAng, desDes, detDes) -> PVector", note: "two-field simplex-noise displacement: noise picks an angle, second noise picks a distance; applied per-vertex"}
  - {name: nline, signature: "nline(x1, y1, x2, y2, segment) -> polyline", note: "straight line resampled into per-pixel segments, each vertex pushed through desform"}
  - {name: packedCircles, signature: "packedCircles(nGrid, c, nRandom, minDist) -> PVector[]", note: "grid + random rejection-sampling circle placement, PVector(x,y,r)"}
  - {name: lerpPalette, signature: "getColor(v) -> int", note: "cyclic palette lerp by scalar, used with per-line offset for banded colour"}
---

## What it draws
On a near-black background, a fine mesh of wavy horizontal and vertical lines fills the canvas with an
80px margin; the mesh is rippled and folded into broad folds by a noise displacement, with the line
colour cycling through a warm palette (cream, yellow, orange, pink, blue) along each row/column so the
folds appear yellow and orange. Scattered over the mesh are dozens of small filled discs in the same
palette (yellow, orange, blue, cream, pink), slightly warped at their edges, denser and smaller toward
the lower-right.

## How the code works
- `setup()` (L6-11) calls `generate()` once; `draw()` (L13-14) is empty, so the sketch is static.
  `keyPressed` (L16-22) regenerates with a new `seed`.
- `generate()` (L24-104): `randomSeed(seed)`/`noiseSeed(seed)` (L29-30), `background(#010101)` (L31).
  Four noise-field parameters are drawn: `desAng`/`detAng` (angle field offset/detail, L33-34) and
  `desDes`/`detDes` (distance field offset/detail, L35-36); `noiseDetail(1)` (L38).
- `desform(x,y)` (L142-146): angle = `SimplexNoise.noise(desAng+x*detAng, desAng+y*detAng)*TAU*30`,
  distance = `SimplexNoise.noise(desDes+x*detDes, desDes+y*detDes)*90`; returns the point pushed by
  `(cos(ang),sin(ang))*distance`. Every vertex of every primitive passes through this, which is what
  bends the straight lines and wobbles the disc edges.
- Grid (L40-58): `cc = int(random(300,360)*0.8)` lines per direction (≈240-287), margin `bb=80`
  (L41), spacing `ss=(width-2*bb)/cc` (L42). Horizontal loop L49-52 and vertical loop L55-58 each
  call `nline(...)` with `stroke(getColor(ic+dc*j), 140)`: colour index `ic+dc*j` drifts along the
  line, so `getColor` (L160-167) lerps cyclically through the 6-colour palette `colors[]` (L153)
  with alpha 140. `nline` (L126-135) resamples the straight segment into 1px steps and pushes each
  vertex through `desform` — producing the wavy mesh.
- Discs (L60-103): a `c=40` (L62) grid of candidate `PVector(x,y,r)` with `r = width*random(0.1,0.8)/c`
  (L69) is seeded, then 10000 random candidates (L79-96) are added by rejection if they don't overlap
  an existing one (`dist < (p.z+other.z)*0.5`, L90). Each is drawn with `noStroke()`, `fill(rcol())`
  (L101) — a uniform-random palette colour (L154-156) — via `circle()` (L106-124), a triangle fan of
  `max(8, r*PI)` slices whose rim vertices also pass through `desform`, giving the slightly warped rims.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_120 | `int cc = int(random(300, 360)*0.8);` -> `... *0.4;` | moderate | coarser mesh: about 120 lines vs about 260, cells about 2x larger; discs look proportionally larger | variants/cc_120/frame_00001.png |
| detDes_2.4 | `detDes = random(0.002, 0.01)*0.8;` -> `... *2.4;` | large | 3x displacement distance: big folds, lines bundle into bright ridges (yellow/pink/blue), discs elongate into ellipses | variants/detDes_2.4/frame_00001.png |
| detAng_0.08 | `detAng = random(0.002, 0.01)*0.02;` -> `... *0.08;` | large | 4x angle detail: fine chaotic swirls, mesh bundles into dense woven ribbons, discs warp irregularly | variants/detAng_0.08/frame_00001.png |
| palette_cool | `int colors[] = {#E6E7E9, #F0CA4B, #F07148, #EECCCB, #2474AF, #231F20};` -> cool list `{#E6E7E9, #7FD1AE, #5B8DEF, #B47BC7, #2474AF, #231F20}` | subtle | subtle: disc colours shift from warm to cool (teal, blue, purple); grid lines stay mostly white — colour change confined to the discs | variants/palette_cool/frame_00001.png |
| c_16 | `int c = 40;` -> `int c = 16;` | moderate | 16x16 discs about 2.5x larger (radius scales with 1/c); small rejection-sampled dots remain, mesh unchanged | variants/c_16/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `desform` (two-field simplex displacement — the core of this sketch's
  look, parameterisable by 4 scalars + distance scale), `nline` (segmented line through a
  displacement field), `getColor` (cyclic palette lerp), and the rejection-sampled circle packing
  (grid seed + random attempts, PVector with radius).
- One-off art decisions: the exact palette list, the 80px margin, the two-field angle/distance
  structure with `*TAU*30` and `*90` multipliers, drawing discs as desform-warped triangle fans
  rather than plain `circle()` (a stylistic choice — a plain ellipse would look different).
- Clean parameter object: `{seed, gridCount (cc), margin (bb), angleField {offset, detail},
  distanceField {offset, detail, distanceScale}, palette[], discGridCount (c), discRadiusRange,
  randomDiscAttempts, lineAlpha}`.
