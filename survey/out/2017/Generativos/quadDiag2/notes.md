---
sketch: 2017/Generativos/quadDiag2
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1582
animated: false
techniques: [subdivision]
primitives: [shape]
palette:
  colors: ["#f7bd37", "#ffe50c", "#db1922", "#d9366d", "#b41c59", "#542462", "#272f7a", "#1d5468", "#82cb9d"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: iterations, default: 1000, tried: [300], change: large, effect: "coarser mosaic: far fewer splits, much larger un-subdivided squares and diamond patches"}
  - {name: rotateProb, default: 0.2, tried: [0.5], change: large, effect: "many more rotated 45-degree splits: more nested diamond-in-diamond motifs with solid corner frames, busier overall"}
  - {name: background, default: 200, tried: [255], change: none, effect: "no visible change: quads cover the canvas fully, background never shows"}
  - {name: rotatedScale, default: 0.5, tried: [0.4], change: subtle, effect: "rotated child slightly smaller: thin ring of parent colour around each rotated diamond; overall look nearly unchanged"}
  - {name: childScale, default: 0.5, tried: [0.45], change: large, effect: "gaps open between the four children of every axis-aligned split: a seam grid of background/underlying colour runs through the mosaic"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(seeds, iterations, rotateProb, childScale, rotatedScale) -> Quad[]", note: "random recursive quad subdivision: pick a quad, either 4-way split or 45-degree-rotated half-size child, remove parent"}
  - {name: gradientQuad, signature: "gradientQuad(x, y, size, angle, palette) -> void", note: "beginShape quad with one lerpColor'd random palette colour per vertex, closed; P2D renders per-vertex fills as smooth colour gradients"}
---

## What it draws
A full-bleed 960x960 mosaic of squares at two orientations: axis-aligned and rotated 45 degrees (diamonds), at widely varying scales from large patches down to very fine subdivided clusters. Every square is filled with a smooth multi-colour gradient — up to four different colours blending across the face — drawn from a warm-dominant palette (amber, yellow, red, pink, magenta, purple) with indigo, teal and green accents, on a light grey background that is almost fully covered.

## How the code works
`setup()` (L1-7): 960x960 P2D, `rectMode(CENTER)`, calls `generate()` once; `draw()` is empty, so the piece is static (regenerated only on a keypress).

`generate()` (L23-57):
- L24-25: light grey `background(200)`, translate to canvas centre.
- L29-30: seed the list with one quad centred at origin, `s = width`, covering the whole canvas.
- L34-52: loop 1000 times: pick a random quad from the live list (L35, `int(random(quads.size()*random(1)))`).
  - With probability 0.2 (L37): add one child at the same centre with `s*sqrt(2)*0.5` (half the area) rotated by +HALF_PI/2 (L38), draw the parent now (L40, leaving a coloured "frame" of four corner triangles around the rotated child), then remove the parent (L51).
  - Otherwise (L41-50): split into four children of `s*0.5` centred on the diagonals at distance `s*0.5*0.5*sqrt(2)` (L42-48), remove the parent (L51).
- L53-56: draw all remaining (never-subdivided) quads.

Colour: 9-entry palette (L59). `getColor(v)` (L63-68) lerps between two adjacent palette entries with a random fraction. `Quad.show()` (L79-96) translates/rotates to the quad, then in `beginShape()` sets a fresh random lerp colour before each of the four vertices (L85-92) and closes with `endShape(CLOSE)`; P2D honours per-vertex fills, which is what gives each square its smooth blended gradient look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iterations_300 | `  for (int i = 0; i < 1000; i++) {` -> `  for (int i = 0; i < 300; i++) {` | large | coarser mosaic: large unsplit squares and a big gradient diamond upper-right; fewer, bigger cells | variants/iterations_300/frame_00001.png |
| rotateProb_0.5 | `    if (random(1) < 0.2) {` -> `    if (random(1) < 0.5) {` | large | far more rotated-branch splits: many nested diamond-in-diamond motifs with solid corner frames; busier mix of both orientations | variants/rotateProb_0.5/frame_00001.png |
| background_255 | `  background(200);` -> `  background(255);` | none | no visible change — quads cover the canvas completely | variants/background_255/frame_00001.png |
| rotatedScale_0.4 | `      Quad n = new Quad(q.x, q.y, q.s*sqrt(2)*0.5, q.a+HALF_PI/2);` -> `... *0.4, ...` | subtle | rotated children slightly smaller; thin ring of parent colour visible around each rotated diamond, otherwise near-identical | variants/rotatedScale_0.4/frame_00001.png |
| childScale_0.45 | `      float ms = q.s*0.5;` -> `      float ms = q.s*0.45;` | large | gaps between the four children of every axis-aligned split: a seam grid of background/underlying colour through the mosaic | variants/childScale_0.45/frame_00001.png |

## Modularisation notes
Generic and reusable: the subdivision loop (pick random live cell, replace by 4 children or by one rotated half-size child, delete parent) is a clean parameterised operator — `quadSubdivide(seeds, iterations, rotateProb, childScale, rotatedScale)`. The per-vertex lerp-coloured quad (`gradientQuad`) is a small generic primitive; the specific 9-colour palette is the one-off art decision. A clean parameter object would be: `{canvas, iterations, rotateProb, childScale (4-way), rotatedScale (rotated branch), drawParentOnRotate, palette, background, seed}`. Note the 20% branch draws the parent immediately rather than in the final pass, which is what creates the solid-coloured diamond frames with a busy interior visible in the baseline.
