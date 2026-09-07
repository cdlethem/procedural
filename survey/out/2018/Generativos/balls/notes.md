---
sketch: 2018/Generativos/balls
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1802
animated: false
techniques: [packing]
primitives: [shape]
palette:
  colors: ["#C8F67B", "#5BA7F4", "#72D7E9", "#9CC4F9", "#E6B2FA", "#B8B5FE", "#F2B19F", "#C82E47", "#F9CD58", "#F06F13", "#9A46DF", "#3427CA"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 1000, tried: [300], change: large, effect: "sparser: pale background visible in many gaps, shapes read individually instead of as a dense field"}
  - {name: capsuleAngle, default: "PI*0.3", tried: ["PI*0.1"], change: moderate, effect: "capsules tilt shallower (18 deg vs 54 deg), diagonal bands run flatter across the canvas"}
  - {name: capsuleLenScale, default: "random(0.8)", tried: ["random(0.3)"], change: moderate, effect: "capsules become short stubby pills/dashes; the long parallel bands of the baseline disappear"}
  - {name: capsuleWidthFactor, default: "random(0.3)", tried: ["random(0.6)"], change: moderate, effect: "capsules noticeably thicker/chunkier relative to their length"}
  - {name: discSizeScale, default: "random(0.5)", tried: ["random(0.25)"], change: moderate, effect: "circles all about half the size; composition shifts to a field of small discs with the same capsules"}
  - {name: rimAlpha, default: 16, tried: [80], change: none, effect: "no visible change: the faint dark ring around discs stays barely visible even at 5x alpha"}
  - {name: palettePick, signature: "palettePick(colors) -> int", note: "uniform random pick from a 13-color int array"}
---

## What it draws
A dense, full-bleed scatter on a pale ice-blue ground. Two kinds of overlapping shapes: long rounded capsules, all running at the same steep diagonal (about 54 degrees, top-left to bottom-right), each split by a diagonal seam into two solid colors so the two end caps and the two half-bodies are two-tone; and circles of very varied size, each a soft two-color gradient that wraps around the disc, ringed by a faint darker halo. The 13-color palette spans lime, sky blue, cyan, lavenders, pinks, peach, red, orange, yellow, and deep indigo; the overlaps are opaque, so earlier shapes read as background where uncovered, with the pale ground visible in the sparse gaps.

## How the code works
`setup()` (lines 3-9) sets 960x960 P2D, `smooth(8)`, and calls `generate()` once; `draw()` (11-12) is empty, so the sketch is static. Any key other than `s` reseeds and regenerates (14-20).

`generate()` (22-50): fills the background `#EEF5FF` (23), calls `randomSeed(seed)` (24), `noStroke()` (26), then loops 1000 times (28). Each iteration is a 50/50 draw: `int rnd = int(random(2))` (29).

Capsule branch (30-42): random center (31-32); fixed direction `ang = PI*0.3` (33) makes every capsule parallel at 54 degrees; length `r = random(width)*random(0.1,1)*random(0.8)` (34) - a product of two uniform randoms, so short capsules dominate and long ones are rare; endpoints computed at (36-39); width `s = dist(...)*random(0.3)` (40) up to 30% of the length; drawn by `baston()` (41).

`baston()` (52-88): radius `s*0.5` (53); two independent random palette colors `c1`, `c2` via `rcol()` (54-55, 127-129). Two end caps are half-discs of `res = max(8, PI*r)` arc vertices each, filled `c1` at the start point (63-69) and `c2` at the end point (71-77). The connecting body (80-87) is a quad whose first triangle is filled `c1` and second `c2`, which produces the diagonal two-color split across the capsule middle.
| count_300 | `for (int i = 0; i < 1000; i++)` -> `for (int i = 0; i < 300; i++)` | large | sparse field: ice-blue background shows through everywhere, long capsules and scattered discs read as individual shapes | variants/count_300/frame_00001.png |
| ang_PI0.1 | `float ang = PI*0.3;` -> `float ang = PI*0.1;` | moderate | capsule direction shallower (18 deg), diagonal bands run flatter; everything else unchanged | variants/ang_PI0.1/frame_00001.png |
| capsuleLen_0.3 | `random(width)*random(0.1, 1)*random(0.8)` -> `...*random(0.3)` | moderate | capsules shorten to stubby pills/dashes, long diagonal bands gone, more disc-dominated | variants/capsuleLen_0.3/frame_00001.png |
| capsuleWidth_0.6 | `dist(...)*random(0.3)` -> `dist(...)*random(0.6)` | moderate | capsules twice as thick/chunky, still same length and angle | variants/capsuleWidth_0.6/frame_00001.png |
| discSize_0.25 | `random(width)*random(0.5)*random(0.5, 1)` -> `random(width)*random(0.25)*...` | moderate | circles roughly halved in size, dense field of small gradient discs, capsules unaffected | variants/discSize_0.25/frame_00001.png |
| rim_80 | `fill(0, 16);` -> `fill(0, 80);` | none | no visible change; the dark rim ring around discs remains faint at 5x alpha | variants/rim_80/frame_00001.png |
Disc branch (43-48): center may sit up to 100 px outside the canvas (44-45), so discs are cropped at the edges; size `s = random(width)*random(0.5)*random(0.5,1)` (46), up to 480 px; drawn by `circle()` (47).

`circle()` (90-119): `r1 = s*0.5`, `r2 = r1*1.12` (91-92), `res` segments (93-94), two random colors (95-96). First loop (98-109) draws the rim as `res` thin wedges between `r1` and `r2` filled `fill(0,16)` - a low-alpha black that reads as a faint dark ring around the disc. Second loop (111-118) fills the disc per-vertex with `lerpColor(c1, c2, i/res)`, so the color ramps once around the circumference (a conic two-color blend).

Palette: 13 colors in `colors[]` (126); `rcol()` picks uniformly (127-129). `getColor()` (130-139) lerps between adjacent palette entries but is not used by `generate()`. All shapes are opaque except the rim wedges; no blend modes, no shaders. Deterministic under the injected `seed` field (line 1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, library-worthy: the capsule (two solid caps + diagonally split body) and the conic-gradient disc with alpha rim ring are both parameterizable drawing primitives; the random-pick palette helper is trivially reusable. One-off art decisions: the 50/50 capsule/disc ratio, the single fixed angle `PI*0.3`, the specific size distributions (product-of-randoms for capsule length, `random(0.5)*random(0.5,1)` for discs), the 100-px off-canvas allowance, the 13-color palette, and the `#EEF5FF` ground. A clean parameter object: `{count, angle, capsuleLenMax, capsuleLenJitter, capsuleWidthFactor, discSizeMax, discSizeJitter, rimAlpha, offCanvasMargin, palette, background, seed}`.
