---
sketch: 2018/Generativos/magik
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1584
animated: false
techniques: [particles, noise-field, shader]
primitives: [line]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: lar, default: 10000, tried: [3000], change: large, effect: "fewer steps: ribbons thin to hatched line-mesh, black background shows through"}
  - {name: vel, default: 0.71, tried: [3.0], change: large, effect: "faster walkers: wider bands, whole canvas covered"}
  - {name: amp, default: "0..10 (random)", tried: [2], change: large, effect: "slower angle rotation: broader, softer color fields with wavy edges"}
  - {name: det, default: "0..0.04 (random)", tried: [0.004], change: large, effect: "coarser noise: longer, smoother sweeping bands"}
  - {name: passes, default: 6, tried: [12], change: large, effect: "more ribbons: denser, overlapping bands, visible fine striping"}
reusable_candidates:
  - {name: noiseWalker, signature: "noiseWalker(x, y, det, offset, amp, vel, steps) -> [x, y]", note: "random walker advanced by noise-steered angle; loops and fills an area so stacked 1px lines form ribbons"}
  - {name: paletteWalk, signature: "paletteWalk(colors, i, step) -> color", note: "getColor(): index walk through palette with lerp between adjacent entries"}
---

## What it draws
Bold posterized colour fields on black: six or so soft-edged ribbons of hot pink/magenta,
bright yellow, cyan-blue and orange-coral sweep diagonally across the canvas, plus one wide
white-silver band and one thin dark line. The bands bleed into each other, edges are grainy,
and the corners are darkened by a vignette. The whole thing reads like an over-saturated
painterly smear rather than visible strokes.

## How the code works
- `setup()` (L5-18): 960x960 P2D, `pixelDensity(2)`, loads `post.glsl`, calls `generate()`
  once. `draw()` is empty (L20-21) — static one-shot; `keyPressed` regenerates.
- `generate()` (L41-114): `randomSeed(seed)`, black background, then 6 passes (L46).
  Each pass draws two coupled walkers: two random start points (L71-74) pulled 20% toward
  each other (L80-83); each walker gets its own noise scale `det` in 0..0.04 px^-1 (L75/77),
  noise offset `des` in 0..1000 (L76/78), and angle amplitude `amp` in 0..10 (L85-86).
- Inner loop (L97-108), `lar = 10000*width/960` steps (L95): each step strokes a 1px
  `line()` between the two walkers (L98-99), then moves each 0.71 px (L93) in an angle
  `noise(des + x*det, des + y*det) * TAU * amp` (L101-107). Because the noise angle can
  rotate the walker, it loops and revisits neighbourhoods, so the 1px lines stack into the
  thick ribbons seen in the image.
- Colour (L88-89, 149-154): random palette start index `ic` plus slow walk `dc*i`
  (`dc` ~0..0.2) through the 12-entry palette (L141); `getColor` lerps between adjacent
  entries, so each ribbon drifts through neighbouring palette colours (the pink→yellow→blue
  gradients within a band).
- Shader (L112-113, `data/post.glsl` L58-74): 9-tap blur mixed at 0.9 (L63) smears the 1px
  strokes into soft bands; 2% white-noise grain (L67); brightness x1.2 and saturation
  boosted up to ~3.7x toward the edges (L65, 68) giving the vivid pinks/yellows; quadratic
  vignette darkens corners (L65, 68). Note: display is `:2` (not xvfb), so the shader render
  is assumed faithful.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lar_3000 | `float lar = 10000*width/960.;` -> `float lar = 3000*width/960.;` | large | ribbons thin out to a hatched mesh of individual 1px lines (visible as fine parallel strokes); much black background shows through; colours same | variants/lar_3000/frame_00001.png |
| vel_3 | `float vel = 0.71;` -> `float vel = 3.0;` | large | bands become much wider and sharper-edged, covering nearly the whole canvas; only a black corner remains | variants/vel_3/frame_00001.png |
| amp_2 | `float amp1 = random(10);` + `float amp2 = random(10);` -> `random(2)` (both) | large | walkers turn slowly, so ribbons widen into a few very broad soft colour fields (pink, yellow, cyan, blue, purple) with wavy organic edges; full-bleed | variants/amp_2/frame_00001.png |
| det_0.004 | `float det1/det2 = random(0.04)*960./width;` -> `random(0.004)*960./width;` (both) | large | coarser noise: longer smoother arcs, broader sweeping bands (white diagonal, pink, yellow, blue) with fewer tight loops | variants/det_0.004/frame_00001.png |
| passes_12 | `for (int j = 0; j < 6; j++) {` -> `for (int j = 0; j < 12; j++) {` | large | roughly double the ribbons; same style but denser, more overlapping bands and fine parallel striping inside bands; full-bleed | variants/passes_12/frame_00001.png |

## Modularisation notes
Generic, library-worthy:
- `noiseWalker` (L97-108): the steer-by-noise-angle random walk is a clean primitive —
  input (start point, det, des, amp, vel, steps), output polyline. Works with any colour
  callback and any primitive.
- `paletteWalk` / `getColor` (L149-154): index-walk with lerp between adjacent palette
  colours; trivial to parameterise (step, palette).
- The `post.glsl` post pass (blur + grain + saturation-boost + vignette) is a self-contained
  reusable shader; the blur-mix, grain amount, saturation curve and vignette exponent are the
  knobs.
One-off art decisions: the two-walker coupling with mutual lerp (L80-83) and the 6-pass
count; the specific 12-colour palette; the 90% blur mix that turns hairlines into ribbons.
A clean parameter object: `{seed, passes, steps, vel, det, amp, dc, palette,
shader:{blur, grain, sat, vignette}}`.
