---
sketch: 2018/Generativos/puda03
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1708
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#D9D9E5", "#FFCC01", "#FF598D", "#FEAFCC", "#BE0117", "#2A1B52"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(300,360)", tried: [100], change: large, effect: "fewer lines: much darker, hatching stripes visible, palette colours (gold/orange) show through"}
  - {name: displacement amplitude, default: 30, tried: [80], change: large, effect: "bigger wander: smooth saturated white fields, thicker softer central ring"}
  - {name: stroke alpha, default: 20, tried: [80], change: moderate, effect: "brighter overall; fine hatching stripes become visible"}
  - {name: strokeWeight, default: 1.4, tried: [4], change: subtle, effect: "no visible change; hatching marginally denser/softer"}
  - {name: detAng multiplier, default: "0.002-0.01*0.1", tried: ["0.002-0.01*0.5"], change: large, effect: "5x angle-field frequency: lines twist and cross into a woven marble pattern"}
  - {name: fill alpha, default: 80, tried: [200], change: large, effect: "whiter and smoother, sharper dark ring; still no visible hue"}
  - {name: noiseDisplaceLine, signature: "noiseDisplaceLine(x1, y1, x2, y2, angOffset, angScale, desOffset, desScale, amplitude) -> PVector[]", note: "resample a straight segment and displace each sample along a simplex-noise angle field with simplex-noise amplitude"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "getColor(): map v in [0,1) to adjacent palette entries and lerp between them"}
---

## What it draws
A near-black square covered in a dense horizontal hatching of thin lines, each line wobbled by
low-frequency noise so the hatching ripples and swirls. Where the wobbled lines bunch together
the additive strokes saturate to bright white masses (top and lower-left); where they pull apart
the black ground shows through, forming a large dark ring ("O" shape) in the centre with a
brighter interior. The image reads as monochrome white/gray/black even though a colour palette
is in the code.

## How the code works
- `setup()` (L6-11) sizes the P2D canvas 960x960, calls `generate()` once; `draw()` is empty
  (L13-14), so the piece is static and generated a single time.
- `generate()` (L24-55): `blendMode(ADD)` (L26), near-black background `#010101` (L31).
  Randomness: `seed` set by the harness (L4), `randomSeed`/`noiseSeed` (L29-30) fix all draws.
  Noise field parameters are randomised per run (L33-36): offsets `desAng`/`desDes` in 0..1000,
  spatial scales `detAng = random(0.002,0.01)*0.1` (angle field, very low frequency) and
  `detDes = random(0.002,0.01)*0.2` (displacement field). `noiseDetail(2)` (L38) affects
  Processing's `noise()` only, which this sketch never calls; distortion uses toxi
  `SimplexNoise` instead.
- Line count `cc = int(random(300,360))` (L42), margin `bb = 20` (L43), spacing
  `ss = (width-40)/cc ≈ 2.8 px` (L44). Stroke is `stroke(255, 20)` at weight 1.4 (L46-47):
  a faint white that accumulates under ADD.
- Loop (L51-54): for each of ~330 lines, `fill(getColor(ic+dc*j), 80)` (L52) sets a slowly
  drifting palette colour at alpha 80 (open shapes are filled as closed, so this tints the thin
  sliver each wobbled line encloses), then `nline` draws the line from x=20 to x=940 at
  y = 20 + j*ss (L53).
- `nline` (L57-66) resamples the segment at every integer pixel and displaces each sample with
  `desform`.
- `desform` (L73-77): `ang = simplex(off + x*detAng, off + y*detAng) * TAU*3` gives a smooth
  angle field; `des = simplex(off + x*detDes, off + y*detDes) * 30` gives displacement up to
  30 px; the sample moves to `(x + cos(ang)*des, y + sin(ang)*des)`. This is what creates the
  swirls, the bunched white masses, and the dark gaps/ring.
- Colour: `getColor(v)` (L102-109) lerps between adjacent entries of the active 7-colour
  palette (L85: white, lavender, yellow, pink, light pink, red, indigo). `v = ic + dc*j` with
  `ic = random(1)`, `dc = random(0.002)` (L48-49) drifts almost imperceptibly from line to line.
- Visual result: additive accumulation of ~330 faint white strokes over black makes line density
  read as brightness; the colour fill is too faint relative to the additive white to register —
  the baseline image looks grayscale.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(300, 360));` -> `int cc = 100;` | large | Much darker; the horizontal hatching is now visible as individual stripes; the additive white no longer saturates, so the palette colours show through: golden-yellow band across the top, orange mass lower-left, dark ring in the centre | variants/cc_100/frame_00001.png |
| des_80 | `...detDes)*30;` -> `...detDes)*80;` | large | Lines wander 2.7x farther and interlace into large smooth fields: most of the canvas saturates to white, the central ring becomes thicker and softer-edged, hatching barely visible | variants/des_80/frame_00001.png |
| stroke_alpha_80 | `stroke(255, 20);` -> `stroke(255, 80);` | moderate | Brighter overall; the fine hatching becomes visible as dense stripes across the whole canvas, the central ring turns softer and grayer | variants/stroke_alpha_80/frame_00001.png |
| stroke_weight_4 | `strokeWeight(1.4);` -> `strokeWeight(4);` | subtle | No visible change: same composition; the thicker strokes close the gaps between hatch lines so the image reads slightly denser/softer | variants/stroke_weight_4/frame_00001.png |
| detAng_0.5 | `random(0.002, 0.01)*0.1;` -> `random(0.002, 0.01)*0.5;` | large | 5x higher-frequency angle field: the lines twist and cross each other, producing a woven marble-like pattern of interlocking white and dark-gray bands with a spiral in the centre; completely different from the baseline | variants/detAng_0.5/frame_00001.png |
| fill_alpha_200 | `fill(getColor(ic+dc*j), 80);` -> `fill(getColor(ic+dc*j), 200);` | large | The canvas becomes whiter and smoother and the central ring sharper and darker, but no hue appears - the additive coloured fills still wash out to white | variants/fill_alpha_200/frame_00001.png |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: `noiseDisplaceLine` (resample + displace a segment along two simplex
  fields: one driving direction, one driving magnitude) is the core of the piece;
  `lerpPalette` (getColor) is a small reusable palette helper.
- One-off art decisions: the specific noise scales/multipliers (`*0.1`, `*0.2`, `TAU*3`,
  amplitude 30), the 7-colour palette and its commented alternatives, the margin `bb=20`,
  stroke (255,20)/weight 1.4, fill alpha 80, and the ADD-blend-on-black density-to-brightness
  trick.
- A clean parameter object: `{lineCount, margin, strokeColor, strokeAlpha, strokeWeight,
  fillAlpha, angOffset, angScale, desOffset, desScale, amplitude, palette, colorDrift}`.
- Note: the triangulate import (L1) is unused; only toxi's SimplexNoise is actually needed.
