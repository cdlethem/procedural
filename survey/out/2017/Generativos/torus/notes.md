---
sketch: 2017/Generativos/torus
year: 2017
renderer: P3D
size: [720, 720]
libraries: [peasy]
deterministic: false
ms_first_frame: 1624
animated: true
techniques: [polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: centered
parameters: []
reusable_candidates:
  - {name: torusKnotSurface, signature: "torusKnotSurface(radius, tubeDepth, twists, strips, width, res) -> void", note: "parametric (1, ite) torus-knot tube built from filled quads, phase-offset strips"}
---

## What it draws
A very dark (near-black, `#141414`) 720x720 canvas with a faint, small ring of thin
coloured strips in the centre. The ring reads as a 3D torus-knot: a wavy tube of several
concentric, phase-shifted strands of tiny filled quads, coloured in muted warm/cool tones
(ochre, dusty pink, pale blue, brick red, plum). Because the PeasyCam sits far back
(distance 1200) the whole object occupies only the middle third of the frame and looks
almost like scattered dust.

## How the code works
- `setup()` (lines 7-16): opens a P3D 720x720 window, creates a `PeasyCam` at distance
  1200 (line 9), calls `generate()`. `draw()` (lines 19-21) calls `generate()` every frame,
  so the piece is re-generated continuously (a live, animated sketch).
- `generate()` (lines 36-98): after `randomSeed(seed)` (line 38) and `background(20)`
  (line 40):
  - `radius = width*random(0.3,0.44)` (line 43) sets the main ring radius; `res = 1024`
    (line 44) and `da = TWO_PI/res` (line 45) fix the angular step.
  - `ite` (line 61, random 1..30) is the number of full tube-cycles (twists) around the
    ring; `di = TWO_PI*ite/res` (line 62) the twist angular step. `r2 = radius*random(0.1,0.4)`
    (line 63) is the tube depth; `amp = random(20)` (line 64) is the half-width of each
    strip; `cc` (line 66, random 2..20) is the number of concentric strands.
  - The `j` loop (line 67) walks the `cc` strands, each phase-shifted by
    `dd = j*res/cc` (line 68). The inner `i` loop (line 72) walks 1024 samples:
    `a1 = da*i` sweeps the main ring, `a2 = di*i + dd` sweeps the tube at `ite` frequency.
    The quad corners are placed at `(cos(a1)*rr, sin(a1)*rr, cos(a2)*r2)` (lines 75-78)
    with the ring radius modulated `rr = radius + sin(a2)*r2` (line 75) and offset
    radially by `amp` (lines 79-85), producing a wavy (1,ite) torus-knot tube made of
    filled quads (lines 87-94).
  - Colour: `fill(getColor(ic + dc*i), 200)` (lines 88-93). `getColor` (lines 104-109)
    lerps between adjacent entries of the 6-colour `colors[]` list (line 100). `dc`
    (line 71) is a random per-strand speed and `ic = millis()*random(0.01)` (line 70)
    adds a time-dependent drift, so colours slowly cycle and differ between frames — this
    is why the sketch is marked `deterministic: false` (the `millis()` term).
- Randomness enters only through the seeded `random()` calls (radius, ite, r2, amp, cc, dc)
  and the unseeded `millis()`-driven colour drift.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / library-worthy: `torusKnotSurface(radius, tubeDepth, twists, strips, stripWidth,
  res)` — the double `j`/`i` loop that emits a (1,ite) torus-knot tube of filled quads,
  plus `getColor(v, palette)` (index-lerp palette sampler) and the per-strand phase offset
  `dd = j*res/cc`.
- One-off art decisions: the fixed 6-colour palette (line 100), `background(20)`, the
  PeasyCam framing (distance 1200, min/max 50/2000), the alpha=200 fill, the live
  `millis()` colour drift, and the `random()` ranges for radius/ite/r2/amp/cc.
- Clean parameter object: `{ radius, tubeDepth (r2), twists (ite), strips (cc), stripWidth
  (amp), res, palette[], fillAlpha, camDist, colorDrift }`.
