---
sketch: 2018/Generativos/virus
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 9600
animated: false
techniques: [grid, polar, curves]
primitives: [shape, ellipse]
palette:
  colors: ["#FF5C4E", "#FF96BF", "#FFECDE", "#F9B521", "#F58738", "#00B487", "#005CB5"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, shd1, shd2)", note: "draws an annular sector band between two radii as a fan of quads with per-side alpha (radial fade)"}
  - {name: virusCell, signature: "virusCell(x, y, s, div, sub, amp, colors) -> void", note: "one cell: faded base disk + wedge ring with sub-bands + ring stroke + center dot"}
---

## What it draws
A full-bleed field of ~100 overlapping circular "cells" (the title's viruses) on a soft
green ground. Each cell is a translucent pie of wedge-shaped sectors in coral, pink,
cream, amber, orange, green and blue, denser and more saturated near a thin circle,
fading outward into a hazy mosaic; most cells carry a solid center dot (pink, orange,
blue, cream or coral) of varying size. Because cells overlap with alpha < 255, the
whole canvas reads as a busy, layered mosaic dominated by green with warm accents.

## How the code works
- `setup()` (L3–12): 6500×6500 P2D, `smooth(2)`, calls `generate()` once and exits;
  `draw()` (L14–16) is empty, so the piece is static (single frame).
- `generate()` (L26–64): background = one random palette colour (L27); then a loop of
  100 cells (L31). Per cell: size `s = width / random(3,20)` (L34) so cells are 1/3..1/20
  of the canvas; centre at a random position in `[0, width+s]²` snapped to a grid of
  spacing `s` (L35–39).
  - Base disk: `arc2(x,y,0,s,0,TAU,col2,100,0)` (L42) — a full 360° sector from radius 0
    to s/2, alpha 100 at the inside fading to 0 at the outside.
  - Wedge ring: `div = random(3,120)` angular sectors (L44); each sector is one
    random-coloured wedge `s/2..s` (L50), then split into `sub = random(2,20)`
    concentric sub-bands (L52–54) whose alpha is `random(100,200)/sub * (sub-k)` — high
    near the inside, ~0 at the outer edge, so the ring is crisp inside and hazy outside.
  - Ring stroke: thin circle of diameter `s` in `col1` at alpha 250 (L57–59).
  - Center dot: filled ellipse of diameter `s*amp`, `amp = random(0.2,0.8)`, `col1` at
    alpha 245 (L61–62).
- `arc2()` (L66–84): renders an annular sector as `cc` quads, `cc` proportional to arc
  length (L71); each quad's inner two vertices are filled with alpha `shd1`, outer two
  with `shd2` (here always 0), giving a radial fade across every wedge.
- Colour: palette `colors[]` (L90). `rcol()` (L91–93) picks a random entry for the
  background and every wedge; `getColor()` (L97–103) picks a random position in the
  list and lerps between two adjacent entries for the ring stroke and center dot
  (`col1`), so dot/ring colours sit slightly between palette steps.
- All randomness is seeded `random()`; no noise. `cc` at L30 is declared but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `arc2` is fully generic (position, radii, angle span, colour, two alphas) — a clean
  library primitive for "faded annular sector".
- The per-cell block (L31–63) is a self-contained `virusCell(x, y, s, div, sub, amp)`;
  the only art decisions are the parameter distributions (`s` from 3..20, `div` 3..120,
  `sub` 2..20, `amp` 0.2..0.8) and the palette.
- A clean parameter object: `{cellCount: 100, sizeRange: [3, 20], sectorRange: [3, 120],
  subBandRange: [2, 20], dotRange: [0.2, 0.8], alphaRing: 250, alphaDot: 245,
  colors: [...], seed}`. The unused `cc` (L30) can be dropped.
