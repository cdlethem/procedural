---
sketch: 2018/Generativos/blobs
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2071
animated: false
techniques: [curves, polar]
primitives: [shape]
palette:
  colors: ["#5C9FD3", "#F19DA2", "#FEED2D", "#9DC82C", "#33227E"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cc, default: 3, tried: [5], change: large, effect: "control points per blob; more = rounder, softer petal-like outlines"}
  - {name: blobCount, default: 400, tried: [100], change: large, effect: "number of blobs; fewer = sparser field, more background shows through"}
  - {name: sizeRange, default: "0.02-0.2", tried: "0.1-0.4", change: large, effect: "per-blob size as fraction of width; larger = bigger blobs, heavier overlap, fuller coverage"}
  - {name: dd, default: 1.4, tried: [2.2], change: moderate, effect: "shadow offset scale about blob center; larger = bigger dark echo behind each blob"}
  - {name: amp, default: 0.6, tried: [2.0], change: subtle, effect: "colour oscillation amplitude; higher = wider hue sweep around a blob (barely visible)"}
reusable_candidates:
  - {name: Spline, signature: "Spline(ArrayList<PVector> pts) -> getPointLin(v), getPoint(v), getCenter(), length", note: "closed Catmull-Rom spline (curvePoint) through control points, with arclength table + center"}
  - {name: makeBlob, signature: "makeBlob(size, controlCount, baseColor, amp, dd) -> radial fan of triangles with angular color gradient + semi-transparent offset shadow", note: "the 400-blob generation block in generate()"}
---

## What it draws
A dense full-bleed field of 400 overlapping organic "blob" shapes on a flat
single-colour background (a random palette colour; here a yellow-green). Each
blob is a rounded triangular teardrop made of many thin radial fan-slices,
coloured with a smooth gradient that sweeps around its ring (blue, pink, yellow,
green, dark purple). Under each blob a faint dark, slightly enlarged copy gives
a soft offset shadow, so the shapes read as layered paper cut-outs scattered
and piled over one another.

## How the code works
`setup()` (3-8) opens a 960x960 P2D window, calls `pixelDensity(2)` (warns
"not available for this display" and falls back to 1), and runs `generate()`;
`draw()` (10-11) is empty, so the image is fully static (frames 1/10/60
identical).

`generate()` (21-72) paints `background(rcol())` — one random palette colour
(line 22) — then loops 400 times (line 27):
- `ss = width*random(0.02, 0.2)` (29) sets the blob's size range; `cc = 3` (30)
  is the number of control points.
- 3 control points are placed at random within `[-ss, ss]` (31-33) and wrapped
  in a `Spline` (34): a closed Catmull-Rom curve (`curvePoint` in
  `calculatePoint`, 140-150) through the points, with an arclength table
  (`calculate`, 83-99) and a center = mean of the control points (`getCenter`,
  160-167).
- The blob is translated to a random position (37); `amp = random(0.6)*random(1)`
  (38) is the colour oscillation amplitude; `dd = 1.4` (42) is the shadow
  scale; `len = int(spline.length)` (43) is the number of fan slices (the spline
  perimeter in px, so a few hundred per blob).
- Pass 1 (44-54) draws every fan triangle `(p1, p2, center)` but scaled about
  the center by `dd` (46-47) with `fill(0, 40)` (51) — a translucent dark copy
  slightly larger than the blob, which produces the soft offset shadow.
- Pass 2 (58-69) draws the same fan with colour: each triangle's two ring
  vertices are filled with `getColor(col + cos(map(i,0,len,0,TWO_PI))*amp)`
  (62,64), so hue sweeps around the ring once; the center vertex uses a nearby
  random `ccol` (57,66).
- `getColor(float)` (186-192) wraps `v` over the 5-colour list and lerps between
  adjacent entries, so colours blend smoothly between palette neighbours.
- `rcol()` (180-182) picks a random palette colour for the background.

Randomness enters via the seed field (line 1) and the many `random()` calls in
`generate()`. No blend modes, no noise, no shaders — just overlapping alpha
translucency.

## Experiments
| variant | substitution | change score | observation | image |
| cc_5 | `int cc = 3;` -> `int cc = 5;` | large | blobs become rounder/softer (5-point splines) and more petal/teardrop-like, less sharp triangular; denser-looking pile-up | variants/cc_5/frame_00001.png |
| count_100 | `for (int j = 0; j < 400; j++)` -> `... j < 100 ...` | large | far fewer blobs; much more green background shows through, blobs larger and less piled-up | variants/count_100/frame_00001.png |
| size_0.4 | `float ss = width*random(0.02, 0.2);` -> `... random(0.1, 0.4);` | large | blobs much bigger, far heavier overlap, canvas almost fully covered (little background left) | variants/size_0.4/frame_00001.png |
| dd_2.2 | `float dd = 1.4;` -> `float dd = 2.2;` | moderate | the offset dark shadow copy is larger, giving a more pronounced dark echo/halo behind each blob | variants/dd_2.2/frame_00001.png |
| amp_2.0 | `float amp = random(0.6)*random(1);` -> `... random(2.0)*random(1);` | subtle | no visible change at a glance; only a slightly wider hue range within individual blobs, overall field looks the same | variants/amp_2.0/frame_00001.png |

## Modularisation notes
The `Spline` class (74-168) is fully generic: a closed Catmull-Rom spline with
arclength sampling, a center, and a total length — a direct library candidate
(`Spline(points)` exposing `getPointLin`, `getPoint`, `getCenter`, `length`).

`makeBlob` (the per-iteration block 27-71) is the art-specific core and also
factorises cleanly as
`makeBlob(size, controlCount, baseColor, amp, shadowScale)`:
build a random N-point closed spline, then emit two radial fan passes (an
offset translucent dark copy for depth, and a colour-swept copy whose hue
oscillates once around the ring). The `dd` shadow scale, the `amp` colour
amplitude, `cc` control count, and the per-blob size range `ss` are the natural
parameters of that function.

One-off art decisions: the fixed 5-colour palette (178) and its
lerp-between sampling, the 400-blob count (27), the `fill(0,40)` shadow alpha
(51), and `dd = 1.4` (42). A clean parameter object for this sketch would hold:
`blobCount`, `sizeRange [lo,hi]`, `controlCount`, `colorAmp`, `shadowScale`,
`shadowAlpha`, and the palette list.
