---
sketch: 2019/generativos/gaton
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 5224
animated: false
techniques: [subdivision]
primitives: [ellipse, shape]
palette:
  colors: ["#A19CA0", "#A98D8C", "#9E6463", "#604242", "#000000", "#B94C4F", "#FAED7D", "#7A8AD5", "#FAF8F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: sub, default: 240, tried: [120, 480], change: large, effect: "split iterations; lower = fewer, larger-dominant motifs with dark gaps; higher = denser field of more small eyes"}
  - {name: discScale, default: 0.6, tried: [1.2], change: large, effect: "multiplier on ss (cream disc size); doubling makes huge overlapping cream discs dominate and cover the background"}
  - {name: amp, default: 0.6, tried: [1.2], change: large, effect: "multiplier on iris ellipse size; doubling gives much larger red/blue/yellow irises relative to the cream discs"}
  - {name: creamAlpha, default: 240, tried: [80], change: moderate, effect: "alpha of the cream disc; lower makes discs translucent, darker background shows through, colours read duller"}
  - {name: pickBias, default: 0.2, tried: [1.0], change: large, effect: "factor in the rect pick index; 1.0 picks rects uniformly so big rects get split more - eye sizes become more uniform, fewer tiny specks"}
reusable_candidates:
  - {name: randomRectSplit, signature: "randomRectSplit(rects, iters, splitRange, pickBias) -> List<Rect>", note: "repeatedly split a random rect (biased toward small ones) vertically/horizontally into two at a random ratio"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> void", note: "annular sector between two radii with alpha gradient alp1->alp2, tessellated in cc = PI*(0.1*max(s1,s2))^2 slices"}
  - {name: eyeMotif, signature: "eyeMotif(cx, cy, w, h, palette, amp) -> void", note: "stack of concentric ellipses: halo fan, big cream disk, two colored iris ellipses, w x h ellipse, thin vertical slit"}
---

## What it draws
A full-bleed composition of scattered "eye" motifs: large flat cream/ivory discs,
each carrying one or two smaller colored discs (red, blue, yellow, mauve, black,
dark brown) that read as irises, many with a thin vertical slit line at the center.
Motif sizes range from tiny specks to huge rings spanning a quarter of the canvas;
they overlap densely, and the background shows a warm brown-to-cream gradient
(dark at the corners, pale toward the center) built up from the translucent cream
discs over a black background.

## How the code works
- `setup()` calls `generate()` (line 23); `draw()` is empty, so the sketch is static.
- `generate()` reseeds (`randomSeed`/`noiseSeed`, lines 53-54), fills black (line 59).
- **Subdivision** (lines 64-86): start with one rect covering the canvas. Repeat
  `sub = 240` times: pick an index biased toward small rects
  (`int(rects.size()*random(0.5, 1)*random(0.2))`, line 69), split it vertically or
  horizontally (50/50) at a random ratio 0.2-0.8 (lines 75-83), remove the original.
  Ends with 241 leaf rects.
- **Per-rect motif** (lines 89-115), positioned at the rect's top-left corner
  `(r.x, r.y)`:
  - `arc2` halo fan (lines 123-140): annular sector between radii
    `ss/2` and `ss*3/2`, alpha fading 30 -> 0, sliced into
    `cc = PI*(0.1*max(s1,s2))^2` quads (line 126).
  - big cream ellipse `fill(250, 250, 240, 240)`, size `ss x ss` (lines 93-94),
    where `ss = max(r.w, r.h)*random(1, 1.8)*0.6` (line 91).
  - two iris ellipses of size `r.w*amp` and `r.h*amp` (plus a `r.w x r.h` one,
    lines 111-112), `amp = random(0.5, 0.8)*0.6` (line 95), colors from `rcol()`.
  - a tiny `ss*0.02 x ss*0.004` ellipse (line 114) = the vertical slit.
- **Colour**: `rcol()` (lines 142-145) picks uniformly at random from the 8-colour
  list; the cream `#FAF8F0` is hardcoded (line 93). Overlapping alpha-240 cream
  ellipses accumulate into the pale centre; corners stay dark brown.
- Randomness enters at the split count/position, the iris sizes
  (`amp`), and every colour. `toxi`/`triangulate` are imported but unused in the
  draw path (only `SimplexNoise` import, no call).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_120 | `int sub = 240;` -> `int sub = 120;` | large (mean 0.2075, 0.674) | sparser field: fewer motifs, large cream discs dominate, broad dark empty areas (bottom band) | variants/sub_120/frame_00001.png |
| sub_480 | `int sub = 240;` -> `int sub = 480;` | large (mean 0.1815, 0.566) | much denser: many more small-to-medium eyes filling the canvas, fewer dark gaps | variants/sub_480/frame_00001.png |
| discScale_1.2 | `float ss = max(r.w, r.h)*random(1, random(1, 1.8))*0.6;` -> `... *1.2;` | large (mean 0.2142, 0.694) | cream discs ~2x, huge overlapping pale discs dominate; big black and red iris circles stand out; background nearly covered | variants/discScale_1.2/frame_00001.png |
| amp_1.2 | `float amp = random(0.5, 0.8)*0.6;` -> `float amp = random(0.5, 0.8)*1.2;` | large (mean 0.2197, 0.568) | iris ellipses ~2x: much more red/blue/yellow area, irises often larger than their cream discs | variants/amp_1.2/frame_00001.png |
| creamAlpha_80 | `fill(250, 250, 240, 240);` -> `fill(250, 250, 240, 80);` | moderate (mean 0.1062, 0.468) | translucent cream discs: dark background shows through, overall paler/washed, colours duller, more visible gaps | variants/creamAlpha_80/frame_00001.png |
| pickBias_1.0 | `int ind = int(random(rects.size()*random(0.5, 1)*random(0.2)));` -> `... *random(1.0));` | large (mean 0.2605, 0.755) | uniform rect picking splits the big rects too: eye sizes more even, fewer tiny specks, denser mid-size eyes | variants/pickBias_1.0/frame_00001.png |

## Modularisation notes
- The rect-splitting loop (lines 64-86) is generic: a "biased quadtree-ish
  subdivision" function parameterised by iteration count, split ratio range and
  pick bias; output is just a set of rects.
- `arc2` (lines 123-140) is a reusable gradient-alpha annular sector; note its
  cost scales with `max(s1,s2)^2`, so it is expensive for big discs.
- The eye motif (lines 89-115) is the art-specific composition: halo + cream disc +
  iris ellipses + slit; a clean parameter object would carry
  `{splitIters, splitRatio: [0.2, 0.8], pickBias, discScale (0.6), amp: [0.5, 0.8],
  cream: color+alpha, slitScale: (0.02, 0.004), palette}`.
- One-off decisions: the specific 8-colour palette, cream alpha 240, and the
  top-left-corner anchoring of motifs to rects.
