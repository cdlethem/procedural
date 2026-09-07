---
sketch: 2014/Generativos/circulosFormas
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: false
ms_first_frame: 177
animated: true
techniques: [dots-stippling, polar]
primitives: [shape]
palette:
  colors: ["#4F525F", "#FB5772", "#FFBF26", "#B0E420", "#A4E4BF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cantplanos, default: 8, tried: [2], change: none, effect: "no visible change at frame 1: only layer 0 has been drawn by then; later (larger) layers appear only from frame 10"}
  - {name: "sides range (int c = int(random(3, 8)))", default: "3..8", tried: ["5..9"], change: none, effect: "no visible change at canvas level; among the few tiny frame-1 shapes one triangle became a pentagon"}
  - {name: "star inner ratio (float hun = random(0.5, 1))", default: "0.5..1", tried: ["0.2..0.4"], change: none, effect: "no visible change at canvas level; run crashed with NullPointerException in forma() (thread race), only frame 1 saved"}
  - {name: "halo alpha (stroke(0, 4))", default: 4, tried: [100], change: none, effect: "no visible change at canvas level; slightly darker halo around the few tiny frame-1 shapes"}
  - {name: "inner attempt count (map(j,0,8,1000,300))", default: "1000..300", tried: ["4000..300"], change: none, effect: "frame 1 pixel-identical to baseline (md5 equal); density effect only shows from frame 10"}
  - {name: "outer shape size (map(j,0,8,10,160))", default: "10..160", tried: ["10..400"], change: none, effect: "no visible change: layer 0 keeps t=10, the enlarged sizes are in later layers not yet drawn at frame 1"}
reusable_candidates:
  - {name: forma, signature: "forma(x, y, d, c, ang)", note: "closed regular c-gon of radius d/2, rotated by ang"}
  - {name: estrella, signature: "estrella(x, y, d, c, ang, innerRatio)", note: "c-spike star alternating outer radius d/2 and inner radius d/2*innerRatio"}
  - {name: Paleta, signature: "rcol() -> color", note: "named list of colors with uniform random pick; also used for background"}
  - {name: layeredScatter, signature: "layeredScatter(nLayers, sizeRange, countRange, exclusionGrowth)", note: "8 concentric scatter layers: size and central exclusion radius grow per layer, attempt count shrinks"}
---

## What it draws
Frame 1 (seed 42) is almost a flat lime-green field with a handful of shapes: a tiny pink
dot upper-right, a faint dark triangle lower-left, a small circle outline mid-right — the
sketch draws itself in a background thread, so frame 1 is mid-generation. By frame 10 the
canvas is a lime-green field densely scattered with small polygons and stars (triangles,
squares, pentagons, hexagons, 7-8-gons, and spiky stars) in dark navy, pink, orange, and
light teal, each with a soft dark halo. Shapes are smallest and densest near the center and
grow larger and sparser toward the edges and corners (frame 10 and 60 are identical).

## How the code works
- `setup()` (L8-13): 800x600 window, builds a `Paleta` of 5 colors (L10) and starts all
  drawing in a separate thread via `thread("generar")` (L12). `draw()` (L15-16) is empty —
  nothing is drawn per frame; the picture is produced once by `generar()`, which is why
  frame 1 shows a partial image and frames 10/60 show the finished one (identical md5).
- `generar()` (L27-81): background is one random palette color (L29; green #B0E420 for seed 42).
  8 layers, `j = 0..7` (L30-31), all centered on the canvas center (L32-33). Per layer:
  - `tam` = map(j, 0, 8, -10, 800) (L34): a central exclusion radius that grows per layer;
  - `t` = map(j, 0, 8, 10, 160) (L35): shape size, from 10 px inner to 160 px outer;
  - `cant` ≈ 2000 attempts (inner) down to ~300 (outer) (L36).
  Each attempt (L37-56) picks uniform random (x, y) (L38-39) and is skipped if inside the
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cantplanos_2 | `int cantplanos = 8;` -> `int cantplanos = 2;` | none | no visible change: frame 1 is still a nearly empty green field with a pink dot and a faint tiny triangle; the 6 removed layers (the large edge shapes) are not started by frame 1 | variants/cantplanos_2/frame_00001.png |
| sides_5_9 | `int c = int(random(3, 8));` -> `int c = int(random(5, 9));` | none | no visible change at canvas level; of the few tiny frame-1 shapes, the lower-left one is now a pentagon instead of the baseline's triangle | variants/sides_5_9/frame_00001.png |
| hun_0.2 | `float hun = random(0.5, 1);` -> `float hun = random(0.2, 0.4);` | none | no visible change at canvas level; the 3 tiny visible shapes carry noticeably darker halos than baseline, and this run died with a NullPointerException in `forma()` (drawing-thread race) so only frame 1 was saved | variants/hun_0.2/frame_00001.png |
| halo_100 | `stroke(0, 4);` -> `stroke(0, 100);` | none | no visible change at canvas level; faintly darker halo around the few tiny frame-1 shapes | variants/halo_100/frame_00001.png |
| cant_4000 | `int cant = int(map(j,0, cantplanos, 1000, 300)*...);` -> `... 4000, 300 ...` | none | no visible change: frame 1 is pixel-identical to the baseline (equal md5); the extra attempts only add shapes after frame 1 | variants/cant_4000/frame_00001.png |
| t_400 | `float t = map(j, 0, cantplanos, 10, 160);` -> `float t = map(j, 0, cantplanos, 10, 400);` | none | no visible change: layer 0 keeps t=10, so the enlarged sizes (layers 1-7) are not yet drawn at frame 1 | variants/t_400/frame_00001.png |

All six scores are "none" for a structural reason, not because the parameters are inert: the harness
snapshots frame 1 at ~180 ms, at which point the `generar()` thread has drawn only its first handful
of layer-0 shapes (the baseline itself shows a near-empty field at frame 1 and the full picture only
at frame 10). Every parameter probed acts on later layers or on the bulk of the scatter, which does
not exist yet at frame 1; the tiny frame-1 differences (a pentagon instead of a triangle, a slightly
darker halo) are too small to move the whole-canvas mean above 0.01. With `deterministic: false`
these frame-1 diffs would be unreliable evidence anyway. The parameters are visible in the completed
image (frame 10/60), which the survey protocol for variants does not score.
  the center with small shapes, outer layers only paint the ring near the edges. Shape type:
  50/50 star vs regular polygon (L44); side count `c = random(3, 8)` (L41); random rotation
  (L42); star inner-radius ratio `hun = random(0.5, 1)` (L43).
- Rendering each shape (L45-55): first 10 stacked `noFill()` strokes, black at alpha 4 with
  weights 0..9 (L46-51) — the overlapping low-alpha outlines form the soft dark halo; then a
  single filled version in a random palette color with no stroke (L53-55).
- `forma()` (L83-91): closed regular c-gon at radius t/2. `estrella()` (L93-104): c-spike
  star stepping half-sides at a time, alternating outer radius and outer radius * hun.
- A commented-out block (L63-80) would have added diagonal hatching lines and a "MOHAVE"
  text overlay; it is disabled in this version.
- Randomness enters only through `random()` calls inside `generar()` (positions, types,
  colors). Baseline `result.json` has `deterministic: false`, so re-renders at the same seed
  differ; only large changes between variants are reliable evidence.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic and reusable: `Paleta` (color list + uniform random pick, L106-152), `forma`
  (regular polygon path), `estrella` (star path with inner-ratio parameter), and the
  layered-scatter loop (L30-57) — "N concentric scatter layers whose shape size and central
  exclusion radius grow per layer while attempt count shrinks" is a self-contained generator
  with a clean parameter object.
- One-off art decisions: the specific 5-color palette, the 10-pass alpha-4 stroke halo trick
  (L46-51), the 50/50 star probability, the exact `map()` ranges (L34-36).
- Clean parameter object: `{palette, nLayers, sizeMin, sizeMax, countInner, countOuter,
  exclusionGrowth, haloPasses, haloAlpha, starProbability, sideMin, sideMax,
  starInnerMin, starInnerMax}`.
