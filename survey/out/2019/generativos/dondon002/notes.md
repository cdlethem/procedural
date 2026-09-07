---
sketch: 2019/generativos/dondon002
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2473
animated: false
techniques: [grid, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: lerp-between
composition: full-bleed
parameters:
reusable_candidates:
  - {name: paletteLadder, signature: "paletteLadder(float[] colors, float v) -> int", note: "wrap-around lerp between adjacent palette entries at v (lines 132-138)"}
  - {name: stochNoiseAccum, signature: "stochNoiseAccum(int cc, int samples, float det) -> float[][]", note: "random cell hits accumulating pow(noise(x*det,y*det),1.3) (lines 89-93)"}
  - {name: boxGrid, signature: "boxGrid(cc, size, height, colorFn, jitter) -> void", note: "cc x cc grid of jittered 3D boxes with per-cell colour/height"}
---

parameters:
  - {name: cc, default: 600, tried: [200], change: large, effect: "lower = coarser tiles, smoother wavy bands, grid texture much chunkier"}
  - {name: detCol, default: "random(0.02,0.03)*0.06", tried: ["random(0.02,0.03)*0.3"], change: large, effect: "coarser colour field: canvas flattens to a single yellow hue, dark grid lines dominate"}
  - {name: strokeWeight, default: 0.5, tried: [2], change: moderate, effect: "heavy dark checkerboard mesh, image looks overall darker"}
  - {name: samples, default: 3400000, tried: [34000], change: large, effect: "fewer height-field samples: far fewer cells reach box height, wide black background bands"}
  - {name: size, default: "width*1.4", tried: ["width*0.7"], change: large, effect: "grid smaller than canvas: centred rotated square with black margin corners"}
  - {name: detSize, default: "random(0.02,0.03)*0.4", tried: ["random(0.02,0.03)*0.01"], change: subtle, effect: "no visible change (box-size jitter is below tile scale)"}
A full-bleed marbled field of wavy colour bands — magenta, deep blue, yellow, purple,
off-white and near-black — like an aerial view of a densely packed grid of tiny tiles.
A fine checkerboard weave texture (thin dark outlines between tiles) overlays the whole
image. Dark bands cut through where the background shows between tiles.

## How the code works
- `settings()` (12-17): P3D 960x960, `smooth(8)`.
- `generate()` (50-114): seeds, `background(3)` (near-black, line 55).
- Camera (57-69): translate to centre, z=200; `rotateX(HALF_PI*0.2)` + `rotateZ(HALF_PI*0.5)` —
  near-top-down with a slight tilt, which is what exposes the per-box checkerboard edges.
- Lighting (64-65): weak purple ambient `(40,30,40)` plus a white directional light aimed
  straight down (`lrz=-1`); light direction x/y are small random offsets.
- Grid (74-76): `cc = 600`, `size = width*1.4` (grid overflows the canvas edges), `ss = size/cc`.
- Height field (89-93): 3,400,000 random cell hits, each adding
  `pow(noise(x*det, y*det), 1.3)*0.8`. Cells in the high part of the noise field accumulate
  past 1; `det = random(0.004)` sets the band scale.
- Main loop (99-113): per cell, `amp = 8 + 2*max(0, pow(noise(...),10.4)-0.4)` (mostly 8,
  spikes to 10); `col` is a triple-noise product * amp; fill = `getColor(pow(col,1.2)*2)`
  (132-138), which lerps between adjacent entries of the 12-colour list — the value can
  exceed the list length, so the palette cycles several times, producing the repeating
  magenta/blue/yellow banding.
- Boxes (106-110): a cell draws `min(values[i][j], 1)` boxes, i.e. at most one, sized
  `ss*1.01*random(0.92,1)*noi` where `noi` is a 0.6-1.0 noise-driven factor (detail
  `detSize`). Cells that never accumulated past 1 stay empty, showing the black
  background — the dark bands in the image.
- `stroke(0,40)`, `strokeWeight(0.5)` (71-72): the thin dark tile outlines = the
  checkerboard weave texture.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

| cc_200 | `int cc = 600;` -> `int cc = 200;` | large (0.3674, 0.912) | coarser tiles: wavy bands smoother and chunkier, grid weave visibly coarser | variants/cc_200/frame_00001.png |
| detCol_0.3 | `float detCol = random(0.02, 0.03)*0.06;` -> `... *0.3;` | large (0.2169, 0.811) | colour field nearly flat: one dominant yellow hue across the canvas, only faint red/blue patches at the edges; dark grid lines stand out | variants/detCol_0.3/frame_00001.png |
| strokeWeight_2 | `strokeWeight(0.5);` -> `strokeWeight(2);` | moderate (0.1394, 0.537) | same marbling but the checkerboard weave becomes a heavy dark mesh; overall darker and moodier | variants/strokeWeight_2/frame_00001.png |
| samples_34000 | `for (int i = 0; i < 3400000; i++) {` -> `i < 34000` | large (0.2605, 0.824) | far fewer cells accumulate past box height: wide black background veins cut through the marbling | variants/samples_34000/frame_00001.png |
| size_0.7 | `float size = width*1.4;` -> `width*0.7;` | large (0.2428, 0.837) | grid no longer overflows: a centred rotated (45 deg) square of marbling with black margin in the corners | variants/size_0.7/frame_00001.png |
| detSize_0.01 | `float detSize = random(0.02, 0.03)*0.4;` -> `... *0.01;` | subtle (0.0281, 0.046) | no visible change | variants/detSize_0.01/frame_00001.png |
- Generic: `paletteLadder` (132-138) is a self-contained wrap-around palette lerp;
  the stochastic noise accumulation (89-93) is a reusable "sparse noise field" primitive;
  the box-grid loop (99-113) is a parameterised `boxGrid(cc, size, height, colorFn, jitter)`.
- One-off art decisions: the specific exponents (1.3, 10.4, 1.2), the 3,400,000 sample
  count, camera tilt (rotateX/rotateZ), light colours, and the 12-colour list itself.
- Clean parameter object: `{cc, size, heightSamples, heightDet, heightPow, heightScale,
  colorDet, colorAmp, colorPow, sizeDet, sizeJitter, boxScale, stroke, palette}`.
