---
sketch: 2020/generative/01_04/mmmta
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1519
animated: false
techniques: [subdivision, packing]
primitives: [shape]
palette:
  colors: ["#F78316", "#FAFFA5", "#679BEA", "#D2D3E0", "#FFFFFF"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: iterations, default: 40, tried: [15, 80], change: subtle, effect: "15 = fewer, larger, rounder blobs, slivers almost gone; 80 = more, smaller, sharper shards"}
  - {name: alpha, default: 220, tried: [80], change: subtle, effect: "layout unchanged; all fills faded/washed out"}
  - {name: vertexProb, default: 0.1, tried: [0.4], change: none, effect: "no visible change per diff; shapes read slightly smoother and more circular"}
  - {name: fillFactor, default: 0.8, tried: [1.2], change: subtle, effect: "shapes grow past their cells; big shapes now overlap neighbours"}
  - {name: palette, default: "{#F78316,#FAFFA5,#679BEA,#D2D3E0,#FFFFFF}", tried: ["{#163099,#E02311,#F783C4,#FCFAEF,#FCB346}"], change: subtle, effect: "warm brown/pink/orange/cream replaces the pastel blue/lavender"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(x, y, w, h, iterations, fracMin, fracMax) -> Rect[]", note: "recursively split a rectangle into two, at random ratio, until a budget of splits is used; leaves are the output cells"}
  - {name: jitteredCircle, signature: "jitteredCircle(x, y, radius, vertexProb, res) -> closedShape", note: "polygon whose vertices are sampled at random angles; low vertexProb gives spiky shards, high gives smooth blobs"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], v) -> color", note: "pick two adjacent palette entries by fractional index and lerp with pow(v%1, 0.9)"}
---

## What it draws
Scattered flat polygons of very uneven size on a white background, like a confetti field of crystals and blobs. The larger ones read as soft, rounded irregular discs (peach, periwinkle blue, pale lavender-grey); the smaller ones are sharp shards and slivers (orange, yellow, blue). Colours are pastel and mostly light, with a few saturated orange accents. There is no overlap structure — the shapes float independently, some tiny, some large, spread across the whole canvas.

## How the code works
`generate()` (mmmta.pde:56) clears to white, seeds random/noise from `seed` (line 4, set by the harness). It starts with one inset rectangle (`bb = 60` margin, line 63-65) and runs a recursive subdivision 40 times (line 67-80): each iteration picks a random rect from the list, splits it once either vertically or horizontally at a random ratio between 0.25 and 0.75 (lines 70-78), pushes the two children, and removes the parent. After 40 splits the list holds 41 leaf rectangles of wildly different sizes (early splits are big, late splits are slivers).

Each leaf rect gets one filled shape at its centre (lines 82-110): `cir(cx, cy, min(r.w,r.h)*0.8)` (line 108). `cir` (lines 113-126) builds a closed polygon by walking around the circle in `res = r*PI*0.8` angular steps, but only emits a vertex with probability 0.1 (line 120); with a random angular offset `id` (line 117). Few kept vertices => jagged crystal shards; the effective vertex count scales with radius, so big cells get more vertices and look like rounded blobs. Fill is `getColor()` with alpha 220 (line 107): `getColor` (lines 142-151) takes a random value, picks two adjacent entries of the 5-colour palette (line 137) by fractional index, and lerps with `pow(v%1, 0.9)`, so most shapes land near a pure palette colour with slight mixing. P3D renderer with `smooth(8)` (line 18-19). A commented-out block (lines 85-105) shows an earlier version that filled the rects as two-tone quads instead of circles.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iter_15 | `for (int i = 0; i < 40; i++) {` -> `i < 15` | subtle | fewer, much larger, rounder blobs; the field is dominated by a few big discs and slivers are nearly gone | variants/iter_15/frame_00001.png |
| iter_80 | `i < 40` -> `i < 80` | subtle | more, smaller, sharper shapes; denser field of blue shards and slivers | variants/iter_80/frame_00001.png |
| alpha_80 | `fill(getColor(), 220);` -> `fill(getColor(), 80);` | subtle | same layout; every fill faded and washed out (pale orange, light blue, near-white) | variants/alpha_80/frame_00001.png |
| vertexProb_0.4 | `if (random(1) < 0.1) {` -> `< 0.4` | none | no visible change per diff score; shapes read slightly smoother and more circular, slivers shrink to dots | variants/vertexProb_0.4/frame_00001.png |
| fillFactor_1.2 | `min(r.w, r.h)*0.8` -> `*1.2` | subtle | shapes overflow their cells; the big blobs now overlap each other (e.g. top-left lavender over peach) | variants/fillFactor_1.2/frame_00001.png |
| palette_warm | palette line -> `{#163099, #E02311, #F783C4, #FCFAEF, #FCB346}` | subtle | same layout; warm brown, pink, orange and cream replace the pastel blue/lavender | variants/palette_warm/frame_00001.png |

## Modularisation notes
- **Generic, reusable:** `subdivideRects` (random binary space partition with a fixed split budget) is a clean, self-contained cell generator — only depends on `Rect`. `jitteredCircle` (probabilistic angular sampling) is a one-shot shape primitive parameterised by vertex probability; the vertex count scaling with radius (`res = r*PI*0.8`) is a nice detail worth keeping. `lerpPalette` is a small palette sampler.
- **One-off art decisions:** the `bb = 60` inset margin, the 40-split budget, the 0.25-0.75 split ratio range, alpha 220, the `*0.8` cell-fill factor, vertex probability 0.1, and the specific pastel 5-colour palette.
- **Clean parameter object:** `{width, height, margin, iterations, splitMin, splitMax, fillFactor, alpha, vertexProb, palette, seed}` — everything that currently hardcodes a look is one of these; the loop structure itself is fully parameterised by `iterations` and the ratio range.
