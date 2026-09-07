---
sketch: 2018/Generativos/alfombra
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1725
animated: false
techniques: [noise-field, flow-field, grid, dots-stippling]
primitives: [ellipse, line]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: circleCount, default: 100, tried: [50], change: large, effect: "fewer, larger-feeling donuts; black ground visible in uncovered areas (left band)"}
  - {name: bigSizeRange, default: "width*random(0.1, 0.3)", tried: ["width*random(0.2, 0.5)"], change: moderate, effect: "much larger circles that tile the canvas almost completely"}
  - {name: innerSizeRange, default: "s*random(0.2, 0.6)", tried: ["s*random(0.5, 0.9)"], change: moderate, effect: "thinner rings; donuts read as near-solid discs, more saturated"}
  - {name: hairLayers, default: 16, tried: [8], change: moderate, effect: "fainter, lighter felt texture; colours washed out, lower contrast"}
  - {name: hairAlpha, default: 80, tried: [160], change: moderate, effect: "denser, darker hair layer; more saturated colours, darker ground between circles"}
  - {name: noiseColor, signature: "noiseColor(palette, x, y, scale, offset) -> color", note: "getColor(float): noise-driven lerp between consecutive palette entries (L105-111)"}
  - {name: hairGrid, signature: "hairGrid(cells, cellNoiseDetail, angleNoiseDetail, alpha, palette) -> void", note: "pelos(): full-canvas grid of short noise-angled line segments (L68-90)"}
  - {name: scatterDots, signature: "scatterDots(count, size, color) -> void", note: "uniform stipple dots over the whole canvas (L54-60)"}
---

## What it draws
Full-bleed field of overlapping concentric circles ("donuts") in muted reds,
olives, purples, mustard and cream, over black ground showing through the gaps.
Everywhere, including on top of the circles, a fine speckled/hairy grain gives
the whole image a felt-like, stippled texture.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static (L3-15).
- `generate()` (L25): `background(0)`, `randomSeed(seed)`, and three independent noise
  domains `(di1,dc1), (di2,dc2), (di3,dc3)` with random offsets and scales (L29-35).
- Loop (L39-61): 100 random centers; each draws one big ellipse
  `s = width*random(0.1, 0.3)` (L42) and one concentric inner ellipse
  `s2 = s*random(0.2, 0.6)` (L43) — the "donuts". Fills come from
  `getColor(noise(domain + x*scale, domain + y*scale)*colors.length*4)` (L47, L51),
  i.e. noise-driven colour: `getColor(float)` lerps between two consecutive palette
  colours (L105-111).
- Inner loop (L54-60): for each of the 100 centres, 100 tiny dots
  (`ss = width*0.003` ≈ 3 px) placed at random canvas positions, all sharing the
  colour of that centre's noise sample — a uniform fine stipple across the canvas.
- 16 calls to `pelos()` (L63-65): each draws a full-canvas grid of `cc*cc`
  short line segments (`cc = random(160, 220)`, L70). Per cell: position jittered
  ±0.5 cell; segment length `noise(is+..)*des*1.4` and angle `noise(ia+..)*TWO_PI`
  (a noise flow field, L84-85); colour from a third noise domain at alpha 80 (L86).
  The 16 overlapping layers produce the hairy felt texture.
- Palette (L98): 7 colours (red, indigo, green, amber, cream, near-white, near-black);
  `rcol()` and the argument-less `getColor()` exist but are not used by `generate()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circles_50 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 50; i++) {` (L39) | large | sparse, chunkier donuts; black ground clearly visible, esp. left side | variants/circles_50/frame_00001.png |
| srange_0.2_0.5 | `float s = width*random(0.1, 0.3);` -> `float s = width*random(0.2, 0.5);` (L42) | moderate | a few very large donuts covering almost the whole canvas | variants/srange_0.2_0.5/frame_00001.png |
| s2_0.5_0.9 | `float s2 = s*random(0.2, 0.6);` -> `float s2 = s*random(0.5, 0.9);` (L43) | moderate | inner discs fatter, rings thinner; donuts read as near-solid discs | variants/s2_0.5_0.9/frame_00001.png |
| pelos_8 | `for (int i = 0; i < 16; i++) {` -> `for (int i = 0; i < 8; i++) {` (L63) | moderate | hair texture much fainter; image lighter and more pastel | variants/pelos_8/frame_00001.png |
| alpha_160 | `stroke(getColor(...), 80);` -> `stroke(getColor(...), 160);` (L86) | moderate | hair layer denser and darker; more saturated, ground between circles darker | variants/alpha_160/frame_00001.png |

## Modularisation notes
- Generic: `getColor(float)` noise-palette lerp (L105-111); `pelos()` grid-of-noise-lines
  (L68-90); the stipple-dot loop (L54-60).
- One-off art decisions: the three independent noise domains, the donut
  two-circle construction, the 16-layer hair count, the specific 7-colour palette.
- A clean parameter object: `{bigCount, bigSizeRange, innerSizeRange, dotCount,
  dotSize, hairLayers, hairCells, hairAlpha, noiseScales, palette}`.
