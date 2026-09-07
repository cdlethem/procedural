---
sketch: 2018/Generativos/example          # relative path inside ${PROCESSING_SKETCHES_ROOT}
year: 2018
renderer: P2D                             # JAVA2D | P2D | P3D | PDF
size: [960, 960]
libraries: [toxi]                         # [] if none; short names: toxi, triangulate, peasy, minim
deterministic: true                       # from baseline/result.json
ms_first_frame: 1745                      # from baseline/result.json
animated: false                           # true if frame_00010/00060 differ from frame_00001
techniques: [noise-field, grid]           # controlled vocabulary, see AGENTS.md
primitives: [rect, line]                  # point | line | ellipse | rect | shape | pixels | pgraphics | text | image
palette:
  colors: ["#FFFFFF", "#F72C11"]          # hex values found in the code (max 12)
  selection: random-from-list             # random-from-list | lerp-between | noise-driven | image-sampled | fixed
composition: full-bleed                   # centered | tiled | full-bleed | margins | radial | scattered
parameters:                               # the 4-6 you tried (name, default, values tried, visual effect)
  - {name: detSize, default: 0.0006, tried: [0.0002, 0.002], change: moderate, effect: "lower = larger smoother blobs"}   # change: none | subtle | moderate | large, from render.py
reusable_candidates:                      # functions this sketch suggests for the library
  - {name: noiseGrid, signature: "noiseGrid(cellSize, detail, offset) -> float[][]", note: "sampled 2-D noise over the canvas"}
---

## What it draws
Two or three sentences describing the baseline image (seed 42) in plain visual terms.

## How the code works
Setup -> generate() flow, what each loop does, where randomness enters, how colour is chosen,
which transforms/blend modes matter. Cite line numbers of the main .pde.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detSize_0.002 | `float detSize = random(0.0003, 0.0006)*12;` -> `... *40;` | moderate | finer, busier texture | variants/detSize_0.002/frame_00001.png |

## Modularisation notes
Which blocks are generic (could be a library function with the signature above), which are
one-off art decisions, and what a clean parameter object for this sketch would contain.
