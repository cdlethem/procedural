---
sketch: 2019/generativos/parapara
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1750
animated: false
techniques: [noise-field, voronoi-delaunay, packing]
primitives: [shape, ellipse, line]
palette:
  colors: ["#152425", "#1D3740", "#06263E", "#074B7D", "#094D88", "#1D6C9E", "#ff2000", "#ff2010"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: hor, default: "random(0.15, 0.3)", tried: [0.15], change: large, effect: "horizon at 15% of height: thin sky band, much larger ground area, red horizon line higher"}
  - {name: sub, default: 1000, tried: [100], change: moderate, effect: "100 stripes: distinct horizontal colour bands (red at horizon, mid, bottom) instead of a smooth gradient"}
  - {name: pwr, default: 4.2, tried: [1.0], change: moderate, effect: "uniform stripe spacing: wide red band mid-ground and dark band at bottom instead of horizon-bunched blue->red"}
  - {name: pointCount, default: 50, tried: [150], change: subtle, effect: "clearly denser dot field, but dots are small so few pixels change"}
  - {name: sizeScale, default: 120, tried: [240], change: subtle, effect: "dots ~2x larger with more overlap and bigger foreground circles; background bands unchanged"}
  - {name: lineAlpha, default: 10, tried: [60], change: none, effect: "no visible change; mesh lines remain faint at alpha 60"}
reusable_candidates:
  - {name: gradientStripes, signature: "gradientStripes(count, power, y0, y1, palette, indexStart, drift, alpha)", note: "1000 thin full-width quads whose vertex colours lerp along a palette index; a pow curve bunches stripes toward one end"}
  - {name: packPoints, signature: "packPoints(count, yMin, yMax, sizeFn, overlapFactor) -> PVector[]", note: "random points, size grows with depth, rejection sampling rejects overlaps"}
  - {name: delaunayMesh, signature: "delaunayMesh(points, strokeColor, alpha)", note: "Triangulate.triangulate then draw all triangle edges"}
  - {name: ringGlow, signature: "arc2(x, y, r1, r2, col, alp1, alp2)", note: "annulus built from quads with an alpha ramp, used for soft shadow/glow under dots"}
---

## What it draws
A night landscape. The upper ~27% is a smooth dark-blue sky fading lighter toward the horizon; at the
horizon a thin wavy line (mostly red, with dark undulations) sits at about 27% from the top. Below the
horizon the background runs in horizontal bands from deep blue down to a warm red at the bottom.
Scattered over the lower two-thirds are about 50 circles in blue, red, light-blue and near-black:
small near the horizon, large at the bottom, each with a faint dark shadow beneath and a soft glow.
A very faint white line network (a triangulation) connects the circles, and tiny white specks sit at
the centres of the triangles.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static). `randomSeed`/`noiseSeed` are set from
`seed` (parapara.pde:36-37), `background(0,2,4)`.

- **Horizon position**: `hor = random(0.15, 0.3)` (l.42); with seed 42 it lands near 0.27.
- **Horizon line**: loop `i<3` (l.46-59) draws three overlapping wavy strips at `y=height*hor`. For
  each x, `noise(x*det)` is scaled (`*4-2`), constrained to 0..1, `pow(,1.4)`, and mapped to an
  amplitude of `width*0.012` (l.52-53); fill is `rcol()` (random palette entry). The three stacked
  noisy strips form the thin multi-coloured (dominantly red) horizon line.
- **Ground gradient**: `sub = 1000` (l.62) full-width quads from the horizon to the bottom
  (l.73-89). `v = pow(i/sub, pwr=4.2)` (l.74-75, l.65) bunches the stripes near the horizon and
  stretches them toward the bottom; each vertex is filled with `getColor(ic1 + dc1*i)` at alpha 180
  (l.80-87), where `getColor` (l.277-283) lerps between adjacent palette entries with a steep
  `pow(t,10.8)` — so colour holds, then jumps, giving banded horizontal bands (blue -> dark -> red).
