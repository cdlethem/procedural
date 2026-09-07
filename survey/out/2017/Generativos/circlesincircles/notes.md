---
sketch: 2017/Generativos/circlesincircles
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 251
animated: false
techniques: [polar, symmetry]
primitives: [ellipse]
palette:
  colors: ["#F05638", "#F5C748", "#3FD189", "#FFB9DB", "#AF8AB4", "#6FC4EA", "#412A50"]
  selection: lerp-between
composition: radial
parameters: []
reusable_candidates:
  - {name: colorRamp, signature: "colorRamp(int[] colors, float v) -> color", note: "wrap-around lerp between adjacent palette entries (getColor, line 68)"}
  - {name: arcRing, signature: "arcRing(x, y, size, segments, span, colorFn) -> void", note: "one circle drawn as N arc segments, each with a per-segment colour (line 57)"}
  - {name: ringOfCircles, signature: "ringOfCircles(centerRadius, circleSize, count, offsetPerCircle) -> void", note: "place `count` circles on a ring around the origin (line 53)"}
---

## What it draws
Four large thin circles on a black background, centred on the four compass points a fixed distance
from the canvas centre, so all four pass through the middle and overlap into a four-petal (vesica)
rosette. Each circle is built from many tiny arc segments whose colour cycles continuously through
a 7-colour palette — orange-red, yellow, green, pink, purple, light blue, dark indigo — so each ring
reads as a smooth rainbow gradient; the gradient phase differs from ring to ring.

## How the code works
- `setup()` (line 3) sets 960x960 and calls `generate()` (line 26), which reseeds and calls
  `render()`; `draw()` is empty, so the image is static (frames 10/60 identical to frame 1).
- `render()` (line 32): `background(0)`, translate to centre (line 35). Lines 37-38 draw random
  `r1`/`r2` but lines 39-40 immediately overwrite them with `r1 = width*1.5`, `r2 = 0`, so
  `s = r = 720` and each circle centre sits at `r*0.5 = 360` px from the origin — this is what
  forces every ring through the centre.
- Outer loop (line 53): `cc` circles (line 46, `int cc = int(3+pow(random(30), random(0.5,2)))`;
  with seed 42 this evaluates to 4) at angular step `da = TWO_PI/cc`, placed at
  `(cos(da*i), sin(da*i)) * r*0.5`.
- Inner loop (line 57): each circle is stroked as `sub = 360` arc segments (line 47), each
  spanning `da2*amp` radians (line 60) with `amp = 1` (line 51), i.e. full continuous coverage.
- Colour (line 59): `getColor(map((j+i*d)%sub, 0, sub, 0, colors.length*dc))` lerps between
  adjacent entries of the 7-colour `colors[]` (line 65). `d` (line 50) is a random integer offset
  in degrees per circle, shifting the gradient phase per ring; `dc` (line 49) is a random 1..40
  scaling how many palette passes one ring makes.
- Alpha 240 (line 59) makes overlaps slightly brighter; `noFill()` (line 44); default stroke
  weight (line 52 commented out).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `getColor` (wrap-around palette lerp), the per-circle arc-segment loop (a circle
  renderer with a per-segment colour function), and the outer placement loop (n circles on a
  ring with a per-circle angular offset). These three compose the whole sketch.
- One-off art decisions: the hardcoded `r1 = width*1.5; r2 = 0;` override (forces all rings
  through the centre), the fixed 7-colour palette, `sub = 360`, and the commented-out alternate
  4-colour palette (line 66).
- Clean parameter object: `{count cc, centreRadiusFactor, circleSizeFactor, segments sub,
  arcSpan amp, colourCycles dc, perCircleOffset d, palette colors[], alpha, strokeWeight}`.
