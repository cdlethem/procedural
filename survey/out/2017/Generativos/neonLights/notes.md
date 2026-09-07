---
sketch: 2017/Generativos/neonLights
year: 2017
renderer: JAVA2D
size: [920, 920]
libraries: []
deterministic: true
ms_first_frame: 271
animated: false
techniques: [spiral, symmetry]
primitives: [rect, ellipse]
palette:
  colors: ["#000000", "#FFFFFF", "#FF7700", "#15FF4A", "#BBBBFF"]
  selection: lerp-between
composition: radial
parameters:
  - {name: ms, default: "random(0.986, 0.999)", tried: [0.97], change: large, effect: "faster size decay: fewer, more spaced rings; orange band splits out, green fills the interior"}
  - {name: mr, default: "random(-0.02, 0.02)", tried: [0.08], change: large, effect: "stronger per-step twist: pinwheel spiral, busy multicolored ring core"}
  - {name: vel, default: "random(1.0)*random(0.2, 1)", tried: [0.0], change: large, effect: "no center drift: concentric rings centered on canvas (RNG shift also flipped form to ellipse)"}
  - {name: alpha, default: 120, tried: [255], change: moderate, effect: "opaque squares: chunky mosaic overlap, more orange/grey visible in core"}
  - {name: form, default: "int(random(2)) (0 for seed 42)", tried: [1], change: large, effect: "ellipses: smooth green disc of concentric rings with faint banded middle"}
reusable_candidates:
  - {name: waveShape, signature: "waveShape(wave, freq) -> float", note: "interpolates between sine/quad/tri/saw waveforms by fractional part of wave"}
  - {name: getColor, signature: "getColor(v) -> color", note: "walks a palette with lerpColor between adjacent entries, wrapping"}
  - {name: spiralShapes, signature: "spiralShapes(cx, cy, s, dir, rot, vel, ms, mr, mw, mf, mdr, form) -> void", note: "shrinks a shape along a wandering direction, rotating each step; rect or ellipse"}
---

## What it draws
A single spiral of nested, rotated squares (seed 42 chose rect form) on a black background.
The outer shapes are huge neon green squares rotated toward 45 degrees, each inner one smaller
and twisted a little further, converging to a small orange/brown/grey core in the middle.
The greens dominate; the warm orange band appears in the inner half. The spiral is slightly
off-center, drifting toward the upper-left.

## How the code works
`setup()` (L3-8) sets a 920x920 window, `smooth(8)`, then calls `generate()` once; `draw()` is
empty so the piece is static. `generate()` (L29-80) reseeds with a random 6-digit seed
(`seed` field, set by harness to 42), clears to black, then runs a single iteration of the
outer loop (L36, `i < 1`).

Per run it picks a starting size `s` in [width/2, width] (L39), a starting direction `dir` and
rotation `rot` (L40-41), a drift speed `vel` (L42), and slow modulators: `ms` size multiplier
(L43, 0.986-0.999), `mr` rotation step (L44, ±0.02), `mw`/`mf` for the wave parameters (L47-48),
and `mdr` direction jitter (L49). `form` (L50) is 0 (rect) or 1 (ellipse).

The core loop (L63-78) while `s > 0.5`: move the center by `vel` along `dir`, shrink `s *= ms`,
rotate by `rot += mr`, jitter `dir`, advance `wave`/`freq`; then draw a rect or ellipse of size
`s` centered at the new point with `fill(getColor(waveShape(wave, freq)*colors.length+4), 120)`
(L74). The 120 alpha makes overlapping shapes blend additively into the neon look.

Colour: `waveShape` (L95-122) blends sine/quad/tri/saw by the fractional part of `wave` as
`wave` drifts, so the waveform itself morphs down the spiral. `getColor` (L130-136) indexes the
8-entry palette (L125, mostly black with white, orange #FF7700, green #15FF4A, pale blue
#BBBBFF) with a value offset by 4, lerping between adjacent entries — the black entries create
dark bands, and the green/orange alternation produces the banded core.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ms_0.97 | `float ms = random(0.986, 0.999);` -> `float ms = 0.97;` | large | faster decay: widely spaced square rings, distinct orange band mid-spiral, solid green interior | variants/ms_0.97/frame_00001.png |
| mr_0.08 | `float mr = random(-0.02, 0.02);` -> `float mr = 0.08;` | large | strong twist: pinwheel of squares, inner half becomes a dense multicolored (green/orange/grey) ring core | variants/mr_0.08/frame_00001.png |
| vel_0.0 | `float vel = random(1.0)*random(0.2, 1);` -> `float vel = 0.0;` | large | center stays fixed: concentric circles centered on the canvas, multicolored banded middle, green outer rings (form drew as ellipse - RNG shift) | variants/vel_0.0/frame_00001.png |
| alpha_255 | `fill(getColor(waveShape(wave, freq)*colors.length+4), 120);` -> `..., 255);` | moderate | opaque squares: chunky, mosaic-like overlap; core shows more orange and grey, neon glow gone | variants/alpha_255/frame_00001.png |
| form_1 | `int form = int(random(2));` -> `int form = 1;` | large | ellipses: smooth green disc of concentric rings, only faint darker ring bands in the middle | variants/form_1/frame_00001.png |

Note: substituting a constant for a `random(...)` call removes RNG draws, so downstream
parameters (dir, rot, form, ...) differ from the baseline; observations describe the rendered
image as-is.

## Modularisation notes
`waveShape` and `getColor` are fully generic and reusable as-is (pure functions). The
`generate()` loop is a small "spiral of shrinking, rotating shapes" generator whose clean
parameter object would be: `{startSize, vel, dir0, rot0, sizeDecay (ms), rotStep (mr),
dirJitter (mdr), waveInit, freqInit, waveDrift (mw), freqDrift (mf), form, alpha}` — the
art decisions are the fixed alpha 120, the `+4` palette offset, the `s > 0.5` stop condition,
and the palette itself (L125). The commented-out `drawWave` (L82-93, L12-16) and the 10%
"tiny square" branch (L52-62) are dead code, one-off experiments.
