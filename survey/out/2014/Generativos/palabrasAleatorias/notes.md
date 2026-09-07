---
sketch: 2014/Generativos/palabrasAleatorias
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: false
ms_first_frame: 950
animated: true
techniques: [lines-hatching, dots-stippling, typography]
primitives: [ellipse, text]
palette:
  colors: ["#6F7A5C", "#7347C0", "#8A5CE6", "#C9B8DC"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cant, default: "random(10, 50)", tried: [15], change: none, effect: "no visible change at frame 1 (plain background); stroke count only affects the async composition from frame 10"}
  - {name: h, default: "random(256)", tried: [200], change: large, effect: "background shifts from bright olive to a dark muted teal-green (all colours share the run hue)"}
  - {name: bgValue, default: "random(180)", tried: [60], change: large, effect: "background darkens from bright olive to dark olive/brown"}
  - {name: fgrande, default: 96, tried: [40], change: none, effect: "no visible change at frame 1 (title is drawn by the async thread after frame 1)"}
  - {name: tam2-case0, default: "random(5, 50)", tried: ["random(5, 200)"], change: none, effect: "no visible change at frame 1 (strokes are drawn by the async thread after frame 1)"}
reusable_candidates:
  - {name: taperedLine, signature: "taperedLine(x1, y1, x2, y2, w1, w2, col1, col2, taper='linear'|'ease'|'exp') -> void", note: "line drawn as a run of ellipses with mapped width and lerped colour; three taper profiles in the sketch"}
  - {name: hsbPoster, signature: "hsbPoster(hue, bgValue, lineCount) -> void", note: "single-hue poster: background, N random tapered strokes, big title + subtitle in offset hue"}
---

## What it draws
Poster-like composition on a muted olive-green field. Ten to fifty thick violet
strokes cross the canvas at random angles; each is a tapered "fat line" — bulging,
pointed, or lens-shaped — built from overlapping dots that fade between two shades
of the same violet hue. Top-left, a large lavender title shows a random Spanish word
(e.g. "Zeltún") in capital-first case, with a smaller line under it joining two more
random words with a "+" sign. Frame 1 is just the plain background: the drawing
happens in a background thread, so the composition appears a moment later and stays
put (frame 10 == frame 60).

## How the code works
`setup()` (lines 10–18) sizes 600x800, sets `colorMode(HSB, 256)`, creates three
"Helvetica Bold" fonts (8/32/96 pt — font missing, Processing substitutes), loads a
Spanish word list from a URL (`loadStrings`, line 16), and kicks off `generar()` in
a new `thread` (line 17). `draw()` is empty (lines 20–21); anything not 's' in
`keyPressed` re-runs the generation.

`generar()` (lines 31–90):
- One random hue `h` per run (line 36). Background is the complementary hue
  `(h+128)%256` with medium saturation, high value (line 37) — the olive field.
- `cant = int(random(10, 50))` strokes (line 38). Each picks two random points
  extended ±100 past the edges (lines 40–43), rolls `r` in {0,1,2} (line 44) and
  calls one of three stroke builders with two same-hue, high-value random colors
  (lines 47–48).
  - `lineaGordita` (case 0, lines 99–109): walks the segment in steps of 2 px,
    width linearly mapped anc1→anc2 (thin start, thick end), colour lerped
    col1→col2 — a comet/tapered stroke.
  - `lineaGordita2` (case 1, lines 111–125): steps of 1 px; width is the sum of a
    ramp up from 0 at the start and a ramp down to 0 at the end (clamped), giving
    a lens/bulb shape with rounded ends; half the time both ends equal (capsule).
  - `lineaGordita3` (case 2, lines 127–143): same but the ramps pass through an
    exponential ease `(exp(x)-1)/(exp(1)-1)` and a `tam /= 0.5+...` term thins the
    middle, yielding S-shaped/whiplash strokes.
- Typography (lines 69–87): title fill is hue `h+64` (offset from the strokes),
  96 pt; a random word is title-cased (line 84) and drawn at (32, 50). A drop-tail
  check (lines 74–83) pushes the subtitle down 16 px if the title contains a
  g/j/p/q/y. Subtitle is 32 pt, two more random words joined by " + " (line 87).

Randomness: word list, all points, sizes, hue. `deterministic: false` in the
baseline (thread timing + network word list), so re-renders differ in layout and
words; only compare large-scale changes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cant_15 | `int cant = int(random(10, 50));` -> `int cant = 15;` | none | no visible change: frame 1 is still the plain bright-olive background, identical to baseline frame 1 | variants/cant_15/frame_00001.png |
| hue_200 | `float h = random(256);` -> `float h = 200;` | large | background is a clearly different dark muted teal-green (baseline: bright olive); a sliver of bright stroke already visible at left edge | variants/hue_200/frame_00001.png |
| bgval_60 | `background((h+128)%256, random(60, 120), random(180));` -> `...random(60));` | large | background darkens to a dark olive/brown field | variants/bgval_60/frame_00001.png |
| fontsize_40 | `fgrande = createFont("Helvetica Bold", 96, false);` -> `...40, false);` | none | no visible change: frame 1 is still the plain olive background (title not drawn yet) | variants/fontsize_40/frame_00001.png |
| width_200 | `tam2 = random(5, 50);` -> `tam2 = random(5, 200);` | none | no visible change: frame 1 is still the plain olive background (strokes not drawn yet) | variants/width_200/frame_00001.png |

Score caveat: `render.py` scores frame 1 only, and this sketch draws its entire
composition in a background thread, so frame 1 is (nearly) always just the
background. Only hue and background-value changes are visible at frame 1; the
stroke-count, font-size and stroke-width effects live in frame 10+, which this
protocol does not inspect. Two first attempts (cant_15, width_200) crashed with a
NullPointerException before any frame 10 could be saved — consistent with the
network word-list `loadStrings` returning null on a flaky fetch; both succeeded
on retry (7 of 8 allowed renders used).

## Modularisation notes
The three `lineaGordita*` functions are the reusable core: one
`taperedLine(...)` taking a width profile (linear / symmetric-ramp / exponential)
plus two endpoint colours covers all cases; the ellipse-dot construction is a
generic stippled-line primitive. `generar()` is a thin composition recipe:
single-hue scheme (bg = hue+128, strokes = hue, text = hue+64), N random strokes,
title + "word + word" subtitle. A parameter object would carry: hue, bgValue,
strokeCount, width range per profile, profile mix, font sizes, margin (32/50/130),
word source. The URL word list and Google-Translate `tranducir()` (dead code,
lines 92–97) are one-off/network-coupled and should be replaced by an injected
word list.
