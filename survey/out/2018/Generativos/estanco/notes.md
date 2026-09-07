---
sketch: 2018/Generativos/estanco
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1829
animated: false
techniques: [noise-field, grid, polar, particles]
primitives: [shape, ellipse]
palette:
  colors: ["#070B0A", "#92C8FA", "#0321A1", "#EFFF43", "#F94D21", "#E12E23", "#EE8E08", "#C6C9CC", "#1C4E2F", "#023515", "#294F1A", "#637620"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(60,80)*1.4) ~ 84-112", tried: ["int(random(60,80)*0.7) ~ 42-56"], change: large, effect: "cell size, grid dots, pads and flowers all scale with cc; coarser grid = bigger pads/flowers/dots plus a fully re-shuffled composition (random stream shifts)"}
  - {name: filamentCount, default: 8000, tried: [2500], change: moderate, effect: "sparser, more spaced-out filament strokes; downstream speckle/pad/flower placement re-shuffled"}
  - {name: lar, default: "random(32,42)", tried: ["random(80,120)"], change: moderate, effect: "longer, smoother sweeping currents; other layers unchanged (no random draws in the walk)"}
  - {name: padCount, default: 100, tried: [25], change: moderate, effect: "fewer, sparser lily pads; flowers re-placed"}
  - {name: flowerCount, default: 10, tried: [40], change: moderate, effect: "many more flowers, some large, covering most of the canvas"}
  - {name: dotSkipProb, default: 0.1, tried: [0.3], change: large, effect: "sparser speckle grid and fully re-shuffled downstream composition (skipped cells skip rcol() draws)"}
reusable_candidates:
  - {name: flowFilaments, signature: "flowFilaments(count, length, noiseSeed, noiseScale, angleScale) -> void", note: "8000 short polylines whose tangent follows 2-D simplex noise, per-vertex stroke weight and noise-indexed colour (koi palette)"}
  - {name: rosette, signature: "rosette(x, y, size, angle, rings, colorFn) -> void", note: "concentric cos-modulated polygon rings, each slightly smaller, in noise-picked colours; used for lily pads (nenufar) and flowers"}
  - {name: wobblePoint, signature: "wobblePoint(x, y, defx, defy) -> PVector", note: "cheap sine/cosine positional distortion applied to every vertex"}
---

## What it draws
A night pond: near-black green background covered in fine, wispy filaments that swirl in
noise-driven currents (gold, grey, white, with faint red), sprinkled with tiny bright specks.
Dozens of dark-green round lily pads of varying sizes scatter across the surface, and a small
number of vivid multi-coloured rosettes (orange, red, yellow, blue, white concentric lobes) sit
on top as flowers. The whole composition reads as a top-down view of a still pond at night.

## How the code works
Static sketch: `setup()` calls `generate()` once; `draw()` is empty (lines 10-19). All
randomness is seeded by the harness `seed` field via `randomSeed(seed)` (line 31).

- Background `#070B0A` (line 33), then a faint full-canvas quad of two semi-transparent
  noise-picked colours from the `back` palette (lines 76-94) adds a barely-visible green tint.
- Grid of dots: `cc` is ~84-112 cells (line 44), cell size `ss = width/cc`; for each cell a
  sine `desform` distortion) is filled with a random colour from `colors` at 10% skip
  probability (lines 67-73). These read as the fine speckle layer.
- Water filaments: 8000 polylines (lines 108-127). Each starts at a random point, walks
  `lar` (32-42) steps where the step angle is simplex-noise-driven (`water()`/`noise`, lines
  120-124, 246-250); stroke weight ramps 0.2→0.8 along the line and colour is
  `getColor(noise+... )` from the `koi` palette, so filaments are gold/red/grey wisps.
- Specks: 8000 tiny noise-coloured ellipses from the `fun` palette (lines 132-138).
- Lily pads: 100 rosettes `nenufar()` (lines 145-156, 175-189): ~33 rings of a
  `cos`-modulated polygon, each ring scaled down by 0.03 steps and filled with
  `getColor(pow(j,3))` from the dark-green `nenufar` palette — concentric green blobs.
  Sizes are quantised by noise (line 148), which is why pad sizes cluster.
- Flowers: 10 rosettes `flower()` (lines 158-172, 191-204) with the same ring technique but
  colour `getColor(pow(j*0.7,1.3)+ic)` from the `fun` palette and a random phase offset per
  pad (`ic`), giving the orange/blue/yellow petal look.
- `desform()` (lines 235-239) applies a small sine wobble to every vertex of pads, flowers and
  circles; `water()` (lines 246-250) is the simplex-noise flow used for filament direction.
- No blend modes; the layered transparency (alpha fills on quads, `stroke(0,8)` ring outlines)
  does the compositing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.7 | `int cc = int(random(60, 80)*1.4);` -> `... *0.7);` | large (mean 0.1945, 0.61) | much bigger grid dots, lily pads and flowers; coarser speckle grid; whole composition re-shuffled | variants/cc_0.7/frame_00001.png |
| filaments_2500 | `for (int i = 0; i < 8000; i++) {` (filament loop) -> `2500` | moderate (mean 0.1181, 0.383) | sparser, more widely spaced filament strokes; pads/flowers in new positions | variants/filaments_2500/frame_00001.png |
| lar_100 | `float lar = random(32, 42);` -> `random(80, 120);` | moderate (mean 0.0682, 0.246) | longer, smoother sweeping currents in gold/white/grey; pads and flowers unchanged | variants/lar_100/frame_00001.png |
| pads_25 | `for (int i = 0; i < 100; i++) {` (pad loop) -> `25` | moderate (mean 0.0607, 0.178) | fewer, sparser (mostly small) lily pads; flowers re-placed | variants/pads_25/frame_00001.png |
| flowers_40 | `for (int i = 0; i < 10; i++) {` (flower loop) -> `40` | moderate (mean 0.0821, 0.208) | many more, larger multicoloured flowers covering most of the canvas | variants/flowers_40/frame_00001.png |
| skip_0.3 | `if (random(1) < 0.1) continue;` -> `< 0.3` | large (mean 0.1654, 0.552) | sparser speckle dots; whole downstream composition re-shuffled (new pad/flower layout) | variants/skip_0.3/frame_00001.png |

## Modularisation notes
- Generic/reusable: the filament walk (noise field + per-vertex weight/colour ramp), the
  rosette ring function (size decay + per-ring colour function is the only art-specific hook),
  `desform` sine wobble, and `getColor` noise-indexed palette lerp.
- One-off art decisions: the specific palette sets (`back`, `koi`, `fun`, `nenufar`), the
  quantised lily-pad sizing, the two semi-transparent background quads.
- A clean parameter object would be: {seed, gridCount, cellDots: {skipProb, dotSize},
  filaments: {count, length, angleNoiseScale, weightRamp}, specks: {count},
  pads: {count, sizeQuant}, flowers: {count, phase}, palettes, wobble: {defx, defy, amp},
  flow: {seed, detail, amplitude}}.
