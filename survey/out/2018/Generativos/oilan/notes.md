---
sketch: 2018/Generativos/oilan
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2304
animated: false
techniques: [noise-field, distortion, grid, lines-hatching, dots-stippling, packing]
primitives: [line, shape]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: dispAmplitude, default: 140, tried: [40], change: pending, effect: "max px of noise displacement in desform()"}
  - {name: lineCountFactor, default: 0.8, tried: [1.6], change: pending, effect: "multiplier on random(300,360) grid-line count"}
  - {name: diagCount, default: 40, tried: [120], change: pending, effect: "number of wavy random chords"}
  - {name: gridStrokeWeight, default: 0.2, tried: [0.8], change: pending, effect: "weight of the distorted H/V line grid"}
  - {name: margin, default: 80, tried: [20], change: pending, effect: "bb, inset of the line grid and dot region"}
  - {name: palette, default: "purples/pink", tried: [warm], change: pending, effect: "whole colors[] array incl. background pick"}
reusable_candidates:
  - {name: fieldDisplace, signature: "fieldDisplace(x, y, angleOffset, angleFreq, radiusOffset, radiusFreq, amplitude) -> PVector", note: "desform(): angle+radius both from simplex noise"}
  - {name: paletteLerp, signature: "paletteLerp(colors, v) -> color", note: "getColor(v): wrap v in [0,1), lerp between adjacent entries"}
  - {name: fieldLine, signature: "fieldLine(x1, y1, x2, y2, segments, displace) -> polyline", note: "nline(): sample a straight segment, displace each vertex"}
  - {name: fieldCircle, signature: "fieldCircle(x, y, r, displace) -> shape", note: "circle(): triangle-fan polygon, vertices and center displaced"}
---

## What it draws
A pale-lavender square (background is a random palette pick) covered by a fine web of thin, wavy
lines: hundreds of horizontal and vertical lines bent by smooth noise fold into undulating ribbons
that cross and braid, creating dense moiré-like bands in purple and violet with streaks of pink-red
where the lines bunch. A few dozen thicker wavy chords run diagonally across the field. In the
central ~80% a fine stippled texture of tiny dots (up to ~6 px) in related purple/pink/blue tones
gives the surface a soft, cloud-like shading. A faint straight-line grid is barely visible under it.

## How the code works
- `setup()` (l.6-11): `size(960,960,P3D)`, `smooth(8)`, `pixelDensity(2)` (fails headless, warning in
  stderr), then `generate()`. `draw()` is empty; any key regenerates with a new seed (l.16-22).
- `generate()` starts with `randomSeed/noiseSeed(seed)` and `background(rcol())` (l.31): background
  is a random entry of the 6-colour palette (indigo ×2, pink-red, purple, pale purple, pale pink).
- l.33-42: `cg = random(40,120)` straight vertical + horizontal `line()`s, black at alpha 9, weight
  0.5 — a barely visible under-grid, not displaced.
- l.45-50: fresh random offsets/frequencies for the displacement field
  (`desAng`, `detAng`, `desDes`, `detDes`); `noiseDetail(1)`.
- l.52-54: `cc = int(random(300,360)*0.8)` (≈240-288), margin `bb = 80`, spacing `ss`.
- l.56-67: 40 random chords `(x1,y1)-(x2,y2)` drawn by `nline()` (l.149-158), which samples the
  segment at unit spacing and displaces every vertex with `desform()`; weight 0.8-1, colour from
  `getColor(ic+dc*j)` — a slow drift along the palette as j advances.
- l.68-77: `cc+1` horizontal plus `cc+1` vertical lines across the margin box, each a displaced
  polyline via `nline()`, weight 0.2, alpha 140, colours drifting slowly along the palette. This is
  the dominant web of ribbons.
- l.79-96: a 300×300 grid of points over 0.1-0.9 of the canvas; point size
  `s = width*(random(1.8,2)*noise)/300` → 0 to ~6 px.
- l.98-115: 10000 random "large" circles (width×0.05-0.25) are added only if they do not overlap
  any existing point (Poisson-disk-style rejection, l.105-113). The base grid spacing is ~2.6 px
  while the minimum clearance is ≥ (48+0)/2 = 24 px, so every candidate collides: all 10000 are
  rejected. This block is visually inert in practice — the "packing" never happens.
- l.118-126: each of the ~90,000 remaining points is drawn by `circle()` (l.129-147): a
  triangle-fan polygon of `max(8, rπ)` segments whose vertices and centre pass through
  `desform()`, filled (no stroke) with `getColor(noise(des+px*det, des+py*det)*10)` — smooth
  purple/pink/blue patches forming the fine stippled texture.
- `desform()` (l.165-169): `angle = TAU * SimplexNoise(..., freq≈0.0004-0.0012)`,
  `radius = 140 * SimplexNoise(..., freq≈0.0016-0.0048)` — smooth displacement up to ±140 px. This
  folds the parallel lines into ribbons and produces the line-density moiré where the field
  compresses.
- Colour: `getColor(v)` (l.184-190) wraps `v` into [0,1) and lerps between adjacent palette
  entries, so the canvas is mostly purple; pink-red streaks appear where the per-line drift
  (`ic+dc*j`) passes near `#F73859`. Blend mode is default (ADD is commented out, l.26).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `desform()` is the core reusable primitive: a 2-D simplex displacement field (angle + radius from
  two noise samples). With amplitude and frequencies exposed it generalises to any field-warp.
- `getColor(v)` (wrap + adjacent lerp) and `nline()`/`circle()` (field-aware line/polygon) are
  clean candidates as `fieldLine` / `fieldCircle` taking a displacement function.
- One-off art decisions: the specific palette, the triple stack (under-grid + chords + H/V web +
  stipple), `bb=80`, the 300×300 base grid.
- The 10000-circle rejection block (l.98-115) is dead weight as written: the 300×300 base grid
  (spacing ~2.6 px) guarantees every large candidate is rejected, so it costs ~10000 × 90000
  distance tests per render and draws nothing. A clean parameter object would drop it or make the
  base grid coarser than the candidate sizes so packing can actually occur.
- A clean parameter object: {seed, palette, backgroundPick, margin, lineCountFactor, diagCount,
  gridWeight, gridAlpha, dispAmplitude, dispFreq, dotGrid (300), underGridCount (cg)}.
