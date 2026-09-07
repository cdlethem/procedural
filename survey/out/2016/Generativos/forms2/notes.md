---
sketch: 2016/Generativos/forms2
year: 2016
renderer: JAVA2D
size: [1333, 768]
libraries: []
deterministic: true
ms_first_frame: 789
animated: false
techniques: [recursion, particles, blend-modes, curves]
primitives: [rect, ellipse, shape, pgraphics, image]
palette:
  colors: ["#FFE700", "#FE4E6E", "#613864", "#D8D7D7"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: rootShapes, default: "int(random(8, 92))", tried: ["int(random(8, 30))"], change: moderate, effect: "fewer root shapes: sparse scatter, large empty areas, satellite tail visible"}
  - {name: textureBlur, default: 8, tried: [20], change: none, effect: "no visible change - overlay is already extremely faint"}
  - {name: textureBlobs, default: 100, tried: [300], change: moderate, effect: "denser mottled overlay; also shifts the random stream so the whole cluster layout changes"}
  - {name: arcWeight, default: "random(1.2)", tried: ["random(3.5)"], change: none, effect: "no visible change - arcs are tiny and faint"}
  - {name: clusterSpacing, default: "random(3, 5)", tried: ["random(0.5, 1.5)"], change: moderate, effect: "children placed closer to parents: cluster denser and more concentrated"}
  - {name: barCount, default: "int(random(3, 22))", tried: ["int(random(10, 60))"], change: none, effect: "no visible change - bars cover roughly the same area in the same colors"}
reusable_candidates:
  - {name: scatterCluster, signature: "scatterCluster(x, y, r, count, level, maxLevel) -> void", note: "recursive Gaussian-scattered shape cluster with size/level decay"}
  - {name: softDotTexture, signature: "softDotTexture(w, h, blobCount, arcCount, blur) -> PGraphics", note: "offscreen canvas of blurred gray blobs + thin arc scratches, used as ADD overlay"}
  - {name: drawVariant, signature: "drawVariant(x, y, w, h, variant, palette) -> void", note: "switch over 5 primitive variants: bar stack, cut-corner rect, ellipse, stroked ring, polygon row"}
---

## What it draws
Flat hot-pink background. A dense, asymmetric cluster of flat geometric
shapes occupies the center and left side: small rectangles in many sizes,
stacked horizontal bars, circles, stroked rings, cut-corner boxes, and
occasional small polygons, in yellow, light gray, dark purple, and the
background pink. A few sparse shapes drift to the right edge. Over the
whole image sits a very faint, soft gray mottled texture with thin scratch
marks, added on top.

## How the code works
- `setup()` (forms2.pde:10-14) calls `generateTexture()` then `generate()`
  once; `draw()` is empty, so the piece is static (key press regenerates).
- `generate()` (forms2.pde:30-36) fills the background with a random palette
  color (`rcol()`, line 184-186, 4-color list at lines 1-6: yellow, pink,
  purple, gray), then seeds 1-2 recursive clusters (`point()`) near the
  canvas center (x in 40-60% of width, y in 40-60% of height) with radius
  `r = random(60, 220)` and 8-92 shapes (`int(random(8, 92))`, line 33).
- `point()` (forms2.pde:70-171) is the core: for `cc` iterations it places a
  shape at the seed plus a 2-D Gaussian offset scaled by `r` (lines 72-73).
  Shape size is `ww = r / random(0.5, 5)` and a random aspect ratio (lines
  77-80), so shapes are roughly the same size as the scatter radius.
  `rnd = int(random(8))` (line 81) picks a variant:
  - `rnd != 3,4`: base pass draws a 4-weight black stroked rounded rect
    (lines 86-89) then a filled palette rect and a 50-alpha white overlay
    (lines 90-93).
  - `rnd == 0`: `random(3, 22)` thin stacked horizontal bars (lines 95-103).
  - `rnd == 1`: cut-corner (chamfered) 16-vertex rectangle via `beginShape`
    (lines 104-124).
  - `rnd == 2`: plain ellipse at half the smaller dimension (125-128).
  - `rnd == 3`: stroked ring: 4 stroke weights then a filled ellipse (129-139).
  - `rnd == 4`: a row of `random(2, 7)` regular `random(3, 7)`-gon polygons
    drawn via `poly()` (lines 173-182), each with the 4-weight black stroke
    pass (140-158).
  Recursion (lines 162-170): `childs = int(random(1, random(1, 20)) - lvl*5)`
  children, placed on a circle of radius `r*random(3, 5)` at a random angle,
  with child radius `r*random(0.3, 1.1)` and child count
  `cc*random(0.2, 1.8)`; the `-lvl*5` term damps depth, which is what
  produces the tight main cluster with a sparse satellite tail.
