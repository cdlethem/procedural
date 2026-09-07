---
sketch: 2020/generative/05_08/saturnos
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [grid, curves, blend-modes]
primitives: [shape]
palette:
  colors: ["#EDBC1C", "#941313", "#2B1F19", "#1B44C1"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: clusterCount, default: 20, tried: [8], change: large, effect: "fewer clusters: dense lower-left mass plus one mid cluster; upper diagonal row disappears"}
  - {name: blobsPerCluster, default: "random(7,16)", tried: ["random(2,6)"], change: large, effect: "looser clusters, individual spiky blobs visible, less dense overlap"}
  - {name: alpha, default: 180, tried: [60], change: none, effect: "no visible change: fill(rcol(),180) is overwritten by the per-vertex fill before drawing, blobs are opaque"}
  - {name: amp, default: 0.0125, tried: [0.04], change: large, effect: "later clusters spread much wider: looser, spikier composition, less overlap"}
  - {name: background, default: 210, tried: [30], change: large, effect: "same blobs on near-black; gold/red/blue read much brighter, muddy midtones read grey"}
reusable_candidates:
  - {name: blobCluster, signature: "blobCluster(cx, cy, count, spread, snapGrids, palette) -> void", note: "cluster of N closed 5-vertex curve blobs, vertices randomly offset from center then snapped to a grid"}
  - {name: lerpPalette, signature: "lerpPalette(palette, v) -> color", note: "continuous float index into a palette, lerping between adjacent entries with pow(t, 0.8)"}
---

## What it draws
A light gray background with a dense diagonal band of smooth curved blobs running from the
lower-left corner up through the middle, plus two small detached clusters in the upper area.
Blobs are gold, dark red, blue, and orange-brown, and each blob is itself a soft gradient
between two or three of those colours, so dense regions read as muddy blended tints (blue
toward gold goes grey-gold, red toward gold goes orange-brown). Blob edges are flat and
faceted-looking, with occasional long thin spikes.

## How the code works
`settings()` (lines 16-21) opens a 960x960 P3D window, `smooth(8)`, `pixelDensity(2)`.
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (re-randomised
only on key press, lines 38-44). `generate()` (lines 47-81):

- `randomSeed(seed)` / `noiseSeed(seed)` (53-54); `background(210)` light gray (56);
  `noStroke()`; `hint(DISABLE_DEPTH_TEST)` (49) so draw order is the only ordering.
- Outer loop `k = 0..19` (60): one cluster per iteration. Cluster centre x is biased to the
  horizontal middle: `width*random(-0.3, 0.3)` (61); y grows with k:
  `height*((20-k)*0.1-0.6)*0.7` (62) — this is what makes the diagonal arrangement,
  high clusters small and low clusters large.
- `amp = k*0.0125` (63): the vertex spread of lower (later) clusters grows with k.
- Each cluster draws `cc = random(7,16)` blobs (65). Each blob is a closed 5-vertex curve
  (69-77): vertex = centre + `random(0.2+amp, 0.8-amp)*width` offset (70-71), then snapped
  down to a random grid of 20 / 30 / 60 px (72-74). Grid-snapping produces the flat,
  angular, spiky silhouettes.
- Colour: one `getColor` per vertex (75), with argument `ic + dc*i + random jitter`
  (dc=0.2, line 59). `getColor(float)` (109-114) takes `v mod palette length`, lerps
  between the two adjacent palette entries with `pow(v%1, 0.8)` — so each blob is a smooth
  gradient across 2-3 neighbouring palette colours, drifting through the palette along the
  vertex index.
- `fill(rcol(), 180)` (67) sets a base alpha of 180, but it is immediately overwritten by
  the per-vertex `fill(getColor(...))` (75) before each shape is drawn, so blobs are
  actually opaque (confirmed by the alpha_60 experiment: zero pixel difference). The soft
  "blended" look comes from the per-vertex `lerpColor` gradient inside each blob, not from
  alpha compositing; the palette is gold #EDBC1C, dark red #941313, near-black brown
  #2B1F19, blue #1B44C1 (line 96).
- `toxi` / `triangulate` are imported but never used in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| clusters_8 | `for (int k = 0; k < 20; k++) {` -> `for (int k = 0; k < 8; k++) {` | large | only 8 clusters: one dense mass bottom-left and one smaller cluster mid-upper; the full diagonal row is gone | variants/clusters_8/frame_00001.png |
| cc_2_6 | `    int cc = int(random(7, 16));` -> `    int cc = int(random(2, 6));` | large | looser clusters, individual spiky blobs now distinct, much less overlap | variants/cc_2_6/frame_00001.png |
| alpha_60 | `      fill(rcol(), 180);` -> `      fill(rcol(), 60);` | none | no visible change (identical image); the per-vertex fill overwrites this alpha | variants/alpha_60/frame_00001.png |
| amp_0.04 | `    float amp = k*0.0125;` -> `    float amp = k*0.04;` | large | lower clusters spread far wider: composition becomes a loose spiky field, top half nearly empty | variants/amp_0.04/frame_00001.png |
| bg_30 | `  background(210);` -> `  background(30);` | large | identical blobs on near-black; saturated gold/red/blue pop, muted lerp midtones read grey | variants/bg_30/frame_00001.png |

## Modularisation notes
- Generic: the `blobCluster` loop (lines 60-80) is a self-contained "grid-snapped curve-blob
  cluster" generator — parameterise by centre, blob count, spread, snap grids, palette,
  colour drift. `getColor(float)` / `lerpPalette` is a clean reusable palette function.
- One-off art decisions: the diagonal y-placement formula (line 62), the per-cluster
  growth of `amp` (63), the 3-way random grid choice (72), dc=0.2 colour drift (59).
  The `fill(rcol(), 180)` line (67) is dead code (overwritten before use) — a clean
  parameter object should drop it or make the per-vertex fill honour it.
- A clean parameter object would be: {clusterCount, blobsPerCluster:[min,max], spreadGrowth,
  snapGrids:[20,30,60], palette, colorDrift, background}.
