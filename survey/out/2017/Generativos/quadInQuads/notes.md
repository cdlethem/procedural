---
sketch: 2017/Generativos/quadInQuads
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1824
animated: false
techniques: [subdivision, grid, recursion]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: quadRecursion, signature: "quadRecursion(x, y, z, sub, minDiv, maxDiv, motifFn)", note: "walk a shrinking quad along the diagonal, drawing one random motif per cell size"}
  - {name: cellMotif, signature: "cellMotif(kind, x, y, s) -> draws rombo|form1|form2|form3|circle-grid", note: "the four line-only motif drawers are pure geometry parameterized by cell size"}
---

## What it draws
A black-on-white full-bleed mosaic of outlined geometric cells (no fills): circles in
squares, diamonds, L-shaped brackets, X/star lattices, and notched rectangles, tiling the
whole canvas. The cells are large in the lower-left and get progressively smaller toward
the upper-right corner, where the detail collapses into a dense mesh of tiny motifs,
ending in an almost solid black patch of overdrawn strokes in the extreme corner.

## How the code works
`setup()` sizes a 960×960 P2D window, loads `data/repeat.glsl`, and calls `generate()`
(quadInQuads.pde:4-13). `generate()` re-seeds the PRNG (`seed = int(random(99999999));
randomSeed(seed)`, lines 30-32), clears to white with `stroke(0); strokeWeight(2);
noFill()` (lines 37-41), then runs the recursion: a list `rects` starts with one full-canvas
quad `(0,0,width)` (line 35). For `sub = 120` iterations (line 42) it takes the current
quad, divides its side `rect.z` by `div` (a random int between `minDiv` and `maxDiv`,
lines 43-47), computes cell size `ss`, draws a diamond (`rombo`, lines 135-142) in the
corner cell, then fills the rest of that quad's two new arms with a randomly chosen motif
(`rnd` 0-3, line 50): circles-in-grid (lines 52-56), `form1` notched octagon, `form2`
star/bracket shape (amp 0.25, lines 86-114), or `form3` L-shapes (amp 0.3333, lines
117-133). Finally it pushes a smaller quad offset diagonally `(rect.x+ss, rect.y+ss,
rect.z-2*ss)` (line 68), so the recursion marches from the lower-left corner toward the
upper-right, halving the scale each step — that is what produces the size gradient and
the dense black corner. All shapes are stroke-only, so the corner patch reads as solid
black once stroke weight exceeds cell size. `filter(repeat)` (line 71) applies the shader,
but its `main()` is a pass-through (`gl_FragColor = ori;`, repeat.glsl:34), so it changes
nothing visually. Randomness enters only via `div`, the motif choice, and `minDiv`/`maxDiv`
bounds; colour is fixed black on white.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The recursion walker (lines 34-69) is generic: it only needs (a) a step count `sub`, (b)
division bounds `minDiv`/`maxDiv`, (c) a cell-size function `ss = z/div`, and (d) a motif
callback. The four motif drawers (`rombo`, `form1`, `form2`, `form3`) plus the circle-grid
case are pure, size-parameterized, stroke-only geometry — a natural `motif` enum or
strategy for a library. One-off art decisions: the diagonal offset `(ss, ss)` and shrink
`-2*ss` (which creates the corner density collapse), the fixed 2px stroke, the white
background, and the pass-through shader (dead weight, drop it). A clean parameter object:
`{sub, minDiv, maxDiv, strokeWeight, strokeColor, motifWeights[4], offsetFactor, shrinkFactor}`.
