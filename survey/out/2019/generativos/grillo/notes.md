---
sketch: 2019/generativos/grillo
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1482
animated: false
techniques: [subdivision, grid]
primitives: [rect, ellipse]
palette:
  colors: ["#BF0505", "#F7B72E", "#A6BED8", "#EA529B", "#DDDAC9", "#F0F0F0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 200, tried: [60, 500], change: large, effect: "lower = fewer, much larger blocks; higher = many thin strips, busier"}
  - {name: splitRange, default: "random(0.2, 0.8)", tried: ["random(0.4, 0.6)"], change: moderate, effect: "near-50/50 splits -> more uniform cell sizes, fewer extreme thin strips"}
  - {name: shadowAlpha, default: 140, tried: [40], change: subtle, effect: "fainter drop shadows; layout and colour unchanged"}
  - {name: knobScale, default: 0.12, tried: [0.25], change: moderate, effect: "centred discs ~2x bigger; some now exceed the smallest rects"}
reusable_candidates:
  - {name: splitRects, signature: "splitRects(seed, iterations, splitRange) -> Rect[]", note: "stochastic binary subdivision of the canvas into a Mondrian-like set of overlapping rects"}
  - {name: rectWithKnob, signature: "rectWithKnob(x, y, w, h, color, shadowAlpha, knobScale) -> void", note: "drop-shadow rect plus a centred circular dial (shadow disc + coloured disc + small centre dot)"}
---

## What it draws
A flat, Bauhaus/Mondrian-style composition filling the whole 960×960 canvas edge to edge. Dozens of overlapping rectangles in a warm five-colour palette (deep red, gold, light blue, magenta-pink, cream) sit on a light grey ground. Each rectangle casts a soft dark drop shadow offset down-right, and most carry a round "knob" centred on it: a pale disc with a darker rim shadow and a small solid centre dot, giving a button/dial look. The rectangles range from thin horizontal strips to large blocks, densely tiled, with fine vertical slivers piling up along the right edge.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty → a single static frame (grillo.pde:21-32).
- `generate()` paints `background(240)` light grey (46), seeds `noiseSeed`/`randomSeed` from `seed` (48-49), then starts from one full-canvas `Rect(0,0,width,height)` (52).
- Subdivision loop (54-73): `sub = 200` iterations. Each iteration picks a random existing rect with a skewed index `int(random(rects.size()*random(0.5,1)*random(0.01)))` that favours low indices (56), nudges its origin by up to ±10 px (59-60), then splits it into two children either across the width (split at `random(0.2,0.8)` of `r.w`, line 63) or down the height (67), appends both and removes the original (72). Net +1 rect per pass → ~200 final rects.
- Draw loop (76-89): `noStroke()`. For every rect: a drop-shadow rect at `(r.x+2, r.y+2)` in black `fill(0,140)` (78-79); the main rect in a random palette colour `fill(rcol(),250)` (80-81); then a centred circle — a shadow ellipse at `(+2,+2)` black `fill(0,80)` sized `ss*5` (83-84), a coloured ellipse the same size (85-86), and a small solid centre dot `ss*0.4` (87-88), where `ss = min(r.w,r.h)*0.12` (82).
- Colour: `rcol()` (106-108) returns a random entry of the fixed 5-colour array `colors[]` (105). `getColor()` (109-118, a `lerp-between` variant) is defined but not used by `generate()`.
- `settings()` (14-19) sets `size(...,P3D)`, `smooth(8)`, `pixelDensity(2)` for antialiased edges (the P3D renderer is why the import/jars load, though no toxi noise is actually sampled in `generate()`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_60 | `int sub = 200;` -> `int sub = 60;` | large | ~60 rects: coarse layout of big blocks and long strips, few large knobs, no right-edge sliver pile | variants/sub_60/frame_00001.png |
| sub_500 | `int sub = 200;` -> `int sub = 500;` | large | ~500 rects: dense grid of thin horizontal strips and a column of vertical slivers, many small knobs, very busy | variants/sub_500/frame_00001.png |
| split_040 | `float mw = r.w*random(0.2, 0.8);` -> `random(0.4, 0.6);` | moderate | near-even splits: cell sizes more uniform, less contrast between big blocks and thin strips | variants/split_040/frame_00001.png |
| shadow_40 | `fill(0, 140);` -> `fill(0, 40);` | subtle | drop shadows much fainter/softer; same layout and colours, essentially the same picture with lighter shadows | variants/shadow_40/frame_00001.png |
| knob_025 | `float ss = min(r.w, r.h)*0.12;` -> `*0.25;` | moderate | centred discs ~2x larger, several now bigger than their host rect, dominant overlapping circles | variants/knob_025/frame_00001.png |

## Modularisation notes
The generic, reusable core is the stochastic subdivision (`splitRects`): seeded RNG, a skewed rect selection, jitter, and a binary split at a random ratio — a clean parameter object would be `{seed, iterations, jitter, splitRange}` returning a flat `Rect[]`. The renderer `rectWithKnob` is a second generic primitive (drop-shadow rect + centred dial) parameterised by `{shadowAlpha, knobScale}` and a colour. The one-off art decisions are the fixed 5-colour palette, the +2 px shadow offset, the specific shadow alphas (140/80), and the `0.12` knob scale. `rcol()`/`getColor()` are both trivial; only `rcol()` is used.
