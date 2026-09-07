---
sketch: 2018/Generativos/diario
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2105
animated: false
techniques: [grid, dots-stippling, symmetry]
primitives: [rect, ellipse, point, shape]
palette:
  colors: ["#000000", "#FFFFFF", "#807DDB", "#ED829D", "#E8D84E", "#F23E35", "#4B13C4", "#6D915F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(20,29)) = 23 here", tried: [40], change: large, effect: "finer 40x40 grid; also shifts the random stream (constant replaced a random() call) so c1/c2 and every overlay position re-roll: grid cells turn black, dots red, shapes rearranged"}
  - {name: cellInset, default: 2, tried: [8], change: moderate, effect: "grid gaps widen from 2 px to 8 px; red cells shrink and the pink lattice reads much stronger"}
  - {name: dotProb, default: 0.1, tried: [0.5], change: subtle, effect: "black intersection dots on ~50% of nodes instead of ~10%; dots are small so the pixel diff stays subtle"}
  - {name: rectCount, default: 30, tried: [8], change: moderate, effect: "far fewer grainy rectangles; canvas less busy. Fewer loop iterations also shift the circle stream, so the five circles re-roll to new positions/colors"}
  - {name: circleSize, default: "width*random(0.05,0.2)", tried: ["width*random(0.1,0.5)"], change: moderate, effect: "circles 2-5x bigger, several now dominate the canvas (giant red, white, black discs); same positions, same stream"}
  - {name: bgLerp, default: 0.2, tried: [0.8], change: subtle, effect: "background becomes saturated red-orange and the pale pink grid lines almost disappear into it; composition unchanged"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "ring drawn as closed quad strips between two radii, per-segment alpha"}
  - {name: stippleDisc, signature: "stippleDisc(cx, cy, s, count, col, maxAlpha)", note: "random points in a disc with sqrt-biased radius for uniform density"}
---

## What it draws
A flat red-orange field (seed 42 chose `#F23E35` as the grid fill) crossed by pale pink
grid lines forming ~23x23 rounded square cells, with solid black dots sitting on roughly
10% of the grid intersections. Scattered over the grid are ~30 rotated rectangles in
yellow, green, purple, pink, white, black and blue, each grainy with sparse dots. Five
large circles (a big pink one, two violet-blue, one yellow) carry dark stippled
interiors and a few faint concentric arc rings. Overall: a busy, Mondrian-meets-grain
collage, flat, no shading, full-bleed.

## How the code works
`setup()` (diario.pde:3-9) sizes 960x960 P2D and calls `generate()`; `draw()` is empty,
so the piece is one-shot and static. `keyPressed` re-rolls the seed (line 14-20).

`generate()` (line 22):
1. `background(lerpColor(color(240), rcol(), 0.2))` (line 26) — light gray blended 20%
   toward a random palette color; with red drawn it reads as pale pink.
2. Grid (lines 29-42): `cc = int(random(20,29))` cells across; each cell is a `rect`
   inset by 2 px with corner radius 3, filled `c1 = rcol()`; with probability 0.1 an
   `ellipse` of size `ss*0.4` in a second palette color `c2` is drawn on the
   intersection — the black dots (here `c2` was black).
3. Global grain (lines 44-47): `width*height` (=921,600) random white points, alpha
   <16, over the whole canvas.
4. Rectangles (lines 49-67): 30 iterations; each a random position, size
   `width*random(0.04, random(0.2))`, random rotation, `noStroke`, `rcol()` fill, then
   `w*h*2` random dots inside in `rcol()` with alpha <20 — the grainy scattered
   rectangles.
5. Circles (lines 112-155): 5 iterations; centers snapped to the grid (`cx -= cx%ss`),
   size `s = width*random(0.05, 0.2)`, one `rcol()`. Solid `ellipse`, then two `arc2`
   rings (lines 125-126) at 1.6x and 1.1x the radius in black with alpha 12/4 — the
   faint concentric rings. `arc2` (line 163-181) builds the ring as many closed quad
   strips between an inner and outer radius, each strip filled with the given
   per-vertex alpha. Then `area = s^2*0.5*PI` dark points (alpha <40) inside the disc
   with a sqrt-of-random bias, and `area*0.6` points of the circle's own color just
   outside the disc (radius 1..1.5x) — the halo of colored speckle.
6. Lines 69-97 and 102-110 are commented-out earlier experiments (a second grid with
   per-cell grain, and a `pelis`-based bottom-anchored blob loop) — not executed.

Randomness enters only via `randomSeed(seed)` (line 24): palette picks, the 0.1 dot
probability, rectangle transforms, circle centers/sizes, and every stipple point.
Note: the draw order is a single shared `random()` stream, so changing any count or
replacing any `random()` call re-rolls everything downstream (visible in the cc_40 and
rectCount_8 variants).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = int(random(20, 29));` -> `int cc = 40;` | large | fine 40x40 black grid with small red dots at ~10% of intersections; overlay shapes and circle colors all rearranged (stream shift from replacing the random() call) | variants/cc_40/frame_00001.png |
| inset_8 | `rect(i*ss, j*ss, ss-2, ss-2, 3);` -> `ss-8, ss-8` | moderate | same composition, but grid gaps 4x wider: red cells visibly smaller, pink lattice much stronger | variants/inset_8/frame_00001.png |
| dotProb_0.5 | `if(random(1) < 0.1)` -> `< 0.5` | subtle | black dots now on most intersections instead of ~10%; dots stay small so overall diff is subtle | variants/dotProb_0.5/frame_00001.png |
| rectCount_8 | `for (int i = 0; i < 30; i++)` -> `i < 8` | moderate | only 8 grainy rectangles, canvas far less busy; circles re-rolled to new positions/colors (fewer consumed randoms) | variants/rectCount_8/frame_00001.png |
| circleSize_0.1_0.5 | `float s = width*random(0.05, 0.2);` -> `random(0.1, 0.5)` | moderate | same 5 circle positions but 2-5x larger; giant red, white, black and yellow discs now dominate, rings/halos scale with them | variants/circleSize_0.1_0.5/frame_00001.png |
| bgLerp_0.8 | `lerpColor(color(240), rcol(), 0.2)` -> `0.8` | subtle | background saturated red-orange; pale pink grid lines nearly vanish into it, grid reads as faint red-on-red texture | variants/bgLerp_0.8/frame_00001.png |

## Modularisation notes
- `arc2` is a clean, self-contained ring primitive (two radii, angle span, two alpha
  values per segment) — reusable as-is for any stippled/ring composition.
- The grid block (lines 29-42) is a generic "grid of rounded cells with optional
  intersection accents": parameterize cell count, inset, corner radius, accent
  probability/size/color.
- The stipple loops (global grain, in-rect grain, in-disc grain with sqrt-biased
  radius for perceptual uniformity) are all the same idea: N points sampled in a
  region with a low-alpha `point()`; a single `stipple(region, n, col, maxAlpha)`
  with pluggable sampler covers them.
- One-off art decisions: the specific 8-color palette, the lerp-with-gray background,
  the 30-rect / 5-circle counts, grid-snapping of circle centers, and the per-layer
  alpha ceilings (16/20/40).
- A clean parameter object: `{seed, cellCount, cellInset, cornerRadius, dotProbability,
  dotSize, grainCount, rectCount, rectSizeRange, circleCount, circleSizeRange,
  ringRadii, palette}`.
- A library port should decouple the single shared random stream: give each layer its
  own derived seed, otherwise changing one parameter (e.g. loop count) re-rolls all
  later layers, as the cc_40 and rectCount_8 experiments show.