- **Sky gradient**: mirrored block (l.92-117) fills from `y=0` down to the horizon with the same
  stripe construction (`(1-pow(i/sub,pwr))*hor`), producing the smooth blue sky.
- **Dots**: 50 attempts (l.142-160): `val = random(0, random(0.98))` (biased small), `y = height*(hor + val*(1-hor))`,
  size `ss = (0.06+pow(val,1.4))*120` — so deeper points are bigger. A point is rejected if within
  `(ss+other.z)*0.6` of an existing one (l.149-155) — loose packing.
- **Mesh**: `Triangulate.triangulate(points2)` (l.163); all triangle edges drawn with `stroke(255,10)`
  (l.165-174) — the faint white network.
- **Dot rendering** (l.178-190): per point, `arc2` (l.231-248, ring built from alpha-ramped quads)
  draws two dark rings offset below the dot (shadow) and white/glow rings, then a solid `ellipse` in
  `rcol()`.
- **Triangle-centre specks** (l.192-211): per triangle centroid, a tiny thin stretched triangle
  (`ss = random(3)`, length `r*amp`, `amp = random(200)`) in a random palette colour, plus a 3px white
  dot `fill(255,240)` — the specks.

Randomness enters via the seed, `rcol()` per fill, palette index starts `ic1/ic2` and drifts
`dc1/dc2` (l.67-70, l.93-96), and all point/speck placement.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| hor_0.15 | `float hor = random(0.15, 0.3);` -> `float hor = 0.15;` | large | horizon sits at 15% of the height: narrow blue sky band, red wavy horizon line high, ground takes most of the frame | variants/hor_0.15/frame_00001.png |
| sub_100 | `int sub = 1000;` -> `int sub = 100;` | moderate | smooth gradient gone: distinct horizontal bands in sky and ground, red bands at horizon, mid and bottom | variants/sub_100/frame_00001.png |
| pwr_1.0 | `float pwr = 4.2;//random(1, 3);` -> `float pwr = 1.0;//random(1, 3);` | moderate | stripes evenly spaced: ground shows a wide red band around the middle and a dark band at the bottom; no horizon bunching | variants/pwr_1.0/frame_00001.png |
| points_150 | `for (int i = 0; i < 50; i++)` -> `for (int i = 0; i < 150; i++)` | subtle | noticeably denser field of dots (more small dots near the horizon); pixel change stays small | variants/points_150/frame_00001.png |
| dotsize_240 | `float ss = (0.06+pow(val, 1.4))*120;` -> `... *240;` | subtle | dots ~2x larger, more overlap, much bigger circles in the foreground; background and mesh unchanged | variants/dotsize_240/frame_00001.png |
| linealpha_60 | `stroke(255, 10);` -> `stroke(255, 60);` | none | no visible change; triangulation lines are still too faint to read at alpha 60 | variants/linealpha_60/frame_00001.png |

## Modularisation notes
Generic, library-worthy:
- `gradientStripes(count, power, y0, y1, palette, indexStart, drift, alpha)` — the stripe/quad
  gradient used twice (ground and sky) with only the y-range and pow direction mirrored.
- `packPoints(count, yRange, sizeFn, overlapFactor)` — rejection-sampled points with size-vs-depth.
- `delaunayMesh(points, color, alpha)` — triangulate + edge overlay (depends on the triangulate lib).
- `arc2/ringGlow(x, y, r1, r2, col, a1, a2)` — soft annular glow/shadow primitive.
- `getColor(palette, v)` — palette walk with `lerpColor` and a steep hold-then-jump curve.

One-off art decisions: the three noisy horizon strips, the thin stretched triangle specks, the
specific 9-entry blue/red palette, the shadow offset (`yy + ss*0.5`).

A clean parameter object: `{hor, stripeCount, stripePower, pointCount, sizeScale (120),
lineAlpha (10), speckCount, palette}`.
