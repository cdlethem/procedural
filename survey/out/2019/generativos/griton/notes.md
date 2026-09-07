---
sketch: 2019/generativos/griton
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1502
animated: false
techniques: [subdivision, blend-modes]
primitives: [rect, shape]
palette:
  colors: ["#BF0505", "#F7B72E", "#A6BED8", "#EA529B", "#DDDAC9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 1200, tried: [400], change: large, effect: "fewer iterations = visibly larger, coarser blocks and fewer thin slivers"}
  - {name: pickBias (random(0.6,1) lower bound), default: 0.6, tried: [0.2], change: large, effect: "layout fully reshuffled; same mix of big blocks and thin strips (bias only shifts which rects get split)"}
  - {name: baseAlpha, default: 250, tried: [120], change: subtle, effect: "blocks slightly more translucent; overall impression nearly unchanged"}
  - {name: bandAlpha (alp), default: 200, tried: [80], change: moderate, effect: "gradient streaks much softer; image reads flatter, more white/cream shows through"}
  - {name: streakAmp (random(24) bound), default: 24, tried: [2], change: moderate, effect: "directional gradient streaks become short; mosaic look, less haze"}
  - {name: palette, default: "{#BF0505,#F7B72E,#A6BED8,#EA529B,#DDDAC9}", tried: ["{#1B3A5C,#3D7EA6,#7FB7BE,#C9D6E0,#2E4A3F}"], change: large, effect: "identical composition, entirely cool navy/steel-blue/teal/green instead of red/amber/pink"}
reusable_candidates:
  - {name: randomRectSubdivide, signature: "randomRectSubdivide(count, splitBias) -> Rect[]", note: "start with full canvas, repeatedly pick a random rect and replace it with 4 sub-rects (2 splits, 2 random ratios); bias weights which rects get picked"}
  - {name: gradientBand, signature: "gradientBand(r, edge, amp) -> quad vertices", note: "translucent quad fading alpha 200->0 outward from one edge of a rect, giving soft directional streaks"}
---

## What it draws
A chaotic full-bleed stack of semi-transparent rectangles in red, amber/orange, pink, pale blue and cream.
Large flat colored blocks form the underlayer, while many thin horizontal and vertical strips overlap them.
Over everything sit soft gradient streaks — bands that are solid near one edge of a rectangle and fade to
transparent — which read as light flares and give the image its hazy, layered depth. No background is
visible; coverage is complete.

## How the code works

`settings()` opens a 960x960 P3D window (`griton.pde:14-19`). `generate()` fills a gray `background(240)`
(line 46), seeds with the harness `seed` field, and builds an `ArrayList<Rect>` starting from the full
canvas (lines 51-52). The core loop (lines 55-80) runs `sub = 1200` iterations: it picks an index with
`int(rects.size()*random(0.6, 1))` (line 56) — the 0.6-1.0 multiplier biases selection toward the *later*
entries in the list, i.e. recently created (smaller) rects, so subdivision keeps splitting small pieces and
produces a mix of one large survivor plus a forest of tiny slivers. Each picked rect is replaced by 4
sub-rects: two random ratios split it horizontally or vertically (lines 59-77), and two of the four are
added with probability 0.8 (lines 64, 67, 73, 76) — occasionally 3 or 5 rects are added per step. The
picked rect is then removed (line 79), so the list size grows by ~2-3 per iteration, ending with roughly
2600-3600 rects.

Rendering (lines 82-179): `noStroke()`, and 20% of rects are skipped entirely (`random(1) > 0.8`, line 85).
Each drawn rect gets `fill(rcol(), 250)` — a random palette color at alpha 250, so blocks are nearly
opaque but still let faint underlayers through (line 98). On top of each rect, one `beginShape(QUADS)`
draws two quads: the first is a fade band *inside* the rect — solid at alpha 200 on one edge (chosen from
left/right/top/bottom by nested coin flips, lines 103-136) fading to alpha 0 at the 40%/60% position of the
perpendicular axis; the second quad extends *outside* the rect's edge by `amp = random(24)` times the
dimension (line 140), solid alpha 200 fading to 0 (lines 139-176). Those outside quads are the long
directional streaks visible in the image. Color is always `rcol()` (lines 196-198), a uniform pick from
the 5-color array (line 195). `noiseSeed`/toxi are imported but never actually sampled; all randomness is
`randomSeed`-driven, which is why the baseline is deterministic. `draw()` is empty (lines 31-32): one-shot
image.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_400 | `int sub = 1200;` -> `int sub = 400;` | large (0.1935, 0.781) | blocks clearly larger and coarser, fewer thin slivers; reads as a coarser mosaic | variants/sub_400/frame_00001.png |
| pickbias_0.2 | `int ind = int(random(rects.size()*random(0.6, 1)));` -> `random(0.2, 1)` | large (0.1983, 0.795) | completely different layout but the same mix of big blocks and thin strips; lowering the pick bias mainly reshuffles, doesn't rescale | variants/pickbias_0.2/frame_00001.png |
| basealpha_120 | `fill(rcol(), 250);` -> `fill(rcol(), 120);` | subtle (0.0342, 0.108) | subtle: blocks a touch more translucent, faint underlayer bleeds through a little more; overall impression close to baseline | variants/basealpha_120/frame_00001.png |
| bandalpha_80 | `float alp = 200;` -> `float alp = 80;` | moderate (0.081, 0.34) | gradient streaks noticeably weaker and softer; image reads flatter with more white/cream showing through | variants/bandalpha_80/frame_00001.png |
| streakamp_2 | `float amp = random(24);` -> `float amp = random(2);` | moderate (0.142, 0.545) | same block structure but the long directional streaks are much shorter; more mosaic-like, less haze | variants/streakamp_2/frame_00001.png |
| palette_cool | `int colors[] = {#BF0505, ...};` -> `{#1B3A5C, #3D7EA6, #7FB7BE, #C9D6E0, #2E4A3F};` | large (0.2739, 0.906) | identical composition, entirely cool: dark navy, steel blue, teal, pale blue, dark green | variants/palette_cool/frame_00001.png |

## Modularisation notes
Two generic blocks: (1) the rect-subdivision loop — a "stochastic guillotine subdivision" that could be a
library function `randomRectSubdivide(count, pickBias, dropProbability)` returning the final rect set,
independent of any rendering; the `random(0.6, 1)` pick bias is the key parameter controlling size
distribution (low bias = few large blocks, high = many slivers). (2) the fade-band quad — a small
`gradientBand(rect, edge, extent)` helper producing the 4 vertices + 2 alphas used for both the inner
40/60% band and the outer streak. One-off art decisions: the 5-color palette, the 20% skip probability,
the 250/200/0 alpha values, the `random(24)` streak extent (deliberately huge, 2.4-24x the rect size),
and the P3D renderer (needed only so `smooth(8)`/alpha blending look the same as the original setup).
A clean parameter object: `{seed, count, pickBias, dropP, skipP, baseAlpha, bandAlpha, bandPos, streakAmp, palette}`.
