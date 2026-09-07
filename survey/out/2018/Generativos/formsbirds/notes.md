---
sketch: 2018/Generativos/formsbirds
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2039
animated: false
techniques: [curves, polar, dots-stippling]
primitives: [shape, ellipse]
  colors: ["#011731", "#A12677", "#EE3C7A", "#EE2D30", "#EC4532", "#FFCA2A", "#3DB98A", "#16A5DF"]
  selection: lerp-between
composition: full-bleed
parameters:
reusable_candidates:
  - {name: closedSpline, signature: "closedSpline(points: PVector[]) -> {getPointLin(v), length, getCenter()}", note: "catmull-rom style closed curve through N random points with arc-length table"}
  - {name: fanTriangles, signature: "fanTriangles(curve, center, scale, n) -> void", note: "wedges from center to consecutive curve samples, the main 'bird' motif"}
  - {name: radialDots, signature: "radialDots(center, spread, n, color) -> void", note: "dotted ring with concentric arc outlines around a center"}
---

## What it draws
A full-bleed abstract composition on a warm red-pink background. Dozens of overlapping
"fan" shapes — smooth closed blobs (teal, yellow, magenta, blue, orange-red, green, dark
purple) each filled with triangular wedges radiating from the blob's center — cover the
whole canvas, so shapes overlap and mix into new hues. Small yellow dots with faint
concentric arcs are scattered sparsely over the surface, like seeds or tiny birds.

## How the code works
`setup()` (L3-8) calls `generate()` once; `draw()` is empty, so the sketch is static.
`generate()` (L21-87):
- Background = one random palette colour (`rcol()`, L22).
- Loop of 100 shapes (L27): for each, `cc` = 3-5 random points in a square of side
  `ss = width*random(0.02,0.8)*random(0.4,1)` (L29-32) are fed to the `Spline` class
  (L89-183), a closed catmull-rom-style curve (`curvePoint` in `calculatePoint`, L155-165)
  with an arc-length table (`calculate`, L98-114). The spline is translated to a random
  position (L37).
- First pass (L44-54): for each of `len = int(spline.length)` samples, a thin triangle
  (p1, p2 on the curve, center) is drawn with `fill(0, 40)` — a low-alpha black wedge.
  The samples are scaled `dd = 1.2x` about the center (L46-47), which is why the black
  wedges form slightly larger dark fans under each blob.
- Second pass (L58-69): same triangle fan but with colour. The fill colour walks the
  palette with `getColor(col + cos(phase)*amp)` (L62-64), `amp = random(0.6)` — a cosine
  oscillation around a random base palette position, so each wedge gets a slightly
  lerp'd neighbour colour and the fan looks like a smooth hue sweep. Alpha is full
  (255) here, so overlapping blobs mix additively in appearance.
- Third pass (L71-84): `c = int(random(12))` dots per shape at polar positions
  `dis = pow(random(1),2)*ss` from the center (biased to the center). Each dot: two
  concentric arc outlines via `arc2` (L185-203, quads between two radii with per-quad
  alpha shading) in a colour lerp'd 40% toward white and in pure white, plus a small
  filled yellow (`#FFFF00`, L73) ellipse — the yellow speckles in the image.
- Palette (L211) is 8 fixed colours; `getColor(v)` (L218-224) lerps between two
  adjacent palette entries, so all wedge colours are smooth blends of the 8.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the `Spline` class (closed curve + arc length + center) is self-contained and
  reusable; `fanTriangles` (the two triangle-fan passes) and `arc2` (shaded ring) are
  one-function primitives; `getColor` (lerped palette walk) is a standard palette helper.
- One-off art decisions: the 3-pass layering (black shadow fan scaled 1.2x, colour fan,
  yellow dots), the `pow(random(1),2)` radial bias of dots, and the fixed 8-colour palette.
- A clean parameter object: `{count, pointsPerShape: [min,max], maxRadius (as fraction of
  width), fanScale (dd), shadowAlpha, dotCount: [min,max], palette, bg: 'random-palette'}`.
