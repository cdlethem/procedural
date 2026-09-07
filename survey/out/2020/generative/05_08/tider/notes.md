---
sketch: 2020/generative/05_08/tider
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1482
animated: false
techniques: [grid, noise-field, polar, dots-stippling]
primitives: [rect, ellipse]
palette:
  colors: ["#CD5102", "#971C1E", "#35292F", "#CDB4C0"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sep, default: 9, tried: [4], change: moderate, effect: "coarser grid -> fewer, larger blocks and rings"}
  - {name: clusterCount, default: 8, tried: [3], change: moderate, effect: "fewer clusters -> sparser composition"}
  - {name: dotsPerRing, default: 100, tried: [40], change: none, effect: "no visible change; rings still read as closed circles"}
  - {name: rectSizeFactor, default: 0.8, tried: [1.4], change: subtle, effect: "blocks grow fuller, cover more of the canvas"}
  - {name: angleStepMax, default: 0.3, tried: [0.6283], change: none, effect: "no visible change; ring shape unchanged"}
reusable_candidates:
  - {name: noiseDotRing, signature: "noiseDotRing(cx, cy, radius, count, det, da) -> void", note: "place `count` dots on a polar ring whose radius is modulated by 2-D noise"}
  - {name: gridSnappedRect, signature: "gridSnappedRect(ss, sizeFactor) -> {x,y,size}", note: "snap a random rect to an ss grid and snap its size to ss*0.2"}
---

## What it draws
A flat, Bauhaus-like composition on a dark charcoal field. Several large rectangles snapped to a coarse grid overlap edge to edge in burnt orange, dark red, and one pale lavender block. Over them sit a handful of rings made of small orange dots: each ring is a circle of dots whose radius wobbles gently, so some rings look like clean circles and others like loose, breathing loops.

## How the code works
`generate()` (tider.pde:40) is called once from `setup()` (line 21); `draw()` (line 29) is empty, so the piece is static. It seeds `noiseSeed`/`randomSeed` from `seed` (lines 42-43) and paints `background(rcol())` (line 45).

- Grid: `sep = 9` gives cell `ss = width/9` (lines 47-48); all positions and sizes are snapped to this cell (`xx -= xx%ss`, `s -= s%(ss*0.2)`, lines 55-57), which is why the rects tile so rigidly.
- Rects: a loop of `8` clusters (line 51). Each picks a center biased toward the canvas middle via `lerp(random(...), center, random(random(0.2),1))` (lines 52-53), a size `s = width*random(0.8)` snapped to the sub-cell (lines 54-55), and a near-opaque `fill(rcol(),254)` rect (lines 58-59). This produces the big overlapping blocks.
- Dot rings: for each rect, an inner loop of `100` dots (line 63). Dot `i` sits at polar angle `a = da*i` (line 64) and radius `d = noise(xx*det, yy*det)*140` (line 65) around the rect center, drawn as `ellipse(x,y,ss*0.2,ss*0.2)` (line 69). `da = random(0.3)` (line 61) and `det = random(0.001)` (line 62) vary how tightly the ring closes and how much the radius wobbles.
- Colour: `rcol()` (line 105) picks a random palette entry; the dots use `getColor(i*det)` (line 68), which lerps between two adjacent palette entries by a power curve (lines 113-118), so dot colour drifts smoothly around each ring.
- Palette (line 101): burnt orange `#CD5102`, dark red `#971C1E`, dark charcoal `#35292F`, pale lavender `#CDB4C0`. The `toxi`/`triangulate` imports are present but unused; the built-in `noise()` does the work.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_4 | `int sep = 9;` -> `int sep = 4;` | moderate | coarser grid: fewer, larger blocks; fewer/larger dot rings | variants/sep_4/frame_00001.png |
| clusters_3 | `for (int k = 0; k < 8; k++) {` -> `for (int k = 0; k < 3; k++) {` | moderate | only 3 clusters: sparser, fewer blocks and rings | variants/clusters_3/frame_00001.png |
| dots_40 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 40; i++) {` | none | no visible change; rings still read as closed circles | variants/dots_40/frame_00001.png |
| rectSize_1.4 | `float s = width*random(0.8);` -> `float s = width*random(1.4);` | subtle | blocks grow fuller and cover more of the canvas | variants/rectSize_1.4/frame_00001.png |
| angleStep_0.6283 | `float da = random(0.3);` -> `float da = random(0.6283);` | none | no visible change; rings look the same | variants/angleStep_0.6283/frame_00001.png |

## Modularisation notes
Two blocks are generic and worth lifting: (1) `noiseDotRing` — a polar dot ring with noise-modulated radius, fully parameterised by center, base radius, count, detail, and angle step; and (2) `gridSnappedRect` — snapping a random rect + size to a cell grid. The one-off art decisions are the specific 4-colour palette, the `lerp`-toward-center placement bias, and the power-curve colour lerp. A clean parameter object would be: `{sep, clusterCount, rectSizeFactor, dotsPerRing, daMax, detMax, dotSizeFactor, palette}`.
