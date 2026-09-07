---
sketch: 2020/generative/01_04/monta
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3742
animated: false
techniques: [noise-field, dots-stippling, blend-modes, shader, particles]
primitives: [shape, ellipse, point]
palette:
  colors: ["#B4CBFD", "#120F1F", "#1F3018", "#7B7D30", "#B08247", "#FAD47D", "#2B2400", "#684D07", "#820318", "#0F1B36", "#CFDADC", "#00497C"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: mountains, default: 20, tried: [35], change: moderate, effect: "more, thinner layers; flatter gentler ridges, paler/hazier overall, tan ground shows through"}
  - {name: detH, default: "random(0.0012,0.002)*0.8", tried: ["random(0.003,0.005)*0.8"], change: moderate, effect: "higher-frequency ridge noise; much spikier jagged alpine peaks"}
  - {name: cc_mult, default: 0.8, tried: [2.0], change: moderate, effect: "denser stipple points inside canopies; deeper, more saturated texture, same tree shapes"}
  - {name: detSiz, default: "random(0.01)", tried: ["random(0.03)"], change: moderate, effect: "more size variation; larger, clumpier tree canopies"}
  - {name: zone_exponent, default: 8, tried: [2], change: moderate, effect: "weaker clearing mask; gaps fill with trees, fewer clearings (most subtle of the set)"}
  - {name: amp, default: "height*0.9", tried: ["height*0.5"], change: moderate, effect: "ridges compressed into the top half; large empty dark area at the bottom"}
  - {name: stippleCanopy, signature: "stippleCanopy(x, y, w, h, count, palette) -> void", note: "random points inside an ellipse with distance-biased radius and ADD/NORMAL flicker"}
---

## What it draws

A full-bleed stylized landscape: ~20 overlapping mountain ridges stacked back-to-front, each a
smooth noise contour. Distant ridges fade into the pale periwinkle sky (thin, hazy, faint pink
stippling); mid ridges are olive and gold; the nearest ridges are dark maroon and near-black with
dense, clearly legible trees. Every ridge is carpeted with hundreds of small trees: round stippled
canopies on thin pale trunks, with gaps where 2-D noise carves clearings. Diagonal semi-transparent
light beams shine down from the top edge, and a soft displaced mist band washes the bottom of the
canvas. A few tiny dark bird silhouettes sit in the sky.

## How the code works

`generate()` (monta.pde:65) runs once in `setup()`; `draw()` is empty, so the piece is static.
| mountains_35 | `int mountains = 20;` -> `int mountains = 35;` | moderate (mean 0.1432, 0.631) | more, thinner layers; flatter gentler ridges; more stacked haze so the scene reads paler/hazier, with a tan/beige ground patch in the foreground | variants/mountains_35/frame_00001.png |
| detH_fine | `float detH = random(0.0012, 0.002)*0.8;` -> `...random(0.003, 0.005)*0.8;` | moderate (mean 0.1, 0.438) | higher-frequency ridge noise: smooth rounded ridges become sharp, vertical alpine peaks | variants/detH_fine/frame_00001.png |
| canopyDots_dense | `...random(0.08, 0.1))*0.8);` -> `...*2.0);` | moderate (mean 0.0746, 0.262) | denser stipple points fill the canopies; deeper, more saturated red/maroon texture, tree silhouettes unchanged | variants/canopyDots_dense/frame_00001.png |
| detSiz_large | `float detSiz = random(0.01);` -> `random(0.03);` | moderate (mean 0.0725, 0.275) | stronger size variation: larger, clumpier tree canopies, especially in the foreground | variants/detSiz_large/frame_00001.png |
| zoneExponent_2 | `...1), 8);` -> `...1), 2);` | moderate (mean 0.0594, 0.179) | clearing mask weakened; open gaps fill with trees, far fewer clearings (most subtle change) | variants/zoneExponent_2/frame_00001.png |
| amp_half | `float amp = height*0.9;` -> `height*0.5;` | moderate (mean 0.1261, 0.577) | ridge stack compressed into the top half; bottom half becomes a large empty near-black area | variants/amp_half/frame_00001.png |

