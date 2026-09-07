---
sketch: 2015/Generativos/Kaiovodo/kaiovodo01
year: 2015
renderer: JAVA2D
size: [851, 315]
libraries: []
deterministic: true
ms_first_frame: 4158
animated: false
techniques: [noise-field, grid, lines-hatching, dots-stippling]
primitives: [ellipse, line, shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: s (hex grid cell), default: 60, tried: [30], change: none, effect: "no visible change - dot grid is buried under the flow-field texture and white shapes"}
  - {name: flow line count, default: 2000000, tried: [400000], change: large, effect: "mottled background thins out; brighter, grainier field, white stars and rings stand out more"}
  - {name: flow max length (map 0,1,0,32), default: 32, tried: [80], change: none, effect: "no visible change - 2M alpha-40 strokes already saturate local coverage; length is absorbed by the noise-angle field"}
  - {name: star (cross) count, default: 60000, tried: [20000], change: large, effect: "fewer white stars; the dark mottled texture dominates a much larger area"}
  - {name: band width (x-y+n*110), default: 110, tried: [300], change: moderate, effect: "mask diagonal shifts left; lower-left black wedge shrinks, white star region extends further left"}
  - {name: ring count, default: 10000, tried: [30000], change: moderate, effect: "more white rings with x; star/ring field becomes denser and brighter"}
reusable_candidates:
  - {name: noiseFlowLines, signature: "noiseFlowLines(count, noiseScale, maxLen, alpha) -> void", note: "short strokes oriented by 2-D noise, length also from noise; low alpha so overlaps accumulate into dark masses"}
  - {name: star4, signature: "star4(x, y, size, angle, pinch) -> void", note: "four-armed notched star (cross() at l.153): 4 outer points with inward notches between them, pinch in [0.12, 0.4]"}
  - {name: jitteredRing, signature: "jitteredRing(x, y, d, segments, jitter) -> void", note: "circle() at l.129: closed bezier polygon with per-vertex random jitter, looks like a hand-drawn ring"}
  - {name: diagonalNoiseBand, signature: "keep = (x - y + noise(x*s, y*s)*w) >= 0", note: "noise-perturbed diagonal mask (l.65) that carves the black wedge out of the lower-left"}
---

## What it draws
A panoramic (851×315) black-and-white field. The lower-left is a solid black wedge bounded by a
slightly wavy diagonal running from upper-left to lower-right. Everywhere else, a dark mottled
texture made of countless tiny short strokes is overlaid with thousands of small white shapes:
pinched four-armed stars (small four-petal/plus shapes) and hand-drawn-looking white rings each
containing a small x. Shape density and size are uneven, forming a soft diagonal band of larger,
sparser stars running from the lower-middle to the upper-right; near the top-right the field
dissolves into a finer, grayer grain. A faint hexagonal grid of dots and thin connector lines is
buried under the other layers.

## How the code works
Single draw() pass, static, all grayscale via alpha (fill/stroke are pure black or white, l.13,
l.31, l.33, l.58, l.59, l.74, l.140). Layers, in order:

1. Hex dot-grid (l.19–42): hex grid with cell `s = 60`, each node a 5px dot `fill(0, 180)`
   (l.30–32) plus 3 thin `stroke(0, 40)` lines to neighbouring nodes (l.34–39); node positions
   jittered by `noise(i*0.05, j*0.05)` scaled by `def = 5` (l.28–29). Mostly hidden by later
   layers.
2. Noise-field strokes (l.44–54): 2,000,000 random points; each gets a short line of length
   `map(n, 0, 1, 0, 32)` oriented at angle `n*TWO_PI`, where `n = noise(x*0.006, y*0.006)`.
   Stroke is still `stroke(0, 40)` from l.33, so 2M alpha-40 strokes overlap into the dark
   mottled background.
3. White stars (l.57–71): 60,000 random points; `n = noise(x*0.005, y*0.005)`; points with
   `dif = x - y + n*110 < 0` are skipped (l.65–66) — this is what carves out the solid black
   wedge in the lower left. Where drawn, size `tt = n*40` (further shrunk to zero approaching
   the diagonal via a sine ramp, l.67–68) and a 4-armed star is drawn by `cross()` (l.153–171)
   with `fill(255)`, `stroke(0, 200)`, random pinch `random(0.12, 0.4)`. The white fill erases
   the accumulated dark field, so the star region reads as white-on-dark.
4. Rings with x (l.73–88): 10,000 random points; `s = noise(x*0.005, y*0.005)*80 - 40`, only
   drawn where `s > 0` (upper half of the noise values); a 5-segment jittered bezier ring
   `circle()` (l.129–151) with `fill(255)`, `stroke(0)`, plus a small x cross of
   `ls = s*random(0.04, 0.16)` (l.83–85).

Randomness: `randomSeed(seed)` / `noiseSeed(seed)` at l.10–11 (harness sets `seed := 42`), so
the layout is fully deterministic. No transforms beyond the per-shape angle in `cross()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| s_30 | `float s = 60;` -> `float s = 30;` | none | no visible change - hex dot grid is completely buried under the flow-field texture and white shapes | variants/s_30/frame_00001.png |
| flowCount_400000 | `for (int i = 0; i < 2000000; i++)` -> `for (int i = 0; i < 400000; i++)` | large | mottled background thins out and lightens (most visible left/upper-left); white stars and rings stand out much more | variants/flowCount_400000/frame_00001.png |
| flowLen_80 | `float d = map(n, 0, 1, 0, 32);` -> `... 0, 80);` | none | no visible change - 2M alpha-40 strokes saturate local coverage, so doubling max length does not change the field | variants/flowLen_80/frame_00001.png |
| crossCount_20000 | `for (int i = 0; i < 60000; i++)` -> `for (int i = 0; i < 20000; i++)` | large | far fewer white stars; dark mottled texture covers most of the canvas, stars only in the densest patches | variants/crossCount_20000/frame_00001.png |
| band_300 | `float dif = x-y+n*110;` -> `float dif = x-y+n*300;` | moderate | mask diagonal shifts left/down; lower-left black wedge is smaller, star region extends further into the left half | variants/band_300/frame_00001.png |
| circleCount_30000 | `for (int i = 0; i < 10000; i++)` -> `for (int i = 0; i < 30000; i++)` | moderate | three times as many white rings with x; field looks denser and brighter, less of the dark texture showing through | variants/circleCount_30000/frame_00001.png |

## Modularisation notes
The four blocks in draw() are independent scatter layers over a white canvas and map directly
onto the reusable candidates above. The generic pieces: a scatter loop over random points with
a noise-based keep/drop predicate, `noiseFlowLines` (count, scale, maxLen, alpha), `star4`
(size, angle, pinch), `jitteredRing` (d, segments, jitter), and the diagonal-noise keep-mask.
One-off art decisions: the specific mask `x - y + n*110` (wedge angle/width), the sine ramp that
tapers stars toward the diagonal, the per-layer noise scales (0.005/0.006) and counts
(2M/60K/10K), and the fixed 851×315 panorama size. A clean parameter object would be:
`{size, layers: [{type, count, noiseScale, sizeRange, alpha, keepMask, fill, stroke}]}` — i.e.
a small declarative layer list executed in order.
