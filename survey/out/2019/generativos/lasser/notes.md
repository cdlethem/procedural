---
sketch: 2019/generativos/lasser
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1534
animated: false
techniques: [subdivision, noise-field, lines-hatching]
primitives: [rect, shape]
palette:
  colors: ["#F20707", "#FCCE4A", "#D0DFE8", "#F49FAE", "#342EE8"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: sub, default: 60, tried: [20], change: large, effect: "fewer subdivision iterations = fewer, larger, softer blocks; much coarser layout"}
  - {name: ddd, default: 4, tried: [8], change: large, effect: "more passes = more opaque saturated colour, more hatched blocks, higher contrast"}
  - {name: alp, default: 20, tried: [60], change: moderate, effect: "thicker wash = palette reads much more saturated, less grey, same geometry"}
  - {name: detCol, default: "random(0.002, 0.003)*0.12", tried: ["random(0.002, 0.003)*0.5"], change: moderate, effect: "finer noise scale = mottled smaller colour patches; geometry and bars unchanged"}
  - {name: hatchProb, default: 0.01, tried: [0.5], change: large, effect: "most blocks become densely striped hatching; heavy red/orange, high contrast"}
  - {name: ss, default: "random(20, 180)", tried: ["random(20, 400)"], change: moderate, effect: "longer soft gradient bands fading outward from rect edges; subtle overall halo"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(rects, iters, splitFracs) -> Rect[]", note: "random 4-way split of one rect per iteration; parents kept, list grows by 4 each step"}
  - {name: noiseColor, signature: "noiseColor(x, y, z, detail, palette) -> color", note: "map 3-D noise through palette lerp with pow(v%1, 0.2) bias toward the first colour of each pair"}
  - {name: edgeFadeTab, signature: "edgeFadeTab(rect, side, len, col, alpha)", note: "beginShape quad: one rect side filled, far edge transparent -> gradient band fading outward"}
---

## What it draws
A full-bleed, busy mosaic of overlapping rectangular blocks in coral red, amber-orange, lavender-blue and pale pink over a light grey ground. Many blocks are nested inside slightly smaller copies of themselves (frame-like insets), thin black and white bars are scattered along block edges, a few blocks contain vertical or horizontal striped hatching, and soft colour bands fade outward from the sides of some blocks.

## How the code works
Single tab `lasser.pde`. `setup()` calls `generate()` once (line 23); `draw()` is empty, so the piece is static.

- `generate()` (lines 54-170) seeds `randomSeed`/`noiseSeed` (56-57) and fills `background(240)` light grey.
- **Subdivision** (61-81): start with one full-canvas `Rect` (62). In `sub = 60` iterations (63), pick a random rect (index biased toward small ones, line 66) and split it into four children at random split fractions from `{0.25, 0.33333, 0.5, 0.66666, 0.75}` in width and height (71-77). The `r.sub` guard is never set (79 commented out) and parents are never removed, so every iteration adds 4 rects and the list ends with ~245 overlapping rects of many scales — the source of the dense overlapping-block look.
- **Noise colour wash** (83-92): four passes (`ddd = 4`, line 85) over all rects. Fill = `getColor(noise(r.x*detCol, r.y*detCol, l*0.1) * colors.length*2)` with `detCol ≈ 0.00024-0.00036` (83), i.e. very large smooth colour regions; the 3rd noise axis steps by `l*0.1` so each pass shifts the field. Alpha is fixed at 20 (90), so each pass adds a thin translucent wash and 4 passes stack to moderate opacity. `getColor` (187-192) lerps between adjacent palette entries with `pow(v%1, 0.2)`, biasing toward the first colour of each pair (red/amber, amber/blue, blue/pink, pink/purple).
- **In-place inset** (94-97): each `Rect` is mutated in place (x,y += 8, w,h -= 16) at the end of every pass, so passes 2-4 draw progressively smaller copies — the nested frame-like insets.
- **Edge bars** (100-104): 10% chance per rect per pass to draw a thin black or white bar (alpha 200) on one of the four edges — the scattered dark/light ticks.
- **Hatching** (106-122): 1% chance per rect to fill it with `cc` vertical or horizontal strips (width `ss*amp`) in the current fill — the occasional striped blocks.
- **Side tabs** (124-167): pick a side (`shw = int(random(4))`, 125) and draw a `beginShape` quad whose two near vertices (the rect's edge) are filled with `col` at `alpha = random(200)` (126) and whose two far vertices (extended by `ss = random(20, 180)`, 127) are transparent — per-vertex colour interpolation makes a gradient band fading outward from the rect edge.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_20 | `  int sub = 60;` -> `  int sub = 20;` | large | far fewer, much larger soft blocks; pale central field, big pastel areas, fewer and bigger black bars; coarse layout | variants/sub_20/frame_00001.png |
| ddd_8 | `  int ddd = 4;//int(random(10));` -> `  int ddd = 8;//int(random(10));` | large | much more opaque and saturated (vivid red/purple/amber), many more striped hatched blocks, deeper stacked black/white bars, higher contrast | variants/ddd_8/frame_00001.png |
| alp_60 | `      alp = 20;//ddd*pow(i*1.0/ddd, 1.4)*40;` -> `      alp = 60;//ddd*pow(i*1.0/ddd, 1.4)*40;` | moderate | same geometry; colour washes read as solid orange/purple/red patches instead of a pale grey wash | variants/alp_60/frame_00001.png |
| detCol_0.5 | `  float detCol = random(0.002, 0.003)*0.12;` -> `  float detCol = random(0.002, 0.003)*0.5;` | moderate | same layout and bars; colour field is mottled into smaller patches with more purple/red variation instead of large smooth regions | variants/detCol_0.5/frame_00001.png |
| hatch_0.5 | `      if (random(1) < 0.01) {` -> `      if (random(1) < 0.5) {` | large | most blocks now densely striped (vertical and horizontal hatching everywhere); heavy red/orange, high contrast, very busy | variants/hatch_0.5/frame_00001.png |
| tab_400 | `      float ss = random(20, 180);` -> `      float ss = random(20, 400);` | moderate | longer soft gradient bands bleeding outward from block edges; overall softer, slightly warmer halo, geometry unchanged | variants/tab_400/frame_00001.png |

## Modularisation notes
- **Generic**: the subdivision loop (61-81) is a clean reusable function (`subdivideRects`) — keep-parents growth, split-fraction table, iteration count as parameters. `getColor`/noise-palette mapping (187-192 + 91) is a reusable `noiseColor`. The edge-fade quad (128-167) is a reusable `edgeFadeTab`.
- **One-off art decisions**: fixed `alp = 20` wash + 4 passes + 8px in-place inset (the layered-frame aesthetic); 10% black/white edge bars; 1% hatching; the specific 5-colour palette.
- **Parameter object**: `{iters: sub, splitFracs[], passes: ddd, washAlpha, insetPx, noiseDetail: detCol, barProb, hatchProb, tabMin, tabMax, palette}`.
