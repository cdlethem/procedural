---
sketch: 2015/Generativos/trianguloSSS
year: 2015
renderer: P2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 1485
animated: false
techniques: [particles]
primitives: [line, shape]
palette:
  colors: ["#141414", "#323232"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: triangleCount, default: 100, tried: [300], change: large, effect: "3x density; canvas much more filled, overlaps denser, fewer background gaps"}
  - {name: sides, default: 3, tried: [5], change: moderate, effect: "triangles become pentagons; larger area per shape, fuller coverage"}
  - {name: maxR, default: 80, tried: [40], change: moderate, effect: "smaller triangles on average; more background visible between them"}
  - {name: lineCount, default: 50, tried: [200], change: none, effect: "no visible change; X strokes are too thin (weight <= 4px, most <1px) to matter at 0.4% of pixels"}
  - {name: paletteSize, default: 2, tried: [6], change: large, effect: "palette gains green/teal/olive/pink; entirely different colour look"}
reusable_candidates:
  - {name: randomPolygon, signature: "randomPolygon(x, y, r, sides, angle) -> vertices[]", note: "regular n-gon at random position/size/rotation"}
  - {name: randomCrossLines, signature: "randomCrossLines(count, maxLen) -> void", note: "random short diagonal X strokes in a palette colour"}
---

## What it draws
Scattered field of ~100 flat triangles in two saturated colours (bright blue and magenta/pink)
of varying sizes (small to large) and rotations, overlapping each other across the whole canvas.
The background is very dark (near-black grey, slightly lighter in the lower half). Over the
triangles are ~50 thin short diagonal lines forming small X/cross marks in the same blue and
magenta, mostly on or near triangle edges. Triangles carry a very faint dark outline and the
first vertex of each triangle is slightly lighter than the rest of the face.

## How the code works
- `setup()` (trianguloSSS.pde:3-6) calls `generar()` once; `draw()` is empty, so the sketch is
  static (regenerated only on keypress).
- Background (lines 17-24): a single closed 4-vertex `beginShape` split into two fills — top half
  `fill(20)`, bottom half `fill(50)` — which produces the slightly lighter lower background.
- Palette (line 25): `pc.randomPaletta(2)` builds a 2-colour palette of fully random RGB colours
  (PColor.pde:18-23, 29-31). With seed 42 the two colours come out as the observed blue and
  magenta.
  - Outline pass (lines 34-43): `noFill()`, `stroke(0,8)` (nearly transparent black); for k=6..1
    the 3 vertices are re-issued with `strokeWeight(k)`, so each triangle gets a faint 3-weight
    dark outline (the faint edge darkening visible in the image).
  - Fill pass (lines 44-55): `noStroke()`, each vertex filled with `pc.rcol()` (random palette
    colour); vertex 0 instead gets `pc.b(pc.mod(col,-20),-10)` (PColor.pde:53-69) — the colour
    nudged randomly in RGB and then darkened in brightness — so one corner of each triangle is
    slightly different in tone. Because Processing fills per-vertex, this is what gives each
    triangle its subtly shaded face.
- Cross lines (lines 57-66): `strokeCap(SQUARE)`; 50 iterations of two `line()` calls
  `(x-r,y-r)->(x+r,y+r)` and `(x-r,y+r)->(x+r,y-r)` with `r = random(5)*random(1)` (i.e. short,
  0-5 px) and `strokeWeight(r*0.8)`, stroked in a random palette colour — the small X marks.
- `blendMode(BLEND)` (line 68) is the default; the commented-out block (70-82) would have added a
  blurred `LIGHTEST` overlay but is disabled.
- Randomness enters through the Processing `random()` calls only; seed 42 makes the whole output
  reproducible (baseline `deterministic: true`, frames 10/60 identical to frame 1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| triangles_300 | `for (int i = 0; i < 100; i++) {` -> `i < 300` | large | 3x more triangles: same blue/magenta, denser overlap, background mostly covered | variants/triangles_300/frame_00001.png |
| sides_5 | `int c = 3;` -> `int c = 5;` | moderate | shapes are now pentagons, same colours/size range; coverage looks fuller | variants/sides_5/frame_00001.png |
| maxr_40 | `float r = random(5, 80);` -> `random(5, 40);` | moderate | triangles are noticeably smaller on average; more dark background shows through | variants/maxr_40/frame_00001.png |
| lines_200 | `for (int i = 0; i < 50; i++) {` -> `i < 200` | none | no visible change (only 0.4% of pixels differ; strokes are sub-pixel thin) | variants/lines_200/frame_00001.png |
| palette_6 | `pc.randomPaletta(2);` -> `pc.randomPaletta(6);` | large | six random colours instead of two: green, teal, olive, magenta, blue, pink — whole look changes | variants/palette_6/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `randomPolygon(x, y, r, sides, angle)` — regular n-gon vertices; the
  sketch fixes sides=3 and re-uses it for both the outline and fill passes. `randomCrossLines`
  (count, max length) is a small decorative pass worth keeping as its own function. The PColor
  palette helpers (random N-colour palette, `rcol`, HSB `h/s/b` nudges, `mod`) form a reusable
  palette object.
- One-off art decisions: the two-tone split background quad (fill 20 / fill 50), the 6→1
  multi-strokeWeight outline trick, the per-vertex lighter-corner fill trick, the fixed 2-colour
  random palette, and the short-X line density.
- Clean parameter object: `{triangleCount, minR, maxR, sides, lineCount, maxLineLen,
  paletteSize, bgTop, bgBottom}`.
