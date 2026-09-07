---
sketch: 2017/Generativos/Eyes/eyes003
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1687
animated: false
techniques: [noise-field, image-source]
primitives: [image]
palette:
  colors: ["#000000", "#f2f2e8", "#ffe41c", "#ef3434", "#ed0076", "#3f9afc"]
  selection: image-sampled
composition: full-bleed
parameters:
  - {name: cc, default: 18, tried: [6], change: large, effect: "far fewer eye motifs; grey cracked slits and red round eyes dominate"}
  - {name: iters, default: 10000, tried: [2500], change: large, effect: "same regions but sparse; black background shows through"}
  - {name: det, default: "random(0.002)*random(1)", tried: ["random(0.01)*random(1)"], change: large, effect: "region layout reshuffled, regions somewhat smaller, busier texture"}
  - {name: scaBase, default: "random(0.3)", tried: ["random(0.8)"], change: large, effect: "eyes much bigger on average, denser large-scale texture"}
  - {name: scaRange, default: "random(0.5, 2)", tried: ["random(0.5, 4)"], change: large, effect: "occasional giant eyes; rest similar to baseline"}
reusable_candidates:
  - {name: noiseImageScatter, signature: "noiseImageScatter(images[], detail, offset, count, scaleFn) -> void", note: "scatter images whose type is chosen by a 2-D Perlin noise field, with size modulated by the fractional part of the field"}
---

## What it draws
A dense, full-bleed collage of painted eyeball and slit-pupil motifs on a black background.
Hundreds of overlapping eye images in green, orange, cream and teal cluster into soft
colour regions: green slitted eyes dominate the left half, orange/red round eyes gather
upper-right, cream cracked eyes fill the lower centre, and teal blobby eyes cluster lower
middle and bottom-right. The whole field reads as a seamless, slightly organic texture.

## How the code works
- `setup()` (lines 6–18) creates a 960x960 P2D canvas and loads `cc = 18` pre-rendered eye
  PNGs (`eye1.png` … `eye18.png`) into `eyes[]`, then calls `generate()`. `draw()` is empty,
  so the piece is static; regeneration happens on keypress.
- `generate()` (lines 28–65): fills the background black (line 29), re-rolls `seed` and
  `randomSeed` it (lines 31–32), shuffles the image array (line 34), then draws 10,000 times
  (line 42).
- Each iteration: random position `x, y` (lines 43–44); a 3-D Perlin sample
  `n = noise(x*det+des, y*det+des, des)` (line 45) with `det = random(0.002)*random(1)`
  (line 36) chooses which eye to draw: `val = (n*(cc+0.99)*2)%cc`, `img = int(val)`
  (lines 47–50). The noise field therefore partitions the canvas into soft regions, each
  region dominated by one eye image — that is what produces the colour blobs.
- Size: `mod = val%1` feeds `amp = 0.5+cos(abs(mod*2-1)*HALF_PI)*0.5` (line 52), a smooth
  bump that is 1 at region boundaries and 0.5 at region centres; then
  `sca = random(0.3)*random(0.5, 2)*amp` (line 55) gives per-stamp scale 0–1.5x of the
  source image, so edges between noise regions get larger overlapping eyes.
- Each stamp is randomly rotated (`ang = random(TWO_PI)`, line 58) via
  `pushMatrix/translate/rotate` (lines 60–64). `swd = random(5)` (line 59) is dead code.
- The `colors[]` array (line 200) and the `Form`/`sub()` classes (lines 93–180) are unused
  leftovers from another sketch; all visible colour comes from the PNGs themselves.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6 | `int cc = 18;` -> `int cc = 6;` | large (mean 0.2247, 0.77) | diversity collapses: only two dominant motifs remain - grey/cream cracked slit eyes filling most of the canvas in large flat regions, red/dark round eyes clustered upper-right and lower-left | variants/cc_6/frame_00001.png |
| iters_2500 | `for (int i = 0; i < 10000; i++) {` -> `... i < 2500; ...` | large (mean 0.2223, 0.745) | same colour-region layout as baseline but sparse: black background visible between stamps, individual eyes more distinct, far less seamless | variants/iters_2500/frame_00001.png |
| det_001 | `float det = random(0.002)*random(1);` -> `random(0.01)*random(1);` | large (mean 0.262, 0.848) | colour-region layout completely reshuffled; regions somewhat smaller with more transitions, busier overall texture | variants/det_001/frame_00001.png |
| scaBase_08 | `float sca = random(0.3)*random(0.5, 2)*amp;` -> `random(0.8)*...` | large (mean 0.2406, 0.784) | eyes much larger on average: big orange, green-slit and red stamps dominate, dense large-scale texture, few tiny eyes | variants/scaBase_08/frame_00001.png |
| scaRange_4 | `float sca = random(0.3)*random(0.5, 2)*amp;` -> `random(0.3)*random(0.5, 4)*amp;` | large (mean 0.2242, 0.748) | tail of giant stamps: oversized green slit (upper left), orange (upper right) and red eyes, rest close to baseline density | variants/scaRange_4/frame_00001.png |

## Modularisation notes
- Generic: the `noiseImageScatter` pattern (noise-field image selection + boundary-bump
  sizing + random rotation) is the reusable core; the `Form`/`linesIntersection`/`rcol`/
  `getColor`/`shuffleArray(int[])` code is dead weight to drop.
- One-off art decisions: the specific 18 eye PNGs, the black background, the 10,000 count.
- A clean parameter object: `{images, count, noiseDetail, noiseOffset, scaleBase, scaleRange,
  boundaryBump, rotation: bool}`.
