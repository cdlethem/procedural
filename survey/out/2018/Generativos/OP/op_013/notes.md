---
sketch: 2018/Generativos/OP/op_013
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1520
animated: false
techniques: [grid, symmetry]
primitives: [rect, ellipse]
palette:
  colors: ["#FFFFFF", "#011731", "#A12677", "#EE3C7A", "#EE2D30", "#EC4532", "#FFCA2A", "#3DB98A", "#16A5DF"]
  selection: lerp-between
composition: tiled
parameters:
  - {name: cw, default: "random(8,~30); 9 at seed 42", tried: [24], change: large, effect: "finer 24x24 grid, motifs ~quarter size, much denser pattern"}
  - {name: amp, default: "random(0.1,0.4); ~0.3 at seed 42", tried: [0.6], change: moderate, effect: "cell-centre dots grow to 0.6 of the cell, nearly touching the big disks"}
  - {name: sc, default: "random(0.3,0.8); ~0.32 at seed 42", tried: [0.9], change: large, effect: "cyan rings swell to 0.9 of the cell and dominate each eye"}
  - {name: det, default: "random(0.05)", tried: [0.5], change: none, effect: "no visible change: noise value n is computed but never used (dead code)"}
  - {name: ringWeight, default: 0.1, tried: [0.3], change: moderate, effect: "ring stroke x3: cyan annulus closes into a near-solid disc, tiny centre dot remains"}
reusable_candidates:
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "sample a palette at a fractional index, lerping between the two adjacent entries (getColor, L167-172)"}
  - {name: lensCell, signature: "lensCell(cx, cy, size, cOuter, cMid, cRing, midScale, ringScale, ringWeight) -> void", note: "concentric white/black disk + mid disk + stroked ring, one motif per grid intersection (L79-93)"}
  - {name: checkerGrid, signature: "checkerGrid(cols, cA, cB, mode, flipChance) -> void", note: "full-bleed rect checker with column/row/diagonal parity modes and random per-cell flips (L41-61)"}
---

## What it draws
A full-bleed repeating optical pattern on a ~9x9 grid. At every grid intersection sits a large disk
that alternates white and black in checkerboard fashion; inside each is a smaller disk (yellow or
dark navy, also alternating) enclosed by a thick cyan ring, whose hollow centre shows the mid disk's
colour. Between the intersections, each cell centre carries a small yellow or dark-navy dot. In the
gaps between the big disks, a pale-pink / near-black checkerboard background peeks through.
High-contrast, playful "eyes on a grid" look; identical at frames 1/10/60 (static).

## How the code works
`setup()` (L2-7) opens a 960x960 P2D canvas and calls `generate()` once; `draw()` (L9-10) is empty,
so the piece is static (keyPressed, L12-18, regenerates with a new seed).

`generate()` (L20-101):
- `background(0)` (L21). Grid: `cw` = random int 8-30, `ch = cw` (L23-25), square cells `ww/hh` (L26-27).
- Colour pick (L31-38): `c1`/`c2` are a palette colour lerped toward black/white by 0.6-1 (the
  background pair); `c3`-`c8` are raw palette blends from `getColor()` (L164-172), which lerps
  between two adjacent entries of the 9-colour palette (L158). For seed 42: c3 = yellow, c4 = dark
  navy, c5 = cyan, c2 = pale pink, c1 = near-black.
- Base grid (L41-61): one of three parity patterns chosen by `rnd` (L41: column stripes, row
  stripes, or diagonal checker) fills every cell with a full-cell `rect` (L60) in c1 or c2; each cell
  has a 10% chance to flip randomly (L56-59). This layer is mostly covered by the disks drawn next.
- Motif loop (L69-99), `i,j` from -1 so edge motifs clip at the canvas border:
  - small dot at each cell centre (L77): fill c3/c4 by parity (L71-72), size `amp` (0.1-0.4 of the
    cell, L64) -> the scattered small dots.
  - at each grid intersection (offset half a cell, L73-74): a full-cell disk, white or black by
    parity (L79-81) -> the alternating big disks; on top a 0.5-cell disk in c3/c4 (L82-84) -> the
    yellow/navy mid disks; on top a `noFill` ring stroked with c5 (L88-93), diameter `sc` (0.3-0.8)
    x cell, `strokeWeight` 0.1 x cell -> the cyan rings. The ring's hollow centre exposes the mid
    disk's colour, which reads as a small centre dot.
- `n` (L75, a noise value from `noise(des+xx*det, des+yy*det)` with `det = random(0.05)`, L65-66) is
  computed but never used - the commented-out `eye(...)` call (L85) was its consumer; the `eye()`
  (L103-131) and `arc2()` (L138-156) helpers are dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_24 | `int cw = int(random(8, random(20, 30)));` -> `int cw = 24; random(8, random(20, 30));` (dummy random() keeps the rest of the stream identical) | large | 24x24 grid: motifs ~quarter the size, much denser pattern, same colour scheme | variants/cw_24/frame_00001.png |
| amp_0.6 | `float amp = random(0.1, 0.4);` -> `float amp = 0.6; random(0.1, 0.4);` | moderate | cell-centre dots grow to 0.6 of the cell, now nearly touching the big disks | variants/amp_0.6/frame_00001.png |
| sc_0.9 | `float sc = random(0.3, 0.8);` -> `float sc = 0.9; random(0.3, 0.8);` | large | cyan rings swell to 0.9 of the cell and dominate each eye; mid discs read small against the rings | variants/sc_0.9/frame_00001.png |
| det_0.5 | `float det = random(0.05);` -> `float det = 0.5; random(0.05);` | none | no visible change - pixel-identical to baseline; the noise value n is computed but never used (dead code) | variants/det_0.5/frame_00001.png |
| sw_0.3 | `strokeWeight(ss*0.1);` -> `strokeWeight(ss*0.3);` | moderate | ring stroke triples: the cyan annulus closes into a near-solid disc covering the mid discs, leaving only a tiny centre dot | variants/sw_0.3/frame_00001.png |

## Modularisation notes
- Generic: `getColor`/`paletteLerp` (fractional-index palette sampling) is directly reusable.
  `checkerGrid` (L41-61) is a generic tiled background with parity mode + random flip chance.
  The intersection motif (L79-93) is a clean "lens cell": outer disk, mid disk, stroked ring -
  parameterise (outerScale=1, midScale=0.5, ringScale=sc, ringWeight=0.1) and it becomes a library
  primitive for grid-of-motif compositions.
- One-off art decisions: the specific palette (L158), the black/white outer disk parity, the c3/c4
  mid-disk colours, the -1 loop range to clip edge motifs.
- Dead code to drop in a clean version: `eye()`, `arc2()`, `saveImage()`, `n`/`des`/`det`, the
  commented `rect`/`arc` lines.
- A clean parameter object: {cols, outerColors:[white, black], midColors:[c3, c4], ringColor: c5,
  midScale, ringScale, ringWeight, dotScale, bgColors:[c1, c2], bgMode, flipChance}.
