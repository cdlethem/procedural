---
sketch: 2018/Generativos/soles
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1753
animated: false
techniques: [grid, polar, noise-field]
primitives: [rect, ellipse, arc, shape]
palette:
  colors: ["#FFFFFF", "#FFD354", "#E95525", "#1F63B8", "#000300"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(4, random(30)) per run (10 in baseline)", tried: [20], change: large, effect: "20x20 grid instead of 10x10; cells and all sun parts scale down, much denser composition"}
  - {name: div, default: "random(8, 32) per cell", tried: [40], change: large, effect: "tick fan always 40 segments (denser, more uniform); score dominated by stream desync: removing the random() call re-shuffles every later colour"}
  - {name: amp, default: 0.4, tried: [0.8], change: subtle, effect: "centre dot diameter up to 2x larger; colours identical, only a small pixel fraction changes"}
  - {name: scatter size, default: "dd*0.4", tried: ["dd*0.7"], change: subtle, effect: "the tiny 3x3 rounded squares around each centre are noticeably bigger"}
  - {name: dt2, default: "random(0.01)", tried: [0.002], change: none, effect: "no visible change; centre-dot size field becomes smoother but the difference is sub-pixel"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "annular arc band drawn as quads, with linear alpha ramp between inner and outer edge"}
  - {name: sunCell, signature: "sunCell(cx, cy, s, palette) -> void", note: "one cell: rounded rect + concentric arcs + radial ticks + centre dot + quarter arc"}
---

## What it draws
A full-bleed grid of roughly 10x10 rounded-square tiles (baseline: 10 columns). Each tile has a
random background from a five-colour palette (white, warm yellow, orange-red, medium blue, near-black)
and a small "sun" in the middle: two concentric translucent arc rings, a fan of short radial tick marks
around the centre, a small central dot, an occasional solid quarter-arc, and a 3x3 scatter of tiny
rounded squares around the centre. The whole image is flat and graphic, no strokes, no gradients
except the soft alpha of the arc rings.

## How the code works
- `setup()` (lines 3-12) sizes a 960x960 P2D window and calls `generate()` once; `draw()` is empty
  (line 14-16), so the image is static (regeneration only on key press, line 18-23).
- `generate()` (lines 25-78): re-seeds `randomSeed` from a fresh `seed` (lines 26-27), paints a
  near-white background (line 28), picks a random cell count `cc` in 4..~30 (line 30) and a cell size
  `ss = width/(cc+1)` (line 31).
- The double loop (lines 40-77) places each cell centred at `(i+1)*ss, (j+1)*ss`. Per cell it draws,
  in order: a rounded rect background `ss-2` wide (line 45); two full concentric arc rings via `arc2`
  with alpha ramp 40->0 (lines 46-47); a small central ellipse of diameter `ss*0.4` (line 49); a fan of
  `div` (8..32) short arc segments around the centre, each a quad with alpha ramp 0->200 in one random
  colour, starting at a random angle (lines 50-57); a second central ellipse (line 59); a noise-sized
  dot whose diameter is `ss * pow(noise(...),0.8) * 0.4`, so dot size varies smoothly across the grid
  (lines 60-62); and a solid quarter-arc of diameter `ss*0.8` whose start quadrant is quantised from
  another noise sample (lines 63-65). Finally a 3x3 mini-grid of tiny rounded squares is drawn
  probabilistically: one random `prob` per cell, each of the 9 positions kept with probability `prob`
  (lines 67-75).
- Colour: every fill comes from `rcol()` (lines 129-131), a uniform random pick from the five-entry
  `colors[]` array (line 128); `getColor`/`lerpColor` (lines 132-141) exist but are unused in
  `generate()`.
- `arc2` (lines 103-121) approximates an annular sector as a fan of quads between an inner and outer
  radius, interpolating alpha from `alp1` (inner) to `alp2` (outer); it is the source of the soft
  ring/tick look.
- Noise enters twice, with independent offsets/details (`ds1/dt1`, `ds2/dt2`, lines 34-37): once for
  the quarter-arc orientation, once for the centre-dot diameter.
- All colours and geometry share one sequential `random()` stream: any substitution that adds or
  removes a `random()` call re-shuffles every later cell (see div_40).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(random(4, random(30)));` -> `int cc = 20;` | large | 20x20 grid of smaller cells; same motif per cell, everything scaled down, composition much denser | variants/cc_20/frame_00001.png |
| div_40 | `int div = int(random(8, 32));` -> `int div = 40;` | large | tick fans are denser and uniform (40 segments); colours are re-shuffled everywhere because dropping the `random()` call shifts the shared random stream, so the score measures desync as much as the parameter | variants/div_40/frame_00001.png |
| amp_0.8 | `...pow(noise(...), 0.8)*0.4;` -> `... *0.8;` | subtle | colours and layout identical to baseline; centre dots up to 2x bigger where noise is high, only a small fraction of pixels differs | variants/amp_0.8/frame_00001.png |
| scatter_0.7 | `rect(xx+ii*dd, yy+jj*dd, dd*0.4, dd*0.4, 2);` -> `dd*0.7, dd*0.7` | subtle | the tiny 3x3 squares around each centre are clearly larger and more readable; rest of composition unchanged | variants/scatter_0.7/frame_00001.png |
| dt2_0.002 | `float dt2 = random(0.01);` -> `float dt2 = random(0.002);` | none | no visible change; centre-dot size field is smoother but the difference is below what the eye can resolve | variants/dt2_0.002/frame_00001.png |

## Modularisation notes
- Generic: `arc2` (alpha-ramped annular arc) is a clean reusable primitive; the per-cell "sun"
  composition (bg rounded rect + rings + tick fan + centre dot + quarter arc + 3x3 dot scatter) is a
  self-contained cell generator parameterised by cell size and palette.
- One-off art decisions: the specific 5-colour palette, the two noise channels and their exponents,
  the fixed alpha values (40, 0, 200), the `prob`-based 3x3 scatter.
- A clean parameter object: {cellCount, cellGap, palette[], ringCount, ringAlpha[], tickRange, tickAlpha,
  dotNoiseDetail, dotMax, quarterArcChance, scatterProb, bgLightness}.
- Caveat for reuse: the sketch draws everything from one global random stream, so parameters are
  coupled through call order; a library version should use per-cell independent draws.
