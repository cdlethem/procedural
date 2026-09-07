---
sketch: 2014/Generativos/palabrasyfuentes
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: false
ms_first_frame: 178
animated: false
techniques: [typography, lines-hatching]
primitives: [shape, line, text]
palette:
  colors: ["#4F525F", "#FB5772", "#FFBF26", "#B0E420", "#A4E4BF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cant (shape count), default: "random(500, 1000)", tried: ["random(50, 100)"], change: none, effect: "no visible change - thread crashes before the loop runs up"}
  - {name: t (shape size), default: "random(20, 220)", tried: ["random(200, 300)"], change: none, effect: "no visible change - only one tiny shape appears before the crash"}
  - {name: c (sides), default: "random(3, 8)", tried: ["random(3, 4)"], change: none, effect: "no visible change - only the first shape's side count is affected"}
  - {name: stroke alpha, default: 4, tried: [40], change: none, effect: "no visible change - the 10-pass outline is never repeated enough to read"}
  - {name: hun (star inner ratio), default: "random(0.5, 1)", tried: ["random(0.2, 0.3)"], change: none, effect: "no visible change - only affects the single first star, if it is a star"}
  - {name: cc (corner lines), default: "random(-2, 40)", tried: ["random(30, 40)"], change: none, effect: "no visible change - thread dies long before the corner line band"}
reusable_candidates:
  - {name: starPolygon, signature: "starPolygon(x, y, size, points, angle, innerRatio) -> void", note: "closed star polygon alternating outer/inner radii"}
  - {name: regularPolygon, signature: "regularPolygon(x, y, size, sides, angle) -> void", note: "closed regular polygon centred at (x, y)"}
  - {name: paletteRandom, signature: "Paleta.rcol() -> color", note: "uniform random pick from a fixed colour list"}
---

## What it draws
A light grey 600x800 canvas that is almost entirely empty, with a single small lime-green
four-point star near the lower-left edge, drawn with a faint grey outline. No other shapes,
corner lines, or the "MOHAVE" title are visible in frame 1: the sketch's `generar()` thread
crashed early (NullPointerException, see baseline result.json), so only the first shape made
it onto the canvas.

## How the code works
`setup()` (lines 4-9) opens the 600x800 window, builds a 5-colour `Paleta` (line 6:
slate grey, pink, amber, lime, mint green), loads a 108 pt "Mohave Bold" font (unavailable on
this machine, silently replaced) and starts `generar()` on a **separate thread** (line 8).
`draw()` (11-12) is empty, so everything that appears is painted by that thread and the
harness snaps frame 1 at t=178 ms.

`generar()` (23-60): for `cant` = random 500-1000 iterations (line 24), each pass picks a
random position (26-27), size `t` 20-220 (28), side count `c` 3-7 (29), rotation (30), inner
ratio `hun` 0.5-1 (31), and with 50% probability draws `estrella()` (72-83, a closed star
polygon alternating outer radius `r` and inner radius `r*hun`) or `forma()` (62-70, a closed
regular polygon). Each shape is first stroked 10 times with `strokeWeight(j)` for j=1..10 and
`stroke(0, 4)` (34-39, a dark near-invisible outline that accumulates into a soft halo),
then filled once with a random palette colour (40-43). Intended result: hundreds of
overlapping translucent-outlined stars/polygons in the 5-colour palette scattered full-bleed.

After the shapes, a band of `cc` = random(-2, 40) parallel diagonal lines is stroked from the
top-left corner in a random palette colour with weight `tam/2` (45-52). Finally the word
"MOHAVE" is drawn at (20,20) in the hue of a random palette colour at HSB brightness 300
(53-59, effectively near-white in that hue).

All randomness comes from unseeded `random()` calls, so renders are not deterministic.
Observed failure: the `generar()` thread dies with a NullPointerException at `endShape(CLOSE)`
(line 69) shortly after start (likely a race between the drawing thread and the render loop),
so the baseline frame shows only one shape.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cant_100 | `  int cant = int(random(500, 1000));` -> `  int cant = int(random(50, 100));` | none | no visible change: empty grey canvas, one faint outlined quadrilateral at the left edge | variants/cant_100/frame_00001.png |
| t_300 | `    float t = random(20, 220);` -> `    float t = random(200, 300);` | none | no visible change: one small lime-green filled triangle near lower-left | variants/t_300/frame_00001.png |
| c_3 | `    int c = int(random(3, 8));` -> `    int c = int(random(3, 4));` | none | no visible change: one lime-green 4-point star with dark outline at lower-left | variants/c_3/frame_00001.png |
| alpha_40 | `      stroke(0, 4);` -> `      stroke(0, 40);` | none | no visible change: one faint 5-point star outline at left edge, no fill | variants/alpha_40/frame_00001.png |
| hun_0.25 | `    float hun = random(0.5, 1);` -> `    float hun = random(0.2, 0.3);` | none | no visible change: one lime-green 4-point star at lower-left | variants/hun_0.25/frame_00001.png |
| cc_40 | `  int cc = int(random(-2, 40));` -> `  int cc = int(random(30, 40));` | none | no visible change: empty grey canvas, single shape too faint to place | variants/cc_40/frame_00001.png |

Every variant scored `none`: in all six runs the `generar()` thread died with a
NullPointerException (line 69 in `forma()`, line 82 in `estrella()` in other runs) after
drawing only the first shape, so none of the changed parameters (count, size, sides,
outline alpha, star ratio, corner lines) reached the canvas. The only differences between
frames are which single shape got drawn before the crash, consistent with
`"deterministic": false`.

## Modularisation notes
Generic, library-worthy: `forma()` -> `regularPolygon(x, y, size, sides, angle)`;
`estrella()` -> `starPolygon(x, y, size, points, angle, innerRatio)`; `Paleta.rcol()` ->
random-colour sampler over a fixed list. One-off art decisions: the 10-pass
increasing-`strokeWeight` outline halo, the top-left diagonal line band, the HSB
"brightness 300" title treatment, the specific 5-colour palette, and the thread-based
generation (the crash-prone part). A clean parameter object would hold: shape count,
size range, side count range, inner ratio range, outline pass count/alpha, line band
(count, size, spacing), title text/font, palette, seed. Note: the sketch as written is
unstable (thread crash); a serialised `generate()` called from `draw()` or `setup()`
would be the fix.
