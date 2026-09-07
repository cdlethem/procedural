---
sketch: 2020/generative/05_08/mota
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3474
animated: false
techniques: [noise-field, dots-stippling, blend-modes]
primitives: [shape, ellipse, point, image]
palette:
  colors: ["#F7AA06", "#88AFD8", "#EA527F", "#BF052A", "#214CA2", "#F7A102", "#3F81D0", "#EA215A", "#BF0226", "#153D9C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: mountains, default: 20, tried: [40], change: large, effect: "more, thinner bands; upper layers pack denser, lower foreground bands unchanged"}
  - {name: detH, default: "random(0.0012, 0.002)*0.8", tried: ["random(0.003, 0.005)*0.8"], change: large, effect: "finer ridge noise -> sharp, jagged, wiggly band edges instead of smooth waves"}
  - {name: detSiz, default: 0.01, tried: [0.003], change: large, effect: "finer tree-size noise -> trees smaller and more evenly scattered, less clumpy blobbing"}
  - {name: glow, default: 1.2, tried: [2.5], change: moderate, effect: "stronger additive self-composite -> sky bands washed toward white, overall brighter"}
  - {name: layerStart, default: 8, tried: [2], change: large, effect: "six extra thin upper layers drawn; busier image, more ridges and trees"}
reusable_candidates:
  - {name: noiseRidge, signature: "noiseRidge(y, detail, amp, gamma) -> float[]", note: "1-D simplex-noise ridge profile (mota.pde:123-128) displacing the top edge of each mountain band"}
  - {name: stippledTree, signature: "stippledTree(x, y, w, h, col) -> void", note: "cir() (mota.pde:248-304): stippled ellipse canopy + two-tone trunk triangles + side-branch triangles"}
  - {name: glowPass, signature: "glowPass(buffer, tintRGB) -> void", note: "self-composite via get()/tint()/image() under ADD blend (mota.pde:222-225)"}
---

## What it draws
A flat, layered mountain landscape seen from above, full-bleed. Smooth wavy ridge
bands stack from a bright sky (yellow, peach, pink) down through periwinkle blue and
salmon to a hot-pink foreground. Clusters of stylized trees — grainy stippled canopies
in orange, yellow, violet, pink and blue, on thin two-tone triangular trunks — sit in
bunches along the ridges. The whole image has a speckled grain, a warm glow, faint
radial light rays from the top, and small black bird silhouettes scattered in the
open bands.

## How the code works
Static one-shot sketch: `setup()` calls `generate()` (mota.pde:23-31); `draw()` is
empty (mota.pde:33-34). `generate()` (mota.pde:61-246):

- Background from a random palette colour (mota.pde:66); `fogColor` fixed per run
  (mota.pde:68).
- 20 mountain layers, but the loop only draws i = 8..19 (mota.pde:70, 85). For each
  layer `v = (i+1)/20`, `y = v^4 * 0.9*height` (mota.pde:86-91): the pow-4 packing
  squeezes upper layers near the top and spreads lower ones apart. Each band is a
  4-vertex shape filled with `lerpColor(rcol(), fogColor, v*0.8)` at alpha 8 under
  ADD (mota.pde:96-105), so bands are translucent additive tints.
- Ridge profile: for every 2 px column, a toxi `SimplexNoise` sample
  `noise(j*detH*..., y*detH, seed*0.001)` raised to the 1.4 power gives the band's
  top edge `yy = y - hh*noi` (mota.pde:123-128); `hh` scales with the layer's
  thickness `random(3,6)` (mota.pde:92).
- Trees: 20 rejection-sampled candidate points per column (mota.pde:135-169). Size
  `ns` comes from two noise fields — `detSiz` for blobby clumps, and a `detZon`
  "zoning" noise raised to the 8th power (mota.pde:143) that zeros most areas,
  leaving only a few zones with trees (the clusters along the ridges). A
  min-distance check against the `three` list prevents overlap.
- Points sorted top-to-bottom (`Collections.sort` on y, mota.pde:51-58, 176) and
  drawn by `cir()` (mota.pde:248-304): a low-alpha ellipse canopy tinted
  `lerpColor(rcol(), getColor(val), ...)` (alpha 180), ~`PI*w*h*0.06..0.1` white
  speckle points (the grain), a two-tone triangular trunk, and 1-3 side-branch
  triangles. Colour index `col = i + noise*colors.length*3` maps layer depth onto
  the 5-colour palette, so each layer's trees share a hue family (mota.pde:180-184).
- Palette is a 5-colour array reassigned per layer to `aux` (canopy) / `aux2`
  (mota.pde:112-113, 173-174); `rcol()` picks a random entry, `getColor(v)`
  lerps between adjacent entries (mota.pde:351-364).
- Per-layer atmosphere: two wide ADD triangles fanning from an off-screen point
  above the canvas (light rays, mota.pde:207-219), then a self-composite glow pass:
  `get()` + `tint(18*glow, 8*glow, 14*glow)` + `image()` under ADD (mota.pde:222-225)
  which brightens and saturates everything drawn so far.
- `birds()` (mota.pde:306-340): 100 random positions, kept only where 2-D noise >
  0.6, drawn as small 8-vertex black bird shapes.
- A final ADD sky-gradient quad washes the top of each layer (mota.pde:235-244).
- The GLSL files in `data/` are dead code: the `shader(noi)` call is commented out
  (mota.pde:94-95), so no shader runs (consistent with `display: ":2"`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| mountains_40 | `int mountains = 20;` -> `int mountains = 40;` | large | many more, thinner bands; upper part of the image packs densely with pale narrow bands, lower foreground bands look the same; more tree lines along the new ridges | variants/mountains_40/frame_00001.png |
| detH_0.003 | `float detH = random(0.0012, 0.002)*0.8;` -> `float detH = random(0.003, 0.005)*0.8;` | large | ridge edges become sharply jagged and wiggly (high-frequency undulation) instead of smooth wide waves; bands read as crinkled ribbons | variants/detH_0.003/frame_00001.png |
| detSiz_0.003 | `float detSiz = random(0.01);` -> `float detSiz = random(0.003);` | large | trees are smaller and scattered more evenly across each band; the large smooth canopy clumps of the baseline break up into finer, denser scatter | variants/detSiz_0.003/frame_00001.png |
| glow_2.5 | `float glow = 1.2;` -> `float glow = 2.5;` | moderate | brighter overall: sky bands wash toward white, canopies lose some saturation; composition unchanged | variants/glow_2.5/frame_00001.png |
| layers_18 | `for (int i = 8; i < mountains; i++) {` -> `for (int i = 2; i < mountains; i++) {` | large | six extra thin upper layers appear: dense stack of narrow pale bands at the top, more tree lines, busier image | variants/layers_18/frame_00001.png |

## Modularisation notes
- Generic candidates: `noiseRidge` (any noise-displaced band boundary), `stippledTree`
  (the whole `cir()` routine is self-contained: position, size, colour value in;
  stippled canopy + trunk out), `glowPass` (tinted self-composite bloom), the
  zoning trick `pow(noise(z), 8)` for clustering scattered objects, and the
  min-distance rejection sampler for non-overlapping points.
- Art decisions: the specific 5-colour palettes, pow-4 layer packing, the `random(3,6)`
  ridge amplitude, the tint values of the glow pass.
- A clean parameter object: `{layerStart, layerCount, amp, ridgeDetail, ridgeGamma,
  zoneDetail, zonePow, treeDensity, canopyDensity, glowTint, skyColor, palette}`.
