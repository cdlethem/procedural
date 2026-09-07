---
sketch: 2019/generativos/chanels
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1523
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: iterations, default: 28000, tried: [7000], change: large, effect: "fewer iterations = coarser mosaic, big flat blocks dominate"}
  - {name: fill_alpha, default: 80, tried: [255], change: large, effect: "full-alpha ADD fills = darker muddier image with black patches, less blowout"}
  - {name: palette_size, default: 12, tried: [3], change: large, effect: "3 colours (blue/yellow/magenta) ADD to near-white, strokes and black squares stand out"}
  - {name: child_offset, default: 0.25, tried: [0.375], change: large, effect: "children pushed to corners: denser regular checker of small cells with dark seams"}
  - {name: init_rect_scale, default: 2.8, tried: [1.0], change: large, effect: "seed rect = canvas size: edges fully subdivided, uniform fine mosaic, no giant edge blocks"}

## What it draws
A full-bleed mosaic of nested, axis-aligned rectangles of many sizes on black, like a zoomed-in
quadtree or pixelated stained glass. Densely packed regions of small squares sit next to broad
areas of a few large blocks; heavy overlap saturates some zones to white/pale yellow while others
keep distinct blue, magenta, green and orange hues. No outlines stand out — the image reads as
flat colour fields broken into blocky cells.

## How the code works
`setup()` calls `generate()` (chanels.pde:19-27); `draw()` is empty, so the piece is static and
drawn once. `generate()` (lines 50-85) does:

1. `randomSeed(seed)` / `noiseSeed(seed)` (52-53) — all randomness comes from `random()`, so runs
   are deterministic per seed.
2. Black background (55), then `translate(width*0.5, height*0.5, 200)` (60) under the P3D default
   perspective camera.
3. Subdivision: start with one `Rect(0, 0, width*2.8, height*2.8)` (63) — bigger than the canvas,
   so edge cells stay large. Loop 28,000 times (65): pick a random live rect (biased toward
   smaller ones since `rects.size()*random(1)` grows the list), skip if w/h < 4 (68), replace it
   with 4 children at quarter offsets (`±w*0.25`) at half size (`w*0.5`) (69-72), remove the
   parent (73). Rect stores half-extents; drawing uses `r.w*2`.
4. Rendering: `blendMode(ADD)` (76), `rectMode(CENTER)` (78), then one pass over all surviving
   rects with `fill(rcol(), 80)` and `stroke(rcol(), 20)` (81-83). `rcol()` (97-99) picks a random
   colour from the 12-colour palette (line 95); the `getColor` lerp helper (100-108) is unused.
   ADD blending with 80/255 fill alpha is why overlaps blow out to white.

Note: frame_00010/00060 are near-blank (a few magenta/cyan specks on white) — a headless P3D
framebuffer persistence quirk, not animation; frame 1 is the artwork.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iter_7000 | `for (int i = 0; i < 28000; i++)` -> `i < 7000` | large (0.2593, 0.88) | much coarser: large flat colour blocks dominate, fine mosaic only in a few dense clusters | variants/iter_7000/frame_00001.png |
| alpha_255 | `fill(rcol(), 80);` -> `fill(rcol(), 255);` | large (0.3196, 0.908) | darker and muddier: olive, maroon, dark teal fields with black patches; almost no white blowout | variants/alpha_255/frame_00001.png |
| palette_3 | 12-colour `colors[]` -> `{#043387, #FBE710, #D9007E}` | large (0.19, 0.763) | image washes to near-white (blue+yellow+magenta ADD); thin colour strokes and small solid black squares stand out | variants/palette_3/frame_00001.png |
| offset_0.375 | child offsets `0.25` -> `0.375` (all 4 children) | large (0.3548, 0.92) | denser, more regular checker of small cells pushed to cell corners with visible dark seams; overall busier | variants/offset_0.375/frame_00001.png |
| init_1.0 | `width*2.8, height*2.8` -> `width*1.0, height*1.0` | large (0.259, 0.88) | no oversized seed rect: whole canvas uniformly fine mosaic, edges no longer left as huge blocks | variants/init_1.0/frame_00001.png |

## Modularisation notes
- Generic: the subdivision loop (65-74) is a parameterised "random quadtree thinning" —
  `recursiveSubdivide(rects, iterations, childScale=0.5, childOffset=0.25, minSize=4)`. It is
  independent of the renderer and palette.
- Generic: `rcol()` random-pick-from-palette with an alpha, trivially reusable.
- One-off art decisions: the 12-colour palette, ADD blend mode, the 2.8× oversized seed rect, the
  `z=200` translate, the fill/stroke alpha split (80/20).
- A clean parameter object: `{iterations, childScale, childOffset, minSize, seedRectScale,
  palette, fillAlpha, strokeAlpha, blend, zTranslate}`.
