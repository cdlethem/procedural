---
sketch: 2014/Generativos/Curvas/prueba1
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 226
animated: false
techniques: [curves]
primitives: [line, ellipse]
palette:
  colors: ["#D4FAF3", "#33A691", "#2D3A52", "#B31750", "#FF3F21"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(10, 40))", tried: [40], change: large, effect: "more fans (up to 40) -> busier composition, more overlapping ribbons, background mostly covered"}
  - {name: cant, default: "int(random(80, 180))", tried: [180], change: large, effect: "every fan gets 180 curves -> wider denser ribbons that read as solid filled shapes"}
  - {name: fanStep, default: "random(2, 6)*random(2)", tried: ["random(4, 8)*random(2)"], change: moderate, effect: "larger spacing between curves -> fans look sparser and more clearly striped, less solid fill"}
  - {name: fanRadius, default: "random(40, 200)", tried: ["random(100, 400)"], change: moderate, effect: "control points farther from center -> much larger sweeping fans, a few of which dominate the canvas"}
  - {name: palette, default: "#D4FAF3 #33A691 #2D3A52 #B31750 #FF3F21", tried: ["#765664 #EC7D88 #F4EC84 #62B681 #ECB973"], change: large, effect: "entire image recolored including the background: dark plum ground with salmon, peach, green and pale-yellow ribbons"}
  - {name: alpha, default: 255, tried: [100], change: moderate, effect: "semi-transparent strokes: dense fans accumulate overlaps into washed-out solid areas, overall contrast lower, background unchanged"}
reusable_candidates:
  - {name: bezierFan, signature: "bezierFan(center, spread, step, count, colorFn) -> void", note: "N copies of one 4-control-point bezier offset along a fixed angle, forming a fan/ribbon of parallel curves"}
  - {name: palette, signature: "palette(colors...) -> {rcol(), get(i)}", note: "small random-access color list used for background and strokes"}
---

## What it draws
A flat magenta background (one of the five palette colors) covered with 10–40 scattered "fans" of
parallel bezier curves. Each fan is a dense ribbon of 80–180 nearly identical curves, colored in teal,
dark navy, orange-red, or pale aqua; several fans are so dense the ribbon reads as a solid filled shape
with a visible woven texture where strokes cross. A few small filled dots (dark navy) sit on top.
Fills, orientations and densities vary, so the composition looks like layered abstract cut-outs.

## How the code works
`setup()` (lines 3–11) sets 600x800, `noFill()`, builds a 5-color `Paleta` (line 7) and calls
`generar()` once; `draw()` (line 12) is empty, so the sketch is static. `generar()` (lines 23–67):
- background = one random palette color (line 24).
- outer loop runs `cc = random(10,40)` times (line 25).
- with ~10% probability (line 27) it draws a filled circle of radius 40–200 in a random palette color (lines 28–33).
- it picks a random center (x,y) (lines 38–39) and a random radius `dist` 40–200 (line 40), then four
  random angles to get four control points x1..x4 all on a circle of radius `dist` around the center
  (lines 41–52) — this defines one wobbly closed-loop bezier.
- a second `dist` (line 54) = 2–12 px is the offset between successive curve copies; `cant` = 80–180
  (line 55) is how many copies to draw.
- inner loop (lines 58–65): for i in 0..cant, draw `bezier(x1..x4)` shifted by `i*dist` along a fixed
  random angle — a fan/ribbon of parallel curves. Stroke color is either one random palette color for
  the whole fan (tipo==0) or cycles through the palette per curve (tipo==1, line 60), at fixed alpha
  255 (line 37). Randomness: all positions/angles/sizes/scales and the palette choices; no noise field.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = int(random(10, 40));` -> `int cc = 40;` | large | ~40 fans instead of 10-40: canvas much busier, ribbons overlap heavily, magenta background only in the gaps | variants/cc_40/frame_00001.png |
| cant_180 | `int cant = int(random(80, 180));` -> `int cant = 180;` | large | all fans get the max curve count: ribbons wider and denser, several read as solid filled shapes (e.g. the big teal mass) | variants/cant_180/frame_00001.png |
| step_16 | `dist = random(2, 6)*random(2);` -> `dist = random(4, 8)*random(2);` | moderate | double the spacing between curves: fans visibly sparser, read as striped/hatched ribbons instead of solid fills | variants/step_16/frame_00001.png |
| size_400 | `float dist = random(40, 200);` -> `float dist = random(100, 400);` | moderate | control radius up to 400px: fans much bigger, a few huge sweeping ribbons cover most of the canvas | variants/size_400/frame_00001.png |
| palette_alt | `paleta = new Paleta(#D4FAF3, #33A691, #2D3A52, #B31750, #FF3F21);` -> `paleta = new Paleta(#765664, #EC7D88, #F4EC84, #62B681, #ECB973);` | large | whole image recolored: dark plum background, salmon/peach/green/pale-yellow ribbons; same structure as baseline | variants/palette_alt/frame_00001.png |
| alp_100 | `float alp = 255;//random(100, 240);` -> `float alp = 100;` | moderate | strokes at alpha 100: overlapping dense fans accumulate into washed-out near-solid orange/teal areas, lower overall contrast | variants/alp_100/frame_00001.png |

## Modularisation notes
`bezierFan()` is the generic core: given a 4-point bezier, an offset angle, a step, and a count, it
emits a ribbon of parallel curves — directly reusable. The `Paleta` class is a trivial color list with
random access; worth keeping as-is. One-off art decisions: the "points on a circle around a center"
way of generating the four control points (could be replaced by any curve), the 10% filled-circle
garnish, and the fixed alpha 255. A clean parameter object: `{count, curvesPerFan, fanRadius,
fanStep, alpha, palette, dotsProbability}`.
