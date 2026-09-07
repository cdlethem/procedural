---
sketch: 2016/Generativos/blendCircles
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 316
animated: false
techniques: [blend-modes, polar, lines-hatching, typography]
primitives: [line, ellipse, shape, text]
palette:
  colors: ["#0050FF", "#00FF50", "#5000FF", "#50FF00", "#FF0050", "#FF5000", "#FEFEFE"]
  selection: random-from-list
composition: radial
parameters:
  - {name: discCount (L30), default: 8, tried: [16], change: large, effect: "more discs: canvas almost fully tiled by overlapping discs; DARKEST overlap regions (olive, dark red) dominate"}
  - {name: discSizeExponent (L37), default: 7, tried: [5], change: large, effect: "size ladder 64..1024 instead of 256..4096; visible difference dominated by re-randomised placement (huge black triple overlap)"}
  - {name: grainCount (L60), default: 400, tried: [4000], change: moderate, effect: "10x denser white arc grain; clearly visible stipple over the dark discs"}
  - {name: grainSizeMax (L63), default: 16, tried: [60], change: large, effect: "arcs up to 60 px but stay faint (low alpha, ADD); visible difference dominated by re-randomised placement"}
  - {name: hatchColor (L25), default: 252, tried: [128], change: large, effect: "diagonal hatch becomes clearly visible as darker stripes over the coloured discs"}
reusable_candidates:
  - {name: darkestCircleField, signature: "darkestCircleField(n, center, maxRadius, sizeRange, palette) -> void", note: "n filled ellipses placed polar-randomly, drawn with blend mode DARKEST so overlaps darken channel-wise"}
  - {name: additiveArcGrain, signature: "additiveArcGrain(n, sizeMax, alphaFalloff) -> void", note: "n small random white arcs with random start angle and sweep, drawn with blendMode(ADD) as grain over existing content"}
  - {name: permutedRGBPalette, signature: "permutedRGBPalette(components) -> color", note: "shuffle a small component list (0/80/255) over the RGB channels to get 6 fixed hues"}
---

## What it draws
Seed 42: a near-white field is dominated by one huge dark-red disc covering most of the canvas; a large black
disc sits inside it, offset slightly down-left; the canvas corners are filled with a bright green disc. Thin
hairline diagonals cross the green corner. Large numeric labels are half-visible at the right edge: a black
"463" and a green "3" in the upper right, a dark-red "3.9" at the bottom right. Faint speckles of tiny arc
fragments are scattered over the discs. The render is non-deterministic (`deterministic: false` — the sketch has
no seed field, so even `--seed 42` does not pin the random draws), so exact placement varies per run.

## How the code works
`setup()` (L1-6) sizes 960x960, sets the Chivo Light font (unavailable in the harness, falls back per stderr),
then calls `generate()` once; `draw()` (L8-9) is empty, so the sketch is static.

`generate()` (L21-69) works in three passes:

1. **Hatch pass** (L22-28): `blendMode(BLEND)`, `background(254)` near-white, then `stroke(252)` 2px-wide
   parallel diagonal lines (`line(-1, i, i, -1)`, L26-28) stepping 8px — almost invisible against the white
   background on its own.
2. **Disc pass** (L29-56): `blendMode(DARKEST)`. 8 iterations (L30): each picks a random polar position around
   `(width/2, height/1.6)` with distance up to `width*0.9` (L31-36), and a size `s = 2*2^(7+k)` for k=0..4, i.e.
   one of ~256/512/1024/2048/4096 px (L37). Colour from `rcol()` (L71-79): the list `[0, 80, 255]` is shuffled
   over the RGB channels, giving 6 hues (blue, green, purple, yellow-green, red, orange). A filled ellipse is
   drawn (L41). Because the blend mode is DARKEST, overlapping discs keep the per-channel minimum:
   red∩green → dark red (80,0,0), red∩green∩blue → black (0,0,0) — exactly the dark-red/black/green structure
   seen in the baseline. Discs with `s > 50` (all of them, minimum 256) also get a 1px hairline from centre to
   upper-right (L43-51) and a coordinate text label `x+"x"+y` at 25% of the disc size (L52-54). In this renderer
   the labels are NOT suppressed by `noFill()` — they draw in the disc's colour under DARKEST, so their visible
   colour is min(disc colour, local background): a green label on white stays bright green, a red label on green
   becomes near-black. The "463"/"3" fragments at the right edge are these labels clipped by the canvas.
   Related mechanism: the near-white hatch (stroke 252 on background 254) is only visible where a DARKEST disc
   darkens the line (min(252, disc colour)) — which is why stripes show up in the green corner but not under
   the dark-red disc in the baseline.
