---
sketch: 2018/Generativos/navs
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1789
animated: false
techniques: [grid]
primitives: [ellipse, shape, rect, arc]
palette:
  colors: ["#EA554F", "#FAC745", "#2760AB", "#369952", "#1E2326", "#FFF7F3"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: polygonBand, signature: "polygonBand(x, y, width, height, peaks, color) -> void", note: "zigzag band of random triangles along a baseline (montains/nube)"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], t) -> color", note: "color lerp between adjacent palette entries at random t"}
---

## What it draws
A flat vector landscape at dusk, split into bands. The top ~60% is a dark charcoal
sky containing two or three angular low-poly clouds (blue, green, orange). A large
pink semicircle (sun) sits on the horizon, partly behind a jagged row of coral-red
triangular mountains. The lower band is a green field densely stippled with tiny
multicolour dots (flowers), with a big orange triangle rising from the bottom edge
at the centre. Everything is flat colour, no strokes.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static; frames 10/60 identical).
All randomness comes from the global `seed` (line 1, re-seeded by the harness).
`rcol()` (lines 210-222) picks a colour by `lerpColor` between two adjacent entries
of the 6-colour palette `colors[]` (line 209), with a random position, so every
shape gets a blend of two neighbouring palette colours.

`generate()` (lines 22-92) builds the picture back-to-front:
- Background rect `rcol()` (line 24) — the charcoal sky.
- Horizon `h = floor(width*random(0.6, 0.7))` (line 26); sky rect to `h` (line 30).
- A dead branch (`random(1) < 0.5 && false`, line 33) that would add up to 800 tiny
  dust ellipses in the sky — never runs.
- `cc = int(random(40)*random(1)*random(1))` clouds (line 44); `nube()` (94-111)
  builds a closed polygon from ~10 sorted random x-offsets with small random
  heights — the angular low-poly clouds.
- Sun: `arc(width/2, h, s, s, PI, TAU)` (line 52), `s = width*random(0.2, 0.8)`,
  centred on the horizon so only the top half is visible above the ground.
- `cc = int(random(1, random(1, 4)))` mountain layers (line 54); `montains()`
  (113-134) makes a zigzag band: ~10 sorted random x positions, each segment a
  triangle peaking at `abs(v2-v1)` above the baseline `y = h`.
- Ground rect from `h` to bottom (line 60).
- `cc = int(random(1000, 8000)*random(10))` flower dots (line 62): x uniform,
  y = h + (height-h)*pow(random, pwr) with `pwr = random(3,4)` (lines 64-69), so
  dots are concentrated near the horizon and fall off with depth; size `hh*ss`
  shrinks with depth (`ss = random(1,5)`).
- A big triangle from (width/2, h) to two random bottom-edge x values
  (lines 74-79) — the orange centre shape.
- `edif()`/`navs()`/`nav()` (building and ship silhouettes, lines 136-201) are
  defined but only called from a commented-out block (81-91); the ship is the
  source of the sketch name.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic: `lerpPalette` (adjacent-entry lerp with random t), the sorted-random-x
zigzag band (`montains`/`nube` share the "N sorted random positions -> triangle
chain" construction — `nube` is the same with a local width and a fixed baseline
offset), and the depth-stippled dot field (uniform x, y biased to the horizon by
a power, size scaled by depth). One-off art decisions: the band layout order
(sky, sun, mountains, ground, triangle), the specific palette and the fixed
0.6-0.7 horizon fraction. A clean parameter object: `{horizon: [0.6,0.7], clouds: 0..40,
mountainLayers: 1..4, dots: 1000..80000, dotDepthPower: 3..4, dotSize: 1..5,
sunSize: [0.2,0.8], palette: colors[]}`.
