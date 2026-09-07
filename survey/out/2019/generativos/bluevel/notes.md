---
sketch: 2019/generativos/bluevel
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1549
animated: false
techniques: [noise-field, lines-hatching, curves]
primitives: [shape]
palette:
  colors: ["#0E0E0A", "#F64422", "#F7F702", "#37C17B", "#498DD2"]
  selection: lerp-between
composition: centered
parameters:
  - {name: det, default: "random(0.0006,0.001)*0.6", tried: [0.002], change: large, effect: "larger detail = faster ribbon oscillation: finer, denser hatching spreading to the canvas edges; spikier mass silhouette"}
  - {name: cc_large, default: 2000, tried: [6000], change: large, effect: "more quads in the wide layer = hatched fringe thickens into full-canvas colored bands"}
  - {name: cc_core, default: 20000, tried: [5000], change: moderate, effect: "core stays opaque black but the colored fringe layer shows around its edges"}
  - {name: alpha, default: 150, tried: [30], change: none, effect: "no visible change: 20000 overlapping quads saturate the core to opaque black even at alpha 30"}
  - {name: dc, default: "random(0.001)", tried: [0.05], change: none, effect: "no visible change at whole-image level; top hatching lines only shift slightly toward blue"}
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(cx, cy, size, quads, detail, colorFn) -> shape", note: "QUAD_STRIP of point pairs from four simplex-noise curves, one lerp-color per quad"}
  - {name: rampColor, signature: "rampColor(palette, v) -> color", note: "wrapping lerp through a colour list with pow-eased fraction"}
---

## What it draws
A white canvas dominated by a large, near-black, lumpy mass that runs from the centre toward the
left edge and tapers to a pointed tail at bottom-right. The upper half is fringed with dense, very
fine hatching: olive/gold at the top-left and along the right edge, brownish at the top-right. The
lower part of the canvas is mostly empty white.

## How the code works
- `settings()` (L14-19): 960x960 P3D, smooth(8). `setup()` calls `generate()` once; `draw()` is
  empty (L31-32), so the piece is static — the baseline's frames 10/60 were dropped as identical.
- `generate()` (L34-46): white background; seeds noise/random with `seed`; picks one
  `det = random(0.0006, 0.001)*0.6` (L41) shared by both layers, then draws two ribbon layers:
  a wide sparse one `cucu(w/2, h/2, w*3, 2000, det)` (L42) and a tight dense one
  `cucu(w/2, h/2, w, 20000, det)` (L43).
- `cucu()` (L48-64): one `QUAD_STRIP` of `cc` quads. For each `i` it samples four
  `SimplexNoise.noise(i*det, {0|100}, seed)` values (L54-57) to get a point pair
  `(x1,y1)-(x2,y2)` around the centre, scaled by `s`; the quad's fill is
  `getColor(ic+dc*i)` at alpha 150 (L59) where `ic` is a random palette start (L49) and
  `dc` a small random per-quad colour drift (L50).
- The 2000-quad layer spans 3x the canvas width, so its quads mostly land in the top corners and
  edges as sparse, thin, semi-transparent ribbons — the visible hatching. The 20000-quad layer
  stays within ~1 canvas width of centre; 20000 overlapping alpha-150 quads accumulate into the
  opaque central mass (over ~10 overlaps per pixel, so even alpha 30 saturates to opaque — see
  experiments).
- Colour: `getColor(v)` (L90-96) wraps `v` over the 5-colour list `#0E0E0A, #F64422, #F7F702,
  #37C17B, #498DD2` (L83) and lerps between adjacent entries with `pow(frac, 0.9)`; the near-black
  entry `#0E0E0A` dominates the core because the dense layer's accumulated alpha saturates to
  its dark tones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.002 | `float det = random(0.0006, 0.001)*0.6;` -> `float det = 0.002;` | large | finer, denser hatching spreading to all canvas edges; spikier mass silhouette; black core unchanged | variants/det_0.002/frame_00001.png |
| cc_large_6000 | `cucu(width*0.5, height*0.5, width*3, 2000, det);` -> `cucu(width*0.5, height*0.5, width*3, 6000, det);` | large | hatched fringe thickens into full-canvas colored bands (light blue left, olive right, teal bottom-left, blue top-right) around the unchanged black core | variants/cc_large_6000/frame_00001.png |
| cc_core_5000 | `cucu(width*0.5, height*0.5, width, 20000, det);` -> `cucu(width*0.5, height*0.5, width, 5000, det);` | moderate | core still opaque black, but the colored fringe layer now visible around its edges (gold/red/green bands); white wedge opens on the left | variants/cc_core_5000/frame_00001.png |
| alpha_30 | `fill(getColor(ic+dc*i), 150);` -> `fill(getColor(ic+dc*i), 30);` | none | no visible change: core saturates to opaque black even at alpha 30 (20000 overlaps) | variants/alpha_30/frame_00001.png |
| dc_0.05 | `float dc = random(0.001);` -> `float dc = random(0.05);` | none | no visible change (top hatching lines only shift slightly olive->blue; pixel diff confirms identical geometry, ~6% of pixels recolored in the top hatched regions) | variants/dc_0.05/frame_00001.png |

## Modularisation notes
- Generic: `cucu()` is a self-contained noise-ribbon primitive (centre, size, quad count, detail,
  colour fn) — a direct `noiseRibbon` library candidate; `getColor(v)` is a generic wrapping
  colour-ramp sampler (`rampColor`).
- One-off art decisions: the two-layer composition (one 3x-wide sparse fringe layer + one dense
  core layer, both centred), the specific 5-colour palette and its commented alternatives
  (L79-82), the fixed alpha 150, and the `det` range.
- A clean parameter object: `{ size, layers: [{span, quads, detail}], palette, alpha, colorDrift,
  seed }`.