3. **Grain pass** (L58-68): `noFill()`, `blendMode(ADD)`. 400 iterations: small white arcs
   (`random(2,16)` px, random start angle `a1`, sweep up to ~0.8π, alpha `random(255)*random*random` — biased
   low) scattered uniformly over the whole canvas (L60-67). These are the faint speckles visible on the discs.

Randomness enters only via `random()` (no `noise()`, no `randomSeed()`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circles_16 | `for (int i = 0; i < 8; i++) {` -> `for (int i = 0; i < 16; i++) {` | large | canvas almost fully tiled: olive (yellow-green∩orange) field over most of it, dark-red disc bottom-centre, orange disc in the corners with the hatch visible as darker-orange stripes; several clipped labels (dark-red "534"/"3.9", green "-41.831", black "543x1051.0045") | variants/circles_16/frame_00001.png |
| bigsize_5 | `float s = 2*pow(2, 7+...)` -> `float s = 2*pow(2, 5+...)` | large | same kind of composition as baseline but placement re-randomised: huge black triple-overlap disc dominates, dark-red wedge top-left, purple top-right, dark-blue crescent right; size ladder now 64..1024 px | variants/bigsize_5/frame_00001.png |
| arcs_4000 | `for (int i = 0; i < 400; i++) {` -> `for (int i = 0; i < 4000; i++) {` | moderate | grain clearly 10x denser: fine white arc stipple now plainly visible across the large dark discs (the unambiguous effect of this change); disc placement itself re-randomised | variants/arcs_4000/frame_00001.png |
| arcsize_60 | `float s = random(2, 16)*random(1);` -> `float s = random(2, 60)*random(1);` | large | difference dominated by re-randomisation (this run left the white background exposed, discs clustered centre, full labels visible in purple/green/red); larger arcs (up to 60 px) are barely noticeable — low alpha + ADD keeps them faint on the discs | variants/arcsize_60/frame_00001.png |
| hatch_128 | `stroke(252);` -> `stroke(128);` | large | diagonal hatch now clearly visible as darker stripes over the coloured discs (dark-green stripes over the bright-green corner, faintly over the blue disc); composition itself re-randomised (one huge blue disc + green corners) | variants/hatch_128/frame_00001.png |

**Caveat (non-determinism):** the sketch has no `randomSeed()` call, so `--seed 42` does not pin the draws
(`seed_fields: []` in baseline/result.json). Every variant render also re-randomises the disc placement, so each
change score mixes the parameter effect with a fresh random layout; per AGENTS.md only the *large* changes are
safely comparable, and the observations above separate the two effects where visible.

## Modularisation notes
- Generic: `rcol()`-style permuted-component palette (L71-79) is a small reusable palette generator; the
  DARKEST disc field (polar placement + size ladder + channel-minimum overlap) is a self-contained
  composition primitive; the ADD arc grain is a generic "additive speckle" overlay independent of the discs.
- One-off art decisions: the specific component triple [0,80,255], the size ladder `2*2^(7+k)`, the centre
  offset `height/1.6` and max radius `width*0.9`, the hairline+text-label annotation on big discs (the label
  colour behaviour under DARKEST is a nice side effect worth keeping), and the near-white 8px diagonal hatch
  (decorative: with stroke 252 ≈ background 254 it is only visible where a disc darkens it).
- A clean parameter object: `{hatch: {step, color, weight}, discs: {count, center, maxRadius, sizeLadder, palette},
  labels: {enabled, textSizeFactor}, grain: {count, sizeMax, alphaBias}}`.
