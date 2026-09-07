---
sketch: 2019/generativos/lavita03
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4904
animated: true
techniques: [flow-field, noise-field, lines-hatching, distortion, subdivision, grid]
primitives: [line]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#fac62a"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 400, tried: [200], change: large, effect: "fewer subdivisions -> larger, coarser blocky cells; left bands broaden"}
  - {name: amp, default: 20, tried: [40], change: large, effect: "warp amplitude doubled -> stronger S-curves, more stretched/bent contours"}
  - {name: alpha, default: 38, tried: [120], change: large, effect: "higher stroke alpha -> much more ADD saturation, whiter/brighter, colours wash out"}
  - {name: lar, default: 26, tried: [60], change: large, effect: "longer per-pixel strokes -> smoother flowing ribbons, more white streaks, less fine grain"}
  - {name: detCol, default: "0.0004-0.0006 *1.4", tried: ["*4"], change: moderate, effect: "finer colour-noise scale -> busier, finer-grained colour mottling, same flow structure"}
reusable_candidates:
  - {name: subdivideRect, signature: "subdivideRect(rects, iterations) -> Rect[]", note: "repeatedly pick a rect (index biased toward 0), jitter it, split vertically/horizontally at 20-80%"}
  - {name: flowHatch, signature: "flowHatch(x1, y1, x2, y2, len, palette) -> void", note: "per-pixel short polylines walking a simplex+noise flow field, ADD-blended, palette-lerped"}
  - {name: warpDef, signature: "warpDef(x, y, detail, amp) -> PVector", note: "low-freq simplex angle field displacing every sample point by amp"}
---

## What it draws
Baseline `frame_00001.png` (seed 42): a full-bleed, densely hatched flow-field image in a bright
six-colour palette — red-orange, indigo, cyan-white, pink, green and yellow — over black, with white
saturated streaks where the `ADD`-blended strokes overlap heavily. The composition is a nested
rectangle subdivision: the left ~half is made of broad, strongly-warp horizontal colour bands and
blocks (a big olive/yellow block sits centre), while the right ~third breaks into finer, more vertical
hatching in smaller subdivided cells. Black rectangular voids separate the blocks (gaps left by the
jittered split boundaries). A low-frequency warp bends what would be straight hatching into flowing
contours. `frame_00060.png` is essentially the same image, with only minor first-frame P3D timing
differences.

## How the code works
`setup()` -> `generate()` (lavita03.pde:23,51). `generate()` seeds `randomSeed`/`noiseSeed`
(l:53-54), paints `background(0)` black (l:59), then `blendMode(ADD)` + `noFill()` (l:61-62).

1. **Subdivision** (l:64-86): start from one `Rect` covering the canvas; loop `sub=400` times
   (l:67). Each pass picks an index `int(rects.size()*random(0.5,1)*random(0.01))` (l:69) — the
   `random(0.01)` factor keeps this almost always `0`, so it repeatedly re-splits the *first* rect,
   building a nested/stacked subdivision concentrated in one region (the big centre-left block). The
   picked rect is jittered by ±10px (l:72-73) then split vertically or horizontally (50/50) at a
   random 20-80% mark (l:75-83); the original is removed and both halves added (net +1 rect/pass).
   After 400 passes there are ~401 rects partitioning the canvas.

2. **Hatch each rect** (l:88-91): for every rect call `tel(x1,y1,x2,y2)` (l:95). `tel` first calls
   `randPallets()` (l:97), which reassigns the global `colors` to the fixed 6-colour bright list
   `aux = {#F23602,#300F96,#C9FFF6,#F72C81,#09EFA6,#fac62a}` (l:161-162); the 8-colour muted
   `colors[]` at l:181 is dead/overwritten, and the randomised `aux2` is never used (l:168 commented).

3. **Per-pixel flow-field strokes** (l:114-144): `tel` loops `j=y1..y2, i=x1..x2` at step 1 (every
   pixel). Each pixel spawns a `beginShape(LINES)` with `lar = noise(...)*26` vertices (l:124, 0-26).
   Walking those vertices: an angle is built from `SimplexNoise` + a second `noise` term (l:126-127),
   the point is displaced by `def(x,y)` (l:136), then advanced `x+=cos(ang); y+=sin(ang)` (l:139-140).
   Colour per vertex: `getColor(vc+grid, pwrCol)` (l:133) lerps between adjacent palette entries by
   `pow(v%1,p)` (l:188-193); stroked at alpha 38 (l:134). With ADD blending these overlapping
   low-alpha bright strokes accumulate under ADD blending, brightening dense overlaps toward white (the white streaks); the six palette colours dominate elsewhere.

4. **Global warp** `def(x,y)` (l:149-153): a low-freq `SimplexNoise(x*detDef, y*detDef, seed)` angle
   (l:150) displaces every sample point by `amp=20` (l:151-152) — the broad curvy distortion that
   bends the straight hatching into contours.

Randomness: seed-driven `random`/`noise`/`SimplexNoise` only (no time term); `draw()` is empty
(l:31-32) so the sketch is logically static. The `frame_00001` vs `frame_00010/00060` md5 mismatch
is a P3D first-frame capture/timing artifact (frames 10 and 60 are identical to each other), not
real animation — `animated` is set true only because the saved frames differ per the schema rule.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_200 | `int sub = 400;` -> `int sub = 200;` | large (0.27) | fewer, larger blocky subdivision cells; left bands broaden, big olive/yellow centre block, right side still fine | variants/sub_200/frame_00001.png |
| amp_40 | `float amp = 20;` -> `float amp = 40;` | large (0.26) | stronger global warp; more stretched S-curved contours, slightly more white streaks | variants/amp_40/frame_00001.png |
| alpha_120 | `stroke(col, 38);` -> `stroke(col, 120);` | large (0.30) | much whiter/brighter; heavy ADD saturation washes the palette toward white, fewer distinct colours | variants/alpha_120/frame_00001.png |
| lar_60 | `noise(...)*26;` -> `noise(...)*60;` | large (0.31) | longer flowing strokes; smoother ribbon-like flow, more white streaks, less fine grain | variants/lar_60/frame_00001.png |
| detCol_4 | `random(0.0004,0.0006)*1.4;` -> `... *4;` | moderate (0.15) | same warped-band structure but finer, busier colour mottling; closest to baseline | variants/detCol_4/frame_00001.png |

## Modularisation notes
- **Generic / library-ready**: `subdivideRect` (recursive rectangle splitting with an index-bias
  parameter) and `warpDef` (simplex angle-field displacement) are fully parameterised and reusable.
  `flowHatch` is reusable if the palette, per-vertex length (`lar`), walk angle field, and stroke
  alpha are all inputs.
- **One-off art decisions**: the specific 6-colour palette (l:161), the `*random(0.01)` index bias
  that concentrates subdivision in one block (l:69), the `cos(x*0.2)` y-offset (l:117), the
  `grid` colour term (l:131, currently multiplied by 0), the fixed `amp=20`/`*26` constants, and
  the ADD-blending (which produces the white saturated streaks over the six-colour palette).
- **Clean parameter object**: `{ iterations (sub), splitBias, jitterPx, splitMin, splitMax,
   warpDetail (detDef), warpAmp (amp), strokeLen (lar multiplier), strokeAlpha, colorScale (detCol),
   palette, blendMode }`.
