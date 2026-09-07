---
sketch: 2019/generativos/pelalos
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2421
animated: false
techniques: [noise-field, grid, polar]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EAE5E5", "#F7EB04", "#7332AD", "#000000", "#92A7D3"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: flowers, default: 80, tried: [30], change: large, effect: "fewer, sparser flowers; grid, ground colour and translucent ellipse washes become clearly visible"}
  - {name: petalsPerRing, default: "8-20", tried: ["14-24"], change: large, effect: "denser, narrower petals; rosette silhouettes smoother and more finely serrated"}
  - {name: rings, default: "6-9", tried: ["3-5"], change: large, effect: "flatter, simpler rosettes with fewer concentric rings and less tonal depth to the centres"}
  - {name: amp, default: "0.3-0.6", tried: ["0.5-0.9"], change: subtle, effect: "petals slightly fatter; composition essentially unchanged"}
  - {name: sizeMul, default: 2.2, tried: [1.2], change: large, effect: "smaller flowers; denser field with more background ground and grid visible between them"}
  - {name: colorDetail, default: "4.2x", tried: ["1.2x"], change: large, effect: "coarser noise colour field: same flower layout, but broader uniform colour zones, neighbouring flowers sharing hue in large patches"}
reusable_candidates:
  - {name: petalRosette, signature: "petalRosette(x, y, size, rings, petalsPerRing, tilt, amp, colorFn) -> void", note: "concentric rings of gradient-filled elliptical petals, per-ring random Z-rotation, z-offset + slight rotateX/rotateY tilt, depth-tested"}
  - {name: gradientEllipse, signature: "circle(x, y, w, h, c1, c2) -> void", note: "closed vertex polygon with per-vertex lerpColor between two colors (L161-174)"}
  - {name: paletteNoiseColor, signature: "getColor(noise2(x, y, detail, offset) * palette.length) -> color", note: "2-D noise over canvas mapped to lerp between adjacent palette entries (L108-119, L238-243)"}
---

## What it draws
Full-bleed dark collage on a light blue-gray ground: a faint 40 px grid with tiny pale dots at cell
centers and a few translucent colored squares, washed by large soft translucent ellipses. On top,
~80 flower-like rosettes in purple, near-black and gray-blue (with small touches of yellow and
off-white) cover most of the canvas. Each flower is 6-9 concentric rings of overlapping elliptical
petals shrinking toward a small center, slightly 3D-tilted so petals read as ellipses in
perspective. Color is spatially coherent: purple rosettes cluster top-left, black masses dominate
center-right, pale blue sits in between, following a smooth field.

## How the code works
`setup()` calls `generate()` once (L24-27); `draw()` is empty (L34), so the sketch is static
(frames 1/10/60 identical). All randomness is seeded (L57-58). Layers, back to front:

1. Background: `background(getColor())` (L60) picks one random palette color (light blue-gray
   `#92A7D3` here).
2. Grid layer (L64-72): 40 px cells stroked white at alpha 20; 8% of cells filled with a
   translucent random palette color (the faint colored squares); a 2 px dot with random alpha at
   each cell center (L69-70).
3. Wash layer (L76-88): 50 random ellipses 60-432 px across, alpha 20-180, random palette color,
   each with a smaller solid 20%-size ellipse at its center -> the soft background blobs.
4. Dot/arc layer (L91-106): 110 small grid-snapped (20 px) marks: a faint gradient-alpha ring via
   `arc2()` (L189-206) plus a solid ellipse and a small center dot, 12-20 px.
