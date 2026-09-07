---
sketch: 2016/Generativos/textureGridText
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 441
animated: false
techniques: [typography, grid, pixel-ops]
primitives: [text, pixels, rect]
palette:
  colors: ["#B5A3C7", "#8B5CF6", "#B5A3C7"]   # HSB-derived, single random hue h: bg (h,18,78) ~#B5A3C7; letters/sidebar (h,60,100); ghosts/trails are alpha variants of the same hues
  selection: fixed
composition: full-bleed
parameters:
reusable_candidates:
  - {name: textTrail, signature: "textTrail(ch, x, y, dir, len, alpha) -> void", note: "echo a glyph along a cardinal direction with low alpha, building a motion streak"}
  - {name: paperGrain, signature: "paperGrain(d, gridDarken, speckle) -> void", note: "per-pixel pass: darken on a period-d grid + random gray speckle (lines 74-84)"}
  - {name: hueLock, signature: "hueLock(h, s, b) -> color", note: "single random hue, 2-3 fixed (s,b) pairs for bg/ink/ghost"}
---

## What it draws
A lavender field covered with an 8x8 grid of random uppercase letters in a saturated
purple, each letter trailed by a faint motion-blur streak of the same glyph repeating
along a random horizontal/vertical direction. A solid purple vertical bar runs down the
left edge carrying a rotated "Serie: 1 Seed ..." label, with a few ghosted copies of the
label offset by a few pixels. The whole image has a fine grainy, slightly gridded paper
texture. (Font "Chivo-Bold" is not installed; a fallback sans-serif is used.)

## How the code works
`generate()` (lines 22-72), called once from `setup()` (line 6); `draw()` is empty, so
the piece is static (key 's' saves, other keys re-generate).

- `colorMode(HSB, 360, 100, 100)` (line 23) locks the palette to one random hue
  `h = random(360)` (line 24); background is `(h, 18, 78)` (line 25), the low-saturation
  lavender field.
- `rect(0, 0, 40, height)` (line 30) filled `(h, 60, 100)` (line 28) is the solid left
  sidebar bar.
- A `pushMatrix()` block (lines 32-44) translates to the left edge and rotates 90 deg;
  it draws the seed label `text("Serie: 1 Seed ...")` once at `(h, 18, 78)` (line 39)
  plus 8 ghost copies at alpha 30 with `random(-2,2)` offsets (lines 40-43) — the
  doubled/echoed label on the bar.
- The main grid: `textSize(96)` (line 46); letters come from the string
  `"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"` (line 47). The nested loops `j,i` run 1..9 (lines 49-50)
  for 8x8 cells at `x = i*96+26, y = j*96` (lines 51-52). Each cell picks a random char
  (line 55), replaced by a space with 5% probability (line 56), drawn at
  `(h, 60, 100, random(210,256))` (line 57) — the crisp letters.
- Trail: after the crisp letter, the same char is re-drawn `dd = random(80)` times
  (lines 61-67) at alpha 6 (line 60) along a random cardinal direction
  `dir = int(random(4))*HALF_PI` (line 62), stepping `k` pixels — the faint streaks.
- `paper(random(2.5, 5))` (line 71) is the final per-pixel pass (lines 74-84): for every
  pixel it lerps toward black on a period-`d` grid (`max(i%d, j%d)/d`, line 78) and adds
  a random gray speckle (line 80) — the grainy, slightly banded paper texture.

Randomness enters at: hue (line 24), label seed (line 35), ghost offsets (line 42),
per-cell letter (line 55), space skip (line 56), letter alpha (line 57), trail length
(line 61), trail direction (line 62), and every pixel in `paper()` (line 80).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `paper(float d)` (lines 74-84) is fully generic: a two-parameter (grid period + darken
  strength + speckle amount) pixel-noise post-process; trivially a library function. It is
  the most reusable block.
- The trail loop (lines 60-67) is a clean `textTrail(char, x, y, dir, len, alpha)`
  primitive, decoupled from the grid.
- The grid (lines 48-69) is a generic "random-char grid + per-cell trail" composition;
  the alphabet string, cell pitch (96), grid bounds, and 5% blank rate are the art
  decisions to parameterise.
- `hueLock` (lines 23-28): one random hue driving fixed (s,b) pairs for bg/ink — a small
  reusable palette helper.
- A clean parameter object: `{hue, bg:[s,b], ink:[s,b], cellSize, gridN, alphabet,
  blankRate, trailLen, trailAlpha, letterAlpha, sidebarW, paper:{d, darken, speckle}}`.
- The rotated label block (lines 32-44) is one-off art direction (series/seed stamping),
  not reusable.
