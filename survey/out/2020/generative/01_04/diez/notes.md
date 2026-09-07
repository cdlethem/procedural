---
sketch: 2020/generative/01_04/diez
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [polar]
primitives: [ellipse, shape]
palette:
  colors: ["#A5D0A8", "#8CADA7", "#110B11", "#B7990D", "#F2F4CB"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 10, tried: [20], change: large, effect: "more shapes: original big dark disc still dominant, extra shapes add faint pale halos and tone shifts across most of the canvas"}
  - {name: ring_alpha, default: "190*random(1)", tried: ["60*random(1)"], change: moderate, effect: "ring halos become much fainter, thin olive-grey bands; solid discs (mustard, pale sage) read more clearly, flatter look"}
  - {name: palette, default: "sage/green set (line 103)", tried: ["#7D7FD8 #F7AA06 #EA79B7 #FF0739 #12315E"], change: large, effect: "full recolour: warm orange/terracotta ground, big pink solid disc, orange halo, muted mauve corner"}
  - {name: size_factor, default: 1.8, tried: [3.0], change: large, effect: "shapes roughly double: two or three giant overlapping discs dominate (big mustard solid disc, huge faint teal disc), fewer distinct shapes visible"}
  - {name: center_pull, default: "random(0.5)", tried: ["random(1.0)"], change: moderate, effect: "shapes cluster near the centre: big dark disc now centred, mustard disc concentric beside it, corners emptier"}
reusable_candidates:
  - {name: annulus, signature: "annulus(x, y, rInner, rOuter, color, alpha) -> void", note: "translucent ring built from polar-quad fan (lines 73-93)"}
  - {name: pullTowardCenter, signature: "pullTowardCenter(pos, center, strength) -> pos", note: "lerp position toward center by random strength (lines 57-58)"}
---

## What it draws
A flat abstract composition on a muted sage-green field: one large near-black
solid disc sits off-center low-left, and several pale, translucent concentric
ring bands (annuli) in sage, teal-green and cream overlap across the frame,
some clipped by the edges. The overall feel is of soft, layered halos around
a dominant dark circle; a mustard tone from the palette is barely present.

## How the code works
`generate()` (lines 46-70) runs once in `setup()`; `draw()` is empty so the
image is static. It seeds `randomSeed`/`noiseSeed` from `seed` (line 4, set by
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 20; i++) {` | large (mean 0.2653, 0.9 of pixels) | the original large near-black disc still dominates the left; the 10 added shapes show up mostly as faint pale-green halo bands and tone shifts spread over most of the frame, so the style is unchanged but the tonal field is busier | variants/count_20/frame_00001.png |
| alp_60 | `float alp = 190*random(1);` -> `float alp = 60*random(1);` | moderate (mean 0.0613, 0.204 of pixels) | ring halos are much fainter and thinner (low-alpha dark rings read as pale olive-grey bands over the sage ground); the solid discs — a large pale-sage disc top-right and a mustard corner — now read clearly, giving a flatter, more monochrome composition | variants/alp_60/frame_00001.png |
| palette_cool | `int colors[] = {#A5D0A8, #8CADA7, #110B11, #B7990D, #F2F4CB};` -> `int colors[] = {#7D7FD8, #F7AA06, #EA79B7, #FF0739, #12315E};` | large (mean 0.3407, 1.0 of pixels) | complete recolour: warm orange/terracotta ground (blended #F7AA06/#FF0739 halos), one big solid pink disc left, a large orange halo disc right, muted mauve band bottom-left — geometry identical, only hue changed | variants/palette_cool/frame_00001.png |
| size_3.0 | `float s = width*random(1.8-i*0.018)*random(0.5, 1)*random(0.6, 1);` -> `...random(3.0-i*0.018)...` | large (mean 0.2894, 0.47 of pixels) | shapes roughly double in size: the frame is now dominated by two or three giant overlapping discs — a large solid mustard disc bottom-right, a huge faint teal disc filling the left — with only soft halo edges left to distinguish shapes | variants/size_3.0/frame_00001.png |
| pull_1.0 | `x = lerp(x, width*0.5, random(0.5));` + `y = lerp(y, height*0.5, random(0.5));` -> `random(1.0)` in both | moderate (mean 0.1082, 0.167 of pixels) | shapes cluster much tighter around the centre: the big near-black disc is now centred, the mustard solid disc sits concentric beside it (visible crescent on the left), halos are concentric, and the corners are almost empty | variants/pull_1.0/frame_00001.png |
the harness), fills the background with a random palette colour (line 51),
then loops 10 times (line 54): each iteration picks a random point, lerps it
toward the canvas centre by a random 0-0.5 strength (lines 57-58), snaps it
and the size to 60/50 px multiples (lines 59-62), draws one solid `ellipse`
in a random palette colour (lines 64-65), and three translucent ring annuli
at 2x/4x/3x the size via the helper `circle()` (lines 66-68).

`circle()` (lines 73-93) is a polar quad fan: it walks `res` steps around
`TAU`, and for each step emits one quad whose inner edge sits at radius `s1`
with `fill(col, alp)` and whose outer edge sits at radius `s2` with
`fill(col, 0)` (alpha 0), so each quad is a triangle fan segment that fades
from coloured inner rim to transparent outer rim — the union of the steps
reads as a soft ring band. The ring alpha `alp` is `190*random(1)` (line 78),
so rings are semi-transparent and overlap additively over the background.
Colours come from `rcol()` (lines 105-107), a uniform random pick from the
5-colour `colors[]` array (line 103); `getColor()`/`lerpColor` variants
(lines 109-118) exist but are never called. The toxi/triangulate imports
(lines 1-2) are unused. Renderer is P3D but all drawing is 2D.

## Modularisation notes
The generic, reusable pieces: `annulus(x, y, r1, r2, color, alpha)` (the
polar-quad ring, lines 73-93) is a clean library primitive; the
pull-toward-centre + snap-to-grid placement (lines 55-62) is a small
composable "scatter with center bias" helper; `rcol()`-style random palette
picking is trivially generic. One-off art decisions: the exact palette
(line 103, with four commented alternates), the 10-iteration count with the
`1.8 - i*0.018` size taper (line 61), the 2x/3x/4x ring multiples (lines
66-68), and the 60/50 px snapping (lines 59, 62). A clean parameter object
would be: `{count, sizeTaper, centerPull, snapX, snapY, ringScales, ringAlpha,
palette}`.
