---
sketch: 2017/Generativos/burbujas_ani
year: 2017
renderer: P2D
size: [820, 820]
libraries: []
deterministic: true
ms_first_frame: 1503
animated: true
techniques: [noise-field, grid, distortion]
primitives: [shape, rect, line]
palette:
  colors: ["#230D51", "#95E03A", "#F9CD04", "#F2EDED", "#FF82D7"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: blobCount, default: 100, tried: [400], change: large, effect: "4x more blobs densely fill the whole canvas in all palette colours; the lattice is mostly hidden underneath"}
  - {name: blobSize, default: "width*0.55*random(1)", tried: ["width*1.1*random(1)"], change: large, effect: "far fewer but much larger blobs, each spanning a large fraction of the canvas"}
  - {name: wobble, default: "s*random(1.2)", tried: ["s*random(3.0)"], change: moderate, effect: "blob outlines noticeably more irregular/bumpy (stronger noise displacement); composition otherwise similar"}
  - {name: gridCells, default: "random(5,40)", tried: ["random(5,90)"], change: moderate, effect: "finer, denser diamond lattice (more, smaller cells); blobs about the same"}
  - {name: noiseDetail, default: 0.4, tried: [1.2], change: subtle, effect: "subtle: blob edges marginally rougher; no obvious structural change vs baseline"}
reusable_candidates:
  - {name: des, signature: "des(PVector pos, float det, float scale, float t) -> PVector", note: "displace a point by 2-channel Perlin noise (x and y with an offset seed) — drives both blob outlines and the grid lattice"}
  - {name: rects, signature: "rects(x, y, w, h, int c, float det, float des)", note: "noise-warped c×c grid; each cell drawn as four corner-to-center lines plus a solid center dot and a faint larger square"}
  - {name: getColor, signature: "getColor(float v) -> int", note: "pick a random palette colour and lerp it toward its neighbour in the list"}
---

## What it draws
A full-bleed orchid/purple-magenta field (seed 42) overlaid with a rotated diamond lattice — a grid of
thin lines meeting at dotted nodes that covers the whole canvas. Scattered over the lattice are several
large, soft, noise-morphed "bubble" blobs in the palette (a dark indigo one, a big yellow one, a pale
off-white one, a small green one), plus a few small rotated squares and thin vertical colour-bar streaks.
Between frames 1 and 60 the blob and lattice shapes gently wobble as the noise field advances in time.

## How the code works
- `setup()` (L3): 820×820 P2D, `smooth(8)`, `pixelDensity(2)`, then `generate()`. `draw()` (L10) runs a
  300-frame cycle: `time = (frameCount%300)/300` (L12); every `frames/2` (150) frames it calls `generate()`
  (L14) to roll a fresh random seed, and calls `render()` (L16) every frame — this is what animates the piece.
- `generate()` (L29) just sets `seed = int(random(999999))`. `render()` (L35) re-seeds both `noiseSeed` and
  `randomSeed` (L37-38) so a given seed reproduces the same composition (harness fixes `seed`→42).
- Background: `background(getColor(random(colors.length)))` (L40) — a random palette colour lerped toward its
  neighbour; with seed 42 this lands on a pink→indigo lerp, giving the purple-magenta ground. Then the whole
  canvas is centred and rotated by `random(TWO_PI)` (L41-42), which turns the axis-aligned square grid into the
  tilted diamond lattice seen in the image.
- Main loop (L47-100, 100 iterations): each iteration computes a per-blob noise-time `tt` (L49-52), a random
  position (L54-55), a size `s = width*random(0.55)*random(1)` (L56), a noise detail `det = 0.4/s` (L57) and a
  displacement amount `des = s*random(1.2)` (L58). A `res`-point circle (L60-70) is built with `beginShape()`;
  each vertex on the circle is pushed through `des()` (L67), which offsets it by 2-D Perlin noise — that noise
  wobble is what turns plain circles into the organic blob shapes. Colour via `getColor(random(...))` (L64).
  Most blobs are small or off-centre and get overdrawn by later ones, so only a few large blobs are visible.
- `des()` (L103-107): adds `noise(x*det, y*det, t)*scale` to x and an offset `noise(..., t+100)*scale` to y —
  the shared noise-field displacement used by both the blobs and the grid.
- Grid: at `i == 50` (L72-74) it calls `rects(0,0, width*1.4, height*1.4, c, 0.02, random(40))`. `rects()`
  (L148-186) lays out a `c×c` cell grid (c = `int(random(5, random(5,40)))`, L73), displaces each corner through
  `des()` (L159-162), averages the four corners to a cell centre (L163-167), and draws a corner→centre `line`
  for each corner (L178-181) plus a solid centre `rect` and a faint larger `rect` (L173-176). Together the
  corner lines of adjacent cells form the diamond lattice and the centre rects form the dotted nodes.
- Sprinkles: per blob iteration, up to 2 small rotated squares (L76-89, ~50% chance each) and one thin
  vertical colour-bar via `rectColor` (L92-99), which splits a bar into `cc` random-width colour segments.
- `getColor()` (L193-199) lerps `colors[i]` toward `colors[i+1]` by the fractional part of a random index.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `for (int i = 0; i < 100; i++)` -> `for (int i = 0; i < 400; i++)` | large | canvas densely filled with many overlapping blobs (pink, white, yellow, green, indigo, gray) in all palette colours; lattice mostly hidden | variants/count_400/frame_00001.png |
| blobsize_1.1 | `float s = width*random(0.55)*random(1);` -> `...random(1.1)...` | large | far fewer but much larger blobs (huge yellow, huge indigo, huge green); lattice still visible between them | variants/blobsize_1.1/frame_00001.png |
| wobble_3.0 | `float des = s*random(1.2);` -> `s*random(3.0);` | moderate | blob contours more irregular/bumpy (stronger noise displacement); overall layout similar to baseline | variants/wobble_3.0/frame_00001.png |
| griddens_90 | `int(random(5, random(5, 40)))` -> `int(random(5, random(5, 90)))` | moderate | finer, denser diamond lattice (more, smaller cells); blobs about the same | variants/griddens_90/frame_00001.png |
| noisedet_1.2 | `float det = 0.4/s;` -> `float det = 1.2/s;` | subtle | subtle: blob edges marginally rougher; otherwise near-identical to baseline | variants/noisedet_1.2/frame_00001.png |

## Modularisation notes
- Generic / library-worthy: `des()` (noise displacement of a point by 2-D Perlin noise, two channels with an
  offset seed) and `rects()` (noise-warped grid of cells drawn as corner-to-centre lines + centre dots) are both
  parameterised and reusable. `getColor()` is a small reusable palette-lerp helper.
- One-off art decisions: the exact palette (L189), the 300-frame / regenerate-every-150 animation cadence, the
  single whole-canvas random rotation, the "only a few of 100 blobs survive" overdraw effect, and the sprinkle
  loops (rotated squares + colour-bar streaks) tied to the blob loop.
- Clean parameter object would hold: blob count, blob size range, noise detail `det`, displacement `des`,
  grid cell count `c`, grid detail/displacement, palette, background colour, canvas rotation, animation
  (frames + regenerate period), and the sprinkle probabilities.
