---
sketch: 2018/Generativos/quadShadow
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1613
animated: false
techniques: [grid, shader, dots-stippling, blend-modes]
primitives: [rect, shape]
palette:
  colors: ["#191F5A", "#5252C1", "#9455F9", "#FFA1FB", "#FFFFFF", "#51C3C4", "#EE4764", "#E472E8", "#FFB452"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(20, 80)", tried: ["random(100, 150)"], change: large, effect: "far denser field — many more tiles, overlapping shadow tails fill most of the frame"}
  - {name: ssExp, default: "random(3, 8)", tried: ["random(3, 5)"], change: moderate, effect: "larger minimum tile size — chunkier tiles, fewer thin slivers, same fan direction"}
  - {name: maxb, default: "random(0.4, 1.5)", tried: ["random(3.0, 5.0)"], change: moderate, effect: "longer shadow tails — each trapezoid stretches further from its tile"}
  - {name: dScale, default: 200, tried: [60], change: subtle, effect: "subtle: shadow tails slightly longer / fan more strongly; tiles and composition largely unchanged"}
  - {name: background, default: 240, tried: [15], change: large, effect: "dark near-black ground — colored tiles and alpha-fading shadows glow on dark, off-white ground gone"}
reusable_candidates:
  - {name: quadCastShadow, signature: "quadCastShadow(x, y, size, color, lightX, lightY, maxb) -> void", note: "solid square plus two alpha-gradient trapezoids cast away from a shared vanishing point (fake 3D extrusion)"}
  - {name: grainShader, signature: "grainShader(glsl) -> PShader", note: "fragment shader multiplying alpha by a per-pixel rand() to dither the whole scene into visible grain"}
---

## What it draws
A scattered field of flat, axis-aligned squares in a bright palette (magenta/pink,
purple, teal, orange, red, dark navy) on an off-white ground. Every square casts a
soft coloured "shadow" — a pair of trapezoids that taper to transparent — and all the
shadows fan away from a single off-canvas vanishing point, so the flat tiles read as
extruded blocks with long cast shadows. A fine grain/dither texture sits over the
entire image.

## How the code works
- `generate()` (l.28): `randomSeed(seed)` then `background(240)` (l.32) sets the light
  ground.
- `cc = int(random(20, 80))` (l.36) picks how many tiles. Each tile gets a size
  `ss = width / 2^int(random(3, 8))` (l.39) — i.e. a power-of-two fraction of the width,
  so a fixed set of discrete sizes. Its position is random, then snapped onto a grid of
  cell size `ss` via `xx -= xx % ss` (l.40-43). Points (x, y, ss) are stored.
- A vanishing/light point `mx, my` (l.48-49) and a shadow-length scale
  `maxb = random(0.4, 1.5)` (l.50) are chosen once for the whole scene.
- Per tile (l.52-106): the center `(cx, cy)` (l.59-60) is measured against the vanishing
  point — `dis`/`d = dis/200.` (l.61-62) and `ang = atan2(...)` (l.63). `mix`
  maps the angle into a brightness `shd1/shd2 = lerp(220, 140, ...)` (l.71-74); `sel`
  (l.76) picks which two edges to extrude from based on the angle quadrant. The shadow
  offset `(dx, dy) = (cos, sin) * b * d` (l.77-78) grows with distance.
- Two `beginShape()` trapezoids are drawn (l.84-100), each fading from a solid alpha
  (`shd1`/`shd2`) to `0` across the extruded face — this is the soft cast shadow.
  Then the solid tile is drawn with `rect(xx, yy, ss, ss)` (l.104).
- `shader(noi)` (l.67) is active for every tile and shadow and is never reset, so the
  whole scene goes through `ToonFrag.glsl`, whose `main()` multiplies alpha by
  `0.001 + pow(rand(gl_FragCoord.xy*0.001), 0.4)` — a per-pixel hash — producing the
  uniform grain.
- `rcol()` (l.171-173) samples one colour at random from `colors[]` (l.170) per tile.
- `draw()` does nothing (l.15-18); the scene is generated once in `setup()` and only
  re-generated on a key press, so the render is static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(20, 80));` -> `int cc = int(random(100, 150));` | large | much denser: many more tiles of all sizes, overlapping shadow tails fill most of the frame and read as a crowded extruded skyline on dark gaps | variants/cc_100/frame_00001.png |
| ss_3_5 | `float ss = width*1./int(pow(2, int(random(3, 8))));` -> `...int(random(3, 5))...` | moderate | tiles are chunkier — the smallest slivers are gone, more medium/large squares, same fan toward the upper-right vanishing point | variants/ss_3_5/frame_00001.png |
| maxb_5 | `float maxb = random(0.4, 1.5);` -> `float maxb = random(3.0, 5.0);` | moderate | shadow tails noticeably longer — each trapezoid stretches further from its tile, more overlap, same tile positions | variants/maxb_5/frame_00001.png |
| d_60 | `float d = dis/200.;` -> `float d = dis/60.;` | subtle | subtle: shadow tails extend a bit further and fan more strongly with distance; the solid tiles and overall layout are unchanged | variants/d_60/frame_00001.png |
| bg_15 | `background(240);` -> `background(15);` | large | ground becomes near-black: the off-white is gone, colored tiles and their alpha-fading shadows now read as glowing blocks over dark | variants/bg_15/frame_00001.png |

## Modularisation notes
The generic, reusable core is `quadCastShadow`: given a square (x, y, size, color) and a
shared vanishing/light point, it computes the per-tile angle, the distance-scaled offset,
and emits two alpha-gradient trapezoids plus the solid square. This is a self-contained
"flat tile with a perspective cast shadow" primitive.

The grain is a one-line fragment shader (`ToonFrag.glsl`) keyed to `gl_FragCoord`; it is
fully generic and worth keeping as a reusable `grainShader` (exponent + cell scale are
the two knobs).

One-off art decisions: the power-of-two tile-size set and grid snapping (l.39-43), the
specific 10-colour `colors[]` list (l.170), the single global vanishing point, and the
`lerp(220, 140, ...)` shadow brightness range.

A clean parameter object: `{ count, sizeExponentRange, vanishingPoint, shadowLength (maxb),
distanceScale (200), grainExponent, grainScale, palette, background }`.

Experiments confirmed which knobs matter: tile count (`cc`) and background are the two
largest levers (large change), tile size and shadow length are moderate, and the
distance scale (`dScale`) only subtly retunes shadow length because the solid tiles —
which dominate the frame — are held fixed by the shared seed.
