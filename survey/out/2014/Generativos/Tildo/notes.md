---
sketch: 2014/Generativos/Tildo
year: 2014
renderer: JAVA2D
size: [200, 200]
libraries: []
deterministic: true
ms_first_frame: 153
animated: true
techniques: [noise-field, polar]
primitives: [ellipse, line]
palette:
  colors: ["#262626", "#3762E4"]
  selection: fixed
composition: centered
parameters:
  - {name: strokeWeight base, default: 1.5, tried: [6], change: subtle, effect: "thicker, bolder strokes everywhere; no other change"}
  - {name: amp, default: 0.2*width, tried: [0.5*width], change: moderate, effect: "wave band much taller, peaks near top/bottom edges, denser vertical texture"}
  - {name: freq, default: 20, tried: [8], change: subtle, effect: "fewer, wider wave cycles (score still only subtle)"}
  - {name: des speed, default: 0.5, tried: [0.05], change: none, effect: "no visible change at frame 1 (phase 0.5 vs 0.05 barely shifts the wave)"}
  - {name: dot size, default: 0.05*width, tried: [0.1*width], change: none, effect: "no visible change (dots too small a fraction of the 200x200 canvas to register)"}
  - {name: stroke color, default: "#3762E4", tried: ["#E43762"], change: moderate, effect: "all strokes pink-red instead of blue"}
reusable_candidates:
  - {name: cosineBand, signature: "cosineBand(w, h, amp, freq, phase) -> polyline", note: "full-width horizontal cosine wave; phase animates with frameCount"}
  - {name: dotRing, signature: "dotRing(cx, cy, radius, count, dotSize, rotation) -> void", note: "N dots evenly spaced on a ring, slow rotation"}
  - {name: noiseStrokeWeight, signature: "noiseStrokeWeight(xoff, min, max) -> float", note: "1-D noise over a drifting offset drives stroke weight"}
---

## What it draws
A dark grey field with everything drawn in a single blue: a horizontal
sine-wave band crossing the middle, a large open circle centered on the
canvas, and six small open circles arranged in a ring around the centre.
Over time the wave scrolls (its phase advances each frame), the six dots
creep around their ring, and the line weight of every stroke pulses
smoothly.

## How the code works
`setup()` only sets the 200×200 window (Tildo.pde:3-6). `draw()` redraws
from scratch every frame:

- `background(#262626)` (line 9) — the dark grey field; no accumulation.
- `xoff += .01` (line 10) then `strokeWeight(noise(xoff)*2+1.5)` (line 11):
  1-D Perlin noise over a drifting offset makes the stroke weight of every
  stroke pulse between ~1.5 and ~3.5 — the only noise in the sketch, and the
  only "randomness" (no `random()` calls; fully deterministic).
- `stroke(#3762E4)`, `noFill()` (lines 12-13): single fixed colour, all
  outlines.
- `ellipse(width/2, height/2, width*0.6, height*0.6)` (line 14): the big
  centre ring.
- Wave (lines 15-22): `amp = width*0.2`, `freq = 20` (a `map()`-based
  expression that would animate the frequency is commented out on line 16),
  `des = frameCount*0.5` is the scrolling phase. The loop `for i in
  1..width-1` draws a short `line` from
  `(i-1, h/2 + cos(TWO_PI/freq*(i-1+des))*amp)` to
  `(i, h/2 + cos(TWO_PI/freq*(i+des))*amp)` — a polyline sampling the
  cosine once per pixel, which produces the horizontal band. The `des`
  term makes it scroll; at frame 1 the phase is 0.5.
- Dots (lines 23-29): `da = TWO_PI/6`; for `i in 0..5` a dot of diameter
  `width*0.05` is placed at angle `des*0.08 + da*i` on a ring of radius
  `width*0.2` — the slow-rotating ring of six small circles.

No transforms, no blend modes, no shaders; plain JAVA2D strokes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| strokeWeight_6 | `strokeWeight(noise(xoff)*2+1.5);` -> `strokeWeight(noise(xoff)*2+6);` | subtle | strokes visibly thicker and bolder; composition unchanged | variants/strokeWeight_6/frame_00001.png |
| amp_0.5 | `float amp = width*0.2;` -> `float amp = width*0.5;` | moderate | wave band much taller, peaks nearly touch top and bottom edges, looks denser | variants/amp_0.5/frame_00001.png |
| freq_8 | `float freq = 20;...` -> `float freq = 8;...` | subtle | fewer, wider cycles, but the diff score stays only subtle | variants/freq_8/frame_00001.png |
| des_0.05 | `float des = frameCount*0.5;` -> `float des = frameCount*0.05;` | none | no visible change at frame 1 | variants/des_0.05/frame_00001.png |
| dotSize_0.1 | `ellipse(x,y, width*0.05, width*0.05);` -> `ellipse(x,y, width*0.1, width*0.1);` | none | no visible change (score says none although dots are 2x larger) | variants/dotSize_0.1/frame_00001.png |
| stroke_E43762 | `stroke(#3762E4);` -> `stroke(#E43762);` | moderate | same composition in pink-red instead of blue | variants/stroke_E43762/frame_00001.png |

## Modularisation notes
- Generic blocks: the cosine-band polyline (parameterised by amplitude,
  frequency, phase — a natural `cosineBand` function), the dot ring
  (`dotRing`), and the noise-driven stroke weight (`noiseStrokeWeight`).
- One-off art decisions: the fixed 6-dot count and the specific radii
  (0.6 and 0.2 of width), the flat two-colour palette, and the phase speed
  `0.5`/`0.08` values.
- A clean parameter object would hold: `amp` (fraction of width), `freq`
  (cycles across width), `phaseSpeed`, `ringRadius`, `dotCount`,
  `dotSize`, `strokeWeightBase`, `strokeWeightNoise`, `background`,
  `strokeColor`.