- Layer depth `v = ((i+1)/mountains)^4` (lines 86–89): the 4th power biases almost all layers to
  the bottom of the stack, so far ridges are low and flat while the front few sweep high.
  `y = v*amp` (line 91, `amp = 0.9*height`) is the ridge base line; `hh = (v-av)*amp*5` (line 92)
  is its relief, which grows toward the front.
- A faint full-width quad is filled with `lerpColor(#B4CBFD, #120F1F, v)` at alpha 24/0
  (lines 96–104): this is the atmospheric-perspective haze between layers.
- The ridge outline (lines 118–122): per x-pixel, 2-D `SimplexNoise.noise(j*detH*..., y*detH,
  seed*0.001)`, `pow(noi, 1.4)`, sampled at `y - hh*noi`. `detH` scales with `av`, so back ridges
  use higher-frequency noise (jagged) and front ridges lower frequency (broad slopes).
- Tree placement (lines 125–147): 8 random candidates per x-pixel, each placed at `yy..y`
  (inside the ridge body). Size `ns` comes from `noise(nx*detSiz, ny*detSiz)` scaled by `v`
  (front trees bigger), then multiplied by
  `pow(1 - constrain(noise(...detZon...)*16-10, 0, 1), 8)` (line 133): a third noise channel that
  zeroes whole regions — the visible clearings. Candidates are kept only if not too close to
  already-accepted points in `three` (line 139), a rejection sampler that prevents overlap.
- Trees are sorted by y (line 155, `Point.compareTo`) and drawn back-to-front via `cir()`
  (line 201): a stippled dark ellipse canopy — `PI*w*h*random(...)` black points (line 207–216,
  each point ADD or NORMAL blend at random), colour lerped from `#120F1F` toward
  `getColor(i + noise*3)` (lines 159–160, 203): the per-layer hue ramp that produces the
  olive/gold/maroon front-to-back progression; plus a two-tone pale trunk (#CFDADC / #00497C
  triangles, lines 225–232) and a few #CFDADC side branches (lines 237–252).
- Light beams (lines 167–177): per layer, a thin `ADD`-blended `#B4CBFD` triangle from a point
  above the canvas (`hpy < 0`) to the bottom edge — the diagonal beams.
- `birds()` (line 255): up to 100 random sky positions, kept where a thresholded noise field is
  high, drawn as small closed black shapes — the dark specks in the sky.
- Mist (lines 186–197): an `ADD`-blended bottom gradient of `#B4CBFD` (alpha `80–120 * (1-v/2)`)
  rendered through `noiseShadowFrag.glsl` with a random `displace` value — the soft displaced
  haze at the bottom. The shader is a GLSL filter; headless P2D software GL may render it
  imperfectly, but here `display: ":2"` (X display) so the baseline image is trusted.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- **Generic / library-ready**: the noise ridge profile (simplex 1-D slice, pow-shaped, detail
  scaling with depth) — `noiseRidge`; the rejection-sampled scatter with distance rule
  `(ns+other.s)*0.4` — `scatterWithRejection`; the stippled-ellipse canopy with distance-biased
  point radii and per-point ADD flicker — `stippleCanopy`; the layered atmospheric haze quad
  (lerp between two colours by layer depth, low alpha); the thresholded-noise "clearing" mask
  (`pow(1-constrain(noise*16-10,0,1), 8)`).
- **One-off art decisions**: the 4th-power depth bias (line 88), the two hard-coded palettes
  (aux grass ramp line 110, aux2 line 152), the trunk two-tone triangle construction, the bird
  silhouette path, beam alpha/angle ranges, the GLSL shadow filter.
- **Clean parameter object**: `{ seed, layers, amp (0..1 * height), ridgeDetail (detH range),
  reliefScale (the *5 in hh), treeDetail (detSiz), zoneNoise (detZon + threshold + exponent),
  candidatesPerPixel, minDistFactor, canopyDensity (the *0.8 in cc), palette[], haze[],
  beamAlpha, mistAlpha, birdDensity }`.
