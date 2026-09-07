---
sketch: 2015/Generativos/dataBall
year: 2015
renderer: P3D
size: [640, 640]
libraries: []
deterministic: false
ms_first_frame: 2569
animated: true
techniques: [shader, noise-field, polar, curves, typography, distortion]
primitives: [line, ellipse, rect, text]
palette:
  colors: ["#FFFFFF", "#0A0A0A"]
  selection: fixed
composition: centered
parameters: []
reusable_candidates:
  - {name: tickArcPrimitive, signature: "tickArcPrimitive(type, r, weight, params) -> void", note: "the 8 white primitives (circle, arc1, arc2, arcDouble, arcConect, circleLines, lineDot) as one parametric 'data tick/arc' vocabulary"}
  - {name: dataScreenPost, signature: "dataScreenPost(fringe, blurMix, scanFreq, vignettePow) -> PShader", note: "post.glsl: distance-based RGB channel offset + 3x3 blur + horizontal scanline shimmer + radial vignette"}
  - {name: rulerScale, signature: "rulerScale(x, y, steps, stepPx, tickEvery) -> void", note: "column of 4px squares with side ticks, the right-edge scale block (lines 61-78)"}
---

## What it draws
On a near-black field, a small white wireframe cluster sits at the centre: two
segmented straight lines crossing like a crosshair (each broken into short
collinear segments with tick-like gaps), a fan of radial lines joined by an arc
in the upper-right quadrant, and a few short scattered arc fragments around the
cross. A vertical ruler — a dense column of tiny white squares with longer
tick lines every few rows — runs along the right edge. The seed label "42s"
appears in the top-left corner. The whole image is softened by a post shader:
faint red/blue colour fringing on the lines, a subtle horizontal scanline
shimmer, and a radial darkening toward the corners. Frames 10 and 60 show the
same structure with a small rotation/drift; the layout itself does not change.

## How the code works
Setup (lines 9-22): P3D 640x640, smooth(8), a 90-degree fov `perspective()`
with the default camera (so the z=0 plane renders at ~0.58x and the visible
world extends beyond the canvas — that is why `translate(width+100, ...)` still
lands on-screen at the right edge), loads `data/post.glsl`, creates a mono font
(Stockholm Mono falls back to a default; see stderr).

draw() (lines 24-92): the seed is re-rolled only every 120 frames (line 25),
out of range for a 60-frame capture, and `randomSeed(seed)` (line 30) resets the
random stream every frame — so the whole geometry is regenerated identically on
every frame. The frame-to-frame drift comes from `millis = frameCount/60.`
(line 28) growing inside the noise/rotation arguments, plus one real-time
`millis()` call in `randomMovementAnimation` (line 99) which is why the
baseline is non-deterministic.

- `randomMovementAnimation(1, 8)` (line 33): Perlin-noise translate, amplitude
  8 (about +/-4 px), one channel driven by wall-clock time.
- Centre cluster (lines 34-58): translate to `(width/2, height/2, -100)`,
  small growing rotation `randomRotationAnimation(0.5)` (line 36; random angles
  scaled by the growing `millis`). Then `cc = int(random(5, 22))` shapes
  (line 39), each given a quadrant-snap rotation `randomRotationRect()` (lines
  114-120: X/Y/Z multiples of PI/2), radius `d = height*random(0.3, 0.45)`
  (line 46), and one of 8 primitives picked by `t = int(random(8))`
  (lines 47-55): `circle`, `arc1` (open arc), `arcConect` (radial spokes +
  connecting arc = the fan), `circleLines` (lines along z at a radius = the
  segmented crosshair strokes when viewed edge-on), `arc2`, `arcDouble`,
  `lineDot` (row of collinear segments = the ticked straight lines). All
  `stroke(255)`, weight 1 at the call site, weights 1-4 inside the circle/arc
  helpers.
- Ruler (lines 61-78): translate to `(width+100, height/2)`, 101 filled 4px
  squares at 6px spacing (i = -50..50), an extra square offset left on even
  rows, and a 14px tick line to the right every 5 rows.
- Seed label (lines 80-83): `text(seed+"s", -140, -140)` top-left, white.
- `filter(post)` (line 84): post.glsl offsets the R/G/B taps by
  `0.006*dis` where `dis` grows with distance from centre (line 25 of the
  shader) — the colour fringing; mixes in a 3x3 weighted blur (lines 28-52);
  multiplies by a slow cosine scanline term (line 54); and blends toward black
  by `pow(distance, 2.0)` — the vignette (line 56).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The 8 white primitives (lines 122-180) are a self-contained "tick/arc
vocabulary" — a good library candidate with a single `(type, r, weight, ...)`
entry point; the quadrant-snap rotation (lines 114-120) and the radius
draw are the only per-shape decisions. The post shader is a reusable
"data-screen" effect parameterised by fringe strength (0.32/0.06 on line 25 of
post.glsl), blur mix (0.8/0.8 on line 52), scanline frequency (1.8 on line 54)
and vignette exponent (2.0 on line 56). The ruler block (lines 61-78) is a
generic scale generator (steps, spacing, tick-every). One-off art decisions:
the specific composition (centred cluster + right ruler + seed label), the
120-frame seed re-roll, and the real-time `millis()` drift. A clean parameter
object: {shapeCount, radiusRange, strokeWeight, background, zOffset,
movementAmp, rotationVel, rulerSpacing, shader:{fringe, scanFreq, vignettePow}}.
