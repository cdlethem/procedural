---
sketch: 2014/Generativos/prueba1
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 204
animated: true
techniques: [polar, dots-stippling]
primitives: [ellipse, line]
palette:
  colors: ["#1B214B", "#F0F0E8", "#F7E7CE"]
  selection: fixed
composition: radial
parameters:
  - {name: web_alpha, default: 40, tried: [200], change: subtle, effect: "web rings/spokes clearly more prominent; dot layer unchanged"}
  - {name: center_x, default: 500, tried: [300], change: moderate, effect: "web centre moves to top-centre; dot fan re-aimed toward bottom-left"}
  - {name: center_y, default: 180, tried: [400], change: moderate, effect: "web centre moves to mid-right of canvas; dots fan out toward the left"}
  - {name: dot_size_scale, default: 100, tried: [200], change: moderate, effect: "dots ~2x larger, overlap into a dense bokeh field that buries the web"}
  - {name: spoke_count, default: 40, tried: [80], change: subtle, effect: "spokes visibly finer and dot rows slightly denser; overall close to baseline"}
  - {name: dot_alpha_mod, default: 30, tried: [100], change: moderate, effect: "dots much more opaque (alpha up to 99 instead of 29); web still visible between them"}
reusable_candidates:
  - {name: radialWeb, signature: "radialWeb(cx, cy, maxR, step, color, alpha, weight)", note: "concentric noFill ellipses from r=0 to maxR in `step` increments"}
  - {name: radialSpokes, signature: "radialSpokes(cx, cy, n, r0, r1, weightCycle)", note: "n radial lines from r0 to r1 at even angles; stroke weight cycled by (i%4+1)/4"}
  - {name: radialDotField, signature: "radialDotField(cx, cy, nAngles, dotsPerAngle, rMin, rMax, sizeScale, alphaMod)", note: "per-angle random dots along a ray; dot size scales with distance, alpha = distance % alphaMod"}
---

## What it draws
A dark navy field with a fine, pale web of concentric circles and radial spokes emanating
from a centre in the upper-right area. Hundreds of soft, semi-transparent cream dots are
scattered over the whole canvas, larger and denser towards the lower-left, away from the
web centre. The web itself is static; the dots are re-rolled every frame, so the frame
flickers while the structure stays fixed.

## How the code works
Single tab `prueba1.pde`; `setup()` only sets the 600x800 size, everything is drawn in
`draw()` every frame.
- L6: `background(#1B214B)` clears the frame each pass (no accumulation).
- L7-14: web of concentric circles. `noFill()`, stroke `#F0F0E8` alpha 40, weight 0.8;
  loop `i = 0 .. height*2` step 30 draws `ellipse(x, y, i, i)` with `x = 500`, `y = 180`
  (L9-10), i.e. circles of diameter 0..1590 centred near the top-right.
- L15-20: 40 radial spokes. `a = TWO_PI/40`; per angle a line from radius 15 out to
  radius `height` (800) from the same centre, stroke weight cycling `(i%4+1)/4`
  (0.25..1.0).
- L21-32: dot field. For each of the 40 angles, 100 dots: `dis = random(15, height)`,
  size `tam = (dis/height)*100` (dot diameter scales with distance, max ~100 px),
  alpha `alp = dis % 30` (0..29, so many dots are nearly invisible), fill `#F7E7CE`.
  Dots are placed at `centre + (cos, sin)(ang) * dis`, so they fan out along the spokes.
- Randomness: the global `random()` stream is re-drawn every frame (no `randomSeed`),
  so only the dot layer changes between frames; web and spokes are static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| web_alpha_200 | `stroke(#F0F0E8,40);` -> `stroke(#F0F0E8,200);` | subtle | web rings and spokes clearly more prominent; dot layer unchanged | variants/web_alpha_200/frame_00001.png |
| center_x_300 | `int x = 500;//width/2;` -> `int x = 300;//width/2;` | moderate | web centre moves from top-right to top-centre of canvas; dot fan re-aimed toward bottom-left | variants/center_x_300/frame_00001.png |
| center_y_400 | `int y = 180;//40;` -> `int y = 400;//40;` | moderate | web centre moves to mid-right of canvas; dots fan out toward the left | variants/center_y_400/frame_00001.png |
| dot_size_200 | `float tam = random(dis/height) *100;` -> `... *200;` | moderate | dots ~2x larger, overlapping into a dense bokeh field that nearly buries the web | variants/dot_size_200/frame_00001.png |
| spokes_80 | `i < 40` -> `i < 80` (applies to both spoke and dot loops) | subtle | spokes visibly finer (80 vs 40) and dot rows slightly denser; overall impression close to baseline | variants/spokes_80/frame_00001.png |
| dot_alpha_100 | `float alp = dis%30;` -> `float alp = dis%100;` | moderate | dots much more opaque (alpha up to 99 instead of 29); web visible between them | variants/dot_alpha_100/frame_00001.png |

## Modularisation notes
- The three drawing blocks are cleanly separable and each is parameterisable: the
  concentric-circle web, the spoke ring, and the radial dot field (see
  `reusable_candidates`). A clean parameter object for this sketch would be
  `{center: [x, y], web: {maxRadius, step, color, alpha, weight}, spokes: {n, r0, r1},
  dots: {nAngles, perAngle, rMin, rMax, sizeScale, alphaMod, color}}`.
- One-off art decisions: the specific navy/cream palette, the fixed centre offset
  (500, 180) instead of the canvas centre, the `(i%4+1)/4` spoke weight cycle, and the
  `dis % 30` alpha trick that makes dot brightness band with distance.
