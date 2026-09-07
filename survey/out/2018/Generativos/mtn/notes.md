---
sketch: 2018/Generativos/mtn
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1873
animated: false
techniques: [noise-field, polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#2F2624", "#207193", "#EF4C31", "#EE4E7C", "#ffffff"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: pwr, default: "random(0.8, random(1, 20))", tried: ["random(0.8, 2)"], change: large, effect: "low exponent range = flatter conical profile; one huge mass fills the frame with broad, coarse, angular terrace bands"}
  - {name: d2, default: "random(20)", tried: [2], change: large, effect: "smaller shape-noise detail = smooth, gently undulating ring edges; reads as one smooth curved wall with a large arch"}
  - {name: sub, default: "random(8, random(8, 700))", tried: [40], change: large, effect: "40 rows = thick bands; mountains read as flat striped planes/ribbons, terrace detail lost"}
  - {name: div, default: "random(4, 80)*4", tried: ["random(4, 12)*4"], change: large, effect: "fewer radial segments = coarser angular facets, zigzag chevron edges"}
  - {name: towers, default: 3, tried: [5], change: moderate, effect: "two extra overlapping masses of the same striped structure; denser overlap, same look"}
  - {name: colors, default: "#2F2624,#207193,#EF4C31,#EE4E7C,#ffffff", tried: ["#0f3460,#1a2a6c,#b21f1f,#fdbb2d,#ffffff"], change: moderate, effect: "same structure recoloured to navy/gold/dark-red/cream; hue only, no geometric change"}
reusable_candidates:
  - {name: noiseTower, signature: "noiseTower(radius, height, rows, segments, detail, power) -> quads", note: "stacked polar rings whose per-vertex radius is noise-modulated"}
  - {name: paletteLerp, signature: "getColor(v, colors[]) -> color", note: "wraps v mod palette length and lerps between adjacent entries"}
---

## What it draws
Three overlapping low-poly "mountain" masses on a near-white background, seen from a steep high angle so their flat tops read as terraces. Each mass is a stack of thin horizontal ring bands with wavy, noise-rippled edges; the bands are banded in stripes of dark brown/near-black, teal blue, red-orange, pink/magenta, and white, with colour varying smoothly along both the height and the circumference. The three masses interlock across the whole frame, some crests running off the edges.

## How the code works
- `setup()` (mtn.pde:3-8): 960x960 P3D, `smooth(8)`, then one call to `generate()`; `draw()` (10-11) is empty, so the sketch is static. A keypress reseeds and regenerates (13-19); `seed` (1) feeds `noiseSeed`/`randomSeed` (24-25).
- `generate()` (21-40): `background(250)` near-white; `translate(width/2, height*0.6, -500)` + `rotateX(random(PI*1.4, PI*1.7))` (27-28) tilt the camera so it looks down at the scene from above and behind, which is what makes the vertical towers read as mountains. Three towers are placed at random `xx, yy` offsets (32-39).
- `tower()` (42-113): per tower, base radius `ss = width*random(0.38,0.42)*random(1,3)*2` (43), height `hh = ss*random(1, random(2,6))` (44), row count `sub` up to ~700 (45), radial segment count `div = random(4,80)*4` (46-47), profile exponent `pwr` (52), noise detail `d1` for colour (56) and `d2` for shape (57).
- Colour: `col = pow(heightFrac, 0.5 + noise(cos(a1)*d1, sin(a2)*d1, j*d1))*4` (76) — noise plus height decide a position along the palette; `getColor` (125-131) wraps `v % colors.length` and `lerpColor`s between adjacent entries, so colour varies smoothly across the five-colour list. Each band is one untextured quad between the two rings (80-86), `noStroke()` (55), antialiased by `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| pwr_2 | `float pwr = random(0.8, random(1, 20));` -> `float pwr = random(0.8, 2);` | large (mean 0.3348, 0.866) | one giant mass fills the whole frame; bands are broad and coarse, terrace steps angular and flat-topped | variants/pwr_2/frame_00001.png |
| d2_2 | `float d2 = random(20)*random(1)*random(1);` -> `float d2 = 2;` | large (mean 0.2517, 0.76) | close-up of one tower wall with a large smooth arch; bands run as smooth horizontal stripes, edges undulate gently instead of rippling | variants/d2_2/frame_00001.png |
| sub_40 | `int sub = int(random(8, random(8, 700)));` -> `int sub = 40;` | large (mean 0.2784, 0.83) | only 40 rows: bands are thick, the masses read as flat folded striped planes (pink/teal/gray/white ribbons) rather than fine terraces | variants/sub_40/frame_00001.png |
| div_48 | `int div = int(random(4, 80))*4;` -> `int div = int(random(4, 12))*4;` | large (mean 0.1773, 0.625) | coarser angular segments: ring edges zigzag into chevrons, especially on the central mass | variants/div_48/frame_00001.png |
| towers_5 | `for (int i = 0; i < 3; i++) {` -> `for (int i = 0; i < 5; i++) {` | moderate (mean 0.0967, 0.267) | two extra striped masses overlap the existing ones; same visual language, denser | variants/towers_5/frame_00001.png |
| palette_cool | `int colors[] = {#2F2624, #207193, #EF4C31, #EE4E7C, #ffffff};` -> `int colors[] = {#0f3460, #1a2a6c, #b21f1f, #fdbb2d, #ffffff};` | moderate (mean 0.105, 0.459) | identical geometry recoloured to navy/dark-blue/dark-red/gold/cream; only hue changes | variants/palette_cool/frame_00001.png |

## Modularisation notes
The generic core is `tower()`: a noise-modulated polar stack (rows x segments of quads) parameterised by radius, height, row count, segment count, profile power, and two noise details (shape vs colour) — a clean `noiseTower(radius, height, rows, segments, detail, power, palette)` function. `getColor` is a reusable wrap-around palette lerp. One-off art decisions: the fixed 5-colour list, the camera pose (`translate` + `rotateX` range), the 3-tower placement and the `*4` colour stretch, and the per-vertex colour exponent formula.
