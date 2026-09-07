---
sketch: 2014/Generativos/circulosdentrocirculos2
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 227
animated: false
techniques: [polar, symmetry]
primitives: [ellipse, line, shape]
palette:
  colors: ["#163440", "#28A199", "#70CCAD", "#CAFAC3", "#FFFACC"]
  selection: random-from-list
composition: radial
parameters:
  - {name: motif_count, default: 100, tried: [30], change: large, effect: "sparser; dense full-bleed mandala collapses to a compact centred medallion, only thin ring/tick webs reach the corners"}
  - {name: max_diameter, default: "dist(0,0,width,height) ~ 848", tried: [300], change: large, effect: "mandala shrinks to the centre (max radius ~150), wide pale-mint margin, no longer full-bleed"}
  - {name: motif_index, default: "random(5)+1", tried: [2], change: large, effect: "only circulo2 drawn: full-bleed bands of thick rings studded with dots, no ticks/polygons/zigzag"}
  - {name: circulo1_tick_count, default: "random(3,72)", tried: ["random(3,20)"], change: none, effect: "no visible change"}
  - {name: ring_weight, default: "(random(10)+1)*10", tried: ["(random(10)+1)*30"], change: large, effect: "much bolder: heavy navy tick fan, wide bands, large cream dots"}
reusable_candidates:
  - {name: ringMotif, signature: "ringMotif(cx, cy, radius, weight, count, angle, mode, c1, c2)", note: "one of five concentric ring decorations: radial ticks, dots on ring, polygons on ring, zigzag band, stacked dots on ring"}
  - {name: randomPaletteColor, signature: "rcol(colors[]) -> color", note: "uniform random pick from a small fixed colour list (Paleta class, in-file)"}
---

## What it draws
A centred mandala on a pale cream background: a small dark dot at the centre, a fan of fine
radial cream/teal ticks, then alternating bands of dark-navy scalloped and zigzag rings, teal
rings studded with cream dots, and mint rings carrying small triangles, all stacked concentrically
until thick navy rings reach the edges. Dominant colours: dark navy, teal, pale mint/cream.

## How the code works
- `setup()` (lines 3-16): 600x600, `smooth(8)`; the `Paleta` on line 7 (dark teal #163440, teal
  #28A199, light teal #70CCAD, pale mint #CAFAC3, cream #FFFACC) overwrites the one on line 6;
  `generar()` is called once, and `draw()` (18-19) is empty, so the piece is static.
- `generar()` (29-91): fills the background with a random palette colour (line 30), then loops
  100 times (line 33). Each pass picks a diameter 2..canvas diagonal (line 37), a rotation angle
  (38), a motif index 1-5 (39) and two random palette colours (40-41), and draws that motif
  centred on the canvas (the random-position lines 34-35 are commented out).
- The five motifs are all polar, centred on (x, y), and take a ring weight `anc = t/2`:
  - `circulo1` (93-114): thick `c2` ring, thin concentric `c1` rings, then `cant` radial tick
    lines (3-72) — the central fan.
  - `circulo2` (115-131): thick `c1` ring with `cant` filled `c2` dots sitting on the ring.
  - `circulo3` (133-150): thick `c2` ring with small rotated `c1` polygons (`figura`, 212-220)
    on the ring — the scalloped triangles.
  - `circulo4` (152-188): double `c1`/`c2` rings with alternating `c1`/`c2` quadrilateral
    segments between two radii — the zigzag band.
  - `circulo5` (190-210): thin `c1` ring with concentric shrinking filled dots in alternating
    `c1`/`c2` at each of `cant` points on the ring.
- No blend modes or shaders; plain painter's overdraw. Later (usually smaller) motifs paint over
  earlier ones, which is why the centre resolves into a fine fan while the outer rings stay bold.
  The commented block (60-90) shows an abandoned variant that shrank a single radius from the
  diagonal down to 0 instead of 100 independent radii.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cant_30 | `for (int i = 0; i < 100; i++)` -> `for (int i = 0; i < 30; i++)` | large (mean 0.425, 0.776 of pixels) | sparse: compact cream medallion in the centre; the dense full-bleed bands are gone, only a few thin rings and radial tick lines reach the corners | variants/cant_30/frame_00001.png |
| dim_300 | `float dim = random(2, dist(0, 0, width, height));` -> `float dim = random(2, 300);` | large (mean 0.264, 0.572 of pixels) | mandala shrinks to ~half canvas size (measured max radius 146 px) on the pale-mint background; ring structure unchanged, just contained | variants/dim_300/frame_00001.png |
| r_2 | `int r = int(random(5))+1;` -> `int r = 2;` | large (mean 0.3502, 0.713 of pixels) | only circulo2 motifs: the whole image is concentric bands of thick rings studded with big dots in alternating palette colours; no ticks, polygons or zigzag bands anywhere | variants/r_2/frame_00001.png |
| ticks_20 | `circulo1(..., int(random(3, 72)), ...)` -> `circulo1(..., int(random(3, 20)), ...)` | none (mean 0.0007, 0.001 of pixels) | no visible change (only 1 in 5 motifs is circulo1 and most tick lines get overdrawn) | variants/ticks_20/frame_00001.png |
| thick_30 | `float t = int(random(10)+1)*10;` -> `float t = int(random(10)+1)*30;` | large (mean 0.1712, 0.45 of pixels) | much bolder: heavy navy tick fan in the centre, wide teal/cream dot bands, thick outer double rings; fewer distinguishable layers | variants/thick_30/frame_00001.png |

## Modularisation notes
- The `Paleta` class (222-245) is fully generic (fixed colour list + random pick) and is a clean
  library candidate; it lives in the sketch file, not an external library.
- The five `circuloN` functions share one pattern (centre, radius, ring weight, count, angle,
  two colours) and could collapse into a single `ringMotif(..., mode)` with modes
  ticks / dots / polygons / zigzag / stacked-dots. `figura` (212) is just a regular polygon.
- Art decisions to keep as parameters: motif count (100), radius range (2..diagonal), centre vs
  random positions (commented out), per-motif count ranges, and the 5-colour palette. A parameter
  object would be {count, radiusMin, radiusMax, motifWeights[5], weightRange, countRanges[5],
  palette, background}.
