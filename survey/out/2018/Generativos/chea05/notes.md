---
sketch: 2018/Generativos/chea05
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2790
animated: false
techniques: [3d-pointcloud, polar, dots-stippling]
primitives: [point]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: random-from-list
composition: radial
parameters: []
reusable_candidates:
  - {name: radialPointCloud, signature: "radialPointCloud(cx, cy, layers, pointsPerLayer, maxR, palette, alphaFn) -> void", note: "concentric layers of points at radius r*cos(a1)*cos(a2); product-of-cosines concentrates points near 0 and near r, producing the banded ring look"}
---

## What it draws
A flat bright crimson-red field with a single centered disc that reads as a
3D sphere. The disc is built from four nested concentric rings of extremely
densely scattered tiny dots: the outer ring is pinkish-red, the next band is
darker magenta, the core is the darkest deep plum. The dots are so dense the
bands blur into solid tones with a grainy, stippled texture. No other marks.

## How the code works
`setup()` (chea05.pde:3-9) sizes the P2D canvas 960x960 and calls
`generate()` once; `draw()` is empty so the piece is static (frames 10/60
identical to frame 1). `generate()` (lines 22-45) seeds RNG/noise, fills the
background with one random palette colour `rcol()` (line 54-56: random from
the 5-colour red/plum list on line 53), then loops over `sub = 4` layers
(line 28). Layer `j` gets radius `r = width*0.4 * map(j, 0, sub, 1, 0)`
(line 32), so layer 0 is the biggest and each successive layer is smaller,
giving the nested-ring structure. Each layer draws 1,000,000 points (line 33);
point position (lines 34-37) is `x = cx + cos(a1)*cos(a2)*r`,
`y = cy + sin(a1)*cos(a2)*r` with both angles uniform in [0, TAU): the
product-of-cosines radius distribution is peaked near 0 and near r, so points
cluster into a bright rim and a dense centre, with the characteristic ring
banding. `z = sin(2)*300` (line 38) is a constant so all points share one
depth (visual "sphere" illusion comes purely from the 2D distribution).
Colour (line 40) is a random palette colour with fully random alpha
`random(255)`, so the 4M semi-transparent points layer into the visible
tone gradient. A second palette (line 52) is commented out. `getColor`
(57-65) is unused by `generate()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic core is `radialPointCloud`: given a centre, a layer count, points
per layer, max radius, a colour/alpha function and a radius-shaping function,
scatter points in polar coordinates. The one-off art decisions: the
`cos(a1)*cos(a2)` radius shape (what creates the banded sphere), the constant
z, the random-alpha accumulation, and the specific red/plum palette. A clean
parameter object: `{cx, cy, layers, pointsPerLayer, maxRadius, radiusShape,
palette, alphaFn, backgroundFromPalette: true}`.
