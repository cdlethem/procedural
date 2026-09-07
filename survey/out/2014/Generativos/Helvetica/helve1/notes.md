---
sketch: 2014/Generativos/Helvetica/helve1
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 223
animated: false
techniques: [typography]
primitives: [text, rect]
palette:
  colors: ["#DCDCDC"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: scatteredTextRain, signature: "scatteredTextRain(text, count, font, hMin, hMax, sMin, sMax, b) -> void", note: "draw `count` copies of a word at random canvas positions with random HSB fill"}
  - {name: stackedHeadline, signature: "stackedHeadline(text, n, size, x, y, dy, color) -> void", note: "n copies of a word stacked vertically with fixed spacing"}
---

## What it draws
A full-bleed field of the word "Dormir." repeated ~1000 times at a fixed ~90px size, each copy in a
pastel random colour (full hue range, low saturation), scattered edge to edge so the letters overlap
into a dense rainbow confetti. Overlaid on the left are five large light-gray "Dormir." headlines
stacked vertically (128px), which read as the foreground. A thin gray frame (10px top/left/right, 30px
bottom bar) borders the composition. The image is static; the whole thing is drawn once in `setup()`.

## How the code works
Everything happens in `setup()` (helve1.pde):
- `colorMode(HSB, 360, 100, 100)` (line 3) then a 1000-iteration loop (lines 8–13): each iteration
  fills with `random(360), random(0,20), 80` — random hue, saturation clamped to 0–20, brightness 80,
  which is what produces the pastel confetti look — and draws `text("Dormir.", x, y)` at random canvas
  positions (lines 10–11) with the 90px Helvetica-Bold vlw font (lines 6–7) and `textAlign(CENTER,CENTER)`.
- Randomness enters only via `random()` calls; the sketch is deterministic under a fixed seed.
- Lines 14–20: back to `colorMode(RGB,256)`, `fill(220)` (light gray), 128px bold font, and a 5-iteration
  loop drawing "Dormir." left-aligned at `y = 30 + i*110` — the stacked gray headlines.
- Lines 21–24: four `rect()` calls form the gray border (10px on three sides, 30px bottom bar).
- `saveFrame("dormir")` (line 25) is a leftover save attempt (fails headless, harmless).
No blend modes, transforms, or noise; the look is purely random placement + low-saturation HSB fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- The scattered-text loop (lines 8–13) is fully generic: word, count, font, HSB ranges as parameters.
  `scatteredTextRain` above captures it.
- The stacked-headline loop (lines 18–20) is a trivial generic `stackedHeadline`.
- The border rects are one-off art decisions (asymmetric 10/30px frame) — keep them in the sketch, not the library.
- A clean parameter object: `{word, count, fontSize, hueRange, satRange, brightness, headlineCount, headlineSize, headlineColor, frameWidths}`.
- Font loading is a dependency: the sketch needs a `.vlw` file in `data/` (or a system font fallback,
  which is what actually rendered here — stderr shows "Helvetica Bold" not available, a fallback was used).
