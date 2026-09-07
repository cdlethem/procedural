---
sketch: 2018/Generativos/cuadris
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3077
animated: false
techniques: [3d-mesh, grid]
primitives: [box, pgraphics]
palette:
  colors: ["#F4D3DE", "#E04728", "#F7B63D", "#3F9686", "#313168"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: boxGrid, signature: "boxGrid(w, h, d, cw, ch, cd, gap) -> void", note: "subdivided box drawn as a 3D checkerboard of two palette colours"}
  - {name: getColor, signature: "getColor(v: float) -> color", note: "lerps between palette neighbours by fractional v, squared falloff"}
---

## What it draws
A dense, full-bleed 3D field of small cubic clusters floating in a warm yellow haze.
The dominant feature is dozens of box-shaped checkerboard grids: each is a rectangular
block subdivided into many small cubes, alternating between two colours (pink/teal,
red/pink, yellow/pink, navy/teal, etc.). Among them float flat slabs (thin elongated
boxes) in the same palette, plus a sprinkling of tiny cubes. Thin dark box edges give
a wireframe-like mesh feel. The whole scene is randomly oriented so the clusters sit
at many angles, and the perspective is slightly wide, so the field fills the frame edge
to edge with no background visible except gaps.

## How the code works
`setup()` (cuadris.pde:3-8) sizes a 960x960 P3D window and calls `generate()` once;
`draw()` is empty so the image is static.

`generate()` (lines 21-82):
- Seeds `random`/`noise` from the harness-injected `seed` (line 1, 23-24), then picks a
  background by `getColor(random(10))` — a lerp between two palette neighbours, line 25.
  With seed 42 this lands on the yellow `#F7B63D` family.
- Builds a perspective camera with a random FOV `PI/random(2.2, 3.0)` (line 27),
  then translates to centre and applies three random full-angle rotations
  (lines 31-34) plus a uniform `scale(1.2)` (line 41).
- Three placement loops, each drawing 640, 640 and 6400 objects
  (lines 43, 56, 69). Every object gets a random orientation snapped to multiples of
  TAU/4 in each axis (lines 45-47), a random translation within a 1000-unit cube
  (±500, line 36, 48), and random dimensions w/h/d in 10..80 (lines 49-51).
  1. First loop: `boxGrid(w, h, d, cw, ch, cd, 0.2)` (line 53) — the checkerboard
     blocks. `boxGrid` (lines 84-110) subdivides the box into cw×ch×cd cells and fills
     each cell with colour `c1` or `c2` by `(i+j+k)%2` (lines 96-97); `c1`/`c2` are two
     independent `getColor()` picks (lines 90-91). Cell size minus a `0.2` gap
     (line 105) leaves thin seams; the global `stroke(0, 20)` / `strokeWeight(0.5)`
     (lines 38-39) darkens cell edges.
  2. Second loop: thin slabs `box(w*20, h*0.02, d*0.02)` (line 66) — the flat plates.
  3. Third loop: tiny cubes `box(w*0.04, h*0.04, d*0.04)` (line 79) — the dust of small
     cubes.
- Colour: `getColor()` (lines 123-125) picks a random value in the 5-colour palette
  `{#F4D3DE, #E04728, #F7B63D, #3F9686, #313168}` (line 118); `getColor(v)`
  (lines 126-132) lerps between `colors[int v]` and the next entry with a squared
  fractional weight. Two commented-out palettes (lines 117, 119) exist as alternates.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `boxGrid` is the core reusable piece: a 3D checkerboard block (size, cell counts,
  gap, two colours). Clean parameter object: `{w, h, d, cells: [cw, ch, cd], gap,
  c1, c2, orientation, position}`.
- `getColor(v)` is a generic palette-lerp sampler; the palette list itself is the
  one-off art decision (three candidate palettes in the file).
- The three placement loops share identical boilerplate (random TAU/4-snapped
  orientation, position in a cube, random dims); a generic `scatter(count,
  positionRange, orientSnap, placeFn)` would cover all three.
- The slab and tiny-cube loops are one-off decorative layers, thin enough to keep as
  optional "debris" passes rather than library features.
