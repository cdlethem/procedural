---
sketch: 2014/Generativos/mapaRecorrible
year: 2014
renderer: JAVA2D
size: [800, 400]
libraries: []
deterministic: true
ms_first_frame: 254
animated: false
techniques: [noise-field, grid]
primitives: [ellipse, pgraphics]
palette:
  colors: ["#FCFCFC", "#1478FF", "#502804", "#FFFF30"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: ns1, default: 0.003, tried: [0.01], change: large, effect: "higher noise scale breaks the single landmass into many scattered brown islands over small blue rings"}
  - {name: tam, default: 10, tried: [20], change: large, effect: "cell size doubles: rings become visibly bigger with larger pale holes, same landmass layout"}
  - {name: waterLevel, default: 0.3, tried: [0.2], change: none, effect: "no visible change; seed-42 remapped noise never falls in (0.2, 0.3], so the land/water split is unchanged"}
  - {name: background, default: 252, tried: [210], change: moderate, effect: "field turns greyish-white; inner holes stay fill(252) so ring centres read slightly lighter than the background"}
  - {name: landColor, default: "80, 40, 4", tried: ["60, 140, 60"], change: moderate, effect: "land donuts turn medium green, blue water and layout unchanged"}
reusable_candidates:
  - {name: donutNoiseGrid, signature: "donutNoiseGrid(cellSize, noiseScale, waterLevel, landColor, waterColor, bg) -> void", note: "grid of ring/donut cells sized and coloured by remapped 2-D Perlin noise; evokes a walkable terrain map"}
  - {name: thresholdRemap, signature: "thresholdRemap(v) -> float", note: "sin-based remap pushing values away from 0.5 so high/low noise areas get bigger dots"}
---

## What it draws

A full-bleed "map" made of a fine grid of ring-shaped (donut) cells on an off-white
background. A large contiguous landmass of dark-brown donuts with pale centres covers most
of the frame; the remaining areas (top-left, top-right, bottom edge) are fields of small
blue rings. Cell size varies smoothly with the underlying noise, so the map has soft,
organic boundaries between the brown "land" and the blue "water" regions. Static image
(frames 1, 10, 60 identical).

## How the code works

- `setup()` (L10-13): sizes 800x400, then `generar()` builds a per-pixel `PGraphics`
  noise field and draws one frame at coarse `tam = 20` (L50-89). `generar()` is also the
  key handler for any non-`s` key (L40-43) and supports mouse-drag panning via `posX/posY`
  (L45-48, unused headless).
- `generarNoise()` (L91-110): samples 2-D Perlin noise at every pixel with a *random*
  scale `ns1 = random(0.0001, 0.005)` (L94) and random `noiseSeed` (L96), applies a
  sin-based remap that pushes values away from 0.5 (L101-102: low values -> larger,
  high values -> larger, mid values -> ~0), and stores the result as greyscale pixels.
- `draw()` (L15-38) is what the visible image actually comes from: it runs every frame
  (deterministic via `randomSeed(seed)` L16), and redraws a grid with `tam = 10` (L18).
  Per cell it samples the *live* `noise()` at global scale `ns1 = 0.003` (L25, offset by
  `posX/posY`), applies the same sin remap (L26-27), maps the remapped value to a dot
  diameter `dim = map(val, 0, 1, tam, 0)` (L28), fills blue `fill(20,125,255)`-ish
  (20,120,255) when `val > 0.3` else dark brown (80,40,4) (L29-30), draws the outer
  ellipse (L32) and then a `fill(252)` inner ellipse of `dim/3` (L33-34) which punches a
  background-coloured hole, making each cell a ring. The `cartelLugar` label call is
  commented out in `draw()` (L35) — the yellow "hola" labels only exist in the
  `generar()` path (L69).
- Randomness: `randomSeed(seed)` per frame in `draw()` (L16) makes the visible frame
  deterministic; the only stochastic input is the fixed-seed noise field.
- No blend modes, no strokes; all `noStroke()` ellipses. JAVA2D renderer.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ns1_0.01 | `float ns1 = 0.003;` -> `float ns1 = 0.01;` | large | single landmass breaks up into many scattered brown island patches of various sizes over a field of small blue rings; much busier, higher-frequency texture | variants/ns1_0.01/frame_00001.png |
| tam_20 | `float tam = 10;` -> `float tam = 20;` | large | same landmass layout but with a coarser grid: rings are ~2x bigger with large pale holes, cell structure clearly visible | variants/tam_20/frame_00001.png |
| thresh_0.2 | 5-line draw() block, `if(val > 0.3)` -> `if(val > 0.2)` | none | no visible change (image byte-identical); with seed 42 no cell's remapped value falls in (0.2, 0.3], so the land/water split is unchanged | variants/thresh_0.2/frame_00001.png |
| bg_210 | `background(252);` -> `background(210);` | moderate | field turns greyish-white; inner holes still use fill(252) so ring centres read slightly lighter than the background | variants/bg_210/frame_00001.png |
| land_green | `else fill(80, 40, 4);` -> `else fill(60, 140, 60);` | moderate | land donuts turn medium green; water stays blue and the layout is unchanged | variants/land_green/frame_00001.png |

## Modularisation notes

- The core is a self-contained "donut noise grid": a `for j/for i` loop over a cell grid
  where each cell's diameter and colour come from remapped 2-D Perlin noise (L21-36 of
  `draw()`). This is the generic library function (`donutNoiseGrid` above); parameters
  are `cellSize`, `noiseScale`, `offset (x,y)`, `waterLevel` (the 0.3 threshold),
  `landColor`, `waterColor`, `bgColor`, and `holeFraction` (the `dim/3`).
- The sin remap (L26-27) is a small one-off art decision that turns "distance from
  0.5" into dot size, giving the map its ringed look; keep it as an optional transform.
- `generarNoise()` (per-pixel PGraphics field) is only used by the setup/keypress path;
  `draw()` ignores the stored field and re-samples live noise. A clean library version
  would drop the PGraphics detour and just evaluate `noise(x*scale, y*scale)` per cell.
- `cartelLugar` (L112-121) is a generic "label with pointer triangle" widget — reusable
  as-is for any map annotation.
- Mouse-drag panning (`mouseDragged` + `posX/posY` offset into the noise) is a nice
  generic "pan the noise field" interaction to keep separate from the drawing.