5. Flowers (L111-158): 80 rosettes. Position snapped to the 40 px grid; size `ss` from
   `random(20, random(60,180)*random(0.5,1.8))*2.2` (L118). Color index `ic =
   noise(desCol+xx*detCol, desCol+yy*detCol)*colors.length` (L119) samples a 2-D noise field, so
   nearby flowers get nearby palette colors (spatial coherence). `cc = 8..20` petals per ring
   (L123), `div = 6..9` rings (L126). Per ring k: z = `desZ + k*8`, random `rotateZ`, radius and
   petal width scale by `mult = map(k,0,div,0.5,0)` (outer ring half-size at back, rings shrink
   toward the front). Whole flower tilted by `rotateX/rotateY` within `HALF_PI*maxRot`,
   `maxRot = 0.1..0.6` (L130-135), with `ENABLE_DEPTH_TEST` so overlapping petals sort correctly.
   Each petal is `circle()` (L161-174): a closed polygon whose per-vertex fill lerps between two
   palette colors from `getColor(ic + random(mdc) + k*mdc2)` (L149), so each flower drifts slowly
   through adjacent palette entries across its rings. Petal aspect `amp = 0.3..0.6` (L142).

Active palette (L229): `#EAE5E5, #F7EB04, #7332AD, #000000, #92A7D3`. `rcol()` (L232-234) is
random-from-list; `getColor(v)` (L238-243) lerps between adjacent entries, giving the soft
purple/black/blue-gray blends seen in the image.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| flowers_30 | `for (int i = 0; i < 80; i++)` -> `i < 30` (L111) | large (mean 0.1651, 0.524) | fewer, sparser rosettes; the light blue-gray ground, 40 px grid and translucent ellipse washes are now clearly visible between the flowers | variants/flowers_30/frame_00001.png |
| petals_24 | `int cc = int(random(8, 20))` -> `random(14, 24)` (L123) | large (mean 0.1719, 0.664) | denser, narrower petals per ring; rosette outlines smoother and more finely serrated, e.g. the central black flower and the yellow one read as many-petaled stars | variants/petals_24/frame_00001.png |
| rings_5 | `int div = int(random(6, 10))` -> `random(3, 5)` (L126) | large (mean 0.2318, 0.739) | rosettes have only 3-5 concentric rings: flatter, simpler flowers with less tonal depth and relatively larger centres | variants/rings_5/frame_00001.png |
| amp_0.9 | `float amp = random(0.3, random(0.4, 0.6))` -> `random(0.5, random(0.6, 0.9))` (L142) | subtle (mean 0.028, 0.079) | subtle: petals slightly fatter; overall composition essentially unchanged | variants/amp_0.9/frame_00001.png |
| size_1.2 | `*2.2;` -> `*1.2;` in flower size line (L118) | large (mean 0.1837, 0.612) | flowers about half the size: denser field of smaller rosettes, more ground, grid and wash ellipses showing between them | variants/size_1.2/frame_00001.png |
| detCol_1.2 | `random(0.0006, 0.001)*4.2` -> `*1.2` (L108) | large (mean 0.153, 0.648) | same flower layout (deterministic), but coarser colour field: broad uniform zones, large neighbouring patches sharing one hue (purple area top-left, black mass center-right) instead of finer per-flower variation | variants/detCol_1.2/frame_00001.png |

## Modularisation notes
- Generic: `circle()` gradient-vertex polygon (L161-174), `arc2()` gradient-alpha ring (L189-206),
  the noise-field palette sampler (L108-119 + L238-243), and the whole flower loop (L111-158) as a
  `petalRosette` function with parameters (count, sizeDist, rings, petalsPerRing, amp, tilt,
  zStep, colorField).
- One-off art decisions: the specific 5-color palette and the commented-out alternates (L225-231);
  the background grid/dot/square layers (L62-72); the wash ellipses (L76-88) and small arc dots
  (L91-106) are decorative filler and could be separate toggleable layers.
- Clean parameter object: `{flowers: 80, flowerSize: [20, 180], sizeMul: 2.2, rings: [6, 10],
  petals: [8, 20], amp: [0.3, 0.6], maxTilt: [0.1, 0.6], zStep: 8, colorDetail: 4.2, palette,
  seed}`; the grid/wash/dot layers as boolean or count toggles.
