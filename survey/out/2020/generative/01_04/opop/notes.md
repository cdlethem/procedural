---
sketch: 2020/generative/01_04/opop
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1534
animated: true
techniques: [noise-field, packing, blend-modes, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: detSize, default: "random(0.007,0.01)*0.5", tried: ["random(0.003,0.004)*0.5"], change: large, effect: "coarser size-field noise -> bigger, smoother, more uniform bubbles; larger voids"}
  - {name: maxSize, default: "nn*360", tried: ["nn*600"], change: large, effect: "bigger circles -> fewer, very large merged blobs; thin central void"}
  - {name: pointCount, default: 18000, tried: [8000], change: moderate, effect: "fewer candidates -> smaller bubbles, more gaps; connecting network more visible"}
  - {name: alpha, default: 10, tried: [30], change: large, effect: "higher peak alpha -> brighter, more solid/filled blobs; less black showing through"}
  - {name: detCol, default: "random(0.0006)", tried: ["random(0.002)"], change: moderate, effect: "finer color noise -> more mottled/variegated color patches on a similar bubble layout"}
reusable_candidates:
  - {name: rejectionCirclePacking, signature: "rejectionCirclePacking(count, maxSize, noiseDetail, curve) -> PVector[]", note: "noise-driven rejection packing of non-overlapping sized circles"}
  - {name: nearestNeighborSpanTree, signature: "nearestNeighborSpanTree(points) -> List<Edge>", note: "greedy nearest-neighbor spanning tree over a point set"}
  - {name: additiveCircleTrail, signature: "additiveCircleTrail(p1, p2, palette, colorNoiseScale, peakAlpha) -> void", note: "soft additive chain of noise-colored circles between two points"}
  - {name: noisePaletteLerp, signature: "noisePaletteLerp(palette, x, y, noiseScale) -> int", note: "lerp between adjacent palette colors indexed by 2-D noise"}
---

## What it draws
On a black field, a full-bleed web of large, soft, glowing translucent circles ("bubbles") in purple-pink,
teal-cyan and warm amber-gold, with near-white hotspots wherever several circles overlap. The circles are
linked into an irregular cellular network; between them sit thin dark gaps and a few small satellite dots.
It reads as a luminous bubble-packing / cell map, brightest at the junctions and edges, black in the voids.
Frame 1 is the real output; frame 10/60 (byte-identical to each other) are a P2D-on-xvfb buffer artifact
(a white background with black curved voids and thin magenta/cyan/blue/yellow edges), not genuine animation —
`draw()` is empty and `generate()` runs once in `setup()`.

## How the code works
One-shot: `generate()` runs in `setup()` (line 24); `draw()` (line 33) is empty, so the image is a static
one-shot (the differing later frames are a P2D headless buffer loss, not animation).

`generate()` (line 44):
1. `background(0)` + `blendMode(ADD)` (lines 51-52) — everything after is additive on black, so overlaps
   accumulate toward white (the hotspots).
2. **Placement + size field (lines 57-78).** For up to `18000` random candidate points (line 59) inside the
   canvas (with a `-150` margin, line 57, so circles may bleed off-edge), a 2-D noise value is sampled at
   `noise(xx*detSize, yy*detSize)` (line 62) with `detSize = random(0.007,0.01)*0.5` (line 58). The value is
   shaped by `pow(nn,1.5)` (line 63) and `cur(...)` (line 64, curve peaking at 0.5), then turned into a circle
   size `ss = nn*360*random(...)` (line 65) — the noise field sets bubble size, so similar-sized circles cluster.
   A rejection loop (lines 67-74) discards a candidate if it lies within `(ss+other.z)*0.5` of any kept point:
   a noise-weighted **circle packing** (O(n·N); bigger circles reject more neighbors, yielding a few large
   bubbles plus many small ones).
3. **Connecting structure (lines 80-126).** Starting from one random point (lines 89-93), it grows a
   nearest-neighbor spanning tree: each iteration finds the closest unreached point to any reached point
   (with a `record` bounding-box speedup, line 104) and draws an edge via `line1`, then marks it reached
   (lines 124-125). This links every bubble into an irregular tree/web.

