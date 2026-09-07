---
sketch: 2019/generativos/laditos
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1562
animated: false
techniques: [subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#320399", "#E07AFF", "#EA1026", "#FFD70F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(10,30)*0.8)", tried: [8], change: large, effect: "fewer splits = fewer, wider strips; large flat fields, wide red strip with only a few big squares"}
  - {name: div, default: "random(0.25,0.75)", tried: ["random(0.05,0.15)"], change: large, effect: "uneven ratios = one giant strip dominates plus a dense cluster of hairline slivers with tiny squares"}
  - {name: colors, default: "4-colour vivid list", tried: ["6-colour pastel list"], change: large, effect: "same structure, whole image in soft pastels (pale yellow, pink, sky blue, orange, white, grey)"}
  - {name: dd, default: "r.w*random(0.2,0.3)", tried: ["r.w*random(0.45,0.55)"], change: moderate, effect: "squares ~2x wider, filling most of each strip; fewer rows, background mostly hidden"}
  - {name: gradient chance, default: "0.2", tried: [0.8], change: large, effect: "almost every square becomes a vertical two-colour gradient (yellow-to-blue, red-to-purple); solid squares mostly gone"}
  - {name: alp1, default: "random(50)", tried: ["random(150)"], change: subtle, effect: "half-strip black shading clearly stronger: visible dark vertical band along one edge of many strips"}
reusable_candidates:
  - {name: subdivideColumn, signature: "subdivideColumn(rect, nSplits, ratioMin, ratioMax) -> Rect[]", note: "recursively split a rect into vertical strips of random widths"}
  - {name: squiggleRow, signature: "squiggleRow(x, y, w, n, offset, skipChance) -> quad[]", note: "column of offset quads with random gaps"}
---

## What it draws
A full-bleed 960x960 composition of vertical strips of very different widths, from hairline slivers to columns ~200 px wide. Each strip has a flat background colour (light purple, red, yellow, or dark blue) and carries a single column of small squares down its length; narrower strips hold smaller, more numerous squares, wider strips hold fewer big ones. The squares zigzag left/right between rows, with random gaps, and about one in five is a smooth vertical two-colour gradient (e.g. yellow fading into dark blue) instead of a solid fill. A wide red strip on the right is dominated by three large squares, one of them a yellow-to-blue gradient.

## How the code works
`setup()` calls `generate()` once (`draw()` is empty), so the image is static and deterministic for a given seed (lines 22–33, 55–56).

1. **Strip subdivision** (lines 63–80): start with one rect covering the canvas; `sub = int(random(10,30)*0.8)` times (≈8–24) pick a random strip, split it at a random ratio `div = random(0.25, 0.75)` into two side-by-side strips, drop the original (strips < 4 px wide are skipped, line 70). This produces the columns of strongly varying width.
2. **Strip fill + half-shade** (lines 82–101): each strip gets `fill(rcol())` — a uniformly random palette colour — and a `rect()`. Then a two-colour quad overlays either the left or right half of the strip with black at alpha `random(50)` (alternating by strip index, lines 87–92), giving a subtle vertical shade on one edge.
3. **Square column** (lines 104–125): square size `dd = r.w*random(0.2,0.3)`, row count `cc = height/r.w + 2` (so thin strips get many rows, wide strips few), and a per-row vertical jitter `dy` whose sign alternates by strip index, producing the zigzag. 20% of rows are skipped (line 113), making the gaps.
4. **Per-quad colouring** (lines 114–121): each square is a 4-vertex `beginShape` whose top two vertices use one random palette colour and, with 20% probability, whose bottom two vertices use a *different* random colour. P2D interpolates per-vertex fills, so those quads render as vertical gradients; the rest are solid. This is the only source of the gradient squares.

Randomness enters only through `random()`/`randomSeed(seed)`; noise and the triangulate/toxi imports are unused. Palette is the fixed 4-colour list at line 140.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_8 | `int sub = int(random(10, 30)*0.8);` -> `int sub = 8;` | large | fewer, wider strips: big flat purple field on the left, a wide red strip carrying only three big squares (one yellow-to-blue gradient); thin strips still present but sparser, with many tiny squares | variants/sub_8/frame_00001.png |
| div_uneven | `float div = random(0.25, 0.75);` -> `float div = random(0.05, 0.15);` | large | extreme imbalance: a huge yellow strip takes the right two-thirds (one giant red square on it) while the left third collapses into a dense band of hairline slivers with very small squares | variants/div_uneven/frame_00001.png |
| pastel_palette | `int colors[] = {#320399, #E07AFF, #EA1026, #FFD70F};` -> 6-colour pastel list | large | identical structure, all colours swapped for soft pastels (pale yellow, pink, sky blue, orange, white, grey); squares and gradients all pastel | variants/pastel_palette/frame_00001.png |
| dd_bigger | `float dd = r.w*random(0.2, 0.3);` -> `float dd = r.w*random(0.45, 0.55);` | moderate | squares roughly double in width and fill most of each strip; rows are bigger and fewer, zigzag offset more visible, strip backgrounds mostly covered | variants/dd_bigger/frame_00001.png |
| gradient_0.8 | `if (random(1) < 0.2) fill(rcol());` -> `if (random(1) < 0.8) fill(rcol());` | large | nearly every square is a vertical two-colour gradient (yellow-to-blue, red-to-purple, orange-to-red); the image reads as soft and blended, solid squares rare | variants/gradient_0.8/frame_00001.png |
| alp1_150 | `float alp1 = random(50);` -> `float alp1 = random(150);` | subtle | no visible change in layout; the black half-strip shading is noticeably darker, a dark vertical band now shows along one edge of most strips (e.g. the blue strip at the right) | variants/alp1_150/frame_00001.png |

## Modularisation notes
- `subdivideColumn` (lines 63–80) is generic: recursive random ratio splitting of a rect into vertical strips; parameterise split count and ratio range.
- `squiggleRow` (lines 104–125) is generic: a column of quads with per-row offset, skip probability, and per-vertex colouring (which yields the gradient quads under P2D); parameterise square-size fraction, offset, skip chance, gradient chance.
- One-off art decisions: the 4-colour palette (line 140), the half-strip black-alpha shading (lines 87–101), the alternating `i%2` phase, and `cc = height/r.w + 2` tying row count to strip width.
- A clean parameter object: `{seed, splitCount, ratioMin, ratioMax, minStripWidth, squareFrac, offsetFrac, skipChance, gradientChance, shadeAlpha, palette}`.
