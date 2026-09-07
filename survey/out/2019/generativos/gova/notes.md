---
sketch: 2019/generativos/gova
year: 2019
renderer: P2D
size: [960, 320]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1582
animated: false
techniques: [noise-field, particles, grid, dots-stippling, lines-hatching]
primitives: [ellipse, line, rect]
palette:
  colors: ["#D9D0D1", "#C2BAD0", "#AAA1CA", "#8B8FC6", "#7687BD", "#D2CBB3", "#E0D1A5", "#FFFFFF", "#99431F", "#5A1D0D", "#110704", "#A14E24"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: dotCount, default: 3800, tried: [800], change: moderate, effect: "thinner horizon band: fewer coloured specks, sparser dark brown base; sky/ground/trees unchanged"}
  - {name: grassCount, default: 38000, tried: [9000], change: moderate, effect: "ground lighter and sparser: rust base more visible, vertical strokes thinner"}
  - {name: treeCount, default: 70, tried: [15], change: subtle, effect: "about 15 trees instead of ~70; rest of scene identical"}
  - {name: skyAlpha, default: 20, tried: [80], change: subtle, effect: "sky darker and more saturated, individual rectangles distinct, haze reduced"}
  - {name: skyCount, default: 9000, tried: [2000], change: moderate, effect: "sky lighter with large whitish gaps where rectangles are missing"}
  - {name: accentPalette, default: "6-colour warm list (gova.pde:147)", tried: ["blue/green list (gova.pde:153)"], change: none, effect: "no visible change - palette only tints the ~2px coloured dots at the horizon"}
  - {name: noisePatchSky, signature: "noisePatchSky(count, detail, palette, alpha) -> void", note: "overlapping rotated rects coloured by 2-D noise over the canvas (sky.pde)"}
  - {name: segmentedTree, signature: "segmentedTree(x, y, h, segments) -> void", note: "vertical lerp with sqrt easing, random jitter, dot + dash foliage (arboles.pde:arbol)"}
  - {name: stippledGround, signature: "stippledGround(count, yBand, heightMap, paletteLerp) -> void", note: "thousands of small rotated ellipses whose height follows a horizontal map (pasto.pde, gova.pde:generate)"}
---

## What it draws
A flat landscape painting in three horizontal bands. The top two-thirds is a hazy
periwinkle sky made of thousands of faint, overlapping, slightly rotated lavender and
blue-grey rectangles, with a few small black specks. A thin band at the horizon is a
dense strip of tiny multicoloured dots (red, pink, yellow, blue, purple) over dark
brown. The bottom third is rust-brown ground stippled with vertical strokes, and
scattered across the whole middle are ~70 black stick-figures of trees: thin vertical
lines with small white dots (black-outlined) and short horizontal dashes for foliage,
taller toward the left and right edges and shorter in the centre.
## How the code works
`settings()` sizes the window from `nwidth/swidth` (960×320, gova.pde:14-19); `setup()`
calls `generate()` once and `draw()` is empty, so the image is static. `generate()`
(gova.pde:82-116) seeds with `randomSeed`/`noiseSeed` (from the harness seed field) and
lays the scene back to front:

1. **Sky** (`sky.pde:sky`): 9000 rectangles, each randomly placed, sized
   `width*0.04-0.12` × `height*0.016-0.032`, rotated by a random angle, filled with
   `getColor(sky, noise(...)*4 + jitter)` — a noise-driven pick/lerp over the 8-colour
   lavender palette (sky.pde:2), at `stroke(0, 20)` alpha. 2-12 extra black 3-px
   specks. The noise field (`det = random(0.004, 0.008)`) keeps neighbouring patches in
   similar hues, so the sky reads as soft cloud masses rather than noise.
2. **Ground band**: one solid `#99431F` rect from `height*0.89` down (gova.pde:90-91).
3. **Coloured dots** (gova.pde:94-111): 3800 ellipses pinned at `y = height*0.78`,
   brown (lerp of `#3F2016`/`#5A1D0D` into `#110704`, alpha 200) with a small
   `rcol()`-coloured ellipse (from the 6-colour `colors[]` list) on top; their height
   is modulated by `pow(map(x, 0, width, 0.22, 0.06), 1.2)` so the band is taller at
   the left edge and shorter mid-canvas.
4. **Grass** (`pasto.pde:pasto`): 38000 tiny ellipses in a brown lerp
   (`#A14E24`→`#954221`→`#562811`, alpha 200), scattered over the bottom band with the
   same height map, giving the rust ground its vertical-stroke texture.
5. **Trees** (`arboles.pde:arboles`): 70 trees. Each calls `arbol(x, y, x, y-h, 8)`,
   which walks 8 segments from base to top with square-root easing (`mix = pow(mix, 0.5)`),
   `±4px` random jitter per node, a black `line` per segment, a 4-px white `ellipse`
   (stroke still black) at each node, and a 20-px-wide horizontal black `rect` that
   shrinks toward the top — producing the dotted stick trees. Height uses the same
   `map(x, 0, width, 1, 0.3)` profile, so trees are taller near the edges.

`desform()` (gova.pde:76-80, toxi `SimplexNoise`) and the `vline`/`vquad` helpers
distort geometry with noise but are unused in `generate()` — dead code for this render.
Randomness enters only via `random()` after the seed, so the image is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| dotCount_800 | `int cc = 3800;` (gova.pde:94) -> `int cc = 800;` | moderate | horizon dot band much thinner: coloured specks sparse, dark brown base patchy; trees, ground and sky unchanged | variants/dotCount_800/frame_00001.png |
| grassCount_9000 | `int cc = 38000;` (pasto.pde:2) -> `int cc = 9000;` | moderate | ground noticeably lighter, vertical-stroke texture sparser, rust base rect shows through | variants/grassCount_9000/frame_00001.png |
| treeCount_15 | `int cc = 70;` (arboles.pde:5) -> `int cc = 15;` | subtle | ~15 trees instead of ~70, same style; everything else identical | variants/treeCount_15/frame_00001.png |
| skyAlpha_80 | `stroke(0, 20);` (sky.pde:9) -> `stroke(0, 80);` | subtle | sky darker/more saturated, individual rotated rectangles clearly visible, hazy wash reduced | variants/skyAlpha_80/frame_00001.png |
| skyCount_2000 | `for (int i = 0; i < 9000; i++)` (sky.pde:10) -> `i < 2000` | moderate | sky much lighter: large whitish patches where no rectangle was drawn | variants/skyCount_2000/frame_00001.png |
| palette_blue | `int colors[] = {#E49D20, ...};` (gova.pde:147) -> blue/green list from line 153 | none | no visible change: accent palette only tints tiny (~2px) dots at the horizon band | variants/palette_blue/frame_00001.png |

## Modularisation notes
- **Generic candidates**: the noise-patch sky (count, detail, palette, alpha, rotation
  spread), the stippled ground layer (count, y-band, height map, lerp palette), and the
  segmented dotted tree (base, top, segments, jitter, dash length) are all self-contained
  and reusable with the signatures above.
- **One-off art decisions**: the specific two palettes (lavender sky, brown ground,
  6-colour accent list), the `pow(map(x,0,width,…),1.2)` edge-taller height profile,
  the `pow(mix,0.5)` easing, and the fixed scene composition order (sky → band → dots →
  grass → trees).
- **Parameter object** would contain: skyCount, skyDetail, skyAlpha, dotCount,
  grassCount, treeCount, jitter, segments, dashLen, plus the three palettes and the
  height-map endpoints.
