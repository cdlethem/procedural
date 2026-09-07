---
sketch: 2015/Generativos/radius
year: 2015
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 485
animated: false
techniques: [lines-hatching, dots-stippling]
primitives: [line, ellipse, rect, point]
palette:
  colors: ["#323E45", "#D96879", "#FD8579", "#FAA157", "#FFE5E3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: circles_per_group, default: 40, tried: [80], change: large, effect: "far denser circle field; nearly covers the canvas, hides hatching and background"}
  - {name: circle_size_step, default: 20, tried: [40], change: moderate, effect: "noticeably larger circles overall; coarser, more solid field"}
  - {name: line_spacing, default: "5-10", tried: [30], change: large, effect: "coarser, widely spaced diagonal hatching now clearly visible across the background"}
  - {name: border_weight, default: 16, tried: [40], change: subtle, effect: "thicker dark border frame; everything else identical"}
  - {name: blob_alpha, default: 20, tried: [120], change: subtle, effect: "soft radial gradient blobs now clearly visible (near-invisible at 20); rest identical"}
reusable_candidates:
  - {name: degrade, signature: "degrade(x, y, t, col) -> void", note: "radial gradient blob drawn as points whose alpha falls off with squared distance"}
  - {name: cruz, signature: "cruz(x, y, t) -> void", note: "x-mark: two crossing lines with random stroke weight and square cap"}
  - {name: rcol, signature: "rcol() -> color", note: "pick a random colour from a fixed palette list"}
  - {name: haloCircle, signature: "haloCircle(x, y, t) -> void", note: "concentric ellipse strokes (decreasing weight, low alpha) over a solid filled circle"}
---

## What it draws
A full-bleed 600×600 flat composition on a solid peachy-orange background. Parallel
diagonal lines (45° hatching) run across the upper part of the canvas where they are
not covered. Over this sits a dense scatter of filled circles in a five-colour palette —
dark charcoal, dusty rose, coral/salmon, orange and off-white — ranging from small to
large, each ringed by a faint concentric halo. Several thin dark square outlines of
random sizes float on top, and a thick dark border frames the whole edge. A handful of
small x-mark crosses and a few soft-edged radial colour blobs (barely visible) are
sprinkled through the field.

## How the code works
`setup()` (9) calls `generar()` once; `draw()` (16) is empty, so the piece is a single
static render (seeded, deterministic). `generar()` (22):

- **Background** (23): `background(rcol())` — a solid random palette colour (here
  orange `#FAA157`).
- **Diagonal hatching** (24–28): `tt = int(random(5,10))` sets the spacing; a loop draws
  parallel 45° lines `line(-2, i, i, -2)` across the whole canvas with
  `stroke(rcol(), 80)`. Circles drawn later cover the lower/middle band, so the lines
  read most clearly in the upper region.
- **Circle field** (30–45): 6 colour-groups (`c=0..5`) × 40 iterations = 240 circles.
  Each picks a random `(x,y)` and size `t = 10 + c*20` (grows 10→110 with `c`). It first
  paints a halo of concentric ellipses (`j=6+c` down to 1, `strokeWeight(j)`, faint
  `stroke(0,5)`, noFill) then a solid filled circle in a random palette colour (42–43).
  This produces the size-graded scattered dots.
- **Crosses** (47–57): `c = int(random(20))` groups; each emits `cc=random(1,4)` marks
  via `cruz()` (92–98) — two crossing lines with a random stroke weight and square cap,
  placed at offset positions.
- **Border** (59–62): `stroke(rcol())`, `strokeWeight(16)`, noFill, `rect(0,0,w,h)` —
  the thick framing border (a dark palette pick, so it reads near-black).
- **Squares** (64–70): `strokeWeight(8)`, 5 random squares `rect(x,y,ttt,ttt)` with
  `ttt=random(60,300)` — the thin floating square outlines.
- **Radial blobs** (72–80): `strokeWeight(1)`, 5 blobs, each a palette colour at alpha
  20, drawn by `degrade()` (82–90) which paints points whose alpha falls off with the
  squared distance from the centre → soft radial gradient.

All position, size and colour choices come from `random()` / `rcol()`, so with a fixed
seed the output is reproducible. Colour is always drawn from the 5-colour palette;
there is no noise field and no per-pixel image work.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circles_80 | `for (int i = 0; i < 40; i++)` -> `... i < 80; ...` | large | much denser field of circles; nearly covers the whole canvas, hatching and background mostly hidden | variants/circles_80/frame_00001.png |
| circlesize_40 | `float t = 10+c*20;//random(2, 80);` -> `float t = 10+c*40;//random(2, 80);` | moderate | noticeably larger circles overall; coarser, more solid field | variants/circlesize_40/frame_00001.png |
| linespace_30 | `int tt = int(random(5, 10));` -> `int tt = 30;` | large | coarser, more widely spaced diagonal hatching now clearly visible across the background; square outlines render in a lighter coral tone; circle field comparable to baseline | variants/linespace_30/frame_00001.png |
| border_40 | `strokeWeight(16);` -> `strokeWeight(40);` | subtle | thicker dark border frame; everything else identical to baseline | variants/border_40/frame_00001.png |
| blobalpha_120 | `color col = color(rcol(), 20);` -> `color col = color(rcol(), 120);` | subtle | soft radial gradient blobs now clearly visible (near-invisible at alpha 20); rest of composition identical | variants/blobalpha_120/frame_00001.png |

## Modularisation notes
- **Generic / reusable**: `degrade()` (radial gradient blob from alpha-falloff points),
  `cruz()` (x-mark), `rcol()` (random palette pick), and the halo+fill circle loop
  (30–45) are all self-contained and palette-agnostic — strong library candidates.
- **One-off art decisions**: the fixed 5-colour `paleta[]`, the specific layering order
  (hatching → circles → crosses → border → squares → blobs), the 6×40 circle grid with
  size graded by group index, and the 45° `line(-2,i,i,-2)` diagonal scheme.
- **Clean parameter object**: `{ palette[], bg = rcol(), hatch {spacing, alpha, angle},
  circles {groups, perGroup, sizeBase, sizeStep, haloAlpha}, crosses {count, weight},
  border {weight, color}, squares {count, weight, sizeRange}, blobs {count, alpha,
  sizeRange}, seed }`.
