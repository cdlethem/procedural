---
sketch: 2016/Generativos/ThePiper
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 631
animated: false
techniques: [subdivision, grid, typography, pixel-ops, dots-stippling]
primitives: [rect, text, pixels, ellipse]
palette:
  colors: ["#FAFAFA", "#FFFFFF"]
  selection: image-sampled
composition: full-bleed
parameters:
  - {name: subdivisions, default: 800, tried: [1200], change: moderate, effect: "more splits: patchwork reads as a distinct checker of maroon squares; word set re-rolls (random stream shifts) and is sparser"}
  - {name: rotation, default: "PI/8 (22.5 deg)", tried: ["PI/4 (45 deg)"], change: moderate, effect: "words and patchwork tilt at 45 deg instead of 22.5 deg"}
  - {name: speckleCount, default: "random(1000, 8000)", tried: ["random(20000, 30000)"], change: none, effect: "no visible change; specks are too faint to register the 4x count increase"}
  - {name: jitterAmount, default: "random(-4, 4)", tried: ["random(-20, 20)"], change: subtle, effect: "subtle: grain slightly coarser, composition unchanged"}
  - {name: textAlpha, default: 250, tried: [80], change: moderate, effect: "words become semi-transparent grey; patchwork shows through the letters"}
  - {name: textSizeBase, default: 320, tried: [480], change: large, effect: "words ~1.5x larger; 'telephone' spans the full width and 'World' is cropped"}
  - {name: quadSubdivide, signature: "quadSubdivide(x, y, size, iterations) -> Quad[]", note: "stochastic quadtree: repeatedly split one random square into 4, yields ~4*iterations squares of mixed size"}
  - {name: pixelJitter, signature: "pixelJitter(amt)", note: "per-pixel RGB +-random jitter, lines 90-97"}
  - {name: arcSpeckle, signature: "arcSpeckle(count, rMin, rMax)", note: "random short arcs (specks), lines 79-88"}
  - {name: scatterWords, signature: "scatterWords(words, n, cell)", note: "random words on a rotated 8x8 lattice, random size class, lines 59-74"}
---

## What it draws
A nearly black dark-maroon full-bleed field in which a few barely-visible, slightly lighter square patches form a rotated (22.5 degrees) patchwork. Large off-white serif words (lyric fragments, here "telephone", "World", "met") are scattered at the same 22.5-degree tilt, overlapping and partially cut off. The whole image carries a fine film-grain and is dusted with tiny pale arc specks.

## How the code works
`generate()` (ThePiper.pde): two colors `col1`, `col2` are sampled from `tapa.jpg` at random pixels (L25-26); the background is a random lerp of them (L29). A single oversized square (2x canvas) is subdivided 800 times: each iteration picks a random remaining square, removes it, and adds 4 half-size children (L35-47) — a stochastic quadtree leaving ~3200 squares of mixed size. The canvas is translated to center and rotated `PI/8` (L31-33); each quad is drawn as a `rect` filled with a random lerp of `col1`/`col2` (L51-57), which is why the patchwork reads as near-invisible tonal variation on the dark background. A random song from `songs.json` is split into words (L59-60); 10 words are placed on a rotated 8x8 lattice at random lattice cells, random size class (320/1..6), filled `(250, 250)` alpha white (L62-74). After `popMatrix`, `pelitos` (1000-8000) tiny random arcs with fading white stroke are sprinkled over the whole canvas (L79-88). Finally every pixel is jittered by `random(-4,4)` per channel (L90-97) for the grain. All randomness enters via `random()`; `--seed 42` makes it deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdivisions_1200 | `for (int i = 0; i < 800; i++) {` -> `... i < 1200 ...` | moderate | patchwork becomes a visible checker of maroon squares; words re-roll to a smaller, sparser set | variants/subdivisions_1200/frame_00001.png |
| rotation_PI4 | `rotate(PI/8);` -> `rotate(PI/4);` | moderate | same words, whole composition tilted 45 deg instead of 22.5 deg | variants/rotation_PI4/frame_00001.png |
| speckle_25000 | `int pelitos = int(random(1000, 8000));` -> `int(random(20000, 30000));` | none | no visible change (specks too faint to register 4x count) | variants/speckle_25000/frame_00001.png |
| jitter_20 | `float rnd = random(-4, 4);` -> `random(-20, 20);` | subtle | subtle: grain slightly coarser, nothing else changes | variants/jitter_20/frame_00001.png |
| textAlpha_80 | `fill(250, 250);` -> `fill(250, 80);` | moderate | words turn semi-transparent grey; patchwork visible through letters | variants/textAlpha_80/frame_00001.png |
| textSize_480 | `textSize(320/int(random(random(1, 5), 6)));` -> `textSize(480/...)` | large | words ~1.5x larger; "telephone" spans full width, "World" cropped | variants/textSize_480/frame_00001.png |

## Modularisation notes
Generic: the stochastic quadtree subdivision (L35-47) is a reusable generator of a mixed-scale square layout; the per-pixel jitter (L90-97) is a drop-in grain pass; the arc speckle (L79-88) is a generic noise-speck overlay; the rotated word scatter (L59-74) is a reusable typography layout given a word list. One-off art decisions: sampling the palette from the `tapa.jpg` cover image, the 22.5-degree master rotation, the 8x8 lattice and 320/1..6 size classes, and the specific lyric source. A clean parameter object: {subdivisions, rotation, lattice (n, sizeClassBase), speckleCount, speckleRadius, jitterAmount, textAlpha, paletteSource}.
