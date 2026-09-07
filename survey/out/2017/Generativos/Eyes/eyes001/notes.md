---
sketch: 2017/Generativos/Eyes/eyes001
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 307
animated: false
techniques: [curves, symmetry]
primitives: [shape, ellipse]
palette:
  colors: ["#0795D0", "#019C54", "#F5230D", "#DF5A48", "#F1BF16", "#F0C016", "#F4850C", "#E13E33", "#746891", "#623E86", "#00A2C6", "#EBD417"]
  selection: lerp-between
composition: radial
parameters:
  - {name: cc, default: "random(10,200)", tried: [30], change: pending, effect: "number of concentric eye rings"}
  - {name: ss, default: "random(50,260)", tried: [200], change: pending, effect: "central eye / innermost ring size"}
  - {name: rot, default: "random(-PI,PI)", tried: [0], change: pending, effect: "total twist of the ring stack"}
  - {name: mdx, default: "random(0.55,0.64)", tried: [0.9], change: pending, effect: "horizontal curvature of the almond outline"}
  - {name: mdy, default: "random(0.08,0.13)", tried: [0.3], change: pending, effect: "vertical curvature of the almond outline"}
  - {name: dc, default: "random(10)*random(1)", tried: [1], change: pending, effect: "palette step per ring"}
reusable_candidates:
  - {name: bezierEye, signature: "bezierEye(x, y, s, mdx, mdy) -> shape", note: "closed almond/eye outline from 4 vertices + 6 bezier control points; mdx/mdy set the corner pinch and lid height"}
  - {name: concentricRings, signature: "concentricRings(cx, cy, count, maxSize, minSize, twist, colorStep) -> void", note: "loop drawing nested bezierEye shapes, size mapped big->small, per-ring rotation eased from twist to 0, colour cycling through a lerped palette"}
  - {name: cycleColor, signature: "cycleColor(palette[], offset, step) -> color", note: "getColor: lerp between adjacent palette entries at index (offset + i*step) mod palette length"}
---

## What it draws
A huge concentric "eye" target fills the whole canvas: nested almond/eye-shaped rings in saturated red,
yellow, teal, blue, brown and purple, each slightly rotated against the last so the stack twists gently
into a spiral. The outer rings run off all four edges. In the middle sits a real eye: a cream almond,
a golden-yellow iris, and a near-black round pupil.

## How the code works
`setup()` (lines 3-8) sizes a 960x960 canvas and calls `generate()` once; `draw()` is empty, so the
sketch is static (confirmed: frames 10/60 identical to frame 1).

`generate()` (lines 29-88):
1. `background(rcol())` — one random colour from the 12-colour `colors[]` palette (line 30, 124, 126-128).
2. Random parameters (lines 58-64): `cc = int(random(10,200))` ring count, `mdx`/`mdy` almond curvature
   factors, `dc` palette step per ring, `ss = random(50,260)` central-eye size, `rot = random(-PI,PI)`
   total twist. `x`/`y` are reset to 0 (lines 65-66), so every ring is drawn centred on the canvas via
   `translate(width/2, height/2)` (line 73).
3. Ring loop (lines 68-85): for `i` in 0..cc-1, size `s = map(i, 0, cc, width*1.5, ss)` — rings shrink
   from 1.5x canvas width down to `ss`. Each ring is a closed bezier almond (`beginShape`/6
   `bezierVertex`, lines 76-83) whose control points use `mx = s*mdx`, `my = s*mdy`. The ring is rotated
   by `map(i, 0, cc, rot, 0)`, so the outermost ring carries the full twist `rot` and the innermost is
   unrotated — the stack winds like a spiral. Fill is `getColor(ic + dc*i)` (lines 129-135): it lerps
   between adjacent palette colours, so each successive ring slides around the palette by `dc`.
4. `eye(width/2, height/2, ss)` (line 87): `eye()` (lines 90-121) draws a cream (`#EADBC6`) almond of
   size `ss`, a random-palette iris ellipse of size `s`, and a near-black (`fill(10)`) pupil whose
   diameter is a random fraction (0.5-0.9) of `s`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, reusable blocks:
- `bezierEye(x, y, s, mdx, mdy)` (lines 107-114, duplicated inline at 76-83) — the almond outline is a
  clean parameterised shape; `mdx` (corner pinch) and `mdy` (lid height) are the two meaningful dials.
  The inline copy in the ring loop is identical and should be replaced by a call.
- `concentricRings(...)` — the loop at 68-85 is a generic "nested rotated shapes with eased size and
  colour cycle" generator; swap the shape callback for other outlines.
- `cycleColor` (129-135) — palette cycling with lerp; note it takes `abs(v)` and mods by palette length,
  so any offset/step wraps safely.

One-off art decisions: the fixed 12-colour palette (coolors.co, line 123), the specific `map` ranges
(width*1.5 outer size, twist eased to 0), the cream sclera + near-black pupil, and the two commented-out
alternate compositions (scattered eyes lines 33-39, tiled grid of eyes lines 42-54) which are disabled.

A clean parameter object would contain: `count`, `outerSize`, `innerSize`, `twist`, `curveX`, `curveY`,
`palette`, `paletteStart`, `paletteStep`, `pupilFraction` — the random() calls in generate() just seed
these.