`line1()` (line 157) — the actual drawing of each edge, and of the whole look:
- Samples the segment every 3px (`res = int(dis/3)`, line 159).
- At each sample it draws one **circle** (line 177) with `noStroke` (line 164).
- Circle size lerps end-to-end and is scaled up: `s = lerp(s1,s2,v1)*1.4` (line 171) — so the bubbles' own
  radii are what get painted (not a thin line).
- Alpha peaks mid-segment and vanishes at both ends: `alp = 10*sin(val*PI)` (line 172) — max alpha 10, very
  faint, so only heavy overlap glows.
- Color is **noise-driven**: `noiCol = noise(x*detCol, y*detCol)*colors.length*2` (line 174, `detCol =
  random(0.0006)` line 80), passed to `getColor` (line 200) which lerps between two adjacent palette colors
  `lerpColor(c1,c2, pow(v%1,2))` (line 205). `dd = 3*(i%2)` (line 173) alternates the index for shimmer.
- Palette (line 190): `{#D5D3D4, #CF78AF, #DA3E0F, #068146, #424BC5, #D5B307}` — the visible purple-pink,
  teal/green, amber/orange, blue and pale-gray that ADD-blend into white.

Randomness enters at: candidate positions (line 60-61), size jitter (line 65), the tree seed (line 90), and
the color-alternate offset. `randomSeed`/`noiseSeed` set from `seed` (lines 47-48) make it deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detSize_0.003 | `random(0.007, 0.01)*0.5` -> `random(0.003, 0.004)*0.5` | large | bigger, smoother, more uniform bubbles; larger black voids; white/yellow/pink masses dominate | variants/detSize_0.003/frame_00001.png |
| size_600 | `nn*360*random(...)` -> `nn*600*random(...)` | large | few very large merged blobs fill the frame; only a thin black network and small satellites remain | variants/size_600/frame_00001.png |
| count_8000 | `i < 18000` -> `i < 8000` | moderate | smaller bubbles, more black space; the connecting tree/trails read more clearly | variants/count_8000/frame_00001.png |
| alpha_30 | `10*sin(val*PI)` -> `30*sin(val*PI)` | large | much brighter, more solid/filled blobs; less translucency, less black showing through | variants/alpha_30/frame_00001.png |
| detCol_0.002 | `random(0.0006)` -> `random(0.002)` | moderate | similar bubble layout but finer, more mottled color variation (lavender/teal/green/amber patches) | variants/detCol_0.002/frame_00001.png |

## Modularisation notes
Generic, reusable blocks:
- `rejectionCirclePacking` (lines 57-78): noise-weighted non-overlapping sized-circle packing. Generic;
  parameter object = `{count, maxSize, noiseDetail, curveFn, margin}`.
- `nearestNeighborSpanTree` (lines 89-126): greedy NN spanning tree over a point set (with bbox speedup).
  Generic; could be `points -> List<Edge>`.
- `additiveCircleTrail` (line 157 `line1`): draws a soft additive chain of noise-colored circles between two
  sized points. Generic with `{palette, colorNoiseScale, peakAlpha, sizeScale, pxStep}`.
- `noisePaletteLerp` (line 200 `getColor`): palette index from 2-D noise + lerp between neighbors. Generic.

One-off art decisions: the specific `cur()` shaping exponents (line 64 `0.5,0.6,1.2`), the `pow(nn,1.5)`
bias (line 63), the `*1.4` size scale and `10` peak alpha (lines 171-172), the `*3` shimmer offset (line 173),
and the fixed 6-color palette (line 190).

A clean parameter object for this sketch: `{size, seed, pointCount, maxSize, sizeNoiseDetail, curveExponents,
margin, colorNoiseScale, palette, peakAlpha, sizeScale, pxStep}`. The whole thing is a pure one-shot
`generate(canvas, params)`; the only non-generic piece is the ADD-blend + low-alpha aesthetic that makes it
read as glow rather than lines.
