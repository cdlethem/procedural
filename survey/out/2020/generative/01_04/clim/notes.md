---
sketch: 2020/generative/01_04/clim
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2566
animated: false
techniques: [flow-field, noise-field, lines-hatching, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#414127", "#979C30", "#578574", "#458787", "#4D6626", "#9F860B", "#2B349E", "#F57E15", "#ED491C", "#9B407D", "#B48DC0", "#E3E8EA"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseWavyLines, signature: "noiseWavyLines(count, seg, step, detail, angleScale) -> void", note: "random-walk polylines whose heading follows 2-D noise, with per-vertex alpha fade-in"}
  - {name: dotBurst, signature: "dotBurst(x, y, n, radius, palette, alpha) -> void", note: "radial scatter of translucent ellipses (the flower clusters)"}
---

## What it draws
A full-bleed field of short, wavy, grass-like strokes in olive green, moss, and teal on a dark olive
background, densest toward the top and thinner toward the bottom. Overlaid all over the field, but
concentrated in a diagonal band through the centre, are hundreds of small clusters of translucent
dots in vivid orange-red, pink/magenta, lavender, and pale grey-white, each cluster a loose radial
burst of overlapping circles of varying size.

## How the code works
`generate()` (clim.pde:85) runs once from `setup()` (l.21); `draw()` is empty, so the piece is static.
Background is solid `#414127` (l.89).

Grass strokes: a loop of 40 000 iterations (l.102) starts each polyline at a random point; y is biased
toward the bottom (`height*random(1.2)*random(0.6,1)`, l.103) and 10% of starts are pulled toward the
centre (l.106-107). Stroke weight grows with y (0.8–1.6, ×random(3), l.108). Each polyline walks 12
segments (`seg = 60/5`, l.117), step size `des = (0.7+val*0.8)*7` (l.113-114), with heading
`PI + noise(xx*det, yy*det, i*1e-7)*PI` (l.122) — the angle is centred on PI so lines mostly run
leftward, bent by noise; noise detail `det` grows with y (l.115-116), so lower strokes wiggle finer.
Colour is `getColor(noise(...)*5+0.2)` (l.109, 120): a lerp between two adjacent entries of the green
palette `aux` (l.96), with alpha ramping 0→140 along the line (`140*v2`, l.120), so each stroke fades
in at its start.

Flowers: at the end of each polyline, with 8% probability the endpoint is stored (l.129). A second
loop (l.136-150) sets the palette to the dot palette `aux2` (l.132) and draws 120 ellipses per
flower (l.142), placed at a random angle/distance with sqrt-biased radius (l.143-145), size scaling
with the flower's y (l.139, 144), colour a palette lerp with random jitter (l.141, 147) and alpha
40–120 (l.147). Overlapping translucent dots build the soft, layered clusters.

Randomness enters only via the seeded `random()`/`noise()` (seeded at l.87-88); the harness pins the
seed to 42, and the render is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Two clean blocks: (1) the noise-guided wavy-line field (count, segment count, step, detail, alpha
ramp, palette are all local variables) — a natural `noiseWavyLines()` parameterised by field scale
and stroke ramp; (2) the dot-burst "flowers" (`dotBurst(x, y, n, radius, palette, alpha)`). The
art decisions are the two palettes, the 8% flower probability, and the y-biasing of start positions,
weights, and sizes (a single "ground horizon" gradient that ties both layers together). A parameter
object would hold: lineCount, lineSegments, stepScale, noiseDetail, weightRange, flowerProb,
dotsPerFlower, dotRadiusScale, dotAlphaRange, linePalette, dotPalette, background.
