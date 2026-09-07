---
sketch: 2018/Generativos/puda
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1691
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [shape]
palette:
  colors: ["#FEAFCC", "#70A7FB", "#010101", "#BE0117"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(300,360)", tried: [120], change: moderate, effect: "fewer lines -> ~7 px spacing, individual hatched strokes with black gaps between them, thinner ridge lines"}
  - {name: bb, default: 20, tried: [80], change: large, effect: "thick black margin all around; inner field unchanged"}
  - {name: strokeWeight, default: 1.4, tried: [3], change: none, effect: "no visible change; stroke is hidden under the overlapping fills"}
  - {name: dispAmp, default: 30, tried: [80], change: moderate, effect: "larger displacement -> longer stretched folds, background black shows at right edge where lines get pushed off-canvas"}
  - {name: detDes, default: "random(0.002,0.01)*0.2", tried: "random(0.002,0.01)*0.5", change: moderate, effect: "finer displacement field -> more, smaller wiggles and ridge loops"}
  - {name: palette, default: "#FEAFCC/#70A7FB/#010101/#BE0117", tried: "#FFFFFF/#FEE71F/#FF7991/#26C084/#0E0E0E", change: large, effect: "whole surface recolours white-yellow; dark ridge lines remain, driven by the dark palette entry"}
reusable_candidates:
  - {name: noiseWarpLine, signature: "noiseWarpLine(x1, y1, x2, y2, angleOffset, angleScale, dispOffset, dispScale, amp) -> PVector[]", note: "polyline whose points are displaced along a simplex-noise angle with a second simplex-noise magnitude"}
---

## What it draws
A near-black canvas filled edge to edge with ~300 wavy, near-horizontal pink lines,
spaced so close (~2.5 px) that the surface reads as continuous. Simplex-noise distortion
bends the lines so they fold into contour-like loops; because the palette contains dark
entries, those folds trace thick black wavy ridges, while the surfaces between are flat
pink shifting to pale lavender toward the bottom.

## How the code works
- `setup()` (L6-11): `size(960,960,P2D)`, `smooth(8)`, calls `generate()` once; `draw()`
  (L13-14) is empty, so the piece is static. `keyPressed` regenerates with a new seed (L16-22).
- `generate()` (L24-81): `randomSeed`/`noiseSeed` from `seed`; `background(#010101)` (L29).
  Random offsets `desAng`/`desDes` and scales `detAng = random(0.002,0.01)*0.1` /
  `detDes = random(0.002,0.01)*0.2` (L31-34) position the two simplex-noise fields.
  `cc = int(random(300,360))` lines (L40), margin `bb = 20` (L41), spacing
  `ss = (width-2*bb)/cc` (L42); `strokeWeight(1.4)`, `stroke(255,20)` (L44-45).
- Loop L48-51: for each line j, `fill(getColor(ic+dc*j))` — a colour lerp-interpolated along
  the 6-entry `colors[]` palette (L185) starting at random `ic` with a tiny per-line step
  `dc = random(0.002)` (L46-47) — then `nline(bb, bb+j*ss, width-bb, bb+j*ss)` draws a
  horizontal line across the canvas.
- `nline` (L83-92): samples the line at pixel resolution and displaces every vertex with
  `desform` (L121-125): angle from simplex noise field 1 scaled to `TAU*20.9` (many
  rotations), magnitude from field 2 scaled to 30 px. Because the fill colour changes
  gradually over j while the displacement folds the lines, the dark palette entries
  (#010101, #BE0117) trace the fold ridges and the light entries fill the surfaces.
  Lines are drawn top-to-bottom so lower lines paint over upper ones; ~2.5 px spacing makes
  the surface continuous. The 1.4 px white stroke is effectively invisible (see
  strokeWeight_3 experiment: raising it to 3 changed nothing).
- The circle/arc block (L53-80, `for i < 0`) is dead code; `circle()`, `aro()`, `arc2()`
  are never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_120 | `int cc = int(random(300, 360));` -> `random(120, 130)` | moderate (0.137, 37% px) | lines spaced ~7 px apart read as hatching with black gaps between strokes; dark ridges thinner; same band structure | variants/cc_120/frame_00001.png |
| bb_80 | `float bb = 20;` -> `float bb = 80;` | large (0.204, 36% px) | 80 px black margin all around; interior identical in character | variants/bb_80/frame_00001.png |
| strokeWeight_3 | `strokeWeight(1.4);` -> `strokeWeight(3);` | none (0.004, 0% px) | no visible change; the 20-alpha white stroke is buried under the fills | variants/strokeWeight_3/frame_00001.png |
| dispAmp_80 | `...desDes+y*detDes)*30` -> `*80` | moderate (0.070, 15% px) | folds stretched and elongated; black background appears at the right edge where lines are pushed off-canvas | variants/dispAmp_80/frame_00001.png |
| detDes_0.5 | `random(0.002, 0.01)*0.2;` -> `*0.5;` | moderate (0.102, 24% px) | busier, smaller wiggles; more short ridge loops, banding less smooth | variants/detDes_0.5/frame_00001.png |
| palette_warm | `colors[] = {#FEAFCC, #70A7FB, #010101, #BE0117, #FEAFCC, #BE0117}` -> `{#FFFFFF, #FEE71F, #FF7991, #26C084, #0E0E0E}` | large (0.185, 87% px) | surfaces recoloured white to pale yellow; dark wavy ridges persist (new palette still contains near-black #0E0E0E), confirming ridges are dark-filled lines, not background gaps | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic: `desform()` (dual simplex-noise warp: angle field + magnitude field, with
  offset/scale/amp parameters) and `nline()` (resampled, warped polyline) are the core
  reusable pieces; together they form `noiseWarpLine`.
- One-off art decisions: the 6-entry palette with deliberate dark entries (the ridges),
  the top-to-bottom fill-overdraw that hides the line count, and the per-line colour
  drift `ic + dc*j`.
- Parameter object: `{lineCount, margin, strokeWeight, strokeAlpha, angleOffset, angleScale,
  dispOffset, dispScale, dispAmp, palette, colorOffset, colorStep}`.
- Dead code (circle/aro/arc2, `i<0` loop) should be dropped in a library version.
