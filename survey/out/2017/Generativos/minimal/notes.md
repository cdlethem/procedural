---
sketch: 2017/Generativos/minimal
year: 2017
renderer: P3D
size: [720, 720]
libraries: []
deterministic: true
ms_first_frame: 1527
animated: false
techniques: [lines-hatching]
primitives: [ellipse, shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(40,260)", tried: ["random(40,90)"], change: subtle, effect: "coarser hatch strips, barely perceptible; same composition"}
  - {name: iterations, default: 20, tried: [4], change: moderate, effect: "fewer stacked shapes: one big beige triangle dominates, pink triangle + beige disc behind"}
  - {name: hatchDarkAlpha, default: 10, tried: [60], change: subtle, effect: "diagonal hatching now clearly visible on every surface, same layout"}
  - {name: ellipseSpan, default: "sub*0.1..sub*0.4", tried: ["sub*0.5..sub*1.4"], change: subtle, effect: "ellipses span up to the full canvas; this run still ends on a beige half-triangle over blue"}
  - {name: palette, default: "6 pastels", tried: ["#1B1B1B,#F5F1E8,#EA4140"], change: large, effect: "cream field with giant beige disc, red corner triangle, dark-grey wedge"}
reusable_candidates:
  - {name: hatchShadow, signature: "hatchShadow(strips, dir) -> void", note: "diagonal semi-transparent black/white strip overlay rotated 45/135 deg, drawn per shape"}
  - {name: pickDistinct, signature: "pickDistinct(count) -> int[]", note: "random distinct colours from a palette list (lines 30-34)"}
---

## What it draws
Full-bleed minimalist composition of flat pastel shapes on a 720x720 canvas: a
dusty-blue field, a pink right triangle filling the upper-left half, and a
beige quarter-disc whose arc curves up from the bottom edge, all centred on the
canvas. Every visible surface carries a faint diagonal hatched texture (thin
alternating dark/light stripes at low alpha, running at 45 degrees). The image
is static: frames 1, 10 and 60 are identical.

## How the code works
`setup()` (minimal.pde:3) opens a 720x720 P3D window and calls `generate()`
once; `draw()` is empty, so nothing animates (the per-frame reseed at line 12
is commented out).

`generate()` (line 28):
- Picks 3 mutually distinct colours `col1..col3` from the 6-colour pastel
  palette via `rcol()` (lines 30-34, 83-85); `col1` becomes the background
  (line 37).
- `sub = int(random(40, 260))` (line 35) sets the hatching strip count.
- A loop of 20 iterations (line 39) draws one random element each time:
  - first `shadow(int(random(2)), sub)` (line 44) lays a hatched overlay,
  - `rnd = int(random(3))` (line 42): 0 = a centre-anchored ellipse whose
    diameter `ss = (size*2/sub) * int(random(sub*0.1, sub*0.4))` (line 40) —
    so ellipses span roughly 0.2 to 0.8 of the canvas diagonal;
  1 = a full-canvas corner triangle, one of the four corner-right-triangle
    orientations (lines 48-56); 2 = nothing.
  - each shape gets a fresh random palette colour via `fill(rcol())`
    (lines 45-46), opaque, `noStroke()`.
  Because later iterations paint over earlier ones and the triangles cover the
  whole canvas, the final image is dominated by the last few shapes — which is
  why the baseline shows just a triangle, a disc arc and the background.

`shadow(dir, cc)` (line 60) is the hatch: it translates to the centre, rotates
`HALF_PI*(dir+0.5)` (45 or 135 degrees), then draws `cc` full-height vertical
strips of width `size/cc`, alternating `fill(0,10)` (black, alpha 10) and
`fill(255,0)`/`fill(255,10)` (lines 67-77) — a very subtle tonal hatching
reapplied before every shape. All randomness flows from the global `seed`
field (line 1), which the harness sets to 42, making runs deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_90 | `int sub = int(random(40, 260));` -> `int sub = int(random(40, 90));` | subtle | no visible change beyond slightly coarser hatch; same blue/pink/beige layout | variants/sub_90/frame_00001.png |
| count_4 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 4; i++) {` | moderate | far fewer shapes pile up: large beige lower-right triangle, pink upper-left triangle, blue wedge top, small beige disc at centre-left | variants/count_4/frame_00001.png |
| alpha_60 | `if (i%2 == 0) fill(0, 10);` -> `if (i%2 == 0) fill(0, 60);` | subtle | composition unchanged, but the diagonal hatch stripes are now clearly visible on the pink triangle and beige arc | variants/alpha_60/frame_00001.png |
| ellipse_1.4 | `random(sub*0.1, sub*0.4)` -> `random(sub*0.5, sub*1.4)` | subtle | ellipses can now span the whole canvas; this seed still ends on a beige half-canvas triangle over a blue wedge | variants/ellipse_1.4/frame_00001.png |
| palette_dark | `int colors[] = {#EBB858, ...};` -> `{#1B1B1B, #F5F1E8, #EA4140}` | large | cream background, huge beige disc centred, red corner triangle, dark-grey hatched wedge — completely different character | variants/palette_dark/frame_00001.png |

## Modularisation notes
Two blocks are reusable as-is:
- `shadow(dir, cc)` is a generic diagonal-hatch overlay (strip count + 45/135
  direction + low-alpha black/white alternation). A clean signature would be
  `hatch(strips, angle, darkAlpha, lightAlpha)` drawn in canvas space.
- The distinct-colour picker (lines 30-34) is a generic `sampleDistinct(palette, n)`.

One-off art decisions: the 20-iteration pile-up of centred ellipses vs
full-canvas corner triangles, the specific pastel palette, and the
`size*2/sub * random(sub*0.1, sub*0.4)` ellipse sizing formula. A parameter
object for this sketch: `{ iterations, subMin, subMax, ellipseSpanMin,
ellipseSpanMax, palette, hatchAlpha }`. The `getColor()` lerp helper (line 86)
is defined but never called — dead code.
