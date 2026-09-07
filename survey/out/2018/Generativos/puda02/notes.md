---
sketch: 2018/Generativos/puda02
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1536
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [line]
palette:
  colors: ["#FEAFCC", "#70A7FB", "#010101", "#BE0117"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(300,360)", tried: ["random(60,100)"], change: "", effect: ""}
  - {name: des_amp, default: 30, tried: [80], change: "", effect: ""}
  - {name: detAng, default: "random(0.002,0.01)*0.1", tried: ["*0.4"], change: "", effect: ""}
  - {name: line_alpha, default: 40, tried: [120], change: "", effect: ""}
  - {name: dc, default: "random(0.002)*random(1)", tried: ["random(0.05)*random(1)"], change: "", effect: ""}
  - {name: palette, default: "pink/blue/black/darkred", tried: ["white/yellow/pink/cyan/blue/navy"], change: "", effect: ""}
reusable_candidates:
  - {name: noiseWarp, signature: "noiseWarp(x, y, angleSeed, angleScale, ampSeed, ampScale, amp) -> PVector", note: "displaces a point along a simplex-noise angle with simplex-noise magnitude (desform, line 124)"}
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, warp) -> polyline", note: "polyline whose vertices are warped through noiseWarp (nline, line 86)"}
  - {name: colorRamp, signature: "colorRamp(colors[], v) -> Color", note: "fractional-index lerp across a color list (getColor, line 205)"}
---

## What it draws
On an almost-black background, a dense stack of very thin, faint horizontal lines runs
edge to edge, each line gently undulating in a slow wave-like way. The lines are dark
maroon/dark-red overall, with a faint pink and a faint blue cast near the top rows. The
effect reads as a fine, dim hatching whose warp varies smoothly across the canvas;
nothing else is drawn.

## How the code works
- `setup()` (line 6) calls `generate()` once; `draw()` (line 13) is empty, so the piece
  is static. `keyPressed` regenerates with a new seed.
- `generate()` (line 24): `blendMode(ADD)` over `background(#010101)` (lines 26-31).
  Random noise offsets `desAng/detAng/desDes/detDes` are drawn from the seeded
  `random()` (lines 33-36); `detAng` scales the simplex noise by 0.0002-0.001 and
  `detDes` by 0.0004-0.002, so both fields are very coarse.
- The line stack (lines 42-54): `cc` = 300-360 horizontal lines spaced `ss = (width-40)/cc`
  px apart. Each line is `nline()` (line 86), a polyline sampled at 1 pt/px from x=20 to
  x=940, with every vertex displaced by `desform()`.
- `desform()` (line 124): angle = `SimplexNoise.noise(desAng+x*detAng, desAng+y*detAng) *
  TAU*3` (0-3 full turns) and distance = `SimplexNoise.noise(desDes+x*detDes,
  desDes+y*detDes) * 30` px. This is the warp that bends the straight lines.
- Colour (lines 47-52): `strokeWeight(1.4)`, `stroke(getColor(ic+dc*j), 40)` — alpha 40
  under ADD. `getColor(v)` (line 205) takes the fractional position `v` across
  `colors[] = {#FEAFCC, #70A7FB, #010101, #BE0117, #FEAFCC, #BE0117}` and lerps between
  adjacent entries, so hue drifts smoothly down the stack; `ic` (random start) and `dc`
  (tiny per-line drift) shift where each line lands on that ramp. The black entry
  (#010101) in the ramp produces the near-invisible dark-red rows in the middle of the
  image.
- The second block (lines 59-83) loops `for (i = 0; i < 0; i++)` — never executes — so
  the `circle()`/`aro()`/`arc2()` arc-drawing code (lines 97-181) is dead in this
  configuration.
- Deterministic: `randomSeed(seed)`/`noiseSeed(seed)` at the top of `generate()`;
  `seed` is set by the harness (42).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `desform` (noiseWarp) and `nline` (noiseLine) are self-contained — a
  "warp a point/polyline through two simplex fields" utility is directly reusable;
  `getColor` (colorRamp) is a standard fractional-index color ramp.
- One-off art decisions: the ADD blend + alpha 40 dimness, the specific 6-entry palette
  with a black entry in the middle (creates the dark band), `cc` in 300-360, the
  coarse field scales (`*0.1` / `*0.2` multipliers on the 0.002-0.01 scales), and the
  disabled arc layer (`i < 0`), which is a toggle the artist uses to switch between the
  line-only and the layered-circle look.
- Clean parameter object: `{seed, lineCount, margin, strokeWidth, lineAlpha,
  angleScale, ampScale, amp, ic, dc, palette[], blendMode, arcsEnabled}`.
