---
sketch: 2020/generative/01_04/papaspas
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1513
animated: false
techniques: [particles, polar]
primitives: [ellipse, line]
palette:
  colors: ["#CED8E2", "#2D57AD", "#050270", "#EA4441", "#E8AD8F"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: pointCount, default: 10, tried: [25], change: subtle, effect: "25 scattered dot-clusters instead of 10, more spokes to centre; size range and palette unchanged"}
  - {name: diskSizeRange, default: "random(20, 70)", tried: ["random(60, 140)"], change: subtle, effect: "disks ~2x larger; layout, rings, palette unchanged"}
  - {name: midRingScale, default: "random(0.5, 0.9)", tried: ["random(0.15, 0.3)"], change: none, effect: "no visible change"}
  - {name: innerDotScale, default: 0.1, tried: [0.45], change: none, effect: "no visible change"}
  - {name: background, default: 230, tried: [15], change: large, effect: "near-black field; same circles and spokes, contrast flips (pale blue-gray and peach pop, navy nearly disappears)"}
reusable_candidates:
  - {name: randomDotBurst, signature: "randomDotBurst(count, sizeRange, ringScales, palette) -> List<PVector>", note: "scattered points, each drawn as concentric rings shrunk by fixed scales, palette per ring"}
  - {name: spokesToCenter, signature: "spokesToCenter(points, cx, cy, color) -> void", note: "thin straight line from each point to a focal centre"}
---

## What it draws
Light gray full-bleed background with ten scattered clusters of concentric circles (each cluster: one
large filled disk, a smaller mid ring/disk, and a tiny center dot), in a flat 5-colour palette of
pale blue-gray, medium blue, dark navy, red, and peach. Thin blue lines run from each circle cluster
straight to the exact center of the canvas, forming a radial spoke pattern. The image is static
(frames 10 and 60 are pixel-identical to frame 1).

## How the code works
`generate()` (line 46) is called once from `setup()` (line 24); `draw()` (line 34) does nothing, so
the image never changes. `randomSeed(seed)`/`noiseSeed(seed)` (lines 48-49) make it deterministic
for a given seed (harness sets the `seed` field, line 4). A flat background of gray 230 is painted
(line 51), `noStroke()` is set (line 52).

Main loop (lines 56-69): for 10 iterations it picks a random position (`random(width)`,
`random(height)`, lines 57-58) and a random diameter 20-70 (line 59), appends it to an
`ArrayList<PVector>`, then draws three concentric ellipses at the same point: the full disk, a
second disk scaled by `random(0.5, 0.9)` (line 63), and a tiny dot scaled by a fixed factor 0.1
(line 66). Each ring's fill is an independent pick from the 5-colour `colors[]` array via
`rcol()` (lines 90-92), so rings of one cluster are usually different colours.

Spokes (lines 71-77): the focal point is the canvas centre; each stored point gets a
`line()` from it to the centre, all stroked with one shared random palette colour (`stroke(rcol())`,
line 73). Renderer is P3D (line 18) but no 3D calls are used; `toxi`/`triangulate` are imported
(imports, lines 1-2) but unused.

## Experiments
| variant | substitution | change score | observation | image |
| count_25 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 25; i++) {` | subtle | 25 clusters instead of 10; more spokes to the centre; sizes and colours unchanged | variants/count_25/frame_00001.png |
| size_60_140 | `float ss = random(20, 70);` -> `float ss = random(60, 140);` | subtle | disks roughly 2x larger; same layout and palette | variants/size_60_140/frame_00001.png |
| midRing_0.15_0.3 | `ss *= random(0.5, 0.9);` -> `ss *= random(0.15, 0.3);` | none | no visible change | variants/midRing_0.15_0.3/frame_00001.png |
| innerRing_0.45 | `ss *= 0.1;` -> `ss *= 0.45;` | none | no visible change | variants/innerRing_0.45/frame_00001.png |
| bg_15 | `background(230);` -> `background(15);` | large | near-black background; circles and spokes unchanged in form, contrast flips | variants/bg_15/frame_00001.png |

## Modularisation notes
The generic pieces are (a) the concentric-ring burst — count, size range, ring scale factors, and
per-ring palette are all parameterizable with no art-specific logic; and (b) the spoke pass — a
plain "connect each point to a focal point" step, trivially separable. One-off art decisions: the
specific 5-colour palette (lines 85-89, with alternates commented out), the fixed 0.1 inner-dot
scale, the gray-230 background, and the choice of canvas centre as focal point. A clean parameter
object: `{count, sizeRange: [lo, hi], ringScales: [0.7, 0.1], palette, focal: {x, y} | null,
bg, lineColor | random}`.