- `generateTexture()` (forms2.pde:38-66) builds a 1024x1024 offscreen
  `PGraphics`: 100 large (20-400 px) gray ellipses at alpha 1-8, blurred
  (BLUR 8), then 400 tiny arcs (size up to 8 px, span up to 0.7 PI) with
  alpha 10-120 and weight up to 1.2, blurred again (0.8). `generate()` then
  `blendMode(ADD)` and `image(tex, 0, 0)` (lines 34-35), which lifts the
  whole picture slightly and adds the soft mottled overlay. Because the
  texture is 1024x1024 on a 1333x768 canvas it is scaled up and covers only
  the left ~77% at full opacity of the canvas width — the right edge shows
  the texture's black (no-op under ADD) border region.
- Randomness enters via `random`/`randomGaussian` only; no noise is used.
  `data/post.glsl` is an unused leftover (no shader is loaded).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| rootcc_30 | `int(random(8, 92))` -> `int(random(8, 30))` | moderate | much sparser: a few small shapes and small groups scattered over large empty pink areas; one big purple rect, a row of triangles at the bottom; texture overlay barely visible | variants/rootcc_30/frame_00001.png |
| blur_20 | `gra.filter(BLUR, 8);` -> `gra.filter(BLUR, 20);` | none | no visible change - the ADD overlay is so faint that softening the blobs is imperceptible | variants/blur_20/frame_00001.png |
| blobs_300 | `for (int i = 0; i < 100; i++)` -> `for (int i = 0; i < 300; i++)` | moderate | denser, more visible gray mottling in the empty pink areas (e.g. bottom right); the extra random() calls also shift the stream, so the cluster itself is re-laid-out with bigger central shapes | variants/blobs_300/frame_00001.png |
| arcs_3.5 | `gra.strokeWeight(random(1.2));` -> `gra.strokeWeight(random(3.5));` | none | no visible change - the arc scratches are <= 8 px and low-alpha; thicker strokes stay sub-pixel at display scale | variants/arcs_3.5/frame_00001.png |
| space_0.5 | `float dd = random(3, 5);` -> `float dd = random(0.5, 1.5);` | moderate | cluster noticeably denser and more concentrated around the center; less spread toward the left edge, shapes overlap more | variants/space_0.5/frame_00001.png |
| bars_60 | `int ccc = int(random(3, 22));` -> `int ccc = int(random(10, 60));` | none | no visible change - more, thinner bars occupy about the same area with the same fills, so the bar shapes read the same at this scale | variants/bars_60/frame_00001.png |

## Modularisation notes
- Generic: the recursive Gaussian scatter with per-level damping
  (`point()`'s recursion block) is a reusable "cluster" generator; the
  variant dispatch (5 shape styles) is a swappable "glyph set"; the
  offscreen blob+scratch texture is a reusable soft-overlay builder.
- One-off art decisions: the 4-color palette, the `-lvl*5` damping formula,
  the `rnd` variant weights (bar/cut-corner/ellipse/ring/poly), the 4-step
  stroke pass, the ADD-blend overlay strength.
- Clean parameter object: `{palette, rootCount: [min, max], rootRadius:
  [min, max], scatter: r, shapeScale: [min, max], children: [min, max],
  damping: perLevel, texture: {blobCount, blobSize, arcCount, arcAlpha,
  blur}, overlay: {blend, opacity}}`.
