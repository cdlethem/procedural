---
sketch: 2019/generativos/espo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3192
animated: false
techniques: [noise-field, grid, packing, dots-stippling, blend-modes]
primitives: [point, ellipse]
palette:
  colors: ["#FFA9E7", "#FF84E8", "#7F2CCB", "#414361", "#2A2D43"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: stippleCircle, signature: "stippleCircle(x, y, radius, dotCount, color, additive) -> void", note: "flat circle + offset shadow + inner/outer speckle rings, optional ADD blend for glow"}
  - {name: noiseColumns, signature: "noiseColumns(count, noiseDetail, spread) -> void", note: "vertical dotted columns displaced by 2-D noise"}
  - {name: minDistPack, signature: "minDistPack(trials, sizeFn, minDistFn) -> PVector[]", note: "random circles rejected when closer than 0.7*(s1+s2) to an accepted one"}
---

## What it draws
A light lavender near-white canvas covered by faint vertical columns of tiny dots that wiggle gently
left-to-right. Overlaid are many overlapping circles of varied sizes in pastel pink, magenta, violet
and dark navy; most are softly stippled with thousands of fine dots, some have bright additive
glow centers, and a few small dark circles sit on top like beads. No outlines, no text; the whole
composition is flat, scattered, and collage-like.

## How the code works
Single tab `espo.pde`. `generate()` (line 34) runs once from `setup()`; `draw()` is empty, so the
image is static.

1. Background `background(240)` (line 37) — the light lavender ground (the code's palette tints it
   via the point strokes over it).
2. **Noise columns** (lines 40-63): `sub = int(random(40,100)*0.8)` gives ~32-80 columns spaced
   `ss = height/sub` apart (line 42). For each column index `i`, two `beginShape(POINTS)` passes step
   `j` from 0 to height in steps of 3: a faint grey underlay `stroke(0, 40)` (line 48) and a
   palette-colored pass `stroke(rcol(), 220)` (line 55). X position is
   `i*ss + (noise(i*det*0.1, j*det)*400-200)` (lines 51, 58) with `det = random(0.001)` (line 44)
   — that is the wobble. Y gets `random(-3)`/`random(-1.5)` jitter, which makes each point sit on a
   slightly random row: the dotted, grainy look. `strokeWeight(2)` (lines 41, 59) sets dot size.
3. **Packed circles** (lines 67-87): up to 200 trials place a circle of diameter
   `s = width*random(0.15)` at a random position; a circle is accepted only if its distance to every
   previously accepted one exceeds `0.7*(s+p.z)` (line 78) — a minimum-distance packing that keeps
   big circles from fully overlapping. Each accepted circle is drawn by `circle()` (line 85).
4. **Extra large circles** (lines 90-96): 14 more, diameter `width*random(0.1, 0.4)`, no collision
   test — these are the big overlapping ones.
5. **Extra small circles** (lines 98-104): 20 more, diameter `width*random(0.05)`.
6. **`circle()`** (lines 107-136): draws a shadow ellipse offset +2/+2 with `fill(0, 60)` (lines
   110-111), then the main ellipse `fill(rcol())` (lines 112-113) with `noStroke()`. Then
   `cc = int(r*r*PI*random(1,5))` (line 115) speckle dots: `cc` inner points at
   `random(random(0.5, 0.98)) * r` (lines 120-125) and `cc*0.4` outer points at
   `random(1, random(1,1.4)) * r` (lines 129-134), all `stroke(rcol(), 80)`. With 50% probability
   the blend mode is `ADD` (line 116) which brightens overlapping dots — the glowing centers;
   otherwise `NORMAL`.
7. **Palette** (line 151): 5 fixed colors, `rcol()` picks uniformly at random (lines 153-155).
   `getColor()` (lines 159-164) lerps between adjacent palette colors but is unused.

Randomness enters at every `random()` call in sequence (seeded by the harness via `seed`), so the
column wobble, jitter, circle positions and speckle are all one shared stream.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic, library-ready:**
  - `noiseColumns` — vertical (or horizontal) dotted columns displaced by 2-D noise; parameters:
    column count, noise detail, displacement amplitude, dot step, jitter, two-pass
    (underlay + tinted) strokes.
  - `stippleCircle` — flat circle with offset drop-shadow plus inner/outer speckle rings;
    parameters: radius, speckle density (area-scaled), additive-blend flag, alpha.
  - `minDistPack` — Poisson-ish circle packing by rejection; parameters: trial count, size
    distribution, distance threshold factor.
- **One-off art decisions:** the specific 5-color pink/violet palette and its random picking,
  the three-layer circle placement (packed 0.15-wide, free 0.1-0.4-wide, free 0.05-wide),
  the +2/+2 shadow offset, and the 50/50 ADD/NORMAL blend coin flip.
- **Clean parameter object:** `{columnCount, columnDetail, columnSpread, dotStep,
  packTrials, packMaxSize, packMinDist, freeCircles: [{count, sizeRange}],
  speckleDensity, additiveChance, palette, background}`.
- The sketch imports `triangulate` and `SimplexNoise` but never uses them; `SimplexNoise` could
  replace `noise()` for a 3-D-animatable wobble.
