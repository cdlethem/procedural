---
sketch: 2020/generative/01_04/florchi
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2321
animated: false
techniques: [noise-field, polar, particles, blend-modes]
primitives: [rect]
palette:
  colors: ["#99002B", "#CED1E2", "#D66953", "#28422E"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: detRot, default: 0.005, tried: [0.02], change: subtle, effect: "hatch ground orientations vary more rapidly/finely; flowers unchanged"}
  - {name: detSize, default: 0.02, tried: [0.04], change: large, effect: "higher-frequency size field: more medium/small flowers, placement shifts"}
  - {name: candidates, default: 14000, tried: [7000], change: none, effect: "no visible change; accepted flower set is area-limited by the gap test"}
  - {name: sliverTurns, default: 3.5, tried: [7], change: large, effect: "double slivers per flower: denser, more solid disks, stronger spiral"}
  - {name: palette, default: "[#99002B, #CED1E2, #D66953, #28422E]", tried: ["[#072457, #FFB401, #EF4C02, #ADC7C8]"], change: moderate, effect: "all flowers recolored (blue/gold/orange/pale grey); layout unchanged"}
reusable_candidates:
  - {name: poissonFlowers, signature: "poissonFlowers(count, sizeField, minGap) -> PVector[]", note: "rejection sampling with per-point radius from a noise field (lines 74-105)"}
  - {name: spiralSliverCluster, signature: "spiralSliverCluster(x, y, s, turns, detail, amp, col)", note: "noise-modulated slivers along a 3-turn spiral with 3D tilt (lines 104-126)"}
---

## What it draws
A dark grey field covered by faint, darker grey hatched swirls (short bar-like marks oriented by a
smooth noise field). Scattered on top are dozens of flower-like disks of varying size (from tiny
dots to ~200 px): each is built from many thin, tapered slivers arranged radially in a loose spiral,
colored crimson, pink/salmon, sage green, or pale grey-white, with a small contrasting dot at the
center. Slivers are translucent and slightly tilted in 3D, so the disks read as soft, feathery
blooms against the dark hatched ground.

## How the code works
Static single-pass sketch; `generate()` in `florchi.pde` (called from `setup`, line 23) does all
the work. `randomSeed(seed)` / `noiseSeed(seed)` at lines 48-49 make it deterministic.

1. **Hatch ground** (lines 53-66): `background(60)` dark grey; 10000 tiny 10x100 black rects at
   alpha up to 60, each rotated by `noise(x*detRot, y*detRot)*TAU*2` (line 59). The low noise
   scale (detRot < 0.005) makes the orientations vary slowly, producing the visible swirling
   hatch pattern.
2. **Flower placement** (lines 74-95): 14000 random candidate points. Each gets a size
   `s` = SimplexNoise field (line 77) shaped by `pow(...,2.2)` and multiplied by a second,
   coarser `noise()` field (line 79) and a random factor (line 80). Rejection test: a candidate
   is dropped if within `(s+other.z)*0.5` of any accepted point (lines 85-91) — a variable-radius
   Poisson-disk-like packing, so big flowers keep more space around them.
3. **Sliver spiral** (lines 104-126): each accepted flower draws `res = int(s*PI*3.5)` slivers
   along angle `ang = da + map(k,0,res,0,TAU*3)` (3 full turns, line 114). Sliver width/height are
   `noise(x+cos(ang)*det, ...)*s*amp*random(0.8,1)` (lines 115-116), so thickness ripples with
   angle; each sliver is translated to the flower center, rotated by `ang`, then `rotateX`/
   `rotateY` with random small angles (3D tilt, lines 122-123) — this is why disks look
   soft/feathered rather than flat. Fill is `lerpColor(white, palette, 0.6-1)` then lerped
   toward black (lines 98-105) at alpha 20; 10% of slivers use `blendMode(ADD)` (line 117).
4. **Center dot** (lines 127-140): `r = s*0.08`; `r^2*PI*50` tiny rects scattered within that
   radius, colored `lerpColor(rcol(), getColor(valCol+3.2), ...)` — the contrasting eye at each
   flower center.
5. **Palette** (lines 159-171): fixed 4 colors `#99002B #CED1E2 #D66953 #28422E`; `getColor(v)`
   lerps cyclically between adjacent entries, so the crimson/pink, salmon, sage, and pale
   grey-white hues come from this one ramp. Two commented-out palettes exist (lines 156-158).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detRot_0.02 | `float detRot = random(0.005);` -> `float detRot = random(0.02);` | subtle | background hatch now swirls with finer, faster-changing orientations; flower positions, sizes and colors look the same | variants/detRot_0.02/frame_00001.png |
| detSize_0.04 | `float detSize = random(0.02);` -> `float detSize = random(0.04);` | large | flower sizes vary much more rapidly across the canvas: many more medium/small disks, fewer huge ones, and the accepted placement shifts (same seed) | variants/detSize_0.04/frame_00001.png |
| candidates_7000 | `for (int i = 0; i < 14000; i++) {` -> `for (int i = 0; i < 7000; i++) {` | none | no visible change; halving candidates still fills the same flower set (packing is area-limited) | variants/candidates_7000/frame_00001.png |
| sliverTurns_7 | `int res = int(s*PI*3.5);` -> `int res = int(s*PI*7);` | large | each flower gets double the slivers: disks read denser and more solid-filled, large flowers look like full fans/umbrellas with a more visible spiral | variants/sliverTurns_7/frame_00001.png |
| palette_ocean | `int colors[] = {#99002B, #CED1E2, #D66953, #28422E};` -> `int colors[] = {#072457, #FFB401, #EF4C02, #ADC7C8};` | moderate | flowers recolored to navy/steel blue, gold, orange and pale grey; layout, sizes and hatch ground unchanged | variants/palette_ocean/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy**: the variable-radius rejection packing (lines 74-95) as a function
  of (candidate count, radius field, gap factor); the spiral sliver cluster (lines 104-126) as a
  parameterized "feather disk" (center, radius, turns, noise detail, tilt, colors); the cyclic
  palette lerp `getColor(v)` (lines 166-171).
- **One-off art decisions**: the dark hatch underlay (lines 53-66), the specific exponents
  (`pow(ns,2.2)`, `*0.5+0.3`), the 3-turn spiral angle map, the ADD-blend probabilities, the
  4-color palette.
- **Clean parameter object**: `{canvas, bg: 60, hatchCount, hatchRotScale, candidates, simplexScale,
  coarseScale, gapFactor, sliverTurns, sliverDetail, sliverAmp, tiltRange, dotScale, palette[],
  addBlendP}` — everything else (seed, export) is harness plumbing.
